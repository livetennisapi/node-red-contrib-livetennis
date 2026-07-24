"use strict";

/**
 * Tests run against recorded fixtures (test/fixtures/*.json — captured from
 * the real API on 2026-07-24). No live network: global.fetch is stubbed.
 */

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const helper = require("node-red-node-test-helper");

const client = require("../nodes/lib/client");
const configNode = require("../nodes/livetennis-config.js");
const liveTennisNode = require("../nodes/live-tennis.js");

helper.init(require.resolve("node-red"));

function fixture(name) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name + ".json"), "utf8"));
}

/** Install a fetch stub; records requests, returns queued responses. */
function stubFetch(status, body, headers) {
    const calls = [];
    global.fetch = async function (url, opts) {
        calls.push({ url: String(url), opts });
        return new Response(JSON.stringify(body), {
            status,
            headers: Object.assign({ "content-type": "application/json" }, headers || {})
        });
    };
    return calls;
}

const realFetch = global.fetch;
afterEach(function () { global.fetch = realFetch; });

// ---------------------------------------------------------------- client unit
describe("client (pure)", function () {
    it("builds a live-matches request with tour+limit and X-API-Key", function () {
        const { url, headers } = client.buildRequest("live", { tour: "itf", limit: 10 }, "k123");
        assert.strictEqual(url, "https://api.livetennisapi.com/api/public/v1/matches?status=live&tour=itf&limit=10");
        assert.strictEqual(headers["X-API-Key"], "k123");
    });

    it("requires matchId for score", function () {
        assert.throws(() => client.buildRequest("score", {}, "k"), /needs matchId/);
    });

    it("health needs no key", function () {
        const { url, headers } = client.buildRequest("health", {}, undefined);
        assert.ok(url.endsWith("/health"));
        assert.strictEqual(headers["X-API-Key"], undefined);
    });

    it("rejects an unknown operation", function () {
        assert.throws(() => client.buildRequest("nope", {}, "k"), /unknown operation/);
    });

    it("flattens a completed match: string points, per-set games, winner", function () {
        const m = fixture("matches_completed").data[0];
        const flat = client.flattenMatch(m);
        assert.strictEqual(flat.winner, 2);
        assert.strictEqual(flat.sets_p1, 0);
        assert.strictEqual(flat.sets_p2, 2);
        assert.deepStrictEqual(flat.games_p1, [3, 4]); // per-set array
        assert.strictEqual(typeof flat.points_p1, "string"); // points are STRINGS
        assert.ok(flat.p1_name && flat.p2_name);
    });

    it("flattens a null score (upcoming match) to null fields, not a crash", function () {
        const m = fixture("matches_upcoming").data[0];
        assert.strictEqual(m.score, null); // recorded truth
        const flat = client.flattenMatch(m);
        assert.strictEqual(flat.sets_p1, null);
        assert.strictEqual(flat.points_p1, null);
        assert.strictEqual(flat.server, null);
        assert.strictEqual(flat.is_tiebreak, null);
    });

    it("maps 403 to the friendly tier-wall message", function () {
        const err = client.friendlyHttpError(403, JSON.stringify(fixture("error_403_markets").body));
        assert.match(err.message, /not included in your plan/);
        assert.match(err.message, /upgrade_required/);
        assert.strictEqual(err.status, 403);
    });

    it("maps 429 with a Retry-After hint", function () {
        const err = client.friendlyHttpError(429, "{}", "42");
        assert.match(err.message, /rate limit/);
        assert.match(err.message, /~42s/);
    });
});

// ------------------------------------------------------------- node in a flow
describe("live tennis node", function () {
    before(function (done) { helper.startServer(done); });
    after(function (done) { helper.stopServer(done); });
    afterEach(function () { return helper.unload(); });

    const FLOW = [
        { id: "cfg", type: "livetennis-config", name: "api" },
        { id: "n1", type: "live tennis", server: "cfg", operation: "live", wires: [["h1"]] },
        { id: "h1", type: "helper" }
    ];
    const CREDS = { cfg: { apiKey: "test-key-not-real" } };

    it("loads with credentials in the credential store", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            const cfg = helper.getNode("cfg");
            assert.strictEqual(cfg.credentials.apiKey, "test-key-not-real");
            assert.strictEqual(cfg.baseUrl, "https://api.livetennisapi.com/api/public/v1");
            done();
        });
    });

    it("outputs flattened upcoming matches with null scores (recorded fixture)", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            const calls = stubFetch(200, fixture("matches_upcoming"));
            const h1 = helper.getNode("h1");
            h1.on("input", function (msg) {
                try {
                    assert.ok(Array.isArray(msg.payload));
                    assert.strictEqual(msg.payload.length, 3);
                    assert.strictEqual(msg.payload[0].p1_name, "Ryuki Matsuda");
                    assert.strictEqual(msg.payload[0].sets_p1, null); // null score flattened
                    assert.strictEqual(msg.meta.count, 3);
                    assert.strictEqual(msg.operation, "upcoming");
                    assert.match(calls[0].url, /status=upcoming/);
                    assert.strictEqual(calls[0].opts.headers["X-API-Key"], "test-key-not-real");
                    done();
                } catch (e) { done(e); }
            });
            helper.getNode("n1").receive({ topic: "upcoming" });
        });
    });

    it("outputs string points on a completed match (recorded fixture)", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            stubFetch(200, fixture("matches_completed"));
            const h1 = helper.getNode("h1");
            h1.on("input", function (msg) {
                try {
                    assert.strictEqual(msg.payload[0].points_p1, "0"); // string, not number
                    assert.deepStrictEqual(msg.payload[0].games_p2, [6, 6]);
                    done();
                } catch (e) { done(e); }
            });
            helper.getNode("n1").receive({ topic: "completed" });
        });
    });

    it("reports the friendly 403 tier wall via node.error (recorded fixture)", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            stubFetch(403, fixture("error_403_markets").body);
            const n1 = helper.getNode("n1");
            n1.on("call:error", function (call) {
                try {
                    assert.match(call.firstArg.message, /not included in your plan/);
                    done();
                } catch (e) { done(e); }
            });
            n1.receive({ payload: 22227, topic: "score" });
        });
    });

    it("scalar payload is the search text for player_search", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            const calls = stubFetch(200, fixture("players_search"));
            const h1 = helper.getNode("h1");
            h1.on("input", function (msg) {
                try {
                    assert.match(calls[0].url, /\/players\?search=alcaraz/);
                    assert.strictEqual(msg.payload[0].name, "Carlos Alcaraz");
                    assert.strictEqual(msg.payload[0].data_completeness.known, 4);
                    done();
                } catch (e) { done(e); }
            });
            helper.getNode("n1").receive({ topic: "player_search", payload: "alcaraz" });
        });
    });

    it("msg.payload object overrides node config (matchId route)", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, CREDS, function () {
            const calls = stubFetch(200, fixture("score"));
            const h1 = helper.getNode("h1");
            h1.on("input", function (msg) {
                try {
                    assert.match(calls[0].url, /\/matches\/22227\/score$/);
                    assert.deepStrictEqual(msg.payload.sets, [0, 2]);
                    done();
                } catch (e) { done(e); }
            });
            helper.getNode("n1").receive({ payload: { operation: "score", matchId: 22227 } });
        });
    });

    it("errors cleanly when no API key is configured", function (done) {
        helper.load([configNode, liveTennisNode], FLOW, {}, function () {
            const n1 = helper.getNode("n1");
            n1.on("call:error", function (call) {
                try {
                    assert.match(call.firstArg.message, /no API key configured/);
                    done();
                } catch (e) { done(e); }
            });
            n1.receive({ topic: "live" });
        });
    });
});
