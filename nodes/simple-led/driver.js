/* nestor node device server driver (simple-led) */

module.exports = _ => {
    return {
        switch1: (node, value, next, transitional) => {
            next();
        },
        switch2: (node, value, next, transitional) => {
            next();
        },
        brightness1: (node, value, next, transitional) => {
            next();
        },
        brightness2: (node, value, next, transitional) => {
            next();
        }
    };
};