"use strict";

module.exports = function (RED) {
    /**
     * Shared connection settings for the Live Tennis API.
     * The API key lives in Node-RED's credentials store — it is never part
     * of the exported flow JSON.
     */
    function LiveTennisConfigNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.baseUrl = n.baseUrl || "https://api.livetennisapi.com/api/public/v1";
    }

    RED.nodes.registerType("livetennis-config", LiveTennisConfigNode, {
        credentials: {
            apiKey: { type: "password" }
        }
    });
};
