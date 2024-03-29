/* nestor thing device configuration */

#ifndef __T_CONF_H__
#define __T_CONF_H__

// wifi
#define WIFI_SSID "21 Resident"
#define WIFI_PASS "Hookem*2101"

// device
#define DEVICE_USER "anuv"
#define THING_TYPE "smart-led"
#define CORE_CODE "xgftH"

// api
#define TIME_API_URL "pool.ntp.org"
#define API_URL "nestor.anuv.me"
#define API_PORT 1883

// preferences
#define LOG_HB
#undef LOG_HB
#define LOG_VERBOSE
#undef LOG_VERBOSE
#define ESP_VERBOSE false

#endif
