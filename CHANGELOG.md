# Changelog

## 0.2.0 — 2026-08-07

### Added
- **Six new operations** on the `live tennis` node:
  - `h2h` — head-to-head across the 1968–2022 results archive and our own
    completed matches, 2023→now (BASIC or any History plan); ambiguous name
    fragments are refused with the candidate list.
  - `archive_matches` — deep historical results 1968–2022 with `tour`
    (atp|wta), `name`, `from`/`to`, `round` and `level` filters (BASIC or any
    History plan).
  - `archive_players` — archive player bios: hand, date of birth, country,
    height, career-high (BASIC or any History plan).
  - `archive_career` — one player's whole archive career: W-L by surface,
    level and year, titles, summed serve stats (BASIC or any History plan).
  - `rankings` — two modes: rank-ordered listing for one system (PRO) or
    per-player point-in-time records at `as_of` (ULTRA); systems `atp`, `wta`,
    `itf_jt`, `itf_mt`, `itf_wt`, `utr` (utr has no listing).
  - `statistics` — in-play match statistics: aces, double faults, serve split,
    hold/break %, break points, service & return points (ULTRA).
- **List filters** on `live` / `upcoming` / `completed`: `player` (id,
  repeatable up to 50 — comma-separate in the editor), `country` (lowercase
  3-letter IOC-style code), `from`/`to` (play dates). Unknown filter values
  are a 400, never silently ignored.
- A 429 `abuse_throttled` (the 24-hour block for clients that keep hammering
  after the quota is spent) now gets its own message with the
  `retry_at_epoch` unblock time and the actual fix: honour `Retry-After` and
  stop polling on 429.
- A daily-quota 429 now reports the exact `resets_at` instant from the
  response body.
- Tier gates stated per operation in the editor dropdown, the node help and
  the README; a 403 names the exact tier that unlocks the operation.
- `scripts/truthcheck.sh` + CI step pinning product truths (quota grid, docs
  URL) so stale copy cannot come back.
- `publishConfig.access: "public"` — required for the first publish of a
  scoped package.

### Changed
- README brought to the fleet standard: CI/license badges, full quota table
  (2026-08-06 grid: FREE 100/day · BASIC 1,000/day · PRO 10,000/day · ULTRA
  500,000/day), authentication section, links block.

## 0.1.1 — 2026-08-02

- **Docs — corrected tier information.** The previous README wrongly claimed
  everything the node's operations use is on the FREE tier. Truth: the default
  operation (`live`) and every other operation except `completed` are FREE;
  bulk completed-match listings (`completed`, `GET /matches?status=completed`)
  need the BASIC tier ($9.99/mo) or any History plan (a FREE key gets
  403 `upgrade_required`); match events and markets need PRO, model analysis
  needs ULTRA. Fetching a single completed match by id via `match` stays FREE.
  Tier notes added to the README operations table, the editor's operation
  dropdown and the node help.
- A 403 on the `completed` operation now reports the exact upgrade path
  ("Completed-match listings need the BASIC tier ($9.99/mo) or any History
  plan — upgrade at https://livetennisapi.com/subscribe/upgrade") instead of
  the generic tier message.
- Added GitHub Actions workflows: CI (lint + tests) and a tag-triggered npm
  publish with provenance.

## 0.1.0 — 2026-07-24

- Initial release: `live tennis` query node (9 operations, per-message
  overrides, flattened payloads, friendly 401/403/429 errors) and
  `livetennis-config` connection node with the API key in the Node-RED
  credential store.
