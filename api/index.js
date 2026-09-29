// GET /            the foundry (people) and the Luna URL entry (LLMs)
// GET /lens?u=     one URL read as structures and natures; &i=<ident> carries an ident;
//                  &text=<from>&len=<n> returns one window of the page's text
import { fetchPage } from '../lib/fetch.js';
import { fresh, follow, moves } from '../lib/harness.js';
import { mint, valid } from '../lib/ident.js';
import { lens } from '../lib/lens.js';
import { EXAMPLES, foundryPage } from '../lib/render.js';
import { load, save } from '../lib/store.js';
import { html, json, origin, query, send, wantsJson } from '../lib/http.js';
import { clientIp, LIMITS, take } from '../lib/ratelimit.js';

const normalize = (u) => {
  const t = u.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
};

export default async function handler(req, res) {
  const q = query(req);
  const o = origin(req);
  const carried = valid(q.get('i'));
  const ident = carried ? q.get('i') : mint();
  const asJson = wantsJson(req, q);
  const input = q.get('u');

  if (!input) {
    if (asJson) {
      return json(res, 200, {
        name: 'Luna URL',
        harness: 'Lunar Harness',
        about: 'Enter any URL through /lens and receive what an LLM can do there, as URLs. Every move is a URL; reading changes nothing.',
        ident: { url: `${o}/i/${ident}`, carried, keep: 'Carry this URL to continue as the same ident anywhere. Opening it returns what has been kept.' },
        moves: moves(o, ident),
        lens: `${o}/lens?u={url}&i=${ident}&format=json`,
        examples: EXAMPLES.map(([label, u]) => ({ label, lens: `${o}/lens?u=${encodeURIComponent(u)}&i=${ident}` })),
      });
    }
    return html(res, 200, foundryPage({ origin: o, ident, carried }));
  }

  const wait = take(`lens:${clientIp(req)}`, LIMITS.lens);
  if (wait !== true) {
    res.setHeader('retry-after', String(wait));
    return asJson ? json(res, 429, { ok: false, error: `slow down: try again in ${wait}s` })
      : send(res, 429, `Slow down: try again in ${wait}s.`, 'text/plain; charset=utf-8');
  }

  let result;
  try {
    result = lens(await fetchPage(normalize(input)), o);
  } catch (e) {
    const error = String(e?.message || e);
    return asJson ? json(res, 422, { ok: false, error, ident: `${o}/i/${ident}` })
      : html(res, 422, foundryPage({ origin: o, ident, carried, input, error }));
  }

  const full = result._text;
  delete result._text;
  const stage = ['fold', 'atlas', 'scroll', 'program'].includes(q.get('stage')) ? q.get('stage')
    : q.has('text') ? 'scroll' : 'atlas';
  const here = `${o}/lens?u=${encodeURIComponent(result.url)}${carried ? `&i=${ident}` : ''}`;
  result.stage = stage;
  result.stages = { fold: here, atlas: `${here}&stage=atlas`, scroll: `${here}&stage=scroll&text=0`,
    program: `${here}&stage=program` };
  if (stage === 'scroll' || q.has('text')) {
    const from = Math.max(0, parseInt(q.get('text'), 10) || 0);
    const size = Math.min(8000, Math.max(200, parseInt(q.get('len'), 10) || 3000));
    const end = Math.min(full.length, from + size);
    result.textWindow = { from, text: full.slice(from, end),
      next: end < full.length ? `${here}&stage=scroll&text=${end}&len=${size}` : null };
  }

  if (carried) {
    try {
      const doc = (await load(ident)) ?? fresh(ident);
      if (follow(doc, result.url)) {
        doc.rev += 1;
        await save(ident, doc);
      }
    } catch (e) {
      result.harness = `trail not recorded: ${String(e?.message || e)}`;
    }
  }

  if (asJson) return json(res, 200, { ok: true, ident: { url: `${o}/i/${ident}`, carried }, lens: result, moves: moves(o, ident) });
  return html(res, 200, foundryPage({ origin: o, ident, carried, input, result }));
}
