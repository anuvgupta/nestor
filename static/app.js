/* NESTOR */
// web client

var app; app = {
    ui: {
        block: Block('div', 'app'),
        transition_fade_duration: 0.145, // 0.155
        login_mobile_scale: 0.37,
        init: (callback) => {
            $(window).on("orientationchange", (event) => {
                Block.queries();
                setTimeout(_ => {
                    Block.queries();
                }, 100);
            });
            app.ui.block.fill(document.body);
            Block.queries();
            if (app.main.shortcut_exists()) {
                app.ui.block.child('loading').on('show');
                app.ui.block.css('transition', 'none');
            }
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
        load_main_views: resolve => {
            console.log('[ui] blocks loading');
            app.ui.block.load(_ => {
                app.ui.block.load(_ => {
                    app.ui.block.load(_ => {
                        console.log('[ui] blocks loaded');
                        if (resolve) resolve();
                    }, '/views/app', 'jQuery');
                }, '/views/views', 'jQuery');
            }, '/views/blocks', 'jQuery');
        },
        load_client_view: (blockfile_path, resolve = null, path_extension = true) => {
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
        url: null,
        online: false,
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
            if (app.ws.url === null || app.ws.url.trim() === '') {
                if (callback) callback();
                return;
            }
            var socket = new WebSocket(app.ws.url);
            socket.addEventListener('open', e => {
                console.log('[ws] socket connected');
                app.ws.online = true;
                if (callback) callback();
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
                app.ws.online = false;
                // alert('disconnected from server');
                app.main.quit();
            });
            window.addEventListener('beforeunload', e => {
                // socket.close(1001);
            });
            app.ws.socket = socket;
        },
        send: (event, data) => {
            console.log('[ws] socket sending:', event, data);
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
                if (window.location.href.slice(0, -1) == window.location.origin) {
                    app.main.reload();
                } else if (window.location.search.includes('logout=true')) {
                    window.location = String(window.location.origin);
                } else {
                    window.location = String(window.location.origin) + "/?logout=true";
                }
            },
            update_node_status_interval: 2,
            user_data_handlers: {},
            node_profiles: {
                core: {
                    id: "core",
                    node: {
                        img: "memory_b",
                        label: "Smart Core"
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
            get_node_profile_env: (node_type) => {
                if (node_type != null && node_type && app.ws.api.node_profiles.hasOwnProperty(`${node_type}`)) {
                    var node_profile = app.ws.api.node_profiles[node_type];
                    if (node_profile != null && node_profile && node_profile.hasOwnProperty('env') && node_profile.env) {
                        return node_profile.env;
                    }
                }
                return null;
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
            },
            get_shortcut: (url) => {
                app.ws.send('get_shortcut', {
                    url: url
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
        shortcut_exists: _ => {
            var path = window.location.pathname;
            if (path == "" || path == "/") return false;
            path_arr = path.split("/");
            if (path_arr.length >= 1 && path_arr[0] == "") {
                if (path_arr.length >= 2 && path_arr[1] == "n") {
                    return true;
                }
            }
            return false;
        },
        process_shortcuts: _ => {
            var path = window.location.pathname;
            if (path == "" || path == "/") return;
            path_arr = path.split("/");
            if (path_arr.length >= 1 && path_arr[0] == "") {
                if (path_arr.length >= 2 && path_arr[1] == "n") {
                    if (path_arr.length >= 3 && path_arr[2] != "") {
                        app.main.get_shortcut(path_arr[2]);
                    }
                }
            }
        },
        get_shortcut: (shortcut) => {
            app.ws.api.get_shortcut(shortcut);
        },
        process_shortcut: (shortcut, data) => {
            console.log(`[main] processing shortcut "${shortcut}"`);
            var _process = _ => {
                if (data.action == 'exec') {
                    var code = `( (block) => { ${data.data} } )(app.ui.block.child('main/node/menu/${data.field_id}'));`;
                    if (code) eval(code);
                }
            };
            setTimeout(_ => {
                app.ui.block.child('main/core').data({ id: data.core_id });
                setTimeout(_ => {
                    app.ui.block.child('main/node').data({ id: data.id });
                    setTimeout(_ => {
                        app.ui.block.child('main/cores').on('hide');
                        app.ui.block.child('main/node').on('show');
                        _process();
                        app.ui.block.child('loading').css('transition', 'opacity 0.3s ease');
                        setTimeout(_ => {
                            app.ui.block.child('loading').css('opacity', '0');
                            setTimeout(_ => {
                                app.ui.block.child('loading').on('hide');
                            }, 330);
                        }, 50);
                    }, 400);
                }, 400);
            }, 10);
        },
        update_node_profiles: (node_profiles, load_client_drivers = true) => {
            for (var np in node_profiles) {
                node_profiles[np].id = np;
                app.ws.api.node_profiles[np] = node_profiles[np];
            }
            if (load_client_drivers) {
                console.log('[main] loading client drivers');
                app.main.load_client_drivers(null, null, _ => {
                    console.log('[main] loaded client drivers');
                    console.log('[main] processing shortcuts');
                    app.main.process_shortcuts();
                });
                setTimeout(_ => {
                    Block.queries();
                }, 20);
            }
        },
        load_client_drivers: (i = null, arr = null, resolve = null, debug = false) => {
            // debug = true;
            if (debug) console.log(`load_client_drivers: called (i=${i})`);
            var node_profiles = app.ws.api.node_profiles;
            if (i === null || arr === null) {
                if (debug) console.log('load_client_drivers: start');
                if (node_profiles) {
                    arr = Object.keys(node_profiles);
                    app.main.load_client_drivers(0, arr, resolve, debug);
                }
            } else {
                if (i < arr.length) {
                    var np = arr[i];
                    // if (debug) console.log(i, arr, arr[i]);
                    var _load_next = _ => {
                        app.main.load_client_drivers(++i, arr, resolve, debug);
                    };
                    var _load_current_module = _ => {
                        var _next = _load_next;
                        if (node_profiles[np].web.hasOwnProperty('client') && node_profiles[np].web.client === true) {
                            app.main.load_client_module(`${np}`, _next);
                        } else _next();
                    };
                    var _load_current_view = _ => {
                        var _next = _load_current_module;
                        if (node_profiles[np].web.hasOwnProperty('views') && node_profiles[np].web.views === true) {
                            app.main.load_client_view(`${np}`, _next);
                        } else _next();
                    };
                    if (node_profiles[np] && node_profiles[np].hasOwnProperty('web')) {
                        if (debug) console.log(`load_client_drivers: np=${np}`);
                        _load_current_view();
                    } else _load_next();
                } else {
                    if (debug) console.log('load_client_drivers: done');
                    if (resolve) resolve();
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
            util.load_script(`/nodes/${node_type}/client.js`, _ => {
                app.main.api.module(app.main.last_loaded_client_module, node_type);
                app.main.init_client_module(node_type, _ => {
                    console.log(`[main] client module "${node_type}" script initialized`);
                    if (resolve) resolve();
                });
            });
        },
        load_client_view: (node_type, resolve = null) => {
            app.ui.load_client_view(`/nodes/${node_type}/views.block`, _ => {
                console.log(`[main] client module "${node_type}" views initialized`);
                if (resolve) resolve();
            });
        },
        login: _ => {
            if (util.cookie('username') != null && util.cookie('password') != null) {
                app.ws.api._temp_prelogin = true;
                app.ws.api.login(util.cookie('username'), util.cookie('password'));
            } else {
                if (app.main.shortcut_exists()) {
                    window.location = String(window.location.origin);
                }
            }
        },
        quit: _ => {
            if (app.ws.online) app.ws.socket.close(1001);
            var main_children = app.ui.block.child('main').children();
            for (var m_c in main_children) {
                if (m_c != 'header' && m_c != 'reload')
                    main_children[m_c].css('display', 'none');
            }
            app.ui.block.child('main/reload').on('show');
        },
        reload: _ => {
            window.location.reload();
        },
        init: _ => {
            console.clear();
            console.log('[main] loading');
            if (window.location.search.includes('logout=true')) {
                app.ws.api.logout();
                return;
            }
            window.nestor = app.main.api;
            setTimeout(_ => {
                console.log('[main] ui loading');
                app.ui.load_main_views(_ => {
                    console.log('[main] socket connecting');
                    app.ws.url = (window.location.protocol === 'https:'
                        ? 'wss://'
                        : 'ws://') +
                        document.domain +
                        ((document.domain == 'localhost' || document.domain.includes('192.168.0.')) ? ':30009' : (window.location.protocol === 'https:' ? ':443' : ':80')) +
                        '/socket';
                    app.ws.connect(_ => {
                        app.ui.init(_ => {
                            console.log('[main] ready');
                            app.main.login();
                            // if (util.mobile()) alert('mobile');
                        });
                    });
                });
            }, 300);
        }
    }
};

$(document).ready(app.main.init);