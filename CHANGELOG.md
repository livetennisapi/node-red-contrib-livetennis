# Changelog

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
