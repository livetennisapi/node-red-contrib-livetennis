"use strict";

const client = require("./lib/client");

module.exports = function (RED) {
    /**
     * "live tennis" query node.
     *
     * Config properties: operation, tour, player, country, from, to, limit,
     * matchId, playerId, search, p1, p2, playerName, system, asOf, plus a
     * reference to a livetennis-config node holding the API key.
     *
     * Message overrides (all optional):
     *   msg.topic              — operation name (live|upcoming|completed|match|
     *                            score|statistics|player_search|player|fixtures|
     *                            h2h|archive_matches|archive_players|
     *                            archive_career|rankings|health)
     *   msg.payload (object)   — {operation, tour, player, country, from, to,
     *                            limit, offset, matchId, playerId, search,
     *                            p1, p2, name, system, as_of, round, level}
     *                            override the node config
     *   msg.payload (number)   — matchId / playerId for match|score|statistics|player
     *   msg.payload (string)   — search text for player_search, player name
     *                            for archive_career
     *
     * Output: msg.payload = flattened matches / players / object;
     *         msg.meta = {limit, offset, count} on list operations;
     *         msg.operation = the operation that ran.
     */

    /** "1, 2,3" | ["1","2"] -> array of trimmed values; empty -> undefined. */
    function toList(v) {
        if (v === undefined || v === null || v === "") { return undefined; }
        const items = (Array.isArray(v) ? v : String(v).split(","))
            .map(function (s) { return typeof s === "string" ? s.trim() : s; })
            .filter(function (s) { return s !== "" && s !== undefined && s !== null; });
        return items.length ? items : undefined;
    }
    function LiveTennisNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.server = RED.nodes.getNode(config.server);

        node.on("input", function (msg, send, done) {
            // Node-RED 1.0+ style with fallbacks for older runtimes
            send = send || function () { node.send.apply(node, arguments); };
            done = done || function (err) { if (err) { node.error(err, msg); } };

            const params = {
                tour: config.tour || undefined,
                player: config.player || undefined,
                country: config.country || undefined,
                from: config.from || undefined,
                to: config.to || undefined,
                limit: config.limit || undefined,
                matchId: config.matchId || undefined,
                playerId: config.playerId || undefined,
                search: config.search || undefined,
                p1: config.p1 || undefined,
                p2: config.p2 || undefined,
                name: config.playerName || undefined,
                system: config.system || undefined,
                as_of: config.asOf || undefined
            };
            let operation = config.operation || "live";

            // msg.topic can name the operation
            if (typeof msg.topic === "string" && client.OPERATIONS[msg.topic]) {
                operation = msg.topic;
            }
            // msg.payload object fields override node config
            const p = msg.payload;
            if (p && typeof p === "object" && !Array.isArray(p) && !Buffer.isBuffer(p)) {
                if (typeof p.operation === "string" && client.OPERATIONS[p.operation]) {
                    operation = p.operation;
                }
                for (const k of ["tour", "player", "country", "from", "to", "limit",
                    "offset", "matchId", "playerId", "search", "p1", "p2", "name",
                    "system", "as_of", "round", "level"]) {
                    if (p[k] !== undefined && p[k] !== null && p[k] !== "") {
                        params[k] = p[k];
                    }
                }
                // friendlier aliases for the config-node field names
                if (p.playerName !== undefined && p.playerName !== null && p.playerName !== "") {
                    params.name = p.playerName;
                }
                if (p.asOf !== undefined && p.asOf !== null && p.asOf !== "") {
                    params.as_of = p.asOf;
                }
            } else if (typeof p === "number" || (typeof p === "string" && p !== "")) {
                // scalar payload: id for id-operations, text for name-operations
                if (operation === "match" || operation === "score" || operation === "statistics") {
                    params.matchId = p;
                } else if (operation === "player") {
                    params.playerId = p;
                } else if (operation === "player_search") {
                    params.search = p;
                } else if (operation === "archive_career") {
                    params.name = p;
                }
            }

            // repeatable parameters: accept arrays or comma-separated strings
            params.player = toList(params.player);
            params.system = toList(params.system);

            const apiKey = node.server && node.server.credentials
                ? node.server.credentials.apiKey
                : undefined;
            const baseUrl = node.server ? node.server.baseUrl : undefined;

            node.status({ fill: "blue", shape: "dot", text: operation + "…" });

            client.execute(operation, params, { apiKey, baseUrl })
                .then(function (result) {
                    msg.payload = result.payload;
                    if (result.meta !== undefined) { msg.meta = result.meta; }
                    msg.operation = operation;
                    const n = Array.isArray(result.payload) ? result.payload.length + " items" : "ok";
                    node.status({ fill: "green", shape: "dot", text: operation + ": " + n });
                    send(msg);
                    done();
                })
                .catch(function (err) {
                    const short = err.status ? "HTTP " + err.status : "error";
                    node.status({ fill: "red", shape: "ring", text: operation + ": " + short });
                    done(err);
                });
        });

        node.on("close", function () {
            node.status({});
        });
    }

    RED.nodes.registerType("live tennis", LiveTennisNode);
};
