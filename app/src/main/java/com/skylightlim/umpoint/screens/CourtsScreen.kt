package com.skylightlim.umpoint.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.EventBusy
import androidx.compose.material.icons.rounded.GpsFixed
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.ContainedLoadingIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedToggleButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ToggleButton
import androidx.compose.material3.ToggleButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.ToastTone
import com.skylightlim.umpoint.data.BookingPrefs
import com.skylightlim.umpoint.data.CourtIds
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.data.SlotRequest
import com.skylightlim.umpoint.data.SlotStatus
import com.skylightlim.umpoint.data.WeekGrid
import com.skylightlim.umpoint.data.WeekType
import com.skylightlim.umpoint.data.ago
import com.skylightlim.umpoint.data.dateMs
import com.skylightlim.umpoint.data.dayLabel
import com.skylightlim.umpoint.data.nextRollover
import com.skylightlim.umpoint.data.shortDay
import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.ui.components.CourtMark
import com.skylightlim.umpoint.ui.components.CourtTile
import com.skylightlim.umpoint.ui.components.EmptyState
import com.skylightlim.umpoint.ui.components.LocalBottomClearance
import com.skylightlim.umpoint.ui.components.Note
import com.skylightlim.umpoint.ui.components.NoteTone
import com.skylightlim.umpoint.ui.components.RefreshBox
import com.skylightlim.umpoint.ui.components.ScreenFrame
import com.skylightlim.umpoint.ui.components.SegmentRow
import com.skylightlim.umpoint.ui.components.bounceIn
import com.skylightlim.umpoint.ui.theme.LocalCourtColors
import kotlinx.coroutines.launch

private const val DAY_MS = 86_400_000L

private val DURATIONS = listOf(
    1 to "30 min",
    2 to "1 hr",
    3 to "1½ hr",
    4 to "2 hr",
)

private fun hhmm(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

internal fun Task.live(): Boolean = status == "armed" || status == "running" || status == "ringing"

private data class DateChoice(val date: String, val week: WeekType, val bookable: Boolean)

/** What the floating action button at the bottom of Courts says and does right now. */
private data class SlotAction(
    val label: String,
    val sniping: Boolean,
    val enabled: Boolean,
    val busy: Boolean,
    val onClick: () -> Unit,
)

/**
 * Date, then time, then court. There is no week switch: this week's days and next week's sit in one
 * row, and the date decides whether the last button books now or arms the sniper.
 */
@Composable
fun CourtsScreen(
    vm: AppViewModel,
    session: SessionState,
    onOpenSettings: () -> Unit,
) {
    val thisWeek by vm.thisWeek.collectAsStateWithLifecycle()
    val nextWeek by vm.nextWeek.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val setup by vm.setup.collectAsStateWithLifecycle()
    val picked by vm.pickedDate.collectAsStateWithLifecycle()
    val now by vm.now.collectAsStateWithLifecycle()

    val today = Umpoint.mytDate(now)
    val rollover = nextRollover(now)
    val thisMonday = Umpoint.weekStart(now)
    val choices = (0..4).map {
        val d = Umpoint.mytDate(thisMonday + it * DAY_MS)
        DateChoice(d, WeekType.THIS, dateMs(d) >= dateMs(today) + DAY_MS)
    } + (0..4).map {
        val d = Umpoint.mytDate(rollover + it * DAY_MS)
        DateChoice(d, WeekType.NEXT, dateMs(d) >= rollover + DAY_MS)
    }

    var showPassed by rememberSaveable { mutableStateOf(false) }
    val visible = choices.filter { it.bookable || showPassed || it.date == picked }
    val choice = choices.firstOrNull { it.date == picked }?.takeIf { it in visible }
        ?: visible.firstOrNull { it.bookable } ?: choices.last()
    val state = if (choice.week == WeekType.THIS) thisWeek else nextWeek
    val date = choice.date

    val armedDays = tasks.filter { it.live() && !it.dryRun }.map { it.date }.toSet()
    fun mineOn(d: String) = (thisWeek.data?.anyMine(d) == true) || (nextWeek.data?.anyMine(d) == true)

    val ringing = tasks.any { it.status == "ringing" }
    val blocker = problems(vm, session, setup, ringing).firstOrNull { it.blocksArming }
    var action by remember { mutableStateOf<SlotAction?>(null) }
    var shownAction by remember { mutableStateOf<SlotAction?>(null) }
    action?.let { shownAction = it }
    val clearance = LocalBottomClearance.current

    ScreenFrame("Courts", session, onOpenSettings) {
        DateStrip(
            visible = visible,
            selected = date,
            today = today,
            armedDays = armedDays,
            mineOn = ::mineOn,
            onPick = { vm.pickDate(it) },
        )

        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 8.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    when {
                        !choice.bookable -> "${dayLabel(date)} · view only"
                        choice.week == WeekType.NEXT -> "${dayLabel(date)} · fires ${shortDay(rollover).substringBefore(" ")} 00:00"
                        else -> "${dayLabel(date)} · book now"
                    },
                    style = MaterialTheme.typography.titleSmallEmphasized,
                    maxLines = 1,
                )
                Text(
                    when {
                        state.refreshing -> "Updating…"
                        state.error != null -> "Couldn’t refresh: ${state.error}"
                        else -> ago(state.updatedAt, now)
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = if (state.error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
            OutlinedToggleButton(
                checked = showPassed,
                onCheckedChange = { showPassed = it },
            ) {
                Icon(Icons.Rounded.History, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Passed", maxLines = 1)
            }
        }

        Box(Modifier.weight(1f)) {
        RefreshBox(
            refreshing = state.refreshing,
            onRefresh = { vm.refreshAll() },
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = clearance),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                val data = state.data
                when {
                    visible.none { it.bookable } && !showPassed -> EmptyState(
                        icon = Icons.Rounded.EventBusy,
                        title = "Nothing to book right now",
                        text = "Courts are booked at least a day ahead.",
                    )
                    data == null && state.error != null -> EmptyState(
                        icon = Icons.Rounded.CloudOff,
                        title = "Can’t load courts",
                        text = state.error ?: "",
                        action = { Button(onClick = { vm.refreshAll() }, shapes = ButtonDefaults.shapes()) { Text("Try again") } },
                    )
                    data == null -> Box(Modifier.fillMaxWidth().padding(vertical = 64.dp), contentAlignment = Alignment.Center) {
                        LoadingIndicator(Modifier.size(64.dp))
                    }
                    else -> {
                        if (!choice.bookable) {
                            Note(
                                when {
                                    choice.week == WeekType.NEXT ->
                                        "Monday opens at 00:00 that same day, so it can’t be sniped. Pick Tuesday to Friday."
                                    date == today -> "Today can’t be booked anymore. Courts are booked at least a day ahead."
                                    else -> "This day has passed. You can still see its courts."
                                },
                                NoteTone.INFO,
                            )
                        }
                        SlotSteps(
                            vm = vm,
                            date = date,
                            choice = choice,
                            grid = data,
                            tasks = tasks,
                            prefs = prefs,
                            rollover = rollover,
                            armBlocker = blocker,
                            onOpenSettings = onOpenSettings,
                            onAction = { action = it },
                        )
                    }
                }
            }
        }

        FloatingAction(
            visible = action != null,
            action = shownAction,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
        )
        }
    }
}

@Composable
private fun FloatingAction(visible: Boolean, action: SlotAction?, modifier: Modifier = Modifier) {
    val motion = MaterialTheme.motionScheme
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(motion.defaultSpatialSpec<IntOffset>()) { it * 2 },
        exit = slideOutVertically(motion.defaultSpatialSpec<IntOffset>()) { it * 2 },
        modifier = modifier,
    ) {
        action?.let { SlotActionButton(it) }
    }
}

@Composable
private fun SlotActionButton(action: SlotAction) {
    val cc = LocalCourtColors.current
    Button(
        onClick = action.onClick,
        enabled = action.enabled,
        shapes = ButtonDefaults.shapes(),
        colors = if (action.sniping) {
            ButtonDefaults.buttonColors(containerColor = cc.armed, contentColor = cc.onArmed)
        } else {
            ButtonDefaults.buttonColors()
        },
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp),
        modifier = Modifier.fillMaxWidth().height(ButtonDefaults.MediumContainerHeight),
    ) {
        when {
            action.busy -> LoadingIndicator(Modifier.size(32.dp))
            else -> {
                if (action.sniping && action.enabled) {
                    Icon(Icons.Rounded.GpsFixed, contentDescription = null, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(8.dp))
                }
                Text(action.label, style = MaterialTheme.typography.titleMediumEmphasized, maxLines = 1)
            }
        }
    }
}


@Composable
private fun DateStrip(
    visible: List<DateChoice>,
    selected: String,
    today: String,
    armedDays: Set<String>,
    mineOn: (String) -> Boolean,
    onPick: (String) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val list = rememberLazyListState()
    val thisWeekDays = visible.filter { it.week == WeekType.THIS }
    val nextWeekDays = visible.filter { it.week == WeekType.NEXT }

    LaunchedEffect(selected) {
        val thisCount = if (thisWeekDays.isEmpty()) 0 else thisWeekDays.size + 1
        val index = thisWeekDays.indexOfFirst { it.date == selected }.takeIf { it >= 0 }?.plus(1)
            ?: nextWeekDays.indexOfFirst { it.date == selected }.takeIf { it >= 0 }?.plus(thisCount + 1)
        if (index != null) list.animateScrollToItem((index - 1).coerceAtLeast(0))
    }

    LazyRow(
        state = list,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        fun group(label: String, days: List<DateChoice>) {
            if (days.isEmpty()) return
            item(key = label) { WeekLabel(label) }
            days.forEach { day ->
                item(key = day.date) {
                    DateTile(
                        day = day,
                        selected = day.date == selected,
                        today = day.date == today,
                        armed = day.date in armedDays,
                        mine = mineOn(day.date),
                        onClick = {
                            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                            onPick(day.date)
                        },
                        modifier = Modifier.animateItem(),
                    )
                }
            }
        }
        group("This week", thisWeekDays)
        group("Next week", nextWeekDays)
    }
}

@Composable
private fun WeekLabel(label: String) {
    Text(
        label.replace(" ", "\n"),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(horizontal = 4.dp),
    )
}

@Composable
private fun DateTile(
    day: DateChoice,
    selected: Boolean,
    today: Boolean,
    armed: Boolean,
    mine: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cc = LocalCourtColors.current
    ToggleButton(
        checked = selected,
        onCheckedChange = { onClick() },
        modifier = modifier.width(68.dp).heightIn(min = 84.dp),
        contentPadding = PaddingValues(horizontal = 2.dp, vertical = 8.dp),
        colors = ToggleButtonDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceBright),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                if (today) "Today" else dayLabel(day.date).substringBefore(" "),
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
            )
            Text(
                dayLabel(day.date).split(" ")[1],
                style = MaterialTheme.typography.headlineSmallEmphasized,
                maxLines = 1,
            )
            Text(
                when {
                    armed -> "Armed"
                    mine -> "Yours"
                    !day.bookable -> "View"
                    else -> ""
                },
                style = MaterialTheme.typography.labelSmall,
                color = when {
                    selected -> androidx.compose.ui.graphics.Color.Unspecified
                    armed -> cc.armed
                    mine -> cc.mine
                    else -> androidx.compose.ui.graphics.Color.Unspecified
                },
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun SlotSteps(
    vm: AppViewModel,
    date: String,
    choice: DateChoice,
    grid: WeekGrid,
    tasks: List<Task>,
    prefs: BookingPrefs,
    rollover: Long,
    armBlocker: Problem?,
    onOpenSettings: () -> Unit,
    onAction: (SlotAction?) -> Unit,
) {
    var time by rememberSaveable(date) { mutableStateOf<String?>(null) }
    var lastTime by remember { mutableStateOf<String?>(null) }
    time?.let { lastTime = it }
    val motion = MaterialTheme.motionScheme

    BackHandler(enabled = time != null) { time = null }
    if (time == null) SideEffect { onAction(null) }

    AnimatedContent(
        targetState = time == null,
        transitionSpec = {
            (fadeIn(motion.defaultEffectsSpec()) + scaleIn(motion.defaultSpatialSpec(), initialScale = 0.9f))
                .togetherWith(fadeOut(motion.fastEffectsSpec()) + scaleOut(motion.defaultSpatialSpec(), targetScale = 0.9f))
                .using(SizeTransform(clip = false) { _, _ -> motion.defaultSpatialSpec() })
        },
        label = "step",
    ) { choosingTime ->
        if (choosingTime) {
            TimeStep(date = date, grid = grid, tasks = tasks, bookable = choice.bookable, onPick = { time = it })
        } else {
            lastTime?.let { start ->
                CourtStep(
                    vm = vm,
                    date = date,
                    start = start,
                    week = choice.week,
                    bookable = choice.bookable,
                    grid = grid,
                    tasks = tasks,
                    prefs = prefs,
                    rollover = rollover,
                    armBlocker = armBlocker,
                    onChangeTime = { time = null },
                    onDone = { time = null },
                    onOpenSettings = onOpenSettings,
                    onAction = onAction,
                )
            }
        }
    }
}

@Composable
private fun TimeStep(
    date: String,
    grid: WeekGrid,
    tasks: List<Task>,
    bookable: Boolean,
    onPick: (String) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Pick a time", style = MaterialTheme.typography.titleLargeEmphasized, modifier = Modifier.padding(horizontal = 4.dp))
        grid.times.chunked(4).forEachIndexed { rowIndex, row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEachIndexed { index, slot ->
                    val statuses = grid.courtStatus(date, slot.start).values
                    val free = statuses.count { it == SlotStatus.FREE }
                    val mine = statuses.any { it == SlotStatus.MINE }
                    val armed = tasks.any {
                        it.live() && !it.dryRun && it.date == date && Umpoint.slotStarts(it.start, it.end).contains(slot.start)
                    }
                    TimeChip(
                        start = slot.start,
                        detail = when {
                            armed -> "Armed"
                            mine -> "Yours"
                            free == 0 -> "Full"
                            else -> "$free free"
                        },
                        enabled = free > 0 || mine || !bookable,
                        order = rowIndex * 4 + index,
                        onClick = {
                            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                            onPick(slot.start)
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun TimeChip(
    start: String,
    detail: String,
    enabled: Boolean,
    order: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FilledTonalButton(
        onClick = onClick,
        enabled = enabled,
        shapes = ButtonDefaults.shapes(),
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = MaterialTheme.colorScheme.surfaceBright,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        modifier = modifier.heightIn(min = 72.dp).bounceIn(order),
        contentPadding = PaddingValues(horizontal = 2.dp, vertical = 8.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(start, style = MaterialTheme.typography.titleMediumEmphasized, maxLines = 1)
            Text(detail, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

@Composable
private fun CourtStep(
    vm: AppViewModel,
    date: String,
    start: String,
    week: WeekType,
    bookable: Boolean,
    grid: WeekGrid,
    tasks: List<Task>,
    prefs: BookingPrefs,
    rollover: Long,
    armBlocker: Problem?,
    onChangeTime: () -> Unit,
    onDone: () -> Unit,
    onOpenSettings: () -> Unit,
    onAction: (SlotAction?) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var slots by rememberSaveable { mutableIntStateOf(2) }
    var court by rememberSaveable(date, start) { mutableStateOf<String?>(null) }
    var anyCourt by rememberSaveable { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }

    fun fits(n: Int) = Umpoint.minutes(start) + n * 30 <= Umpoint.minutes(Umpoint.CLOSE)
    val length = if (fits(slots)) slots else DURATIONS.lastOrNull { fits(it.first) }?.first ?: 1
    val end = hhmm(Umpoint.minutes(start) + length * 30)
    val starts = (0 until length).map { hhmm(Umpoint.minutes(start) + it * 30) }

    fun mark(id: String): CourtMark {
        val all = starts.map { grid.status(date, it, id) }
        return when {
            all.all { it == SlotStatus.FREE } -> CourtMark.FREE
            all.any { it == SlotStatus.MINE } -> CourtMark.MINE
            all.all { it == SlotStatus.CLOSED } -> CourtMark.CLOSED
            all.any { it == SlotStatus.UNAVAILABLE } && all.none { it == SlotStatus.TAKEN } -> CourtMark.UNAVAILABLE
            else -> CourtMark.TAKEN
        }
    }

    val chosen = court?.takeIf { bookable && mark(it) == CourtMark.FREE }
    val sniping = week == WeekType.NEXT

    val mineDays = if (sniping) {
        tasks.filter { it.live() && !it.dryRun && grid.dates.contains(it.date) }.map { it.date }.distinct()
    } else {
        grid.dates.filter { grid.anyMine(it) }
    }
    val warning = when {
        !bookable -> null
        mineDays.contains(date) ->
            "You already have ${if (sniping) "a snipe armed" else "a session"} on ${dayLabel(date)}. Pusat Sukan allows one session a day."
        mineDays.size >= 2 ->
            "You already have two ${if (sniping) "snipes armed" else "bookings"} that week. Pusat Sukan allows two a week."
        else -> null
    }

    fun request(pick: String) = SlotRequest(
        date = date,
        start = start,
        end = end,
        court = pick,
        anyCourt = sniping && anyCourt,
        event = prefs.event,
        pax = prefs.pax,
        measure = sniping,
    )

    fun act(pick: String) {
        problem = null
        if (sniping) {
            runCatching { vm.arm(request(pick)) }
                .onSuccess {
                    haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    onDone()
                }
                .onFailure { problem = it.message ?: "Couldn’t arm the sniper." }
        } else {
            scope.launch {
                busy = true
                val result = vm.bookNow(request(pick))
                busy = false
                if (result.status == "booked") {
                    haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                    vm.toast(result.message.ifBlank { "Booked · ${dayLabel(date)} $start–$end, Court $pick" }, ToastTone.BOOKED)
                    onDone()
                } else {
                    haptics.performHapticFeedback(HapticFeedbackType.Reject)
                    problem = result.message
                }
            }
        }
    }

    val canAct = chosen != null && !busy && !(sniping && armBlocker != null)
    // A stable click handler, so an unchanged button doesn't count as a change and recompose for ever.
    val latestClick by rememberUpdatedState { chosen?.let(::act) }
    val click = remember { { latestClick(); Unit } }
    val current = if (!bookable) {
        null
    } else {
        SlotAction(
            label = when {
                chosen == null -> "Choose a court"
                sniping -> "Arm · Court $chosen"
                else -> "Book Court $chosen"
            },
            sniping = sniping,
            enabled = canAct,
            busy = busy,
            onClick = click,
        )
    }
    SideEffect { onAction(current) }
    DisposableEffect(vm) {
        vm.setDockHidden(true)
        onDispose {
            vm.setDockHidden(false)
            onAction(null)
        }
    }

    Column(Modifier.animateContentSize(MaterialTheme.motionScheme.defaultSpatialSpec()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Surface(shape = MaterialTheme.shapes.extraLarge, color = colors.primaryContainer) {
            Row(
                Modifier.fillMaxWidth().padding(start = 24.dp, end = 12.dp, top = 12.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "$start–$end",
                    style = MaterialTheme.typography.headlineMediumEmphasized,
                    color = colors.onPrimaryContainer,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                )
                TextButton(onClick = onChangeTime, modifier = Modifier.heightIn(min = 48.dp), shapes = ButtonDefaults.shapes()) {
                    Text("Change", color = colors.onPrimaryContainer)
                }
            }
        }

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween),
        ) {
            DURATIONS.forEachIndexed { index, (count, label) ->
                ToggleButton(
                    checked = length == count,
                    onCheckedChange = { slots = count },
                    enabled = fits(count),
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                    shapes = when (index) {
                        0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
                        DURATIONS.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
                        else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
                    },
                    contentPadding = PaddingValues(horizontal = 4.dp),
                    colors = ToggleButtonDefaults.colors(containerColor = colors.surfaceBright),
                ) { Text(label, maxLines = 1) }
            }
        }

        Text(
            if (bookable) "Pick a court" else "Courts",
            style = MaterialTheme.typography.titleLargeEmphasized,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CourtIds.ALL.forEach { id ->
                CourtTile(
                    court = id,
                    mark = mark(id),
                    selected = id == chosen,
                    onClick = {
                        if (bookable) {
                            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                            court = id
                        }
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (!bookable) return@Column

        if (sniping) {
            SegmentRow(
                shape = MaterialTheme.shapes.extraLarge,
                title = "Any court fallback",
                subtitle = "If your court is taken at midnight, try the others one at a time.",
                icon = Icons.Rounded.SwapHoriz,
                trailing = { Switch(checked = anyCourt, onCheckedChange = { anyCourt = it }) },
            )
        }

        warning?.let { Note(it, NoteTone.WARN) }
        problem?.let { Note(it, NoteTone.ERROR) }
        if (sniping && armBlocker != null) {
            Note("${armBlocker.title}. ${armBlocker.text}", NoteTone.ERROR, actionLabel = armBlocker.action, onAction = armBlocker.fix)
        }

        TextButton(
            onClick = onOpenSettings,
            shapes = ButtonDefaults.shapes(),
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) {
            Text(
                "As “${prefs.event}”, ${prefs.pax} ${if (prefs.pax == 1) "player" else "players"} · Change",
                maxLines = 2,
                textAlign = TextAlign.Center,
            )
        }
    }
}
