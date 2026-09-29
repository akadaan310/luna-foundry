// Idents: the Lunar Harness keeps one per LLM, at no cost.
//
// An ident is minted without storing anything: 12 random bytes plus a 6-byte
// HMAC tag, in Crockford base32. Only this server can mint a valid one, so a
// made-up ident is refused. Nothing is written until the ident's first move.
// The ident is a bearer: whoever carries the URL continues it.
import crypto from 'node:crypto';

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function b32(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHA[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  return out;
}

function secret() {
  const s = process.env.LUNA_SECRET;
  if (s) return s;
  if (process.env.VERCEL_ENV === 'production') throw new Error('LUNA_SECRET is not set');
  return 'local-dev-secret';
}

const tag = (body) => b32(crypto.createHmac('sha256', secret()).update(body).digest().subarray(0, 6));

export function mint() {
  const body = b32(crypto.randomBytes(12)); // 20 chars
  return body + tag(body);                   // + 10 chars
}

export function valid(ident) {
  if (typeof ident !== 'string' || !/^[0-9A-HJKMNP-TV-Z]{30}$/.test(ident)) return false;
  const body = ident.slice(0, 20);
  const want = Buffer.from(tag(body));
  const got = Buffer.from(ident.slice(20));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
