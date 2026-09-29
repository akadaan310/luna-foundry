// Fetching any URL a visitor enters, safely. A public fetcher must never reach
// private networks: every address a hostname resolves to is checked, and the
// connection uses the checked address (no DNS-rebinding gap). Redirects are
// followed by hand, each hop checked again.
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_HOPS = 3;
export const UA = 'LunarFoundry/0 (+https://github.com/akadaan310/luna-foundry)';

function privateV4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export function isPrivate(ip) {
  if (net.isIPv4(ip)) return privateV4(ip);
  const v = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return privateV4(mapped[1]);
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') ||
    v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') ||
    v.startsWith('ff') || v.startsWith('64:ff9b');
}

function guardedLookup(host, opts, cb) {
  dns.lookup(host, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = addrs.find((a) => isPrivate(a.address));
    if (bad || !addrs.length) return cb(new Error(`refused: ${host} resolves to a private address`));
    if (opts && opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

export function checkUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('not a URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http and https');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('only ports 80 and 443');
  if (u.username || u.password) throw new Error('no credentials in URLs');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivate(host)) throw new Error('refused: private address');
  if (/(^|\.)(localhost|internal|local)$/i.test(host)) throw new Error('refused: local host name');
  return u;
}

function once(u) {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, {
      method: 'GET',
      lookup: guardedLookup,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.5', 'accept-encoding': 'identity' },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > MAX_BYTES) {
          res.destroy();
          resolve({ res, body: Buffer.concat(chunks).toString('utf8'), truncated: true });
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString('utf8'), truncated: false }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end();
  });
}

export async function fetchPage(raw) {
  let u = checkUrl(raw);
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const { res, body, truncated } = await once(u);
    const loc = res.headers.location;
    if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
      u = checkUrl(new URL(loc, u).toString());
      continue;
    }
    return { url: u.toString(), status: res.statusCode, type: String(res.headers['content-type'] || ''), body, truncated };
  }
  throw new Error('too many redirects');
}
