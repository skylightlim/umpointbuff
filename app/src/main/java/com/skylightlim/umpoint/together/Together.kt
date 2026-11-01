package com.skylightlim.umpoint.together

import android.content.Context
import com.skylightlim.umpoint.BuildConfig
import com.skylightlim.umpoint.sniper.SniperLog
import com.skylightlim.umpoint.sniper.SniperScheduler
import com.skylightlim.umpoint.sniper.SniperStore
import com.skylightlim.umpoint.sniper.Task
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class TogetherError(message: String, val signedOut: Boolean = false) : Exception(message)

/**
 * Friends and open tenders. The server only decides who holds which half hour: it never sees a
 * UMPoint session and books nothing. Each phone turns what it holds into an ordinary armed snipe,
 * so a server outage at 00:00 can't stop a booking. All calls block, so stay off the main thread.
 */
object Together {
    val configured get() = BuildConfig.TOGETHER_URL.isNotBlank()

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("umpoint_together", Context.MODE_PRIVATE)

    fun signedIn(ctx: Context) = prefs(ctx).getString("token", null) != null

    fun signInUrl(state: String) = "${BuildConfig.TOGETHER_URL}/auth/start?state=$state"

    fun doneUrl() = "${BuildConfig.TOGETHER_URL}/auth/done"

    fun cached(ctx: Context): TogetherState? = runCatching {
        prefs(ctx).getString("state", null)?.let { togetherStateFromJson(JSONObject(it)) }
    }.getOrNull()

    fun finishSignIn(ctx: Context, token: String): TogetherState {
        prefs(ctx).edit().putString("token", token).commit()
        TogetherPush.register(ctx)
        return sync(ctx)
    }

    /** Forgets this phone's account. Snipes already armed stay armed: they're the user's own. */
    fun signOut(ctx: Context) {
        runCatching { call(ctx, "POST", "/session/end", JSONObject()) }
        prefs(ctx).edit().remove("token").remove("state").commit()
    }

    fun sendDeviceToken(ctx: Context, token: String) {
        if (signedIn(ctx)) call(ctx, "POST", "/device", JSONObject().put("token", token))
    }

    /** Fetches the state and brings this phone's snipes in line with it. */
    @Synchronized
    fun sync(ctx: Context): TogetherState = apply(ctx, call(ctx, "GET", "/state", null))

    /** Sends a change; the answer is the new state, applied the same way as a sync. */
    @Synchronized
    fun send(ctx: Context, path: String, body: JSONObject = JSONObject()): TogetherState =
        apply(ctx, call(ctx, "POST", path, body))

    /** Takes the next free half hour, unless Pusat Sukan's terms rule it out for this user. */
    @Synchronized
    fun accept(ctx: Context, lobby: Lobby, weekOf: (String) -> Long): TogetherState {
        val tasks = SniperStore.all(ctx)
        ruleConflict(lobby.date, lobby.id, tasks, weekOf)?.let { throw TogetherError(it) }
        // Someone who gave a half hour up and came back may get the same one: without this, its old
        // cancelled snipe would read as them cancelling again.
        tasks.filter { it.status == "cancelled" && it.id.startsWith(taskIdPrefix(lobby.id)) }
            .forEach { SniperStore.remove(ctx, it.id) }
        return send(ctx, "/lobbies/${lobby.id}/respond", JSONObject().put("accept", true))
    }

    private fun apply(ctx: Context, raw: String): TogetherState {
        var body = raw
        var state = togetherStateFromJson(JSONObject(body))
        var changedAlarms = false
        var askedServer = false
        for (step in planSync(state, SniperStore.all(ctx), System.currentTimeMillis())) {
            when (step) {
                is Step.Arm -> {
                    SniperStore.put(ctx, taskFor(step.lobby, step.slot))
                    changedAlarms = true
                    SniperLog.line(ctx, "together: armed ${step.slot.start}-${step.slot.end} of session ${step.lobby.id}")
                }
                is Step.Disarm -> {
                    SniperStore.update(ctx, step.taskId) {
                        if (it.status == "armed") {
                            it.status = "cancelled"
                            it.message = step.why
                        }
                    }
                    changedAlarms = true
                    SniperLog.line(ctx, "together: disarmed ${step.taskId}: ${step.why}")
                }
                is Step.GiveUp -> askedServer = tryServer(ctx, "/lobbies/${step.lobbyId}/withdraw", JSONObject()) || askedServer
                is Step.Report -> askedServer = tryServer(
                    ctx,
                    "/lobbies/${step.lobbyId}/result",
                    JSONObject().put("idx", step.idx).put("result", step.result).put("message", step.message),
                ) || askedServer
            }
        }
        if (changedAlarms) SniperScheduler.reschedule(ctx)
        if (askedServer) {
            runCatching { call(ctx, "GET", "/state", null) }.onSuccess {
                body = it
                state = togetherStateFromJson(JSONObject(it))
            }
        }
        prefs(ctx).edit().putString("state", body).apply()
        return state
    }

    /** A failed report or give-up simply stays in the plan and goes out with the next sync. */
    private fun tryServer(ctx: Context, path: String, body: JSONObject): Boolean =
        runCatching { call(ctx, "POST", path, body) }
            .onFailure { SniperLog.line(ctx, "together: $path failed: ${it.message}") }
            .isSuccess

    private fun taskFor(lobby: Lobby, slot: Slot) = Task(
        id = taskId(lobby.id, slot.idx),
        date = lobby.date,
        start = slot.start,
        end = slot.end,
        court = lobby.court,
        // A relay only works on one court: falling back would split the session between courts.
        anyCourt = false,
        event = lobby.event,
        pax = lobby.pax,
        dryRun = false,
        measure = false,
        fireAt = lobby.fireAt,
        createdAt = System.currentTimeMillis(),
    )

    private fun call(ctx: Context, method: String, path: String, body: JSONObject?): String {
        if (!configured) throw TogetherError("Play together isn’t set up in this build.")
        val conn = URL(BuildConfig.TOGETHER_URL + path).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            conn.requestMethod = method
            prefs(ctx).getString("token", null)?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                val bytes = body.toString().toByteArray()
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setFixedLengthStreamingMode(bytes.size)
                conn.outputStream.use { it.write(bytes) }
            }
            val code = conn.responseCode
            val text = (if (code < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code == 401) {
                prefs(ctx).edit().remove("token").apply()
                throw TogetherError("Sign in to Play together again.", signedOut = true)
            }
            if (code >= 400) {
                throw TogetherError(runCatching { JSONObject(text).getString("error") }.getOrDefault("The server said HTTP $code."))
            }
            return text
        } catch (e: IOException) {
            throw TogetherError("Can’t reach the Play together server. Check your connection.")
        } finally {
            conn.disconnect()
        }
    }

    fun emails(list: Collection<String>) = JSONArray(list.toList())
}
