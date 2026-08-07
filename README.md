# @livetennisapi/node-red-contrib-livetennis

[![CI](https://github.com/livetennisapi/node-red-contrib-livetennis/actions/workflows/ci.yml/badge.svg)](https://github.com/livetennisapi/node-red-contrib-livetennis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Node-RED nodes for the [Live Tennis API](https://livetennisapi.com) — real-time
tennis scores, matches, statistics, players, fixtures, head-to-head records,
the 1968–2022 results archive and point-in-time rankings across **ATP, WTA,
Challenger, ITF and juniors**.

- Free tier: **100 requests/day, 30/minute, no card** —
  [get a key](https://livetennisapi.com/subscribe/free). That sustains one
  poll every 15 minutes (96/day); faster polling needs Basic
  ($9.99 — 1,000/day, enough for ~90-second polling).
- API reference: <https://docs.livetennisapi.com>

## Install

From your Node-RED user directory (typically `~/.node-red`):

```bash
npm install @livetennisapi/node-red-contrib-livetennis
```

or via the editor's *Manage palette* menu.

## Nodes

| Node | Purpose |
|---|---|
| **live tennis** | Query node — one configurable operation per node, overridable per message |
| **livetennis-config** | Shared connection (base URL + API key). The key is held in Node-RED's **credential store** and is never exported with your flows. |

## Operations

| Operation | Endpoint | Parameters | Tier |
|---|---|---|---|
| `live` | `GET /matches?status=live` | `tour`, `player`, `country`, `from`, `to`, `limit`, `offset` | FREE |
| `upcoming` | `GET /matches?status=upcoming` | `tour`, `player`, `country`, `from`, `to`, `limit`, `offset` | FREE |
| `completed` | `GET /matches?status=completed` | `tour`, `player`, `country`, `from`, `to`, `limit`, `offset` | **BASIC or any History plan** — 403 `upgrade_required` on a FREE key |
| `match` | `GET /matches/{id}` | `matchId` | FREE (including a completed match by id) |
| `score` | `GET /matches/{id}/score` | `matchId` | FREE |
| `statistics` | `GET /matches/{id}/statistics` | `matchId` | **ULTRA** |
| `player_search` | `GET /players?search=` | `search`, `limit`, `offset` | FREE |
| `player` | `GET /players/{id}` | `playerId` | FREE |
| `fixtures` | `GET /fixtures` | `tour`, `limit`, `offset` | FREE |
| `h2h` | `GET /h2h?p1=&p2=` | `p1`, `p2` (name fragments, min 3 chars) | **BASIC or any History plan** |
| `archive_matches` | `GET /history/archive/matches` | `tour` (atp\|wta), `name`, `from`, `to`, `round`, `level`, `limit`, `offset` | **BASIC or any History plan** |
| `archive_players` | `GET /history/archive/players` | `name`, `tour` (atp\|wta), `limit`, `offset` | **BASIC or any History plan** |
| `archive_career` | `GET /history/archive/career?name=` | `name` | **BASIC or any History plan** |
| `rankings` | `GET /rankings` | `player`, `system`, `as_of`, `limit`, `offset` | **PRO** (listing: one `system`, no `player`) / **ULTRA** (per-player, `player` ids) |
| `health` | `GET /health` | — (no auth) | — |

`tour` is one of `atp`, `wta`, `challenger`, `itf`, `juniors` (each value covers
its singles **and** doubles draws); the archive operations accept `atp` and
`wta` only.

### List filters

The `live` / `upcoming` / `completed` operations take these filters (an unknown
filter value is a **400** — never silently ignored):

- `player` — player id, repeatable up to 50 (comma-separate in the editor
  field, or pass an array); multiple ids return the deduplicated union of
  matches where **either** participant matches
- `country` — lowercase **3-letter IOC-style** code matching either
  participant's `player.country` (e.g. `ned`, `sui`, `gre` — *not* ISO-3166)
- `from` / `to` — play dates, `YYYY-MM-DD` or ISO-8601 UTC datetime (a bare
  date is a whole UTC day; `to` must not precede `from`)

### Archive, H2H and rankings

- The **archive** operations (`archive_matches`, `archive_players`,
  `archive_career`) query a licensed 1968–2022 results corpus — a **separate
  id space** where people are keyed by *name fragment* (min 3 characters),
  never by roster player ids. The archive ends where the point-by-point
  coverage begins (2023-01), so no match is ever served from two datasets.
- `h2h` assembles the record between two players from **both** halves: the
  archive (1968–2022) and our own completed matches (2023→now). An ambiguous
  name fragment is refused with the candidate list (`ambiguous_name`) rather
  than merging two people into one record.
- `rankings` has **two modes**: without `player` it returns the full published
  table in rank order for exactly one `system` (**PRO**); with `player` ids
  (repeatable, max 50) it returns point-in-time records in force at `as_of`
  (**ULTRA**). Systems: `atp`, `wta`, `itf_jt`, `itf_mt`, `itf_wt`, `utr` —
  `utr` is a rating, not a ranking, and has no listing mode.

## Message overrides

Everything configurable on the node can be overridden per message:

- `msg.topic` — the operation name (`"live"`, `"score"`, `"h2h"`, `"rankings"`, …)
- `msg.payload` as an **object** — any of `operation`, `tour`, `player`,
  `country`, `from`, `to`, `limit`, `offset`, `matchId`, `playerId`, `search`,
  `p1`, `p2`, `name`, `system`, `as_of`, `round`, `level`
- `msg.payload` as a **number** — the match/player id for
  `match` / `score` / `statistics` / `player`
- `msg.payload` as a **string** — the search text for `player_search`, or the
  player name for `archive_career`

## Output

- `msg.payload` — the flattened result. List operations output an **array**;
  match rows are flattened to `p1_name`, `p2_name`, `sets_p1/p2`,
  `games_p1/p2`, `points_p1/p2`, `server`, `winner`, …
- `msg.meta` — `{limit, offset, count}` on list operations
- `msg.operation` — the operation that ran

Data facts worth knowing (all verified against the live API):

- `points_p1/p2` are **strings** (`"0"`, `"15"`, `"30"`, `"40"`, `"A"`), not numbers.
- `score` is `null` before a match starts; the node flattens that to `null`
  fields rather than crashing.
- `games_p1/p2` are **per-set arrays** that grow as sets are played
  (e.g. `[3, 4]` = 3 games in set 1, 4 in set 2).
- `server` may be `null` when the feed does not know who is serving.
- On doubles, per-player biography (`data_completeness.known/of`) is `null` by design.
- On lower tours `round` often restates the tournament name
  (e.g. tournament `M15 Bali`, round `M15 Bali - Quarter-finals`).
- `fixtures` rows are name-only (players not yet resolved to ids) and the list
  can be empty even when upcoming matches exist — prefer `upcoming` for a
  reliable schedule.

## Errors

Failures are raised via `node.error(err, msg)` — catch them with a **catch**
node. Messages are actionable:

- **401** — key missing, unknown or disabled (with the free-signup link)
- **403** — the endpoint is above your plan tier (`upgrade_required`), and the
  message names the exact tier that unlocks it: `completed`, `h2h` and the
  archive operations need **BASIC** ($9.99/mo) or **any History plan**;
  `rankings` listings need **PRO** ($29.99/mo); per-player rankings and
  `statistics` need **ULTRA** ($99.99/mo) — upgrade at
  <https://livetennisapi.com/subscribe/upgrade>. (Fetching a single completed
  match by id via `match` stays FREE.) Match events and markets need PRO;
  model analysis needs ULTRA — those are embeds on `match` detail, present
  only when your key unlocks them.
- **429** `rate_limited` — rate limit reached, with the `Retry-After` hint;
  when the *daily* quota is spent the message includes the exact `resets_at`
  instant from the response body
- **429** `abuse_throttled` — the key kept requesting long after its quota was
  spent and is blocked for **24 hours**; the message includes the
  `retry_at_epoch` unblock time. Fix the retry loop: honour `Retry-After` and
  stop polling once a 429 arrives, instead of hammering.

## Quotas

| Tier | Requests/min | Requests/day | Price |
|---|---|---|---|
| FREE | 30 | 100 | $0 |
| BASIC | 60 | 1,000 | $9.99/mo |
| PRO | 300 | 10,000 | $29.99/mo |
| ULTRA | 600 | 500,000 | $99.99/mo |

Every response carries `X-RateLimit-Limit` / `X-RateLimit-Remaining` /
`X-RateLimit-Reset` headers, and 429s carry `Retry-After`. On a FREE key
(100/day) poll no faster than every 15 minutes; an always-on dashboard is
a BASIC-tier ($9.99/mo) workload.

## Authentication

The API accepts `Authorization: Bearer <key>` (preferred for raw HTTP),
`X-API-Key: <key>`, or `?token=` for header-less clients; keys start with
`twjp_`. These nodes send the key from the `livetennis-config` node as
`X-API-Key` — the key lives in Node-RED's **credential store** and is never
exported with your flows. Only `health` is unauthenticated.

## Example

An importable example lives under *Import → Examples →
@livetennisapi/node-red-contrib-livetennis* once the package is installed
(`examples/Live Tennis Quickstart.json`): an inject node polls `live` every
15 minutes (96 req/day — inside the free tier's 100/day cap, with no room for
a second polling node; poll faster on Basic) into a debug node.

```json
[
    {"id":"lt-inject","type":"inject","name":"every 15 min","props":[{"p":"payload"}],"repeat":"900","once":true,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":140,"y":100,"wires":[["lt-query"]]},
    {"id":"lt-query","type":"live tennis","name":"live matches","server":"lt-config","operation":"live","tour":"","limit":"20","matchId":"","playerId":"","search":"","x":340,"y":100,"wires":[["lt-debug"]]},
    {"id":"lt-debug","type":"debug","name":"matches","active":true,"tosidebar":true,"complete":"payload","targetType":"msg","x":540,"y":100,"wires":[]},
    {"id":"lt-config","type":"livetennis-config","name":"Live Tennis API","baseUrl":"https://api.livetennisapi.com/api/public/v1"}
]
```

After import, open the `live matches` node and add your API key to the
configuration node.

## Development

```bash
npm install
npm test        # mocha + node-red-node-test-helper against recorded fixtures (no network)
npm run lint    # eslint
```

## Publishing to the Flow Library (maintainer notes)

Steps per <https://flows.nodered.org/add/node> (read 2026-07-24):

1. Package requirements (all met here): a `README.md`; a `package.json` with a
   `node-red` section listing the node files and `"node-red"` in `keywords`;
   a LICENSE file; `examples/` in the package root.
2. **Naming:** nodered.org's packaging guide says packages first published
   after 2022-01-31 *should use a scoped name* — hence this package is
   published as `@livetennisapi/node-red-contrib-livetennis` (the Flow
   Library scorecard fails check P04 for new unscoped names). The name
   cannot change after the first `npm publish`.
3. `npm publish` to the public npm registry — `package.json` sets
   `publishConfig.access: "public"`, which the first publish of a scoped
   package requires (scoped packages default to private).
4. Sign in to <https://flows.nodered.org> with GitHub, click the **+** button
   at the top of the library page, choose **node**, and submit the npm package
   name. (Since April 2020 the library does **not** auto-index the `node-red`
   keyword — manual submission is required.)
5. The library runs a **scorecard** (`node-red-dev validate`) on the package;
   fix any ❌ items and use the *request refresh* link on the node's page after
   publishing a fix.

## Affiliate program

Know developers who need tennis data? The [affiliate program](https://affiliates.livetennisapi.com/program) pays 51% recurring commission for the life of every referred subscription — 30-day cookie, and the people you refer get 10% off.

## Links

- API reference: <https://docs.livetennisapi.com>
- Free API key (100/day, no card): <https://livetennisapi.com/subscribe/free>
- Discord: <https://discord.gg/f8WUZHgDm6>
- GitHub org: <https://github.com/livetennisapi>

## License

MIT
