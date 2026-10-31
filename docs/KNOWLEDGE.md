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
- `androidx.graphics.shapes.Morph.toPath(progress)` gives a path in a unit square, so scale it to the size.
- To check a signature, run `javap` on `classes.jar` from `material3.aar` in `~/.gradle/caches/modules-2/files-2.1/androidx.compose.material3/material3-android/<version>/`.

## Testing on a phone

- Demo mode shows over the lock screen, so a locked phone is fine. Nothing else about the phone needs changing.
- Grant notifications first so no dialog covers the app: `pm grant <package> android.permission.POST_NOTIFICATIONS`.
- Tap positions on a 1080×2400 screen in demo mode:

| Control | x, y |
|---|---|
| Tabs: Courts, Sniper, Bookings | 180, 540, 900 at y 2230 |
| Avatar | 1005, 217 |
| 12:00 time chip | 666, 1172 |
| Court 3, after picking a time | 667, 1490 |
| Arm button, after picking a court | 540, 1995 |
| Passed button | 900, 730 |

- The app's private files can be read with `run-as` only on debug builds.
- The sign-in step showed a spinner for at least 6 seconds before its error during the outage, so wait about 25 seconds before capturing it.

## Sniper behaviour worth remembering

- Before rollover, the next-week grid uses calflag `n`. While firing it uses `t`.
- A page with no grid while firing means a busy server unless `sessionAlive()` says false. The strict `grid()` is for screens and `rawGrid()` is for the booker.
- After a re-login at 00:00 the booker tries the first court again. A slot that's already yours reads as booked, so this can't double-book.
- The dry run (`--ez umpoint_dry_run true`) never sends a booking, so it can't prove the booking step. Nothing is bookable from Saturday until the rollover.
- Arming needs a sign-in, so a UMPoint outage before the rollover also blocks arming.

## Decisions, so they aren't reopened

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
