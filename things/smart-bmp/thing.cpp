/* nestor thing device client driver (smart-bmp) */

// libraries
#include <Arduino.h>
#include "libraries/Adafruit_BMP280.h"
#include "libraries/Adafruit_Sensor.h"

#include "thing_conf.h"
#include "thing_esp.h"

// onboard leds
#define LED_1 2
#define LED_2 D0
// data
// ...

// write to led
void driveLED(int led, int intensity) {
	analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}

// driver initialization
void ThingDriver::init() {
	SERIAL.println("[driver] initializing");
	pinMode(LED_1, OUTPUT);
	driveLED(LED_1, 0);
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
	driveLED(LED_1, 100);
}

// driver data handler
void ThingDriver::data(char *id, char *value, bool transitional) {
	SERIAL.printf("[driver] data update: %s = %s\n", id, value);
}

// driver user data handler
void ThingDriver::user_data(char *id, char *value) {
	SERIAL.printf("[driver] user data update: %s = %s\n", id, value);
}
