import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CallService } from './call.service';
import { UsersService, UserSummary } from '../users/users.service';

@Component({
  selector: 'app-call-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-overlay.html',
  styleUrl: './call-overlay.css',
})
export class CallOverlay implements AfterViewInit, OnDestroy {
  private callSvc = inject(CallService);
  private usersSvc = inject(UsersService);

  @ViewChild('localVid') localVid?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVid') remoteVid?: ElementRef<HTMLVideoElement>;

  state = this.callSvc.state;
  kind = this.callSvc.kind;
  muted = this.callSvc.muted;
  cameraOff = this.callSvc.cameraOff;

  peer = computed<UserSummary | null>(() => null);
  peerName = '';
  peerInitial = '?';

  private subs: Subscription[] = [];
  private peerCache = new Map<number, UserSummary>();

  ngAfterViewInit(): void {
    this.subs.push(
      this.callSvc.localStream$.subscribe((s) => {
        if (this.localVid?.nativeElement) {
          this.localVid.nativeElement.srcObject = s;
        }
      }),
      this.callSvc.remoteStream$.subscribe((s) => {
        if (this.remoteVid?.nativeElement) {
          this.remoteVid.nativeElement.srcObject = s;
        }
      }),
    );

    // Resolve peer name as call state changes
    setInterval(() => this.resolvePeer(), 500);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private resolvePeer() {
    const id = this.callSvc.peerUserId();
    if (!id) { this.peerName = ''; this.peerInitial = '?'; return; }
    const cached = this.peerCache.get(id);
    if (cached) {
      this.peerName = cached.fullName;
      this.peerInitial = cached.fullName.charAt(0);
      return;
    }
    this.usersSvc.byId(id).subscribe({
      next: (u) => {
        this.peerCache.set(id, u);
        this.peerName = u.fullName;
        this.peerInitial = u.fullName.charAt(0);
      },
      error: () => { this.peerName = `User ${id}`; this.peerInitial = '?'; },
    });
  }

  accept() { this.callSvc.accept(); }
  reject() { this.callSvc.reject(); }
  hangup() { this.callSvc.hangup(); }
  toggleMute() { this.callSvc.toggleMute(); }
  toggleCamera() { this.callSvc.toggleCamera(); }
}
