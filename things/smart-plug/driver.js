/* nestor thing server driver (smart-plug) */

const thing_type = "smart-plug";

module.exports = {
    init: (m, log) => {
        return {
            switch1: (thing, client, value, transitional, next) => {
                next();
            },
        };
    },
    api: {}
};