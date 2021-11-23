/* nestor thing device client */

#ifndef __T_CLIENT_H__
#define __T_CLIENT_H__

// libraries
#include <Arduino.h>
#include <PubSubClient.h>

// vars
#define SERIAL Serial

// json
#define THING_MQTT_APP_ID "nestor_cloud"
#define THING_MQTT_CLIENT_ID "%s_thing_%s_%s"
#define THING_SYNC_JSON "{\"core_code\":\"%s\",\"user\":\"%s\",\"mac\":\"%s\",\"thing_type\":\"%s\",\"dev_type\":\"thing\"}"


// internal api methods
boolean mqtt_api_update(char* id, char* val, boolean t);
boolean mqtt_api_trigapi(char* fixed_type, char* api_req, char* api_args);

// driver class
class ThingDriver {
private:
	char thing_id[25];
	char driver_type[25];
	PubSubClient* mqtt_client;
	boolean status_leds;
  boolean serial_alerts;

public:
	ThingDriver() {
		thing_id[0] = '\0';
		driver_type[0] = '\0';
		status_leds = true;
    serial_alerts = true;
	};
	void _init(PubSubClient* mq_c) {
		this->mqtt_client = mq_c;
	}
	void _loop(PubSubClient* mq_c) {
		this->_init(mq_c);
	}
	void _set_id(char* id) {
		if (strlen(thing_id) < 1)
			strcpy(thing_id, id);
	}
	void _set_type(char* t) {
		if (strlen(driver_type) < 1)
			strcpy(driver_type, t);
	}

	void disable_status_leds(void) {
		this->status_leds = false;
	}
	void enable_status_leds(void) {
		this->status_leds = true;
	}
	bool get_status_leds_enabled(void) {
		return this->status_leds;
	}
  void disable_serial_alerts(void) {
    this->serial_alerts = false;
  }
  void enable_serial_alerts(void) {
    this->serial_alerts = true;
  }
  bool get_serial_alerts_enabled(void) {
    return this->serial_alerts;
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
   fixed_type[strlen(this->driver_type)] = '\0';
    mqtt_api_trigapi(fixed_type, api_req, api_args);
	}
	void update(char* id, char* value, bool t) {
		mqtt_api_update(id, value, t);
	}
	void update(char* id, char* value) {
		this->update(id, value, false);
	}
	char* get_id(void) {
		return this->thing_id;
	}
	char* get_type(void) {
		return this->driver_type;
	}

	void init(void);
	void ready(void);
	void loop(void);
	void input(char* value);
	void data(char* id, char* value, bool transitional);
	void user_data(char* id, char* value);
};

// utilities
#define MSGBUFF_MAXLEN 500
void esp_restart(void);
int bound_integer(int value, int minimum, int maximum);
int find_dash(uint8_t* bf, int len, int st);
// led control
#define BRIGHTNESS_MIN 0
#define BRIGHTNESS_MAX PWMRANGE	 // 1023 or 255
#define led_b_1 LED_BUILTIN
#define led_b_2 2
int correct_brightness(int brightness);
void led_out(int led_pin, int brightness);
void led_out_builtin(int led_b_pin, int brightness);

#endif
