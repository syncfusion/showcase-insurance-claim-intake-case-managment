// The React showcase's static host (Linux App Service), whole, so nothing has to be merged by hand
// (workflow 2.18.0). Standards: publishing-base-path.md (strip the mount path before resolving a file;
// serve the unprefixed root too), health-check.md (/healthz at the host's root with real fields),
// app-source-baseline.md "Loading states" (precompressed Brotli/gzip by Accept-Encoding).
// From executive-kpi-analytics (2026-10-10): a hand-merged copy set `Content-Encoding: undefined` when a
// file had no compressed copy, and did not strip the mount path, so the browser check's prefixed URLs
// fell through to index.html.
//
// Copy to frontend/react/server.mjs and replace insurance-claims-portal. Dependency-free; `npm start` runs it after
// `npm run build` (with scripts/precompress.mjs from ../loading/ in the build script).
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(here, 'dist');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const port = Number(process.env.PORT ?? 8080);
// The plan's publicBasePath, without a trailing slash: '/<app-id>/react'.
const MOUNT_PATH = '/' + String(process.env.BASE_PATH ?? '/insurance-claims-intake-portal/react').replace(/^\/+|\/+$/g, '');
const startedAt = Date.now();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'
};
// Brotli first: about 10% smaller than gzip on these files.
const ENCODINGS = [['br', '.br'], ['gzip', '.gz']];

function pickEncoding(acceptEncoding, filePath) {
  const accepted = String(acceptEncoding ?? '').toLowerCase().split(',')
    .map(part => part.trim().split(';'))
    .filter(([, q]) => !q || parseFloat(q.split('=')[1]) > 0)
    .map(([name]) => name.trim());
  for (const [name, ext] of ENCODINGS)
    if ((accepted.includes(name) || accepted.includes('*')) && existsSync(filePath + ext)) return { name, path: filePath + ext };
  return null;
}

// '/<app-id>/react/assets/x.js' and '/assets/x.js' both resolve to dist/assets/x.js.
function stripMountPath(pathname) {
  if (pathname === MOUNT_PATH || pathname.startsWith(MOUNT_PATH + '/')) return pathname.slice(MOUNT_PATH.length) || '/';
  return pathname;
}

function fileFor(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const path = resolve(distDir, '.' + normalize(stripMountPath(decoded)));
  if (path !== distDir && !path.startsWith(distDir + sep)) return null; // outside dist/
  return existsSync(path) && statSync(path).isFile() ? path : null;
}

function health() {
  const ok = existsSync(join(distDir, 'index.html'));
  return { code: ok ? 200 : 503, body: { status: ok ? 'ok' : 'missing-build', service: pkg.name, version: pkg.version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), node: process.version, timestamp: new Date().toISOString() } };
}

function sendFile(req, res, filePath) {
  const encoding = pickEncoding(req.headers['accept-encoding'], filePath);
  const sendPath = encoding ? encoding.path : filePath;
  const headers = {
    'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    // Vite fingerprints everything under assets/; index.html and public files are revalidated.
    'Cache-Control': filePath.includes(sep + 'assets' + sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Length': statSync(sendPath).size,
    'X-Content-Type-Options': 'nosniff'
  };
  // Only when a copy was chosen: an undefined header breaks the response.
  if (encoding) headers['Content-Encoding'] = encoding.name;
  if (existsSync(filePath + '.br') || existsSync(filePath + '.gz')) headers.Vary = 'Accept-Encoding';
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(sendPath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  // The host's own probe, at its root only (health-check.md); <mount>/healthz is the React status page.
  if (url.pathname === '/healthz') {
    const { code, body } = health();
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    return;
  }
  const file = fileFor(url.pathname);
  if (file) { sendFile(req, res, file); return; }
  // A missing file with an extension is a 404, not the SPA page: a browser check then reports it.
  if (extname(stripMountPath(url.pathname))) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  const index = join(distDir, 'index.html');
  if (!existsSync(index)) { res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Build missing: run npm run build'); return; }
  sendFile(req, res, index);
});

server.listen(port, '0.0.0.0', () => console.log(`${pkg.name} listening on port ${port}, mounted at ${MOUNT_PATH}/ and /`));
