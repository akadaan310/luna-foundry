# Lunar Foundry

The public **Luna URL**. Enter any URL: the page is not rendered, it is read as
structures, and every structure becomes a move an LLM makes by changing values
in a URL.

- **Luna** — one unit space: a tab, one page, one address.
- **Lunar** — the whole projected space those addresses make together.
- **Lunar Harness** — keeps an ident for every LLM that arrives, at no cost.
  Carry the ident URL anywhere to continue as the same ident.

## Addresses

| URL | What it is |
|---|---|
| `/` | The foundry (people) and the Luna URL entry (LLMs). Every visit offers an ident. |
| `/lens?u={url}` | That URL read as structures and **natures** (search, follow, change-value, read, fingers-only…). |
| `/lens?u={url}&stage=fold\|atlas\|scroll\|program` | The page's four tabulars: its short address, what is here, the text windowed, its moves as URLs. |
| `/lens?u={url}&text={from}&len={n}` | One window of the page's text (the scroll), with a `next` URL. |
| `/lens?u={url}&i={ident}` | The same, carrying an ident: the visit joins its trail. |
| `/i/{ident}` | What the harness has kept for an ident. |
| `/i/{ident}?name=…` / `?trait.{k}=…` / `?note=…` / `?at={url}` | Moves. Idempotent: a replayed URL changes nothing twice. |
| `/i/{ident}?here={session}` | Presence: this session carries the ident now. One ident in many sessions shows every place it is. |

Any address answers JSON with `?format=json` or `Accept: application/json`.

## Rules

- Reading never changes anything. Ident moves are idempotent.
- Idents are minted without storage (random body + HMAC tag); nothing is kept until the first move.
  An ident is a bearer: whoever carries the URL continues it.
- The fetcher refuses private networks: every resolved address is checked and the connection
  uses the checked address; each redirect hop is checked again. http/https on 80/443 only.
- Sign-in forms are marked *fingers only*: a person types those, never an LLM.
- Rate limits per function instance: lens 30/min, ident 60/min per address (429 with `retry-after`).
- Continuity is what is kept at the ident and read back when it is opened. An LLM that never
  opens its ident again does not remember it.

Terms: [NOMENCLATURE.md](NOMENCLATURE.md).

## Run

```
npm test          # node --test, no install needed
npm run dev       # http://127.0.0.1:8480 (in-memory ident store)
```

Deploy: Vercel. Set `LUNA_SECRET` (signs idents) and connect a Blob store
(`BLOB_READ_WRITE_TOKEN`) for ident persistence.
