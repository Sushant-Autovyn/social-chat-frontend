import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

type Kind = 'audio' | 'video';
type State = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'in-call';

interface InvitePayload { fromUserId: number; callId: string; kind: Kind; }
interface SdpPayload { fromUserId: number; callId: string; sdp: RTCSessionDescriptionInit; }
interface IcePayload { fromUserId: number; callId: string; candidate: RTCIceCandidateInit; }
interface SimplePayload { fromUserId: number; callId: string; reason?: string; }

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

@Injectable({ providedIn: 'root' })
export class CallService {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];

  readonly state = signal<State>('idle');
  readonly kind = signal<Kind>('video');
  readonly callId = signal<string | null>(null);
  readonly peerUserId = signal<number | null>(null);
  readonly localStream$ = new Subject<MediaStream | null>();
  readonly remoteStream$ = new Subject<MediaStream | null>();
  readonly muted = signal(false);
  readonly cameraOff = signal(false);

  constructor(private auth: AuthService) {}

  // Connect signaling socket. Reuses chat namespace for simplicity.
  ensureSocket(): Socket {
    if (this.socket?.connected) return this.socket;
    const token = this.auth.getToken();
    this.socket = io(`${environment.apiBase}/chat`, { auth: { token } });
    this.bindSignaling();
    return this.socket;
  }

  private bindSignaling() {
    if (!this.socket) return;
    this.socket.on('call:invite', (p: InvitePayload) => this.onIncoming(p));
    this.socket.on('call:accept', (p: SimplePayload) => this.onAccepted(p));
    this.socket.on('call:reject', (p: SimplePayload) => this.onRejected(p));
    this.socket.on('call:end', (p: SimplePayload) => this.onRemoteEnd(p));
    this.socket.on('call:offer', (p: SdpPayload) => this.onOffer(p));
    this.socket.on('call:answer', (p: SdpPayload) => this.onAnswer(p));
    this.socket.on('call:ice', (p: IcePayload) => this.onIce(p));
  }

  // -------- Caller flow --------
  async startCall(toUserId: number, kind: Kind = 'video') {
    if (this.state() !== 'idle') return;
    this.ensureSocket();
    this.kind.set(kind);
    this.peerUserId.set(toUserId);
    const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.callId.set(callId);
    this.state.set('outgoing');
    try {
      await this.acquireMedia(kind);
    } catch (err) {
      this.cleanup();
      throw err;
    }
    this.socket!.emit('call:invite', { toUserId, callId, kind });
  }

  private async onAccepted(p: SimplePayload) {
    if (p.callId !== this.callId()) return;
    this.state.set('connecting');
    this.createPeer();
    this.attachLocalTracks();
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.socket!.emit('call:offer', {
      toUserId: this.peerUserId(),
      callId: this.callId(),
      sdp: offer,
    });
  }

  private onRejected(p: SimplePayload) {
    if (p.callId !== this.callId()) return;
    this.cleanup();
  }

  // -------- Callee flow --------
  private onIncoming(p: InvitePayload) {
    if (this.state() !== 'idle') {
      // Auto-reject if busy
      this.socket!.emit('call:reject', { toUserId: p.fromUserId, callId: p.callId, reason: 'busy' });
      return;
    }
    this.peerUserId.set(p.fromUserId);
    this.callId.set(p.callId);
    this.kind.set(p.kind);
    this.state.set('incoming');
  }

  async accept() {
    if (this.state() !== 'incoming') return;
    try {
      await this.acquireMedia(this.kind());
    } catch (err) {
      this.reject('media-error');
      throw err;
    }
    this.createPeer();
    this.attachLocalTracks();
    this.state.set('connecting');
    this.socket!.emit('call:accept', {
      toUserId: this.peerUserId(),
      callId: this.callId(),
    });
  }

  reject(reason = 'declined') {
    if (this.state() !== 'incoming') return;
    this.socket?.emit('call:reject', {
      toUserId: this.peerUserId(),
      callId: this.callId(),
      reason,
    });
    this.cleanup();
  }

  // -------- SDP/ICE handlers --------
  private async onOffer(p: SdpPayload) {
    if (p.callId !== this.callId()) return;
    if (!this.pc) this.createPeer();
    if (!this.localStream) {
      try { await this.acquireMedia(this.kind()); this.attachLocalTracks(); } catch { /* ignore */ }
    }
    await this.pc!.setRemoteDescription(new RTCSessionDescription(p.sdp));
    await this.flushIce();
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.socket!.emit('call:answer', {
      toUserId: this.peerUserId(),
      callId: this.callId(),
      sdp: answer,
    });
  }

  private async onAnswer(p: SdpPayload) {
    if (p.callId !== this.callId() || !this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
    await this.flushIce();
  }

  private async onIce(p: IcePayload) {
    if (p.callId !== this.callId()) return;
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(p.candidate);
      return;
    }
    try { await this.pc.addIceCandidate(new RTCIceCandidate(p.candidate)); } catch { /* ignore */ }
  }

  private async flushIce() {
    if (!this.pc) return;
    for (const c of this.pendingIce) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    this.pendingIce = [];
  }

  // -------- Hangup --------
  hangup() {
    if (this.state() === 'idle') return;
    this.socket?.emit('call:end', {
      toUserId: this.peerUserId(),
      callId: this.callId(),
    });
    this.cleanup();
  }

  private onRemoteEnd(p: SimplePayload) {
    if (p.callId && p.callId !== this.callId()) return;
    this.cleanup();
  }

  // -------- Toggles --------
  toggleMute() {
    if (!this.localStream) return;
    const next = !this.muted();
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
    this.muted.set(next);
  }
  toggleCamera() {
    if (!this.localStream) return;
    const next = !this.cameraOff();
    this.localStream.getVideoTracks().forEach((t) => (t.enabled = !next));
    this.cameraOff.set(next);
  }

  // -------- Internals --------
  private async acquireMedia(kind: Kind) {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: kind === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream$.next(this.localStream);
  }

  private createPeer() {
    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket?.emit('call:ice', {
          toUserId: this.peerUserId(),
          callId: this.callId(),
          candidate: e.candidate.toJSON(),
        });
      }
    };
    this.pc.ontrack = (e) => {
      const [stream] = e.streams;
      this.remoteStream$.next(stream);
      this.state.set('in-call');
    };
    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') {
        // Give it a beat for transient disconnects
        if (s !== 'disconnected') this.cleanup();
      }
    };
  }

  private attachLocalTracks() {
    if (!this.pc || !this.localStream) return;
    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }
  }

  private cleanup() {
    try { this.pc?.getSenders().forEach((s) => s.track?.stop()); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.localStream$.next(null);
    this.remoteStream$.next(null);
    this.pendingIce = [];
    this.state.set('idle');
    this.callId.set(null);
    this.peerUserId.set(null);
    this.muted.set(false);
    this.cameraOff.set(false);
  }
}
