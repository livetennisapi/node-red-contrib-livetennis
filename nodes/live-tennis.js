"use strict";

const client = require("./lib/client");

module.exports = function (RED) {
    /**
     * "live tennis" query node.
     *
     * Config properties: operation, tour, limit, matchId, playerId, search,
     * plus a reference to a livetennis-config node holding the API key.
     *
     * Message overrides (all optional):
     *   msg.topic              — operation name (live|upcoming|completed|match|
     *                            score|player_search|player|fixtures|health)
     *   msg.payload (object)   — {operation, tour, limit, offset, matchId,
     *                            playerId, search} override the node config
     *   msg.payload (number)   — matchId / playerId for match|score|player
     *   msg.payload (string)   — search text for player_search
     *
     * Output: msg.payload = flattened matches / players / object;
     *         msg.meta = {limit, offset, count} on list operations;
     *         msg.operation = the operation that ran.
     */
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
                limit: config.limit || undefined,
                matchId: config.matchId || undefined,
                playerId: config.playerId || undefined,
                search: config.search || undefined
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
                for (const k of ["tour", "limit", "offset", "matchId", "playerId", "search"]) {
                    if (p[k] !== undefined && p[k] !== null && p[k] !== "") {
                        params[k] = p[k];
                    }
                }
            } else if (typeof p === "number" || (typeof p === "string" && p !== "")) {
                // scalar payload: id for id-operations, search text for player_search
                if (operation === "match" || operation === "score") {
                    params.matchId = p;
                } else if (operation === "player") {
                    params.playerId = p;
                } else if (operation === "player_search") {
                    params.search = p;
                }
            }

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
