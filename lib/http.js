// Small request helpers shared by the handlers.
export function origin(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

export const query = (req) => new URL(req.url, 'http://x').searchParams;

export function wantsJson(req, q) {
  if (q.get('format') === 'json') return true;
  if (q.get('format') === 'html') return false;
  const a = String(req.headers.accept || '');
  return a.includes('application/json') && !a.includes('text/html');
}

export function send(res, status, body, type) {
  res.statusCode = status;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.end(body);
}

export const json = (res, status, obj) => send(res, status, JSON.stringify(obj, null, 2), 'application/json; charset=utf-8');
export const html = (res, status, s) => send(res, status, s, 'text/html; charset=utf-8');
