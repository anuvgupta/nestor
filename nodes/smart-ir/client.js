/* nestor node web client module (smart-ir) */

nestor.module({
    init: (exports, resolve) => {
        app.ui.ir_remote_menu = exports.ir_remote_menu;
        if (resolve) resolve();
    },
    export: _ => {
        return {
            ir_remote_menu: {
                menu_type: "null",
                menu_profiles: null,
                menu_padding: 80,
                send_button: code => {
                    var node_id = app.ui.block.child('main/node').key('id');
                    if (node_id && node_id != null && node_id.trim().length > 0) {
                        app.ws.api.update_node_data(node_id, 'remote', code, true, true);
                    }
                },
            }
        };
    }
});