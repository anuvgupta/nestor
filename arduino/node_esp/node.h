/* nestor node device driver */

#ifndef __N_DRIVER_H__
#define __N_DRIVER_H__

// libraries
#include <Arduino.h>

// driver class
class NodeDriver {
  private:
    char* driver_type;
  public:
    NodeDriver() { };
    void init();
    void loop();
    void data(char* id, char* value);
};

#endif
