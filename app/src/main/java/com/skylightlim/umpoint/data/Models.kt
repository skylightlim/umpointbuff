package com.skylightlim.umpoint.data

enum class WeekType(val flag: String, val label: String) {
    THIS("t", "This week"),
    NEXT("n", "Next week"),
}

enum class SlotStatus { FREE, MINE, TAKEN, CLOSED, UNAVAILABLE }

data class SlotTime(val start: String, val end: String)

/** Every court's week, merged so the UI reads time first. */
data class WeekGrid(
    val week: WeekType,
    val dates: List<String>,
    val times: List<SlotTime>,
    /** date -> start -> court -> status */
    val status: Map<String, Map<String, Map<String, SlotStatus>>>,
    val serverToday: String,
) {
    fun status(date: String, start: String, court: String): SlotStatus =
        status[date]?.get(start)?.get(court) ?: SlotStatus.UNAVAILABLE

    fun courtStatus(date: String, start: String): Map<String, SlotStatus> =
        CourtIds.ALL.associateWith { status(date, start, it) }

    fun freeCourts(date: String, start: String, end: String): List<String> {
        val starts = com.skylightlim.umpoint.sniper.Umpoint.slotStarts(start, end)
        return CourtIds.ALL.filter { court ->
            starts.all { status(date, it, court) == SlotStatus.FREE }
        }
    }

    fun anyMine(date: String): Boolean =
        status[date]?.values?.any { byCourt -> byCourt.values.any { it == SlotStatus.MINE } } == true
}

data class Booking(
    val num: String,
    val invoice: String,
    val facility: String,
    val bookingDate: String,
    val eventDate: String,
    val cancellable: Boolean,
)

data class BookedSlot(
    val date: String,
    val start: String,
    val end: String,
    val court: String?,
    val event: String,
    val booking: Booking,
)

data class SlotRequest(
    val date: String,
    val start: String,
    val end: String,
    val court: String,
    val anyCourt: Boolean,
    val event: String,
    val pax: Int,
    val dryRun: Boolean = false,
    val measure: Boolean = false,
    val fireAt: Long? = null,
)

data class BookResult(val status: String, val message: String, val court: String?)

data class BookingPrefs(val event: String = "Badminton practice", val pax: Int = 4)

data class PhoneSetup(
    val notifications: Boolean,
    val exactAlarms: Boolean,
    val fullScreen: Boolean,
    val backgroundRestricted: Boolean,
)

enum class SessionState { UNKNOWN, SIGNED_IN, SIGNED_OUT, OFFLINE }

data class SignInRequest(val reason: String? = null)

object CourtIds {
    val ALL = listOf("1", "2", "3", "4")
}
