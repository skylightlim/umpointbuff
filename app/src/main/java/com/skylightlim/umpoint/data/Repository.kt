package com.skylightlim.umpoint.data

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.CookieManager
import com.skylightlim.umpoint.sniper.Booker
import com.skylightlim.umpoint.sniper.SessionExpired
import com.skylightlim.umpoint.sniper.SniperLog
import com.skylightlim.umpoint.sniper.SniperScheduler
import com.skylightlim.umpoint.sniper.SniperStore
import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.sniper.UmpointHttp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class SignInRequired : Exception("Your UMPoint session expired. Sign in again.")

class UmpointRepository(context: Context) {
    private val app = context.applicationContext
    private val cache = CacheStore(app)
    private val prefsStore = PrefsStore(app)
    private val renewMutex = Mutex()

    private val _session = MutableStateFlow(SessionState.UNKNOWN)
    val session: StateFlow<SessionState> = _session.asStateFlow()

    fun cachedWeek(week: WeekType): Pair<WeekGrid, Long>? = cache.readWeek(week)

    fun cachedBookings(): Pair<List<Booking>, Long>? = cache.readBookings()

    suspend fun refreshSession(): SessionState = withContext(Dispatchers.IO) {
        val state = when (UmpointHttp(app).sessionAlive()) {
            true -> SessionState.SIGNED_IN
            false -> if (ensureSession()) SessionState.SIGNED_IN else SessionState.SIGNED_OUT
            null -> SessionState.OFFLINE
        }
        _session.value = state
        state
    }

    /** Signs back in with the Google cookies the sign-in sheet left; false means the user must sign in. */
    private suspend fun ensureSession(): Boolean = renewMutex.withLock {
        withContext(Dispatchers.IO) {
            val http = UmpointHttp(app)
            val ok = http.sessionAlive() == true || run {
                val oauth = http.oauthUrl()
                oauth != null && (http.renewByRedirects(oauth) || http.renewInWebView(oauth))
            }
            _session.value = if (ok) SessionState.SIGNED_IN else SessionState.SIGNED_OUT
            ok
        }
    }

    private suspend fun <T> withSession(block: suspend () -> T): T {
        try {
            val out = block()
            _session.value = SessionState.SIGNED_IN
            return out
        } catch (e: SessionExpired) {
            if (!ensureSession()) throw SignInRequired()
            return block()
        }
    }

    suspend fun fetchWeek(week: WeekType): Pair<WeekGrid, Long> = withSession {
        val now = System.currentTimeMillis()
        val monday = Umpoint.weekStart(now) + if (week == WeekType.NEXT) Umpoint.WEEK_MS else 0
        val http = UmpointHttp(app)
        val today = Umpoint.mytDate(now)
        val grids = coroutineScope {
            CourtIds.ALL.map { court ->
                async(Dispatchers.IO) {
                    court to http.grid(court, monday / 1000, week.flag, today)
                }
            }.awaitAll()
        }
        val grid = mergeWeek(week, grids)
        check(grid.dates.isNotEmpty() && grid.times.isNotEmpty()) {
            "UMPoint returned an empty week. Try again later."
        }
        val at = System.currentTimeMillis()
        cache.writeWeek(week, grid, at)
        grid to at
    }

    suspend fun fetchBookings(): Pair<List<Booking>, Long> = withSession {
        val r = UmpointHttp(app).request("${Umpoint.BASE}/modules/dashboard/")
        if (r.code in 300..399) throw SessionExpired()
        if (r.body.contains("Service Offline")) {
            throw IllegalStateException("UMPoint is offline right now. Try again later.")
        }
        if (r.code == 404) throw SessionExpired()
        if (r.code != 200) throw IllegalStateException("UMPoint returned HTTP ${r.code}.")
        val list = parseDashboard(r.body)
        val at = System.currentTimeMillis()
        cache.writeBookings(list, at)
        list to at
    }

    /** Books a slot in the week that is open now, through the same code the sniper fires. */
    suspend fun bookNow(req: SlotRequest): BookResult = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val task = Task(
            id = "now-" + UUID.randomUUID().toString().take(6),
            date = req.date,
            start = req.start,
            end = req.end,
            court = req.court,
            anyCourt = req.anyCourt,
            event = req.event,
            pax = req.pax,
            dryRun = req.dryRun,
            measure = req.measure,
            fireAt = now,
            createdAt = now,
        )
        val http = UmpointHttp(app)
        val booker = Booker(app, http) { SniperLog.line(app, "[book now ${task.date}] $it") }
        SniperLog.line(app, "book now: ${task.date} ${task.start}-${task.end} court ${task.court} any=${task.anyCourt}")
        val weekTs = Umpoint.rolloverFor(task.date) / 1000
        val result = try {
            if (http.sessionAlive() != true) throw SessionExpired()
            booker.book(task, weekTs, 0L)
        } catch (e: SessionExpired) {
            val oauth = http.oauthUrl()
            if (oauth != null && (http.renewByRedirects(oauth) || http.renewInWebView(oauth))) {
                try {
                    booker.book(task, weekTs, 0L)
                } catch (e2: SessionExpired) {
                    Booker.Result("signed_out", "Your UMPoint session expired. Sign in again.", null)
                }
            } else {
                Booker.Result("signed_out", "Your UMPoint session expired. Sign in again.", null)
            }
        }
        SniperLog.line(app, "book now result: ${result.status} ${result.message}")
        BookResult(result.status, result.message, result.court)
    }

    fun arm(req: SlotRequest): Task {
        val now = System.currentTimeMillis()
        val fireAt = req.fireAt ?: Umpoint.rolloverFor(req.date)
        require(fireAt > now + 15_000) { "That week is already open — book it directly instead." }
        require(req.dryRun || Umpoint.mytDate(fireAt) != req.date) {
            "UMPoint doesn't take same-day bookings, so a week's Monday can't be sniped. Pick Tuesday to Friday."
        }
        val task = Task(
            id = UUID.randomUUID().toString().take(8),
            date = req.date,
            start = req.start,
            end = req.end,
            court = req.court,
            anyCourt = req.anyCourt,
            event = req.event,
            pax = req.pax,
            dryRun = req.dryRun,
            measure = req.measure,
            fireAt = fireAt,
            createdAt = now,
        )
        SniperStore.put(app, task)
        SniperLog.line(
            app,
            "armed ${task.id}: ${task.date} ${task.start}-${task.end} court ${task.court} " +
                "any=${task.anyCourt} dry=${task.dryRun} fireAt=${task.fireAt}",
        )
        SniperScheduler.reschedule(app)
        return task
    }

    fun cancel(id: String) {
        SniperStore.update(app, id) { if (it.status == "armed") it.status = "cancelled" }
        SniperScheduler.reschedule(app)
    }

    fun remove(id: String) {
        SniperStore.remove(app, id)
        SniperScheduler.reschedule(app)
    }

    fun tasks(): List<Task> = SniperStore.all(app).sortedBy { it.fireAt }

    /** A dry run on Tuesday 09:00–09:30 next week, three minutes from now. */
    fun testRun(): Task {
        val now = System.currentTimeMillis()
        return arm(
            SlotRequest(
                date = Umpoint.mytDate(nextRollover(now) + 86_400_000L),
                start = "09:00",
                end = "09:30",
                court = "1",
                anyCourt = false,
                event = "Sniper test",
                pax = 1,
                dryRun = true,
                measure = false,
                fireAt = now + 3 * 60_000L,
            ),
        )
    }

    fun seenResults(): Set<String> = prefsStore.seenResults()

    fun markResultSeen(id: String) = prefsStore.markResultSeen(id)

    /** Debug demo only: shows the signed-in screens without touching UMPoint. */
    fun forceSession(state: SessionState) {
        _session.value = state
    }

    fun prefs(): BookingPrefs = prefsStore.load()

    fun savePrefs(prefs: BookingPrefs) = prefsStore.save(prefs)

    fun phoneSetup(): PhoneSetup {
        val nm = app.getSystemService(NotificationManager::class.java)
        return PhoneSetup(
            notifications = nm.areNotificationsEnabled(),
            exactAlarms = Build.VERSION.SDK_INT < 31 ||
                app.getSystemService(AlarmManager::class.java).canScheduleExactAlarms(),
            fullScreen = Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent(),
            backgroundRestricted = Build.VERSION.SDK_INT >= 28 &&
                app.getSystemService(ActivityManager::class.java).isBackgroundRestricted,
        )
    }

    fun openSettings(which: String) {
        val pkg = Uri.parse("package:${app.packageName}")
        val intent = when {
            which == "notifications" && Build.VERSION.SDK_INT >= 26 ->
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, app.packageName)
            which == "fullScreen" && Build.VERSION.SDK_INT >= 34 ->
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg)
            which == "exactAlarms" && Build.VERSION.SDK_INT >= 31 ->
                Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg)
            else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        }
        app.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun markSignedIn() {
        CookieManager.getInstance().flush()
        _session.value = SessionState.SIGNED_IN
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        UmpointHttp(app).clearSession()
        _session.value = SessionState.SIGNED_OUT
    }

    fun readLog(): String = SniperLog.read(app)
}

private class CacheStore(context: Context) {
    private val prefs = context.getSharedPreferences("umpoint_cache", Context.MODE_PRIVATE)

    fun readWeek(week: WeekType): Pair<WeekGrid, Long>? = runCatching {
        val raw = prefs.getString("week:${week.name.lowercase()}", null) ?: return null
        val o = JSONObject(raw)
        val grid = weekGridFromJson(o.getJSONObject("data"))
        if (grid.dates.isEmpty() || grid.times.isEmpty()) return null
        grid to o.getLong("at")
    }.getOrNull()

    fun writeWeek(week: WeekType, grid: WeekGrid, at: Long) {
        prefs.edit()
            .putString(
                "week:${week.name.lowercase()}",
                JSONObject().put("data", grid.toJson()).put("at", at).toString(),
            )
            .apply()
    }

    fun readBookings(): Pair<List<Booking>, Long>? = runCatching {
        val raw = prefs.getString("bookings", null) ?: return null
        val o = JSONObject(raw)
        val arr = o.getJSONArray("data")
        val list = (0 until arr.length()).map { bookingFromJson(arr.getJSONObject(it)) }
        list to o.getLong("at")
    }.getOrNull()

    fun writeBookings(list: List<Booking>, at: Long) {
        val arr = JSONArray(list.map { it.toJson() })
        prefs.edit().putString("bookings", JSONObject().put("data", arr).put("at", at).toString()).apply()
    }
}

private class PrefsStore(context: Context) {
    private val prefs = context.getSharedPreferences("umpoint_prefs", Context.MODE_PRIVATE)

    fun load(): BookingPrefs = BookingPrefs(
        event = prefs.getString("event", "Badminton practice")?.takeIf { it.isNotBlank() } ?: "Badminton practice",
        pax = prefs.getInt("pax", 4).coerceIn(1, 12),
    )

    fun seenResults(): Set<String> = prefs.getStringSet("seen_results", emptySet()).orEmpty()

    fun markResultSeen(id: String) {
        prefs.edit().putStringSet("seen_results", seenResults() + id).apply()
    }

    fun save(p: BookingPrefs) {
        prefs.edit().putString("event", p.event.ifBlank { "Badminton practice" }).putInt("pax", p.pax.coerceIn(1, 12)).apply()
    }
}
