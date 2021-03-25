/* NESTOR */
// web client

var app; app = {
    ui: {
        block: Block('div', 'app'),
        transition_fade_duration: 0.145, // 0.155
        init: (callback) => {
            app.ui.block.fill(document.body);
            Block.queries();
            setTimeout(_ => {
                app.ui.block.css('opacity', '1');
            }, 100);
            setTimeout(_ => {
                Block.queries();
                setTimeout(_ => {
                    Block.queries();
                }, 200);
            }, 50);
            callback();
        },
        load_core_menu: (node_block, core_info) => {
            node_block.child('menu/code').data({ val: core_info.code });
            node_block.child('menu/id').data({ val: core_info.id });
        },
        load_view: (blockfile_path, resolve = null, path_extension = true) => {
            var views_block = Block('div', 'views');
            views_block.load(_ => {
                views_block.on('initialize', {
                    submenu: app.ui.block.child('main/node/menu/submenu'),
                    resolve: resolve
                });
            }, (path_extension ? blockfile_path.substring(0, blockfile_path.length - 6) : blockfile_path), 'jQuery');
        },
        submenu_exit_handlers: [],
        submenu_exit: (e, b, d) => {
            for (var s in app.ui.submenu_exit_handlers) {
                app.ui.submenu_exit_handlers[s](e, b, d);
            }
        },
        submenu_pre_exit_handlers: [],
        submenu_pre_exit: (e, b, d) => {
            for (var s in app.ui.submenu_pre_exit_handlers) {
                app.ui.submenu_pre_exit_handlers[s](e, b, d);
            }
        }
    },
    ws: {
        id: 0,
        socket: null,
        url:
            (location.protocol === 'https:'
                ? 'wss://'
                : 'ws://') +
            document.domain +
            ((document.domain == 'localhost' || document.domain.includes('192.168.0.')) ? ':30009' : (location.protocol === 'https:' ? ':443' : ':80')) +
            '/socket',
        encode_msg: (e, d) => {
            return JSON.stringify({
                event: e,
                data: d
            });
        },
        decode_msg: (m) => {
            try {
                m = JSON.parse(m);
            } catch (e) {
                console.log('[ws] invalid json ', e);
                m = null;
            }
            return m;
        },
        connect: callback => {
            var socket = new WebSocket(app.ws.url);
            socket.addEventListener('open', e => {
                console.log('[ws] socket connected');
                callback();
            });
            socket.addEventListener('error', e => {
                console.log('[ws] socket error ', e.data);
            });
            socket.addEventListener('message', e => {
                var d = app.ws.decode_msg(e.data);
                if (d != null) {
                    console.log('[ws] socket received:', d.event, d.data);
                    var data = {};
                    data[d.event] = d.data;
                    app.ui.block.data(data);
                } else {
                    console.log('[ws] socket received:', 'invalid message', e.data);
                }
            });
            socket.addEventListener('close', e => {
                console.log('[ws] socket disconnected');
                // alert('disconnected from server');
            });
            window.addEventListener('beforeunload', e => {
                // socket.close(1001);
            });
            app.ws.socket = socket;
        },
        send: (event, data) => {
            console.log('[ws] sending:', event, data);
            app.ws.socket.send(app.ws.encode_msg(event, data));
        },
        api: {
            transitional_update_interval: 0.09,
            auth: null,
            login: (user, pass) => {
                app.ws.api.auth = { username: user, password: pass };
                app.ws.send('auth', app.ws.api.auth);
            },
            logout: _ => {
                util.delete_cookie('username');
                util.delete_cookie('password');
                window.location.href = String(window.location.href);
            },
            update_node_status_interval: 5,
            user_data_handlers: {},
            node_profiles: {
                core: {
                    node: {
                        img: 'memory_b',
                        label: 'Nestor Core'
                    },
                    data: [
                        {
                            "id": "code",
                            "img": "key_b",
                            "type": "string",
                            "initial": "code",
                            "editor": "text-display",
                            "label": "Code"
                        },
                        {
                            "id": "id",
                            "img": "fingerprint_b",
                            "type": "string",
                            "initial": "identity",
                            "editor": "text-display",
                            "label": "ID"
                        }
                    ]
                }
            },
            get_node_field_meta: (node_type, field_id) => {
                if (app.ws.api.node_profiles.hasOwnProperty(node_type)) {
                    var node_profile = app.ws.api.node_profiles[node_type];
                    for (var i in node_profile.data) {
                        if (node_profile.data[i].id == field_id) {
                            return node_profile.data[i];
                        }
                    }
                }
                return null;
            },
            new_core: _ => {
                app.ws.send('new_core', null);
            },
            get_core_list: status => {
                app.ws.send('get_core_list', { status: status });
            },
            get_core_info: (id, get_nodes = true) => {
                app.ws.send('get_core_info', {
                    id: id, get_nodes: get_nodes
                });
            },
            get_node_info: id => {
                app.ws.send('get_node_info', id);
            },
            set_core_name: (id, name) => {
                app.ws.send('set_core_name', {
                    id: id,
                    name: name
                });
            },
            set_node_name: (id, name) => {
                app.ws.send('set_node_name', {
                    id: id,
                    name: name
                });
            },
            delete_core: (id, name) => {
                if (true == confirm(`Confirm—delete core "${name}" and its nodes?`))
                    app.ws.send('delete_core', id);
            },
            delete_node: (id, name) => {
                if (true == confirm(`Confirm—delete node "${name}"?`))
                    app.ws.send('delete_node', id);
            },
            get_node_data: (id, field_id) => {
                app.ws.send('get_node_data', {
                    id: id, field: field_id
                });
            },
            update_node_data: (id, field_id, field_val, transitional = false, boomerang = false) => {
                app.ws.send('update_node_data', {
                    id: id,
                    field_id: field_id,
                    field_val: field_val,
                    transitional: transitional,
                    boomerang: boomerang
                });
            },
            update_user_data: (key, action, value, query = null, options = null) => {
                app.ws.send('update_user_data', {
                    key: key,
                    action: action,
                    value: value,
                    query: query,
                    options: options
                });
            },
            get_user_data: (key) => {
                app.ws.send('get_user_data', {
                    key: key
                });
            },
            trigger_node_api: (node_type, api_req, api_args) => {
                app.ws.send('trigger_node_api', {
                    node_type: node_type,
                    api_req: api_req,
                    api_args: api_args
                });
            },
            reset_node: (id) => {
                app.ws.send('reset_node', {
                    node_id: id
                });
            },
            reset_core: (id) => {
                app.ws.send('reset_core', {
                    core_id: id
                });
            }
        }
    },
    main: {
        api: {
            module: (module, node_type = null) => {
                if (node_type === null)
                    app.main.last_loaded_client_module = module;
                else app.main.client_modules[node_type] = module;
            },
        },
        update_node_profiles: (node_profiles, load_client_driver = true) => {
            for (var np in node_profiles) {
                node_profiles[np].id = np;
                app.ws.api.node_profiles[np] = node_profiles[np];
            }
            if (load_client_driver) {
                app.main.load_client_driver();
                setTimeout(_ => {
                    Block.queries();
                }, 20);
            }
        },
        load_client_driver: _ => {
            var node_profiles = app.ws.api.node_profiles;
            for (var np in node_profiles) {
                if (node_profiles[np] && node_profiles[np].hasOwnProperty('web')) {
                    if (node_profiles[np].web.hasOwnProperty('views') && node_profiles[np].web.views === true) {
                        app.main.load_client_view(`${np}`);
                    }
                    if (node_profiles[np].web.hasOwnProperty('client') && node_profiles[np].web.client === true) {
                        app.main.load_client_module(`${np}`);
                    }
                }
            }
        },
        client_modules: {},
        last_loaded_client_module: null,
        init_client_module: (node_type, resolve = null) => {
            if (app.main.client_modules.hasOwnProperty(node_type)) {
                var client_module = app.main.client_modules[node_type];
                if (client_module.hasOwnProperty('init') && client_module.hasOwnProperty('export')) {
                    var exports = client_module.export();
                    client_module.init(exports, _ => {
                        if (resolve) resolve();
                    });
                }
            }
        },
        load_client_module: (node_type, resolve = null) => {
            util.load_script(`nodes/${node_type}/client.js`, _ => {
                app.main.api.module(app.main.last_loaded_client_module, node_type);
                app.main.init_client_module(node_type, _ => {
                    console.log(`[main] client module "${node_type}" script initialized`);
                    if (resolve) resolve();
                });
            });
        },
        load_client_view: (node_type, resolve = null) => {
            app.ui.load_view(`nodes/${node_type}/views.block`, _ => {
                console.log(`[main] client module "${node_type}" views initialized`);
                if (resolve) resolve();
            });
        },
        login: _ => {
            if (util.cookie('username') != null && util.cookie('password') != null) {
                app.ws.api._temp_prelogin = true;
                app.ws.api.login(util.cookie('username'), util.cookie('password'));
            }
        },
        init: _ => {
            console.clear();
            console.log('[main] loading...');
            window.nestor = app.main.api;
            setTimeout(_ => {
                app.ui.block.load(_ => {
                    app.ui.block.load(_ => {
                        console.log('[main] blocks loaded');
                        console.log('[main] socket connecting');
                        app.ws.connect(_ => {
                            app.ui.init(_ => {
                                console.log('[main] ready');
                                app.main.login();
                                // if (util.mobile()) alert('mobile');
                            });
                        });
                    }, 'app', 'jQuery');
                }, 'blocks', 'jQuery');
            }, 300);
        }
    }
};

$(document).ready(app.main.init);