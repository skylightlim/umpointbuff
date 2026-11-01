Native Android app in Kotlin and Jetpack Compose, using Material 3 Expressive. It replaced an Expo/React Native app, which lives on the `rn-archive` branch.

## Commands

The JDK comes from `org.gradle.java.home` in `gradle.properties`, and the SDK from `local.properties`.

```bash
./gradlew :app:assembleDebug        # debug build, package com.skylightlim.umpoint.debug
./gradlew :app:assembleRelease      # signed, minified release, package com.skylightlim.umpoint
./gradlew :app:testDebugUnitTest    # sniper parser and booking-form tests
```

Run the tests before declaring a task done. Release signing reads `UMPOINT_*` from `~/.gradle/gradle.properties`; the key never enters the repo.

## Checking the UI

Debug builds have a demo mode with made-up courts and no network. It shows over the lock screen:

```bash
adb -s <serial> shell am start -n com.skylightlim.umpoint.debug/com.skylightlim.umpoint.MainActivity --es umpoint_demo none
```

Scenes: `none`, `armed`, `booked`, `failed`, `problem`, `signin`, `nogrid`. The `signin` scene opens the real sign-in page over the network, so treat it as a sign-in page.

To rehearse the midnight routine on a signed-in phone, add `--ez umpoint_dry_run true` to the same command with the app's own package. It runs in three minutes and books nothing. There is deliberately no button for this in the app.

Never read the screen (`uiautomator dump`, screenshots) while a sign-in page may be open, and stop touching a phone as soon as someone is using it.

## Structure

- `sniper/`: the unattended midnight booking. Its alarm, service and booker run with no UI, so keep it free of Compose. R8 keeps this package as written.
- `data/`: repository, cache and parsing.
- `screens/` and `ui/`: Compose. See `DESIGN.md`.

Three tabs (Courts, Sniper, Bookings) switch by state in `ui/AppRoot.kt`, with Settings behind the avatar. There is no navigation library: nothing deep-links.

## Rules

- Sniper changes need extra care: it fires once a week with nobody watching. One booking per action, courts tried one at a time, nothing cancelled on the user's behalf.
- Never log or show other students' data. UMPoint exposes bookers' emails and matric numbers in taken cells.
- Pin exact Material versions. Expressive APIs are in 1.5 beta, and `MaterialShapes` and `LoadingIndicator` are still experimental.
