/* MODULE – MAIN */
// main application logic

/* IMPORTS */
const fs = require("fs");
const path = require("path");
const utils = require("./utils");

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
var init = _ => { };
var main = _ => {
    m.main.load_node_drivers();
    m.utils.delay(_ => {
        m.main.device_monitor();
    }, 1000);
};
var api = {
    node_drivers: {},
    load_node_drivers: _ => {
        fs.readdirSync(path.join(__dirname, "../nodes")).forEach(type_id => {
            if (type_id[0] != '.' && type_id[0] != '_') {
                var module_driver_def = require(`../nodes/${type_id}/driver.js`);
                var meta_data = JSON.parse(fs.readFileSync(`nodes/${type_id}/meta.json`, { encoding: 'utf8', flag: 'r' }));
                if (!meta_data) meta_data = {};
                meta_data.web = {
                    client: fs.existsSync(`nodes/${type_id}/client.js`),
                    views: fs.existsSync(`nodes/${type_id}/views.block`)
                };
                m.main.node_drivers[type_id] = {
                    init: module_driver_def.init ? module_driver_def.init : null,
                    api: module_driver_def.api ? module_driver_def.api : null,
                    data: meta_data,
                    drivers: {}
                };
            }
        });
    },
    device_desync_timeout: 3,
    device_disconnect_timeout: 8,
    device_monitor_interval: 1,
    device_monitor: _ => {
        m.ws.broadcast_core_hb();
        m.db.get_online_cores(cores => {
            if (cores === null || cores === false) return;
            var modify_disconnect_core_ids = [];
            var modify_desync_core_ids = [];
            for (var core in cores) {
                var delta = (new Date()).getTime() - cores[core].status_time;
                if (delta >= m.main.device_disconnect_timeout * 1000) {
                    modify_disconnect_core_ids.push(cores[core]._id);
                    m.ws.update_core_status(cores[core]._id.toString(), "offline", cores[core].status_time, cores[core].user_id);
                } else if (delta >= m.main.device_desync_timeout * 1000) {
                    if (cores[core].status != "desync") {
                        modify_desync_core_ids.push(cores[core]._id);
                        m.ws.update_core_status(cores[core]._id.toString(), "desync", cores[core].status_time, cores[core].user_id);
                    }
                }
            }
            m.db.update_core_status(modify_desync_core_ids, "desync");
            m.db.update_core_status(modify_disconnect_core_ids, "offline");
        });
        m.db.get_online_nodes(nodes => {
            if (nodes === null || nodes === false) return;
            var modify_disconnect_node_ids = [];
            var modify_desync_node_ids = [];
            for (var node in nodes) {
                var delta = (new Date()).getTime() - nodes[node].status_time;
                if (delta >= m.main.device_disconnect_timeout * 1000) {
                    modify_disconnect_node_ids.push(nodes[node]._id);
                    m.ws.update_node_status(nodes[node]._id.toString(), "offline", nodes[node].status_time, nodes[node].core_id, nodes[node].user_id);
                } else if (delta >= m.main.device_desync_timeout * 1000) {
                    if (nodes[node].status != "desync") {
                        modify_desync_node_ids.push(nodes[node]._id);
                        m.ws.update_node_status(nodes[node]._id.toString(), "desync", nodes[node].status_time, nodes[node].core_id, nodes[node].user_id);
                    }
                }
            }
            m.db.update_node_status(modify_desync_node_ids, "desync");
            m.db.update_node_status(modify_disconnect_node_ids, "offline");
        });
        m.utils.delay(_ => {
            m.main.device_monitor();
        }, m.main.device_monitor_interval * 1000);
    },
    get_node_type: type => {
        return (m.main.node_drivers.hasOwnProperty(type) && m.main.node_drivers[type] ? type : 'node');
    },
    init_node_driver: (node_id, type) => {
        m.main.node_drivers[type].drivers[node_id] = m.main.node_drivers[type].init(m, log);
    },
    init_driver_values: (type) => {
        var node_data = {};
        for (var v in m.main.node_drivers[type].data.data) {
            var value_profile = m.main.node_drivers[type].data.data[v];
            node_data[value_profile.id] = value_profile.initial;
        }
        return node_data;
    },
    get_init_driver_vals: (node_type, node_id) => {
        var initial_vals = {};
        // if (m.main.node_drivers[node_type].drivers.hasOwnProperty(node_id)) {
        //     for (var d in m.main.node_drivers[node_type].drivers[node_id]) {
        //         for (var f in m.main.node_drivers[node_type].data.data) {
        //             if (m.main.node_drivers[node_type].data.data[f].id == d) {
        //                 initial_vals[d] = m.main.node_drivers[node_type].data.data[f].initial;
        //                 break;
        //             }
        //         }
        //     }
        // }
        for (var v in m.main.node_drivers[node_type].data.data) {
            var value_profile = m.main.node_drivers[node_type].data.data[v];
            initial_vals[value_profile.id] = value_profile.initial;
        }
        return initial_vals;
    },
    get_driver_field_type: (node_type, field_type) => {
        for (var f in m.main.node_drivers[node_type].data.data) {
            if (m.main.node_drivers[node_type].data.data[f].id == field_type) {
                return m.main.node_drivers[node_type].data.data[f].type;
            }
        }
    },
    call_driver: (node_type, node_id, node_data, field_id, field_val, transitional_val, ws_client, resolve) => {
        if (m.main.node_drivers[node_type].drivers.hasOwnProperty(node_id) && m.main.node_drivers[node_type].drivers[node_id] &&
            m.main.node_drivers[node_type].drivers[node_id].hasOwnProperty(field_id) && m.main.node_drivers[node_type].drivers[node_id][field_id]) {
            m.main.node_drivers[node_type].drivers[node_id][field_id](node_data, ws_client, field_val, transitional_val, resolve);
            return true;
        }
        return false;
    },
    call_driver_api: (node_type, api_req, api_args, resolve) => {
        if (m.main.node_drivers.hasOwnProperty(node_type)) {
            if (m.main.node_drivers[node_type].hasOwnProperty('api') && m.main.node_drivers[node_type].api.hasOwnProperty(api_req)) {
                m.main.node_drivers[node_type].api[api_req](m, log, api_args, resolve);
            }
        }
    }
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
        module.exports.api.exit = (e = 0) => {
            m.main.unload(_ => {
                log('exit');
                process.exit(e);
            });
        };
        module.exports.api.unload = resolve => {
            log("unload");
            m.ws.exit(_ => {
                m.web.exit(_ => {
                    if (resolve) resolve();
                });
            });
        };
        init();
    },
    main: _ => {
        log("ready");
        main();
    },
    api: api
};
