package com.skylightlim.umpoint

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.skylightlim.umpoint.data.BookResult
import com.skylightlim.umpoint.data.Booking
import com.skylightlim.umpoint.data.BookingPrefs
import com.skylightlim.umpoint.data.DemoData
import com.skylightlim.umpoint.data.PhoneSetup
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.data.SignInRequest
import com.skylightlim.umpoint.data.SignInRequired
import com.skylightlim.umpoint.data.SlotRequest
import com.skylightlim.umpoint.data.UmpointRepository
import com.skylightlim.umpoint.data.WeekGrid
import com.skylightlim.umpoint.data.WeekType
import com.skylightlim.umpoint.sniper.SniperService
import com.skylightlim.umpoint.sniper.Task
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

data class WeekUiState(
    val data: WeekGrid? = null,
    val updatedAt: Long? = null,
    val refreshing: Boolean = false,
    val error: String? = null,
)

data class BookingsUiState(
    val data: List<Booking>? = null,
    val updatedAt: Long? = null,
    val refreshing: Boolean = false,
    val error: String? = null,
)

enum class ToastTone { PLAIN, BOOKED, ARMED, ERROR }

data class UiEvent(val text: String, val tone: ToastTone = ToastTone.PLAIN)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = UmpointRepository(application)

    val session: StateFlow<SessionState> = repo.session

    /** The date picked on Courts; other screens can point it somewhere, and it survives tab changes. */
    private val _pickedDate = MutableStateFlow<String?>(null)
    val pickedDate: StateFlow<String?> = _pickedDate.asStateFlow()

    /** The snipe that was just armed, for the hero moment. */
    private val _justArmed = MutableStateFlow<Task?>(null)
    val justArmed: StateFlow<Task?> = _justArmed.asStateFlow()

    /** Finished snipes whose result has already been shown full-screen. */
    private val _seenResults = MutableStateFlow(repo.seenResults())
    val seenResults: StateFlow<Set<String>> = _seenResults.asStateFlow()

    private var demo = false

    private val _thisWeek = MutableStateFlow(WeekUiState())
    private val _nextWeek = MutableStateFlow(WeekUiState())
    val thisWeek: StateFlow<WeekUiState> = _thisWeek.asStateFlow()
    val nextWeek: StateFlow<WeekUiState> = _nextWeek.asStateFlow()

    private val _bookings = MutableStateFlow(BookingsUiState())
    val bookings: StateFlow<BookingsUiState> = _bookings.asStateFlow()

    private val _tasks = MutableStateFlow<List<Task>>(emptyList())
    val tasks: StateFlow<List<Task>> = _tasks.asStateFlow()

    private val _setup = MutableStateFlow(repo.phoneSetup())
    val setup: StateFlow<PhoneSetup> = _setup.asStateFlow()

    private val _now = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = _now.asStateFlow()

    private val _prefs = MutableStateFlow(BookingPrefs())
    val prefs: StateFlow<BookingPrefs> = _prefs.asStateFlow()

    private val _signIn = MutableStateFlow<SignInRequest?>(null)
    val signIn: StateFlow<SignInRequest?> = _signIn.asStateFlow()

    private val _dashboard = MutableStateFlow(false)
    val dashboard: StateFlow<Boolean> = _dashboard.asStateFlow()

    private val _events = MutableSharedFlow<UiEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<UiEvent> = _events.asSharedFlow()

    private val _log = MutableStateFlow<String?>(null)
    val log: StateFlow<String?> = _log.asStateFlow()

    init {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                repo.cachedWeek(WeekType.THIS)?.let { (grid, at) -> _thisWeek.value = WeekUiState(grid, at) }
                repo.cachedWeek(WeekType.NEXT)?.let { (grid, at) -> _nextWeek.value = WeekUiState(grid, at) }
                repo.cachedBookings()?.let { (list, at) -> _bookings.value = BookingsUiState(list, at) }
                _prefs.value = repo.prefs()
            }
            startLoops()
            if (demo) return@launch
            repo.refreshSession()
            refreshAll()
        }
    }

    /** Debug builds only: fills the screens with made-up data and stays off the network. */
    fun startDemo(scene: String) {
        demo = true
        repo.forceSession(SessionState.SIGNED_IN)
        val now = System.currentTimeMillis()
        _thisWeek.value = WeekUiState(DemoData.grid(WeekType.THIS, now), now)
        _nextWeek.value = WeekUiState(DemoData.grid(WeekType.NEXT, now), now)
        _bookings.value = BookingsUiState(DemoData.bookings(now), now)
        _tasks.value = DemoData.tasks(scene, now)
        _setup.value = PhoneSetup(
            notifications = scene != "problem",
            exactAlarms = true,
            fullScreen = true,
            backgroundRestricted = false,
        )
    }

    /** Runs the midnight routine in three minutes without booking; not in the UI, launched over adb. */
    fun startHiddenTestRun() {
        repo.testRun()
        reloadTasks()
    }

    fun pickDate(date: String?) {
        _pickedDate.value = date
    }

    private fun startLoops() {
        viewModelScope.launch {
            while (isActive) {
                _now.value = System.currentTimeMillis()
                delay(1000)
            }
        }
        viewModelScope.launch {
            while (isActive) {
                if (!demo) {
                    _tasks.value = repo.tasks()
                    _setup.value = repo.phoneSetup()
                }
                if (SniperService.needsSignIn && _signIn.value == null) {
                    requestSignIn("The sniper fires at 00:00 and your UMPoint session has expired. Sign in now.")
                }
                delay(3000)
            }
        }
    }

    fun refreshAll(force: Boolean = true) {
        refreshWeek(WeekType.THIS, force)
        refreshWeek(WeekType.NEXT, force)
        refreshBookings(force)
    }

    fun refreshWeek(week: WeekType, force: Boolean = true) {
        val state = weekState(week)
        if (state.value.refreshing) return
        if (!force && state.value.data != null &&
            System.currentTimeMillis() - (state.value.updatedAt ?: 0) < 60_000L
        ) return
        state.update { it.copy(refreshing = true, error = null) }
        viewModelScope.launch {
            try {
                val (grid, at) = repo.fetchWeek(week)
                state.value = WeekUiState(grid, at)
            } catch (e: Exception) {
                state.update { it.copy(refreshing = false, error = friendly(e)) }
                if (e is SignInRequired) requestSignIn()
            }
        }
    }

    fun refreshBookings(force: Boolean = true) {
        if (_bookings.value.refreshing) return
        if (!force && _bookings.value.data != null &&
            System.currentTimeMillis() - (_bookings.value.updatedAt ?: 0) < 60_000L
        ) return
        _bookings.update { it.copy(refreshing = true, error = null) }
        viewModelScope.launch {
            try {
                val (list, at) = repo.fetchBookings()
                _bookings.value = BookingsUiState(list, at)
            } catch (e: Exception) {
                _bookings.update { it.copy(refreshing = false, error = friendly(e)) }
                if (e is SignInRequired) requestSignIn()
            }
        }
    }

    suspend fun bookNow(req: SlotRequest): BookResult = if (demo) BookResult("failed", "Demo mode doesn’t book.", null) else try {
        val result = repo.bookNow(req)
        if (result.status == "signed_out") requestSignIn()
        if (result.status == "booked") refreshAll()
        result
    } catch (e: Exception) {
        BookResult("failed", friendly(e), null)
    }

    fun arm(req: SlotRequest): Task {
        if (demo) {
            val task = DemoData.tasks("armed", System.currentTimeMillis()).first()
            _tasks.value = listOf(task)
            _justArmed.value = task
            return task
        }
        val task = repo.arm(req)
        reloadTasks()
        _justArmed.value = task
        return task
    }

    fun dismissArmed() {
        _justArmed.value = null
    }

    fun acknowledgeResult(id: String) {
        if (demo) {
            _seenResults.value = _seenResults.value + id
            return
        }
        repo.markResultSeen(id)
        _seenResults.value = repo.seenResults()
    }

    fun cancelTask(id: String) {
        repo.cancel(id)
        reloadTasks()
    }

    fun removeTask(id: String) {
        repo.remove(id)
        reloadTasks()
    }

    fun reloadTasks() {
        if (demo) return
        _tasks.value = repo.tasks()
        _setup.value = repo.phoneSetup()
    }

    fun refreshSetup() {
        _setup.value = repo.phoneSetup()
    }

    fun updatePrefs(next: BookingPrefs) {
        _prefs.value = next
        repo.savePrefs(next)
    }

    fun requestSignIn(reason: String? = null) {
        _signIn.value = SignInRequest(reason)
    }

    fun dismissSignIn() {
        _signIn.value = null
        viewModelScope.launch {
            val state = repo.refreshSession()
            if (state == SessionState.SIGNED_IN) {
                repo.markSignedIn()
                refreshAll()
            }
        }
    }

    fun markSignedIn() {
        repo.markSignedIn()
        _signIn.value = null
        refreshAll()
        reloadTasks()
    }

    fun showDashboard() {
        _dashboard.value = true
    }

    fun hideDashboard() {
        _dashboard.value = false
        refreshBookings(force = true)
    }

    fun signOut() {
        viewModelScope.launch {
            repo.signOut()
            _bookings.value = BookingsUiState()
        }
    }

    fun openSettings(which: String) = repo.openSettings(which)

    fun readLog() {
        _log.value = repo.readLog().ifBlank { "Nothing logged yet." }
    }

    fun closeLog() {
        _log.value = null
    }

    fun toast(text: String, tone: ToastTone = ToastTone.PLAIN) {
        _events.tryEmit(UiEvent(text, tone))
    }

    fun onResume() {
        if (demo) return
        viewModelScope.launch {
            val state = repo.refreshSession()
            if (state == SessionState.SIGNED_IN) refreshAll(force = false)
            reloadTasks()
        }
    }

    private fun weekState(week: WeekType): MutableStateFlow<WeekUiState> =
        if (week == WeekType.THIS) _thisWeek else _nextWeek

    private fun friendly(e: Throwable): String = when (e) {
        is SignInRequired -> e.message ?: "Sign in to continue."
        is IOException -> "Could not reach UMPoint. Check your connection."
        else -> e.message ?: "Could not reach UMPoint."
    }
}
