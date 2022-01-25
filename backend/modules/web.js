/* MODULE – WEB SERVER */
// http web server

/* IMPORTS */
const ejs = require('ejs');
const http = require("http");
const express = require("express");

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
var http_server = null;
var express_api = null;
var http_port = null;
var init = _ => {
    express_api.get("/example1", (req, res) => {
        res.send("get requests work");
    });
    express_api.post("/", (req, res) => {
        if (req.body.hasOwnProperty('name') && req.body.name && req.body.name.trim() != "") {
            m.db.example(req.body.name.trim(), result => {
                res.send(result);
            });
        }
    });
    express_api.get("/", (req, res) => {
        // res.sendFile(__dirname + "/static/index.html");
        if (req.query.hasOwnProperty('l') && req.query.l)
            m.web.render_shortcut(req.query.l, res);
        else {
            var domain = req.hostname.split('.')[0];
            var domains_excluded = m.web.shortcut_domains_excluded;
            if (!domains_excluded.includes(domain)) {
                m.web.render_shortcut(domain, res);
            } else m.web.render_index(res);
        }
    });
    express_api.get("/l/:l", (req, res) => {
        if (req.params.hasOwnProperty('l') && req.params.l)
            m.web.render_shortcut(req.params.l, res);
        else m.web.render_index(res);
    });
    express_api.get("/things/:thing_type/client.js", (req, res) => {
        var thing_type = req.params.thing_type;
        if (m.main.node_drivers.hasOwnProperty(thing_type) && m.main.node_drivers[thing_type].data && m.main.node_drivers[thing_type].data.hasOwnProperty('web') && m.main.node_drivers[thing_type].data.web.hasOwnProperty('client')) {
            if (m.main.node_drivers[thing_type].data.web.client === true) {
                res.sendFile(`${m.utils.remove_last_dir(m.utils.remove_last_dir(__dirname))}/things/${thing_type}/client.js`);
            }
        }
    });
    express_api.get("/things/:thing_type/views.block", (req, res) => {
        var thing_type = req.params.thing_type;
        if (m.main.node_drivers.hasOwnProperty(thing_type) && m.main.node_drivers[thing_type].data && m.main.node_drivers[thing_type].data.hasOwnProperty('web') && m.main.node_drivers[thing_type].data.web.hasOwnProperty('views')) {
            if (m.main.node_drivers[thing_type].data.web.views === true) {
                res.sendFile(`${m.utils.remove_last_dir(m.utils.remove_last_dir(__dirname))}/things/${thing_type}/views.block`);
            }
        }
    });
    express_api.post("/hooks/plex", (req, res) => {
        var plexRawJSON = (`${req.rawBody.split('\n')[4]}`).trim();
        var plexMetadata = JSON.parse(plexRawJSON);

        // parse plex metadata
        var plexUser = "";
        var plexPlayer = "";
        var plexEvent = "";
        if (plexMetadata['Account'] && plexMetadata['Account']['title'])
            plexUser = plexMetadata['Account']['title'];
        if (plexMetadata['Player'] && plexMetadata['Player']['title'])
            plexPlayer = plexMetadata['Player']['title'];
        if (plexMetadata['event']) plexEvent = plexMetadata['event'];

        // act on webhook
        var send_data_to_pinned_device = (field_id, field_val) => {
            m.ws.trigger_node_data_update(global.plex_pinned_device, field_id, field_val, global.plex_pinned_user, '__webhook_plex_user_mock__');
        };
        if (plexUser == "UT" && plexPlayer == "AFTMM") {
            console.log('plexEvent: ' + plexEvent);
            switch (plexEvent) {
                case "media.pause":
                    send_data_to_pinned_device('color', "ff0000|ff0000");
                    send_data_to_pinned_device('mode', 'hue');
                    break;
                case "media.resume":
                case "media.play":
                    // send_data_to_pinned_device('speed', 50);
                    send_data_to_pinned_device('pattern', `${global.plex_pinned_pattern}`);
                    send_data_to_pinned_device('mode', 'pattern');
                    break;
                case "media.stop":
                    send_data_to_pinned_device('color', "ffffff|ffffff");
                    send_data_to_pinned_device('mode', 'hue');
                    break;
                default:
                    break;
            }
        }
        res.status(200).send("\n");
    });
    // catch-all route
    express_api.get("/*", (req, res) => {
        // res.sendFile(__dirname.split('/').slice(0, -1).join('/') + "/static/index.html");
        m.web.render_index(res);
    });
};
var api = {
    shortcut_domains_excluded: ['nestor', 'localhost', '192'],
    render_index: (res, data = {}) => {
        // console.log(data);
        var default_data = {
            title: 'Nestor',
            mobile_scale: 0.60,
            author: 'Anuv Gupta',
            site_icon: 'nestor_w.png',
            app_icon: 'nestor_app.png',
            copy_year: (new Date()).getFullYear(),
            shortcut_domains_excluded: m.web.shortcut_domains_excluded
        };
        for (var d in default_data) {
            if (default_data.hasOwnProperty(d) && !data.hasOwnProperty(d))
                data[d] = default_data[d];
        }
        // console.log(data);
        res.render('index', data);
    },
    render_shortcut: (node_shortcut_id, res) => {
        var shortcut_data = m.main.get_node_shortcut(node_shortcut_id);
        if (shortcut_data == null) {
            // res.status(404).send('Not found.');
            m.web.render_index(res);
        } else {
            // res.sendFile(__dirname.split('/').slice(0, -1).join('/') + "/static/index.html");
            var data = {};
            if (shortcut_data.hasOwnProperty('icon') && shortcut_data.icon && shortcut_data.icon != null) {
                data.app_icon = shortcut_data.icon;
                data.site_icon = shortcut_data.icon;
            }
            if (shortcut_data.hasOwnProperty('title') && shortcut_data.title && shortcut_data.title != null) {
                data.title = shortcut_data.title;
            }
            m.web.render_index(res, data);
        }
    }
};



/* EXPORT */
module.exports = {
    init: id => {
        module.exports.id = id;
        m = global.m;
        log = m.utils.logger(id, false);
        err = m.utils.logger(id, true);
        log("initializing");
        http_port = global.http_port;
        express_api = express();
        express_api.set('view engine', 'ejs');
        http_server = http.Server(express_api);
        express_api.use((req, res, next) => {
            req.rawBody = '';
            req.setEncoding('utf8');
            req.on('data', (chunk) => {
                req.rawBody += chunk;
            });
            req.on('end', () => {
                next();
            });
        });
        express_api.use(express.json());
        express_api.use(express.urlencoded({ extended: true }));
        express_api.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
        express_api.use(express.static("static"));
        module.exports.api.exit = resolve => {
            log("exit");
            http_server.close(_ => {
                if (resolve) resolve();
            });
        };
        init();
        // open server
        express_api.listen(http_port, _ => {
            log("listening on", http_port);
        });
    },
    api: api
};

