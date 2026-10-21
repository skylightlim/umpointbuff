package expo.modules.umpointsniper

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.min

/**
 * One rollover: everything from the 23:50 alarm to the last measurement, for the tasks that fire
 * at the same [fireAt]. Runs on the service's worker thread and blocks it.
 */
class Rollover(private val svc: SniperService, private val fireAt: Long, private val tasks: List<Task>) {
  companion object {
    /** How late a snipe may still go out if the phone or the session wasn't ready at 00:00. */
    const val LATE_MS = 10 * 60_000L
    /** How long "the week isn't open yet" answers are retried after 00:00. */
    const val OPEN_RETRY_MS = 90_000L
    private val TIME = DateTimeFormatter.ofPattern("HH:mm:ss.SSS").withZone(Umpoint.MYT)
  }

  private val ctx = svc.applicationContext
  private val http = UmpointHttp(ctx)
  private val booker = Booker(ctx, http, ::log)
  private val weekTs = fireAt / 1000
  private val studyName = "rollover-" + Umpoint.mytDate(fireAt)
  private var offsetLow = Long.MIN_VALUE
  private var offsetHigh = Long.MAX_VALUE

  private fun log(msg: String) = SniperLog.line(ctx, "[${Umpoint.mytDate(fireAt)}] $msg")

  private fun serverNow() = booker.serverNow()

  private fun fmt(ms: Long) = TIME.format(Instant.ofEpochMilli(ms))

  fun run() {
    tasks.forEach { t -> SniperStore.update(ctx, t.id) { it.status = "running" } }
    log("start: ${tasks.size} task(s), fire at ${fmt(fireAt)} MYT, phone clock ${fmt(System.currentTimeMillis())}")
    svc.ongoing("Sniper running", "Checking your UMPoint session")

    if (!ensureSession(fireAt + LATE_MS)) {
      tasks.forEach { svc.finish(it, "failed", "Not signed in to UMPoint at 00:00, so nothing was sent.") }
      return
    }
    sampleClock(3)

    // Until a minute before: keep the session warm and keep refining the clock.
    while (serverNow() < fireAt - 75_000) {
      svc.ongoing("Sniper armed", "Fires at 00:00:00 · ${tasks.joinToString { "${it.date} ${it.start}" }}")
      sleepUntil(min(serverNow() + 120_000, fireAt - 75_000))
      if (serverNow() >= fireAt - 75_000) break
      if (http.sessionAlive() != true && !ensureSession(fireAt + LATE_MS)) {
        tasks.forEach { svc.finish(it, "failed", "The UMPoint session ended before 00:00 and couldn't be renewed.") }
        return
      }
      sampleClock(1)
    }
    sampleClock(8)
    if (http.sessionAlive() != true && !ensureSession(fireAt + LATE_MS)) {
      tasks.forEach { svc.finish(it, "failed", "The UMPoint session ended before 00:00 and couldn't be renewed.") }
      return
    }
    prefetch()
    if (tasks.any { it.measure }) snapshot("before")

    svc.ongoing("Sniper firing", "00:00:00")
    sleepUntil(fireAt + 30)
    for (task in tasks) fire(task)

    if (tasks.any { it.measure }) measure()
    log("done")
  }

  /** Signs in again if needed; rings until the user does it themselves or [deadline] passes. */
  private fun ensureSession(deadline: Long): Boolean {
    var alive = http.sessionAlive()
    var tries = 0
    while (alive == null && tries++ < 6) { // network hiccup: give it a minute
      Thread.sleep(10_000)
      alive = http.sessionAlive()
    }
    if (alive == true) return true
    log("session ${if (alive == null) "unreachable" else "expired"}; renewing")
    val oauth = http.oauthUrl()
    if (oauth != null && http.renewByRedirects(oauth)) {
      log("renewed by following Google's redirects")
      return true
    }
    if (oauth != null && http.renewInWebView(oauth)) {
      log("renewed in an off-screen WebView")
      return true
    }
    log("couldn't renew; ringing")
    tasks.forEach { t -> SniperStore.update(ctx, t.id) { it.status = "ringing" } }
    svc.ring(alive == null)
    try {
      while (System.currentTimeMillis() < deadline) {
        Thread.sleep(5_000)
        if (http.sessionAlive() == true) {
          log("signed in by hand")
          return true
        }
      }
      return false
    } finally {
      svc.stopRing()
      tasks.forEach { t -> SniperStore.update(ctx, t.id) { if (it.status == "ringing") it.status = "running" } }
    }
  }

  /**
   * Narrows serverTime - phoneTime from HTTP Date headers: a header saying second D, stamped
   * somewhere between sending and receiving, bounds the offset to [D - received, D + 1000 - sent).
   * Samples land at drifting sub-second phases, so the bounds close in on the true offset.
   */
  private fun sampleClock(samples: Int) {
    repeat(samples) { i ->
      runCatching {
        val r = http.request("${Umpoint.BASE}/img/google.png")
        val d = r.date ?: return@runCatching
        offsetLow = max(offsetLow, d - r.receivedAt)
        offsetHigh = min(offsetHigh, d + 1000 - r.sentAt)
      }
      if (i < samples - 1) Thread.sleep(1_130)
    }
    if (offsetLow != Long.MIN_VALUE && offsetLow <= offsetHigh) {
      booker.offset = (offsetLow + offsetHigh) / 2
      log("clock: server = phone ${if (booker.offset >= 0) "+" else ""}${booker.offset} ms (±${(offsetHigh - offsetLow) / 2} ms)")
    } else if (offsetLow > offsetHigh) {
      log("clock bounds crossed ($offsetLow > $offsetHigh); keeping ${booker.offset} ms")
      offsetLow = Long.MIN_VALUE
      offsetHigh = Long.MAX_VALUE
    }
  }

  /** Sleeps until server time reaches [target], finishing with short sleeps for precision. */
  private fun sleepUntil(target: Long) {
    while (true) {
      val left = target - serverNow()
      if (left <= 0) return
      Thread.sleep(if (left > 1_500) left - 1_000 else if (left > 20) left - 10 else 1)
    }
  }

  /** Reads the target slots on next week's grid (cell ids, and whether they are still free). */
  private fun prefetch() {
    val today = Umpoint.mytDate(serverNow())
    for (task in tasks) {
      val courts = if (task.anyCourt) listOf("1", "2", "3", "4") else listOf(task.court)
      for (court in courts) {
        runCatching {
          val g = http.grid(court, weekTs, "n", today)
          if (booker.person == null) booker.person = g.person
          log("before: court $court ${task.date} ${task.start}-${task.end} = ${g.states(task.date, task.start, task.end)}")
        }.onFailure { log("before: court $court grid failed: $it") }
      }
    }
  }

  private fun fire(task: Task) {
    if (task.dryRun) {
      val fields = Umpoint.bookingFields(task, task.court, weekTs, Umpoint.mytDate(serverNow()))
      log("dry run at ${fmt(serverNow())}: would send ${fields.filter { it.second != null && it.first in setOf("sdbook", "stbook", "etbook", "spid", "tweek", "initdate", "stdateselected", "eddateselected") }}")
      svc.finish(task, "dry_run", "Test run OK: it would have fired at ${fmt(serverNow())}. Nothing was booked.")
      return
    }
    log("firing ${task.date} ${task.start}-${task.end} court ${task.court}${if (task.anyCourt) " (any court)" else ""} at ${fmt(serverNow())}")
    val result = try {
      booker.book(task, weekTs, fireAt + OPEN_RETRY_MS)
    } catch (e: SessionExpired) {
      log("session expired while firing")
      if (ensureSession(fireAt + LATE_MS)) booker.book(task, weekTs, fireAt + OPEN_RETRY_MS)
      else Booker.Result("failed", "The UMPoint session ended at 00:00.", null)
    }
    log("result: ${result.status} ${result.message} at ${fmt(serverNow())}")
    svc.finish(task, result.status, result.message, result.court)
  }

  /** How fast slots go: every court's grid every 5 s for 5 minutes, then every minute to 01:00. */
  private fun measure() {
    svc.ongoing("Recording the rollover", "Watching how fast courts go, until 01:00")
    val end5 = fireAt + 5 * 60_000
    val end60 = fireAt + 60 * 60_000
    var next = serverNow()
    while (serverNow() < end60) {
      snapshot("after")
      next += if (serverNow() < end5) 5_000 else 60_000
      sleepUntil(next)
    }
  }

  /** Logs only which cells are free and how many I hold — never other students' details. */
  private fun snapshot(label: String) {
    val today = Umpoint.mytDate(serverNow())
    val flag = if (serverNow() < fireAt) "n" else "t"
    for (court in listOf("1", "2", "3", "4")) {
      val t0 = serverNow()
      runCatching { http.grid(court, weekTs, flag, today) }
        .onSuccess { g ->
          val free = g.freeIds().map { it.substringBeforeLast("/").substringBeforeLast("/").substringBeforeLast("/") }
          val mine = g.rows.sumOf { r -> r.cells.count { it.state == Grid.State.MINE } }
          SniperLog.json(ctx, studyName, JSONObject().put("t", t0).put("label", label).put("court", court)
            .put("ms", serverNow() - t0).put("server_today", g.initdate).put("mine", mine).put("free", JSONArray(free)))
        }
        .onFailure { SniperLog.json(ctx, studyName, JSONObject().put("t", t0).put("court", court).put("error", it.toString())) }
    }
  }
}
