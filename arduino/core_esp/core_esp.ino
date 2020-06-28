/* nestor core device server */

// libraries
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <WebSocketsServer.h>
#include <Hash.h>
#include "core_conf.h"

// vars
#define SERIAL Serial
// network
WebSocketsClient ws_client;
WebSocketsServer ws_server(DEVICE_PORT);
boolean ws_client_online = false;
boolean ws_server_online = false;
char node_clients[100][25];
// json
char wifi_ssid[8] = WIFI_SSID;
char device_code[6] = DEVICE_CODE;
char device_id[25] = DEVICE_ID;
char device_user[25] = DEVICE_USER;
char device_ip[16] = "";
char device_sync_json[160] = DEVICE_SYNC_JSON;
char node_hb_json[75] = NODE_HB_JSON;
// parsing
int mb_i = 0;
char msgbuff[500];

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
  while (WiFi.status() != WL_CONNECTED) delay(50);
  if (LOG_VERBOSE) SERIAL.printf("[wifi] connected\n");
  IPAddress localIPAddress = WiFi.localIP();
  if (LOG_VERBOSE) SERIAL.printf("[wifi] ip address: ");
  if (LOG_VERBOSE) SERIAL.println(localIPAddress);
  strcpy(device_ip, localIPAddress.toString().c_str());
  sprintf(device_sync_json, DEVICE_SYNC_JSON, device_code, device_id, device_user, device_ip, WiFi.macAddress().c_str());
  if (LOG_VERBOSE) SERIAL.printf("[ws_client] connecting\n");
  ws_client_online = true;
  ws_client.begin(API_URL, API_PORT, "/");
  ws_client.onEvent(wsClientEventHandler);
  ws_client.setReconnectInterval(5000);
  ws_client.enableHeartbeat(5000, 3000, 2);
  if (LOG_VERBOSE) SERIAL.printf("[ws_server] connecting\n");
  ws_server.begin();
  ws_server.onEvent(wsServerEventHandler);
  ws_server_online = true;
  if (LOG_VERBOSE) SERIAL.printf("[ws_server] connected\n");
}

void loop() {
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
      if (len > 224) payload[224] = '\0';
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
        int dash = 0;
        for (int i = 11; i < len; i++) {
          if (payload[i] == '-') {
            if (dash == 0) dash = i;
            break;
          }
        }
        payload[dash] = '\0';
        char target_node_id[25];
        char field_data[200];
        strcpy(target_node_id, ((const char *) (payload + 11)));
        strcpy(field_data, ((const char *) (payload + dash + 1)));
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
      } else if (memcmp(payload, "@node-hb", 8) == 0) {
        int dash = 0;
        for (int i = 9; i < len; i++) {
          if (payload[i] == '-') {
            if (dash == 0) dash = i;
            break;
          }
        }
        payload[dash] = '\0';
        char target_node_id[25];
        char hb_msg[25];
        strcpy(target_node_id, ((const char *) (payload + 9)));
        strcpy(hb_msg, ((const char *) (payload + dash + 1)));
        for (int i = 0; i < sizeof(node_clients) / sizeof(char*); i++) {
          if (memcmp(target_node_id, node_clients[i], 25) == 0) {
            if (memcmp(hb_msg, "404", 3) == 0) {
              if (LOG_VERBOSE) SERIAL.printf("[ws_client] resetting device %s\n", target_node_id);
              ws_server.disconnect(i);
            }
            break;
          }
        }
      }
      break;
    case WStype_BIN:
      if (LOG_VERBOSE) SERIAL.printf("[ws_client] received binary data (length %u):\n", len);
      hexdump(payload, len);
      // ws_client.sendBIN(payload, len);
      break;
  }
}

void wsServerEventHandler(uint8_t id, WStype_t type, uint8_t * payload, size_t len) {
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
        // SERIAL.printf("[ws_server] client[%u] sent text – %s\n", id, payload);
        if (len > 224) payload[224] = '\0';
        if (memcmp(payload, "@id", 3) == 0) {
          if (memcmp(node_clients[id], "$", 1) == 0) {
            strcpy(node_clients[id], ((const char *) (payload + 4)));
            if (LOG_VERBOSE) SERIAL.printf("[ws_server] client[%u] identified as node %s\n", id, node_clients[id]);
          }
        } else if (memcmp(payload, "@hb", 3) == 0) {
          if (LOG_VERBOSE && LOG_HB) SERIAL.printf("[ws_server] client[%u] heartbeat\n", id);
          if (memcmp(node_clients[id], "$", 1) != 0 && ws_client_online) {
            sprintf(node_hb_json, NODE_HB_JSON, node_clients[id]);
            ws_client.sendTXT(node_hb_json);
          }
        }
        break;
    }
  }
}
