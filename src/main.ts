// Entry point: the dragon gallery (src/gallery.ts). The query string is the page's to interpret (tools/shot.ts
// contract): which view, which anim, a frozen time `t`; `ready` is set only once that frame has been drawn.
import { startGallery } from './gallery.ts';

const el = document.getElementById('stage');
if (!(el instanceof HTMLCanvasElement)) throw new Error('index.html: no <canvas id="stage">');
startGallery(el, location.search, () => { if (window.__dragonCare) window.__dragonCare.ready = true; });
