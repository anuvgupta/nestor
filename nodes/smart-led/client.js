/* nestor node web client module (smart-led) */

nestor.module({
    init: (exports, resolve) => {
        app.ui.color_picker = exports.color_picker;
        app.ui.pattern_picker = exports.pattern_picker;
        app.ui.audio_react_menu = exports.audio_react_menu;
        app.ui.pattern_picker.initialize(_ => {
            app.ui.color_picker.initialize(_ => {
                app.ui.audio_react_menu.initialize(_ => {
                    if (resolve) resolve();
                });
            });
        });
    },
    export: _ => {
        return {
            color_picker: {
                initialize: (resolve) => {
                    app.ui.color_picker.jscolor_init();
                    app.ws.api.user_data_handlers['color_presets'] = app.ui.color_picker.color_preset_user_data_handler;
                    if (resolve) resolve();
                },
                id: null,
                presets: [],
                rgb: {
                    r: 0,
                    g: 0,
                    b: 0
                },
                track_live: {
                    left: false,
                    right: false,
                    play_preset_semaphore: true,
                    play_preset_interval: 200
                },
                split_char: '|',
                bw_threshold: 200,
                double_click_timeout: 200,
                switch_to_preset: null,
                submenu_data_editor_block: null,
                color_preset_user_data_handler: preset_list => {
                    app.ui.color_picker.presets = preset_list;
                    var presets_b = app.ui.block.child('main/node/menu/submenu/content-wrap/content/colors/presets');
                    var prev_presets_b = presets_b.children();
                    var preset_dict = {};
                    for (var p in preset_list) {
                        var p_id = preset_list[p].id;
                        preset_dict[p_id] = preset_list[p];
                        if (prev_presets_b.hasOwnProperty(p_id))
                            preset_list[p].found = true;
                    }
                    for (var p in preset_list) {
                        var p_id = preset_list[p].id;
                        var rgb_val = util.hex_rgb(preset_list[p].hex);
                        var update_data = {};
                        var update_key = '';
                        if (preset_list[p].hasOwnProperty('found') && preset_list[p].found == true)
                            update_key = 'updatepreset';
                        else update_key = 'newpreset';
                        update_data[update_key] = {
                            r: rgb_val.r,
                            g: rgb_val.g,
                            b: rgb_val.b,
                            id: p_id,
                            name: preset_list[p].name
                        };
                        presets_b.data(update_data);
                        if (update_key == 'newpreset') {
                            if (app.ui.color_picker.switch_to_preset && app.ui.color_picker.switch_to_preset == p_id) {
                                prev_presets_b[p_id].on('select');
                            }
                        }
                    }
                    for (var c_pr in prev_presets_b) {
                        if (!(preset_dict.hasOwnProperty(c_pr))) {
                            // delete preset
                            presets_b.data({
                                deletepreset: {
                                    id: c_pr
                                }
                            });
                        }
                    }
                },
                new_preset: _ => {
                    var new_id = util.rand_id(20);
                    app.ui.color_picker.switch_to_preset = new_id;
                    app.ws.api.update_user_data('color_presets', 'list_append', {
                        hex: util.rgb_hex(app.ui.color_picker.rgb.r, app.ui.color_picker.rgb.g, app.ui.color_picker.rgb.b),
                        id: new_id,
                        name: ''
                    }, null, { boomerang: true });
                },
                delete_preset: _ => {
                    if (app.ui.color_picker.id && app.ui.color_picker.id.trim().length > 0) {
                        var preset_id = app.ui.color_picker.id;
                        var preset_list = app.ui.color_picker.presets;
                        var preset_name = '';
                        for (var p in preset_list) {
                            if (preset_list[p].id == app.ui.color_picker.id) {
                                preset_name = preset_list[p].name;
                                break;
                            }
                        }
                        // console.log(preset_name);
                        var confirm_delete = null;
                        if (preset_name && preset_name.trim().length > 0)
                            confirm_delete = confirm(`Delete preset "${preset_name}"?`);
                        else confirm_delete = confirm('Delete preset?');
                        if (confirm_delete) {
                            app.ws.api.update_user_data('color_presets', 'list_remove', null, { id: `${preset_id}` }, { boomerang: true });
                        }
                    }
                },
                name_preset: (new_name) => {
                    if (app.ui.color_picker.id && app.ui.color_picker.id.trim().length > 0)
                        app.ws.api.update_user_data('color_presets', 'list_update', {
                            name: new_name
                        }, { id: `${app.ui.color_picker.id}` }, { boomerang: true });
                },
                update_preset: (latent) => {
                    if (latent == undefined) latent = false;
                    if (app.ui.color_picker.id && app.ui.color_picker.id.trim().length > 0)
                        app.ws.api.update_user_data('color_presets', 'list_update', {
                            hex: util.rgb_hex(app.ui.color_picker.rgb.r, app.ui.color_picker.rgb.g, app.ui.color_picker.rgb.b)
                        }, { id: `${app.ui.color_picker.id}` }, { boomerang: true });
                },
                load_presets: _ => {
                    app.ws.api.get_user_data('color_presets');
                },
                play_preset: (latent, target_block = app.ui.color_picker.submenu_data_editor_block) => {
                    if (latent == undefined) latent = false;
                    var preset_id = app.ui.color_picker.id;
                    if (app.ui.color_picker.id == null || app.ui.color_picker.id.trim().length < 1)
                        preset_id = null;
                    var node_info = app.ui.block.child('main/node').key('node_info');
                    if (node_info && node_info.hasOwnProperty('id') && node_info.id && node_info.hasOwnProperty('type') && node_info.type == 'smart-led') {
                        var node_id = node_info.id;
                        if (latent || app.ui.color_picker.track_live.play_preset_semaphore) {
                            // block outside of interval
                            app.ui.color_picker.track_live.play_preset_semaphore = false;
                            setTimeout(function () {
                                app.ui.color_picker.track_live.play_preset_semaphore = true;
                            }, app.ui.color_picker.track_live.play_preset_interval);
                            // play preset
                            var field_value = app.ui.block.child('main/node/menu/color').key('value');
                            //var mode_field_value = app.ui.block.child('main/node/menu/mode').key('value');
                            if (field_value && field_value.trim().length > 0 /*&& mode_field_value && mode_field_value == 'hue'*/) {
                                var last_color_split = field_value.split(app.ui.color_picker.split_char);
                                var current_update_color = util.rgb_hex(app.ui.color_picker.rgb.r, app.ui.color_picker.rgb.g, app.ui.color_picker.rgb.b);
                                var final_color_val = '';
                                final_color_val += (app.ui.color_picker.track_live.left ? current_update_color : last_color_split[0]);
                                final_color_val += app.ui.color_picker.split_char;
                                final_color_val += (app.ui.color_picker.track_live.right ? current_update_color : last_color_split[1]);
                                // console.log(final_color_val);

                                if (target_block && target_block != null && target_block.block) {
                                    target_block.on('update', {
                                        value: final_color_val,
                                        update_node_data: false
                                    });
                                }

                                app.ws.api.update_node_data(node_id, 'color', final_color_val, latent == false, true);
                            }
                        }
                    }
                },
                jscolor_update: function (picker, update, latent = false) {
                    app.ui.color_picker.rgb.r = parseInt(picker.rgb[0]);
                    app.ui.color_picker.rgb.g = parseInt(picker.rgb[1]);
                    app.ui.color_picker.rgb.b = parseInt(picker.rgb[2]);
                    app.ui.block.child('main/node/menu/submenu/content-wrap/content/colors/picker').data({
                        color: {
                            hex: util.rgb_hex(app.ui.color_picker.rgb.r, app.ui.color_picker.rgb.g, app.ui.color_picker.rgb.b, true), // picker.toHEXString(),
                            r: app.ui.color_picker.rgb.r,
                            g: app.ui.color_picker.rgb.g,
                            b: app.ui.color_picker.rgb.b
                        }
                    });
                    if (update == undefined || update == true) app.ui.color_picker.update_preset(latent);
                    if (app.ui.color_picker.track_live.left || app.ui.color_picker.track_live.right)
                        app.ui.color_picker.play_preset(latent);
                    if (app.ui.pattern_picker && app.ui.pattern_picker.pattern_color_block && app.ui.pattern_picker.pattern_color_block != null && app.ui.pattern_picker.pattern_color_block.block) {
                        app.ui.pattern_picker.pattern_color_block.data({
                            r: app.ui.color_picker.rgb.r,
                            g: app.ui.color_picker.rgb.g,
                            b: app.ui.color_picker.rgb.b
                        });
                    }
                },
                jscolor_init: _ => {
                    if (window.jscolor) {
                        $(document.body).on('DOMNodeInserted', function (e) {
                            if (e.target.parentNode == document.body) {
                                var calc_height = app.ui.block.child('main/header').$().height() + app.ui.block.child('main/node/bar').$().height() + app.ui.block.child('main/node/menu/submenu/bar').$().height();
                                e.target.style.top = `${calc_height}px`;
                                $(e.target)
                                    .children()
                                    .css({
                                        borderRadius: '1px',
                                        boxShadow: 'none'
                                    });
                                $(e.target).off('click.updatecolor');
                                $(e.target).on('click.updatecolor', function () {
                                    app.ui.color_picker.update_preset(true);
                                    if (app.ui.color_picker.track_live.left || app.ui.color_picker.track_live.right)
                                        app.ui.color_picker.play_preset(true);
                                });
                            }
                        });
                        jscolor.installByClassName('jscolor');
                    }
                }
            },
            pattern_picker: {
                initialize: (resolve) => {
                    app.ui.block.on('mousemove', (e, b, d) => {
                        app.ui.pattern_picker.capture_app_mousemove(e, b, d);
                    });
                    app.ui.block.on('mouseup', (e, b, d) => {
                        app.ui.pattern_picker.capture_app_mouseup(e, b, d);
                    });
                    app.ui.block.on('click', (e, b, d) => {
                        app.ui.pattern_picker.capture_app_click(e, b, d);
                    });
                    app.ws.api.user_data_handlers['color_patterns'] = app.ui.pattern_picker.color_patterns_user_data_handler;
                    app.ui.submenu_pre_exit_handlers.push((event, block, data) => {
                        // initial pattern submenu exit event
                        var curr_patt_id = app.ui.pattern_picker.current.id;
                        var submenu = app.ui.block.child('main/node/menu/submenu');
                        pattern_color_edit_id = app.ui.pattern_picker.pattern_color_edit_id;
                        if (curr_patt_id && curr_patt_id.trim().length > 1 && pattern_color_edit_id && pattern_color_edit_id.pattern && pattern_color_edit_id.pattern.trim().length > 1 && pattern_color_edit_id.color && pattern_color_edit_id.color.trim().length > 1) {
                            if (curr_patt_id == pattern_color_edit_id.pattern) {
                                var p_c_id = pattern_color_edit_id.color;
                                var p_c_b = submenu.child('content-wrap/content/patterns/area/editor/colors').child(`color_${p_c_id}`);
                                if (p_c_b) {
                                    setTimeout(_ => {
                                        p_c_b.child('colorwrap/color').on('click');
                                    }, 10);
                                }
                            }
                        }
                    });
                    app.ui.submenu_exit_handlers.push((event, block, data) => {
                        // pattern submenu secondary exit event
                        var node_b = app.ui.block.child('main/node');
                        if (node_b.child('menu/submenu/content-wrap/content/patterns').css('display') != 'none') {
                            var node_info = node_b.key('node_info');
                            if (node_info && node_info.type && node_info.type == 'smart-led' && node_info.id) {
                                var curr_patt_id = app.ui.pattern_picker.current.id;
                                if (curr_patt_id && curr_patt_id != null && curr_patt_id.trim().length > 1) {
                                    var node_data = node_b.key('node_data');
                                    if (node_data && node_data.data && node_data.data.pattern && node_data.data.pattern == curr_patt_id)
                                        app.ws.api.trigger_node_api('smart-led', 'get_pattern_code', `${curr_patt_id}|${node_info.id}`);
                                }
                            }
                        }
                    });
                    if (resolve) resolve();
                },
                patterns: [],
                current: {
                    id: null,
                    name: 'None',
                    list: {}
                },
                submenu_data_editor_block: null,
                pattern_color_block: null,
                pattern_color_edit_id: {
                    pattern: null,
                    color: null
                },
                pattern_l_limit: 10,
                color_patterns_user_data_handler: pattern_list => {
                    app.ui.pattern_picker.patterns = pattern_list;
                    if (app.ui.pattern_picker.current.id != null) {
                        var found_pattern = false;
                        for (var p in pattern_list) {
                            if (pattern_list[p].id == app.ui.pattern_picker.current.id) {
                                found_pattern = pattern_list[p];
                                break;
                            }
                        }
                        var submenu_b = app.ui.block.child('main/node/menu/submenu');
                        if (found_pattern === false) {
                            app.ui.pattern_picker.current.id = null;
                            app.ui.pattern_picker.current.name = 'None';
                            app.ui.pattern_picker.current.list = {};
                            submenu_b.on('hide');
                        } else {
                            app.ui.pattern_picker.current.id = pattern_list[p].id;
                            app.ui.pattern_picker.current.name = pattern_list[p].name;
                            app.ui.pattern_picker.current.list = pattern_list[p].list;
                        }
                        submenu_b.child('content-wrap/content/patterns').on('update_current');
                    }
                },
                get_pattern: (pattern_id) => {
                    var pattern_list = app.ui.pattern_picker.patterns;
                    for (var p in pattern_list) {
                        if (pattern_list[p].id == pattern_id)
                            return pattern_list[p];
                    }
                    return null;
                },
                set_local_current: (pattern_id) => {
                    var pattern = app.ui.pattern_picker.get_pattern(pattern_id);
                    if (pattern) {
                        app.ui.pattern_picker.current.id = pattern_id;
                        app.ui.pattern_picker.current.name = pattern.name;
                        app.ui.pattern_picker.current.list = pattern.list;
                        app.ui.pattern_picker.pattern_color_edit_id.pattern = pattern_id;
                    }
                },
                switch_to_pattern: null,
                update_node_pattern: (node_id, pattern_id, target_block = app.ui.pattern_picker.submenu_data_editor_block, boomerang = false) => {
                    if (target_block && target_block != null && target_block.block) {
                        target_block.on('update', {
                            value: pattern_id,
                            update_node_data: false
                        });
                    }
                    app.ws.api.update_node_data(`${node_id}`, 'pattern', `${pattern_id}`, false, boomerang);
                },
                new_pattern: (switch_to = true) => {
                    var new_id = util.rand_id(20);
                    if (switch_to) app.ui.pattern_picker.switch_to_pattern = new_id;
                    app.ws.api.update_user_data('color_patterns', 'list_append', {
                        list: {},
                        id: new_id,
                        name: 'untitled'
                    }, null, { boomerang: true });
                },
                delete_pattern: (update_node_data = true, pattern_name = app.ui.pattern_picker.current.name) => {
                    if (app.ui.pattern_picker.current.id && app.ui.pattern_picker.current.id.trim().length > 0) {
                        var confirm_delete = confirm(`Delete pattern "${pattern_name}"?`);
                        if (confirm_delete) {
                            app.ws.api.update_user_data('color_patterns', 'list_remove', null, { id: `${app.ui.pattern_picker.current.id}` }, { boomerang: true });
                            var node_info = app.ui.block.child('main/node').key('node_info');
                            if (update_node_data && node_info && node_info.id && node_info.id.trim().length > 1) {
                                setTimeout(_ => {
                                    app.ui.pattern_picker.update_node_pattern(node_info.id, 'null', null, true);
                                }, 100);
                            }
                        }
                    }
                },
                name_pattern: (new_name) => {
                    if (app.ui.pattern_picker.current.id && app.ui.pattern_picker.current.id.trim().length > 0)
                        app.ws.api.update_user_data('color_patterns', 'list_update', {
                            name: new_name
                        }, { id: `${app.ui.pattern_picker.current.id}` }, { boomerang: true });
                },
                add_pattern_color: _ => {
                    var new_id = util.rand_id(20);
                    if (app.ui.pattern_picker.current.id && app.ui.pattern_picker.current.id.trim().length > 0)
                        app.ws.api.update_user_data('color_patterns', 'list_update', {
                            _key: `list.${new_id}`,
                            _value: {
                                hue: {
                                    fade: 0,
                                    time: 0,
                                    hex: '000000'
                                },
                                pos: (Object.keys(app.ui.pattern_picker.current.list)).length
                            }
                        }, { id: `${app.ui.pattern_picker.current.id}` }, { boomerang: true });
                },
                update_pattern_color: (color_id, color_data) => {
                    if (app.ui.pattern_picker.current.id && app.ui.pattern_picker.current.id.trim().length > 0) {
                        app.ws.api.update_user_data('color_patterns', 'list_update', {
                            _key: `list.${color_id}.hue`,
                            _value: color_data
                        }, { id: `${app.ui.pattern_picker.current.id}` }, { boomerang: true });
                    }
                },
                move_pattern_color: (color_id, new_pos) => {
                    if (app.ui.pattern_picker.current.id && app.ui.pattern_picker.current.id.trim().length > 0) {
                        app.ws.api.trigger_node_api('smart-led', 'update_pattern_color_pos', {
                            pattern_id: app.ui.pattern_picker.current.id,
                            color_id: color_id,
                            new_pos: new_pos
                        });
                    }
                },
                delete_pattern_color: (color_id) => {
                    app.ws.api.trigger_node_api('smart-led', 'delete_pattern_color', {
                        pattern_id: app.ui.pattern_picker.current.id,
                        color_id: color_id
                    });
                },
                load_patterns: _ => {
                    app.ws.api.get_user_data('color_patterns');
                },
                color_editor_target_block: 'main/node/menu/submenu/content-wrap/content/patterns/area/editor/colors',
                capture_app_mousemove: (event, block, data) => {
                    // pattern drag event
                    var colors = app.ui.block.child(app.ui.pattern_picker.color_editor_target_block);
                    if (colors) {
                        var hlim = colors.$().height();
                        if (colors.key('$hr') == null) colors.key('$hr', colors.sibling('hr1').$());
                        if (colors.key('draggingitem') != -1) {
                            var pattern_color = colors.child('color_' + colors.key('draggingitem'));
                            var $hr = colors.key('$hr');
                            var pos = event.clientY - ($hr.offset().top + $hr.outerHeight(true));
                            if (pos < 0) pos = -1000; if (pos > hlim) pos = hlim;
                            pos /= pattern_color.$().outerHeight(true);
                            pos = parseInt(pos);
                            var numpatterncolors = Object.keys(colors.children()).length - 1;
                            if (pos >= numpatterncolors) pos = numpatterncolors - 1;
                            if (pos < 0) pos = -1;
                            // console.log(pos);
                            pattern_color.on('setOrdinalPos', {
                                pos: pos
                            });
                        }
                    }
                },
                capture_app_mouseup: (event, block, data) => {
                    var colors = app.ui.block.child(app.ui.pattern_picker.color_editor_target_block);
                    if (colors) {
                        var children = colors.children();
                        for (var c in children) {
                            if (children.hasOwnProperty(c) && c != 'addbutton' && children[c].key('dragging'))
                                children[c].child('handle/imgwrap').on('mouseup');
                        }
                    }
                },
                capture_app_click: (event, block, data) => {
                    app.ui.pattern_picker.send_open_fades_and_times();
                },
                send_open_fades_and_times: _ => {
                    var colors = app.ui.block.child(app.ui.pattern_picker.color_editor_target_block);
                    var children = colors.children();
                    for (var c in children) {
                        if (children.hasOwnProperty(c) && c != 'addbutton') {
                            if (children[c].child('fade/input').css('display') == 'block') {
                                children[c].child('fade/input').on('sendVal');
                            }
                            if (children[c].child('time/input').css('display') == 'block') {
                                children[c].child('time/input').on('sendVal');
                            }
                        }
                    }
                },
                condense_pattern: (pattern_colors = app.ui.pattern_picker.current.list) => {
                    if (pattern_colors) {
                        var pattern_string = "";
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
                        for (var p_c in pattern_colors_list) {
                            var pattern_color = pattern_colors_list[p_c];
                            pattern_string +=
                                util.lpad(pattern_color.fade, 5, "0") +
                                `${pattern_color.hex}` +
                                util.lpad(pattern_color.time, 5, "0") +
                                ",";
                        }
                        pattern_string = pattern_string.substring(0, pattern_string.length - 1);
                        return pattern_string;
                    }
                    return null;
                }
            },
            audio_react_menu: {
                initialize: (resolve) => {
                    if (resolve) resolve();
                },
                submenu_data_editor_block: null,
                music_settings: {
                    enabled: false,
                    smoothing: 95,
                    noise_gate: 15,
                    l_ch: 1,
                    l_invert: false,
                    l_preamp: 100,
                    l_postamp: 1,
                    r_ch: 2,
                    r_invert: false,
                    r_preamp: 100,
                    r_postamp: 1,
                },
                api: {
                    play_music: _ => {
                        if (app.ui.audio_react_menu.music_settings.enabled) {
                            console.log('playing music');
                            var node_id = app.ui.block.child('main/node').key('id');
                            if (node_id != null && node_id && node_id.trim().length > 0) {
                                app.ws.api.update_node_data(`${node_id}`, 'audio', true, false, true);
                            }
                        }
                    },
                    send_smoothing: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('smoothing', transitional);
                    },
                    send_noise_gate: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('noise_gate', transitional);
                    },
                    send_left_invert: _ => {
                        app.ui.audio_react_menu.api.send_value('l_invert');
                    },
                    send_left_channel: _ => {
                        app.ui.audio_react_menu.api.send_value('l_ch');
                    },
                    send_left_preamp: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('l_preamp', transitional);
                    },
                    send_left_postamp: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('l_postamp', transitional);
                    },
                    send_right_invert: _ => {
                        app.ui.audio_react_menu.api.send_value('r_invert');
                    },
                    send_right_channel: _ => {
                        app.ui.audio_react_menu.api.send_value('r_ch');
                    },
                    send_right_preamp: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('r_preamp', transitional);
                    },
                    send_right_postamp: (transitional) => {
                        app.ui.audio_react_menu.api.send_value('r_postamp', transitional);
                    },
                    send_value: (data_key, transitional = false, boomerang = true) => {
                        var node_id = app.ui.block.child('main/node').key('id');
                        if (node_id != null && node_id && node_id.trim().length > 0) {
                            var data_id = `${data_key}`;
                            var data_value = app.ui.audio_react_menu.music_settings[data_id];
                            console.log(`sending update: ${data_id} = ${data_value}`);
                            app.ws.api.update_node_data(`${node_id}`, `audio_${data_id}`, data_value, transitional, boomerang);
                        }
                    }
                }
            }
        }
    }
});