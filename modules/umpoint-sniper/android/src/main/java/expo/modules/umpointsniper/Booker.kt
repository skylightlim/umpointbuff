package expo.modules.umpointsniper

import android.content.Context
import expo.modules.umpointsniper.Grid.State

/**
 * Sends a booking and reads back what UMPoint did with it. Used by "Book now" and by the
 * rollover sniper, so the one test booking exercises the same code that fires at 00:00.
 */
class Booker(private val ctx: Context, private val http: UmpointHttp, private val log: (String) -> Unit) {
  enum class Kind { BOOKED, TAKEN, NOT_OPEN, REJECTED }

  class Outcome(val kind: Kind, val why: String)

  class Result(val status: String, val message: String, val court: String?)

  /** serverTime - phoneTime in ms, measured by the sniper; 0 for "Book now". */
  var offset = 0L
  var person: String? = null

  fun serverNow() = System.currentTimeMillis() + offset

  private fun label(task: Task) = "${task.date} ${task.start}–${task.end}"

  private fun failure(html: String): String? {
    Regex("Reservation failed\\s*!([^<]*)").find(html)?.let { return "Reservation failed: " + it.groupValues[1].trim() }
    Regex("class=\"alert alert-danger\"[^>]*>([\\s\\S]*?)</div>").find(html)?.let {
      return it.groupValues[1].replace(Regex("<[^>]+>"), " ").replace(Regex("\\s+"), " ").trim()
    }
    return null
  }

  fun attempt(task: Task, court: String, weekTs: Long, n: Int): Outcome {
    val today = Umpoint.mytDate(serverNow())
    val r = http.submitBooking(Umpoint.bookingFields(task, court, weekTs, today))
    log("POST court $court #$n -> HTTP ${r.code}${r.location?.let { " → $it" } ?: ""} in ${r.receivedAt - r.sentAt} ms")
    if (r.code in 300..399 && (r.location ?: "").contains("/login")) throw SessionExpired()
    val sent = Grid.parse(r.body)
    if (person == null) person = sent.person
    SniperLog.save(ctx, "post-${task.id}-c$court-$n.html", Umpoint.sanitize(r.body, person))
    val failMsg = failure(r.body)

    // Read the slot itself: from the response if it is the week's grid, otherwise fetch it.
    val grid = sent.takeIf { it.dates.contains(task.date) } ?: http.grid(court, weekTs, "t", today)
    if (person == null) person = grid.person
    val states = grid.states(task.date, task.start, task.end)
    log("court $court slot ${states ?: "not on grid"}; server today ${grid.initdate}; message ${failMsg ?: "none"}")
    return when {
      states == null -> Outcome(Kind.REJECTED, failMsg ?: "The slot isn't on UMPoint's grid")
      states.all { it == State.MINE } -> Outcome(Kind.BOOKED, "")
      states.any { it == State.TAKEN || it == State.MINE } -> Outcome(Kind.TAKEN, "Court $court was already taken")
      states.any { it == State.CLOSED } -> Outcome(Kind.REJECTED, failMsg ?: "Court $court is closed then")
      else -> Outcome(Kind.NOT_OPEN, failMsg ?: "UMPoint didn't take the booking")
    }
  }

  /** The court of a dashboard booking for this task's date and start time, if there is one. */
  fun bookedOnDashboard(task: Task): String? = try {
    val r = http.request("${Umpoint.BASE}/modules/dashboard/")
    val start = Umpoint.minutes(task.start)
    val h = start / 60
    val when12 = "%02d:%02d %s".format(if (h % 12 == 0) 12 else h % 12, start % 60, if (h < 12) "AM" else "PM")
    val day = task.date.replace('-', '/')
    Regex("<tr[^>]*>([\\s\\S]*?)</tr>").findAll(r.body)
      .map { it.groupValues[1].replace(Regex("<[^>]+>"), " ").replace(Regex("\\s+"), " ") }
      .firstOrNull { it.contains("$day $when12") }
      ?.let { Regex("Gelanggang Badminton (\\d)").find(it)?.groupValues?.get(1) }
  } catch (e: Exception) {
    null
  }

  /**
   * Books [task] for the week starting [weekTs] (seconds). Courts are tried one at a time, so it
   * never holds more than one; "not open yet" answers are retried until [retryUntil].
   */
  fun book(task: Task, weekTs: Long, retryUntil: Long): Result {
    val courts = if (task.anyCourt) listOf(task.court) + listOf("1", "2", "3", "4").filter { it != task.court }
      else listOf(task.court)
    var why = "Court ${task.court} was already taken"
    for (court in courts) {
      var n = 0
      while (true) {
        n++
        val o = try {
          attempt(task, court, weekTs, n)
        } catch (e: SessionExpired) {
          throw e
        } catch (e: Exception) {
          log("court $court #$n error: $e")
          Outcome(Kind.NOT_OPEN, "Couldn't reach UMPoint (${e.javaClass.simpleName})")
        }
        if (o.kind == Kind.BOOKED) return Result("booked", "Booked Court $court · ${label(task)}", court)
        why = o.why
        if (o.kind == Kind.NOT_OPEN && serverNow() < retryUntil) {
          Thread.sleep(300)
          continue
        }
        break
      }
      // Before trying another court, make sure none of the attempts landed after all.
      bookedOnDashboard(task)?.let {
        log("dashboard shows a booking on Court $it")
        return Result("booked", "Booked Court $it · ${label(task)}", it)
      }
    }
    return Result("failed", why, null)
  }
}
