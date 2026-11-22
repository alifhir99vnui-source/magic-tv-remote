# Magic TV Remote
Expo + React Native app with a local Kotlin Android module for ADB over TCP control with RSA authorization and Bluetooth HID keyboard/consumer navigation.

## Build

Requirements: Node.js 20, JDK 17, Android SDK platform 35, Android build tools 35, and a configured `ANDROID_HOME`.

```sh
npm install
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

In Termux, install Node.js and JDK 17 first and install/configure the Android SDK command line tools. `expo run:android` requires a connected device or emulator; it is not needed to build the APK.

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

Termux requires Node.js, JDK 17, Android SDK platform 35, build tools, and a Gradle wrapper download. GitHub Actions is configured in `.github/workflows/android.yml` and uses Java 17.

See [third-party notices](THIRD_PARTY_NOTICES.md) for the ADB library license.

## Known platform limits

- TCP probe and auto scan send a real ADB CNXN packet and accept only a valid ADB CNXN/AUTH response. Connecting performs the RSA authentication handshake and keeps an authenticated ADB session open for keyevents. The TV must have ADB over TCP enabled and the user must accept the RSA prompt.
- Bluetooth navigation uses the Android HID Device profile (Android 9+), which is unavailable on some phone chipsets/firmware. The TV must pair with the phone through its Bluetooth settings, then the app connects to the bonded host.
- Wi-Fi controls use Android KEYCODE values via `input keyevent`; voice search opens Global Search then sends KEYCODE_SEARCH. Whether this opens a microphone UI depends on the TV firmware. Bluetooth uses standard HID keyboard and consumer reports; TV firmware may ignore unsupported consumer usages.

The GitHub Actions workflow `.github/workflows/android.yml` builds the release APK and uploads it as a workflow artifact. It is the easiest build path when Termux does not have a configured Android SDK. The APK is unsigned for distribution unless a signing configuration is added.
