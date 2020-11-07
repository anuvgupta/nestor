/* nestor node device client driver (vizio-ir) */

// libraries
#include <Arduino.h>
#include "node.h"

// node device type
#define NODE_TYPE "vizio-ir"
// variables
#define SERIAL Serial

// driver initialization
void NodeDriver::init()
{
  SERIAL.println("[driver] initializing");
}

// driver loop
void NodeDriver::loop()
{
  // loop
}

// driver data handler
void NodeDriver::data(char *id, char *value)
{
  SERIAL.printf("[driver] message: %s %s\n", id, value);
}
