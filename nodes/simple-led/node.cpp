/* nestor node device client driver (simple-led) */

// libraries
#include "node.h"

#include <Arduino.h>

// node device type
#define NODE_TYPE "simple-led"
// onboard leds
#define LED_1 2
#define LED_2 D0
// data
int power1;
int brightness1;
int power2;
int brightness2;

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
	power1 = false;
	brightness1 = 0;
	power2 = false;
	brightness2 = 0;
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
	if (power1)
		driveLED(LED_1, brightness1);
	else
		driveLED(LED_1, 0);
	if (power2)
		driveLED(LED_2, brightness2);
	else
		driveLED(LED_2, 0);
}

// driver data handler
void NodeDriver::data(char *id, char *value) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
	if (memcmp(id, "switch1", 7) == 0) {
		if (memcmp(value, "true", 4) == 0)
			power1 = true;
		else if (memcmp(value, "false", 5) == 0)
			power1 = false;
	} else if (memcmp(id, "switch2", 7) == 0) {
		if (memcmp(value, "true", 4) == 0)
			power2 = true;
		else if (memcmp(value, "false", 5) == 0)
			power2 = false;
	} else if (memcmp(id, "brightness1", 11) == 0) {
		int b = atoi(value);
		if (b < 0)
			b = 0;
		if (b > 100)
			b = 100;
		brightness1 = b;
	} else if (memcmp(id, "brightness2", 11) == 0) {
		int b = atoi(value);
		if (b < 0)
			b = 0;
		if (b > 100)
			b = 100;
		brightness2 = b;
	}
}

// driver user data handler
void NodeDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}