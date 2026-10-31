package com.skylightlim.umpoint.data

import com.skylightlim.umpoint.sniper.Grid
import com.skylightlim.umpoint.sniper.Umpoint
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

private const val DAY = 86_400_000L
private val DMY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")
private val SHORT_DAY: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH)
private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

fun dateMs(date: String): Long =
    LocalDate.parse(date, DMY).atStartOfDay(Umpoint.MYT).toInstant().toEpochMilli()

fun isWeekday(date: String): Boolean {
    val day = LocalDate.parse(date, DMY).dayOfWeek
    return day != java.time.DayOfWeek.SATURDAY && day != java.time.DayOfWeek.SUNDAY
}

fun dayLabel(date: String): String = LocalDate.parse(date, DMY).format(SHORT_DAY)

fun shortDay(ms: Long): String = Instant.ofEpochMilli(ms).atZone(Umpoint.MYT).format(SHORT_DAY)

fun nextRollover(now: Long = System.currentTimeMillis()): Long =
    Umpoint.weekStart(now) + Umpoint.WEEK_MS

fun weekOf(date: String): Long = Umpoint.weekStart(dateMs(date))

fun weekRange(monday: Long): String {
    val a = Instant.ofEpochMilli(monday).atZone(Umpoint.MYT).toLocalDate()
    val b = Instant.ofEpochMilli(monday + 4 * DAY).atZone(Umpoint.MYT).toLocalDate()
    return if (a.month == b.month) {
        "${a.dayOfMonth}–${b.dayOfMonth} ${MONTHS[b.monthValue - 1]}"
    } else {
        "${a.dayOfMonth} ${MONTHS[a.monthValue - 1]} – ${b.dayOfMonth} ${MONTHS[b.monthValue - 1]}"
    }
}

/** "1d 04:12:33" or "04:12:33". */
fun countdown(ms: Long): String {
    val s = (ms.coerceAtLeast(0) / 1000)
    val hms = listOf((s % 86400) / 3600, (s % 3600) / 60, s % 60)
        .joinToString(":") { "%02d".format(it) }
    val days = s / 86400
    return if (days > 0) "${days}d $hms" else hms
}

fun ago(at: Long?, now: Long): String {
    if (at == null || at == 0L) return ""
    val min = Math.round((now - at) / 60_000.0)
    return when {
        min < 1 -> "Updated just now"
        min < 60 -> "Updated $min min ago"
        else -> "Updated " + Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))
    }
}

fun parse12h(t: String): String {
    val m = Regex("(\\d{1,2}):(\\d{2})\\s*([AP]M)", RegexOption.IGNORE_CASE).find(t) ?: return t
    var hour = m.groupValues[1].toInt() % 12
    if (m.groupValues[3].equals("PM", ignoreCase = true)) hour += 12
    return "%02d:%s".format(hour, m.groupValues[2])
}

fun parseBooking(b: Booking): BookedSlot? {
    val whenRe = Regex(
        "(\\d{2})/(\\d{2})/(\\d{4})\\s+(\\d{1,2}:\\d{2}\\s*[AP]M)\\s*-\\s*(\\d{1,2}:\\d{2}\\s*[AP]M)",
        RegexOption.IGNORE_CASE,
    )
    val m = whenRe.find(b.eventDate) ?: return null
    val what = Regex("Gelanggang Badminton (\\d)(?:\\s+J2)?\\s*(.*)", RegexOption.IGNORE_CASE).find(b.facility)
    return BookedSlot(
        date = "${m.groupValues[1]}-${m.groupValues[2]}-${m.groupValues[3]}",
        start = parse12h(m.groupValues[4]),
        end = parse12h(m.groupValues[5]),
        court = what?.groupValues?.get(1),
        event = what?.groupValues?.get(2)?.trim().orEmpty().ifEmpty { b.facility },
        booking = b,
    )
}

private fun cleanText(html: String): String =
    html.replace(Regex("<[^>]+>"), " ").replace("&nbsp;", " ").replace(Regex("\\s+"), " ").trim()

/** The "Confirmed Booking" table on the dashboard. */
fun parseDashboard(html: String): List<Booking> {
    val table = Regex("<table[^>]*>([\\s\\S]*?)</table>").find(html)?.groupValues?.get(1).orEmpty()
    val trRe = Regex("<tr[^>]*>([\\s\\S]*?)</tr>")
    val tdRe = Regex("<td[^>]*>([\\s\\S]*?)</td>")
    return trRe.findAll(table).mapNotNull { tr ->
        val row = tr.groupValues[1]
        val cells = tdRe.findAll(row).map { cleanText(it.groupValues[1]) }.toList()
        if (cells.size < 5 || cells.joinToString(" ").lowercase().contains("no record")) null
        else Booking(
            num = cells[0],
            invoice = cells[1],
            facility = cells[2],
            bookingDate = cells[3],
            eventDate = cells[4],
            cancellable = Regex("btncancel").containsMatchIn(row),
        )
    }.toList()
}

/** Merges the four court grids into one week, time first. */
fun mergeWeek(week: WeekType, grids: List<Pair<String, Grid>>): WeekGrid {
    val first = grids.first().second
    val times = first.rows
        .filter { Umpoint.minutes(it.start) < Umpoint.minutes(Umpoint.CLOSE) }
        .map { SlotTime(it.start, it.end) }
    val status = LinkedHashMap<String, Map<String, Map<String, SlotStatus>>>()
    first.dates.forEachIndexed { col, date ->
        val byTime = LinkedHashMap<String, Map<String, SlotStatus>>()
        for (time in times) {
            val byCourt = LinkedHashMap<String, SlotStatus>()
            for ((court, grid) in grids) {
                val ownCol = grid.dates.indexOf(date).takeIf { it >= 0 } ?: col
                val state = grid.rows.firstOrNull { it.start == time.start }?.cells?.getOrNull(ownCol)?.state
                byCourt[court] = when (state) {
                    Grid.State.FREE -> SlotStatus.FREE
                    Grid.State.MINE -> SlotStatus.MINE
                    Grid.State.TAKEN -> SlotStatus.TAKEN
                    Grid.State.CLOSED -> SlotStatus.CLOSED
                    else -> SlotStatus.UNAVAILABLE
                }
            }
            byTime[time.start] = byCourt
        }
        status[date] = byTime
    }
    return WeekGrid(
        week = week,
        dates = first.dates,
        times = times,
        status = status,
        serverToday = first.initdate ?: Umpoint.mytDate(System.currentTimeMillis()),
    )
}

// ---------------------------------------------------------------- cache JSON

fun WeekGrid.toJson(): JSONObject {
    val statusJson = JSONObject()
    status.forEach { (date, byTime) ->
        val timesJson = JSONObject()
        byTime.forEach { (start, byCourt) ->
            val courtsJson = JSONObject()
            byCourt.forEach { (court, value) -> courtsJson.put(court, value.name.lowercase()) }
            timesJson.put(start, courtsJson)
        }
        statusJson.put(date, timesJson)
    }
    return JSONObject()
        .put("week", week.name.lowercase())
        .put("dates", JSONArray(dates))
        .put("times", JSONArray(times.map { JSONObject().put("start", it.start).put("end", it.end) }))
        .put("status", statusJson)
        .put("serverToday", serverToday)
}

fun weekGridFromJson(o: JSONObject): WeekGrid {
    val dates = o.getJSONArray("dates").let { a -> (0 until a.length()).map(a::getString) }
    val timesArr = o.getJSONArray("times")
    val times = (0 until timesArr.length()).map {
        val t = timesArr.getJSONObject(it)
        SlotTime(t.getString("start"), t.getString("end"))
    }
    val statusJson = o.getJSONObject("status")
    val status = LinkedHashMap<String, Map<String, Map<String, SlotStatus>>>()
    for (date in statusJson.keys()) {
        val byTimeJson = statusJson.getJSONObject(date)
        val byTime = LinkedHashMap<String, Map<String, SlotStatus>>()
        for (start in byTimeJson.keys()) {
            val byCourtJson = byTimeJson.getJSONObject(start)
            val byCourt = LinkedHashMap<String, SlotStatus>()
            for (court in byCourtJson.keys()) {
                byCourt[court] = runCatching {
                    SlotStatus.valueOf(byCourtJson.getString(court).uppercase())
                }.getOrDefault(SlotStatus.UNAVAILABLE)
            }
            byTime[start] = byCourt
        }
        status[date] = byTime
    }
    return WeekGrid(
        week = if (o.optString("week") == "next") WeekType.NEXT else WeekType.THIS,
        dates = dates,
        times = times,
        status = status,
        serverToday = o.optString("serverToday"),
    )
}

fun Booking.toJson(): JSONObject = JSONObject()
    .put("num", num)
    .put("invoice", invoice)
    .put("facility", facility)
    .put("bookingDate", bookingDate)
    .put("eventDate", eventDate)
    .put("cancellable", cancellable)

fun bookingFromJson(o: JSONObject): Booking = Booking(
    num = o.optString("num"),
    invoice = o.optString("invoice"),
    facility = o.optString("facility"),
    bookingDate = o.optString("bookingDate"),
    eventDate = o.optString("eventDate"),
    cancellable = o.optBoolean("cancellable"),
)
