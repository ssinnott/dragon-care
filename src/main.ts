// Placeholder entry; replaced by the dragon gallery.
import { drawText } from './lib/engine/text.ts';

const el = document.getElementById('stage');
if (!(el instanceof HTMLCanvasElement)) throw new Error('index.html: no <canvas id="stage">');
const ctx = el.getContext('2d')!;
ctx.fillStyle = '#16141c'; ctx.fillRect(0, 0, el.width, el.height);
drawText(ctx, 'DRAGON CARE', 10, 10, { size: 2, color: '#e8d8c0' });
if (window.__dragonCare) window.__dragonCare.ready = true;
