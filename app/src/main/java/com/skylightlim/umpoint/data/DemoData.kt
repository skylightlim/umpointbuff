package com.skylightlim.umpoint.data

import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.sniper.Umpoint

/** Made-up courts for checking the screens in a debug build, never real UMPoint data. */
object DemoData {
    private const val DAY = 86_400_000L

    private fun monday(week: WeekType, now: Long) =
        Umpoint.weekStart(now) + if (week == WeekType.NEXT) Umpoint.WEEK_MS else 0

    fun grid(week: WeekType, now: Long): WeekGrid {
        val monday = monday(week, now)
        val dates = (0..4).map { Umpoint.mytDate(monday + it * DAY) }
        val starts = (18 until 38).map { "%02d:%02d".format(it / 2, it % 2 * 30) }
        val times = starts.map { start ->
            val m = Umpoint.minutes(start) + 30
            SlotTime(start, "%02d:%02d".format(m / 60, m % 60))
        }
        val status = dates.withIndex().associate { (d, date) ->
            date to starts.withIndex().associate { (t, start) ->
                start to CourtIds.ALL.withIndex().associate { (c, court) ->
                    court to when {
                        week == WeekType.THIS && d == 3 && t == 6 && c == 1 -> SlotStatus.MINE
                        (d * 3 + t * 5 + c * 7) % 11 < 3 -> SlotStatus.TAKEN
                        t in 18..19 && d % 2 == 1 -> SlotStatus.TAKEN
                        else -> SlotStatus.FREE
                    }
                }
            }
        }
        return WeekGrid(week, dates, times, status, Umpoint.mytDate(now))
    }

    fun bookings(now: Long): List<Booking> {
        val date = Umpoint.mytDate(Umpoint.weekStart(now) + 3 * DAY).replace('-', '/')
        return listOf(
            Booking(
                num = "1",
                invoice = "DEMO-1",
                facility = "Gelanggang Badminton 2 Badminton practice",
                bookingDate = date,
                eventDate = "$date 12:00 PM - 01:00 PM",
                cancellable = true,
            ),
        )
    }

    private fun task(id: String, date: String, start: String, end: String, court: String, status: String, message: String?, now: Long) =
        Task(
            id = id,
            date = date,
            start = start,
            end = end,
            court = court,
            anyCourt = true,
            event = "Badminton practice",
            pax = 4,
            dryRun = false,
            measure = false,
            fireAt = nextRollover(now),
            createdAt = now,
            status = status,
            message = message,
            bookedCourt = if (status == "booked") court else null,
        )

    fun tasks(scene: String, now: Long): List<Task> {
        val tuesday = Umpoint.mytDate(nextRollover(now) + DAY)
        return when (scene) {
            "armed" -> listOf(task("demo1", tuesday, "12:00", "13:00", "2", "armed", null, now))
            "booked" -> listOf(task("demo2", tuesday, "12:00", "13:00", "2", "booked", "Booked Court 2", now))
            "failed" -> listOf(task("demo3", tuesday, "12:00", "13:00", "2", "failed", "Court 2 was already taken", now))
            else -> emptyList()
        }
    }
}
