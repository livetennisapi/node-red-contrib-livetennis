"use strict";

module.exports = [
    {
        files: ["nodes/**/*.js", "test/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                // Node.js
                console: "readonly",
                module: "readonly",
                require: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                // Node 18+ web globals
                fetch: "writable",
                Response: "readonly",
                URL: "readonly",
                AbortController: "readonly",
                global: "writable",
                // mocha
                describe: "readonly",
                it: "readonly",
                before: "readonly",
                after: "readonly",
                afterEach: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            eqeqeq: "error",
            "no-var": "error",
            "prefer-const": "error"
        }
    }
];
