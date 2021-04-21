/* MODULE – WEBSOCKET SERVER */
// http/ws websocket server

/* IMPORTS */
const ws = require("ws");

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
// websocket server custom API
var ws_server = {
    port: null,
    socket: null,
    online: false,
    clients: {}, // client sockets
    events: {}, // event handlers
    api_events: {
        node_ready: []
    },
    quiet_events: [],
    cond_quiet_events: {},
    // encode event+data to JSON
    encode_msg: (e, d) => {
        return JSON.stringify({
            event: e,
            data: d
        });
    },
    // decode event+data from JSON
    decode_msg: (m) => {
        try {
            m = JSON.parse(m);
        } catch (e) {
            log("invalid json msg", e);
            m = null;
        }
        return m;
    },
    // bind handler to client event
    bind: (event, handler, auth_req = true) => {
        ws_server.events[event] = (client, req) => {
            if (!auth_req || client.auth)
                handler(client, req);
        };
    },
    // send data to specific client
    send_to_client: (event, data, client, auth_req = true) => {
        if (!auth_req || client.auth)
            client.socket.send(ws_server.encode_msg(event, data));
    },
    // send event to device
    send_to_device: (event, data, client, auth_req = true) => {
        if (!auth_req || client.auth)
            client.socket.send(`@${event}-${data}`);
    },
    // send data to all clients in group
    send_to_group: (event, data, group, auth_req = true) => {
        for (var c_id in ws_server.clients) {
            if (
                ws_server.clients.hasOwnProperty(c_id) &&
                ws_server.clients[c_id] !== null &&
                (!auth_req || ws_server.clients[c_id].auth) &&
                ws_server.clients[c_id].type == group
            ) {
                ws_server.clients[c_id].socket.send(ws_server.encode_msg(event, data));
            }
        }
    },
    // send text to all clients in group
    send_to_device_group: (event, data, group, auth_req = true) => {
        for (var c_id in ws_server.clients) {
            if (
                ws_server.clients.hasOwnProperty(c_id) &&
                ws_server.clients[c_id] !== null &&
                (!auth_req || ws_server.clients[c_id].auth) &&
                ws_server.clients[c_id].type == group
            ) {
                ws_server.clients[c_id].socket.send(`@${event}-${data}`);
            }
        }
    },
    // send data to all clients for user
    send_to_user: (event, data, user_id, auth_req = true) => {
        for (var c_id in ws_server.clients) {
            if (
                ws_server.clients.hasOwnProperty(c_id) &&
                ws_server.clients[c_id] !== null &&
                (!auth_req || ws_server.clients[c_id].auth) &&
                ws_server.clients[c_id].o_id == user_id
            ) {
                ws_server.clients[c_id].socket.send(ws_server.encode_msg(event, data));
            }
        }
    },
    // send data to specific client
    trigger_for_client: (event, data, client, auth_req = true) => {
        if (!auth_req || client.auth)
            ws_server.events[event](client, data);
    },
    // trigger event for all authenticated clients for user
    trigger_for_user: (event, data, user_id, auth_req = true) => {
        for (var c_id in ws_server.clients) {
            if (
                ws_server.clients.hasOwnProperty(c_id) &&
                ws_server.clients[c_id] !== null &&
                (!auth_req || ws_server.clients[c_id].auth) &&
                ws_server.clients[c_id].o_id == user_id
            ) {
                ws_server.events[event](ws_server.clients[c_id], data);
            }
        }
    },
    // trigger event for all authenticated clients for user (except one)
    trigger_for_user_except: (event, data, user_id, except_client_id, auth_req = true) => {
        for (var c_id in ws_server.clients) {
            if (
                ws_server.clients.hasOwnProperty(c_id) &&
                ws_server.clients[c_id] !== null &&
                (!auth_req || ws_server.clients[c_id].auth) &&
                ws_server.clients[c_id].o_id == user_id &&
                c_id != except_client_id
            ) {
                ws_server.events[event](ws_server.clients[c_id], data);
            }
        }
    },
    // fire api events
    fire_api_events: (event_name, event_args) => {
        if (ws_server.api_events.hasOwnProperty(event_name) && ws_server.api_events[event_name]) {
            for (h in ws_server.api_events[event_name]) {
                var handler = ws_server.api_events[event_name][h];
                handler.apply(handler, event_args);
            };
        }
    },
    // bind api events
    bind_api_events: (event_name, event_handler) => {
        ws_server.api_events[event_name].push(event_handler);
    },
    // initialize server
    init: _ => {
        // attach server socket events
        ws_server.socket.on("connection", (client_socket) => {
            // create client object on new connection
            var client = {
                socket: client_socket,
                id: "_c_" + m.utils.rand_id(),
                o_id: null,
                auth: false,
                type: "app"
            };
            log(`client ${client.id} – connected`);
            // client socket event handlers
            client.socket.addEventListener("message", (m) => {
                var d = ws_server.decode_msg(m.data); // parse message
                if (d != null) {
                    // console.log('    ', d.event, d.data);
                    if (!ws_server.quiet_events.includes(d.event) &&
                        !(ws_server.cond_quiet_events.hasOwnProperty(d.event) && ws_server.cond_quiet_events[d.event](d.data))
                    ) log(`client ${client.id} – message: ${d.event}`, d.data);
                    // handle various events
                    if (ws_server.events.hasOwnProperty(d.event))
                        ws_server.events[d.event](client, d.data);
                    else err("unknown event", d.event);
                } else err(`client ${client.id} – invalid message: `, m.data);
            });
            client.socket.addEventListener("error", (e) => {
                err(`client ${client.id} – error`, e);
            });
            client.socket.addEventListener("close", (c, r) => {
                log(`client ${client.id} – disconnected`);
                delete ws_server.clients[client.id]; // remove client object on disconnect
            });
            // add client object to client object list
            ws_server.clients[client.id] = client;
        });
        ws_server.socket.on("listening", _ => {
            log("listening on", ws_server.port);
            ws_server.online = true;
        });
        ws_server.socket.on("error", (e) => {
            err("server error", e);
            ws_server.online = false;
        });
        ws_server.socket.on("close", _ => {
            log("server closed");
            ws_server.online = false;
        });
    },
    close: resolve => {
        ws_server.socket.close(_ => {
            if (resolve) resolve();
        });
    }
};

var init = _ => {
    /* bind events */

    // client: web panel
    ws_server.bind('auth', (client, req) => {
        // validate credentials
        m.db.auth(req.username, req.password, client.id, user => {
            if (user === false) return;
            else if (user === null) {
                ws_server.send_to_client("auth", false, client, false);
            } else {
                client.o_id = user._id.toString();
                client.auth = true;
                ws_server.send_to_client("auth", true, client);
                log(`auth | client ${client.id} authenticated as user ${client.o_id}`);
                var node_profiles = {};
                for (var nd in m.main.node_drivers)
                    node_profiles[nd] = m.main.node_drivers[nd].data;
                ws_server.send_to_client("node_profiles", node_profiles, client);
            }
        });
    }, false);
    ws_server.bind('new_core', (client, req) => {
        var new_code = m.utils.rand_id(5);
        var core = {
            name: new_code,
            code: new_code,
            user_id: client.o_id,
            status_time: -1,
            status: "new",
            ip: null,
            nodes: {}
        };
        m.db.new_core(core, client.id, status => {
            if (status === false || status === null) return;
            log(`new_core | client ${client.id} added new core - ${core.name}`);
            ws_server.trigger_for_user("get_core_list", null, client.o_id);
        });
    });
    ws_server.bind('get_core_list', (client, req) => {
        m.db.get_core_list(client.o_id, client.id, cores => {
            if (cores === false || cores === null) return;
            var core_list = [];
            var statuses = [];
            for (var c in cores) {
                core_list.push({
                    name: cores[c].name,
                    id: cores[c]._id.toString()
                });
                statuses.push({
                    status: cores[c].status,
                    status_time: cores[c].status_time,
                    id: cores[c]._id.toString()
                });
            }
            ws_server.send_to_client("core_list", core_list, client);
            log(`get_core_list | client ${client.id} requested core list`);
            if (req && req.status) {
                for (var s in statuses) {
                    ws_server.send_to_client("core_status", statuses[s], client);
                }
            }
        });
    });
    ws_server.bind('get_core_info', (client, req) => {
        var id = req.id.toString();
        if (!req.hasOwnProperty('get_nodes')) req.get_nodes = true;
        m.db.get_core_info(m.db.o_id(id), client.o_id, null, client.id, core => {
            if (core === false || core === null) return;
            ws_server.send_to_client("core_info", {
                name: core.name,
                code: core.code,
                id: core._id.toString()
            }, client);
            ws_server.send_to_client("core_status", {
                id: core._id.toString(),
                status: core.status,
                status_time: core.status_time
            }, client);
            log(`get_core_info | client ${client.id} requested core ${core._id.toString()} info`);
            if (core.status != "new" && req.get_nodes) {
                ws_server.send_to_client("core_nodes", {
                    id: core._id.toString(),
                    nodes: core.nodes
                }, client);
            }
        });
    });
    ws_server.bind('set_core_name', (client, req) => {
        var core_id = `${req.id}`;
        var core_name = `${req.name}`;
        m.db.get_core_info(core_id, client.o_id, null, client.id, core => {
            if (core === false || core === null) return;
            m.db.set_core_name(core_id, core_name, client.id, result1 => {
                if (result1 === false || result1 === null) return;
                log(`set_core_name | client ${client.id} setting core ${core._id.toString()} name to ${core_name}`);
                ws_server.send_to_user("core_name", {
                    name: core_name,
                    id: core._id.toString()
                }, client.o_id);
            });
        });
    });
    ws_server.bind('delete_core', (client, req) => {
        var core_id = `${req}`;
        m.db.get_core_info(core_id, client.o_id, null, client.id, core => {
            if (core === false || core === null) return;
            m.db.delete_nodes(core.nodes, client.id, result1 => {
                if (result1 === false || result1 === null) return;
                m.db.delete_core(core_id, client.o_id, client.id, result2 => {
                    if (result2 === false || result2 === null) return;
                    log(`delete_core | client ${client.id} deleted ${core_id}`);
                    ws_server.send_to_user('delete_core', core_id, core.user_id);
                    ws_server.trigger_for_user('get_core_list', null, core.user_id);
                    m.main.remove_node_shortcuts(null, node.core_id);
                });
            });
        });
    });
    ws_server.bind('get_node_info', (client, req) => {
        var node_id = `${req}`;
        m.db.get_node_info(node_id, client.o_id, client.id, node => {
            if (node === false || node === null) return;
            log(`get_node_info | client ${client.id} requested node ${node._id.toString()} info`);
            ws_server.send_to_client("node_info", {
                name: node.name,
                mac: node.mac,
                core_id: node.core_id,
                type: node.type,
                id: node._id.toString()
            }, client);
            ws_server.send_to_client("node_status", {
                id: node._id.toString(),
                status: node.status,
                status_time: node.status_time,
                core_id: node.core_id
            }, client);
        });
    });
    ws_server.bind('set_node_name', (client, req) => {
        var node_id = `${req.id}`;
        var node_name = `${req.name}`;
        m.db.get_node_info(node_id, client.o_id, client.id, node => {
            if (node === false || node === null) return;
            m.db.set_node_name(node_id, node_name, client.o_id, client.id, result1 => {
                if (result1 === false || result1 === null) return;
                log(`set_node_name | client ${client.id} setting node ${node._id.toString()} name to ${node_name}`);
                ws_server.send_to_user("node_name", {
                    name: node_name,
                    core_id: node.core_id,
                    id: node._id.toString()
                }, client.o_id);
            });
        });
    });
    ws_server.bind('delete_node', (client, req) => {
        var node_id = `${req}`;
        m.db.get_node_info(node_id, client.o_id, client.id, node => {
            if (node === null || node === false) return;
            m.db.delete_core_nodes(node.core_id, [node_id], client.o_id, client.id, result1 => {
                if (result1 === null || result1 === false) return;
                m.db.delete_nodes([node_id], client.id, result2 => {
                    if (result2 === null || result2 === false) return;
                    log(`delete_node | client ${client.id} deleted node ${node_id}`);
                    ws_server.send_to_user('delete_node', node._id.toString(), node.user_id);
                    ws_server.trigger_for_user('get_core_info', { id: node.core_id }, node.user_id);
                    m.main.remove_node_shortcuts(node._id.toString());
                });
            });
        });
    });
    ws_server.bind('get_node_data', (client, req) => {
        var node_id = `${req.id}`;
        m.db.get_node_info(node_id, client.o_id, client.id, node => {
            if (node === null || node === false) return;
            if (req.hasOwnProperty('field') && req.field) {
                var field_val = node.data[req.field];
                node.data = {};
                node.data[req.field] = field_val;
            }
            ws_server.send_to_client("node_data", {
                id: node._id.toString(),
                core_id: node.core_id,
                data: node.data
            }, client);
            log(`get_node_data | client ${client.id} requested node ${node_id} data`);
        });
    });
    ws_server.bind('update_user_data', (client, req) => {
        var client_user_id = `${client.o_id}`;
        if (req.hasOwnProperty('key') && req.hasOwnProperty('action') && req.hasOwnProperty('value') && req.hasOwnProperty('query') && req.hasOwnProperty('options')) {
            m.db.update_user_data(client_user_id, `${req.key}`, `${req.action}`, req.value, req.query, req.options, result1 => {
                if (result1 === null || result1 === false) return;
                if (req.options && req.options.hasOwnProperty('boomerang') && req.options.boomerang == true)
                    ws_server.trigger_for_user("get_user_data", { key: req.key }, client_user_id);
                else ws_server.trigger_for_user_except("get_user_data", { key: req.key }, client_user_id, client.id);
                log(`update_user_data | client ${client.id} updated user data ${req.key}`);
            });
        }
    });
    ws_server.bind('get_user_data', (client, req) => {
        var client_user_id = `${client.o_id}`;
        if (req.hasOwnProperty('key')) {
            m.db.get_user_data(client_user_id, `${req.key}`, result1 => {
                if (result1 === null || result1 === false) return;
                ws_server.send_to_client("user_data", {
                    key: `${req.key}`,
                    value: result1
                }, client);
                log(`get_user_data | client ${client.id} requested user data ${req.key}`);
            });
        }
    });
    ws_server.bind('reset_node', (client, req) => {
        var node_id = `${req.node_id}`;
        m.db.get_node_info(node_id, client.o_id, client.id, node => {
            if (node === false || node === null) return;
            var node_id_rep = node._id.toString();
            log(`reset_node | client ${client.id} requested node ${node_id_rep} reset`);
            if (node.status == 'online') {
                var core_client = m.ws.get_client_by_o_id(node.core_id);
                if (core_client) {
                    ws_server.send_to_device('node-reset', `${node_id_rep}`, core_client);
                }
            }
        });
    });
    ws_server.bind('reset_core', (client, req) => {
        var core_id = `${req.core_id}`;
        m.db.get_core_info(core_id, client.o_id, null, client.id, core => {
            if (core === false || core === null) return;
            var core_id_rep = core._id.toString();
            log(`reset_core | client ${client.id} requested core ${core_id_rep} reset`);
            if (core.status == 'online') {
                var core_client = m.ws.get_client_by_o_id(core_id_rep);
                if (core_client) {
                    ws_server.send_to_device('core-reset', 'true', core_client);
                }
            }
        });
    });
    ws_server.bind('get_shortcut', (client, req) => {
        var shortcut_url = `${req.url}`;
        var shortcut_data = m.main.get_node_shortcut(shortcut_url);
        if (shortcut_data != null) {
            shortcut_data.url = shortcut_url;
            ws_server.send_to_client('get_shortcut', shortcut_data, client);
        }
    });

    // client: device
    ws_server.bind('core_sync', (client, req) => {
        m.db.get_core_info(req.id, null, req.code, client.id, core => {
            if (core === false) return;
            else if (core === null) ws_server.send_to_device('sync', 'f', client);
            else {
                m.db.get_user_info(core.user_id, req.user, client.id, user => {
                    if (user === false) return;
                    else if (user === null) ws_server.send_to_device('sync', 'f', client);
                    else {
                        var name = core.name == core.code ? "C-" + (req.mac.slice(req.mac.length - 5)) : core.name;
                        m.db.set_core_name(req.id, name, client.id, result1 => {
                            if (result1 === false || result1 === null) return;
                            m.db.set_core_network(req.id, req.ip, req.mac, client.id, result2 => {
                                if (result2 === false || result2 === null) return;
                                m.db.set_core_status(req.id, "online", (new Date()).getTime(), client.id, result3 => {
                                    if (result3 === false || result3 === null) return;
                                    client.o_id = core._id.toString();
                                    client.auth = true;
                                    client.type = "core";
                                    ws_server.send_to_device('sync', 't', client);
                                    log(`core_sync | client ${client.id} synced as core ${client.o_id}`);
                                    ws_server.trigger_for_user("get_core_info", { id: client.o_id }, core.user_id);
                                    var count = 0;
                                    for (var n in core.nodes) {
                                        if (core.nodes.hasOwnProperty(n) && core.nodes[n]) {
                                            for (var cl in ws_server.clients) {
                                                if (
                                                    ws_server.clients.hasOwnProperty(cl) && ws_server.clients[cl] &&
                                                    ws_server.clients[cl].type == "node" && ws_server.clients[cl].o_id == core.nodes[n] &&
                                                    ws_server.clients[cl].auth
                                                ) {
                                                    ws_server.send_to_device("info", `${req.ip}-${core.nodes[n]}`, ws_server.clients[cl]);
                                                    count++;
                                                }
                                            }
                                        }
                                    }
                                    log(`core_sync | client ${client.id} forwarded info to ${count} nodes of core ${client.o_id}`);
                                });
                            });
                        });
                    }
                });
            }
        });
    }, false);
    ws_server.bind('core_hb', (client, req) => {
        m.db.get_core_info(client.o_id, null, null, client.id, core => {
            if (core === false || core === null) return;
            // log(`core_hb | client ${client.id} - core ${client.o_id} heartbeat`);
            var now = (new Date()).getTime();
            m.db.set_core_status(client.o_id, "online", now, client.id, result1 => {
                if (result1 === false || result1 === null) return;
                if (core.status != "online") {
                    ws_server.send_to_user("core_status", {
                        id: core._id.toString(),
                        status: "online",
                        status_time: now
                    }, core.user_id);
                }
            });
        });
    });
    ws_server.quiet_events.push('core_hb');
    ws_server.bind('node_hb', (client, req) => {
        m.db.get_core_info(client.o_id, null, null, client.id, core => {
            if (core === null || core === false) return;
            var node_mdb_id = req.id;
            if (node_mdb_id) {
                node_mdb_id = `${node_mdb_id}`;
                m.db.get_node_info(node_mdb_id, null, client.id, node => {
                    if (node === false) return;
                    else if (node === null)
                        ws_server.send_to_device("node-hb", `${node_mdb_id}-404`, client);
                    else {
                        // log(`node_hb | client ${client.id} - node ${node_mdb_id} heartbeat`);
                        var now = (new Date()).getTime();
                        m.db.set_node_status(node_mdb_id, "online", now, client.id, result => {
                            if (result === null || result === false) return;
                            if (node.status != "online") {
                                // node just connected
                                var node_id = node._id.toString();
                                ws_server.send_to_user("node_status", {
                                    id: node_id,
                                    core_id: node.core_id,
                                    status: "online",
                                    status_time: now
                                }, node.user_id);
                                var core_client = m.ws.get_client_by_o_id(node.core_id);
                                if (core_client) {
                                    var reset_interval = m.main.get_driver_reset_interval(node.type);
                                    if (reset_interval > 0) {
                                        var reset_interval_str = m.utils.lpad(`${reset_interval}`, 2, '0');
                                        setTimeout(_ => {
                                            ws_server.send_to_device('node-reset_i', `${node_id}-${reset_interval_str}`, core_client);
                                        }, 300);
                                    }
                                }
                                if (m.main.node_drivers.hasOwnProperty(node.type) && m.main.node_drivers[node.type].api.hasOwnProperty('__spawn')) {
                                    m.main.node_drivers[node.type].api.__spawn(m, log, node);
                                }
                                var initial_vals = m.main.get_init_driver_vals(node.type, node_mdb_id);
                                for (var field_i in initial_vals) {
                                    if (initial_vals.hasOwnProperty(field_i)) {
                                        ws_server.trigger_for_user('update_node_data', {
                                            id: node_id,
                                            transitional: false,
                                            field_id: field_i,
                                            field_val: node.data[field_i] == undefined ? initial_vals[field_i] : node.data[field_i]
                                        }, node.user_id);
                                    }
                                }
                                setTimeout(_ => {
                                    node.status = "online";
                                    node.status_time = now;
                                    ws_server.fire_api_events('node_ready', [node_id, node]);
                                }, 100);
                            }
                        });
                    }
                });
            }
        });
    });
    ws_server.quiet_events.push('node_hb');
    ws_server.bind('node_sync', (client, req) => {
        m.db.get_core_info(null, null, `${req.core_code}`, client.id, core => {
            if (core === false) return;
            else if (core === null)
                ws_server.send_to_device('sync', 'f', client);
            else {
                m.db.get_user_info(m.db.o_id(core.user_id), `${req.user}`, client.id, user => {
                    if (user === false) return;
                    else if (user === null)
                        ws_server.send_to_device('sync', 'f', client);
                    else {
                        var node_type = m.main.get_node_type(`${req.node_type}`);
                        if (core.nodes.hasOwnProperty(req.mac) && core.nodes[req.mac]) {
                            var node_id = core.nodes[req.mac];
                            ws_server.send_to_device('sync', `t`, client);
                            client.o_id = node_id;
                            client.type = "node";
                            client.auth = true;
                            log(`node_sync | client ${client.id} synced as node ${client.o_id}`);
                            m.main.init_node_driver(node_id, node_type);
                            if (core.status == "online") {
                                m.utils.delay(_ => {
                                    ws_server.send_to_device("info", `${core.ip}-${client.o_id}`, client);
                                    log(`node_sync | client ${client.id} – info forwarded to node ${client.o_id}`);
                                }, 300);
                            }
                        } else {
                            var node_data = m.main.init_driver_values(node_type);
                            var node = {
                                name: "N-" + (req.mac.slice(req.mac.length - 5)),
                                core_id: core._id.toString(),
                                core_code: core.code,
                                mac: req.mac,
                                user_id: core.user_id,
                                status_time: -1,
                                status: "new",
                                type: node_type,
                                data: node_data
                            };
                            m.db.new_node(node, client.id, status1 => {
                                if (status1 === null || status1 === false) return;
                                var node_id = status1.insertedId.toString();
                                m.db.new_core_node(node.core_id, node_id, node.mac, client.id, status2 => {
                                    if (status2 === null || status2 === false) return;
                                    ws_server.send_to_device('sync', `t`, client);
                                    log(`node_sync | client ${client.id} added new node - ${node.name}`);
                                    client.o_id = node_id;
                                    client.type = "node";
                                    client.auth = true;
                                    log(`node_sync | client ${client.id} synced as node ${client.o_id}`);
                                    m.main.init_node_driver(node_id, node_type);
                                    ws_server.trigger_for_user('get_core_info', {
                                        id: node.core_id,
                                        get_nodes: true
                                    }, node.user_id);
                                    if (core.status == "online") {
                                        m.utils.delay(_ => {
                                            ws_server.send_to_device("info", `${core.ip}-${client.o_id}`, client);
                                            log(`node_sync | client ${client.id} - info forwarded to node ${client.o_id}`);
                                        }, 300);
                                    }
                                });
                            });
                        }
                    }
                });
            }

        });
    }, false);

    // client: any
    ws_server.bind('update_node_data', (client, req) => {
        var node_id = `${req.id}`;
        m.db.get_node_info(node_id, null, client.id, node => {
            if (node === false || node === null) return;
            var field_type = m.main.get_driver_field_type(node.type, req.field_id);
            var transitional_val = req.hasOwnProperty('transitional') && req.transitional === true;
            var transitional_text = transitional_val ? 'true' : 'false';
            req.field_val = m.utils.correct_type(req.field_val, field_type);
            var _send = _ => {
                for (var c_id in ws_server.clients) {
                    if (
                        ws_server.clients.hasOwnProperty(c_id) &&
                        ws_server.clients[c_id] !== null &&
                        ws_server.clients[c_id].auth &&
                        ws_server.clients[c_id].type == "core" &&
                        ws_server.clients[c_id].o_id == node.core_id
                    ) {
                        ws_server.clients[c_id].socket.send(`@node-data-${node._id.toString()}-${req.field_id}-${transitional_text}-${req.field_val}`);
                    }
                }
            };
            var _save = _ => {
                req.field_val = m.utils.correct_type(req.field_val, field_type);
                m.db.set_node_data(node_id, req.field_id, req.field_val, client.id, result => {
                    if (result === false || result === null) return;
                    log(`update_node_data | client ${client.id} updated node ${node_id} data`);
                    if (req.hasOwnProperty('boomerang') && req.boomerang == true)
                        ws_server.trigger_for_user("get_node_data", { id: node_id, field: req.field_id }, node.user_id);
                    else ws_server.trigger_for_user_except("get_node_data", { id: node_id, field: req.field_id }, node.user_id, client.id);
                    m.db.get_core_info(node.core_id, node.user_id, null, client.id, core => {
                        if (core === false || core === null) return;
                        if (core.status == "online") _send();
                    });
                });
            };
            var _next = _ => {
                if (transitional_val)
                    _send();
                else _save();
            };
            if (!
                (m.main.call_driver(node.type, node_id, node, req.field_id, req.field_val, transitional_val, client, value => {
                    if (value != undefined)
                        req.field_val = value;
                    _next();
                }))
            ) _next();
        });
    });
    ws_server.cond_quiet_events['update_node_data'] = (data => (data.hasOwnProperty('transitional') && data.transitional == true));
    ws_server.bind('trigger_node_api', (client, req) => {
        var client_user_id = `${client.o_id}`;
        if (req.hasOwnProperty('node_type') && req.hasOwnProperty('api_req') && req.hasOwnProperty('api_args')) {
            req.api_args.user_id = client_user_id;
            req.node_type = req.node_type.split('|').join('-');
            m.main.call_driver_api(req.node_type, req.api_req, req.api_args, result1 => {
                if (result1 === null || result1 === false) return;
                log(`trigger_node_api | client ${client.id} triggered node api ${req.node_type}.${req.api_req}`);
            });
        }
    });
};
var api = {
    trigger_user_data_update: (user_id, data_key) => {
        ws_server.trigger_for_user('get_user_data', {
            key: data_key
        }, user_id);
    },
    broadcast_core_hb: _ => {
        ws_server.send_to_device_group("hb", "", "core");
    },
    send_to_device: (event, data, client, auth_req = true) => {
        ws_server.send_to_device(event, data, client, auth_req);
    },
    get_client_by_o_id: o_id => {
        for (var c_id in ws_server.clients) {
            if (ws_server.clients.hasOwnProperty(c_id) && ws_server.clients[c_id].o_id === o_id) {
                return ws_server.clients[c_id];
            }
        }
        return null;
    },
    update_core_status: (core_id, status, status_time, user_id) => {
        ws_server.send_to_user("core_status", {
            id: core_id,
            status: status,
            status_time: status_time
        }, user_id);
        if (status === "offline") {
            for (var cl in ws_server.clients) {
                if (ws_server.clients.hasOwnProperty(cl) && ws_server.clients[cl].o_id && ws_server.clients[cl].o_id.toString() == core_id) {
                    ws_server.clients[cl].socket.close();
                    delete ws_server.clients[cl];
                }
            }
        }
    },
    update_node_status: (node_id, status, status_time, core_id, user_id) => {
        ws_server.send_to_user("node_status", {
            id: node_id,
            core_id: core_id,
            status: status,
            status_time: status_time
        }, user_id);
        if (status === "offline") {
            for (var cl in ws_server.clients) {
                if (ws_server.clients.hasOwnProperty(cl) && ws_server.clients[cl].o_id && ws_server.clients[cl].o_id.toString() == node_id) {
                    ws_server.clients[cl].socket.close();
                    delete ws_server.clients[cl];
                }
            }
        }
    },
    api_bind: (event, handler) => {
        if (event && handler)
            ws_server.bind_api_events(event, handler);
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
        ws_server.port = global.ws_port;
        ws_server.socket = new ws.Server({
            port: ws_port
        });
        module.exports.api.exit = resolve => {
            log("exit");
            ws_server.close(_ => {
                if (resolve) resolve();
            });
        };
        // open server
        ws_server.init();
        init();
    },
    api: api
};

