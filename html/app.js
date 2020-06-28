var app = {
    id: 0,
    block: Block('div', 'app'),
    auth: null,
    socket: null,
    wsurl:
        'ws://' +
        document.domain +
        ':' +
        (document.domain == 'nestor.anuv.me' ? 3007 : 30007),
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
            console.log('[wss] invalid json msg ', e);
            m = null;
        }
        return m;
    },
    init_block: (callback) => {
        app.block.fill(document.body);
        Block.queries();
        setTimeout(_ => {
            app.block.css('opacity', '1');
        }, 100);
        setTimeout(_ => {
            Block.queries();
            setTimeout(_ => {
                Block.queries();
            }, 200);
        }, 50);
        callback();
    },
    update_node_status_interval: 5,
    transition_fade_duration: 0.145, // 0.155
    transitional_update_interval: 0.09,
    auth_cookie_expiration: 'Fri, 31 Dec 9999 23:59:59 GMT',
    api: {
        connect: _ => {
            var socket = new WebSocket(app.wsurl);
            socket.addEventListener('open', e => {
                console.log('socket connected');
                app.init_block(_ => {
                    if (app.util.cookie('username') != null && app.util.cookie('password') != null) {
                        app._temp_prelogin = true;
                        app.api.login(app.util.cookie('username'), app.util.cookie('password'));
                    }
                });
            });
            socket.addEventListener('error', e => {
                console.log('socket error ', e.data);
            });
            socket.addEventListener('message', e => {
                var d = app.decode_msg(e.data);
                if (d != null) {
                    console.log('received:', d.event, d.data);
                    var data = {};
                    data[d.event] = d.data;
                    app.block.data(data);
                } else {
                    console.log('received:', 'invalid message', e.data);
                }
            });
            socket.addEventListener('close', e => {
                console.log('socket disconnected');
                // alert('disconnected from server');
                // app.api.logout();
            });
            window.addEventListener('beforeunload', e => {
                // socket.close(1001);
            });
            app.socket = socket;
        },
        send: (event, data) => {
            console.log('sending:', event, data);
            app.socket.send(app.encode_msg(event, data));
        },
        login: (user, pass) => {
            app.auth = { username: user, password: pass };
            app.api.send('auth', app.auth);
        },
        logout: _ => {
            app.util.deleteCookie('username');
            app.util.deleteCookie('password');
            // window.location.reload();
            window.location.href = String(window.location.href);
        },
        new_core: _ => {
            app.api.send('new_core', null);
        },
        get_core_list: status => {
            app.api.send('get_core_list', { status: status });
        },
        get_core_info: (id, get_nodes = true) => {
            app.api.send('get_core_info', {
                id: id, get_nodes: get_nodes
            });
        },
        get_node_info: id => {
            app.api.send('get_node_info', id);
        },
        set_core_name: (id, name) => {
            app.api.send('set_core_name', {
                id: id,
                name: name
            });
        },
        set_node_name: (id, name) => {
            app.api.send('set_node_name', {
                id: id,
                name: name
            });
        },
        delete_core: (id, name) => {
            if (true == confirm(`Confirm—delete core "${name}" and its nodes?`))
                app.api.send('delete_core', id);
        },
        delete_node: (id, name) => {
            if (true == confirm(`Confirm—delete node "${name}"?`))
                app.api.send('delete_node', id);
        },
        get_node_data: (id, field_id) => {
            app.api.send('get_node_data', {
                id: id, field: field_id
            });
        },
        update_node_data: (id, field_id, field_val, transitional = false) => {
            app.api.send('update_node_data', {
                id: id,
                field_id: field_id,
                field_val: field_val,
                transitional: transitional
            });
        },
        node_profiles: {
            core: {
                meta: {
                    img: 'memory_b',
                    label: 'Nestor Core'
                },
                data: []
            }
        }
    },
    util: {
        mobile: _ => {
            return jQuery.browser.mobile;
        },
        cookie: (id, val, date) => {
            if (Block.is.unset(val))
                document.cookie.split('; ').forEach(cookie => {
                    if (cookie.substring(0, id.length) == id)
                        val = cookie.substring(id.length + 1);
                });
            else
                document.cookie =
                    id +
                    '=' +
                    val +
                    (Block.is.set(date) ? '; expires=' + date : '');
            return Block.is.unset(val) ? null : val;
        },
        deleteCookie: id => {
            app.util.cookie(id, '', 'Thu, 01 Jan 1970 00:00:00 GMT');
        },
        sha256: (str, callback) => {
            if (callback) callback(window.sha256(str));
        },
        sha256_secure: (str, callback) => {
            const msgUint8 = new TextEncoder("utf-8").encode(str);
            const hashBuffer_promise = crypto.subtle.digest('SHA-256', msgUint8);
            hashBuffer_promise.then(hashBuffer => {
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                if (callback) callback(hashHex);
            });
        }, // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        lpad: (s, width, char) => {
            return s.length >= width
                ? s
                : (new Array(width).join(char) + s).slice(-width);
        }, // https://stackoverflow.com/questions/10841773/javascript-format-number-to-day-with-always-3-digits
        rgbcss: (r, g, b) => {
            return (
                'rgb(' +
                parseInt(r) +
                ',' +
                parseInt(g) +
                ',' +
                parseInt(b) +
                ')'
            );
        },
        rgbstring: (r, g, b) => {
            return (
                app.util.lpad(String(parseInt(r)), 3, '0') +
                app.util.lpad(String(parseInt(g)), 3, '0') +
                app.util.lpad(String(parseInt(b)), 3, '0')
            );
        },
        capitalize: word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        },
        duration_desc: last_timestamp => {
            if (last_timestamp < 0) return "";
            var deltaSec = parseInt(Date.now() / 1000) - parseInt(last_timestamp / 1000);
            if (deltaSec < 0) {
                deltaSec = 0;
            }
            var outputString = "";
            if (deltaSec < 5) {
                outputString += "now";
            } else if (deltaSec < 60) {
                outputString += "" + parseInt(Math.floor(parseFloat(deltaSec) / 5.0) * 5.0) + " seconds ago";
            } else if (deltaSec < 3600) {
                var mins = parseInt(deltaSec / 60);
                if (mins == 1) {
                    outputString += "" + mins + " minute ago";
                } else {
                    outputString += "" + mins + " minutes ago";
                }
            } else {
                var hrs = parseInt(deltaSec / 3600);
                if (hrs == 1) {
                    outputString += "" + hrs + " hour ago";
                } else {
                    outputString += "" + hrs + " hours ago";
                }
            }
            return outputString;
        }
    }
};

window.addEventListener('load', _ => {
    console.log('loading...');
    setTimeout(_ => {
        app.block.load(_ => {
            app.block.load(_ => {
                console.log('blocks loaded');
                console.log('socket connecting');
                app.api.connect();
            }, 'app', 'jQuery');
        }, 'blocks', 'jQuery');
    }, 50);
});

console.clear();