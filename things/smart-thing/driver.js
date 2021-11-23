/* nestor thing server driver (smart-thing) */

const thing_type = "smart-thing";

module.exports = {
    init: (m, log) => {
        return {
            switch1: (thing, client, value, transitional, next) => {
                next();
            },
            switch2: (thing, client, value, transitional, next) => {
                next();
            },
            brightness1: (thing, client, value, transitional, next) => {
                next();
            },
            brightness2: (thing, client, value, transitional, next) => {
                next();
            }
        };
    },
    api: {}
};