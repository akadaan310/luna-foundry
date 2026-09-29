// GET /i/<ident>[?moves]  read an ident's continuity; moves in the query are kept (idempotent)
import { applyMoves, fresh, moves } from '../lib/harness.js';
import { valid } from '../lib/ident.js';
import { identPage } from '../lib/render.js';
import { backend, load, save } from '../lib/store.js';
import { html, json, origin, query, send, wantsJson } from '../lib/http.js';
import { clientIp, LIMITS, take } from '../lib/ratelimit.js';

export default async function handler(req, res) {
  const q = query(req);
  const o = origin(req);
  const ident = q.get('ident') || new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop();
  const asJson = wantsJson(req, q);
  if (!valid(ident)) {
    const msg = 'Not an ident minted by this Lunar Harness. Open the Luna URL to receive one.';
    return asJson ? json(res, 404, { ok: false, error: msg, luna: o }) : html(res, 404, `<p>${msg} <a href="/">${o}</a></p>`);
  }
  const wait = take(`ident:${clientIp(req)}`, LIMITS.ident);
  if (wait !== true) {
    res.setHeader('retry-after', String(wait));
    return asJson ? json(res, 429, { ok: false, error: `slow down: try again in ${wait}s` })
      : send(res, 429, `Slow down: try again in ${wait}s.`, 'text/plain; charset=utf-8');
  }
  let doc = await load(ident);
  const probe = fresh(ident);
  const wouldChange = applyMoves(probe, q);
  let changed = [];
  if (wouldChange.length) {
    doc = doc ?? fresh(ident);
    changed = applyMoves(doc, q);
    if (changed.length) await save(ident, doc);
  }
  if (asJson) return json(res, 200, { ok: true, ident: `${o}/i/${ident}`, kept: doc, changed, moves: moves(o, ident), store: backend() });
  return html(res, 200, identPage({ origin: o, ident, doc, changed }));
}
