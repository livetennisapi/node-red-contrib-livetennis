"use strict";

/**
 * Pure HTTP client for the Live Tennis API.
 *
 * Kept free of any Node-RED dependency so it can be unit-tested against
 * recorded fixtures with no live network. The fetch implementation is
 * injectable (`fetchImpl`) for exactly that reason.
 *
 * API contract (openapi.yaml, verified 2026-07-24):
 *  - base URL https://api.livetennisapi.com/api/public/v1
 *  - auth via `X-API-Key` header (Bearer also accepted)
 *  - list endpoints return {data, meta}; single resources return the object
 *  - score.server is nullable; score.points are STRINGS ("0","15","40","A");
 *    score.games is per-player growing per-set arrays
 *  - a 403 means the endpoint is above the key's tier (upgrade_required)
 */

const DEFAULT_BASE_URL = "https://api.livetennisapi.com/api/public/v1";
const DEFAULT_TIMEOUT_MS = 15000;

// operation -> request description
const OPERATIONS = {
    live: { path: "/matches", fixedQuery: { status: "live" }, query: ["tour", "limit", "offset"], list: "matches" },
    upcoming: { path: "/matches", fixedQuery: { status: "upcoming" }, query: ["tour", "limit", "offset"], list: "matches" },
    completed: { path: "/matches", fixedQuery: { status: "completed" }, query: ["tour", "limit", "offset"], list: "matches" },
    match: { path: (p) => `/matches/${encodeURIComponent(p.matchId)}`, requires: ["matchId"], single: "match" },
    score: { path: (p) => `/matches/${encodeURIComponent(p.matchId)}/score`, requires: ["matchId"], single: "score" },
    player_search: { path: "/players", query: ["search", "limit", "offset"], list: "players" },
    player: { path: (p) => `/players/${encodeURIComponent(p.playerId)}`, requires: ["playerId"], single: "player" },
    fixtures: { path: "/fixtures", query: ["tour", "limit", "offset"], list: "fixtures" },
    health: { path: "/health", noAuth: true, single: "health" }
};

class LiveTennisError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name = "LiveTennisError";
        this.status = status;
        this.body = body;
    }
}

/**
 * Build the URL + headers for an operation. Pure; throws LiveTennisError on
 * a missing required parameter or unknown operation.
 */
function buildRequest(operation, params, apiKey, baseUrl) {
    const op = OPERATIONS[operation];
    if (!op) {
        throw new LiveTennisError(
            `Live Tennis API: unknown operation "${operation}" (expected one of ${Object.keys(OPERATIONS).join(", ")})`
        );
    }
    for (const req of op.requires || []) {
        if (params[req] === undefined || params[req] === null || params[req] === "") {
            throw new LiveTennisError(`Live Tennis API: operation "${operation}" needs ${req}`);
        }
    }
    const base = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const path = typeof op.path === "function" ? op.path(params) : op.path;
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(op.fixedQuery || {})) {
        url.searchParams.set(k, v);
    }
    for (const k of op.query || []) {
        const v = params[k];
        if (v !== undefined && v !== null && v !== "") {
            url.searchParams.set(k, String(v));
        }
    }
    const headers = { Accept: "application/json" };
    if (!op.noAuth) {
        if (!apiKey) {
            throw new LiveTennisError("Live Tennis API: no API key configured (add one in the livetennis-config node)");
        }
        headers["X-API-Key"] = apiKey;
    }
    return { url: url.toString(), headers };
}

/** Map an HTTP failure to a friendly, actionable error. */
function friendlyHttpError(status, bodyText, retryAfter) {
    let body;
    try { body = JSON.parse(bodyText); } catch { body = undefined; }
    const apiError = body && body.error ? ` (${body.error})` : "";
    if (status === 401) {
        return new LiveTennisError(
            "Live Tennis API: API key missing, unknown or disabled (401). Free keys: https://livetennisapi.com/subscribe/free",
            status, body
        );
    }
    if (status === 403) {
        return new LiveTennisError(
            `Live Tennis API: this endpoint is not included in your plan (403${apiError}). See https://livetennisapi.com/#pricing`,
            status, body
        );
    }
    if (status === 429) {
        const hint = retryAfter ? ` — retry in ~${retryAfter}s` : "";
        return new LiveTennisError(
            `Live Tennis API: rate limit reached (429)${hint}. Free tier allows 1000 requests/day, 30/minute.`,
            status, body
        );
    }
    if (status === 404) {
        return new LiveTennisError(`Live Tennis API: not found (404${apiError})`, status, body);
    }
    return new LiveTennisError(
        `Live Tennis API returned ${status}${apiError}: ${String(bodyText).slice(0, 200)}`,
        status, body
    );
}

/**
 * Flatten one match object: hoist players and score onto top-level fields.
 * Live truths honoured: score may be null; points are strings; games is a
 * per-player list of per-set game counts (grows as sets are played);
 * server may be null; data_completeness.known/of are null on doubles teams.
 */
function flattenMatch(m) {
    const p1 = (m.players && m.players.p1) || {};
    const p2 = (m.players && m.players.p2) || {};
    const s = m.score || null;
    const flat = {
        id: m.id,
        tournament: m.tournament,
        round: m.round, // NOTE: often restates the tournament name on lower tours
        surface: m.surface,
        indoor: m.indoor,
        format: m.format,
        status: m.status,
        event_status: m.event_status,
        is_doubles: m.is_doubles,
        scheduled_time: m.scheduled_time,
        winner: m.winner !== undefined ? m.winner : null,
        p1_id: p1.id,
        p1_name: p1.name,
        p1_country: p1.country,
        p1_ranking: p1.ranking,
        p2_id: p2.id,
        p2_name: p2.name,
        p2_country: p2.country,
        p2_ranking: p2.ranking,
        sets_p1: s && Array.isArray(s.sets) ? s.sets[0] : null,
        sets_p2: s && Array.isArray(s.sets) ? s.sets[1] : null,
        games_p1: s && Array.isArray(s.games) ? s.games[0] : null,
        games_p2: s && Array.isArray(s.games) ? s.games[1] : null,
        points_p1: s && Array.isArray(s.points) ? s.points[0] : null, // string, e.g. "40"
        points_p2: s && Array.isArray(s.points) ? s.points[1] : null,
        server: s ? s.server : null, // 1 | 2 | null (unknown)
        is_tiebreak: s ? s.is_tiebreak : null,
        score_timestamp: s ? s.timestamp : null
    };
    // Preserve tier-gated embeds when the key unlocks them (match detail).
    if (m.market !== undefined) { flat.market = m.market; }
    if (m.analysis !== undefined) { flat.analysis = m.analysis; }
    return flat;
}

/** Players come back nearly flat already; pass through untouched. */
function flattenPlayer(p) {
    return p;
}

function shapePayload(operation, json) {
    const op = OPERATIONS[operation];
    if (op.list === "matches") {
        return { payload: (json.data || []).map(flattenMatch), meta: json.meta };
    }
    if (op.list === "players") {
        return { payload: (json.data || []).map(flattenPlayer), meta: json.meta };
    }
    if (op.list === "fixtures") {
        return { payload: json.data || [], meta: json.meta };
    }
    if (op.single === "match") {
        return { payload: flattenMatch(json) };
    }
    // score / player / health: already a single flat-ish object
    return { payload: json };
}

/**
 * Execute an operation. Returns { payload, meta? }. Throws LiveTennisError
 * with a friendly message on any failure.
 */
async function execute(operation, params, options) {
    const { apiKey, baseUrl, fetchImpl, timeoutMs } = options || {};
    const doFetch = fetchImpl || fetch;
    const { url, headers } = buildRequest(operation, params || {}, apiKey, baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
    let res;
    try {
        res = await doFetch(url, { headers, signal: controller.signal });
    } catch (err) {
        throw new LiveTennisError(
            `Live Tennis API: request failed (${err.name === "AbortError" ? "timeout" : err.message})`
        );
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text();
        throw friendlyHttpError(res.status, text, res.headers && res.headers.get ? res.headers.get("retry-after") : null);
    }
    const json = await res.json();
    return shapePayload(operation, json);
}

module.exports = {
    DEFAULT_BASE_URL,
    OPERATIONS,
    LiveTennisError,
    buildRequest,
    friendlyHttpError,
    flattenMatch,
    flattenPlayer,
    shapePayload,
    execute
};
