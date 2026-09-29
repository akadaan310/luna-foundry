// Local server mirroring vercel.json's routes: node dev.js  (PORT, default 8480)
import http from 'node:http';
import identHandler from './api/ident.js';
import indexHandler from './api/index.js';

export function route(req, res) {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/' || path === '/lens' || path === '/api/index') return indexHandler(req, res);
  if (/^\/i\/[^/]+$/.test(path)) return identHandler(req, res);
  res.statusCode = 404;
  res.end('not found');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8480);
  http.createServer((req, res) => Promise.resolve(route(req, res)).catch((e) => {
    res.statusCode = 500;
    res.end(String(e));
  })).listen(port, () => console.log(`Lunar Foundry on http://127.0.0.1:${port}`));
}
