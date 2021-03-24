/* nestor node server driver (simple-led) */

const node_type = "simple-led";

module.exports = {
    init: (m, log) => {
        return {
            switch1: (node, client, value, transitional, next) => {
                next();
            },
            switch2: (node, client, value, transitional, next) => {
                next();
            },
            brightness1: (node, client, value, transitional, next) => {
                next();
            },
            brightness2: (node, client, value, transitional, next) => {
                next();
            }
        };
    },
    api: {}
};