package expo.modules.umpointsniper

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

/** UMPoint site facts and pure helpers (no Android types, so JVM tests can use them). */
object Umpoint {
  const val BASE = "https://umpoint.um.edu.my"
  const val WEEK_MS = 7 * 86_400_000L
  val MYT: ZoneId = ZoneId.of("Asia/Kuala_Lumpur")
  private val DMY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy")

  /** Court number -> UMPoint facility id (Gelanggang Badminton 1-4 J2). */
  val SPID = mapOf("1" to "21201", "2" to "21199", "3" to "21203", "4" to "21205")

  /** Monday 00:00 MYT of the week holding [date] (DD-MM-YYYY): the moment UMPoint opens it. */
  fun rolloverFor(date: String): Long =
    LocalDate.parse(date, DMY)
      .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
      .atStartOfDay(MYT).toInstant().toEpochMilli()

  /** Monday 00:00 MYT of the week holding [epochMs]. */
  fun weekStart(epochMs: Long): Long = rolloverFor(mytDate(epochMs))

  fun mytDate(epochMs: Long): String = Instant.ofEpochMilli(epochMs).atZone(MYT).toLocalDate().format(DMY)

  fun minutes(t: String): Int = t.split(":").let { it[0].toInt() * 60 + it[1].toInt() }

  fun hhmm(min: Int): String = "%02d:%02d".format(min / 60, min % 60)

  private fun twelveHour(min: Int): String {
    val h = min / 60
    val h12 = if (h % 12 == 0) 12 else h % 12
    return "%02d:%02d %s".format(h12, min % 60, if (h < 12) "AM" else "PM")
  }

  /** Start times of the 30-minute slots covering [start, end). */
  fun slotStarts(start: String, end: String): List<String> =
    (minutes(start) until minutes(end) step 30).map(::hhmm)

  /** Courts close at 19:00; UMPoint still draws a 19:00 row, whose cell "ends" at 19:00. */
  const val CLOSE = "19:00"

  /** The id UMPoint gives the free cell starting at [start] on [date], e.g. `26-10-2026/09:00/09:30/09:00 AM/09:30 am`. */
  fun cellId(date: String, start: String): String {
    val s = minutes(start)
    val e = minOf(s + 30, minutes(CLOSE))
    return "$date/${hhmm(s)}/${hhmm(e)}/${twelveHour(s)}/${twelveHour(e).lowercase()}"
  }

  /**
   * The booking form exactly as UMPoint's own page submits it (captured from the browser on
   * 22 Oct 2026). A null value is one of the five empty file inputs. [weekTs] is the target
   * week's Monday 00:00 MYT in seconds; [today] is MYT today as the server sees it.
   */
  fun bookingFields(task: Task, court: String, weekTs: Long, today: String): List<Pair<String, String?>> {
    val slots = slotStarts(task.start, task.end)
    val week = WEEK_MS / 1000
    val fields = mutableListOf<Pair<String, String?>>(
      "sdbook" to task.date, "stbook" to task.start, "edbook" to task.date, "etbook" to task.end,
      "event" to task.event, "pax" to task.pax.toString(), "ritem[]" to "0", "has-required" to "",
    )
    for (i in 1..5) {
      fields += "doc-$i" to null
      fields += "doc-type-$i" to if (i == 1) "approval" else ""
    }
    fields += listOf(
      "term" to "on", "has_upfile" to "1", "act" to "bookweek", "doproc" to "1", "ptj" to "",
      "dep" to "0", "spid" to SPID.getValue(court), "curmonth" to "", "curyear" to "", "srchtype" to "",
      "theday" to "", "calflag" to "", "lweek" to (weekTs - week).toString(), "tweek" to weekTs.toString(),
      "nweek" to (weekTs + week).toString(), "inputo" to "sdbook", "initdate" to today, "recnum" to "0",
      "stdateselected" to cellId(task.date, slots.first()), "eddateselected" to cellId(task.date, slots.last()),
    )
    return fields
  }

  fun multipart(fields: List<Pair<String, String?>>, boundary: String): ByteArray {
    val sb = StringBuilder()
    for ((name, value) in fields) {
      sb.append("--").append(boundary).append("\r\n")
      if (value == null) {
        sb.append("Content-Disposition: form-data; name=\"").append(name).append("\"; filename=\"\"\r\n")
        sb.append("Content-Type: application/octet-stream\r\n\r\n\r\n")
      } else {
        sb.append("Content-Disposition: form-data; name=\"").append(name).append("\"\r\n\r\n")
        sb.append(value).append("\r\n")
      }
    }
    sb.append("--").append(boundary).append("--\r\n")
    return sb.toString().toByteArray(Charsets.UTF_8)
  }

  /** Drops other students' emails and matric numbers before a page is saved for study. */
  fun sanitize(html: String, person: String?): String =
    html.replace(Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")) { if (it.value == person) "ME" else "someone" }
      .replace(Regex("\\((\\d{5,})\\)"), "(n)")
}

/** One week grid of one court, as UMPoint renders it. */
class Grid(
  val dates: List<String>,
  val rows: List<Row>,
  /** The server's "today" (DD-MM-YYYY), from the form's initdate. */
  val initdate: String?,
  /** The signed-in user's email (the page's `var person`). */
  val person: String?,
) {
  enum class State { FREE, MINE, TAKEN, CLOSED, NONE }

  class Cell(val state: State, val id: String)

  class Row(val start: String, val end: String, val cells: List<Cell>)

  fun cell(date: String, start: String): Cell? {
    val col = dates.indexOf(date)
    if (col < 0) return null
    return rows.firstOrNull { it.start == start }?.cells?.getOrNull(col)
  }

  /** States of the cells covering [start, end) on [date]; null if the date or a row isn't on this grid. */
  fun states(date: String, start: String, end: String): List<State>? =
    Umpoint.slotStarts(start, end).map { cell(date, it)?.state ?: return null }

  fun freeIds(): List<String> = rows.flatMap { r -> r.cells.filter { it.state == State.FREE }.map { it.id } }

  companion object {
    private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    private val HEADER = Regex("<td[^>]*>(?:[A-Za-z]+\\s*<br\\s*/?>\\s*)?(\\d{1,2})\\s+([A-Za-z]{3}),\\s+(\\d{4})</td>")
    private val TR = Regex("<tr[^>]*>([\\s\\S]*?)</tr>")
    private val TIME = Regex("<td class=\"header\">(\\d{1,2}:\\d{2}\\s*(?:am|pm))\\s*-\\s*(\\d{1,2}:\\d{2}\\s*(?:am|pm))</td>", RegexOption.IGNORE_CASE)
    private val TD = Regex("<td([^>]*)>([\\s\\S]*?)</td>")
    private val INITDATE = Regex("name=\"initdate\"[^>]*value=\"([^\"]*)\"")
    private val PERSON = Regex("var person = '([^']*)'")

    fun to24(t: String): String {
      val s = t.trim().lowercase()
      val pm = s.endsWith("pm")
      val am = s.endsWith("am")
      val (hs, ms) = s.removeSuffix("pm").removeSuffix("am").trim().split(":")
      var h = hs.toInt()
      if (pm && h < 12) h += 12
      if (am && h == 12) h = 0
      return "%02d:%02d".format(h, ms.toInt())
    }

    private fun attr(attrs: String, name: String): String? =
      Regex("$name=\"([^\"]*)\"").find(attrs)?.groupValues?.get(1)

    fun parse(html: String): Grid {
      val dates = HEADER.findAll(html).map { m ->
        val month = MONTHS.indexOf(m.groupValues[2]) + 1
        "%02d-%02d-%s".format(m.groupValues[1].toInt(), month, m.groupValues[3])
      }.toList()
      val person = PERSON.find(html)?.groupValues?.get(1)

      val timed = TR.findAll(html).mapNotNull { tr ->
        val t = TIME.find(tr.groupValues[1]) ?: return@mapNotNull null
        Triple(to24(t.groupValues[1]), to24(t.groupValues[2]), tr.groupValues[1])
      }.toList()

      // Rowspans make later rows skip columns, so fill a matrix the way a browser lays the table out.
      val matrix = Array(timed.size) { arrayOfNulls<Cell>(dates.size) }
      timed.forEachIndexed { r, (_, _, tr) ->
        val tds = TD.findAll(tr).drop(1).iterator() // first <td> is the time label
        var c = 0
        while (c < dates.size) {
          if (matrix[r][c] != null) { c++; continue }
          if (!tds.hasNext()) break
          val td = tds.next()
          val attrs = td.groupValues[1]
          val cls = attr(attrs, "class") ?: ""
          val id = attr(attrs, "id") ?: ""
          val span = attr(attrs, "rowspan")?.toIntOrNull() ?: 1
          val state = when {
            cls.contains("cursorpointer") && id.isNotEmpty() -> State.FREE
            cls.contains("closecols") -> State.CLOSED
            person != null && td.groupValues[2].contains(person) -> State.MINE
            else -> State.TAKEN
          }
          val cell = Cell(state, id)
          for (k in 0 until span) if (r + k < timed.size) matrix[r + k][c] = cell
          c++
        }
      }
      val rows = timed.mapIndexed { r, (s, e, _) ->
        Row(s, e, matrix[r].map { it ?: Cell(State.NONE, "") })
      }
      return Grid(dates, rows, INITDATE.find(html)?.groupValues?.get(1), person)
    }
  }
}
