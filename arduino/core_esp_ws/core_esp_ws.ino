/* nestor core device websocket server */

// libraries
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <Hash.h>
#include <NTPClient.h>
#include <WebSocketsClient.h>
#include <WebSocketsServer.h>
#include <WiFiUdp.h>

#include "core_conf.h"
#include "core_esp.h"

// vars
WebSocketsClient ws_client;
WebSocketsServer ws_server(DEVICE_PORT);
boolean ws_client_online = false;
boolean ws_server_online = false;
char node_clients[100][25];
// data
char wifi_ssid[19] = WIFI_SSID;
char device_code[6] = DEVICE_CODE;
char device_id[25] = DEVICE_ID;
char device_user[25] = DEVICE_USER;
char device_ip[16] = "";
char device_sync_json[160] = CORE_SYNC_JSON;
char node_data_json[360] = NODE_DATA_JSON;
char trigger_api_json[401] = TRIGGER_API_JSON;
char node_hb_json[75] = NODE_HB_JSON;
// parsing
int mb_i = 0;
char msgbuff[500];
// time
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org");
const long utcOffsetInSeconds = 60 * 60 * -6;  // GMT -6 = 60 * 60 * -6
int resetOffset = 10;						   // in minutes

void setup() {
	SERIAL.begin(9600);
	SERIAL.setDebugOutput(ESP_VERBOSE);
	if (LOG_VERBOSE) SERIAL.println("\n\n");
	if (LOG_VERBOSE) SERIAL.println("ESP8266");
	if (LOG_VERBOSE) SERIAL.println("nestor core device");
	for (uint8_t t = 3; t > 0; t--) {
		if (LOG_VERBOSE) SERIAL.printf("[boot] wait %d\n", t);
		if (LOG_VERBOSE) SERIAL.flush();
		delay(1000);
	}
	if (LOG_VERBOSE) SERIAL.printf("[wifi] connecting to %s\n", &wifi_ssid);
	WiFi.begin(WIFI_SSID, WIFI_PASS);
	while (WiFi.status() != WL_CONNECTED)
		delay(50);
	if (LOG_VERBOSE) SERIAL.printf("[wifi] connected\n");
	IPAddress localIPAddress = WiFi.localIP();
	if (LOG_VERBOSE) SERIAL.printf("[wifi] ip address: ");
	if (LOG_VERBOSE) SERIAL.println(localIPAddress);
	strcpy(device_ip, localIPAddress.toString().c_str());
	sprintf(device_sync_json, CORE_SYNC_JSON, device_code, device_id, device_user, device_ip, WiFi.macAddress().c_str());
	if (LOG_VERBOSE) SERIAL.printf("[ws_client] connecting\n");
	ws_client_online = true;
	ws_client.begin(API_URL, API_PORT, API_PATH);
	ws_client.onEvent(wsClientEventHandler);
	ws_client.setReconnectInterval(5000);
	ws_client.enableHeartbeat(5000, 3000, 2);
	if (LOG_VERBOSE) SERIAL.printf("[ws_server] connecting\n");
	ws_server.begin();
	ws_server.onEvent(wsServerEventHandler);
	ws_server_online = true;
	if (LOG_VERBOSE) SERIAL.printf("[ws_server] connected\n");
	if (LOG_VERBOSE) SERIAL.printf("[time_client] connecting\n");
	timeClient.begin();
	timeClient.setTimeOffset(utcOffsetInSeconds);
	if (LOG_VERBOSE) SERIAL.printf("[time_client] connected\n");
}

void loop() {
	runResetTimer();
	if (ws_client_online)
		ws_client.loop();
	if (ws_server_online)
		ws_server.loop();
	// check serial for reset message
	if (SERIAL.available()) {
		if (mb_i >= 500) {
			msgbuff[499] = '\n';
			if (LOG_VERBOSE) SERIAL.println(msgbuff);
			mb_i = 0;
		} else {
			char c = SERIAL.read();
			if (c != -1) {
				// SERIAL.print(c);
				if (c == '\n') {
					msgbuff[mb_i] = '\0';
					if (memcmp(msgbuff + mb_i - 5, "reset", 5) == 0) {
						restartESP();
					}
					mb_i = 0;
				} else if (c != 0 && c > 32 && c < 126) {
					msgbuff[mb_i] = c;
					mb_i++;
				}
			}
		}
	}
}

void restartESP() {
	if (LOG_VERBOSE) SERIAL.println(F("[boot] resetting...\n"));
	ESP.restart();
}

int firstTimer = 1;
unsigned long epochTime = 0;
unsigned long nextEpochTime = 0;
void runResetTimer() {
	timeClient.update();
	nextEpochTime = timeClient.getEpochTime();
	if (nextEpochTime - epochTime > resetOffset * 60) {
		epochTime = nextEpochTime;
		if (LOG_VERBOSE) SERIAL.print("[time_client] epoch time: ");
		if (LOG_VERBOSE) SERIAL.println(epochTime);
		if (firstTimer == 1) {
			firstTimer = 0;
			delay(500);
		} else
			restartESP();
	}
}

int findClient(char* n_id) {
	for (int i = 0; i < sizeof(node_clients) / sizeof(char*); i++) {
		if (memcmp(n_id, node_clients[i], 25) == 0) {
			return i;
		}
	}
	return -1;
}

int findDash(uint8_t* buffer, int len, int start) {
	int dash = 0;
	for (int i = start; i < len; i++) {
		if (buffer[i] == '-') {
			if (dash == 0)
				return i;
		}
	}
	return -1;
}

void wsClientEventHandler(WStype_t type, uint8_t* payload, size_t len) {
	switch (type) {
	case WStype_DISCONNECTED:
		ws_client_online = false;
		if (LOG_VERBOSE) SERIAL.printf("[ws_client] disconnected\n");
		restartESP();
		break;
	case WStype_CONNECTED:
		ws_client_online = true;
		if (LOG_VERBOSE) SERIAL.printf("[ws_client] connected to %s\n", payload);
		if (LOG_VERBOSE) SERIAL.printf("[ws_client] syncing device as core\n");
		ws_client.sendTXT(device_sync_json);
		break;
	case WStype_TEXT:
		// SERIAL.printf("[ws_client] received text – %s\n", payload);
		if (len > 224)
			payload[224] = '\0';
		if (memcmp(payload, "@sync-f", 7) == 0) {
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] failed to sync - invalid credentials\n");
		} else if (memcmp(payload, "@sync-t", 7) == 0) {
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] synced as core\n");
		} else if (memcmp(payload, "@hb", 3) == 0) {
			if (LOG_VERBOSE && LOG_HB) SERIAL.printf("[ws_client] heartbeat\n");
			ws_client.sendTXT(CORE_HB_JSON);
			if (ws_server_online)
				ws_server.broadcastTXT("@hb");
		} else if (memcmp(payload, "@node-data", 10) == 0) {
			int dash = findDash(payload, len, 11);
			payload[dash] = '\0';
			char target_node_id[25];
			char field_data[200];
			strcpy(target_node_id, ((const char*)(payload + 11)));
			strcpy(field_data, ((const char*)(payload + dash + 1)));
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] field data for node %s received: %s\n", target_node_id, field_data);
			for (int i = 0; i < sizeof(node_clients) / sizeof(char*); i++) {
				if (memcmp(target_node_id, node_clients[i], 25) == 0) {
					char field_data_full[206];
					sprintf(field_data_full, "@data-%s", field_data);
					ws_server.sendTXT(i, field_data_full, sizeof(field_data_full) / sizeof(field_data_full[0]));
					//if (LOG_VERBOSE) SERIAL.printf("[ws_client] field data for node %s received (full): %s\n", target_node_id, field_data_full);
					break;
				}
			}
		} else if (memcmp(payload, "@user-data", 10) == 0) {
			int dash = findDash(payload, len, 11);
			payload[dash] = '\0';
			char target_node_id[25];
			char user_data[200];
			strcpy(target_node_id, ((const char*)(payload + 11)));
			strcpy(user_data, ((const char*)(payload + dash + 1)));
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] user data for node %s received: %s\n", target_node_id, user_data);
			for (int i = 0; i < sizeof(node_clients) / sizeof(char*); i++) {
				if (memcmp(target_node_id, node_clients[i], 25) == 0) {
					char user_data_full[207];
					sprintf(user_data_full, "@udata-%s", user_data);
					ws_server.sendTXT(i, user_data_full, sizeof(user_data_full) / sizeof(user_data_full[0]));
					//if (LOG_VERBOSE) SERIAL.printf("[ws_client] field data for node %s received (full): %s\n", target_node_id, field_data_full);
					break;
				}
			}
		} else if (memcmp(payload, "@node-hb", 8) == 0) {
			int dash = findDash(payload, len, 9);
			payload[dash] = '\0';
			char target_node_id[25];
			char hb_msg[25];
			strcpy(target_node_id, ((const char*)(payload + 9)));
			strcpy(hb_msg, ((const char*)(payload + dash + 1)));
			int c_id = findClient(target_node_id);
			if (memcmp(hb_msg, "404", 3) == 0) {
				if (LOG_VERBOSE) SERIAL.printf("[ws_client] resetting device %s\n", target_node_id);
				ws_server.disconnect(c_id);
			}
		} else if (memcmp(payload, "@node-reset_i", 13) == 0) {
			int dash = findDash(payload, len, 14);
			payload[dash] = '\0';
			char target_node_id[25];
			strcpy(target_node_id, ((const char*)(payload + 14)));
			int c_id = findClient(target_node_id);
			char field_data_full[100];
			sprintf(field_data_full, "@reset_i-%s", (payload + dash + 1));
			ws_server.sendTXT(c_id, field_data_full, sizeof(field_data_full) / sizeof(field_data_full[0]));
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] new reset interval for node %s: %s\n", target_node_id, (payload + dash + 1));
		} else if (memcmp(payload, "@node-reset", 11) == 0) {
			char target_node_id[25];
			strcpy(target_node_id, ((const char*)(payload + 12)));
			int c_id = findClient(target_node_id);
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] resetting device %s\n", target_node_id);
			ws_server.disconnect(c_id);
		} else if (memcmp(payload, "@core-reset", 11) == 0) {
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] resetting device self\n");
			restartESP();
		} else if (memcmp(payload, "@reset_i", 8) == 0) {
			char* temp_buffer = (char*)(payload + 9);
			temp_buffer[2] = '\0';
			int new_reset_interval = atoi(temp_buffer);
			if (new_reset_interval < 1) new_reset_interval = 1;
			if (new_reset_interval > 30) new_reset_interval = 30;
			resetOffset = new_reset_interval;
			if (LOG_VERBOSE) SERIAL.printf("[ws_client] new reset interval: %s\n", resetOffset);
		}
		break;
	case WStype_BIN:
		if (LOG_VERBOSE) SERIAL.printf("[ws_client] received binary data (length %u):\n", len);
		hexdump(payload, len);
		// ws_client.sendBIN(payload, len);
		break;
	}
}

void wsServerEventHandler(uint8_t id, WStype_t type, uint8_t* payload, size_t len) {
	if (id < sizeof(node_clients) / sizeof(char*)) {
		switch (type) {
		case WStype_DISCONNECTED:
			strcpy(node_clients[id], "$");
			if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] disconnected\n", id);
			break;
		case WStype_CONNECTED: {
			strcpy(node_clients[id], "$");
			if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] connected from ", id);
			if (LOG_VERBOSE) SERIAL.print(ws_server.remoteIP(id));
			if (LOG_VERBOSE) SERIAL.printf("%s\n", payload);
		} break;
		case WStype_TEXT:
			// if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] sent text – %s\n", id, payload);
			if (len > 224)
				payload[224] = '\0';
			if (memcmp(payload, "@id", 3) == 0) {
				if (memcmp(node_clients[id], "$", 1) == 0) {
					strcpy(node_clients[id], ((const char*)(payload + 4)));
					if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] identified as node %s\n", id, node_clients[id]);
					ws_server.sendTXT(id, "@ready", 7);
				}
			} else if (memcmp(payload, "@hb", 3) == 0) {
				if (LOG_VERBOSE && LOG_HB) SERIAL.printf("[ws_server] client[%u] heartbeat\n", id);
				if (memcmp(node_clients[id], "$", 1) != 0 && ws_client_online) {
					sprintf(node_hb_json, NODE_HB_JSON, node_clients[id]);
					ws_client.sendTXT(node_hb_json);
				}
			} else if (memcmp(payload, "@data", 5) == 0) {
				if (memcmp(node_clients[id], "$", 1) != 0 && ws_client_online) {
					int dash1 = findDash(payload, len - 6, 6);
					int dash2 = findDash(payload, len - (dash1 + 1), dash1 + 1);
					payload[dash1] = '\0';
					payload[dash2] = '\0';
					char field_id[25];
					char field_val[200];
					char transitional[10];
					sprintf(field_id, "%s", payload + 6);
					sprintf(field_val, "%s", payload + dash1 + 1);
					sprintf(transitional, "%s", payload + dash2 + 1);
					sprintf(node_data_json, NODE_DATA_JSON, node_clients[id], field_id, field_val, transitional);
					ws_client.sendTXT(node_data_json);
					if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] data update %s %s\n", id, field_id, field_val);
				}
			} else if (memcmp(payload, "@trapi", 6) == 0) {
				if (memcmp(node_clients[id], "$", 1) != 0 && ws_client_online) {
					int dash1 = findDash(payload, len - 7, 7);
					int dash2 = findDash(payload, len - (dash1 + 1), dash1 + 1);
					payload[dash1] = '\0';
					payload[dash2] = '\0';
					char node_type[25];
					char api_req[25];
					char api_args[350];
					sprintf(node_type, "%s", payload + 7);
					sprintf(api_req, "%s", payload + dash1 + 1);
					sprintf(api_args, "%s", payload + dash2 + 1);
					sprintf(trigger_api_json, TRIGGER_API_JSON, /*node_clients[id],*/ node_type, api_req, api_args);
					ws_client.sendTXT(trigger_api_json);
					if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] api triggered %s %s %s\n", id, node_type, api_req, api_args);
				}
			}
			break;
		}
	}
}
