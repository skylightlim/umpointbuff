package com.skylightlim.umpoint.screens

import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.data.PhoneSetup
import com.skylightlim.umpoint.data.SessionState

/** Something wrong with the phone or the account. [blocksArming] means a snipe couldn't fire. */
data class Problem(
    val text: String,
    val blocksArming: Boolean,
    val action: String,
    val fix: () -> Unit,
)

fun problems(vm: AppViewModel, session: SessionState, setup: PhoneSetup, ringing: Boolean): List<Problem> = buildList {
    if (ringing) {
        add(Problem("Your UMPoint session expired. Sign in before 00:00 or the snipe can’t fire.", true, "Sign in") { vm.requestSignIn() })
    } else if (session == SessionState.SIGNED_OUT) {
        add(Problem("You’re not signed in to UMPoint.", true, "Sign in") { vm.requestSignIn() })
    }
    if (session == SessionState.OFFLINE) {
        add(Problem("Can’t reach UMPoint right now. A snipe needs it from 23:50.", false, "Retry") { vm.retrySession() })
    }
    if (!setup.exactAlarms) {
        add(Problem("Alarms are off, so the phone can’t wake for the snipe.", true, "Fix") { vm.openSettings("exactAlarms") })
    }
    if (setup.backgroundRestricted) {
        add(Problem("Battery is restricted, so Android may kill the midnight alarm.", true, "Fix") { vm.openSettings("app") })
    }
    if (!setup.fullScreen) {
        add(Problem("Full-screen alarms are off, so it can’t ring if sign-in is needed.", false, "Fix") { vm.openSettings("fullScreen") })
    }
    if (!setup.notifications) {
        add(Problem("Notifications are off, so you won’t hear booking results.", false, "Fix") { vm.openSettings("notifications") })
    }
}
