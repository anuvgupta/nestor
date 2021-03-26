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
// audio data
bool audio_allow;
bool audio_enable;
int audio_smoothing;
int audio_noise_gate;
int audio_l_ch;
bool audio_l_invert;
int audio_l_preamp;
int audio_l_postamp;
int audio_r_ch;
bool audio_r_invert;
int audio_r_preamp;
int audio_r_postamp;
bool audio_shuffle;


// write to led
void driveLED(int led, int intensity) {
  analogWrite(led, 1024.0 - (1024.0 * intensity / 100.0));
}
// play current
void play_current() {
  if (!power) {
    SERIAL.printf("b%d\n", 0);
    return;
  }
  if (memcmp(play_mode, "none", 4) == 0) {
    SERIAL.printf("b%d\n", 0);
  } else if (memcmp(play_mode, "hue", 3) == 0) {
    if (strlen(hue) < 1 || memcmp(hue, "null", 4) == 0) {
      if (first_play) first_play = 0;
      else SERIAL.printf("b%d\n", 0);
    } else {
      if (first_play) first_play = 0;
      if (audio_enable && audio_allow) {
        //SERIAL.printf("b%d\n", 0);
        //SERIAL.printf("hm%s\n", hue);
        SERIAL.printf("b%d\n", brightness);
        SERIAL.printf("hm%s\n", hue);
      } else {
        SERIAL.printf("hh%s\n", hue);
        SERIAL.printf("b%d\n", brightness);
      }
    }
  } else if (memcmp(play_mode, "pattern", 7) == 0) {
    if (strlen(pattern_id) < 1 || memcmp(pattern_id, "null", 4) == 0 || strlen(pattern) < 1 || memcmp(pattern, "null", 4) == 0) {
      if (first_play) first_play = 0;
      else SERIAL.printf("b%d\n", 0);
    } else {
      if (first_play) first_play = 0;
      SERIAL.printf("s%d\n", pattern_speed);
      SERIAL.printf("b%d\n", brightness);
      SERIAL.printf("p%s\n", pattern);
    }
  }
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
// corrected boolean
bool bound_bool(char* bool_val) {
  return (bool) (memcmp(bool_val, "true", 4) == 0);
}

// driver initialization
void NodeDriver::init() {
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
  // audio settings
  audio_allow = false;
  audio_enable = false;
  audio_smoothing = 95;
  audio_noise_gate = 15;
  audio_l_ch = 1;
  audio_l_invert = false;
  audio_l_preamp = 100;
  audio_l_postamp = 1;
  audio_r_ch = 1;
  audio_r_invert = false;
  audio_r_preamp = 100;
  audio_r_postamp = 1;
  audio_shuffle = false;
  
  // first play flag
  first_play = 1;
}

// driver connected
void NodeDriver::ready() {
  SERIAL.printf("ready\n");
}

// driver input
void NodeDriver::input(char* value) {
  SERIAL.printf("%s\n", value);
}

// driver loop
void NodeDriver::loop() {
  if (power)
    driveLED(LED_1, brightness);
  else driveLED(LED_1, 0);
}

// driver data handler
void NodeDriver::data(char* id, char* value, bool transitional) {
  play = 1;
  play = (((int) transitional) == 0);
  if (memcmp(id, "switch", 6) == 0) {
    power = bound_bool(value);
  } else if (memcmp(id, "brightness", 10) == 0) {
    brightness = bound_int(atoi(value), 0, 100);
  } else if (memcmp(id, "speed", 5) == 0) {
    pattern_speed = bound_int(atoi(value), 0, 500);
  } else if (memcmp(id, "mode", 4) == 0) {
    strcpy(play_mode, value);
  } else if (memcmp(id, "color", 5) == 0) {
    strcpy(hue, value);
    play = (memcmp(play_mode, "hue", 3) == 0);
  } else if (memcmp(id, "pattern", 7) == 0) {
    int pattern_id_str_l = strlen(pattern_id);
    if ((pattern_id_str_l != strlen(value)) || (memcmp(pattern_id, value, pattern_id_str_l) != 0)) {
      strcpy(pattern_id, value);
      if (memcmp(pattern_id, "null", 4) != 0) {
        char api_args[50];
        sprintf(api_args, "%s|%s", pattern_id, this->get_id());
        this->trigger_api("get_pattern_code", api_args);
      } else play_current();
    }
    play = false;
  } else if (memcmp(id, "audio", 5) == 0) {
    if (strlen(id) == 5) {  // audio
      audio_enable = bound_bool(value);
      play = audio_allow;
    } else {
      play = false;
      char* sub_id = id + 6;
      if (memcmp(sub_id, "smoothing", 9) == 0) {
        audio_smoothing = bound_int(atoi(value), 0, 99);
        SERIAL.printf("o%d\n", audio_smoothing);
      } else if (memcmp(sub_id, "noise_gate", 10) == 0) {
        audio_noise_gate = bound_int(atoi(value), 0, 50);
        SERIAL.printf("g%d\n", audio_noise_gate);
      } else if (memcmp(sub_id, "l_ch", 4) == 0) {
        audio_l_ch = bound_int(atoi(value), 1, 7);
        SERIAL.printf("lc%d\n", audio_l_ch);
      } else if (memcmp(sub_id, "l_invert", 8) == 0) {
        audio_l_invert = bound_bool(value);
        SERIAL.printf("li%s\n", (audio_l_invert ? "true" : "false"));
      } else if (memcmp(sub_id, "l_preamp", 8) == 0) {
        audio_l_preamp = bound_int(atoi(value), 20, 200);
        SERIAL.printf("lpr%d\n", audio_l_preamp);
      } else if (memcmp(sub_id, "l_postamp", 9) == 0) {
        audio_l_postamp = bound_int(atoi(value), 1, 10);
        SERIAL.printf("lpo%d\n", audio_l_postamp);
      } else if (memcmp(sub_id, "r_ch", 4) == 0) {
        audio_r_ch = bound_int(atoi(value), 1, 7);
        SERIAL.printf("rc%d\n", audio_r_ch);
      } else if (memcmp(sub_id, "r_invert", 8) == 0) {
        audio_r_invert = bound_bool(value);
        SERIAL.printf("ri%s\n", (audio_r_invert ? "true" : "false"));
      } else if (memcmp(sub_id, "r_preamp", 8) == 0) {
        audio_r_preamp = bound_int(atoi(value), 20, 200);
        SERIAL.printf("rpr%d\n", audio_r_preamp);
      } else if (memcmp(sub_id, "r_postamp", 9) == 0) {
        audio_r_postamp = bound_int(atoi(value), 1, 10);
        SERIAL.printf("rpo%d\n", audio_r_postamp);
      } else if (memcmp(sub_id, "shuffle", 7) == 0) {
        audio_shuffle = bound_bool(value);
        SERIAL.printf("ashf%s\n", (audio_shuffle ? "true" : "false"));
      } else if (memcmp(sub_id, "allow", 5) == 0) {
        bool new_audio_allow = bound_bool(value);
        //if (new_audio_allow) play_current();
        audio_allow = new_audio_allow;
        play = audio_allow;
      }
    }
  } else play = false;
  if (play) {
    if (power) play_current();
    else SERIAL.printf("b%d\n", 0);
  }
}


void NodeDriver::user_data(char* id, char* value) {
  if (memcmp(id, "pattern", 7) == 0) {
    if (strlen(value) > 1 || memcmp(value, "null", 4) == 0) {
      strcpy(pattern, value);
      if (memcmp(play_mode, "pattern", 7) == 0) {
        play_current();
      }
    }
  }
}
