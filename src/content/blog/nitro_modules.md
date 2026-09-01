---
title: 'NitroModules vs TurboModules'
description: 'NitroModules vs TurboModules compared with real benchmarks: Swift support, codegen vs nitrogen, Hybrid Objects, and when each is the right choice in 2026.'
pubDate: '01 Feb 2026'
updatedDate: '01 Sep 2026'
heroImage: '../../assets/nitro_hero.jpg'
---

## What is Nitro?

So I will quote the main docs of NitroModules to explain what exactly it is : 

> Nitro is a framework for building powerful and fast native modules for JS. Simply put, a JS object can be implemented in C++, Swift or Kotlin instead of JS by using Nitro. 

Now historically speaking (like since the 2022's I dont know how historical is that by coding standards) TurboModules was the de-facto way of writing native modules. It boasted better performance than its predecessor Legacy Native Modules (How it gave these performance boost
is a topic reserved for another post alltogether).

However in present day the benchmarks tell another story all together. Performance wise Nitro has Turbo beat and hence is slowly becoming the defacto way for people to implement their native modules (the full numbers are shown in the benchmarks section below).

## NitroModules vs TurboModules at a glance

| | TurboModules | Expo Modules | NitroModules |
|---|---|---|---|
| Shipped with React Native core | ✅ zero deps | ❌ (`expo` package) | ❌ (`npm i react-native-nitro-modules`) |
| iOS implementation language | Objective-C (Swift via ObjC bridge) | Swift (bridges through ObjC) | Swift (direct C++ interop) or C++ |
| Android implementation language | Java / Kotlin | Kotlin | Kotlin or C++ |
| Code generator | Codegen — runs on every app build | None (handwritten TS defs) | nitrogen — run explicitly, generated code ships in the npm package |
| Native objects | Singletons only | "Shared objects" | HybridObject with real lifecycle + GC integration |
| Typed properties | ❌ getter/setter methods only | ✅ | ✅ |
| First-class JS callbacks | ❌ untyped Events | ❌ Events, no callback return values | ✅ typed callbacks, can return values |
| Tuples / `null` / `ArrayBuffer` | ❌ / ❌ / ❌ | ❌ / ❌ / ✅ | ✅ / ✅ / ✅ |
| Synchronous native calls | Limited | ❌ | ✅ |

## What the benchmarks actually say

Numbers from [NitroBenchmarks](https://github.com/mrousavy/NitroBenchmarks) (iPhone 15 Pro, release build, 100,000 synchronous calls):

| Operation | Expo Modules | TurboModules | NitroModules |
|---|---|---|---|
| 100,000 × `addNumbers(...)` | 434.85 ms | 115.86 ms | **7.27 ms** |
| 100,000 × `addStrings(...)` | 429.53 ms | 179.02 ms | **29.94 ms** |

That's ~15x faster than Turbo and ~59x faster than Expo on `addNumbers`, ~5x / ~13x on `addStrings`.

**The honest caveat:** these numbers measure JS↔native *call overhead* only — and the benchmark author says it himself. In real workloads where the native work dominates (API requests, navigation, forms), Turbo and Nitro finish within noise of each other. The overhead advantage matters when you cross the bridge thousands of times per second: camera frames, audio, sensors, crypto.

## Swift support: the boilerplate difference

For all you iOS developers this probably could be the most interesting part of Nitro Modules. Nitro provides swift support compared to Turbo that bridges swift code through Objective-C code. What does this mean for developers is a significant decrease in writing boilerplate code. For Example take a look at this code here : 

```swift
class HybridMath : HybridMathSpec {
  var someValue: Double
}
```
<br>

compared to Turbo's way of doing it : 

```objc
@implementation RTNMath {

  NSNumber* _someValue;
}
RCT_EXPORT_MODULE()

- (NSNumber*)getSomeValue {
  return _someValue;
}
- (void)setSomeValue:(NSNumber*)someValue {
  _someValue = someValue;
}
@end
```
<br>

This is possible because Nitro bridges Swift via a C++ interface

## The one place Turbo still wins

TurboModules is what is shipped with react-native core. So for all those particular about not wanting to increase the dependencies in their project this might make Turbo a more convenient choice for them. But for the rest of us who don't care about adding another package with

```bash
npm i react-native-nitro-modules
```
<br>

go ahead and add Nitro to your project.

## Hands-on: your first Nitro module

Ok enough of theoretical blabbering let's jump into the code and see one of the reasons why developers are liking Nitro so much. To start with we will have to make a nitro module now there are many ways of doing so but we will be using the create-nitro-module for this demonstration purposes

```bash
npx create-nitro-module@latest
```
<br>

We will be naming the package `react-native-math` for simplicity sake. Once generated navigate to the package 

```bash
cd react-native-math
```
<br>

and you will find `node_modules` already present as well as the `nitrogen` directory with the bridging-code already generated so for our next step we will navigate to the `example` app directory and install its dependencies

```bash
cd example/
npm i 
```
<br>

Now with that done we can open the `android` directory in Android studio and start editing the native code.

```bash
studio android/
```
<br>

Once the project is opened and the Gradle sync finally finishes (it takes forever sometimes) you will see the following files in your project

![android_project](../../assets/android_project.png)

Now let's try something fun, navigate over to the `math.nitro.ts` file and you will see something like this : 

```ts 

import { type HybridObject } from 'react-native-nitro-modules'

export interface Math extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  sum(num1: number, num2: number): number
}
```
<br>

now let's add another function sub, that we would like to implement on the native side to subtract a number

```ts 

import { type HybridObject } from 'react-native-nitro-modules'

export interface Math extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
  sum(num1: number, num2: number): number
  sub(num1: number, num2: number): number
}
```
<br>

After doing this we will have to regenerate the spec files by running 

```bash
npm run codegen
```
<br>

Now if you were to head on over to Android Studio and see the spec file you would see something like this : 

![spec_file](../../assets/spec_file.png)

And the best part is now you will be seeing an error like this : 

![error_spec](../../assets/error_spec.png)

This is one of the many benefits of running codegen while developing in contrast to what Turbo does and run it only on App compile time.
This provides TypeSafe and better context for developers jumping back and forth between the TypeScript code and the Native code.

## Already using TurboModules?

Migrating is less scary than it sounds:

- Your TypeScript spec concept carries over — a Nitro `HybridObject` interface is nitrogen's equivalent of a TurboModule `Spec`
- Codegen → nitrogen: instead of codegen running invisibly at every app build, you run `npm run codegen` explicitly and the generated bridging code ships inside your package — consumers never regenerate it
- The type errors you saw above surface in your editor at edit time, not at app compile time
- Both systems sit on JSI, so they can coexist while you migrate module by module

## Which should you choose?

**Choose TurboModules when:**
- You're publishing an OSS library and want zero third-party dependencies
- Your team is comfortable in Objective-C and values Meta's long-term backing
- Maximum ecosystem compatibility matters more than call overhead

**Choose Nitro when:**
- The module is performance-critical (thousands of native calls per second)
- You want Swift/Kotlin without Objective-C boilerplate
- You want Hybrid Objects and typed callbacks instead of stringly-typed events
- You're building on top of Nitro-based libraries (VisionCamera, etc.)

**Choose Expo Modules when:**
- You're already in the Expo ecosystem and want the least boilerplate
- Raw call overhead isn't your bottleneck

My take: the hype is real but narrower than it looks. Nitro didn't invent a faster engine — JSI did. Nitro removes the friction *around* the engine. For most apps the difference is invisible; for the right workloads it's the whole ballgame.

If you're ready to try it, run `npx create-nitro-module@latest` and follow the walkthrough above. Want the full picture? Read the [official comparison](https://nitro.margelo.com/docs/resources/comparison) and check the raw numbers in [NitroBenchmarks](https://github.com/mrousavy/NitroBenchmarks). And if Nitro saves you a weekend of Objective-C boilerplate, a star on the [Nitro repo](https://github.com/mrousavy/nitro) is a fair trade.
