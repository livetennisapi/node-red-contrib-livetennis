# node-red-contrib-livetennis

Node-RED nodes for the [Live Tennis API](https://livetennisapi.com) — real-time
tennis scores, matches, players and fixtures across **ATP, WTA, Challenger, ITF
and junior** tours.

- Free tier: **1000 requests/day, 30/minute, no card** —
  [get a key](https://livetennisapi.com/subscribe/free)
- API reference: <https://docs.livetennisapi.com>

## Install

From your Node-RED user directory (typically `~/.node-red`):

```bash
npm install node-red-contrib-livetennis
```

or via the editor's *Manage palette* menu.

## Nodes

| Node | Purpose |
|---|---|
| **live tennis** | Query node — one configurable operation per node, overridable per message |
| **livetennis-config** | Shared connection (base URL + API key). The key is held in Node-RED's **credential store** and is never exported with your flows. |

## Operations

| Operation | Endpoint | Parameters |
|---|---|---|
| `live` | `GET /matches?status=live` | `tour`, `limit`, `offset` |
| `upcoming` | `GET /matches?status=upcoming` | `tour`, `limit`, `offset` |
| `completed` | `GET /matches?status=completed` | `tour`, `limit`, `offset` |
| `match` | `GET /matches/{id}` | `matchId` |
| `score` | `GET /matches/{id}/score` | `matchId` |
| `player_search` | `GET /players?search=` | `search`, `limit`, `offset` |
| `player` | `GET /players/{id}` | `playerId` |
| `fixtures` | `GET /fixtures` | `tour`, `limit`, `offset` |
| `health` | `GET /health` | — (no auth) |

`tour` is one of `atp`, `wta`, `challenger`, `itf`, `juniors` (each value covers
its singles **and** doubles draws).

## Message overrides

Everything configurable on the node can be overridden per message:

- `msg.topic` — the operation name (`"live"`, `"score"`, `"player_search"`, …)
- `msg.payload` as an **object** — any of `operation`, `tour`, `limit`,
  `offset`, `matchId`, `playerId`, `search`
- `msg.payload` as a **number** — the match/player id for `match` / `score` / `player`
- `msg.payload` as a **string** — the search text for `player_search`

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
- **403** — the endpoint is above your plan tier (`upgrade_required`); only
  match events, markets and model analysis are gated — everything this node's
  default operations use is on the FREE tier
- **429** — rate limit reached, with the `Retry-After` hint

## Example

An importable example lives under *Import → Examples →
node-red-contrib-livetennis* once the package is installed
(`examples/Live Tennis Quickstart.json`): an inject node polls `live` every
2 minutes (720 req/day — inside the free tier) into a debug node.

```json
[
    {"id":"lt-inject","type":"inject","name":"every 2 min","props":[{"p":"payload"}],"repeat":"120","once":true,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":140,"y":100,"wires":[["lt-query"]]},
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
   after 2022-01-31 *should use a scoped name* (e.g.
   `@livetennisapi/node-red-livetennis`). This package currently uses the
   classic unscoped `node-red-contrib-livetennis` form — decide before the
   first `npm publish`, because the name cannot change afterwards.
3. `npm publish` to the public npm registry.
4. Sign in to <https://flows.nodered.org> with GitHub, click the **+** button
   at the top of the library page, choose **node**, and submit the npm package
   name. (Since April 2020 the library does **not** auto-index the `node-red`
   keyword — manual submission is required.)
5. The library runs a **scorecard** (`node-red-dev validate`) on the package;
   fix any ❌ items and use the *request refresh* link on the node's page after
   publishing a fix.

## License

MIT
