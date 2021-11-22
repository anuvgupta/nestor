// TODO: stall and reset esp8266 via reset pin

// includes
#include "SoftwareSerialMod.h"

// debug
#define LOG_DEBUG
//#undef LOG_DEBUG  // comment this line to enable verbose debug output
#ifdef LOG_DEBUG
#define DEBUG true
#else
#define DEBUG false
#endif


// esp control pins
#define ESP_TX 7
#define ESP_RX 8
// LED PWM pins
#define REDPIN_L   6   // 9
#define GREENPIN_L 5   // 10
#define BLUEPIN_L  10  // 11
#define REDPIN_R   9   // 3
#define GREENPIN_R 3   // 5
#define BLUEPIN_R  11  // 6
// msgeq7 pins
#define STROBEPIN 2
#define RESETPIN 4
#define OUTRPIN A6
#define OUTLPIN A5

// msgeq7 settings
double l_preamp = 1.1;	// double 0 - 2, (2 for low volume)
int l_postamp = 1;		// int 1 - 20, (10 if inverted)
bool l_invert = false;	// boolean
double r_preamp = 1.1;
int r_postamp = 1;
bool r_invert = false;
int noise = 20;		 // int 0 - 50
int smoothing = 95;	 // int 0 - 99
int l_channel = 0;	 // int 0 - 7
int r_channel = 1;	 // int 0 - 7
bool shuffle_hues = false;
// esp8266 data
bool ready = false;
SoftwareSerial ESP8266(ESP_TX, ESP_RX);  // ARD 7 => ESP TX, ARD 8 => ESP RX
unsigned long lastTimestamp = 0;
// parsing data
int mb_i = 0;
char msgbuff[322];	 // sufficient capacity (20 color limit for patterns)
char tokenbuff[20];	 // 5(f) + 3(r) + 3(g) + 3(b) + 5(t) + 1(\0) (back-compat)
char databuff[6];	 // 5(int dig max) + 1(\0)
// msgeq7 data
int bands[7];
int bands_record_l[7];
int bands_record_r[7];
// rgb data
double r_l = 0;			  // hue red (left)
double g_l = 0;			  // hue green (left)
double b_l = 0;			  // hue blue (left)
double r_r = 0;			  // hue red (right)
double g_r = 0;			  // hue green (right)
double b_r = 0;			  // hue blue (right)
double t = 0;			  // hue time
double n_r = 0;			  // new hue red
double n_g = 0;			  // new hue green
double n_b = 0;			  // new hue blue
long n_r_l = 0;			  // temporary cast
long n_g_l = 0;			  // temporary cast
long n_b_l = 0;			  // temporary cast
double r_st = 0;		  // hue red fade
double g_st = 0;		  // hue green fade
double b_st = 0;		  // hue blue fade
double brightness = 100;  // brightness
double speedmult = 100;	  // speed mult
int fade = 0;			  // transition (ms)
#define PRECISION 5		  // 5 millisecond precision for fades
#define RESET_INTERVAL 5  // check ESP8266 every 5 minutes
// shuffle data
int shuffle_record_l = 0;
int shuffle_record_r = 0;
double shuffle_beat_threshold = 360;
int shuffle_beat_limit = 1;
int shuffle_beat_limit_counter = 0;
#define SHUFFLE_HUE_PRESET_NUM 6
int shuffle_hue_presets[SHUFFLE_HUE_PRESET_NUM][3] = {
	{255, 255, 255},
	{0, 0, 255},
	{0, 255, 0},
	{255, 0, 0},
	// {255, 255, 0}, {255, 0, 255}, {0, 255, 255},
	{255, 69, 0},
	{255, 20, 147},	 // {128, 0, 128}
};

void setup(void) {
	// init hardware and software serials
	Serial.begin(9600);
	ESP8266.begin(9600);

#ifdef LOG_DEBUG
	Serial.println(F("LED Strip Driver"));
#endif

	// init LED PWM pins
	pinMode(REDPIN_L, OUTPUT);
	pinMode(GREENPIN_L, OUTPUT);
	pinMode(BLUEPIN_L, OUTPUT);
	red_l(0);
	green_l(0);
	blue_l(0);
	pinMode(REDPIN_R, OUTPUT);
	pinMode(GREENPIN_R, OUTPUT);
	pinMode(BLUEPIN_R, OUTPUT);
	red_r(0);
	green_r(0);
	blue_r(0);

	// init msgeq7 pins
	pinMode(STROBEPIN, OUTPUT);
	pinMode(RESETPIN, OUTPUT);
	pinMode(OUTRPIN, INPUT);
	pinMode(OUTLPIN, INPUT);
	digitalWrite(RESETPIN, LOW);
	digitalWrite(STROBEPIN, LOW);
	delay(1);
	// reset sequence
	digitalWrite(RESETPIN, HIGH);
	delay(1);
	digitalWrite(RESETPIN, LOW);
	digitalWrite(STROBEPIN, HIGH);
	delay(1);

	// init esp8266
#ifdef LOG_DEBUG
	Serial.println(F("[nano] connecting to ESP8266"));
#endif
	ESP8266.println(F("reset"));
  delay(1000);
	lastTimestamp = millis();
}

void loop(void) {
	// drive LED's
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);

  /* temporarily remove reset checker (since nestor monitors the device), uncomment if esp devices are stalling again
	// check time interval/reset esp8266
	if (resetRequired()) {
		unsigned long newTimestamp = millis();
		if (lastTimestamp > 0) {
#ifdef LOG_DEBUG
			Serial.println(F("[nano] resetting ESP8266"));
#endif
			ready = false;
			ESP8266.println(F("reset"));
		}
		lastTimestamp = newTimestamp;
	}
  */

	// read serial
	while (ESP8266.available() || Serial.available()) {
		if (mb_i >= 500) {
			msgbuff[499] = '\0';
#ifdef LOG_DEBUG
			writeBuffer();
#endif
			mb_i = 0;
		} else {
			char c;
			if (ESP8266.available())
				c = ESP8266.read();
			else
				c = Serial.read();
			if (c != -1) {
				if (c == '\n') {
					msgbuff[mb_i] = '\0';
#ifdef LOG_DEBUG
					writeBuffer();
#endif
					if (/*!ready &&*/ mb_i >= 5 && memcmp(msgbuff + mb_i - 5, "ready", 5) == 0) {
#ifdef LOG_DEBUG
						Serial.println(F("[nano] connected to ESP8266"));
#endif
						ready = true;
					} else if (ready) {
						if (msgbuff[0] == 'h') {
#ifdef LOG_DEBUG
							Serial.print(F("[update] new hue: "));
							Serial.println(msgbuff);
#endif
							double bright_prev = brightness;
							//if (msgbuff[1] == 'm') brightness = 0;
							hue_hex();
							if (msgbuff[1] == 'm') {
								brightness = bright_prev;
								music();
							}
						} else if (msgbuff[0] == 'p') {
#ifdef LOG_DEBUG
							Serial.print(F("[update] new pattern: "));
							Serial.println(msgbuff);
#endif
							bool f = 1;
							while (uninterrupted()) {
								pattern_hex(f);
								if (f) f = 0;
							}
						} else if (msgbuff[0] == 'b') {
#ifdef LOG_DEBUG
							Serial.print(F("[update] new brightness: "));
							Serial.println(msgbuff);
#endif
							bright();
						} else if (msgbuff[0] == 's') {
#ifdef LOG_DEBUG
							Serial.print(F("[update] new speed: "));
							Serial.println(msgbuff);
#endif
							speedm();
						} else if (msgbuff[0] == 'm') {
#ifdef LOG_DEBUG
							Serial.println(F("[update] music mode"));
#endif
							music();
						} else if (msgbuff[0] == 'o') {
							smooth();
						} else if (msgbuff[0] == 'g') {
							noise_gate();
						} else if (msgbuff[0] == 'n') {
#ifdef LOG_DEBUG
							Serial.println(F("[update] nil mode"));
#endif
						} else if (msgbuff[0] == 'l') {
							if (msgbuff[1] == 'p') {
								if (msgbuff[2] == 'r')
									left_preamp();
								else if (msgbuff[2] == 'o')
									left_postamp();
							} else if (msgbuff[1] == 'c')
								left_channel();
							else if (msgbuff[1] == 'i')
								left_invert();
						} else if (msgbuff[0] == 'r') {
							if (msgbuff[1] == 'p') {
								if (msgbuff[2] == 'r')
									right_preamp();
								else if (msgbuff[2] == 'o')
									right_postamp();
							} else if (msgbuff[1] == 'c')
								right_channel();
							else if (msgbuff[1] == 'i')
								right_invert();
						} else if (msgbuff[0] == 'a') {
							if (msgbuff[1] == 's') {
								if (msgbuff[2] == 'h' && msgbuff[3] == 'f') {
									hue_shuffle();
								}
							}
						}
					}
					mb_i = 0;
				} else if (c != 0 && c >= 32 && c <= 126) {
					msgbuff[mb_i] = c;
#ifdef LOG_DEBUG
					// Serial.println("[esp] msgbuff[" + String(mb_i) + "] " + String(msgbuff[mb_i]) + " (" + String((uint8_t)msgbuff[mb_i]) + ")");
#endif
					mb_i++;
				}
			}
		}
	}
}

// check if reset required
bool resetRequired(void) {
	// check time interval
	unsigned long newTimestamp = millis();
	unsigned long minute_ms_interval = 60000;
	minute_ms_interval *= RESET_INTERVAL;
	return ready && newTimestamp - lastTimestamp >= minute_ms_interval;
}

// check if current process should be interrupted
bool uninterrupted(void) {
	return ready && ESP8266.available() <= 0 && Serial.available() <= 0 && !resetRequired();
}

// process brightness from msgbuff
void bright(void) {
	int i, j;
	for (i = 1, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	brightness = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] brightness – "));
	Serial.println(brightness);
#endif
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);
}

// process speed from msgbuff
void speedm(void) {
	int i, j;
	for (i = 1, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	speedmult = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] speed – "));
	Serial.println(speedmult);
#endif
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);
}

/*
// process hue from msgbuff
void hue(bool v) {
  // parse message data
  int i, j;
  // parse left
  for (i = 1 + 2, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_r = atoi(databuff);
  for (i = 1 + 5, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_g = atoi(databuff);
  for (i = 1 + 8, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_b = atoi(databuff);
  r_l = n_r; g_l = n_g; b_l = n_b;
  // parse right
  for (i = 1 + 2 + 10, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_r = atoi(databuff);
  for (i = 1 + 5 + 10, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_g = atoi(databuff);
  for (i = 1 + 8 + 10, j = 0; j < 3; i++, j++)
    databuff[j] = msgbuff[i];
  databuff[3] = '\0';
  n_b = atoi(databuff);
  r_r = n_r; g_r = n_g; b_r = n_b;
  if (v) {
    Serial.print(F("[nano] hue – LEFT  rgb(")); Serial.print(r_l); Serial.print(F(", ")); Serial.print(g_l); Serial.print(F(", ")); Serial.print(b_l); Serial.println(")");
    Serial.print(F("             RIGHT rgb(")); Serial.print(r_r); Serial.print(F(", ")); Serial.print(g_r); Serial.print(F(", ")); Serial.print(b_r); Serial.println(")");
  }
  // change color
  red_l(r_l); green_l(g_l); blue_l(b_l);
  red_r(r_r); green_r(g_r); blue_r(b_r);
}
*/

// process hue from msgbuff
void hue_hex(void) {
	// parse message data
	int i, j;
	n_r_l = 0;
	n_g_l = 0;
	n_b_l = 0;
	// parse left
	for (i = 2, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_r_l = strtol(databuff, NULL, 16);
	n_r = (int)n_r_l;
	for (i = 4, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_g_l = strtol(databuff, NULL, 16);
	n_g = (int)n_g_l;
	for (i = 6, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_b_l = strtol(databuff, NULL, 16);
	n_b = (int)n_b_l;
	r_l = n_r;
	g_l = n_g;
	b_l = n_b;
	n_r_l = 0;
	n_g_l = 0;
	n_b_l = 0;
	// parse right
	for (i = 9, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_r_l = strtol(databuff, NULL, 16);
	n_r = (int)n_r_l;
	for (i = 11, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_g_l = strtol(databuff, NULL, 16);
	n_g = (int)n_g_l;
	for (i = 13, j = 0; j < 2; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[2] = '\0';
	n_b_l = strtol(databuff, NULL, 16);
	n_b = (int)n_b_l;
	r_r = n_r;
	g_r = n_g;
	b_r = n_b;
#ifdef LOG_DEBUG
	Serial.print(F("[nano] hue – LEFT  rgb("));
	Serial.print(r_l);
	Serial.print(F(", "));
	Serial.print(g_l);
	Serial.print(F(", "));
	Serial.print(b_l);
	Serial.println(")");
	Serial.print(F("             RIGHT rgb("));
	Serial.print(r_r);
	Serial.print(F(", "));
	Serial.print(g_r);
	Serial.print(F(", "));
	Serial.print(b_r);
	Serial.println(")");
#endif
	// change color
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);
	// old_val: hhr012123234l123234132
	// labels:  0123456789ABCDEFGHIJKL
	// new_val: hhEF2D2A|AD3F90
	// labels:  0123456789ABCDE
}

// process shuffle from msgbuff
void hue_shuffle(void) {
	shuffle_hues = (memcmp(msgbuff + 4, "true", 4) == 0);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] shuffle – "));
	Serial.println(shuffle_hues);
#endif
}

/*
// process pattern from msgbuff
void pattern(bool v) {
  // match left and right
  r_r = r_l; g_r = g_l; b_r = b_l;
  red_l(r_l); green_l(g_l); blue_l(b_l);
  red_r(r_r); green_r(g_r); blue_r(b_r);
  // loop through tokens
  for (int z = 1; uninterrupted() && tokenize(tokenbuff, msgbuff + 1, ',', z); z++) {
    fade = 0; // reset fade to default (none)
    // parse message data
    int i, j;
    for (i = 0, j = 0; j < 5; i++, j++)
      databuff[j] = tokenbuff[i];
    databuff[5] = '\0';
    fade = atoi(databuff);
    for (i = 5, j = 0; j < 3; i++, j++)
      databuff[j] = tokenbuff[i];
    databuff[3] = '\0';
    n_r = atoi(databuff);
    for (i = 8, j = 0; j < 3; i++, j++)
      databuff[j] = tokenbuff[i];
    databuff[3] = '\0';
    n_g = atoi(databuff);
    for (i = 11, j = 0; j < 3; i++, j++)
      databuff[j] = tokenbuff[i];
    databuff[3] = '\0';
    n_b = atoi(databuff);
    for (i = 14, j = 0; j < 5; i++, j++)
      databuff[j] = tokenbuff[i];
    databuff[5] = '\0';
    t = atoi(databuff);
    if (v) { Serial.print(F("[nano] fade – ")); Serial.print(fade); Serial.println(F("ms")); }
    if (v) { Serial.print(F("[nano] hue – rgb(")); Serial.print(n_r); Serial.print(F(", ")); Serial.print(n_g); Serial.print(F(", ")); Serial.print(n_b); Serial.print(")"); Serial.print(" – "); Serial.print(t); Serial.println("ms"); }
    // fade into color
    fadeColor();
    // hold color for time
    for (j = t / PRECISION / (speedmult / 100.0); uninterrupted() && j > 0; j--) {
      delay(PRECISION);
    }
  }
  if (v) Serial.println("[nano] repeat");
}
*/

// process hex pattern from msgbuff
void pattern_hex(bool v) {
	// match left and right
	r_r = r_l;
	g_r = g_l;
	b_r = b_l;
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);
	// loop through tokens
	double time_cnt = 0;
	for (int z = 1; uninterrupted() && tokenize(tokenbuff, msgbuff + 1, ',', z); z++) {
		fade = 0;  // reset fade to default (none)
		// parse message data
		int i, j;
		for (i = 0, j = 0; j < 5; i++, j++)
			databuff[j] = tokenbuff[i];
		databuff[5] = '\0';
		fade = atoi(databuff);
		for (i = 5, j = 0; j < 2; i++, j++)
			databuff[j] = tokenbuff[i];
		databuff[2] = '\0';
		n_r_l = strtol(databuff, NULL, 16);
		n_r = (int)n_r_l;
		for (i = 7, j = 0; j < 2; i++, j++)
			databuff[j] = tokenbuff[i];
		databuff[2] = '\0';
		n_g_l = strtol(databuff, NULL, 16);
		n_g = (int)n_g_l;
		for (i = 9, j = 0; j < 2; i++, j++)
			databuff[j] = tokenbuff[i];
		databuff[2] = '\0';
		n_b_l = strtol(databuff, NULL, 16);
		n_b = (int)n_b_l;
		for (i = 11, j = 0; j < 5; i++, j++)
			databuff[j] = tokenbuff[i];
		databuff[5] = '\0';
		t = atoi(databuff);
#ifdef LOG_DEBUG
		if (v) {
			Serial.print(F("[nano] fade – "));
			Serial.print(fade);
			Serial.println(F("ms"));
		}
		if (v) {
			Serial.print(F("[nano] hue – rgb("));
			Serial.print(n_r);
			Serial.print(F(", "));
			Serial.print(n_g);
			Serial.print(F(", "));
			Serial.print(n_b);
			Serial.print(")");
			Serial.print(" – ");
			Serial.print(t);
			Serial.println("ms");
		}
#endif
		// fade into color
		fadeColor();
		// hold color for time
		//    for (j = t / PRECISION / (speedmult / 100.0); uninterrupted() && j > 0; j--) {
		//      delay(PRECISION);
		//    }
		time_cnt = 0;
		for (j = t / PRECISION / (speedmult / 100.0); uninterrupted() && j > 0; j--) {
			time_cnt += PRECISION;
		}
		delay(time_cnt);
	}
#ifdef LOG_DEBUG
	if (v) Serial.println(F("[nano] repeat"));
#endif
}

// fade into current color
void fadeColor(void) {
	// perform fade if exists
	if (fade != 0) {
		r_st = ((double)PRECISION) * (n_r - r_l) / ((double)fade);
		g_st = ((double)PRECISION) * (n_g - g_l) / ((double)fade);
		b_st = ((double)PRECISION) * (n_b - b_l) / ((double)fade);
		for (int z = fade / PRECISION / (speedmult / 100.0); uninterrupted() && z > 0; z--) {
			r_l += r_st;
			g_l += g_st;
			b_l += b_st;
			if (r_l < 0) r_l = 0;
			if (r_l > 255) r_l = 255;
			if (g_l < 0) g_l = 0;
			if (g_l > 255) g_l = 255;
			if (b_l < 0) b_l = 0;
			if (b_l > 255) b_l = 255;
			r_r = r_l;
			g_r = g_l;
			b_r = b_l;
			red_l(r_l);
			green_l(g_l);
			blue_l(b_l);
			red_r(r_r);
			green_r(g_r);
			blue_r(b_r);
			delay(PRECISION);
		}
	}
	// change final color
	r_l = n_r;
	g_l = n_g;
	b_l = n_b;
	r_r = r_l;
	g_r = g_l;
	b_r = b_l;
	red_l(r_l);
	green_l(g_l);
	blue_l(b_l);
	red_r(r_r);
	green_r(g_r);
	blue_r(b_r);
}

/*
// random color
void random_hue(bool output) {
  r_l = random(0, 256);
  g_l = random(0, 256);
  b_l = random(0, 256);
  r_r = random(0, 256);
  g_r = random(0, 256);
  b_r = random(0, 256);
  if (output) {
    red_l(r_l); green_l(g_l); blue_l(b_l);
    red_r(r_r); green_r(g_r); blue_r(b_r);
  }
}
*/

// random color
int hue_i_prev = -1;
void random_hue_preset(bool output) {
	int hue_i = hue_i_prev;
	while (hue_i == hue_i_prev)
		hue_i = random(0, SHUFFLE_HUE_PRESET_NUM);
	r_l = shuffle_hue_presets[hue_i][0];
	g_l = shuffle_hue_presets[hue_i][1];
	b_l = shuffle_hue_presets[hue_i][2];
	r_r = shuffle_hue_presets[hue_i][0];
	g_r = shuffle_hue_presets[hue_i][1];
	b_r = shuffle_hue_presets[hue_i][2];
	if (output) {
		red_l(r_l);
		green_l(g_l);
		blue_l(b_l);
		red_r(r_r);
		green_r(g_r);
		blue_r(b_r);
	}
	hue_i_prev = hue_i;
}

// music reactive mode
void music(void) {
	while (uninterrupted()) {
		// pulse strobe to cycle bands
		for (int i = 0; i < 7; i++) {
			// cycle
			digitalWrite(STROBEPIN, LOW);
			delayMicroseconds(100);
			// read
			bands[i] = analogRead(OUTRPIN) + analogRead(OUTLPIN);
			digitalWrite(STROBEPIN, HIGH);
			delayMicroseconds(1);
			double level;
			if (i == l_channel) {
				level = bands[i];
//        Serial.println(level);
				// pre-amplify
				level *= l_preamp;
				// correct
				level /= 2.0;
				level *= 255.0 / 1023.0;
				// round
				level /= 5.0;
				level = (int)level;
				level *= 5.0;
				// post-amplify
				level *= l_postamp;
				// bound
				if (level <= noise) level = 0;
				if (level > 255) level = 255;
				// smooth
				if (smoothing > 0) {
					double weight = (smoothing / 100.0);
					level = (level * (1.0 - weight)) + (bands_record_l[i] * weight);
				}
				// shuffle
				if (shuffle_hues) {
					double diff = bands[i] - shuffle_record_l;
					if (diff < 0) diff *= -1;
					//Serial.print("[nano] diff: ");
					//Serial.println(diff);
					if (diff > shuffle_beat_threshold) {
						// detect raw beat
						if (shuffle_beat_limit_counter <= 0) {
							shuffle_beat_limit_counter = shuffle_beat_limit;
							// detect limited beat
							// Serial.println("[nano] beat");
							// random_hue(false);
							random_hue_preset(false);
						} else
							shuffle_beat_limit_counter--;
					}  //else shuffle_beat_limit_counter = 0;  // else shuffle_beat_limit_counter = 1;
				}
				// save
				bands_record_l[i] = level;
				shuffle_record_l = bands[i];
				// invert
				if (l_invert) level = 255 - level;
				level /= 255.0;
				red_l(((double)r_l) * level);
				green_l(((double)g_l) * level);
				blue_l(((double)b_l) * level);
			}
			if (i == r_channel) {
				level = bands[i];
				level *= r_preamp;
				level /= 2.0;
				level *= 255.0 / 1023.0;
				level /= 5.0;
				level = (int)level;
				level *= 5.0;
				level *= r_postamp;
				if (level <= noise) level = 0;
				if (level > 255) level = 255;
				if (smoothing > 0) {
					double weight = (smoothing / 100.0);
					level = (level * (1.0 - weight)) + (bands_record_r[i] * weight);
				}
				if (shuffle_hues) {
					double diff = bands[i] - shuffle_record_r;
					if (diff < 0) diff *= -1;
					if (diff > shuffle_beat_threshold) {
						if (shuffle_beat_limit_counter <= 0) {
							shuffle_beat_limit_counter = shuffle_beat_limit;
							// random_hue(false);
							random_hue_preset(false);
						} else
							shuffle_beat_limit_counter--;
					}  //else shuffle_beat_limit_counter = 0;
				}
				bands_record_r[i] = level;
				shuffle_record_r = bands[i];
				if (r_invert) level = 255 - level;
				level /= 255.0;
				red_r(((double)r_r) * level);
				green_r(((double)g_r) * level);
				blue_r(((double)b_r) * level);
			}
		}
	}
	if (!uninterrupted()) {
		red_l(0);
		green_l(0);
		blue_l(0);
		red_r(0);
		green_r(0);
		blue_r(0);
	}
}

// set smoothing
void smooth(void) {
	int i, j;
	for (i = 1, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	smoothing = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] smoothing – "));
	Serial.println(smoothing);
#endif
}

// set noise gate
void noise_gate(void) {
	int i, j;
	for (i = 1, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	noise = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] noise gate – "));
	Serial.println(noise);
#endif
}

// set left channel
void left_channel(void) {
	int i, j;
	for (i = 2, j = 0; j < 1; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[1] = '\0';
	l_channel = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] left channel – "));
	Serial.println(l_channel);
#endif
}
// set right channel
void right_channel(void) {
	int i, j;
	for (i = 2, j = 0; j < 1; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[1] = '\0';
	r_channel = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] right channel – "));
	Serial.println(r_channel);
#endif
}

// set left invert
void left_invert(void) {
	int i, j;
	for (i = 2, j = 0; j < 1; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[1] = '\0';
	l_invert = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] left invert – "));
	Serial.println(l_invert);
#endif
}
// set right invert
void right_invert(void) {
	int i, j;
	for (i = 2, j = 0; j < 1; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[1] = '\0';
	r_invert = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] right invert – "));
	Serial.println(r_invert);
#endif
}

// set left preamp
void left_preamp(void) {
	int i, j;
	for (i = 3, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	l_preamp = atoi(databuff);
	l_preamp /= 100.0;
#ifdef LOG_DEBUG
	Serial.print(F("[nano] left preamp – "));
	Serial.println(l_preamp);
#endif
}
// set right preamp
void right_preamp(void) {
	int i, j;
	for (i = 3, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	r_preamp = atoi(databuff);
	r_preamp /= 100;
#ifdef LOG_DEBUG
	Serial.print(F("[nano] right preamp – "));
	Serial.println(r_preamp);
#endif
}

// set left postamp
void left_postamp(void) {
	int i, j;
	for (i = 3, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	l_postamp = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] left postamp – "));
	Serial.println(l_postamp);
#endif
}
// set right postamp
void right_postamp(void) {
	int i, j;
	for (i = 3, j = 0; j < 3; i++, j++)
		databuff[j] = msgbuff[i];
	databuff[3] = '\0';
	r_postamp = atoi(databuff);
#ifdef LOG_DEBUG
	Serial.print(F("[nano] right postamp – "));
	Serial.println(r_postamp);
#endif
}

// LED PWM functions
void red_l(int v) {
	analogWrite(REDPIN_L, (int)(brightness / 100.0 * ((double)v)));
}
void green_l(int v) {
	analogWrite(GREENPIN_L, (int)(brightness / 100.0 * ((double)v)));
}
void blue_l(int v) {
	analogWrite(BLUEPIN_L, (int)(brightness / 100.0 * ((double)v)));
}
void red_r(int v) {
	analogWrite(REDPIN_R, (int)(brightness / 100.0 * ((double)v)));
}
void green_r(int v) {
	analogWrite(GREENPIN_R, (int)(brightness / 100.0 * ((double)v)));
}
void blue_r(int v) {
	analogWrite(BLUEPIN_R, (int)(brightness / 100.0 * ((double)v)));
}

// convenience custom tokenizer
int tokenize(char* dst, char* src, char delim, int occ) {
	int o, b, e;
	e = -1;
	for (o = 0; o < occ; o++) {
		if (e > 0 && src[e] == '\0' && o < occ) return 0;
		b = e + 1;
		for (e = b; src[e] != '\0' && src[e] != delim; e++)
			;
	}
	if (b == e) return 0;
	strncpy(dst, src + b, e - b);
	dst[e - b] = '\0';
	return 1;
}

// write message buffer to output serial
void writeBuffer(void) {
	if (msgbuff[0] == '[') {
		Serial.print(F("[esp:"));
		Serial.println(msgbuff + 1);
	} else {
		Serial.print(F("[serial] "));
		Serial.println(msgbuff);
	}
}

/** pattern capacity calculation
  single pattern: 5(f) + 2(r) + 2(g) + 2(b) + 5(t) = 16
  pattern message capacity: 1('p') + 16 * MAX_PATTERNS + 1('\0') = 2 + 16 * MAX_PATTERNS
  if MAX_PATTERNS = 20, capacity = 2 + 16 * 20 = 2 + 320 = 322
*/
