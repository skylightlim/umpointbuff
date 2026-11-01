package com.skylightlim.umpoint.together

import com.skylightlim.umpoint.sniper.Task

/** What a phone must do so its armed snipes agree with what the server says it holds. */
sealed interface Step {
    data class Arm(val lobby: Lobby, val slot: Slot) : Step
    data class Disarm(val taskId: String, val why: String) : Step
    data class GiveUp(val lobbyId: String) : Step
    data class Report(val lobbyId: String, val idx: Int, val result: String, val message: String) : Step
}

/** A session's snipe keeps a fixed id, so applying the same state twice changes nothing. */
fun taskId(lobbyId: String, idx: Int) = "${taskIdPrefix(lobbyId)}$idx"

fun taskIdPrefix(lobbyId: String) = "L$lobbyId."

private fun parseTaskId(id: String): Pair<String, Int>? {
    if (!id.startsWith("L")) return null
    val dot = id.lastIndexOf('.')
    if (dot < 2) return null
    return id.substring(1, dot) to (id.substring(dot + 1).toIntOrNull() ?: return null)
}

/** How long before 00:00 the server stops taking claims. Mirrors CLOSE_BEFORE_MS in server/src/rules.ts. */
const val CLOSE_BEFORE_MS = 15 * 60_000L

/** What the app bar's badge counts: answers only this user can give. */
fun TogetherState.waitingCount(now: Long): Int =
    friends.count { it.status == FriendStatus.INCOMING } +
        lobbies.count { it.responseOf(me.email) == "pending" && !it.closedAt(now) }

/** Pure, so every path between the server and the sniper can be tested without a phone. */
fun planSync(state: TogetherState, tasks: List<Task>, now: Long): List<Step> {
    val me = state.me.email
    val byId = tasks.associateBy { it.id }
    val steps = mutableListOf<Step>()
    val held = mutableSetOf<String>()

    for (lobby in state.lobbies) {
        val slot = lobby.slotOf(me) ?: continue
        val id = taskId(lobby.id, slot.idx)
        if (!lobby.cancelled) held += id
        val task = byId[id]
        when {
            lobby.cancelled || slot.result != null -> Unit
            task == null -> if (now < lobby.fireAt - ARM_MARGIN_MS) steps += Step.Arm(lobby, slot)
            // Cancelled from the Sniper tab. Before the tender closes it goes back to the others.
            task.status == "cancelled" ->
                steps += if (now < lobby.closesAt) Step.GiveUp(lobby.id)
                else Step.Report(lobby.id, slot.idx, "missed", "Cancelled on their phone.")
            task.status in REPORTABLE -> steps += Step.Report(lobby.id, slot.idx, task.status, task.message.orEmpty())
        }
    }

    for (task in tasks) {
        // Only a task still waiting: one already running at midnight is left to finish.
        if (task.status != "armed" || task.id in held || parseTaskId(task.id) == null) continue
        val lobby = state.lobbies.firstOrNull { it.id == parseTaskId(task.id)?.first }
        steps += Step.Disarm(
            task.id,
            if (lobby?.cancelled == true) "The host called this session off." else "You no longer hold this half hour.",
        )
    }
    return steps
}

private const val ARM_MARGIN_MS = 15_000L
private val REPORTABLE = setOf("booked", "failed", "missed")

/**
 * Pusat Sukan's terms, checked before taking a half hour: one session a day and two bookings a
 * week. The server can't see solo snipes, so the phone is the one that knows. Null means fine.
 */
fun ruleConflict(date: String, lobbyId: String?, tasks: List<Task>, weekOf: (String) -> Long): String? {
    val live = tasks.filter { it.status in LIVE && !it.dryRun && parseTaskId(it.id)?.first != lobbyId }
    if (live.any { it.date == date }) {
        return "You already have a snipe armed that day. Pusat Sukan allows one session a day."
    }
    val week = weekOf(date)
    if (live.filter { weekOf(it.date) == week }.map { it.date }.distinct().size >= 2) {
        return "You already have two snipes armed that week. Pusat Sukan allows two bookings a week."
    }
    return null
}

private val LIVE = setOf("armed", "running", "ringing")
