---
title: 'How do you flash a program onto a microcontroller'
description: 'Ever thought of what actually happens when you connect your arduino to your pc and click flash. What is actually happening that the program that you just wrote magically gets uploaded to that tiny microcontroller in front of you just by the usb port of your pc.'
pubDate: '30 Aug 2026'
heroImage: '../../assets/flasher_hero.png'
---

## Why are we here

Have you ever wondered as to how exactly is it that the tiny microcontroller that you program everyday for your university class or project takes that c code from your pc into its memory ? or maybe you are here because you are finally done prototyping and are going to make your very own pcb but have stopped in your tracks, wondering how is it that I can upload this custom program that I have written for my project onto the microcontroller that will be placed in my custom board. Well I can't help you with the schematic drawing for you personal PCB but I can certainly help you understand (from my basic and measly) understanding of how exactly is it that the program travels from your pc to the microcontroller.

## Example 

Now the best explanation is always provided with a real world example. Something we can go through step by step , dissect each step (maybe even break a few steps in the middle just to see what happens if it does) so for this explanation we will be taking the help of the Arduino's ArduinoISP.ino example sketch file which turns the arduino into an AVR microcontroller programmer. You can hop off here itself if you don't want to read this entire article (in case you are already bored from it) and look at the sketch file yourself since it is pretty well commented however if you choose to stick around I hope I don't disappoint you.

## Code

So as soon as you enter the code you are greeted with the comments that explains what pins are we going to be using and what will their uses be . 
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

As you can see we are using the spi pins to transfer data over to the target microcontroller. We will be using 3-wire SPI so the SCK , MISO and MOSI . Now for those of you wondering we are only going to be programming the target microcontroller so I understand why MOSI is required but why do we have to use MISO pins ? And to that I say , we think alike, but seriously the reason is to read the config of the target microcontroller for example to get its version. The other pins (Pins 9, 8, 7) are solely for indication and you can use this project without connecting them to an LED as well it will work just fine.

Now after this we get into the actual configuration of the programmer as we can see over here : 
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
The SPI speed is basically the speed at which we will be sending the program bytes over from the program flasher over to the microcontroller. Now for the most part of the code that comes up next is just the SPI configuration. Basically the example allows us to choose between the hardware SPI and the software SPI (i.e the bitbanged SPI). Here we can see it taking place : 
```c
#if SPI_CLOCK > (F_CPU / 128)
#define USE_HARDWARE_SPI
#endif
```
Only if the SPI speed is over a certain threshold do we opt to use the hardware SPI otherwise we will be using the bitbanged SPI that is configured later in the code. The reason we keep a speed threshold to the bitbanged SPI is because software SPI is naturally slower than hardware SPI and hence for target controllers that can take programs at higher speeds we will have to switch over to using the dedicated hardware SPI in the program.

Now next is a bit more nuanced detail that is the baud rate : 
```c
#define BAUDRATE 19200
```
Now this is the speed at which the program flasher reads the bytes of your compiled program from your pc so it is effectively the speed at which your target microcontroller is getting flashed. Now you must be thinking but you said the SPI clock speed is the speed at which we program our microcontroller and yes you would be correct to get confused, but here is the thing that SPI speed is the speed at which your microcontroller can understand things but the baud rate is the speed at which you're program flasher is reading the bytes of the program from your pc so even though your target controller might support higher speeds the effective speed it gets programmed at is the speed at which the flasher reads the data from the pc.

### Side Note : 
In case you would in the future be looking to make a bitbanged SPI program for arduino you can always refer to this sketch as an example as you can see here it has the implementation to help you through it : 
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
Now further inspecting the code we finally get to see the actual implementation of a program flasher and what is it exactly doing : 
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
Kind of a lackluster reveal huh ? I expected to see much more of bytes being read and sent over SPI, custom commands, step by step procedures of starting the program flashing. Well unfortunately we will have to do a bit more digging specifically in this function : 
```c
    avrisp();
```
Inside this function we see somethings that start to make more sense : 
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

Now over here is where we get to see custom bytes which when read over SPI perform specific commands pertaining to flashing to getting data back from the controller as well. However we cannot be typing each byte and command into the serial monitor of the arduino and program the target controller. Well don't worry we don't have to this is every flasher has a software utility that comes with it which knows what commands to send and in what order to send the bytes in , in this case to program an AVR controller we use a software known as : **AVRDUDE** . (To know more about how to use this sketch with an actual AVR microcontroller you can refer to this link : https://riktronics.wordpress.com/2016/07/26/program-avr-using-arduino-simplest-way/#more-621)

## MOST INTERESTING FUNCTIONS

Now there are a lot of functionalities that a programmer has but the ones we are mainly interested with are these : 
- The program flashing starter function : 
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
Over here you can see the entire process of how the flasher lets the target controller know that it is going to be sending it program bytes. Now these steps are different for different controllers and the only way you can know what steps you must take for your controller will be by reading its datasheet (most likely will be found under its programming section).

Next we can see here the command for the flasher to know that it has to write an entire page to the target controller : 
```c
 case 0x64:  //STK_PROG_PAGE
      program_page();
      break;
```

and we can also see the need for the MISO pin as well over here : 
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

This is pretty much all that happens from the pc to the flashers side. All it is reading bytes over serial and sending them via SPI to the target controller all you have to keep in mind is to send certain commands is a specific order and you are good to go. Now however there are other protocols like JTAG and SWD and they might read and send data in different formats and order but the underlying principle remains the same.

## Next Steps

Well now we will have to investigate as to what happens when these bytes reach the microcontroller and how does it boot and what are the procedures that happen before it boots into the main program that we have flashed.
