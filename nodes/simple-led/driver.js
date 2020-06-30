/* nestor node device server driver (simple-led) */

module.exports = _ => {
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
};