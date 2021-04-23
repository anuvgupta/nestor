/* MODULE – WEB SERVER */
// http web server

/* IMPORTS */
const ejs = require('ejs');
const http = require("http");
const express = require("express");
const body_parser = require("body-parser");

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
    express_api.get("/nodes/:node_type/client.js", (req, res) => {
        var node_type = req.params.node_type;
        if (m.main.node_drivers.hasOwnProperty(node_type) && m.main.node_drivers[node_type].data && m.main.node_drivers[node_type].data.hasOwnProperty('web') && m.main.node_drivers[node_type].data.web.hasOwnProperty('client')) {
            if (m.main.node_drivers[node_type].data.web.client === true) {
                res.sendFile(`${m.utils.remove_last_dir(__dirname)}/nodes/${node_type}/client.js`);
            }
        }
    });
    express_api.get("/nodes/:node_type/views.block", (req, res) => {
        var node_type = req.params.node_type;
        if (m.main.node_drivers.hasOwnProperty(node_type) && m.main.node_drivers[node_type].data && m.main.node_drivers[node_type].data.hasOwnProperty('web') && m.main.node_drivers[node_type].data.web.hasOwnProperty('views')) {
            if (m.main.node_drivers[node_type].data.web.views === true) {
                res.sendFile(`${m.utils.remove_last_dir(__dirname)}/nodes/${node_type}/views.block`);
            }
        }
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
            mobile_scale: 0.65,
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
        express_api.use(body_parser.json());
        express_api.use(body_parser.urlencoded({ extended: true }));
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

