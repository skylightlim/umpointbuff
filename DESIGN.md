# Design

Material 3 Expressive in Jetpack Compose. Material decides what things are: components, navigation, Back, colour roles. Apple's fluid-interface ideas decide how they feel: instant press feedback, interruptible springs, and no input ever waiting on an animation.

Sources: [Start building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive), [motion in Compose](https://m3.material.io/blog/m3-expressive-motion-theming), [choosing a colour scheme](https://m3.material.io/styles/color/choosing-a-scheme), [toolbars](https://m3.material.io/components/toolbars/guidelines).

## Colour

Dynamic colour from the wallpaper on Android 12 and up, with a court-green scheme below that. Screens use `MaterialTheme.colorScheme` roles.

What a court or snipe means never follows the wallpaper. `LocalCourtColors` holds these fixed colours:

| Meaning | Colour |
|---|---|
| Free | Green |
| Yours or booked | Blue |
| Armed | Amber |

Every state also has a word or icon, so colour never carries the meaning alone.

## Type

Roboto with the Emphasized styles for everything routine. Archivo Expanded appears only in the `display*` styles: hero numbers and hero titles. Numbers that change use tabular figures.

## Motion

The owner asked for as much spring as possible, so `BouncyMotion` in `Theme.kt` is much springier than Material's expressive scheme. Use `MaterialTheme.motionScheme` for all motion and never a tween.

- Anything that moves, resizes or changes shape overshoots: `*SpatialSpec`.
- Colour and opacity don't: `*EffectsSpec`.
- Digits of the live countdown roll into place and then stay still.
- `springPress` and `bounceIn` in `ui/components/Motion.kt` cover custom pieces. Material components get it from the theme.
- Android's "remove animations" setting skips all of it, which Compose handles itself.

## Hero moments

Material's guidance is one or two per product. These are the two, and full shape morphs are saved for them:

1. **Arming:** a shape bursts up and morphs, and the countdown starts rolling (`ArmedHero`).
2. **The result:** a full screen saying Booked or Not booked with the reason, shown once on the first open after a snipe (`ResultHero`).

## Screens

- **Courts:** date, then time, then court, one step at a time. One date row covers both weeks, so there is no week switch, and the date decides whether the button says Book or Arm. Picking a time collapses the time grid and springs the court step open. System Back steps back.
- **Sniper:** problems first, only when something is wrong, each with a Fix button. Then the countdown, next week's two slots as shuttles, the sourced rules, and collapsed history. There is no readiness checklist and no test-run button.
- **Bookings:** grouped by week, calm. Cancelling opens UMPoint's own page.
- **Settings:** a secondary page behind the avatar.

A shuttle's shape shows its state: circle and dashed when empty, cookie when armed, burst when booked. `ShuttleBadge` morphs between them. It is the app's one custom motif.

## Components

`ShortNavigationBar`, `NavigationRail` from 600 dp, `MediumFlexibleTopAppBar`, `ToggleButton`, connected button groups for duration, `shapes = ButtonDefaults.shapes()` on buttons, `LoadingIndicator`, and the expressive pull-to-refresh indicator.

Don't show a floating toolbar with the navigation bar, and keep routine lists calm. Touch targets are at least 48 dp.
