/* nestor thing device client driver (smart-plug) */

// libraries
#include <Arduino.h>

#include "thing_conf.h"
#include "thing_esp.h"

// onboard leds
#define LED_1 2
#define LED_2 D0
// relay
#define RELAY_COIL D4
int power1;

// write to led
void driveLED(int led, int intensity) {
	analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}
// control relay coil
void driveRelay(int relay, int power) {
	analogWrite(relay, 1024.0 * power);
}

// driver initialization
void ThingDriver::init() {
	SERIAL.println("[driver] initializing");
	// this->disable_status_leds();
	pinMode(LED_1, OUTPUT);
	pinMode(LED_2, OUTPUT);
	pinMode(RELAY_COIL, OUTPUT);
	driveLED(LED_1, 0);
	driveLED(LED_2, 0);
	power1 = false;
	driveRelay(RELAY_COIL, power1);
}

// driver network ready
void ThingDriver::ready() {
	SERIAL.println("[driver] ready");
}

// driver serial input
void ThingDriver::input(char *value) {
	SERIAL.printf("[driver] serial input %s\n", value);
}

// driver main loop
void ThingDriver::loop() {
	driveRelay(RELAY_COIL, power1);
}

// driver data handler
void ThingDriver::data(char *id, char *value, bool transitional) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
	if (memcmp(id, "switch1", 7) == 0) {
		if (memcmp(value, "true", 4) == 0)
			power1 = true;
		else if (memcmp(value, "false", 5) == 0)
			power1 = false;
	}
}

// driver user data handler
void ThingDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}
