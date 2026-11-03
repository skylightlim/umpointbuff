package com.skylightlim.umpoint.screens

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.BoundsTransform
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.SeekableTransitionState
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.EventBusy
import androidx.compose.material.icons.rounded.GpsFixed
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.coerceIn
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
import com.skylightlim.umpoint.data.openWeek
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
import com.skylightlim.umpoint.ui.components.RollingText
import com.skylightlim.umpoint.ui.components.ScreenFrame
import com.skylightlim.umpoint.ui.components.SegmentGap
import com.skylightlim.umpoint.ui.components.SegmentRow
import com.skylightlim.umpoint.ui.components.fadingEdges
import com.skylightlim.umpoint.ui.components.segmentShape
import com.skylightlim.umpoint.ui.theme.LocalCourtColors
import com.skylightlim.umpoint.ui.theme.pageSpring
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private const val DAY_MS = 86_400_000L

private val DURATIONS = listOf(
    1 to "30 min",
    2 to "1 hr",
    3 to "1½ hr",
    4 to "2 hr",
)

private val PASSED_WIDTH = 52.dp
private val WEEK_LABEL_WIDTH = 44.dp
private val STRIP_GAP = 6.dp
private val STRIP_PADDING = 16.dp

private val CHIP_SHAPE = RoundedCornerShape(22.dp)
private val CHIP_PRESSED_SHAPE = RoundedCornerShape(12.dp)
private val TIME_CARD_SHAPE = RoundedCornerShape(28.dp)

private fun hhmm(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

internal fun Task.live(): Boolean = status == "armed" || status == "running" || status == "ringing"

private data class DateChoice(val date: String, val week: WeekType, val bookable: Boolean)

/** What the floating action button at the bottom of Courts says and does right now. */
private data class SlotAction(
    /** "Arm · Court" or "Book Court", with [court] rolling in after it. No court yet asks for one. */
    val label: String,
    val court: String?,
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
            showPassed = showPassed,
            onShowPassed = { showPassed = it },
            onPick = { vm.pickDate(it) },
        )

        FlowRow(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                when {
                    !choice.bookable -> "${dayLabel(date)} · view only"
                    choice.week == WeekType.NEXT -> "${dayLabel(date)} · fires ${shortDay(rollover).substringBefore(" ")} 00:00"
                    else -> "${dayLabel(date)} · book now"
                },
                style = MaterialTheme.typography.titleSmallEmphasized,
            )
            Text(
                when {
                    state.refreshing -> "Updating…"
                    // With nothing to show, the empty state below already says what went wrong.
                    state.error != null && state.data == null -> ""
                    state.error != null -> "Couldn’t refresh: ${state.error}"
                    else -> ago(state.updatedAt, now)
                },
                style = MaterialTheme.typography.labelMedium,
                color = if (state.error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterVertically),
            )
        }

        Box(Modifier.weight(1f)) {
        RefreshBox(
            refreshing = state.refreshing,
            onRefresh = { vm.refreshAll() },
            modifier = Modifier.fillMaxSize(),
        ) {
            val scroll = rememberScrollState()
            Column(
                Modifier
                    .fillMaxSize()
                    .fadingEdges(scroll)
                    .verticalScroll(scroll)
                    .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = clearance),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // UMPoint can fail to draw a week while still working otherwise, so a snipe doesn't depend on seeing it.
                val standIn = state.data == null && state.error != null && choice.week == WeekType.NEXT && choice.bookable
                val data = state.data ?: if (standIn) remember(rollover) { openWeek(rollover) } else null
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
                        if (standIn) {
                            Note(
                                "UMPoint can’t show these courts right now, so every half hour is listed as open. You can still arm a snipe, but it only works if UMPoint is taking bookings at 00:00.",
                                NoteTone.WARN,
                            )
                        }
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
    val colors = MaterialTheme.colorScheme
    val motion = MaterialTheme.motionScheme
    val waiting = !action.enabled && !action.busy
    val fill by animateColorAsState(
        when {
            waiting -> colors.surfaceContainerHighest
            action.sniping -> cc.armed
            else -> colors.primary
        },
        motion.defaultEffectsSpec(),
        label = "actionFill",
    )
    val ink by animateColorAsState(
        when {
            waiting -> colors.onSurfaceVariant
            action.sniping -> cc.onArmed
            else -> colors.onPrimary
        },
        motion.defaultEffectsSpec(),
        label = "actionInk",
    )
    Button(
        onClick = action.onClick,
        enabled = action.enabled,
        shapes = ButtonDefaults.shapes(),
        colors = ButtonDefaults.buttonColors(
            containerColor = fill,
            contentColor = ink,
            disabledContainerColor = fill,
            disabledContentColor = ink,
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp),
        modifier = Modifier.fillMaxWidth().height(ButtonDefaults.MediumContainerHeight),
    ) {
        if (action.busy) {
            LoadingIndicator(Modifier.size(32.dp), color = ink)
        } else {
            AnimatedContent(
                targetState = action.court != null,
                transitionSpec = {
                    (slideInVertically(motion.fastSpatialSpec<IntOffset>()) { it } + fadeIn(motion.fastEffectsSpec()))
                        .togetherWith(slideOutVertically(motion.fastSpatialSpec<IntOffset>()) { -it } + fadeOut(motion.fastEffectsSpec()))
                },
                label = "actionLabel",
            ) { ready ->
                val style = MaterialTheme.typography.titleMediumEmphasized
                if (ready) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (action.sniping) {
                            Icon(Icons.Rounded.GpsFixed, contentDescription = null, modifier = Modifier.size(22.dp))
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("${action.label} ", style = style, maxLines = 1)
                        RollingText(action.court.orEmpty(), style, ink)
                    }
                } else {
                    Text("Choose a court", style = style, maxLines = 1)
                }
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
    showPassed: Boolean,
    onShowPassed: (Boolean) -> Unit,
    onPick: (String) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val list = rememberLazyListState()
    val thisWeekDays = visible.filter { it.week == WeekType.THIS }
    val nextWeekDays = visible.filter { it.week == WeekType.NEXT }
    val keys = buildList {
        add("passed")
        if (thisWeekDays.isNotEmpty()) add("This week")
        addAll(thisWeekDays.map { it.date })
        if (nextWeekDays.isNotEmpty()) add("Next week")
        addAll(nextWeekDays.map { it.date })
    }

    // Only scrolls when the selected day is out of sight, so the passed toggle stays in reach.
    LaunchedEffect(selected) {
        val index = keys.indexOf(selected)
        if (index < 0) return@LaunchedEffect
        val info = snapshotFlow { list.layoutInfo }.first { it.visibleItemsInfo.isNotEmpty() }
        val shown = info.visibleItemsInfo.firstOrNull { it.index == index }
        val inView = shown != null &&
            shown.offset >= info.viewportStartOffset &&
            shown.offset + shown.size <= info.viewportEndOffset
        if (!inView) list.animateScrollToItem((index - 1).coerceAtLeast(0))
    }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // Four days and the labels fill a phone's width, so Sunday night needs no scrolling.
        val tile = ((maxWidth - STRIP_PADDING * 2 - PASSED_WIDTH - WEEK_LABEL_WIDTH - STRIP_GAP * 5) / 4)
            .coerceIn(50.dp, 84.dp)
        LazyRow(
            state = list,
            contentPadding = PaddingValues(horizontal = STRIP_PADDING),
            horizontalArrangement = Arrangement.spacedBy(STRIP_GAP),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            item(key = "passed") {
                PassedToggle(
                    checked = showPassed,
                    onChecked = {
                        haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                        onShowPassed(it)
                    },
                )
            }
            fun group(label: String, days: List<DateChoice>) {
                if (days.isEmpty()) return
                item(key = label) { WeekLabel(label, Modifier.animateItem()) }
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
                            modifier = Modifier.animateItem().width(tile),
                        )
                    }
                }
            }
            group("This week", thisWeekDays)
            group("Next week", nextWeekDays)
        }
    }
}

/** Sits where the past is, at the start of the strip: passed days slide in right next to it. */
@Composable
private fun PassedToggle(checked: Boolean, onChecked: (Boolean) -> Unit) {
    val colors = MaterialTheme.colorScheme
    ToggleButton(
        checked = checked,
        onCheckedChange = onChecked,
        modifier = Modifier.width(PASSED_WIDTH).heightIn(min = 84.dp),
        contentPadding = PaddingValues(horizontal = 0.dp, vertical = 8.dp),
        colors = ToggleButtonDefaults.colors(
            containerColor = Color.Transparent,
            contentColor = colors.onSurfaceVariant,
            checkedContainerColor = colors.secondaryContainer,
            checkedContentColor = colors.onSecondaryContainer,
        ),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Rounded.History, contentDescription = null, modifier = Modifier.size(20.dp))
            Text("Passed", style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

@Composable
private fun WeekLabel(label: String, modifier: Modifier = Modifier) {
    Text(
        label.replace(" ", "\n"),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = modifier.widthIn(min = WEEK_LABEL_WIDTH),
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
        modifier = modifier.heightIn(min = 84.dp),
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
            when {
                armed -> StatusPill("Armed", cc.armedContainer, cc.onArmedContainer)
                mine -> StatusPill("Yours", cc.mineContainer, cc.onMineContainer)
                !day.bookable -> Text("View", style = MaterialTheme.typography.labelSmall, maxLines = 1)
            }
        }
    }
}

/** A word in its status colour, which stays readable on a selected tile. */
@Composable
private fun StatusPill(text: String, container: Color, ink: Color) {
    Surface(shape = CircleShape, color = container) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall,
            color = ink,
            maxLines = 1,
            modifier = Modifier.padding(horizontal = 6.dp),
        )
    }
}

/** What a time needs in order to travel between its chip and the card at the top of the court step. */
private class SlotMorph(val layout: SharedTransitionScope, val step: AnimatedVisibilityScope)

/** The chip grows into the card and back on a spring with a little give, like any control here. */
private val SLOT_BOUNDS = BoundsTransform { _, _ -> spring(dampingRatio = 0.78f, stiffness = 420f) }

@Composable
private fun Modifier.slotCard(start: String, morph: SlotMorph): Modifier = with(morph.layout) {
    val fade = MaterialTheme.motionScheme.fastEffectsSpec<Float>()
    sharedBounds(
        rememberSharedContentState("slot-$start"),
        morph.step,
        enter = fadeIn(fade),
        exit = fadeOut(fade),
        boundsTransform = SLOT_BOUNDS,
        clipInOverlayDuringTransition = OverlayClip(TIME_CARD_SHAPE),
    )
}

/** The start time itself flies across and grows, on top of the card changing around it. */
@Composable
private fun Modifier.slotStart(start: String, morph: SlotMorph): Modifier = with(morph.layout) {
    val fade = MaterialTheme.motionScheme.fastEffectsSpec<Float>()
    sharedBounds(
        rememberSharedContentState("slot-start-$start"),
        morph.step,
        enter = fadeIn(fade),
        exit = fadeOut(fade),
        boundsTransform = SLOT_BOUNDS,
        zIndexInOverlay = 1f,
    )
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
    val scope = rememberCoroutineScope()
    val choosingTime = time == null

    // Seekable, so the back gesture moves the card back towards its chip with the finger.
    val steps = remember { SeekableTransitionState(choosingTime) }
    LaunchedEffect(choosingTime) { steps.animateTo(choosingTime) }
    // The dock and the main action trade places the moment the step changes, not when it settles.
    // A view-only day has no main action, so the dock stays.
    LaunchedEffect(choosingTime, choice.bookable) { vm.setDockHidden(!choosingTime && choice.bookable) }
    DisposableEffect(vm) { onDispose { vm.setDockHidden(false) } }
    PredictiveBackHandler(enabled = !choosingTime) { gesture ->
        try {
            // A spring covers most of its distance early on. Squaring spreads that along the swipe.
            gesture.collect { steps.seekTo(it.progress * it.progress, targetState = true) }
            time = null
        } catch (e: CancellationException) {
            scope.launch {
                animate(steps.fraction, 0f, animationSpec = pageSpring()) { value, _ ->
                    launch { steps.seekTo(value.coerceIn(0f, 1f)) }
                }
                steps.snapTo(false)
            }
            throw e
        }
    }

    SharedTransitionLayout {
        val layout = this
        rememberTransition(steps, label = "step").AnimatedContent(
            transitionSpec = {
                (fadeIn(motion.fastEffectsSpec()) + scaleIn(pageSpring(), initialScale = 0.97f))
                    .togetherWith(fadeOut(motion.fastEffectsSpec()) + scaleOut(pageSpring(), targetScale = 0.97f))
                    .using(SizeTransform(clip = false) { _, _ -> pageSpring() })
            },
        ) { choosing ->
            val morph = SlotMorph(layout, this)
            if (choosing) {
                TimeStep(date = date, grid = grid, tasks = tasks, bookable = choice.bookable, morph = morph, onPick = { time = it })
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
                        current = !choosingTime,
                        morph = morph,
                        onChangeTime = { time = null },
                        onDone = { time = null },
                        onOpenSettings = onOpenSettings,
                        onAction = onAction,
                    )
                }
            }
        }
    }
}

private enum class TimeMark { OPEN, FULL, MINE, ARMED }

@Composable
private fun TimeStep(
    date: String,
    grid: WeekGrid,
    tasks: List<Task>,
    bookable: Boolean,
    morph: SlotMorph,
    onPick: (String) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Pick a time", style = MaterialTheme.typography.titleLargeEmphasized, modifier = Modifier.weight(1f))
            PipLegend()
        }
        grid.times.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { slot ->
                    val courts = CourtIds.ALL.map { grid.status(date, slot.start, it) }
                    val free = courts.count { it == SlotStatus.FREE }
                    val mine = courts.any { it == SlotStatus.MINE }
                    val armed = tasks.any {
                        it.live() && !it.dryRun && it.date == date && Umpoint.slotStarts(it.start, it.end).contains(slot.start)
                    }
                    TimeChip(
                        start = slot.start,
                        mark = when {
                            armed -> TimeMark.ARMED
                            mine -> TimeMark.MINE
                            free == 0 -> TimeMark.FULL
                            else -> TimeMark.OPEN
                        },
                        courts = courts,
                        enabled = free > 0 || mine || !bookable,
                        morph = morph,
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
    mark: TimeMark,
    courts: List<SlotStatus>,
    enabled: Boolean,
    morph: SlotMorph,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cc = LocalCourtColors.current
    val colors = MaterialTheme.colorScheme
    val (container, ink) = when (mark) {
        TimeMark.ARMED -> cc.armedContainer to cc.onArmedContainer
        TimeMark.MINE -> cc.mineContainer to cc.onMineContainer
        else -> colors.surfaceBright to colors.onSurface
    }
    val word = when (mark) {
        TimeMark.ARMED -> "Armed"
        TimeMark.MINE -> "Yours"
        TimeMark.FULL -> "Full"
        TimeMark.OPEN -> null
    }
    val spoken = word ?: "${courts.count { it == SlotStatus.FREE }} free"
    FilledTonalButton(
        onClick = onClick,
        enabled = enabled,
        shapes = ButtonDefaults.shapes(shape = CHIP_SHAPE, pressedShape = CHIP_PRESSED_SHAPE),
        // A full slot steps back from the grid, so the eye goes to what can still be booked.
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = container,
            contentColor = ink,
            disabledContainerColor = Color.Transparent,
            disabledContentColor = colors.onSurfaceVariant.copy(alpha = 0.6f),
        ),
        modifier = modifier.slotCard(start, morph).heightIn(min = 72.dp),
        contentPadding = PaddingValues(horizontal = 2.dp, vertical = 8.dp),
    ) {
        Column(
            Modifier.clearAndSetSemantics { contentDescription = "$start, $spoken" },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                start,
                style = MaterialTheme.typography.titleMediumEmphasized,
                maxLines = 1,
                modifier = Modifier.slotStart(start, morph),
            )
            if (word != null) {
                Text(word, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            } else {
                CourtPips(courts)
            }
        }
    }
}

/** One pip per court, in court order: filled when it can be booked, hollow when it can't. */
@Composable
private fun CourtPips(courts: List<SlotStatus>) {
    Row(
        Modifier.height(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        courts.forEach { Pip(it == SlotStatus.FREE) }
    }
}

@Composable
private fun Pip(free: Boolean) {
    val fill = LocalCourtColors.current.free
    val ring = MaterialTheme.colorScheme.outline
    Canvas(Modifier.size(7.dp)) {
        if (free) {
            drawCircle(fill)
        } else {
            val stroke = 1.2.dp.toPx()
            drawCircle(ring, radius = (size.minDimension - stroke) / 2f, style = Stroke(stroke))
        }
    }
}

@Composable
private fun PipLegend() {
    val label = MaterialTheme.typography.labelMedium
    val color = MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        Modifier.clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Pip(free = true)
        Text("free", style = label, color = color)
        Spacer(Modifier.width(4.dp))
        Pip(free = false)
        Text("taken", style = label, color = color)
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
    current: Boolean,
    morph: SlotMorph,
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
    val action = if (!bookable || !current) {
        null
    } else {
        SlotAction(
            label = if (sniping) "Arm · Court" else "Book Court",
            court = chosen,
            sniping = sniping,
            enabled = canAct,
            busy = busy,
            onClick = click,
        )
    }
    SideEffect { onAction(action) }
    DisposableEffect(vm) { onDispose { onAction(null) } }

    Column {
        // The time and its length are one decision, so they sit together.
        Surface(shape = TIME_CARD_SHAPE, color = colors.primaryContainer, modifier = Modifier.slotCard(start, morph)) {
            Row(
                Modifier.fillMaxWidth().padding(start = 24.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val style = MaterialTheme.typography.headlineMediumEmphasized
                Text(start, style = style, color = colors.onPrimaryContainer, maxLines = 1, modifier = Modifier.slotStart(start, morph))
                RollingText("–$end", style, colors.onPrimaryContainer)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onChangeTime, modifier = Modifier.heightIn(min = 48.dp), shapes = ButtonDefaults.shapes()) {
                    Text("Change", color = colors.onPrimaryContainer)
                }
            }
        }

        Spacer(Modifier.height(6.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween),
        ) {
            DURATIONS.forEachIndexed { index, (count, label) ->
                ToggleButton(
                    checked = length == count,
                    onCheckedChange = {
                        haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                        slots = count
                    },
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

        Spacer(Modifier.height(24.dp))
        Text(
            if (bookable) "Pick a court" else "Courts",
            style = MaterialTheme.typography.titleLargeEmphasized,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        Spacer(Modifier.height(12.dp))
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

        // What's wrong with this choice belongs right under it.
        Column(
            Modifier.fillMaxWidth().animateContentSize(MaterialTheme.motionScheme.defaultSpatialSpec()).padding(top = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            warning?.let { Note(it, NoteTone.WARN) }
            problem?.let { Note(it, NoteTone.ERROR) }
            if (sniping && armBlocker != null) {
                Note("${armBlocker.title}. ${armBlocker.text}", NoteTone.ERROR, actionLabel = armBlocker.action, onAction = armBlocker.fix)
            }
        }

        Spacer(Modifier.height(12.dp))
        val options = if (sniping) 2 else 1
        Column(verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
            if (sniping) {
                SegmentRow(
                    shape = segmentShape(0, options),
                    title = "Any court fallback",
                    subtitle = "If your court is taken at midnight, try the others one at a time.",
                    icon = Icons.Rounded.SwapHoriz,
                    trailing = {
                        Switch(
                            checked = anyCourt,
                            onCheckedChange = {
                                haptics.performHapticFeedback(if (it) HapticFeedbackType.ToggleOn else HapticFeedbackType.ToggleOff)
                                anyCourt = it
                            },
                        )
                    },
                )
            }
            SegmentRow(
                shape = segmentShape(options - 1, options),
                title = "As “${prefs.event}”",
                subtitle = "${prefs.pax} ${if (prefs.pax == 1) "player" else "players"}",
                icon = Icons.Rounded.Groups,
                chevron = true,
                onClick = onOpenSettings,
            )
        }
    }
}
