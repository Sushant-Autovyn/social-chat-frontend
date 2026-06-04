const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="55%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="bubble" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dx="0" dy="6" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <path fill="url(#bubble)" d="M138 132h236c22 0 40 18 40 40v152c0 22-18 40-40 40H238l-58 50c-9 8-23 1-23-11v-39h-19c-22 0-40-18-40-40V172c0-22 18-40 40-40z"/>
  </g>
  <g fill="#6366f1">
    <circle cx="200" cy="248" r="22"/>
    <circle cx="256" cy="248" r="22" fill="#a855f7"/>
    <circle cx="312" cy="248" r="22" fill="#ec4899"/>
  </g>
</svg>`;

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT = path.resolve(__dirname, 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const svgBuf = Buffer.from(ICON_SVG);
  for (const size of SIZES) {
    const out = path.join(OUT, `icon-${size}x${size}.png`);
    await sharp(svgBuf).resize(size, size).png().toFile(out);
    console.log('wrote', out);
  }
  // favicon (multi-size base 64x64 PNG; ico is fine as png renamed for browsers but keep .ico path)
  await sharp(svgBuf).resize(64, 64).png().toFile(path.resolve(__dirname, 'public', 'favicon-64.png'));
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
