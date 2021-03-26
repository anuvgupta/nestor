/* nestor node device client */

#ifndef __N_CLIENT_H__
#define __N_CLIENT_H__

// libraries
#include <Arduino.h>
#include <WebSocketsClient.h>

// vars
#define SERIAL Serial

// json
#define NODE_SYNC_JSON "{\"event\":\"node_sync\",\"data\":{\"core_code\":\"%s\",\"user\":\"%s\",\"mac\":\"%s\",\"node_type\":\"%s\"}}"

// driver class
class NodeDriver {
private:
	char node_id[25];
	char driver_type[25];
	WebSocketsClient* ws_client;

public:
	NodeDriver() {
		node_id[0] = '\0';
		driver_type[0] = '\0';
	};
	void _init(WebSocketsClient* ws_c) {
		this->ws_client = ws_c;
	}
	void _loop(WebSocketsClient* ws_c) {
		this->_init(ws_c);
	}
	void _set_id(char* id) {
		if (strlen(node_id) < 1)
			strcpy(node_id, id);
	}
	void _set_type(char* t) {
		if (strlen(driver_type) < 1)
			strcpy(driver_type, t);
	}

	void trigger_api(char* api_req, char* api_args) {
		char msg[300];
		char fixed_type[25];
		fixed_type[0] = '\0';
		for (int i = 0; i < strlen(this->driver_type); i++) {
			fixed_type[i] = this->driver_type[i];
			if (fixed_type[i] == '-')
				fixed_type[i] = '|';
		}
		sprintf(msg, "@trapi-%s-%s-%s", fixed_type, api_req, api_args);
		this->ws_client->sendTXT(msg);
	}
	void update(char* id, char* value, bool t) {
		char msg[300];
		sprintf(msg, "@data-%s-%s-%s", id, value, t ? "true" : "false");
		this->ws_client->sendTXT(msg);
	}
	void update(char* id, char* value) {
		this->update(id, value, false);
	}
	char* get_id() {
		return this->node_id;
	}
	char* get_type() {
		return this->driver_type;
	}

	void init();
	void ready();
	void loop();
	void input(char* value);
	void data(char* id, char* value, bool transitional);
	void user_data(char* id, char* value);
};

#endif
