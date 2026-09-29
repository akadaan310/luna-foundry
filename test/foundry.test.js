import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { route } from '../dev.js';
import { checkUrl, fetchPage, isPrivate } from '../lib/fetch.js';
import { applyMoves, fresh } from '../lib/harness.js';
import { mint, valid } from '../lib/ident.js';
import { domainClass, lens } from '../lib/lens.js';

test('idents: minted ones verify, altered ones do not', () => {
  const a = mint();
  assert.equal(a.length, 30);
  assert.ok(valid(a));
  const flip = a.slice(0, 5) + (a[5] === 'A' ? 'B' : 'A') + a.slice(6);
  assert.ok(!valid(flip));
  assert.ok(!valid('x'));
  assert.notEqual(mint(), mint());
});

test('harness moves are idempotent', () => {
  const d = fresh('X');
  const q = new URLSearchParams('name=Bob&trait.tone=warm&note=hello&at=https://nasa.gov/');
  assert.deepEqual(applyMoves(d, q), ['trait:name', 'trait:tone', 'note', 'at']);
  assert.deepEqual(applyMoves(d, q), []);
  assert.equal(d.rev, 1);
  assert.equal(d.traits.name, 'Bob');
  assert.equal(d.notes.length, 1);
});

test('the fetcher refuses private networks', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.ok(isPrivate(ip), ip);
  }
  assert.ok(!isPrivate('8.8.8.8'));
  assert.ok(!isPrivate('192.0.66.108'), 'nasa.gov (WordPress VIP) is public');
  assert.ok(isPrivate('192.0.2.1') && isPrivate('192.0.0.9') && isPrivate('203.0.113.5'));
  assert.ok(!isPrivate('64:ff9b::1716:1a0a'), 'NAT64 of a public IPv4');
  assert.ok(!isPrivate('64:ff9b::23.22.26.10'));
  assert.ok(isPrivate('64:ff9b::a9fe:a9fe'), 'NAT64 of 169.254.169.254');
  assert.ok(isPrivate('fe80::1'));
  assert.ok(!isPrivate('2606:4700::6810:84e5'));
  assert.throws(() => checkUrl('http://127.0.0.1/'));
  assert.throws(() => checkUrl('http://localhost/'));
  assert.throws(() => checkUrl('file:///etc/passwd'));
  assert.throws(() => checkUrl('http://example.com:8080/'));
  await assert.rejects(fetchPage('http://localtest.me/'), /private|ENOTFOUND|EAI_AGAIN/);
});

test('domain-oriented classes', () => {
  assert.match(domainClass('www.nasa.gov').class, /government/);
  assert.equal(domainClass('bbc.co.uk').country, 'uk');
  assert.match(domainClass('ox.ac.uk').class, /country|general/);
});

test('the lens reads structures into natures', () => {
  const body = `<html lang="en"><title>Weather &amp; Wind</title>
    <h1>Microburst watch</h1><a href="/radar">Radar</a><a href="https://other.org/x">Other</a>
    <form action="/search"><input name="q"><input type="hidden" name="site" value="all"></form>
    <form action="/login" method="post"><input name="user"><input type="password" name="pw"></form>
    <p>Wind 45 kt at 14:02.</p></html>`;
  const r = lens({ url: 'https://wx.example.gov/obs?station=KXYZ', body, status: 200, type: 'text/html', truncated: false }, 'https://luna');
  assert.equal(r.title, 'Weather & Wind');
  const kinds = r.natures.map((n) => n.kind);
  for (const k of ['read', 'search', 'fingers-only', 'change-value', 'follow', 'leave']) assert.ok(kinds.includes(k), k);
  assert.equal(r.natures.find((n) => n.kind === 'search').template, 'https://wx.example.gov/search?site=all&q={query}');
  assert.match(r.natures.find((n) => n.kind === 'change-value').template, /station=\{value\}/);
  assert.match(r._text, /Wind 45 kt/);
});

test('HTTP: the root mints an ident, /i keeps moves', async () => {
  const srv = http.createServer(route).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const root = await (await fetch(`${base}/?format=json`)).json();
    const identUrl = root.ident.url;
    assert.match(identUrl, /\/i\/[0-9A-Z]{30}$/);
    const path = new URL(identUrl).pathname;
    const kept = await (await fetch(`${base}${path}?name=Bob&format=json`)).json();
    assert.equal(kept.kept.traits.name, 'Bob');
    const again = await (await fetch(`${base}${path}?format=json`)).json();
    assert.equal(again.kept.traits.name, 'Bob');
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /your ident URL/);
    assert.equal((await fetch(`${base}/i/NOTANIDENT`)).status, 404);
    assert.equal((await fetch(`${base}/lens?u=http://127.0.0.1/&format=json`)).status, 422);
  } finally {
    srv.close();
  }
});
