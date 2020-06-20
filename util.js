const read_line = require('readline');
const random_number = require("random-number");

/* UTILITIES */
var util; util = {
    // log levels (0 = top priority)
    ERR: 0, // errors
    IMP: 1, // important info
    INF: 2, // unimportant info
    REP: 3, // repetitive info
    EXT: 4, // extra info
    LEVEL: 1,
    log: (category, level, message1, message2 = "") => {
        if (level <= util.LEVEL) {
            console.log("[" + category + "]", message1, message2);
        }
    },
    // read input
    input: read_line.createInterface({
        input: process.stdin,
        output: process.stdout
    }),
    delay: (callback, timeout) => {
        setTimeout(_ => {
            process.nextTick(callback);
        }, timeout);
    },
    // generate random alphanumeric key
    rand_id: (length = 10) => {
        var key = "";
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = 0; i < length; i++)
            key += chars[random_number({
                min: 0,
                max: chars.length - 1,
                integer: true
            })];
        return key;
    },
    // left pad string
    lpad: (s, width, char) => {
        return s.length >= width
            ? s
            : (new Array(width).join(char) + s).slice(-width);
    },
    // validate/correct bounded integer
    validate_int: (n, l_b, u_b) => {
        n = parseInt(Math.round(parseFloat(n)));
        if (n < l_b) n = l_b;
        else if (n > u_b) n = u_b;
        return n;
    },
    // convert RGB values to padded RGB string
    rgb_string: (r, g, b) => {
        return (
            util.lpad(String(parseInt(r)), 3, "0") +
            util.lpad(String(parseInt(g)), 3, "0") +
            util.lpad(String(parseInt(b)), 3, "0")
        );
    },
    // validate/correct rgb integer
    rgb_validate: (n) => (util.validate_int(n, 0, 255)),
    condense_pattern: (p) => {
        // condense pattern into fRGBh strings
        var pattern_string = "";
        for (var p_c in p.list) {
            var pattern_color = p.list[p_c];
            pattern_string +=
                util.lpad(pattern_color.fade, 5, "0") +
                util.rgb_string(pattern_color.r, pattern_color.g, pattern_color.b) +
                util.lpad(pattern_color.time, 5, "0") +
                ",";
        }
        pattern_string = pattern_string.substring(0, pattern_string.length - 1);
        return pattern_string;
    }
};

module.exports = util;