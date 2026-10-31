# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

A University of Malaya student (the owner) and his friends, each signed in with their own SiswaMail. They play badminton at the Pusat Sukan hall and book its four courts through UMPoint, the university's facility site. They are on their phones between classes and, once a week, late on Sunday night.

## Product Purpose

Book UM badminton courts without fighting UMPoint's website, and win the weekly rush: UMPoint opens next week's courts at Monday 00:00 MYT, and good slots go fast. The app arms a snipe on Sunday night, and the phone itself fires the booking at 00:00:00 while the user sleeps.

The design is built around that Sunday-night job (owner's choice, 22 Oct 2026). Booking a court in the open week is the second job.

Success: the user arms a snipe in under a minute, goes to sleep trusting it, and wakes to a clear "booked" or "not booked, here's why".

## Positioning

The sniper runs on the user's own phone (a Kotlin alarm and foreground service), not on a server. No one else's account, no shared bot, no server mode ever.

Play together has a small server, but it only coordinates: who is friends with whom, and who took which half hour. Every booking still goes from the holder's own phone under their own account.

## Operating Context

- Sunday night: pick a slot in next week, arm, leave the phone on the charger. At 23:50 the phone wakes, renews the UMPoint session, and checks UMPoint's clock; at 00:00:00 it books. If the session can't be renewed it rings loudly so the user can sign in.
- Any day: pick a date, then a time, then a court, and book at least a day ahead.
- Sign-in is Google OAuth (SiswaMail) inside a WebView; UMPoint sessions die after 10–20 idle minutes and the app renews them quietly.
- Cancelling happens on UMPoint's own dashboard page, opened inside the app.

## Capabilities and Constraints

- Courts 1–4, weekdays 09:00–19:00 in half-hour blocks; weekends closed. No same-day bookings (one day ahead), so a week's Monday can never be sniped: the sniper targets Tue–Fri.
- Pusat Sukan's terms: one court and one session a day; two bookings a week on different days. No longest session is stated; the app offers up to 2 hours.
- Any-court fallback tries other courts one at a time, never in parallel (never more than one booking).
- Every booking carries an event name and a player count (user defaults).
- Phone readiness matters: notifications, exact alarms, full-screen alarm, battery not restricted.
- Phone problems only appear when something is wrong; there is no readiness checklist. Developers rehearse the midnight routine over adb, and there is no test-run button.
- Play together: a host opens a session of 2 to 6 half hours on one court and invites friends. The host holds the first half hour, and friends take the next free one in the order they accept. Each half hour costs its holder one of their two weekly bookings. Tenders close at 23:45, before the phones' 23:50 alarm. Next-week snipes only for now.
- Native Android in Kotlin and Jetpack Compose. No navigation library: screens switch by state. An iOS version would be a separate app with a different sniper.

## Brand Commitments

- Name: UMPoint Badminton (package com.skylightlim.umpoint).
- Material 3 Expressive, with wallpaper colour and as much spring as possible (owner's choice, 31 Oct 2026). Apple's fluid-interface ideas guide how it feels, never which components it uses. Android's own guarantees hold: system Back, edge-to-edge insets, 48 dp touch targets.
- Copy states where each booking rule comes from (Pusat Sukan's terms, UMPoint's page, or observed behaviour) so no guess reads as a rule.

## Evidence on Hand

- Official rules: umpoint.um.edu.my/include/terms/156.html.
- Real data comes live from UMPoint; there are no testimonials, metrics, or press. Never show other people's booking data (UMPoint exposes bookers' emails and matric numbers in taken cells).

## Product Principles

1. Trust at midnight: the sniper's state, readiness, and outcome are never ambiguous.
2. Truthful rules: every limit shown is sourced; unknowns are labelled unknown.
3. Never surprise-book: one booking per action, no parallel attempts, nothing cancelled behind the user's back.
4. Instant from cache: screens open on the last reading and refresh in place.
