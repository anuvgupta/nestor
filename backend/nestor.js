/* NESTOR */
// main server

/* IMPORTS */
// import built-in & npm modules
const fs = require("fs");
const ejs = require('ejs');
const path = require("path");
const http = require("http");
const mqtt = require("mqtt");
const express = require("express");
const mongodb = require('mongodb');
const rn = require('random-number');
const readline = require("readline");
const array_move = require("array-move");
const body_parser = require("body-parser");

/* ENVIRONMENT */
// set up environment
global.args = process.argv.slice(2);
global.env = process.argv.slice(2)[0] == "prod" ? "prod" : "dev";
global.app_id = "nestor_cloud";
global.mqtt_broker_url = `mqtt.anuv.me:${1883}`;
global.http_port = global.env == "dev" ? 30008 : 3008;
global.ws_port = global.env == "dev" ? 30009 : 3009;
global.mdb_port = global.env == "dev" ? 27017 : 27017;
global.mdb_db = "nestor";
global.hb_log = false; // = false;

/* MODULES */
// import application modules
global.m = {};
const modules = {};
fs.readdirSync(path.join(__dirname, "modules")).forEach(module_id => {
    if (module_id[0] != '.' && module_id[0] != '_') {
        module_id = module_id.slice(0, module_id.length - 3);
        modules[module_id] = require(`./modules/${module_id}.js`);
        if (modules[module_id].hasOwnProperty('api') && modules[module_id].api &&
            typeof modules[module_id].api === 'object' && modules[module_id].api !== null) {
            if (module_id == "utils") modules[module_id]._enable_api();
            global.m[module_id] = modules[module_id].api;
        }
    }
});


/* MAIN */
console.log("nestor");
modules.utils.init("utils");
for (var module_id in modules) {
    if (modules[module_id].hasOwnProperty('init') && modules[module_id].init &&
        typeof modules[module_id].init === 'function' && module_id != "utils")
        modules[module_id].init(module_id);
}
process.on('exit', _ => {
    console.log('[process] exit');
});
process.on('SIGINT', _ => {
    console.log('[process] interrupt');
    modules.main.api.exit();
});
process.on('SIGUSR1', _ => {
    console.log('[process] restart 1');
    modules.main.api.exit();
});
process.on('SIGUSR2', _ => {
    console.log('[process] restart 2');
    modules.main.api.exit();
});
modules.utils.delay(modules.main.main, 500);