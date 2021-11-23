/* MODULE – UTILITIES */
// general-purpose utility functions

/* IMPORTS */
const _util = require("util");
const am = require('array-move');
const rn = require('random-number');

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
var api = {
    lpad: (s, width, char) => {
        return s.length >= width
            ? s
            : (new Array(width).join(char) + s).slice(-width);
    }, // https://stackoverflow.com/questions/10841773/javascript-format-number-to-day-with-always-3-digits
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
            m.utils.lpad(String(parseInt(r)), 3, "0") +
            m.utils.lpad(String(parseInt(g)), 3, "0") +
            m.utils.lpad(String(parseInt(b)), 3, "0")
        );
    },
    // validate/correct rgb integer
    rgb_validate: (n) => (m.utils.validate_int(n, 0, 255)),
    condense_pattern: (p) => {
        // condense pattern into fRGBh strings
        var pattern_string = "";
        for (var p_c in p.list) {
            var pattern_color = p.list[p_c];
            pattern_string +=
                m.utils.lpad(`${pattern_color.fade}`, 5, "0") +
                m.utils.rgb_string(pattern_color.r, pattern_color.g, pattern_color.b) +
                m.utils.lpad(`${pattern_color.time}`, 5, "0") +
                ",";
        }
        pattern_string = pattern_string.substring(0, pattern_string.length - 1);
        return pattern_string;
    },
    condense_pattern_hex: (p) => {
        // condense pattern into fRGBh strings
        var pattern_string = "";
        var count = 0;
        for (var p_c in p.list) {
            var pattern_color = p.list[p_c];
            pattern_string +=
                m.utils.lpad(`${pattern_color.hue.fade}`, 5, "0") +
                pattern_color.hue.hex +
                m.utils.lpad(`${pattern_color.hue.time}`, 5, "0") +
                ",";
            count++;
        }
        if (count == 0) {
            pattern_string = 'null';
        } else pattern_string = pattern_string.substring(0, pattern_string.length - 1);
        return pattern_string;
    },
    // correctly type a raw text value
    correct_type: (value, type) => {
        switch (type) {
            case "int":
                value = parseInt(value);
                break;
            case "float":
                value = parseFloat(value);
                break;
            case "bool":
                value = (`${value}`).toLowerCase().trim() === "true" ? true : false;
                break;
            case "string":
            default:
                value = (`${value}`);
                break;
        }
        return value;
    },
    // array move shortcut
    array_move: (list, from_pos, to_pos) => {
        return am(list, from_pos, to_pos);
    },
    remove_last_dir: (path, split_char = '/') => {
        if (path) {
            var path_arr = path.split(split_char);
            path_arr.pop();
            return path_arr.join(split_char);
        }
        return null;
    }
};



/* EXPORTS */
module.exports = {
    id: null,
    init: id => {
        module.exports.id = id;
        m = global.m;
        log = m.utils.logger(id, false);
        err = m.utils.logger(id, true);
        log("initializing");
    },
    api: {},
    _enable_api: _ => {
        var utils = module.exports;
        var excluded = ["id", "api", "init", "_enable_api"];
        for (var u in utils) {
            if (utils.hasOwnProperty(u) && !excluded.includes(u))
                utils.api[u] = utils[u];
        }
        for (var u in api) {
            if (api.hasOwnProperty(u))
                utils.api[u] = api[u];
        }
    },
    // returns a message/error logger
    logger: (id, as_error) => {
        var e = as_error ? true : false;
        var logger_obj = (...args) => {
            var msg = "";
            for (var i = 0; i < args.length; i++) {
                var arg = args[i];
                if (typeof arg === 'object' && arg !== null)
                    arg = _util.inspect(arg, {
                        showHidden: false, depth: logger_obj.depth, colors: true, compact: false
                    });
                msg += `${arg}${i < args.length - 1 ? ' ' : ''}`;
            }
            if (e) {
                msg = `* [${id}] ERROR: ${msg}`;
                console.error(msg);
            } else {
                msg = `[${id}] ${msg}`;
                console.log(msg);
            }
        };
        logger_obj.depth = null;
        return logger_obj;
    },
    // non-blocking delayed callback
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
            key += chars[rn({
                min: 0,
                max: chars.length - 1,
                integer: true
            })];
        return key;
    },
};