/* nestor node device client driver (vizio-ir) */

// libraries
#include <Arduino.h>

#include "node_esp.h"

// node device type
#define NODE_TYPE "vizio-ir"
// onboard leds
#define LED_1 2
#define LED_2 D0
// data
bool power;

// write to led
void driveLED(int led, int intensity) {
	analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}

// driver initialization
void NodeDriver::init() {
	SERIAL.println("[driver] initializing");
	pinMode(LED_1, OUTPUT);
	pinMode(LED_2, OUTPUT);
	driveLED(LED_1, 0);
	driveLED(LED_2, 0);
	// init variables
	power = false;
}

// driver network ready
void NodeDriver::ready() {
	SERIAL.println("[driver] ready");
	power = true;
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
	SERIAL.printf("[driver] message: %s %s\n", id, value);
	// if (memcmp(id, "switch", 6) == 0)
	// {
	//   power = bound_bool(value);
	// }
	// else if (memcmp(id, "brightness", 10) == 0)
	// {
	//   brightness = bound_int(atoi(value), 0, 100);
	// }
}

// driver user data handler
void NodeDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] message: %s %s\n", id, value);
}
