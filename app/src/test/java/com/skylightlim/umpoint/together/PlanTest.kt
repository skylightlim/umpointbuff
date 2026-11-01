package com.skylightlim.umpoint.together

import com.skylightlim.umpoint.sniper.Task
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanTest {
    private val me = "me@siswa.um.edu.my"
    private val other = "other@siswa.um.edu.my"
    private val fireAt = 1_000_000_000L
    private val closesAt = fireAt - 900_000
    private val before = closesAt - 60_000

    private fun slot(idx: Int, by: String?, result: String? = null) =
        Slot(idx, "17:0$idx", "17:3$idx", by, by, result, null)

    private fun lobby(vararg slots: Slot, status: String = "open", id: String = "abc") = Lobby(
        id = id, host = other, hostName = "Other", date = "03-11-2026", court = "2", event = "Practice", pax = 4,
        fireAt = fireAt, closesAt = closesAt, status = status, slots = slots.toList(), invites = emptyList(),
    )

    private fun state(vararg lobbies: Lobby) = TogetherState(Person(me, "Me"), emptyList(), lobbies.toList())

    private fun task(id: String, status: String = "armed", date: String = "03-11-2026", message: String? = null) = Task(
        id = id, date = date, start = "17:30", end = "18:00", court = "2", anyCourt = false, event = "Practice", pax = 4,
        dryRun = false, measure = false, fireAt = fireAt, createdAt = 0, status = status, message = message,
    )

    @Test
    fun armsTheHalfHourIHold() {
        val l = lobby(slot(0, other), slot(1, me))
        assertEquals(listOf(Step.Arm(l, l.slots[1])), planSync(state(l), emptyList(), before))
    }

    @Test
    fun applyingTheSameStateTwiceDoesNothing() {
        val l = lobby(slot(0, other), slot(1, me))
        assertEquals(emptyList<Step>(), planSync(state(l), listOf(task(taskId("abc", 1))), before))
    }

    @Test
    fun doesNotArmSomeoneElsesHalfHour() {
        assertEquals(emptyList<Step>(), planSync(state(lobby(slot(0, other), slot(1, null))), emptyList(), before))
    }

    @Test
    fun doesNotArmOnceTheMomentHasPassed() {
        val l = lobby(slot(0, other), slot(1, me))
        assertEquals(emptyList<Step>(), planSync(state(l), emptyList(), fireAt))
    }

    @Test
    fun disarmsWhenTheHostCallsItOff() {
        val l = lobby(slot(0, other), slot(1, me), status = "cancelled")
        val steps = planSync(state(l), listOf(task(taskId("abc", 1))), before)
        assertEquals(listOf(Step.Disarm(taskId("abc", 1), "The host called this session off.")), steps)
    }

    @Test
    fun aCancelledSessionDoesNotArm() {
        val l = lobby(slot(0, other), slot(1, me), status = "cancelled")
        assertEquals(emptyList<Step>(), planSync(state(l), emptyList(), before))
    }

    @Test
    fun disarmsWhenTheHalfHourIsNoLongerMine() {
        val l = lobby(slot(0, other), slot(1, other))
        val steps = planSync(state(l), listOf(task(taskId("abc", 1))), before)
        assertEquals(listOf(Step.Disarm(taskId("abc", 1), "You no longer hold this half hour.")), steps)
    }

    @Test
    fun neverTouchesASoloSnipe() {
        // Includes an id that merely starts with L: only the session format counts as ours.
        val solos = listOf(task("3fa9c1d2"), task("L3fa9c1d"))
        assertEquals(emptyList<Step>(), planSync(state(), solos, before))
    }

    @Test
    fun neverStopsASnipeThatIsAlreadyRunning() {
        val l = lobby(slot(0, other), slot(1, me), status = "cancelled")
        for (status in listOf("running", "ringing")) {
            assertEquals(emptyList<Step>(), planSync(state(l), listOf(task(taskId("abc", 1), status)), fireAt))
        }
    }

    @Test
    fun cancellingFromTheSniperTabGivesTheHalfHourBack() {
        val l = lobby(slot(0, other), slot(1, me))
        assertEquals(listOf(Step.GiveUp("abc")), planSync(state(l), listOf(task(taskId("abc", 1), "cancelled")), before))
    }

    @Test
    fun cancellingAfterTheTenderClosedIsReportedSoTheOthersKnow() {
        val l = lobby(slot(0, other), slot(1, me))
        val steps = planSync(state(l), listOf(task(taskId("abc", 1), "cancelled")), closesAt)
        assertEquals(listOf(Step.Report("abc", 1, "missed", "Cancelled on their phone.")), steps)
    }

    @Test
    fun reportsWhatUmpointDidOnce() {
        val l = lobby(slot(0, other), slot(1, me))
        val done = task(taskId("abc", 1), "failed", message = "Court 2 was already taken")
        assertEquals(listOf(Step.Report("abc", 1, "failed", "Court 2 was already taken")), planSync(state(l), listOf(done), fireAt + 1))

        val reported = lobby(slot(0, other), slot(1, me, result = "failed"))
        assertEquals(emptyList<Step>(), planSync(state(reported), listOf(done), fireAt + 1))
    }

    @Test
    fun aReportedHalfHourIsNotArmedAgainAfterItsTaskIsCleared() {
        val l = lobby(slot(0, other), slot(1, me, result = "booked"))
        assertEquals(emptyList<Step>(), planSync(state(l), emptyList(), before))
    }

    @Test
    fun taskIdsSurviveLobbyIdsWithDashes() {
        val l = lobby(slot(0, me), id = "ab-cd")
        assertEquals(emptyList<Step>(), planSync(state(l), listOf(task(taskId("ab-cd", 0))), before))
    }

    @Test
    fun theBadgeCountsOpenInvitesAndFriendRequestsOnly() {
        val pending = lobby(slot(0, other), slot(1, null)).copy(invites = listOf(Invite(me, "Me", "pending")))
        val closed = pending.copy(id = "closed", status = "cancelled")
        val answered = pending.copy(id = "answered", invites = listOf(Invite(me, "Me", "declined")))
        val friends = listOf(Friend("a", "A", FriendStatus.INCOMING), Friend("b", "B", FriendStatus.OUTGOING), Friend("c", "C", FriendStatus.ACCEPTED))
        val s = TogetherState(Person(me, "Me"), friends, listOf(pending, closed, answered))
        assertEquals(2, s.waitingCount(before))
        assertEquals(1, s.waitingCount(closesAt))
    }

    // ---- Pusat Sukan's terms ----

    private val week: (String) -> Long = { if (it.take(2).toInt() <= 8) 1L else 2L }

    @Test
    fun refusesASecondSessionTheSameDay() {
        assertTrue(ruleConflict("03-11-2026", "abc", listOf(task("solo")), week)!!.contains("one session a day"))
    }

    @Test
    fun refusesAThirdBookingThatWeek() {
        val two = listOf(task("a", date = "04-11-2026"), task("b", date = "05-11-2026"))
        assertTrue(ruleConflict("03-11-2026", "abc", two, week)!!.contains("two bookings a week"))
    }

    @Test
    fun allowsASecondDayAndIgnoresFinishedAndOtherWeeks() {
        assertNull(ruleConflict("03-11-2026", "abc", listOf(task("a", date = "04-11-2026")), week))
        assertNull(ruleConflict("03-11-2026", "abc", listOf(task("a", "cancelled")), week))
        assertNull(ruleConflict("03-11-2026", "abc", listOf(task("a", date = "10-11-2026"), task("b", date = "11-11-2026")), week))
    }

    @Test
    fun thisSessionsOwnSnipeIsNotAConflict() {
        assertNull(ruleConflict("03-11-2026", "abc", listOf(task(taskId("abc", 1))), week))
    }

    @Test
    fun aDifferentSessionsSnipeTheSameDayIsAConflict() {
        assertTrue(ruleConflict("03-11-2026", "abc", listOf(task(taskId("xyz", 1))), week)!!.contains("one session a day"))
    }
}
