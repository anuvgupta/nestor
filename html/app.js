/* NESTOR */
// web client

var app; app = {
    ui: {
        block: Block('div', 'app'),
        transition_fade_duration: 0.145, // 0.155
        transitional_update_interval: 0.09,
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
    },
    ws: {
        id: 0,
        socket: null,
        url:
            (location.protocol === 'https:'
                ? 'wss://'
                : 'ws://') +
            document.domain +
            ((document.domain == 'localhost' || document.domain == '10.160.39.244' || document.domain == '169.254.138.80' || document.domain == '192.168.0.100') ? ':30009' : (location.protocol === 'https:' ? ':443' : ':80')) +
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
            node_profiles: {
                core: {
                    meta: {
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
                        }
                    ]
                }
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
            update_node_data: (id, field_id, field_val, transitional = false) => {
                app.ws.send('update_node_data', {
                    id: id,
                    field_id: field_id,
                    field_val: field_val,
                    transitional: transitional
                });
            },
        }
    },
    main: {
        init: _ => {
            console.clear();
            console.log('[main] loading...');
            setTimeout(_ => {
                app.ui.block.load(_ => {
                    app.ui.block.load(_ => {
                        console.log('[main] blocks loaded');
                        console.log('[main] socket connecting');
                        app.ws.connect(_ => {
                            app.ui.init(_ => {
                                console.log('[main] ready');
                                if (util.cookie('username') != null && util.cookie('password') != null) {
                                    app.ws.api._temp_prelogin = true;
                                    app.ws.api.login(util.cookie('username'), util.cookie('password'));
                                }
                            });
                        });
                    }, 'app', 'jQuery');
                }, 'blocks', 'jQuery');
            }, 300);
        }
    }
};

$(document).ready(app.main.init);