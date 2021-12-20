/* nestor thing server driver (smart-bmp) */

const thing_type = "smart-bmp";

module.exports = {
    init: (m, log) => {
        return {
            temp: (thing, client, value, transitional, next) => {
                next();
            }
        };
    },
    api: {}
};