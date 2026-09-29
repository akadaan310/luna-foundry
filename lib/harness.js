// The Lunar Harness: continuity for an ident. Every move is a value in the
// ident's URL, and every move is idempotent — a replayed URL (a prefetcher, a
// retry, a second paste) changes nothing twice.
//
//   /i/<ident>                    read what has been kept
//   /i/<ident>?name=Bob           set a trait (name is a trait)
//   /i/<ident>?trait.tone=warm    set any trait
//   /i/<ident>?note=...           keep a note
//   /i/<ident>?at=<url>           record where the ident followed to
//   /lens?u=<url>&i=<ident>       read a page carrying the ident (records the trail)
import { sha } from './ident.js';

export const LIMITS = { traits: 50, traitLen: 500, notes: 200, noteLen: 2000, trail: 200 };

export function fresh(ident) {
  return { ident, born: new Date().toISOString(), rev: 0, traits: {}, notes: [], trail: [] };
}

export function follow(doc, url) {
  const last = doc.trail[doc.trail.length - 1];
  if (last && last.url === url) return false;
  doc.trail.push({ url, at: new Date().toISOString() });
  if (doc.trail.length > LIMITS.trail) doc.trail.splice(0, doc.trail.length - LIMITS.trail);
  return true;
}

/** Apply the moves in a query string. Returns the list of moves that changed something. */
export function applyMoves(doc, query) {
  const changed = [];
  for (const [k, raw] of query.entries()) {
    const v = String(raw).trim();
    if (!v) continue;
    if (k === 'name' || k.startsWith('trait.')) {
      const key = (k === 'name' ? 'name' : k.slice(6)).slice(0, 64);
      if (!key) continue;
      if (!(key in doc.traits) && Object.keys(doc.traits).length >= LIMITS.traits) continue;
      const val = v.slice(0, LIMITS.traitLen);
      if (doc.traits[key] !== val) {
        doc.traits[key] = val;
        changed.push(`trait:${key}`);
      }
    } else if (k === 'note') {
      const text = v.slice(0, LIMITS.noteLen);
      const h = sha(text);
      if (!doc.notes.some((n) => n.h === h)) {
        doc.notes.push({ h, text, at: new Date().toISOString() });
        if (doc.notes.length > LIMITS.notes) doc.notes.splice(0, doc.notes.length - LIMITS.notes);
        changed.push('note');
      }
    } else if (k === 'at') {
      if (/^https?:\/\//i.test(v) && follow(doc, v.slice(0, 2000))) changed.push('at');
    }
  }
  if (changed.length) doc.rev += 1;
  return changed;
}

export function moves(origin, ident) {
  const i = `${origin}/i/${ident}`;
  return {
    read: i,
    name: `${i}?name={name}`,
    trait: `${i}?trait.{key}={value}`,
    note: `${i}?note={text}`,
    followed: `${i}?at={url}`,
    lens: `${origin}/lens?u={url}&i=${ident}`,
  };
}
