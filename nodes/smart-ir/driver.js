/* nestor node server driver (smart-ir) */

const node_type = "smart-ir";

module.exports = {
    init: (m, log) => {
        return {
            link: (node, client, value, transitional, next) => {
                var value_prev = node.data.hasOwnProperty('link') && node.data.link;
                if (value_prev) m.main.remove_node_shortcut(value_prev);
                var exec_code = m.main.get_driver_field_metadata(node_type, 'link', 'editor-options')['shortcut-exec'];
                if (exec_code) m.main.set_node_shortcut(value, node._id.toString(), node.core_id, node_type, "exec", 'link', exec_code);
                next();
            },
        };
    },
    api: {
        __create: (m, log, node) => {
            m.main.call_driver_api(node_type, 'setup_shortcut', [node], null);
        },
        __spawn: (m, log, node) => {
            m.main.call_driver_api(node_type, 'setup_shortcut', [node], null);
        },
        setup_shortcut: (m, log, api_args, resolve) => {
            var node = api_args[0];
            var value = null;
            if (node.data.hasOwnProperty('link') && node.data.link.trim().length > 0)
                value = node.data.link;
            var exec_code = m.main.get_driver_field_metadata(node_type, 'link', 'editor-options')['shortcut-exec'];
            if (exec_code) m.main.set_node_shortcut(value, node._id.toString(), node.core_id, node_type, "exec", 'link', exec_code);
            if (resolve) resolve(true);
        }
    }
};