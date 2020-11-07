/* MODULE – CLI */
// command line interface

/* IMPORTS */
const _util = require("util");
const readline = require("readline");

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
var input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
var init = _ => {
    input.on('line', (line) => {
        line = line.trim();
        if (line != '') {
            line = line.split(' ');
            if (line[0] == "db") {
                if (line.length > 1 && line[1] == "table") {
                    if (line.length > 2) {
                        m.db.example(line[2], result => {
                            log(result);
                        });
                    }
                }
            } else if (line[0] == "m") {
                if (line.length == 1) {
                    var output = _util.inspect(m, {
                        showHidden: false, depth: 2, colors: true, compact: false
                    });
                    log(`modules\n${output}`);
                } else if (line.length > 1 && m.hasOwnProperty(line[1])) {
                    if (line.length > 2 && m[line[1]].hasOwnProperty(line[2])) {
                        var func = m[line[1]][line[2]];
                        var args = line.slice(3);
                        for (var i = 0; i < func.length - 1; i++) {
                            if (i >= args.length) args.push(null);
                        }
                        args.push(log);
                        func.apply(null, args);
                    }
                }
            } else if (line[0] == "clear") {
                console.clear();
            } else if (line[0] == "exit" || line[0] == "quit") {
                m.main.exit(0);
            }
        }
    });
};
var api = {
    /*
        TODO: create functions that allow other modules to interact with this one when necessary
        (functions should take simple parameters, execute requested command-line operations/interactions, handle errors, and provide result data)
    */
};



/* EXPORT */
module.exports = {
    id: null,
    init: id => {
        module.exports.id = id;
        m = global.m;
        log = m.utils.logger(id, false);
        err = m.utils.logger(id, true);
        log("initializing");
        init();
    },
    api: api
};