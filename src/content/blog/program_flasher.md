---
title: 'How Microcontroller Flashing Works: ArduinoISP, SPI, and AVRDUDE'
description: 'How an AVR actually gets flashed: avrdude sends STK500 commands to an Arduino running ArduinoISP over serial, and the sketch writes the target flash over SPI.'
pubDate: '30 Aug 2026'
updatedDate: '15 Sep 2026'
heroImage: '../../assets/flasher_hero.png'
heroAlt: 'Glowing microcontroller chip icon on a purple and teal gradient background'
---

## Why are we here

Have you ever wondered how the C code on your PC actually ends up inside a microcontroller? Or maybe you are moving from a dev board to a custom PCB and want to upload firmware without relying on the Arduino IDE's board definitions. Either way, the mechanism is worth understanding.

The short version: a tool called **avrdude** on your PC speaks a small command protocol over serial to a **programmer** — in this case, an Arduino running the [ArduinoISP sketch](https://docs.arduino.cc/built-in-examples/arduino-isp/ArduinoISP/). The programmer translates those commands into **SPI transactions** that put the target chip into programming mode and write its flash memory. That is the entire path, and this post traces it end to end using the official ArduinoISP example so every step is reproducible.

## Example

The best explanation comes with a real example we can dissect step by step. We will use Arduino's `ArduinoISP.ino` example sketch, which turns an Arduino into an AVR programmer. The [full sketch is on GitHub](https://github.com/arduino/arduino-examples/blob/main/examples/11.ArduinoISP/ArduinoISP/ArduinoISP.ino) and is well commented, so you can read it directly if you prefer. If you stick around, we will walk through the parts that matter.

## Code

All excerpts below come from the [ArduinoISP example sketch](https://docs.arduino.cc/built-in-examples/arduino-isp/ArduinoISP/). The sketch opens by explaining which pins are used and why:

```c
// Pin 10 is used to reset the target microcontroller.
//
// By default, the hardware SPI pins MISO, MOSI and SCK are used to communicate
// with the target. On all Arduinos, these pins can be found
// on the ICSP/SPI header:
//
//               MISO °. . 5V (!) Avoid this pin on Due, Zero...
//               SCK   . . MOSI
//                     . . GND
//
// .........
//
// Put an LED (with resistor) on the following pins:
// 9: Heartbeat   - shows the programmer is running
// 8: Error       - Lights up if something goes wrong (use red if that makes sense)
// 7: Programming - In communication with the target
```

Data moves over SPI using the 3-wire setup: SCK, MOSI, and MISO. Because we are only programming the target, MOSI is obviously required — but why MISO? Because the programmer also reads data back, for example the target's signature bytes to confirm which chip is connected. Pins 9, 8, and 7 only drive indicator LEDs; the project works fine without them connected.

Next comes the programmer's SPI configuration:

```c
// Configure SPI clock (in Hz).
// E.g. for an ATtiny @ 128 kHz: the datasheet states that both the high and low
// SPI clock pulse must be > 2 CPU cycles, so take 3 cycles i.e. divide target
// f_cpu by 6:
//     #define SPI_CLOCK            (128000/6)
//
// A clock slow enough for an ATtiny85 @ 1 MHz, is a reasonable default:

#define SPI_CLOCK (1000000 / 6)
```

The SPI clock sets how fast program bytes are shifted from the programmer to the target. Most of the code that follows is SPI configuration, including the choice between the hardware peripheral and a bit-banged implementation:

```c
#if SPI_CLOCK > (F_CPU / 128)
#define USE_HARDWARE_SPI
#endif
```

Hardware SPI is used only above a speed threshold; below it, the sketch falls back to the bit-banged implementation configured later in the file. The reason is simple: software SPI is naturally slower, and targets that accept faster programming need the dedicated hardware peripheral.

Next comes a more nuanced detail — the baud rate:

```c
#define BAUDRATE 19200
```

This is the speed at which the programmer reads compiled program bytes from your PC, so it caps the effective flashing speed. It is easy to confuse with the SPI clock. The SPI clock is how fast the target can accept bits; the baud rate is how fast the programmer receives them from the PC. Your target may support a higher SPI clock, but it still only gets programmed as fast as the flasher reads data over serial.

### Side note

If you ever need a bit-banged SPI implementation for an Arduino, this sketch is a good reference:

```c
class BitBangedSPI {
public:
  void begin() {
    digitalWrite(ARDUINOISP_PIN_SCK, LOW);
    digitalWrite(ARDUINOISP_PIN_MOSI, LOW);
    pinMode(ARDUINOISP_PIN_SCK, OUTPUT);
    pinMode(ARDUINOISP_PIN_MOSI, OUTPUT);
    pinMode(ARDUINOISP_PIN_MISO, INPUT);
  }

  void beginTransaction(SPISettings settings) {
    pulseWidth = (500000 + settings.getClockFreq() - 1) / settings.getClockFreq();
    if (pulseWidth == 0) {
      pulseWidth = 1;
    }
  }

  void end() {}

  uint8_t transfer(uint8_t b) {
    for (unsigned int i = 0; i < 8; ++i) {
      digitalWrite(ARDUINOISP_PIN_MOSI, (b & 0x80) ? HIGH : LOW);
      digitalWrite(ARDUINOISP_PIN_SCK, HIGH);
      delayMicroseconds(pulseWidth);
      b = (b << 1) | digitalRead(ARDUINOISP_PIN_MISO);
      digitalWrite(ARDUINOISP_PIN_SCK, LOW);  // slow pulse
      delayMicroseconds(pulseWidth);
    }
    return b;
  }

private:
  unsigned long pulseWidth;  // in microseconds
};
```

Digging further, we reach the main loop — and the actual job of the programmer:

```c
void loop(void) {
  // is pmode active?
  if (pmode) {
    digitalWrite(LED_PMODE, HIGH);
  } else {
    digitalWrite(LED_PMODE, LOW);
  }
  // is there an error?
  if (ISPError) {
    digitalWrite(LED_ERR, HIGH);
  } else {
    digitalWrite(LED_ERR, LOW);
  }

  // light the heartbeat LED
  heartbeat();
  if (SERIAL.available()) {
    avrisp();
  }
}
```

Not much of a reveal, is it? The interesting work happens one level down, in `avrisp()`, which reads command bytes from the serial port:

```c
void avrisp() {
  uint8_t ch = getch();
  switch (ch) {
    case '0':  // signon
      ISPError = 0;
      empty_reply();
      break;
    case '1':
      if (getch() == CRC_EOP) {
        SERIAL.print((char)STK_INSYNC);
        SERIAL.print("AVR ISP");
        SERIAL.print((char)STK_OK);
      } else {
        ISPError++;
        SERIAL.print((char)STK_NOSYNC);
      }
      break;
    case 'A':
      get_version(getch());
      .
      .
      .
      .
    case 'P':
      if (!pmode) {
        start_pmode();
      }
      empty_reply();
      break;
    case 'U':  // set address (word)
      here = getch();
      here += 256 * getch();
      empty_reply();
      break;

    case 0x60:  //STK_PROG_FLASH
      getch();  // low addr
      getch();  // high addr
      empty_reply();
      break;
    case 0x61:  //STK_PROG_DATA
      getch();  // data
      empty_reply();
      break;

    case 0x64:  //STK_PROG_PAGE
      program_page();
      break;

    case 0x74:  //STK_READ_PAGE 't'
      read_page();
      break;
      .
      .
      .
      .
    case 0x75:  //STK_READ_SIGN 'u'
      read_signature();
      break;

    // expecting a command, not CRC_EOP
    // this is how we can get back in sync
    case CRC_EOP:
      ISPError++;
      SERIAL.print((char)STK_NOSYNC);
      break;

    // anything else we will return STK_UNKNOWN
    default:
      ISPError++;
      if (CRC_EOP == getch()) {
        SERIAL.print((char)STK_UNKNOWN);
      } else {
        SERIAL.print((char)STK_NOSYNC);
      }
  }
}
```

These single-byte commands are the **STK500 protocol**. Each one triggers a specific SPI transaction against the target: entering programming mode, writing a page, or reading the device signature. Nobody types these bytes into a serial monitor by hand — flashing software sends them for you. For AVR targets that software is [AVRDUDE](https://avrdudes.github.io/avrdude/), which knows exactly which commands to send and in what order.

## The most interesting functions

A programmer supports a lot of commands; the ones that matter most here are the following.

Entering programming mode:

```c
void start_pmode() {

  // Reset target before driving ARDUINOISP_PIN_SCK or ARDUINOISP_PIN_MOSI

  // SPI.begin() will configure SS as output, so SPI master mode is selected.
  // We have defined RESET as pin 10, which for many Arduinos is not the SS pin.
  // So we have to configure RESET as output here,
  // (reset_target() first sets the correct level)
  reset_target(true);
  pinMode(RESET, OUTPUT);
  SPI.begin();
  SPI.beginTransaction(SPISettings(SPI_CLOCK, MSBFIRST, SPI_MODE0));

  // See AVR datasheets, chapter "SERIAL_PRG Programming Algorithm":

  // Pulse RESET after ARDUINOISP_PIN_SCK is low:
  digitalWrite(ARDUINOISP_PIN_SCK, LOW);
  delay(20);  // discharge ARDUINOISP_PIN_SCK, value arbitrarily chosen
  reset_target(false);
  // Pulse must be minimum 2 target CPU clock cycles so 100 usec is ok for CPU
  // speeds above 20 KHz
  delayMicroseconds(100);
  reset_target(true);

  // Send the enable programming command:
  delay(50);  // datasheet: must be > 20 msec
  spi_transaction(0xAC, 0x53, 0x00, 0x00);
  pmode = 1;
}
```

This is the handshake that tells the target it is about to receive program bytes. The exact sequence differs per controller, and the authoritative source is that controller's datasheet — usually under its programming or memory-programming section. For the ATmega328P, Microchip's [ATmega328P product page](https://www.microchip.com/en-us/product/ATMEGA328P) links the current datasheet and errata.

Here is the command that writes a full page to the target:

```c
 case 0x64:  //STK_PROG_PAGE
      program_page();
      break;
```

And this is where MISO earns its keep — reading the device signature back:

```c
 case 0x75:  //STK_READ_SIGN 'u'
      read_signature();
      break;
```

```c
void read_signature() {
  if (CRC_EOP != getch()) {
    ISPError++;
    SERIAL.print((char)STK_NOSYNC);
    return;
  }
  SERIAL.print((char)STK_INSYNC);
  uint8_t high = spi_transaction(0x30, 0x00, 0x00, 0x00);
  SERIAL.print((char)high);
  uint8_t middle = spi_transaction(0x30, 0x00, 0x01, 0x00);
  SERIAL.print((char)middle);
  uint8_t low = spi_transaction(0x30, 0x00, 0x02, 0x00);
  SERIAL.print((char)low);
  SERIAL.print((char)STK_OK);
}
```

## Conclusion

That is the whole path from the PC to the target: the programmer reads bytes over serial, decodes them as STK500 commands, and forwards them over SPI in the required order. Other protocols such as JTAG and SWD frame their data differently, but the underlying principle is the same.

## Next Steps

Next we will look at what happens once those bytes reach the microcontroller: how it boots, and what runs before it jumps into the program you just flashed.

## Sources and further reading

- [ArduinoISP built-in example](https://docs.arduino.cc/built-in-examples/arduino-isp/ArduinoISP/) — official Arduino documentation for the sketch used above
- [ArduinoISP.ino source](https://github.com/arduino/arduino-examples/blob/main/examples/11.ArduinoISP/ArduinoISP/ArduinoISP.ino) — every code excerpt in this post comes from this file
- [AVRDUDE documentation](https://avrdudes.github.io/avrdude/) — the flashing software that sends STK500 commands to the programmer
- [ATmega328P product page](https://www.microchip.com/en-us/product/ATMEGA328P) — datasheets and errata with the serial programming algorithm
