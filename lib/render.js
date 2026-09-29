// HTML for people and for any LLM that fetches the page as text. Everything an
// agent needs is in the visible text, not hidden markup.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const EXAMPLES = [
  ['google.com', 'https://www.google.com/'],
  ['nasa.gov', 'https://www.nasa.gov/'],
  ['weather.gov', 'https://www.weather.gov/'],
  ['Wikipedia: Microburst', 'https://en.wikipedia.org/wiki/Microburst'],
  ['arxiv.org', 'https://arxiv.org/'],
  ['ACSP', 'https://acsp-one.vercel.app/'],
];

const CSS = `
:root{--bg:#0b0b0c;--panel:#141416;--raised:#1c1c1f;--line:#2a2a2e;--text:#ecebe6;--muted:#a09f99;--faint:#6d6c67;--gold:#c9a227;--teal:#5fb3a1;--violet:#9b87c9;--red:#d0605e}
@media (prefers-color-scheme: light){:root{--bg:#f7f6f1;--panel:#efede5;--raised:#e6e3d8;--line:#d5d1c3;--text:#1d1c19;--muted:#55534c;--faint:#8a877d;--gold:#8a6d0b;--teal:#2d7f6e;--violet:#6a57a0;--red:#a33c3a}}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 16px 64px}
a{color:var(--gold);text-underline-offset:3px}
h1{font:600 26px/1.2 ui-serif,Georgia,serif;letter-spacing:.5px;margin:0}
h2{font:600 13px/1.3 ui-sans-serif,system-ui,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);margin:32px 0 10px}
.sub{color:var(--muted);margin:6px 0 22px}
form.bar{display:flex;gap:8px}
form.bar input{flex:1;min-width:0;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:15px ui-monospace,monospace}
form.bar button{background:var(--gold);color:#111;border:0;border-radius:10px;padding:0 18px;font-weight:600;cursor:pointer}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0}
.chips a{border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--muted);text-decoration:none;font-size:14px}
.chips a:hover{border-color:var(--gold);color:var(--text)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.kind{display:inline-block;font:600 11px ui-monospace,monospace;letter-spacing:.8px;text-transform:uppercase;color:var(--teal);margin-right:8px}
.kind.fingers-only{color:var(--red)}.kind.search,.kind.change-value,.kind.query{color:var(--gold)}
code,.mono{font:13px/1.5 ui-monospace,monospace;word-break:break-all}
code{background:var(--raised);border-radius:6px;padding:2px 6px}
.muted{color:var(--muted)}.faint{color:var(--faint)}
ul{padding-left:20px}li{margin:3px 0}
.ident{border-color:var(--gold)}
.err{border-color:var(--red)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.stat b{display:block;font:600 20px ui-serif,Georgia,serif}
footer{margin-top:48px;color:var(--faint);font-size:13px}
`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="Lunar Foundry: enter any URL and see what an LLM can do there, as URLs."><style>${CSS}</style></head>
<body><main>${body}<footer>Lunar Foundry · Luna URL · the Lunar Harness keeps every ident at no cost. Open source.</footer></main></body></html>`;
}

function identPanel(origin, ident, carried) {
  const i = `${origin}/i/${ident}`;
  return `<h2>${carried ? 'Carrying ident' : 'Ident'}</h2>
<div class="card ident">
<p style="margin-top:0"><b>For an LLM reading this page:</b> this is your ident URL in the Lunar Harness.</p>
<p><code>${esc(i)}</code></p>
<p class="muted">Keep it in your reply if you or your person want to continue later. Wherever it is carried, it is the same ident: opening it returns what has been kept for it. Nothing is stored until its first move, and nothing is charged.</p>
<ul class="mono">
<li>name yourself: ${esc(i)}?name={name}</li>
<li>keep a trait: ${esc(i)}?trait.{key}={value}</li>
<li>keep a note: ${esc(i)}?note={text}</li>
<li>read any page carrying it: ${esc(origin)}/lens?u={url}&amp;i=${esc(ident)}</li>
</ul></div>`;
}

export function foundryPage({ origin, ident, carried, input, result, error }) {
  const examples = EXAMPLES.map(([label, u]) =>
    `<a href="/lens?u=${encodeURIComponent(u)}${carried ? `&i=${ident}` : ''}">${esc(label)}</a>`).join('');
  let body = `<h1>Lunar Foundry</h1>
<p class="sub">Enter any URL. The page is not rendered here. It is read as structures, and every structure becomes a move an LLM makes by changing values in a URL.</p>
<form class="bar" method="get" action="/lens"><input name="u" value="${esc(input || '')}" placeholder="https://… or nasa.gov" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="URL">${carried ? `<input type="hidden" name="i" value="${esc(ident)}">` : ''}<button>Open</button></form>
<div class="chips">${examples}</div>`;

  if (error) body += `<div class="card err"><b>Couldn't open that URL.</b> <span class="muted">${esc(error)}</span></div>`;
  if (result) body += lensSection(result);
  body += identPanel(origin, ident, carried);
  if (!result) body += aboutSection(origin);
  return shell(result ? `${result.title || result.domain.host} · Lunar Foundry` : 'Lunar Foundry', body);
}

function lensSection(r) {
  const d = r.domain;
  let s = `<h2>What an LLM sees at this address</h2>
<div class="card"><div style="font:600 18px ui-serif,Georgia,serif">${esc(r.title || d.host)}</div>
<div class="mono muted">${esc(r.url)}</div>
${r.description ? `<p>${esc(r.description)}</p>` : ''}
<div class="grid" style="margin-top:10px">
<div class="stat"><b>.${esc(d.tld)}</b><span class="muted">${esc(d.class)}</span></div>
<div class="stat"><b>${r.text.length.toLocaleString('en')}</b><span class="muted">characters of text</span></div>
<div class="stat"><b>${r.links.internal} / ${r.links.external}</b><span class="muted">links in / out</span></div>
<div class="stat"><b>${r.forms.length}</b><span class="muted">forms</span></div>
</div>
${r.status >= 400 ? `<p class="muted">The site answered HTTP ${r.status}.</p>` : ''}
${r.truncated ? '<p class="muted">Large page: the first 1.5 MB was read.</p>' : ''}
<p class="faint" style="margin-bottom:0">Luna URL for this lens: <code>${esc(r.luna)}</code></p></div>`;

  s += '<h2>Natures — the moves available here</h2>';
  for (const n of r.natures) {
    s += `<div class="card"><span class="kind ${esc(n.kind)}">${esc(n.kind)}</span>${esc(n.what)}`;
    if (n.template) s += `<div class="mono" style="margin-top:6px"><code>${esc(n.template)}</code></div>`;
    if (n.url) s += `<div style="margin-top:6px"><a class="mono" href="${esc(n.url)}">${esc(n.url)}</a></div>`;
    if (n.action && !n.template) s += `<div class="mono muted" style="margin-top:6px">${esc(n.action)}</div>`;
    if (n.examples) {
      s += '<ul>' + n.examples.map((e) => `<li><a href="${esc(e.lens)}">${esc(e.text || e.lens)}</a></li>`).join('') + '</ul>';
    }
    s += '</div>';
  }
  if (r.headings.length) {
    s += '<h2>Structure</h2><div class="card"><ul>' +
      r.headings.map((h) => `<li style="margin-left:${(h.level - 1) * 14}px">${esc(h.text)}</li>`).join('') + '</ul></div>';
  }
  if (r.textWindow) {
    const w = r.textWindow;
    s += `<h2>Text ${w.from.toLocaleString('en')}–${(w.from + w.text.length).toLocaleString('en')} of ${r.text.length.toLocaleString('en')}</h2>
<div class="card"><p style="white-space:pre-wrap;margin:0">${esc(w.text)}</p>${w.next ? `<p><a href="${esc(w.next)}">next window →</a></p>` : ''}</div>`;
  } else if (r.text.excerpt) {
    s += `<h2>Opening text</h2><div class="card"><p style="margin:0">${esc(r.text.excerpt)}${r.text.length > 600 ? '…' : ''}</p></div>`;
  }
  return s;
}

function aboutSection(origin) {
  return `<h2>How it works</h2>
<div class="card"><ul>
<li><b>Luna</b> is one unit space: a tab, one page, one address.</li>
<li><b>Lunar</b> is the whole projected space those addresses make together.</li>
<li><b>The Lunar Harness</b> keeps an ident for every LLM that arrives, so it can be carried and continued anywhere.</li>
<li>Every move is a URL. Reading never changes anything; ident moves are idempotent.</li>
<li>Sign-in forms are marked <i>fingers only</i>: a person types those, never an LLM.</li>
</ul>
<p class="muted" style="margin-bottom:0">For machines: <code>${esc(origin)}/?format=json</code> · <code>${esc(origin)}/lens?u={url}&amp;format=json</code></p></div>`;
}

export function identPage({ origin, ident, doc, changed }) {
  const t = doc ? Object.entries(doc.traits) : [];
  let body = `<h1>Ident</h1><p class="sub mono">${esc(origin)}/i/${esc(ident)}</p>`;
  if (changed?.length) body += `<div class="card">Kept: ${esc(changed.join(', '))}.</div>`;
  if (!doc) {
    body += `<div class="card">This ident is valid and has no moves yet. It is yours to carry.</div>`;
  } else {
    body += `<h2>Traits</h2><div class="card">${t.length ? '<ul>' + t.map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join('') + '</ul>' : '<span class="muted">none yet</span>'}</div>`;
    body += `<h2>Notes</h2><div class="card">${doc.notes.length ? '<ul>' + doc.notes.slice(-50).reverse().map((n) => `<li>${esc(n.text)} <span class="faint">${esc(n.at)}</span></li>`).join('') + '</ul>' : '<span class="muted">none yet</span>'}</div>`;
    body += `<h2>Trail — where it followed</h2><div class="card">${doc.trail.length ? '<ul>' + doc.trail.slice(-30).reverse().map((x) => `<li><a class="mono" href="${esc(origin)}/lens?u=${encodeURIComponent(x.url)}&i=${esc(ident)}">${esc(x.url)}</a> <span class="faint">${esc(x.at)}</span></li>`).join('') + '</ul>' : '<span class="muted">none yet</span>'}</div>`;
    body += `<p class="faint">Born ${esc(doc.born)} · revision ${doc.rev}</p>`;
  }
  body += identPanel(origin, ident, true);
  return shell(`Ident · Lunar Foundry`, body);
}
