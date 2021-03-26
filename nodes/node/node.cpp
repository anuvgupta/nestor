/* nestor node device client driver (node) */

// libraries
#include <Arduino.h>

#include "node_esp.h"

// node device type
#define NODE_TYPE "node"
// variables
#define SERIAL Serial

// driver initialization
void NodeDriver::init() {
	SERIAL.println("[driver] initializing");
}

// driver network ready
void NodeDriver::ready() {
	SERIAL.println("[driver] ready");
}

// driver serial input
void NodeDriver::input(char *value) {
	SERIAL.printf("[driver] serial input %s\n", value);
}

// driver main loop
void NodeDriver::loop() {
	// main loop
}

// driver data handler
void NodeDriver::data(char *id, char *value) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
}

// driver user data handler
void NodeDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}
