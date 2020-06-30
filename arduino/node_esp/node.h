/* nestor node device client driver */

#ifndef __N_DRIVER_H__
#define __N_DRIVER_H__

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
    char* driver_type;
    WebSocketsClient* ws_client;
  public:
    NodeDriver() { };
    void _init(WebSocketsClient* ws_c) {
     this->ws_client = ws_c;
    }
    void init();
    void _loop(WebSocketsClient* ws_c) {
      this->_init(ws_c);
    }
    void loop();
    void data(char* id, char* value);
    void update(char* id, char* value, bool t) {
      char msg[300];
      sprintf(msg, "@data-%s-%s-%s", id, value, t ? "true":"false");
      this->ws_client->sendTXT(msg);
    }
    void update(char* id, char* value) {
      this->update(id, value, false);
    }
};

#endif
