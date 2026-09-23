// Zero-dependency static file server for development and headless tests, plus the one addition
// that makes a TypeScript source tree loadable by a browser with no build directory.
// Usage: node tools/server.ts [port]   (default 8080)
//
// A request for a .ts file is read from disk, run through esbuild's `transformSync` with loader
// 'ts', and served as text/javascript. The transform only strips types -- it does not resolve or
// rewrite imports -- so the JS handed back still says `import { drawRig } from './placeholder.ts'`.
// The browser then requests THAT path, which lands here and is transformed the same way. The graph
// closes on itself, so there is no watcher, no output directory to go stale, and no step between
// saving a file and reloading the page. `transformSync` is sub-millisecond per file.
//
// esbuild is a devDependency and nothing it produces here is ever written to disk or shipped;
// `npm run build` is the only thing that emits an artifact.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  // Served transformed, never raw -- see transformTs below.
  '.ts': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

/**
 * Strip the types out of one module and hand back JavaScript. Import specifiers are left exactly
 * as written, which is what keeps the served graph self-consistent.
 * @param source the file's bytes, as read from disk
 * @param file absolute path, used for the sourcemap and for error messages
 */
function transformTs(source: Buffer, file: string): Uint8Array {
  const { code } = transformSync(source.toString('utf8'), {
    loader: 'ts',
    format: 'esm',
    target: 'es2022',
    sourcefile: path.relative(ROOT, file),
    // Inline, so the browser's debugger shows the .ts source with no separate request.
    sourcemap: 'inline',
  });
  return Buffer.from(code, 'utf8');
}

export function createServer(): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, onDisk) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + pathname); return; }
      const ext = path.extname(file).toLowerCase();
      let data: Uint8Array = onDisk;
      if (ext === '.ts') {
        // A syntax error here would otherwise take the server down from inside a request callback.
        // Report it as the response instead, so the reload that caused it is also the one that
        // shows it, and the server survives to serve the fix.
        try {
          data = transformTs(onDisk, file);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`transform failed: ${pathname}\n${message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(`transform failed: ${pathname}\n${message}`);
          return;
        }
      }
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Length': data.length,
      });
      res.end(data);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`game-engine dev server: http://localhost:${PORT}/`));
}
