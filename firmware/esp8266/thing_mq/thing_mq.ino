/* nestor thing device client */

// libraries
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <NTPClient.h>
#include <PubSubClient.h>
#include <WiFiUdp.h>

#include "thing_conf.h"
#include "thing_esp.h"

// fields
WiFiClient mqtt_wifi;
PubSubClient mqtt_client(mqtt_wifi);
boolean mqtt_client_online = false;
char mqtt_client_id[50] = "";
int mqtt_client_id_len = 0;
// driver
ThingDriver* thing_driver;
boolean driver_synced = false;
// data
char wifi_ssid[15] = WIFI_SSID;
char device_user[25] = DEVICE_USER;
char core_code[6] = CORE_CODE;
char thing_id[25] = "";
char thing_type[25] = THING_TYPE;
char core_ip[16] = "";
char device_sync_json[200] = THING_SYNC_JSON;
// parsing
int mb_i = 0;
char msgbuff[MSGBUFF_MAXLEN];
// time
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, TIME_API_URL);
const long utcOffsetInSeconds = 60 * 60 * -6;  // GMT -6 = 60 * 60 * -6
int resetOffset = 10;						   // in minutes

// init
void setup(void) {
	// boot
	SERIAL.begin(9600);
	SERIAL.setDebugOutput(ESP_VERBOSE);
#ifdef LOG_VERBOSE
	SERIAL.println("\r\n");
#endif
	for (uint8_t t = 3; t > 0; t--) {
#ifdef LOG_VERBOSE
		SERIAL.printf("[boot] wait %d\r\n", t);
		SERIAL.flush();
#endif
		delay(1000);
	}
#ifdef LOG_VERBOSE
	SERIAL.println("\r\n");
	SERIAL.printf("ESP8266\r\n");
	SERIAL.printf("nestor thing device\r\n");

	//leds
	pinMode(led_b_1, OUTPUT);
	pinMode(led_b_2, OUTPUT);
	led_out_builtin(led_b_1, BRIGHTNESS_MIN);
	led_out_builtin(led_b_2, BRIGHTNESS_MIN);

	// wifi
	SERIAL.printf("[wifi] connecting to %s\r\n", &wifi_ssid);
#endif
	WiFi.begin(WIFI_SSID, WIFI_PASS);
	while (WiFi.status() != WL_CONNECTED) delay(50);
#ifdef LOG_VERBOSE
	SERIAL.printf("[wifi] connected\r\n");
	SERIAL.printf("[wifi] mac address: %s\r\n", WiFi.macAddress().c_str());
	SERIAL.printf("[wifi] ip address: %s\r\n", WiFi.localIP().toString().c_str());

	// driver
	SERIAL.printf("[driver] initializing\r\n");
#endif
	sprintf(device_sync_json, THING_SYNC_JSON, core_code, device_user, WiFi.macAddress().c_str(), thing_type);
#ifdef LOG_VERBOSE
	SERIAL.printf("[mqtt] connecting\r\n");
#endif
	sprintf(mqtt_client_id, THING_MQTT_CLIENT_ID, THING_MQTT_APP_ID, THING_TYPE, WiFi.macAddress().c_str());
	mqtt_client_id_len = strlen(mqtt_client_id);
	mqtt_client_online = true;
	mqtt_client.setServer(API_URL, API_PORT);
	mqtt_client.setCallback(mqtt_handler);
	thing_driver = new ThingDriver();
	thing_driver->_set_type(THING_TYPE);
	thing_driver->_init(&mqtt_client);
	thing_driver->init();

	// time
#ifdef LOG_VERBOSE
	SERIAL.printf("[time] connecting\r\n");
#endif
	timeClient.begin();
	timeClient.setTimeOffset(utcOffsetInSeconds);
#ifdef LOG_VERBOSE
	SERIAL.printf("[time] connected\r\n");
#endif
}

// main
void loop(void) {
	// onboard led output
	if (thing_driver->get_status_leds_enabled())
		led_out_builtin(led_b_1, BRIGHTNESS_MAX);
	// monitor serial input
	serial_monitor();
	// reconnect/monitor mqtt client
	mqtt_loop();
	// main
	thing_driver->_loop(&mqtt_client);
	thing_driver->loop();
	// check time for reset
	reset_monitor();
}

// serial monitor
void serial_monitor(void) {
	// check serial for reset message
	if (Serial.available()) {
		if (mb_i >= MSGBUFF_MAXLEN) {
			msgbuff[MSGBUFF_MAXLEN - 1] = '\n';
#ifdef LOG_VERBOSE
			SERIAL.println(msgbuff);
#endif
			mb_i = 0;
		} else {
			char c = Serial.read();
			if (c != -1) {
#ifdef LOG_VERBOSE
				// SERIAL.print(c);
#endif
				if (c == '\n') {
					msgbuff[mb_i] = '\0';
					if (memcmp(msgbuff + mb_i - 5, "reset", 5) == 0) {
						esp_restart();
					} else {
						thing_driver->input(msgbuff);
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

// esp control
int firstTimer = 1;
unsigned long epochTime = 0;
unsigned long nextEpochTime = 0;
void reset_monitor() {
	timeClient.update();
	nextEpochTime = timeClient.getEpochTime();
	if (nextEpochTime - epochTime > resetOffset * 60) {
		epochTime = nextEpochTime;
		if (epochTime > 4100000000) return;
#ifdef LOG_VERBOSE
		SERIAL.print("[time] epoch time: ");
		SERIAL.println(epochTime);
#endif
		if (firstTimer == 1) {
			firstTimer = 0;
			delay(500);
		} else
			esp_restart();
	}
}

// mqtt handlers
char mqtt_sync_topic_buffer[25] = "";
char mqtt_sync_recv_topic_buffer[75] = "";
char mqtt_hb_topic_buffer[75] = "";
char mqtt_hb_recv_topic_buffer[75] = "";
char mqtt_data_topic_buffer[100] = "";
char mqtt_data_value_buffer[500] = "";
void mqtt_loop(void) {
	if (mqtt_client_online) {
		if (!mqtt_client.connected()) {
			mqtt_reconnect();
			if (thing_driver->get_status_leds_enabled())
				led_out_builtin(led_b_2, BRIGHTNESS_MIN);
		} else {
			if (thing_driver->get_status_leds_enabled())
				led_out_builtin(led_b_2, BRIGHTNESS_MAX);
		}
		mqtt_client.loop();
	}
}
void mqtt_reconnect() {
	while (!mqtt_client.connected()) {
#ifdef LOG_VERBOSE
		SERIAL.printf("[mqtt] attempting connection to %s:%d as \"%s\" \r\n", API_URL, API_PORT, mqtt_client_id);
#endif
		if (mqtt_client.connect(mqtt_client_id)) {
#ifdef LOG_VERBOSE
			SERIAL.printf("[mqtt] connected\r\n");
#endif
			// initialized
			if (thing_driver->get_serial_alerts_enabled()) {
			  Serial.printf("init\r\n");
			}
#ifdef LOG_VERBOSE
			Serial.printf("\r\n");
#endif
			// subscribe to necessary channels here
			sprintf(mqtt_data_topic_buffer, "%s_info", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_data_topic_buffer)) esp_restart();
			sprintf(mqtt_data_topic_buffer, "%s_reset_i", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_data_topic_buffer)) esp_restart();
			sprintf(mqtt_data_topic_buffer, "%s_reset", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_data_topic_buffer)) esp_restart();
			sprintf(mqtt_data_topic_buffer, "%s_node-data", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_data_topic_buffer)) esp_restart();
			sprintf(mqtt_data_topic_buffer, "%s_user-data", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_data_topic_buffer)) esp_restart();
			sprintf(mqtt_sync_topic_buffer, "%s_sync", THING_MQTT_APP_ID);
			sprintf(mqtt_sync_recv_topic_buffer, "%s_sync", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_sync_recv_topic_buffer)) esp_restart();
			if (!mqtt_sync()) esp_restart();
		} else {
#ifdef LOG_VERBOSE
			SERIAL.print("*[mqtt] failed, rc=");
			SERIAL.print(mqtt_client.state());
			SERIAL.printf(" retrying after 5 sec\r\n");
#endif
			delay(5000);
		}
	}
}
void mqtt_handler(char* topic, byte* payload, unsigned int len) {
#ifdef LOG_VERBOSE
	boolean log_hbs = true;
#ifndef LOG_HB
	if (memcmp(topic + mqtt_client_id_len + 1, "hb_recv", 7) == 0)
		log_hbs = false;
#endif
	if (log_hbs) {
		SERIAL.print(F("[mqtt] message received on topic \""));
		SERIAL.print(topic);
		SERIAL.print("\": ");
		for (int i = 0; i < len; i++) {
			char rC = (char)payload[i];
			SERIAL.print(rC);
		}
		SERIAL.printf("\r\n");
	}
#endif
	// if (memcmp(topic, VIRTUALPIN_TOPIC, VIRTUALPIN_TOPIC_LEN) == 0) {
	// 	int vp_num = atoi(topic + VIRTUALPIN_TOPIC_LEN + 1);
	// 	int vp_val = atoi((char*)payload);
	// 	mqtt_receive_virtualpin_update(vp_num, vp_val);
	// }
	if (memcmp(topic + mqtt_client_id_len + 1, "sync", 4) == 0) {
		if (payload[0] == 't') {
			driver_synced = true;
			sprintf(mqtt_hb_topic_buffer, "%s_hb", mqtt_client_id);
			sprintf(mqtt_hb_recv_topic_buffer, "%s_hb_recv", mqtt_client_id);
			if (!mqtt_subscribe(mqtt_hb_recv_topic_buffer)) esp_restart();
#ifdef LOG_VERBOSE
			SERIAL.printf("[mqtt] synced successfully as device \r\n");
#endif
		} else {
			driver_synced = false;
			esp_restart();
#ifdef LOG_VERBOSE
			SERIAL.printf("[mqtt] failed to sync as device\r\n");
#endif
		}
	} else if (memcmp(topic + mqtt_client_id_len + 1, "info", 4) == 0) {
		strlcpy(thing_id, ((char*)(payload)), 25);
		thing_id[25] = '\0';
		thing_driver->_set_id(thing_id);
#ifdef LOG_VERBOSE
		SERIAL.printf("[mqtt] thing id received: %s\n", thing_id);
#endif
		thing_driver->ready();
		// ready
    if (thing_driver->get_serial_alerts_enabled()) {
      Serial.printf("ready\r\n");
    }
#ifdef LOG_VERBOSE
		Serial.printf("\r\n");
#endif
	} else if (memcmp(topic + mqtt_client_id_len + 1, "reset", 5) == 0) {
		esp_restart();
	} else if (memcmp(topic + mqtt_client_id_len + 1, "reset_i", 7) == 0) {
		char* temp_buffer = (char*)(payload);
		temp_buffer[2] = '\0';
		int new_reset_interval = atoi(temp_buffer);
		if (new_reset_interval < 1) new_reset_interval = 1;
		if (new_reset_interval > 30) new_reset_interval = 30;
		resetOffset = new_reset_interval;
#ifdef LOG_VERBOSE
		SERIAL.printf("[mqtt] new reset interval: %d\n", (int)resetOffset);
#endif
	} else if (memcmp(topic + mqtt_client_id_len + 1, "node-data", 9) == 0) {
		int dash1 = find_dash((char*)payload, len, 0);
		//    Serial.println(dash1);
		int dash2 = find_dash((char*)payload, len, dash1 + 1);
		//    Serial.println(dash2);
		char field_id[25];
		char field_val[200];
		char field_transitional[6];
		strlcpy(field_id, ((const char*)(payload)), dash1 + 1);
		field_id[dash1] = '\0';
		//    Serial.println(field_id);
		strlcpy(field_transitional, ((const char*)(payload + dash1 + 1)), dash2 - (dash1));
		field_transitional[dash2 - (dash1)] = '\0';
		//    Serial.println(field_transitional);
		strlcpy(field_val, ((const char*)(payload + dash2 + 1)), len - dash2);
		field_val[len - (dash2)] = '\0';
//    Serial.println(field_val);
//
#ifdef LOG_VERBOSE
//		SERIAL.printf("[mqtt] data received: id=%s val=%s tr=%s\n", field_id, field_val, field_transitional);
#endif
		thing_driver->data(field_id, field_val, (memcmp(field_transitional, "true", 4) == 0));
	} else if (memcmp(topic + mqtt_client_id_len + 1, "user-data", 9) == 0) {
		int dash1 = find_dash((char*) payload, len, 0);
		payload[dash1] = '\0';
		char data_id[25];
		char data_val[500];
    // added this null termination just in case
    payload[len] = '\0';
    // maybe change strcpy to strlcpy, maybe this will fix the patterns from not repeating?
		strcpy(data_id, ((const char*)(payload)));
		strcpy(data_val, ((const char*)(payload + dash1 + 1)));
#ifdef LOG_VERBOSE
    SERIAL.printf("[mqtt] user data received: %s %s\n", data_id, data_val);
#endif
		thing_driver->user_data(data_id, data_val);
	} else if (memcmp(topic + mqtt_client_id_len + 1, "hb_recv", 7) == 0) {
		mqtt_publish(mqtt_hb_topic_buffer, "hb_echo");
	}
}
boolean mqtt_publish(char* topic, char* message) {
	if (mqtt_client_online && mqtt_client.connected()) {
#ifdef LOG_VERBOSE
		boolean log_hbs = true;
#ifndef LOG_HB
		if (memcmp(message, "hb_echo", 7) == 0)
			log_hbs = false;
#endif
		if (log_hbs) SERIAL.printf("[mqtt] publishing to topic \"%s\", message: %s\r\n", topic, message);
#endif
		boolean success = mqtt_client.publish(topic, message);
#ifdef LOG_VERBOSE
		if (!success)
			SERIAL.printf("*[mqtt] failed to publish to topic: %s\r\n", topic);
#endif
		return success;
	}
	return false;
}
//void mqtt_update_virtualpin(int vp_num, int vp_val) {
//	sprintf(mqtt_vpin_topic_buffer, "%s_%d", VIRTUALPIN_TOPIC, vp_num);
//	sprintf(mqtt_vpin_value_buffer, "%d", vp_val);
//	mqtt_update(mqtt_vpin_topic_buffer, mqtt_vpin_value_buffer);
//}
boolean mqtt_subscribe(char* topic) {
	if (mqtt_client_online && mqtt_client.connected()) {
#ifdef LOG_VERBOSE
		SERIAL.printf("[mqtt] subscribing to topic: %s\r\n", topic);
#endif
		boolean success = mqtt_client.subscribe(topic);
#ifdef LOG_VERBOSE
		if (!success)
			SERIAL.printf("*[mqtt] failed to subscribe to topic: %s\r\n", topic);
#endif
		return success;
	}
	return false;
}
boolean mqtt_sync(void) {
#ifdef LOG_VERBOSE
	SERIAL.printf("[mqtt] syncing device as thing\n");
#endif
	return mqtt_publish(mqtt_sync_topic_buffer, device_sync_json);
}
boolean mqtt_api_update(char* id, char* val, boolean t) {
  sprintf(mqtt_data_topic_buffer, "%s_node-data_recv", mqtt_client_id);
  sprintf(mqtt_data_value_buffer, "%s-%s-%s", id, val, "false"); // TODO: convert t from bool to string
  return mqtt_publish(mqtt_data_topic_buffer, mqtt_data_value_buffer);
}
boolean mqtt_api_trigapi(char* fixed_type, char* api_req, char* api_args) {
  sprintf(mqtt_data_topic_buffer, "%s_trigger-api_recv", mqtt_client_id);
  sprintf(mqtt_data_value_buffer, "%s-%s-%s", fixed_type, api_req, api_args);
  return mqtt_publish(mqtt_data_topic_buffer, mqtt_data_value_buffer);
}

// utilities
void esp_restart(void) {
#ifdef LOG_VERBOSE
	SERIAL.print(F("[boot] resetting..."));
	SERIAL.printf("\r\n");
#endif
	ESP.restart();
}
int bound_integer(int value, int minimum, int maximum) {
	if (value < minimum) value = minimum;
	if (value > maximum) value = maximum;
	return value;
}
int find_dash(char* bf, int len, int st) {
	for (int i = st; i < len; i++) {
		if (bf[i] == '-') {
			return i;
		}
	}
	return -1;
}
int correct_brightness(int brightness) {
	return bound_integer(brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
}
void led_out(int led_pin, int brightness) {
	brightness = correct_brightness(brightness);
	analogWrite(led_pin, brightness);
}
void led_out_builtin(int led_b_pin, int brightness) {
	brightness = correct_brightness(brightness);
	brightness = BRIGHTNESS_MAX - (brightness - BRIGHTNESS_MIN);
	analogWrite(led_b_pin, brightness);
}
