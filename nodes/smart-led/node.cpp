/* nestor node device driver (smart-led) */

// libraries
#include <Arduino.h>
#include "node_esp.h"

// node device type
#define NODE_TYPE "smart-led"
// onboard leds
#define LED_1 2
#define LED_2 D0
// data
int play;
int power;
int brightness;
int first_play;
int pattern_speed;
char play_mode[15];
char hue[14];
char pattern_id[22];
char pattern[225]; // max 10

// write to led
void driveLED(int led, int intensity)
{
  analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}
// play current
void play_current()
{
  if (!power)
  {
    SERIAL.printf("b%d\n", 0);
    return;
  }
  if (memcmp(play_mode, "none", 4) == 0)
  {
    SERIAL.printf("b%d\n", 0);
  }
  else if (memcmp(play_mode, "hue", 3) == 0)
  {
    if (strlen(hue) < 1 || memcmp(hue, "null", 4) == 0)
    {
      if (first_play)
        first_play = 0;
      else
        SERIAL.printf("b%d\n", 0);
    }
    else
    {
      if (first_play)
        first_play = 0;
      SERIAL.printf("hh%s\n", hue);
      SERIAL.printf("b%d\n", brightness);
    }
  }
  else if (memcmp(play_mode, "pattern", 7) == 0)
  {
    if (strlen(pattern_id) < 1 || memcmp(pattern_id, "null", 4) == 0 || strlen(pattern) < 1 || memcmp(pattern, "null", 4) == 0)
    {
      if (first_play)
        first_play = 0;
      else
        SERIAL.printf("b%d\n", 0);
    }
    else
    {
      if (first_play)
        first_play = 0;
      SERIAL.printf("s%d\n", pattern_speed);
      SERIAL.printf("b%d\n", brightness);
      SERIAL.printf("p%s\n", pattern);
    }
  }
}

// driver initialization
void NodeDriver::init()
{
  pinMode(LED_1, OUTPUT);
  pinMode(LED_2, OUTPUT);
  driveLED(LED_1, 0);
  driveLED(LED_2, 0);
  power = false;
  brightness = 0;
  pattern_speed = 100;
  hue[0] = '\0';
  pattern[0] = '\0';
  pattern_id[0] = '\0';
  play_mode[0] = '\0';
  first_play = 1;
}

// driver connected
void NodeDriver::ready()
{
  SERIAL.printf("ready\n");
}

// driver input
void NodeDriver::input(char *value)
{
  SERIAL.printf("%s\n", value);
}

// driver loop
void NodeDriver::loop()
{
  if (power)
    driveLED(LED_1, brightness);
  else
    driveLED(LED_1, 0);
}

// driver data handler
void NodeDriver::data(char *id, char *value, bool transitional)
{
  play = 1;
  play = (((int)transitional) == 0);
  if (memcmp(id, "switch", 6) == 0)
  {
    if (memcmp(value, "true", 4) == 0)
      power = true;
    else if (memcmp(value, "false", 5) == 0)
      power = false;
  }
  else if (memcmp(id, "brightness", 10) == 0)
  {
    int b = atoi(value);
    if (b < 0)
      b = 0;
    if (b > 100)
      b = 100;
    brightness = b;
  }
  else if (memcmp(id, "speed", 5) == 0)
  {
    int s = atoi(value);
    if (s < 0)
      s = 0;
    if (s > 500)
      s = 100;
    pattern_speed = s;
  }
  else if (memcmp(id, "mode", 4) == 0)
  {
    strcpy(play_mode, value);
  }
  else if (memcmp(id, "color", 5) == 0)
  {
    strcpy(hue, value);
    play = (memcmp(play_mode, "hue", 3) == 0);
  }
  else if (memcmp(id, "pattern", 7) == 0)
  {
    int pattern_id_str_l = strlen(pattern_id);
    if ((pattern_id_str_l != strlen(value)) || (memcmp(pattern_id, value, pattern_id_str_l) != 0))
    {
      strcpy(pattern_id, value);
      if (memcmp(pattern_id, "null", 4) != 0)
      {
        char api_args[50];
        sprintf(api_args, "%s|%s", pattern_id, this->get_id());
        this->trigger_api("get_pattern_code", api_args);
      }
      else
        play_current();
    }
    play = false;
  }
  else
    play = false;
  if (play)
  {
    if (power)
      play_current();
    else
      SERIAL.printf("b%d\n", 0);
  }
}

void NodeDriver::user_data(char *id, char *value)
{
  if (memcmp(id, "pattern", 7) == 0)
  {
    if (strlen(value) > 1 || memcmp(value, "null", 4) == 0)
    {
      strcpy(pattern, value);
      if (memcmp(play_mode, "pattern", 7) == 0)
      {
        play_current();
      }
    }
  }
}
