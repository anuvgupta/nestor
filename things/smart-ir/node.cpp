/* nestor node device client driver (smart-ir) */

// libraries
#include <Arduino.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>

#include "node_conf.h"
#include "node_esp.h"

// node device type
#define NODE_TYPE "smart-ir"
// onboard leds
#define LED_1 2
#define LED_2 D0
// data
bool power;
uint32_t remote;  // ir vars
const uint16_t ir_pin = 4;
IRsend ir_send(ir_pin);

// write to led
void driveLED(int led, int intensity) {
	analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}
// bound integer
int bound_int(int input_int, int min_bound, int max_bound) {
	int output_int = input_int;
	if (output_int < min_bound)
		output_int = min_bound;
	if (output_int > max_bound)
		output_int = max_bound;
	return output_int;
}
// correct boolean
bool bound_bool(char *bool_val) {
	return (bool)(memcmp(bool_val, "true", 4) == 0);
}
// send ir value
void ir_send_value(uint32_t value) {
	ir_send.sendNEC(value);
}

// driver initialization
void NodeDriver::init() {
	SERIAL.println("[driver] initializing");
	pinMode(LED_1, OUTPUT);
	pinMode(LED_2, OUTPUT);
	driveLED(LED_1, 0);
	driveLED(LED_2, 0);
	// init variables
	remote = -1;
	power = false;
}

// driver network ready
void NodeDriver::ready() {
	SERIAL.println("[driver] ready");
	power = true;
	ir_send.begin();
}

// driver serial input
void NodeDriver::input(char *value) {
	SERIAL.printf("[driver] serial input %s\n", value);
}

// driver main loop
void NodeDriver::loop() {
	if (power)
		driveLED(LED_1, 100);
	else
		driveLED(LED_1, 0);
}

// driver data handler
void NodeDriver::data(char *id, char *value, bool transitional) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
	if (memcmp(id, "target", 6) == 0) {
		SERIAL.printf("[driver] target type set to: %s \n", value);
	} else if (memcmp(id, "remote", 6) == 0) {
		remote = (uint32_t)atoi(value);
		if (transitional) {
			SERIAL.printf("[driver] sending ir value: %s \n", value);
			ir_send_value(remote);
		}
	}
}

// driver user data handler
void NodeDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}
