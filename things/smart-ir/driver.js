/* nestor thing server driver (smart-ir) */

const thing_type = "smart-ir";

module.exports = {
    init: (m, log) => {
        return {
            link: (node, client, value, transitional, next) => {
                var value_prev = node.data.hasOwnProperty('link') && node.data.link;
                if (value_prev) m.main.remove_node_shortcut(value_prev);
                if (value != 'null') {
                    var exec_code = m.main.get_driver_field_metadata(thing_type, 'link', 'editor-options')['shortcut-exec'];
                    if (exec_code) m.main.set_node_shortcut(value, node._id.toString(), node.core_id, thing_type, "exec", 'link', exec_code, node.data.hasOwnProperty('icon') ? node.data.icon : null, node.name);
                }
                next();
            },
            icon: (node, client, value, transitional, next) => {
                if (node.data.hasOwnProperty('link') && node.data.link && node.data.link != null && node.data.link != 'null') {
                    var node_shortcut = m.main.get_node_shortcut(node.data.link);
                    if (node_shortcut && node_shortcut != null) {
                        if (value && value != null && value != 'null') {
                            m.main.set_node_shortcut(node.data.link, node_shortcut.id, node_shortcut.core_id, node_shortcut.type, node_shortcut.action, node_shortcut.field_id, node_shortcut.data, value, node.name);
                        }
                    }
                }
                next();
            },
        };
    },
    api: {
        __create: (m, log, node) => {
            m.main.call_driver_api(thing_type, 'setup_shortcut', [node], null);
        },
        __spawn: (m, log, node) => {
            m.main.call_driver_api(thing_type, 'setup_shortcut', [node], null);
        },
        setup_shortcut: (m, log, api_args, resolve) => {
            var node = api_args[0];
            var value = null;
            if (node.data.hasOwnProperty('link') && node.data.link.trim().length > 0 && node.data.link != 'null')
                value = node.data.link;
            var icon = null;
            if (node.data.hasOwnProperty('icon') && node.data.icon.trim().length > 0 && node.data.icon != 'null')
                icon = node.data.icon;
            if (value) {
                var exec_code = m.main.get_driver_field_metadata(thing_type, 'link', 'editor-options')['shortcut-exec'];
                if (exec_code) m.main.set_node_shortcut(value, node._id.toString(), node.core_id, thing_type, "exec", 'link', exec_code, icon, node.name);
                if (resolve) resolve(true);
            } else {
                if (resolve) resolve(false);
            }
        }
    }
};