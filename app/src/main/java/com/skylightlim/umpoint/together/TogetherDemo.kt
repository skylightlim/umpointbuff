package com.skylightlim.umpoint.together

import com.skylightlim.umpoint.data.nextRollover
import com.skylightlim.umpoint.sniper.Umpoint

/** Made-up people for checking the screen in a debug build. */
object TogetherDemo {
    private const val DAY = 86_400_000L
    private const val ME = "you"
    private const val AISYAH = "aisyah"
    private const val WEI = "weijie"
    private const val PRIYA = "priya"
    private const val DAN = "daniel"

    private fun slot(idx: Int, start: String, end: String, by: String?, name: String?) = Slot(idx, start, end, by, name, null, null)

    fun state(now: Long): TogetherState {
        val fireAt = nextRollover(now)
        return TogetherState(
            me = Person(ME, "You", "7KQ2-M9XD-4TRW-H1PV"),
            friends = listOf(
                Friend(AISYAH, "Aisyah", FriendStatus.ACCEPTED),
                Friend(WEI, "Wei Jie", FriendStatus.ACCEPTED),
                Friend(PRIYA, "Priya", FriendStatus.ACCEPTED),
                Friend(DAN, "Daniel", FriendStatus.INCOMING),
                Friend("hafiz", "hafiz", FriendStatus.OUTGOING),
            ),
            lobbies = listOf(
                Lobby(
                    id = "invite", host = WEI, hostName = "Wei Jie", date = Umpoint.mytDate(fireAt + 3 * DAY), court = "1",
                    event = "Badminton practice", pax = 4, fireAt = fireAt, closesAt = fireAt - 900_000, status = "open",
                    slots = listOf(
                        slot(0, "12:00", "12:30", WEI, "Wei Jie"),
                        slot(1, "12:30", "13:00", null, null),
                        slot(2, "13:00", "13:30", null, null),
                    ),
                    invites = listOf(Invite(WEI, "Wei Jie", "host"), Invite(ME, "You", "pending")),
                ),
                Lobby(
                    id = "mine", host = ME, hostName = "You", date = Umpoint.mytDate(fireAt + DAY), court = "2",
                    event = "Badminton practice", pax = 4, fireAt = fireAt, closesAt = fireAt - 900_000, status = "open",
                    slots = listOf(
                        slot(0, "17:00", "17:30", ME, "You"),
                        slot(1, "17:30", "18:00", AISYAH, "Aisyah"),
                        slot(2, "18:00", "18:30", null, null),
                        slot(3, "18:30", "19:00", null, null),
                    ),
                    invites = listOf(
                        Invite(ME, "You", "host"),
                        Invite(AISYAH, "Aisyah", "accepted"),
                        Invite(PRIYA, "Priya", "pending"),
                        Invite(WEI, "Wei Jie", "declined"),
                    ),
                ),
            ),
        )
    }
}
