/* MODULE – DATABASE */
// database API wrapper

/* IMPORTS */
const mongodb = require('mongodb');

/* INFRA */
var m = null;
var log = null;
var err = null;



/* MODULE */
var mongo_port = null;
var mongo_dbname = null;
var mongo_client = null;
var mongo_api = null;
var init = _ => { };
var api = {
    o_id: mongodb.ObjectId,
    example: (table, resolve) => {
        log(`example | received table name ${table}`);
        mongo_api.collection(table).find({}, (error1, cursor1) => {
            if (error1) {
                err(`example | error retrieving table ${table}`, error1.message ? error1.message : error1);
                resolve(false);
            } else {
                cursor1.count().then(c => {
                    if (c <= 0) {
                        err(`example | error retrieving table ${table} – not found`);
                        resolve(null);
                    } else {
                        cursor1.toArray().then(resolve);
                    }
                });
            }
        });
    },
    auth: (username, password, client_id, resolve) => {
        mongo_api.collection('users').findOne({ username: username, password: password }, (error1, item1) => {
            if (error1) {
                err(`auth | ${client_id} error - login validation`, error1);
                resolve(false);
            } else {
                if (item1 == null)
                    resolve(null);
                else resolve(item1);
            }
        });
    },
    new_core: (core, client_id, resolve) => {
        mongo_api.collection('cores').insertOne(core, (error1, status1) => {
            if (error1) {
                err(`new_core | client ${client_id} error`, error1);
                resolve(false);
            } else {
                if (status1.insertedCount < 1) {
                    err(`new_core | client ${client.id} error - not created`);
                    resolve(false);
                } else resolve(status1);
            }
        });
    },
    get_core_list: (user_id, client_id, resolve) => {
        mongo_api.collection('cores').find({ user_id: user_id }).toArray((error1, items1) => {
            if (error1) {
                err(`get_core_list | client ${client_id} error - get cores`, error1);
                resolve(false);
            } else resolve(items1);
        });
    },
    get_core_info: (core_id, user_id, core_code, client_id, resolve) => {
        var _find = {};
        var core_unique = null;
        if (core_id !== null) {
            _find._id = m.db.o_id(core_id);
            core_unique = _find._id;
        } else if (core_code !== null) {
            _find.code = core_code;
            core_unique = _find.core_code;
        } else {
            err(`get_core_info | client ${client_id} error - missing unique (id or code)`, error1);
            resolve(false);
        }
        if (user_id !== null)
            _find.user_id = user_id;
        mongo_api.collection('cores').findOne(_find, (error1, item1) => {
            if (error1) {
                err(`get_core_info | client ${client_id} error - get core ${core_unique}`, error1);
                resolve(false);
            } else {
                if (item1 == null) {
                    err(`get_core_info | client ${client_id} error - get core ${core_unique} (not found)`);
                    resolve(null);
                } else resolve(item1);
            }
        });
    },
    delete_nodes: (node_ids, client_id, resolve) => {
        var in_ids = [];
        for (var i in node_ids) {
            in_ids.push(m.db.o_id(node_ids[i]));
        }
        mongo_api.collection('nodes').deleteMany({ _id: { $in: in_ids } }, (error1, result1) => {
            if (error1) {
                err(`delete_nodes | client ${client_id} error - delete ${node_ids}`, error1);
                resolve(false);
            } else resolve(result1);
        });
    },
    delete_core_nodes: (core_id, node_ids, user_id, client_id, resolve) => {
        var in_ids = [];
        for (var i in node_ids) {
            in_ids.push(m.db.o_id(node_ids[i]));
        }
        mongo_api.collection('cores').findOne({ _id: m.db.o_id(core_id), user_id: user_id }, (error1, core) => {
            if (error1) {
                err(`delete_core_nodes | client ${client_id} error - get core ${core_id}`, error1);
                resolve(false);
            } else {
                if (core == null) err(`delete_core_nodes | client ${client_id} error - get core ${core_id} (not found)`);
                else {
                    var unset = {};
                    for (var mac in core.nodes) {
                        if (node_ids.includes(core.nodes[mac])) {
                            unset[`nodes.${mac}`] = "";
                        };
                    }
                    mongo_api.collection('cores').updateOne({ _id: m.db.o_id(core_id), user_id: user_id }, { $unset: unset }, (error2, result2) => {
                        if (error2) {
                            err(`delete_core_nodes | client ${client_id} error - update core ${core_id}`, error2);
                            resolve(false);
                        } else resolve(result2);
                    });
                }
            }
        });
    },
    delete_core: (core_id, user_id, client_id, resolve) => {
        var _find = {
            _id: m.db.o_id(core_id)
        };
        if (user_id !== null)
            _find.user_id = user_id;
        mongo_api.collection('cores').deleteOne(_find, (error1, result1) => {
            if (error1) {
                err(`delete_core | client ${client_id} error - delete ${core_id}`, error1);
                resolve(false);
            } else resolve(result1);
        });
    },
    get_user_info: (user_id, username, client_id, resolve) => {
        var _find = {
            _id: m.db.o_id(user_id)
        };
        if (username !== null)
            _find.username = username;
        mongo_api.collection('users').findOne(_find, (error1, item1) => {
            if (error1) {
                err(`get_user | client ${client_id} error - get user ${user_id}`, error1);
                resolve(false);
            } else {
                if (item1 == null) {
                    err(`get_user | client ${client_id} error - get user ${user_id} (not found)`);
                    resolve(null);
                } else resolve(item1);
            }
        });
    },
    set_core_name: (core_id, core_name, client_id, resolve) => {
        mongo_api.collection('cores').updateOne({ _id: m.db.o_id(core_id) }, {
            $set: { name: core_name }
        }, (error1, result1) => {
            if (error1) {
                err(`set_core_name | ${client_id} error - update core ${core_id}`, error1);
                resolve(false);
            } else {
                if (result1.matchedCount < 1) {
                    err(`set_core_name | ${client_id} error - update core ${core_id} (not found)`);
                    resolve(false);
                } else resolve(result1);
            }
        });
    },
    set_core_status: (core_id, status_text, status_time, client_id, resolve) => {
        mongo_api.collection('cores').updateOne({ _id: m.db.o_id(core_id) }, {
            $set: {
                status: status_text,
                status_time: status_time !== null ? status_time : (new Date()).getTime()
            }
        }, (error1, result1) => {
            if (error1) {
                err(`set_core_status | ${client_id} error - update core ${core_id}`, error1);
                resolve(false);
            } else {
                if (result1.matchedCount < 1) {
                    err(`set_core_status | ${client_id} error - update core ${core_id} (not found)`);
                    resolve(false);
                } else resolve(result1);
            }
        });
    },
    set_core_network: (core_id, core_ipi, core_mac, client_id, resolve) => {
        mongo_api.collection('cores').updateOne({ _id: m.db.o_id(core_id) }, {
            $set: { ip: core_ipi, mac: core_mac }
        }, (error1, result1) => {
            if (error1) {
                err(`set_core_network | ${client_id} error - update core ${core_id}`, error1);
                resolve(false);
            } else {
                if (result1.matchedCount < 1) {
                    err(`set_core_network | ${client_id} error - update core ${core_id} (not found)`);
                    resolve(false);
                } else resolve(result1);
            }
        });
    },
    get_node_info: (node_id, user_id, client_id, resolve) => {
        var _find = {
            _id: m.db.o_id(node_id)
        };
        if (user_id !== null)
            _find.user_id = user_id;
        mongo_api.collection('nodes').findOne(_find, (error1, item1) => {
            if (error1) {
                err(`get_node_info | client ${client_id} error - get node ${node_id}`, error1);
                resolve(false);
            } else {
                if (item1 == null) {
                    err(`get_node_info | client ${client_id} error - get node ${node_id} (not found)`);
                    resolve(null);
                } else resolve(item1);
            }
        });
    },
    set_node_name: (node_id, node_name, user_id, client_id, resolve) => {
        var _find = {
            _id: m.db.o_id(node_id)
        };
        if (user_id !== null)
            _find.user_id = user_id;
        mongo_api.collection('nodes').updateOne(_find, {
            $set: { name: node_name }
        }, (error1, result1) => {
            if (error1) {
                err(`set_node_name | ${client_id} error - update node ${node_id}`, error1);
                resolve(false);
            } else {
                if (result1.matchedCount < 1) {
                    err(`set_node_name | ${client_id} error - update node ${node_id} (not found)`);
                    resolve(false);
                } else resolve(result1);
            }
        });
    },
    set_node_status: (node_id, status_text, status_time, client_id, resolve) => {
        mongo_api.collection('nodes').updateOne({ _id: m.db.o_id(node_id) }, {
            $set: {
                status: status_text,
                status_time: status_time !== null ? status_time : (new Date()).getTime()
            }
        }, (error1, result1) => {
            if (error1) {
                err(`set_node_status | ${client_id} error - update node ${node_id}`, error1);
                resolve(false);
            } else {
                if (result1.matchedCount < 1) {
                    err(`set_node_status | ${client_id} error - update node ${node_id} (not found)`);
                    resolve(false);
                } else resolve(result1);
            }
        });
    },
    new_node: (node, client_id, resolve) => {
        mongo_api.collection('nodes').insertOne(node, (error1, status1) => {
            if (error1) {
                err(`new_node | client ${client_id} error - insert node`, error1);
                resolve(false);
            } else {
                if (status1.insertedCount < 1) {
                    err(`new_node | client ${client_id} error - insert node (not created)`);
                    resolve(false);
                } else resolve(status1);
            }
        });
    },
    new_core_node: (core_id, node_id, node_mac, client_id, resolve) => {
        var set = { $set: {} };
        set["$set"]["nodes." + node_mac] = node_id;
        mongo_api.collection('cores').updateOne({ _id: m.db.o_id(core_id) }, set, (error1, status1) => {
            if (error1) {
                err(`new_core_node | client ${client_id} error - update core`, error1);
                resolve(false);
            } else {
                if (status1.insertedCount < 1) {
                    err(`new_core_node | client ${client_id} error - update core (not updated)`);
                    resolve(false);
                } else resolve(status1);
            }
        });
    },
    set_node_data: (node_id, field_id, field_val, client_id, resolve) => {
        var set = {};
        set[`data.${field_id}`] = field_val;
        mongo_api.collection('nodes').updateOne({ _id: m.db.o_id(node_id) }, { $set: set }, (error1, result) => {
            if (error1) {
                err(`set_node_data | client ${client_id} error - update node ${node_id} data (update node)`, error1);
                resolve(false);
            } else resolve(result);
        });
    },
    get_online_cores: (resolve) => {
        mongo_api.collection('cores').find({ status: { $in: ["online", "desync"] } }).toArray((error1, cores) => {
            if (error1) {
                err(`get_online_cores | error - get core list`, error1);
                resolve(false);
            } else {
                if (cores == null) {
                    err(`get_online_cores | error - get core list (not found)`);
                    resolve(null);
                } else resolve(cores);
            }
        });
    },
    get_online_nodes: (resolve) => {
        mongo_api.collection('nodes').find({ status: { $in: ["online", "desync"] } }).toArray((error1, nodes) => {
            if (error1) {
                err(`get_online_nodes | error - get node list`, error1);
                resolve(false);
            } else {
                if (nodes == null) {
                    err(`get_online_nodes | error - get node list (not found)`);
                    resolve(null);
                } else resolve(nodes);
            }
        });
    },
    get_user_nodes: (user_id, resolve) => {
        mongo_api.collection('nodes').find({ user_id: `${user_id}` }).toArray((error1, nodes) => {
            if (error1) {
                err(`get_user_nodes | error - get node list`, error1);
                resolve(false);
            } else {
                if (nodes == null) {
                    err(`get_user_nodes | error - get node list (not found)`);
                    resolve(null);
                } else resolve(nodes);
            }
        });
    },
    get_all_nodes: (resolve) => {
        mongo_api.collection('nodes').find({}).toArray((error1, nodes) => {
            if (error1) {
                err(`get_all_nodes | error - get node list`, error1);
                resolve(false);
            } else {
                if (nodes == null) {
                    err(`get_all_nodes | error - get node list (not found)`);
                    resolve(null);
                } else resolve(nodes);
            }
        });
    },
    update_core_status: (core_ids, status, resolve) => {
        mongo_api.collection('cores').updateMany({ _id: { $in: core_ids } }, { $set: { status: status } }, (error1, result) => {
            if (error1) {
                err(`update_core_status | failed to update status to ${status} for cores ${core_ids}`, error1);
                if (resolve) resolve(false);
            } else {
                if (resolve) resolve(true);
            }
        });
    },
    update_node_status: (node_ids, status, resolve) => {
        mongo_api.collection('nodes').updateMany({ _id: { $in: node_ids } }, { $set: { status: status } }, (error1, result) => {
            if (error1) {
                err(`update_node_status | failed to update status to ${status} for nodes ${node_ids}`, error1);
                if (resolve) resolve(false);
            } else {
                if (resolve) resolve(true);
            }
        });
    },
    update_user_data: (user_id, data_key, data_action, data_value, data_query, options, resolve) => {
        var update_action = {};
        var update_params = {};
        if (data_action == 'set') {
            data_action = '$set';
            data_key = `data.${data_key}`;
        } else if (data_action == 'delete') {
            data_action = '$unset';
            data_key = `data.${data_key}`;
            data_value = '';
        } else if (data_action == 'list_append') {
            data_action = '$push';
            data_key = `data.${data_key}`;
        } else if (data_action == 'list_remove') {
            data_action = '$pull';
            data_key = `data.${data_key}`;
            data_value = data_query;
            // data_value is a query ie. data_value = { name: 'magenta' };
        } else if (data_action == 'list_update') {
            data_action = '$set';
            data_key = `data.${data_key}.$[elem]`;
            var query_key = null;
            var query_val = null;
            if (data_query.hasOwnProperty('_key') && data_query.hasOwnProperty('_value')) {
                query_key = data_query._key;
                query_val = data_query._value;
                // query format 1
            } else {
                query_key = Object.keys(data_query)[0];
                query_val = data_query[query_key];
                // query format 2
            }
            if (options == null || !(options.hasOwnProperty('replace')) || options.replace != true) {
                if (data_value.hasOwnProperty('_key') && data_value.hasOwnProperty('_value')) {
                    data_key += `.${data_value._key}`;
                    data_value = data_value._value;
                    // data format 1
                } else {
                    var subkey = Object.keys(data_value)[0];
                    data_key += `.${subkey}`;
                    data_value = data_value[subkey];
                    // by default, do not replace object
                    // data format 2
                }

            }
            update_params.arrayFilters = [{}];
            update_params.arrayFilters[0][`elem.${query_key}`] = query_val;
        }
        update_action[data_action] = {};
        update_action[data_action][data_key] = data_value;
        // log(update_action, update_params);
        mongo_api.collection('users').updateOne({ _id: m.db.o_id(user_id) }, update_action, update_params, (error1, result) => {
            if (error1) {
                err(`update_user_data | failed to update user data ${data_key} for user ${user_id}`, error1);
                if (resolve) resolve(false);
            } else {
                if (resolve) resolve(true);
            }
        });
    },
    get_user_data: (user_id, data_key, resolve) => {
        mongo_api.collection('users').findOne({
            _id: m.db.o_id(user_id)
        }, (error1, item1) => {
            if (error1) {
                err(`get_user_data | client ${client_id} error - get user data ${data_key}`, error1);
                resolve(false);
            } else {
                if (item1 == null) {
                    err(`get_user_data | client ${client_id} error - user data ${data_key} (not found)`);
                    resolve(null);
                } else {
                    if (item1.data.hasOwnProperty(data_key)) {
                        resolve(item1.data[data_key]);
                    } else resolve(null);
                }
            }
        });
    }
};



/* EXPORT */
module.exports = {
    id: null,
    init: id => {
        module.exports.id = id;
        m = global.m;
        log = m.utils.logger(id, false);
        err = m.utils.logger(id, true);
        log("initializing");
        mongo_port = global.mdb_port;
        mongo_dbname = global.mdb_db;
        mongo_client = mongodb.MongoClient;
        mongo_client.connect("mongodb://localhost:" + mongo_port, { useUnifiedTopology: true }, (e, client) => {
            if (e) err("connection error", e);
            else {
                log("connected to", mongo_port);
                mongo_api = client.db(mongo_dbname);
            }
        });
        init();
    },
    api: api
};