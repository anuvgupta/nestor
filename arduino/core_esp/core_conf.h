/* nestor core device configuration */

// wifi
#define WIFI_SSID "ssid"
#define WIFI_PASS "pass"

// device
#define DEVICE_CODE "v2euO"
#define DEVICE_ID "5ef84bb6177ea49fbad133d4"
#define DEVICE_USER "anuv"
#define DEVICE_PORT 80

// api
//#define API_URL "nestor.anuv.me"
//#define API_PORT 3007
#define API_URL "192.168.86.25"
#define API_PORT 30007

// preferences
#define LOG_HB false
#define LOG_VERBOSE true
#define ESP_VERBOSE false

// json
#define CORE_HB_JSON "{\"event\":\"core_hb\"}"
#define NODE_HB_JSON "{\"event\":\"node_hb\",\"data\":{\"id\":\"%s\"}}"
#define DEVICE_SYNC_JSON "{\"event\":\"core_sync\",\"data\":{\"code\":\"%s\",\"id\":\"%s\",\"user\":\"%s\",\"ip\":\"%s\",\"mac\":\"%s\"}}"
