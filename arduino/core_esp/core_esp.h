/* nestor core device server driver */

#ifndef __C_DRIVER_H__
#define __C_DRIVER_H__

// libraries
#include <Arduino.h>

// vars
#define SERIAL Serial

// json
#define CORE_HB_JSON "{\"event\":\"core_hb\"}"
#define NODE_HB_JSON "{\"event\":\"node_hb\",\"data\":{\"id\":\"%s\"}}"
#define CORE_SYNC_JSON "{\"event\":\"core_sync\",\"data\":{\"code\":\"%s\",\"id\":\"%s\",\"user\":\"%s\",\"ip\":\"%s\",\"mac\":\"%s\"}}"
#define NODE_DATA_JSON "{\"event\":\"update_node_data\",\"data\":{\"id\":\"%s\",\"field_id\":\"%s\",\"field_val\":\"%s\",\"transitional\":\"%s\"}}"
#define TRIGGER_API_JSON "{\"event\":\"trigger_node_api\",\"data\":{\"node_type\":\"%s\",\"api_req\":\"%s\",\"api_args\":\"%s\"}}"

#endif
