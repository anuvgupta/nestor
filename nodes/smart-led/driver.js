/* nestor node server driver (smart-led) */

const node_type = "smart-led";

var first_init = true;
module.exports = {
    init: (m, log) => {
        if (first_init) {
            first_init = false;
            m.ws.api_bind('node_ready', (node_id, node_object) => {
                // log(`node ${node_id} ready`);
                m.main.call_driver_api(node_type, 'play_initial', [node_id, node_object], (result) => {
                    // console.log(result);
                });
            });
        }
        return {
            switch: (node, client, value, transitional, next) => {
                next();
            },
            brightness: (node, client, value, transitional, next) => {
                next();
            },
            mode: (node, client, value, transitional, next) => {
                next();
            },
            color: (node, client, value, transitional, next) => {
                next();
            },
            pattern: (node, client, value, transitional, next) => {
                next();
            }
        }
    },
    api: {
        update_pattern_color_pos: (m, log, api_args, resolve) => {
            if (api_args.hasOwnProperty('pattern_id') && api_args.hasOwnProperty('color_id') && api_args.hasOwnProperty('user_id') && api_args.hasOwnProperty('new_pos')) {
                m.db.get_user_data(api_args.user_id, 'color_patterns', pattern_list => {
                    if (pattern_list === false || pattern_list === null) resolve(pattern_list);
                    var pattern = null;
                    var pattern_list_id = -1;
                    for (var p in pattern_list) {
                        if (pattern_list[p].id == api_args.pattern_id) {
                            pattern_list_id = p;
                            pattern = pattern_list[p];
                            break;
                        }
                    }
                    if (pattern === null) resolve(null);
                    var pattern_colors = pattern.list;
                    if (pattern_colors === null) resolve(null);
                    var color_new_pos = api_args.new_pos;
                    var color_old_pos = -1;
                    for (var c in pattern_colors) {
                        if (c == api_args.color_id) {
                            color_old_pos = pattern_colors[c].pos;
                            break;
                        }
                    }
                    if (color_old_pos == -1) resolve(null);
                    var pattern_count = Object.keys(pattern_colors).length;
                    var count = 0;
                    var pattern_colors_list = [];
                    for (count = 0; count < pattern_count; count++) {
                        for (var c in pattern_colors) {
                            if (pattern_colors[c].pos == count) {
                                pattern_colors[c].id = c;
                                pattern_colors_list.push(pattern_colors[c]);
                            }
                        }
                    }
                    // log('old', pattern_colors_list);
                    pattern_colors_list = m.utils.array_move(pattern_colors_list, color_old_pos, color_new_pos);
                    for (var l in pattern_colors_list) {
                        var curr_color_id = pattern_colors_list[l].id;
                        pattern_colors_list[l].pos = parseInt(l);
                        delete pattern_colors_list[l].id;
                        pattern_colors[curr_color_id] = pattern_colors_list[l];
                    }
                    // log('new', pattern_colors_list);
                    if (pattern_colors) {
                        m.db.update_user_data(api_args.user_id, 'color_patterns', 'list_update', {
                            list: pattern_colors
                        }, { id: `${api_args.pattern_id}` }, {}, result2 => {
                            if (result2 === false || result2 === null) resolve(result2);
                            m.ws.trigger_user_data_update(api_args.user_id, 'color_patterns');
                            resolve(true);
                        });
                    }
                });
            }
        },
        delete_pattern_color: (m, log, api_args, resolve) => {
            if (api_args.hasOwnProperty('pattern_id') && api_args.hasOwnProperty('color_id') && api_args.hasOwnProperty('user_id')) {
                m.db.get_user_data(api_args.user_id, 'color_patterns', pattern_list => {
                    if (pattern_list === false || pattern_list === null) resolve(pattern_list);
                    var pattern = null;
                    var pattern_list_id = -1;
                    for (var p in pattern_list) {
                        if (pattern_list[p].id == api_args.pattern_id) {
                            pattern_list_id = p;
                            pattern = pattern_list[p];
                            break;
                        }
                    }
                    if (pattern === null) resolve(null);
                    var pattern_colors = pattern.list;
                    if (pattern_colors === null) resolve(null);
                    var pattern_color_pos = -1;
                    for (var c in pattern_colors) {
                        if (c == api_args.color_id) {
                            pattern_color_pos = parseInt(pattern_colors[c].pos);
                            break;
                        }
                    }
                    if (pattern_color_pos == -1) resolve(null);
                    var pattern_count = Object.keys(pattern_colors).length;
                    var count = 0;
                    var pattern_colors_list = [];
                    for (count = 0; count < pattern_count; count++) {
                        for (var c in pattern_colors) {
                            if (pattern_colors[c].pos == `${count}`) {
                                pattern_colors[c].id = c;
                                pattern_colors_list.push(pattern_colors[c]);
                            }
                        }
                    }
                    // console.log(pattern_colors, pattern_color_pos);
                    log(pattern_colors_list);
                    pattern_colors_list.splice(pattern_color_pos, 1);
                    log(pattern_colors_list);

                    var pattern_colors_new = {};
                    for (var l in pattern_colors_list) {
                        var curr_color_id = pattern_colors_list[l].id;
                        pattern_colors_list[l].pos = parseInt(l);
                        delete pattern_colors_list[l].id;
                        pattern_colors_new[curr_color_id] = pattern_colors_list[l];
                    }
                    // console.log(pattern_colors, pattern_colors_list);
                    if (pattern_colors_new) {
                        m.db.update_user_data(api_args.user_id, 'color_patterns', 'list_update', {
                            list: pattern_colors_new
                        }, { id: `${api_args.pattern_id}` }, {}, result2 => {
                            if (result2 === false || result2 === null) resolve(result2);
                            m.ws.trigger_user_data_update(api_args.user_id, 'color_patterns');
                            resolve(true);
                        });
                    }
                });
            }
        },
        get_pattern_code: (m, log, api_args, resolve) => {
            if (api_args) {
                var pattern_id = null;
                var node_id = null;
                if ((typeof api_args) == 'object') {
                    pattern_id = api_args.pattern_id;
                    node_id = api_args.node_id;
                } else if ((typeof api_args) == 'string') {
                    if (api_args.trim().length > 1) {
                        var api_args_arr = (`${api_args.trim()}`).split('|');
                        pattern_id = api_args_arr[0];
                        node_id = api_args_arr[1];
                    }
                }
                var user_id = "";
                var core_id = "";
                if (pattern_id && node_id) {
                    m.db.get_node_info(node_id, null, `_api[${node_type}][get_pattern_code]`, node_info => {
                        if (node_info === null || node_info === false) resolve(node_info);
                        if (node_info && node_info.user_id && node_info.core_id) {
                            if (node_info.data.pattern && node_info.data.pattern == pattern_id) {
                                user_id = node_info.user_id;
                                core_id = node_info.core_id;
                                var ws_client = m.ws.get_client_by_o_id(core_id);
                                var mq_client = m.mq.client_from_node_id(node_id);
                                if (ws_client || mq_client) {
                                    m.db.get_user_data(user_id, "color_patterns", pattern_list => {
                                        if (pattern_list === null || pattern_list === false) resolve(pattern_list);
                                        if (pattern_list) {
                                            var p_l_id = -1;
                                            var pattern = null;
                                            for (var p in pattern_list) {
                                                if (pattern_list[p].id == pattern_id) {
                                                    pattern = pattern_list[p];
                                                    p_l_id = p;
                                                    break;
                                                }
                                            }
                                            var pattern_string = m.utils.condense_pattern_hex(pattern);
                                            if (pattern_string) {
                                                log(`driver[${node_type}.get_pattern_code] sending pattern to node ${node_id}: ${pattern_id}:${pattern_string}`);
                                                if (mq_client) m.mq.send_to_device('user-data', `pattern-${pattern_string}`, mq_client);
                                                if (ws_client) m.ws.send_to_device('user-data', `${node_id}-pattern-${pattern_string}`, ws_client);
                                                resolve(true);
                                            } else resolve(null);
                                        } else resolve(null);
                                    });
                                } else resolve(null);
                            } else resolve(false);
                        } else resolve(false);
                    });
                } else resolve(null);
            } else resolve(null);
        },
        play_initial: (m, log, api_args, resolve) => {
            log('play_initial');
            // log(api_args);
            var node_id = api_args[0];
            var node_object = api_args[1];
            var node_ws_client = m.ws.get_client_by_o_id(node_object.core_id);
            var node_mq_client = m.mq.client_from_node_id(node_id);
            // log(node_ws_client);
            if (node_id && node_object && (node_ws_client || node_mq_client)) {
                var audio_flag = (node_object.data.hasOwnProperty('audio') && node_object.data.audio === true);
                setTimeout(_ => {
                    if (node_mq_client)
                        m.mq.send_to_device('node-data', `audio-false-${(audio_flag ? 'true' : 'false')}`, node_mq_client, true);
                    if (node_ws_client)
                        m.ws.send_to_device('node-data', `${node_id}-audio-false-${(audio_flag ? 'true' : 'false')}`, node_ws_client, true);
                    setTimeout(_ => {
                        if (node_mq_client)
                            m.mq.send_to_device('node-data', `audio_allow-false-true`, node_mq_client, true);
                        if (node_ws_client)
                            m.ws.send_to_device('node-data', `${node_id}-audio_allow-false-true`, node_ws_client, true);
                        if (!audio_flag) {
                            setTimeout(_ => {
                                if (node_mq_client)
                                    m.mq.send_to_device('node-data', `brightness-false-${node_object.data.brightness}`, node_mq_client, true);
                                if (node_ws_client)
                                    m.ws.send_to_device('node-data', `${node_id}-brightness-false-${node_object.data.brightness}`, node_ws_client, true);
                                log(`driver[${node_type}.play_initial] sending currently playing data to node ${node_id}`);
                            }, 200);
                        }
                        resolve(true);
                    }, 50);
                    log(`driver[${node_type}.play_initial] sending audio react mode update to node ${node_id}`);
                }, 200);
            }
        }
    }
};