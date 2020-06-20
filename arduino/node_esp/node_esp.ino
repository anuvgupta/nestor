/* nestor node device client */

// libraries
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <Hash.h>
#include "node_conf.h"

// vars
#define SERIAL Serial
// network
WebSocketsClient ws_api_client;
boolean ws_api_client_online = false;
WebSocketsClient ws_node_client;
boolean ws_node_client_online = false;
// data
char wifi_ssid[8] = WIFI_SSID;
char device_user[25] = DEVICE_USER;
char core_code[6] = CORE_CODE;
char node_type[25] = NODE_TYPE;
char core_ip[16] = "";
#define DEVICE_SYNC_JSON "{\"event\":\"node_sync\",\"data\":{\"core_code\":\"%s\",\"user\":\"%s\",\"node_id\":\"%d\",\"node_type\":\"%s\"}}"
char device_sync_json[150] = DEVICE_SYNC_JSON;
// parsing
int mb_i = 0;
char msgbuff[500];

void setup() {
  SERIAL.begin(9600);
  SERIAL.setDebugOutput(ESP_VERBOSE);
  if (LOG_VERBOSE) SERIAL.println("\n\n");
  if (LOG_VERBOSE) SERIAL.println("ESP8266");
  if (LOG_VERBOSE) SERIAL.println("nestor node device");
  for (uint8_t t = 3; t > 0; t--) {
    if (LOG_VERBOSE) SERIAL.printf("[boot] wait %d\n", t);
    if (LOG_VERBOSE) SERIAL.flush();
    delay(1000);
  }
  if (LOG_VERBOSE) SERIAL.printf("[wifi] connecting to %s\n", &wifi_ssid);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(50);
  if (LOG_VERBOSE) SERIAL.printf("[wifi] connected\n");
  if (LOG_VERBOSE) SERIAL.printf("[wifi] ip address: ");
  if (LOG_VERBOSE) SERIAL.println(WiFi.localIP());
  sprintf(device_sync_json, DEVICE_SYNC_JSON, core_code, device_user, NODE_ID, node_type);
  ws_node_client.setReconnectInterval(5000);
  ws_node_client.enableHeartbeat(5000, 3000, 2);
  if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] connecting\n");
  ws_api_client_online = true;
  ws_api_client.onEvent(wsAPIClientEventHandler);
  ws_api_client.setReconnectInterval(5000);
  ws_api_client.enableHeartbeat(5000, 3000, 2);
  ws_api_client.begin(API_URL, API_PORT, "/");
}

void loop() {
  if (ws_api_client_online)
    ws_api_client.loop();
  if(ws_node_client_online)
    ws_node_client.loop();
  // check serial for reset message
  if (Serial.available()) {
    if (mb_i >= 500) {
      msgbuff[499] = '\n';
      if (LOG_VERBOSE) Serial.println(msgbuff);
      mb_i = 0;
    } else {
      char c = Serial.read();
      if (c != -1) {
        // Serial.print(c);
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
  if (LOG_VERBOSE) Serial.println(F("[boot] resetting...\n"));
  ESP.restart();
}

void wsAPIClientEventHandler(WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_DISCONNECTED:
      ws_api_client_online = false;
      if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] disconnected\n");
      break;
    case WStype_CONNECTED:
      ws_api_client_online = true;
      if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] connected to %s\n", payload);
      if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] syncing device as node\n");
      ws_api_client.sendTXT(device_sync_json);
      break;
    case WStype_TEXT:
      // SERIAL.printf("[ws_api_client] received text – %s\n", payload);
      if (len > 224) payload[224] = '\0';
      if (memcmp(payload, "@sync-f", 8) == 0) {
        if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] failed to sync - invalid credentials\n");
      } else if (memcmp(payload, "@sync-t", 8) == 0) {
        if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] synced as node\n");
      } else if (memcmp(payload, "@core-ipi", 9) == 0) {
        strcpy(core_ip, ((const char *) (payload + 10)));
        if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] core IP received: %s\n", core_ip);
        ws_api_client.disconnect();
        ws_node_client_online = true;
        ws_node_client.onEvent(wsNodeClientEventHandler);
        ws_node_client.begin(core_ip, CORE_PORT, "/");
      }
      break;
    case WStype_BIN:
      if (LOG_VERBOSE) SERIAL.printf("[ws_api_client] received binary data (length %u):\n", len);
      hexdump(payload, len);
      // ws_api_client.sendBIN(payload, len);
      break;
  }
}

void wsNodeClientEventHandler(WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_DISCONNECTED:
      ws_node_client_online = false;
      if (LOG_VERBOSE) SERIAL.printf("[ws_node_client] disconnected\n");
      restartESP();
      break;
    case WStype_CONNECTED:
      ws_node_client_online = true;
      if (LOG_VERBOSE) SERIAL.printf("[ws_node_client] connected to %s\n", payload);
      //      if (LOG_VERBOSE) SERIAL.printf("[ws_node_client] syncing device as node\n");
      //      ws_node_client.sendTXT(device_sync_json);
      break;
    case WStype_TEXT:
      // SERIAL.printf("[ws_node_client] received text – %s\n", payload);
      if (len > 224) payload[224] = '\0';
      if (memcmp(payload, "@hb", 3) == 0) {
        if (LOG_VERBOSE) SERIAL.printf("[ws_node_client] heartbeat\n");
        ws_node_client.sendTXT("@hb");
      }
      break;
    case WStype_BIN:
      if (LOG_VERBOSE) SERIAL.printf("[ws_node_client] received binary data (length %u):\n", len);
      hexdump(payload, len);
      // ws_node_client.sendBIN(payload, len);
      break;
  }
}
