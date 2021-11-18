/* nestor thing device client driver (node) */

// libraries
#include <Arduino.h>

#include "thing_conf.h"
#include "thing_esp.h"

// variables

// driver initialization
void ThingDriver::init(void) {
	SERIAL.println("[driver] initializing");
}

// driver network ready
void ThingDriver::ready(void) {
	SERIAL.println("[driver] ready");
}

// driver serial input
void ThingDriver::input(char *value) {
	SERIAL.printf("[driver] serial input %s\n", value);
}

// driver main loop
void ThingDriver::loop(void) {
	// main loop
}

// driver data handler
void ThingDriver::data(char *id, char *value, bool transitional) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
}

// driver user data handler
void ThingDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}