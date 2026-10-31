package com.skylightlim.umpoint.together

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.skylightlim.umpoint.BuildConfig
import com.skylightlim.umpoint.data.weekOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class TogetherViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application

    private val _state = MutableStateFlow(Together.cached(app))
    val state: StateFlow<TogetherState?> = _state.asStateFlow()

    private val _signedIn = MutableStateFlow(Together.signedIn(app))
    val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    private val _open = MutableStateFlow(false)
    val open: StateFlow<Boolean> = _open.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _signingIn = MutableStateFlow(false)
    val signingIn: StateFlow<Boolean> = _signingIn.asStateFlow()

    private val _notes = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val notes: SharedFlow<String> = _notes.asSharedFlow()

    private var demo = false

    init {
        if (Together.configured && Together.signedIn(app)) TogetherPush.register(app)
        viewModelScope.launch {
            // Keeps the open screen live even without push, and the badge fresh otherwise.
            // collectLatest restarts the wait, so opening the screen doesn't sit out the slow delay.
            _open.collectLatest { open ->
                while (isActive) {
                    delay(if (open) POLL_OPEN_MS else POLL_IDLE_MS)
                    refresh()
                }
            }
        }
    }

    fun setOpen(open: Boolean) {
        _open.value = open
        if (open) refresh()
    }

    fun refresh() {
        if (demo || !Together.configured || !Together.signedIn(app)) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { Together.sync(app) }
                    .onSuccess { _state.value = it }
                    .onFailure { if (it is TogetherError && it.signedOut) _signedIn.value = false }
            }
        }
    }

    fun startSignIn() {
        _signingIn.value = true
    }

    fun cancelSignIn() {
        _signingIn.value = false
    }

    fun finishSignIn(token: String) {
        _signingIn.value = false
        act { Together.finishSignIn(app, token).also { _signedIn.value = true } }
    }

    fun signOut() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { Together.signOut(app) }
            _signedIn.value = false
            _state.value = null
        }
    }

    /** Debug builds only: a local worker, signed in by email without Google. */
    fun devSignIn(email: String) {
        if (!BuildConfig.DEBUG) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    val conn = URL("${BuildConfig.TOGETHER_URL}/auth/dev").openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.doOutput = true
                    val body = JSONObject().put("email", email).put("name", email.substringBefore('@'))
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                    JSONObject(conn.inputStream.bufferedReader().readText()).getString("token")
                }.onSuccess { finishSignIn(it) }.onFailure { _notes.tryEmit("Dev sign-in failed: ${it.message}") }
            }
        }
    }

    fun startDemo() {
        demo = true
        _signedIn.value = true
        _state.value = TogetherDemo.state(System.currentTimeMillis())
    }

    fun addFriend(email: String) = act { Together.send(app, "/friends/add", JSONObject().put("email", email)) }

    fun answerFriend(email: String, accept: Boolean) =
        act { Together.send(app, "/friends/respond", JSONObject().put("email", email).put("accept", accept)) }

    fun removeFriend(email: String) = act { Together.send(app, "/friends/remove", JSONObject().put("email", email)) }

    fun create(date: String, start: String, slots: Int, court: String, event: String, pax: Int, invite: Collection<String>) = act {
        Together.send(
            app,
            "/lobbies",
            JSONObject().put("date", date).put("start", start).put("slots", slots).put("court", court)
                .put("event", event).put("pax", pax).put("invite", Together.emails(invite)),
        )
    }

    fun inviteMore(lobby: Lobby, invite: Collection<String>) =
        act { Together.send(app, "/lobbies/${lobby.id}/invite", JSONObject().put("emails", Together.emails(invite))) }

    fun accept(lobby: Lobby) = act { Together.accept(app, lobby, ::weekOf) }

    fun decline(lobby: Lobby) = act { Together.send(app, "/lobbies/${lobby.id}/respond", JSONObject().put("accept", false)) }

    fun giveUp(lobby: Lobby) = act { Together.send(app, "/lobbies/${lobby.id}/withdraw") }

    fun callOff(lobby: Lobby) = act { Together.send(app, "/lobbies/${lobby.id}/cancel") }

    private fun act(block: () -> TogetherState) {
        if (demo) {
            _notes.tryEmit("Demo mode changes nothing.")
            return
        }
        viewModelScope.launch {
            _busy.value = true
            withContext(Dispatchers.IO) {
                runCatching(block)
                    .onSuccess { _state.value = it }
                    .onFailure {
                        if (it is TogetherError && it.signedOut) _signedIn.value = false
                        _notes.tryEmit(it.message ?: "Something went wrong.")
                    }
            }
            _busy.value = false
        }
    }

    private companion object {
        const val POLL_OPEN_MS = 15_000L
        const val POLL_IDLE_MS = 5 * 60_000L
    }
}
