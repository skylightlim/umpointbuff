package com.skylightlim.umpoint.together

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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

    fun createAccount(code: String, name: String) = openAccount { Together.create(app, code, name) }

    fun restore(key: String) = openAccount { Together.restore(app, key) }

    /** If only the sync after it fails, the account still exists, so this phone counts as signed in. */
    private fun openAccount(block: () -> TogetherState) = act {
        try {
            block()
        } finally {
            _signedIn.value = Together.signedIn(app)
        }
    }

    fun startDemo() {
        demo = true
        _signedIn.value = true
        _state.value = TogetherDemo.state(System.currentTimeMillis())
    }

    fun addFriend(code: String) = act { Together.send(app, "/friends/add", JSONObject().put("code", code)) }

    fun answerFriend(code: String, accept: Boolean) =
        act { Together.send(app, "/friends/respond", JSONObject().put("code", code).put("accept", accept)) }

    fun removeFriend(code: String) = act { Together.send(app, "/friends/remove", JSONObject().put("code", code)) }

    fun create(date: String, start: String, slots: Int, court: String, event: String, pax: Int, invite: Collection<String>) = act {
        Together.send(
            app,
            "/lobbies",
            JSONObject().put("date", date).put("start", start).put("slots", slots).put("court", court)
                .put("event", event).put("pax", pax).put("invite", Together.codes(invite)),
        )
    }

    fun inviteMore(lobby: Lobby, invite: Collection<String>) =
        act { Together.send(app, "/lobbies/${lobby.id}/invite", JSONObject().put("codes", Together.codes(invite))) }

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
