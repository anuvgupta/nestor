/* nestor node device configuration */

#ifndef __N_CONF_H__
#define __N_CONF_H__

// wifi
#define WIFI_SSID "ssid"
#define WIFI_PASS "pass"

// device
#define DEVICE_USER "anuv"
#define NODE_TYPE "simple-led"
#define CORE_CODE "AMqBr"
#define CORE_PORT 80

// api
#define API_URL "192.168.86.25"
#define API_PORT 30007

// preferences
#define LOG_HB false
#define LOG_VERBOSE true
#define ESP_VERBOSE false

// json
#define DEVICE_SYNC_JSON "{\"event\":\"node_sync\",\"data\":{\"core_code\":\"%s\",\"user\":\"%s\",\"mac\":\"%s\",\"node_type\":\"%s\"}}"

#endif
