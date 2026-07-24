"use strict";

/**
 * LIVE smoke test — talks to the real Live Tennis API.
 *
 * NOT part of `npm test`. Run explicitly with a key:
 *
 *   LIVETENNIS_SMOKE_KEY=<your key> npm run smoke
 *
 * Loads the real nodes in node-red-node-test-helper with the key injected
 * through the credentials system, executes real queries, prints the output.
 */

const assert = require("node:assert");
const helper = require("node-red-node-test-helper");

const configNode = require("../../nodes/livetennis-config.js");
const liveTennisNode = require("../../nodes/live-tennis.js");

helper.init(require.resolve("node-red"));

const KEY = process.env.LIVETENNIS_SMOKE_KEY;

describe("LIVE smoke (real network)", function () {
    before(function (done) {
        if (!KEY) { this.skip(); }
        helper.startServer(done);
    });
    after(function (done) { helper.stopServer(done); });
    afterEach(function () { return helper.unload(); });

    const FLOW = [
        { id: "cfg", type: "livetennis-config", name: "api" },
        { id: "n1", type: "live tennis", server: "cfg", operation: "live", wires: [["h1"]] },
        { id: "h1", type: "helper" }
    ];

    function run(inMsg, cb) {
        helper.load([configNode, liveTennisNode], FLOW, { cfg: { apiKey: KEY } }, function () {
            const h1 = helper.getNode("h1");
            const n1 = helper.getNode("n1");
            h1.on("input", function (msg) { cb(null, msg); });
            n1.on("call:error", function (call) { cb(call.firstArg); });
            n1.receive(inMsg);
        });
    }

    it("health (no auth)", function (done) {
        run({ topic: "health" }, function (err, msg) {
            if (err) { return done(err); }
            console.log("SMOKE health ->", JSON.stringify(msg.payload));
            assert.strictEqual(msg.payload.status, "ok");
            done();
        });
    });

    it("live matches (real query through the node)", function (done) {
        run({ topic: "live", payload: { limit: 3 } }, function (err, msg) {
            if (err) { return done(err); }
            console.log("SMOKE live ->", JSON.stringify({ meta: msg.meta, payload: msg.payload }, null, 1));
            assert.ok(Array.isArray(msg.payload));
            done();
        });
    });

    it("completed matches, flattened (real query through the node)", function (done) {
        run({ topic: "completed", payload: { limit: 2 } }, function (err, msg) {
            if (err) { return done(err); }
            console.log("SMOKE completed ->", JSON.stringify(msg.payload, null, 1));
            assert.ok(msg.payload.length > 0);
            const m = msg.payload[0];
            assert.ok(m.p1_name);
            assert.ok(typeof m.points_p1 === "string" || m.points_p1 === null);
            done();
        });
    });

    it("player search 'sinner' (real query through the node)", function (done) {
        run({ topic: "player_search", payload: "sinner" }, function (err, msg) {
            if (err) { return done(err); }
            console.log("SMOKE player_search ->", JSON.stringify(msg.payload.map(p => ({ id: p.id, name: p.name, ranking: p.ranking, tour: p.tour }))));
            assert.ok(msg.payload.length > 0);
            done();
        });
    });

    it("403 tier wall is friendly (markets is PRO, key is FREE)", async function () {
        // /markets is not one of this node's operations, so drive the client's
        // error mapping directly against the real endpoint.
        const client = require("../../nodes/lib/client");
        const res = await fetch(client.DEFAULT_BASE_URL + "/markets?match_id=22227", {
            headers: { "X-API-Key": KEY, Accept: "application/json" }
        });
        assert.strictEqual(res.status, 403);
        const err = client.friendlyHttpError(res.status, await res.text(), null);
        console.log("SMOKE 403 ->", err.message);
        assert.match(err.message, /not included in your plan/);
    });
});
