// Continuity store for idents. Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
// an in-process map otherwise (local runs and tests only).

const mem = new Map();
const path = (ident) => `idents/${ident}.json`;

async function blob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  return import('@vercel/blob');
}

export async function load(ident) {
  const b = await blob();
  if (!b) return mem.get(ident) ?? null;
  try {
    const meta = await b.head(path(ident));
    const r = await fetch(`${meta.url}?v=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (e) {
    if (e?.name === 'BlobNotFoundError' || /not found/i.test(String(e?.message))) return null;
    throw e;
  }
}

export async function save(ident, doc) {
  const b = await blob();
  if (!b) {
    mem.set(ident, doc);
    return;
  }
  await b.put(path(ident), JSON.stringify(doc), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export const backend = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : 'memory');
