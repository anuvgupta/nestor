/* MODULE – MQTT CLIENT */
// mqtt publisher & client

/* IMPORTS */
const e = require('express');
const mqtt = require("mqtt");

/* INFRA */
var m = null;
var log = null;
var err = null;


/* MODULE */

// var virtualpin_count = 5;
var mqtt_publisher_client_id = "";
var mqtt_device_sync_topic = `${global.app_id}_sync`;
var broker_url = ""; // test.mosquitto.org:1883
var events = {}; // event handlers
var clients = {};
var publisher = {
    client: null,
    client_options: {
        clientId: "",
    },
    generate_subscribe_callback: topic_name => {
        return (error => {
            if (!error) {
                log(`publisher subscribed to topic \"${topic_name}\"`);
            } else {
                log(error);
                err(error);
            }
        });
    },
    generate_unsubscribe_callback: topic_name => {
        return (error => {
            if (!error) {
                log(`publisher unsubscribed from topic \"${topic_name}\"`);
            } else {
                log(error);
                err(error);
            }
        });
    },
    post: (arg, ch) => {
        if (global.hb_log || (ch.substring(ch.length - 3) != "_hb" && ch.substring(ch.length - 8) != "_hb_recv")) {
            log(`publisher posting to topic "${ch}" message: ${arg}`);
        }
        publisher.client.publish(ch, arg);
    },
};
var bind_events = (resolve = null) => {
    // attach topic events
    // for (var i = 0; i < global.config.virtualpin_count; i++) {
    //     mq.bind(db.api.get_virtualpin_topic(i), mq.generate_virtualpin_eventhandler(i));
    // }
    publisher.client.subscribe(mqtt_device_sync_topic, publisher.generate_subscribe_callback(mqtt_device_sync_topic));
    bind(mqtt_device_sync_topic, (topic, req) => {
        try {
            req = JSON.parse(req);
        } catch (e) {
            err(e);
            return;
        }
        var client = {
            topic: `${global.app_id}_${req.dev_type}_${req[`${req.dev_type}_type`]}_${req.mac}`,
            id: "_c_mq_" + m.utils.rand_id(),
            o_id: null,
            auth: false,
            type: "node",
            protocol: "mq",
            core_code: req.core_code,
            standalone: (req.dev_type == "thing")
        };
        clients[client.id] = client;
        log(`client ${client.id} – connected`);
        m.ws.trigger_for_mq_client('node_sync', {
            core_code: `${req.core_code}`,
            user: `${req.user}`,
            node_type: `${req[`${req.dev_type}_type`]}`,
            mac: `${req.mac}`,
            standalone: (req.dev_type == "thing")
        }, client, false);
        subscribe_client_events(client);
    });
    if (resolve) resolve();
};
// var generate_virtualpin_eventhandler = vpin_num => {
//     return (topic, message, db) => {
//         // main.update_virtual_pin(vpin_num, parseInt(message), message);
//     };
// };
// bind handler to topic event
var bind = (topic, handler) => {
    events[topic] = (message) => {
        // check auth here later if necessary
        handler(topic, message.toString());
    };
};
var client_topic_exists = topic => {
    for (var c in clients) {
        if (topic.includes(clients[c].topic)) {
            return true;
        }
    }
    return false;
};
var client_from_topic = topic => {
    for (var c in clients) {
        if (topic.includes(clients[c].topic)) {
            return clients[c];
        }
    }
    return null;
};
var client_from_node_id = node_id => {
    for (var c in clients) {
        if (clients[c].o_id == node_id) {
            return clients[c];
        }
    }
    return null;
};
var client_event_handler = (topic_abbv, message, client) => {
    if (topic_abbv == 'hb') {
        if (message == "hb_echo") {
            m.ws.trigger_for_mq_client('thing_hb', {
                id: `${client.o_id}`
            }, client, false);
        }
    } else if (topic_abbv == 'node-data_recv') {
        log(topic_abbv, message);
    } else if (topic_abbv == 'user-data_recv') {
        log(topic_abbv, message);
    } else if (topic_abbv == 'trigger-api_recv') {
        // log(topic_abbv, message);
        var message_parts = message.split('-');
        var req = {
            node_type: message_parts[0],
            api_req: message_parts[1],
            api_args: message_parts[2]
        };
        var client_node_id = client.o_id.toString();
        // console.log(client_node_id);
        m.db.get_node_info(client_node_id, null, client.id, node => {
            if (node === false || node === null) return;
            var client_user_id = `${node.user_id}`;
            if (req.hasOwnProperty('node_type') && req.hasOwnProperty('api_req') && req.hasOwnProperty('api_args')) {
                req.api_args.user_id = client_user_id;
                req.node_type = req.node_type.split('|').join('-');
                m.main.call_driver_api(req.node_type, req.api_req, req.api_args, result1 => {
                    if (result1 === null || result1 === false) return;
                    log(`trigger_node_api | client ${client.id} triggered node api ${req.node_type}.${req.api_req}`);
                });
            }
        });
    }
};
var subscribe_client_events = (client) => {
    // heartbeat event
    m.mq.subscribe_topic(`${client.topic}_hb`);
    m.mq.subscribe_topic(`${client.topic}_node-data_recv`);
    m.mq.subscribe_topic(`${client.topic}_user-data_recv`);
    m.mq.subscribe_topic(`${client.topic}_trigger-api_recv`);
};
var unsubscribe_client_events = (client) => {
    m.mq.unsubscribe_topic(`${client.topic}_hb`);
    m.mq.unsubscribe_topic(`${client.topic}_node-data_recv`);
    m.mq.unsubscribe_topic(`${client.topic}_user-data_recv`);
    m.mq.unsubscribe_topic(`${client.topic}_trigger-api_recv`);
};
var init = resolve => {
    publisher.client.on('connect', _ => {
        log(`publisher connected to broker ${broker_url} as ${publisher.client_options.clientId}`);
        bind_events();
    });
    publisher.client.on('message', (topic, message) => {
        if (global.hb_log || (topic.substring(topic.length - 3) != "_hb" && topic.substring(topic.length - 8) != "_hb_recv")) {
            log(`subscriber received message on topic \"${topic.toString()}\":`, message.toString());
        }
        if (events.hasOwnProperty(topic))
            events[topic](message.toString());
        else if (client_topic_exists(topic)) {
            var cl = client_from_topic(topic);
            var topic_short = topic.substring(cl.topic.length + 1);
            // console.log(topic_short);
            client_event_handler(topic_short, message.toString(), cl);
        } else err("unknown event", topic);
    });
    if (resolve) resolve();
};
var api = {
    unsubscribe_topic: (topic, resolve = null) => {
        publisher.client.unsubscribe(topic, publisher.generate_unsubscribe_callback(topic));
        if (resolve) resolve();
    },
    subscribe_topic: (topic, resolve = null) => {
        publisher.client.subscribe(topic, publisher.generate_subscribe_callback(topic));
        if (resolve) resolve();
    },
    send_to_device: (event, data, client) => {
        // log('trace - send_to_device 1');
        if (clients.hasOwnProperty(client.id) && client.protocol == "mq") {
            // log('trace - send_to_device 2');
            publisher.post(`${data}`, `${client.topic}_${event}`);
        }
    },
    send_to_device_by_node_id: (event, data, node_id) => {
        // log('trace - send_to_device_by_node_id 1');
        for (var c in clients) {
            if (clients[c].o_id == node_id) {
                // log('trace - send_to_device_by_node_id 2');
                publisher.post(`${data}`, `${clients[c].topic}_${event}`);
                break;
            }
        }
    },
    broadcast_thing_hb: () => {
        for (var c in clients) {
            if (clients[c].type == 'node' && clients[c].standalone == true) {
                m.mq.send_to_device('hb_recv', 'hb', clients[c]);
            }
        }
    },
    remove_client: (node_id) => {
        for (var c in clients) {
            if (clients[c].o_id == node_id) {
                unsubscribe_client_events(clients[c]);
                delete clients[c];
                break;
            }
        }
    },
    prune_duplicates: (node_id, preserve_mq_client_id) => {
        var keys = Object.keys(clients);
        for (var k in keys) {
            var c = keys[k];
            if (clients[c].o_id == node_id && clients[c].id != preserve_mq_client_id) {
                delete clients[c];
            }
        }
    },
    client_from_node_id: client_from_node_id,
    send_initial_val: (field_id, field_val, client) => {
        m.mq.send_to_device('node-data', `${field_id}-false-${field_val}`, client);
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
        broker_url = global.mqtt_broker_url;
        mqtt_publisher_client_id = global.app_id;
        publisher.client_options.clientId = `${mqtt_publisher_client_id}${(global.env == 'dev') ? '_dev' : ''}`;
        publisher.client = mqtt.connect(`mqtt://${broker_url}`, publisher.client_options);
        module.exports.api.exit = resolve => {
            log("exit");
            mqtt.client.end();
            if (resolve) resolve();
        };
        init();
    },
    api: api
};

