# What we've already found out

Read this before investigating UMPoint, Material 3 or the phones again. Facts are as of 31 Oct 2026, so recheck anything time-sensitive. `AGENTS.md` has the commands, `DESIGN.md` the look, `PRODUCT.md` the product truth.

## UMPoint, the website

- **Sign-in:** students can only log in with Google OAuth, by tapping "UM Staff and Student". In-app Google sign-in works if the user agent drops the WebView markers (`browserUserAgent`).
- **Sessions:** they die after 10–20 idle minutes, and 5-minute pings kept one alive for 2+ hours. Two sessions can coexist. `PHPSESSID` is readable from JS, `cookiesession1` is HttpOnly.
- **Courts:** spid values are 21201, 21199, 21203 and 21205 for Courts 1–4.
- **Grid cells:** the id is `DD-MM-YYYY/HH:MM/HH:MM/HH:MM AM/HH:MM am`. A free cell has `cursorpointer` plus an id, and weekends use `closecols`.
- **Privacy:** popovers on taken cells show the booker's email and matric number. Never log or show them.
- **Rules:** see `RULES` in `SniperScreen.kt`. The source is `https://umpoint.um.edu.my/include/terms/156.html`.

### Telling whether UMPoint is down

Run `curl -s -m 15 -o /dev/null -w '%{http_code}\n' https://umpoint.um.edu.my/login/`. A 404 whose body says "Service Offline" is the maintenance page, not a missing URL.

UM uses split DNS, so the answer depends on the network:

| Network | Address | During the 31 Oct outage |
|---|---|---|
| Campus Wi-Fi, including the laptop | `10.254.202.52` (private) | Fast 404 "Service Offline" page. `/` returns 200 with the same page |
| Mobile data and the public internet | `103.18.3.52` | Connection times out |

The maintenance page's notice was dated 17 Oct and didn't list UMPoint, so it says nothing about when the site returns. To test from a phone without touching its screen, use `adb -s <serial> shell toybox nc -w 8 <host> 443`, where exit 0 means connected. Compare with `um.edu.my` as a control. `ping` always fails, but its first line shows the resolved address.

### Badminton courts returning HTTP 500

On the night of 1 Nov 2026 the site came back from the outage, but `POST /modules/mbook/` returned an empty 500 in about 160 ms for all four badminton spids, for every week tried and from the site's own "BOOK THIS SPACE" button. It isn't the app's request: squash and tennis courts load through the same URL and fields. The dashboard and login still worked, so a phone can look signed in and healthy while no court can be seen. Whether a booking POST fails the same way is unknown, because testing it would book. Courts now offers a stand-in list of next week's slots when the grid won't load, so a snipe can still be armed.

To tell this fault from the app: `goBook(spid)` in `/modules/mbp/list.php?catid=39&dep=156` is the site's own route to a court. `GET /modules/mbook/` always redirects to `/modules/mbp/`, and `/modules/mbp/` draws the search page or a pricing error for these courts rather than a grid, so neither one means the module moved.

Forms and weeks, checked on a squash grid that night: `calflag=n` honours `theday` and `calflag=t` means the server's current week, ignoring `theday`. On a Sunday `t` draws the coming Monday's week, while its hidden `tweek` still says the week before. Squash's form has a hidden empty `gclocation` where the badminton form captured on 22 Oct had `srchtype`. `participantemail` is inside an HTML comment, so it isn't sent.

## Material 3 Expressive

Good official pages:
- [Start building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive)
- [Motion in Compose](https://m3.material.io/blog/m3-expressive-motion-theming)
- [Choosing a colour scheme](https://m3.material.io/styles/color/choosing-a-scheme)
- [Toolbar guidelines](https://m3.material.io/components/toolbars/guidelines)
- [Compose Material 3 releases](https://developer.android.com/jetpack/androidx/releases/compose-material3). This page is huge, so scrape it to a file and grep.

What they say:
- Keep to one or two hero moments.
- Don't show a toolbar and a navigation bar together, and don't dock a toolbar above a navigation bar.
- Semantic colours may stay static inside a dynamic scheme.
- Spatial springs overshoot; effects springs (colour, opacity) don't.

Library status at `material3:1.5.0-beta02` (21 Oct 2026):
- Stable 1.4.0 has no Expressive APIs.
- `ButtonGroup`, `FloatingToolbar`, `SplitButton`, `ToggleButton`, FAB menu, wavy progress and `MotionScheme` have graduated.
- `MaterialShapes` and `LoadingIndicator` were moved back to experimental.

API details learned while compiling:
- There is no `ButtonDefaults.textShapes()`. Use `ButtonDefaults.shapes()`.
- `ToggleButton` colours come from `ToggleButtonDefaults.colors(...)`.
- `AnimatedVisibility` inside a `Box` inside a `Column` hits a scope error. Put it in its own composable.
- `androidx.graphics.shapes.Morph.toPath(progress)` gives a path in a unit square, so scale it to the size.
- To check a signature, run `javap` on `classes.jar` from `material3.aar` in `~/.gradle/caches/modules-2/files-2.1/androidx.compose.material3/material3-android/<version>/`.

## What we took from Minus and Material Capsule

The owner holds these two apps up as the bar for Material 3. Studied on the 9 Pro on 31 Oct 2026. Minus is open source under Apache-2.0 (`isaacsa51/Minus`, package `com.serranoie.app.minus`); Material Capsule (`com.pryshedko.mtisland`) is closed.

Adopted:
- Google Sans Flex, the way Capsule uses it (static 24 pt files, normal width, not rounded). The owner tried Minus's rounded, stretched version first and rejected it. Capsule's default "Font 1" is matched by eye against the app's real rendering, not confirmed from its code. Capsule also bundles Inter, Rubik, Nunito, Open Sans, DM Sans, Geist and Golos.
- Tinted background with lighter grouped cards (Capsule).
- Groups with big outer and small inner corners, primary-coloured section labels, squircle icon tiles, and a divider before trailing controls (both).
- Floating pill dock with a sliding blob (Capsule).
- Whole-card warning with a filled squircle and chevron (Capsule).
- A full-width floating main action (Minus's "New budget period").
- Page shrinks to 94% with 36 dp corners under predictive back (Minus's `BackMotion.kt`).

Not adopted yet, could be offered:
- A theme picker with System, Light, Dark and contrast levels, with a live preview (Minus).
- A "Bounce intensity" setting and "Reduce animations" toggle (Capsule).
- A keypad-style home (Minus). It suits typing amounts, not picking slots.

Minus also bundles a `TopSheet`, swipe actions and tutorial hints worth reading if those come up. It uses tweens for page transitions, so don't copy that: this app's rule is springs.

## Testing on a phone

- Demo mode shows over the lock screen, so a locked phone is fine. Nothing else about the phone needs changing.
- Grant notifications first so no dialog covers the app: `pm grant <package> android.permission.POST_NOTIFICATIONS`.
- Tap positions on a 1080×2400 screen in demo mode:

| Control | x, y |
|---|---|
| Tabs: Courts, Sniper, Bookings | 275, 540, 800 at y 2200 |
| Avatar | 1007, 217 |
| 12:00 time chip | 667, 1220 |
| Court 3, after picking a time | 668, 1517 |
| Arm button, after picking a court | 580, 2231 |

- The app's private files can be read with `run-as` only on debug builds.
- The sign-in step showed a spinner for at least 6 seconds before its error during the outage, so wait about 25 seconds before capturing it.

## Sniper behaviour worth remembering

- Before rollover, the next-week grid uses calflag `n`. While firing it uses `t`.
- A page with no grid while firing means a busy server unless `sessionAlive()` says false. The strict `grid()` is for screens and `rawGrid()` is for the booker.
- After a re-login at 00:00 the booker tries the first court again. A slot that's already yours reads as booked, so this can't double-book.
- The dry run (`--ez umpoint_dry_run true`) never sends a booking, so it can't prove the booking step. Nothing is bookable from Saturday until the rollover.
- Arming needs a sign-in, so a UMPoint outage before the rollover also blocks arming.

## Decisions, so they aren't reopened

Whole pages barely bounce (the owner found it too much), while controls, the dock and hero moments stay very bouncy.

From the owner, 31 Oct 2026:
- Compose fully replaces Expo. The old app is forgotten and isn't a fallback.
- As much bounce as possible, with Android's remove-animations setting still respected.
- Wallpaper colour, with fixed status colours.
- Three tabs, with Settings behind the avatar.
- Date, then time, then court, with no week switch.
- No readiness section, only errors when something is wrong.
- No test-run button.
- The first GitHub release comes only after the Monday 2 Nov snipe.
- No server mode, ever.
