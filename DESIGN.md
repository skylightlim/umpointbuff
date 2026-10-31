# Design

Material 3 Expressive in Jetpack Compose. Material decides what things are: components, navigation, Back, colour roles. Apple's fluid-interface ideas decide how they feel: instant press feedback, interruptible springs, and no input ever waiting on an animation.

The look is studied from two apps the owner points to as the bar: Minus (open source, `isaacsa51/Minus`) and Material Capsule. See "What we took from them" in `docs/KNOWLEDGE.md`.

Sources: [Start building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive), [motion in Compose](https://m3.material.io/blog/m3-expressive-motion-theming), [choosing a colour scheme](https://m3.material.io/styles/color/choosing-a-scheme), [toolbars](https://m3.material.io/components/toolbars/guidelines).

## Colour

Dynamic colour from the wallpaper on Android 12 and up, with a court-green scheme below that. Screens use `MaterialTheme.colorScheme` roles.

What a court or snipe means never follows the wallpaper. `LocalCourtColors` holds these fixed colours:

| Meaning | Colour |
|---|---|
| Free | Green |
| Yours or booked | Blue |
| Armed | Amber |

Every state also has a word, an icon or a shape, so colour never carries the meaning alone. Amber is one bright colour with dark ink in both themes: a darker amber for white text reads as brown.

## Surfaces

The screen sits on tinted `surfaceContainer`, with lighter `surfaceBright` cards on top. Rows of a group touch with a 3 dp gap: 28 dp corners outside a group and 6 dp where rows meet (`segmentShape`). Each group has a small `primary` label above it. A row's icon sits in a squircle (`IconTile`), and a trailing control sits behind a thin divider.

Warnings are whole-card targets in `errorContainer` with a filled squircle (`ProblemCard`).

No cards inside cards: pieces that belong together touch as one group instead, like the countdown and its two slots.

Content dissolves where it meets floating chrome (`fadingEdges`) instead of running under it with a hard edge or a divider. The top only fades once something has scrolled away behind it. Snackbars sit above the dock and the main action.

## Type

Google Sans Flex (Open Font License, licence in `assets/`), set up the way Material Capsule uses it: 24 pt optical size, normal width, not rounded. The owner chose this over Minus's rounded, stretched version. Weight and size carry the hierarchy, and numbers use tabular figures. Numbers are the content here, so emphasised headlines are 600. Tracking belongs to a size: slightly tight on big type and barely open on small, because Material's defaults are wide for this font.

## Motion

The owner asked for as much spring as possible, so `BouncyMotion` in `Theme.kt` is much springier than Material's expressive scheme. Use `MaterialTheme.motionScheme` for controls and never a tween.

Whole pages are the exception: the owner found them too bouncy, so tab changes and Settings use the nearly bounce-free `pageSpring()`. Entrances (`bounceIn`) are gentle and play once per screen.

Things should move like the thing they are:

- The tapped time chip grows into the card at the top of the court step and its start time flies across (`sharedBounds`). System Back reverses it, and the predictive back gesture drives it with the finger through a seekable transition, so it can be pulled back and let go.
- The dock and the main action trade places the moment the step changes, not when it settles.

- Anything that moves, resizes or changes shape overshoots: `*SpatialSpec`.
- Colour and opacity don't: `*EffectsSpec`.
- Digits of the live countdown roll into place on their own gentler spring and stay still. They're clipped to their line like an odometer, because a digit that changes every second at this size can't fly around.
- `springPress` and `bounceIn` in `ui/components/Motion.kt` cover custom pieces. Material components get it from the theme.
- Android's "remove animations" setting skips all of it, which Compose handles itself.

## Hero moments

Material's guidance is one or two per product. These are the two, and full shape morphs are saved for them:

1. **Arming:** a shape bursts up and morphs, and the countdown starts rolling (`ArmedHero`).
2. **The result:** a full screen saying Booked or Not booked with the reason, shown once on the first open after a snipe (`ResultHero`).

## Screens

- **Courts:** date, then time, then court, one step at a time. One date row covers both weeks, so there is no week switch, and the date decides whether the button says Book or Arm. The strip starts with the Passed toggle, where the past is: passed days slide in right next to it. Four pips under each time show which courts are free, in court order, filled or hollow, and a time with something more important to say shows a word instead (Armed, Yours, Full). System Back steps back.
- **Sniper:** problems first, only when something is wrong. Then the countdown and next week's two slots as shuttles, touching as one group. The digits exactly fill the card's width, and the headline turns amber as soon as a snipe is armed, so the state reads from across the room. Then the rules, grouped by where they come from so the source needs no decoding, and collapsed history. There is no readiness checklist and no test-run button.
- **Bookings:** grouped by week, calm. Cancelling opens UMPoint's own page, so its button stays quiet: the real decision is made there.
- **Settings:** a secondary page behind the avatar.

A shuttle's shape shows its state: circle and dashed when empty, cookie when armed, burst when booked. `ShuttleBadge` morphs between them. It is the app's one custom motif, and the launcher icon uses the same artwork on court green with an amber cork, with a monochrome layer for themed icons.

## Components

`FloatingDock` (a floating pill of tabs, whose selected blob has two edges on separate springs) with `NavigationRail` from 600 dp, a one-row `TopAppBar` with the title and avatar side by side, `ToggleButton`, connected button groups for duration, `shapes = ButtonDefaults.shapes()` on buttons, `LoadingIndicator`, and the expressive pull-to-refresh indicator.

In the court step the dock slides away and the big Book or Arm button floats in its place, so the main action is always in reach. Settings shrinks and rounds under the predictive back gesture.

The dock is a deliberate departure: Material reserves floating toolbars for secondary pages and uses a navigation bar for top-level tabs. The owner chose it after studying Capsule. Keep routine lists calm. Touch targets are at least 48 dp.
