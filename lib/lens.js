// The lens: what an LLM can do at a URL, read from the page's own structure.
// No rendering. The page is fetched once and read as structures — address,
// values, forms, links, headings, text — and each becomes a nature: a move an
// LLM makes by changing values in a URL.

const DOMAIN_CLASSES = {
  gov: 'government — public records and authoritative data',
  mil: 'military',
  edu: 'education and research',
  org: 'organizations and communities',
  com: 'commerce and companies',
  net: 'networks and services',
  int: 'international organizations',
  io: 'technology', dev: 'technology', app: 'technology', ai: 'technology',
};

export function domainClass(host) {
  const labels = host.toLowerCase().split('.');
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (tld.length === 2 && DOMAIN_CLASSES[second]) {
    return { tld: `${second}.${tld}`, class: DOMAIN_CLASSES[second], country: tld };
  }
  if (DOMAIN_CLASSES[tld]) return { tld, class: DOMAIN_CLASSES[tld] };
  if (tld.length === 2) return { tld, class: 'country', country: tld };
  return { tld, class: 'general' };
}

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const clean = (s) => decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
};

function visibleText(html) {
  return clean(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' '));
}

function forms(html, base) {
  const out = [];
  const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const action = attr(m[1], 'action');
    const method = (attr(m[1], 'method') || 'get').toLowerCase();
    let url;
    try {
      url = new URL(action || base, base).toString();
    } catch {
      continue;
    }
    const fields = [];
    const fre = /<(input|textarea|select)\b([^>]*)>/gi;
    let f;
    while ((f = fre.exec(m[2])) && fields.length < 30) {
      const type = (attr(f[2], 'type') || (f[1].toLowerCase() === 'input' ? 'text' : f[1].toLowerCase())).toLowerCase();
      const name = attr(f[2], 'name');
      if (!name && type !== 'password') continue;
      if (['submit', 'button', 'image', 'reset'].includes(type)) continue;
      fields.push({ name, type, value: type === 'hidden' ? attr(f[2], 'value') : undefined });
    }
    out.push({ action: url, method, fields });
  }
  return out;
}

function links(html, base) {
  const host = new URL(base).host;
  const seen = new Set();
  const internal = [];
  const external = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && seen.size < 600) {
    const href = attr(m[1], 'href');
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) continue;
    let u;
    try {
      u = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    const key = u.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const text = clean(m[2]).slice(0, 80) || attr(m[1], 'title') || attr(m[1], 'aria-label') || '';
    (u.host === host ? internal : external).push({ url: key, text });
  }
  return { internal, external };
}

const SEARCH_NAMES = /^(q|query|s|search|keyword|keywords|term|terms|k|p|text)$/i;

export function lens(page, lunaOrigin) {
  const { url, body, status, type, truncated } = page;
  const u = new URL(url);
  const html = body || '';
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]).slice(0, 200);
  const metaDesc = /<meta\b[^>]*name\s*=\s*["']description["'][^>]*>/i.exec(html);
  const description = metaDesc ? (attr(metaDesc[0], 'content') || '').slice(0, 400) : '';
  const lang = attr(/<html\b[^>]*>/i.exec(html)?.[0] || '', 'lang');
  const headings = [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((h) => ({ level: Number(h[1]), text: clean(h[2]).slice(0, 140) }))
    .filter((h) => h.text).slice(0, 20);
  const text = type.includes('html') || !type ? visibleText(html) : clean(html);
  const fs = forms(html, url);
  const ls = links(html, url);

  const lensUrl = (x) => `${lunaOrigin}/lens?u=${encodeURIComponent(x)}`;
  const params = [...u.searchParams.entries()].slice(0, 20).map(([k, v]) => {
    const alt = new URL(url);
    alt.searchParams.set(k, '{value}');
    return { name: k, value: v, template: decodeURIComponent(alt.toString()) };
  });

  const natures = [];
  natures.push({ kind: 'read', what: `the page as text, ${text.length.toLocaleString('en')} characters`,
    url: `${lensUrl(url)}&text=0` });
  for (const f of fs) {
    const pw = f.fields.find((x) => x.type === 'password');
    if (pw) {
      natures.push({ kind: 'fingers-only', what: 'a sign-in form — a person types this, never an LLM', action: f.action });
      continue;
    }
    const q = f.fields.find((x) => x.name && (x.type === 'search' || SEARCH_NAMES.test(x.name)));
    if (q && f.method === 'get') {
      const t = new URL(f.action);
      for (const x of f.fields) if (x.type === 'hidden' && x.name && x.value != null) t.searchParams.set(x.name, x.value);
      t.searchParams.set(q.name, '{query}');
      natures.push({ kind: 'search', what: 'search this site by changing one value in a URL',
        template: decodeURIComponent(t.toString()) });
    } else if (f.method === 'get' && f.fields.length) {
      const t = new URL(f.action);
      for (const x of f.fields) if (x.name) t.searchParams.set(x.name, x.type === 'hidden' && x.value != null ? x.value : `{${x.name}}`);
      natures.push({ kind: 'query', what: `a form with ${f.fields.length} values, as a URL`, template: decodeURIComponent(t.toString()) });
    } else if (f.fields.length) {
      natures.push({ kind: 'post-form', what: `a form that posts ${f.fields.length} values — acting, not navigating`, action: f.action });
    }
  }
  for (const p of params) natures.push({ kind: 'change-value', what: `the address's own value "${p.name}"`, template: p.template });
  if (ls.internal.length) {
    natures.push({ kind: 'follow', what: `${ls.internal.length} links within ${u.host}`,
      examples: ls.internal.slice(0, 8).map((l) => ({ text: l.text, lens: lensUrl(l.url) })) });
  }
  if (ls.external.length) {
    natures.push({ kind: 'leave', what: `${ls.external.length} links to other domains`,
      examples: ls.external.slice(0, 5).map((l) => ({ text: l.text, lens: lensUrl(l.url) })) });
  }

  return {
    url,
    status,
    contentType: type,
    truncated,
    title,
    description,
    lang,
    domain: { host: u.host, ...domainClass(u.hostname) },
    headings,
    values: params,
    forms: fs.map((f) => ({ action: f.action, method: f.method,
      fields: f.fields.map((x) => ({ name: x.name, type: x.type })) })),
    links: { internal: ls.internal.length, external: ls.external.length },
    text: { length: text.length, excerpt: text.slice(0, 600) },
    natures,
    luna: lensUrl(url),
    _text: text,
  };
}
