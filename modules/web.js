/* MODULE – WEB SERVER */
// http web server

/* IMPORTS */
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
};
var api = {

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
        http_server = http.Server(express_api);
        express_api.use(body_parser.json());
        express_api.use(body_parser.urlencoded({ extended: true }));
        express_api.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
        express_api.use(express.static("html"));
        express_api.get("/", (req, res) => {
            res.sendFile(__dirname + "/html/index.html");
        });
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
