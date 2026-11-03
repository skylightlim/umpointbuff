package com.skylightlim.umpoint.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.data.countdown
import com.skylightlim.umpoint.data.dateMs
import com.skylightlim.umpoint.data.dayLabel
import com.skylightlim.umpoint.data.nextRollover
import com.skylightlim.umpoint.data.parseBooking
import com.skylightlim.umpoint.data.shortDay
import com.skylightlim.umpoint.data.weekOf
import com.skylightlim.umpoint.data.weekRange
import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.ui.components.LocalBottomClearance
import com.skylightlim.umpoint.ui.components.Note
import com.skylightlim.umpoint.ui.components.NoteTone
import com.skylightlim.umpoint.ui.components.ProblemCard
import com.skylightlim.umpoint.ui.components.RefreshBox
import com.skylightlim.umpoint.ui.components.RollingText
import com.skylightlim.umpoint.ui.components.ScreenFrame
import com.skylightlim.umpoint.ui.components.SectionLabel
import com.skylightlim.umpoint.ui.components.SegmentGap
import com.skylightlim.umpoint.ui.components.SegmentInner
import com.skylightlim.umpoint.ui.components.SegmentOuter
import com.skylightlim.umpoint.ui.components.SegmentRow
import com.skylightlim.umpoint.ui.components.ShuttleBadge
import com.skylightlim.umpoint.ui.components.ShuttleState
import com.skylightlim.umpoint.ui.components.bounceIn
import com.skylightlim.umpoint.ui.components.fadingEdges
import com.skylightlim.umpoint.ui.components.segmentShape
import com.skylightlim.umpoint.ui.components.springPress
import com.skylightlim.umpoint.ui.theme.LocalCourtColors
import java.time.Instant
import java.time.format.DateTimeFormatter

private const val DAY_MS = 86_400_000L
private val FIRE_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm:ss")

private enum class RuleSource(val label: String) {
    TERMS("Pusat Sukan’s terms"),
    PAGE("UMPoint’s booking page"),
    SEEN("Seen on the site"),
    NOTE("This app’s own limit"),
}

private data class Rule(val text: String, val source: RuleSource)

private val RULES = listOf(
    Rule("One court and one session a day.", RuleSource.TERMS),
    Rule("Two bookings a week, on different days, so at most two sessions.", RuleSource.TERMS),
    Rule("Book at least a day ahead. No same-day bookings.", RuleSource.PAGE),
    Rule("Next week opens Monday 00:00 MYT, which makes its Monday same-day: snipe Tuesday to Friday.", RuleSource.SEEN),
    Rule("Weekdays 09:00–19:00 in half-hour blocks. Weekends are closed.", RuleSource.SEEN),
    Rule("No longest session is stated anywhere. The app offers up to 2 hours.", RuleSource.NOTE),
    Rule("Pusat Sukan may cancel or change any booking.", RuleSource.TERMS),
)

private data class TaskLook(val label: String, val shuttle: ShuttleState)

private fun taskLook(status: String): TaskLook = when (status) {
    "armed" -> TaskLook("Armed", ShuttleState.ARMED)
    "running" -> TaskLook("Awake", ShuttleState.ARMED)
    "ringing" -> TaskLook("Sign in", ShuttleState.ARMED)
    "booked" -> TaskLook("Booked", ShuttleState.BOOKED)
    "dry_run" -> TaskLook("Dry run passed", ShuttleState.TEST)
    "missed" -> TaskLook("Missed", ShuttleState.LOST)
    "cancelled" -> TaskLook("Cancelled", ShuttleState.LOST)
    else -> TaskLook("Not booked", ShuttleState.LOST)
}

private data class Chamber(
    val key: String,
    val state: ShuttleState,
    val day: String,
    val time: String,
    val detail: String?,
    val status: String,
    val onClick: (() -> Unit)?,
)

@Composable
fun SniperScreen(
    vm: AppViewModel,
    session: SessionState,
    onPickSlot: (String) -> Unit,
    onOpenSettings: () -> Unit,
) {
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val bookings by vm.bookings.collectAsStateWithLifecycle()
    val setup by vm.setup.collectAsStateWithLifecycle()
    val now by vm.now.collectAsStateWithLifecycle()

    val rollover = nextRollover(now)
    val slots = bookings.data.orEmpty().mapNotNull(::parseBooking)
    val live = tasks.filter { it.live() }
    val finished = tasks.filterNot { it.live() }.sortedByDescending { it.updatedAt }
    val ringing = live.any { it.status == "ringing" }
    val running = live.any { it.status == "running" }

    var openTask by remember { mutableStateOf<Task?>(null) }
    var confirmCancel by remember { mutableStateOf<Task?>(null) }
    var historyOpen by rememberSaveable { mutableStateOf(false) }

    val chambers = buildList {
        fun inWeek(date: String) = weekOf(date) == rollover
        slots.filter { inWeek(it.date) }.sortedBy { dateMs(it.date) }.forEach { slot ->
            add(
                Chamber(
                    key = "b-${slot.date}-${slot.start}",
                    state = ShuttleState.BOOKED,
                    day = dayLabel(slot.date),
                    time = "${slot.start}–${slot.end}",
                    detail = slot.court?.let { "Court $it" },
                    status = "Booked",
                    onClick = null,
                ),
            )
        }
        tasks.filter { it.status == "booked" && inWeek(it.date) && slots.none { s -> s.date == it.date && s.start == it.start } }
            .forEach { task ->
                add(
                    Chamber(
                        key = "t-${task.id}",
                        state = ShuttleState.BOOKED,
                        day = dayLabel(task.date),
                        time = "${task.start}–${task.end}",
                        detail = "Court ${task.bookedCourt ?: task.court}",
                        status = "Booked",
                        onClick = { openTask = task },
                    ),
                )
            }
        live.filter { inWeek(it.date) }.sortedBy { dateMs(it.date) }.forEach { task ->
            add(
                Chamber(
                    key = "t-${task.id}",
                    state = if (task.dryRun) ShuttleState.TEST else ShuttleState.ARMED,
                    day = dayLabel(task.date),
                    time = "${task.start}–${task.end}",
                    detail = if (task.dryRun) "Books nothing" else "Court ${task.court}${if (task.anyCourt) " or any" else ""}",
                    status = if (task.dryRun) "Dry run" else taskLook(task.status).label,
                    onClick = { openTask = task },
                ),
            )
        }
        val counted = count { it.state != ShuttleState.TEST }
        repeat((2 - counted).coerceAtLeast(0)) { index ->
            add(
                Chamber(
                    key = "free-$index",
                    state = ShuttleState.EMPTY,
                    day = "Tue – Fri",
                    time = "Pick a slot",
                    detail = null,
                    status = "Empty",
                    onClick = { onPickSlot(Umpoint.mytDate(rollover + DAY_MS)) },
                ),
            )
        }
    }
    val issues = problems(vm, session, setup, ringing)

    ScreenFrame("Sniper", session, onOpenSettings) {
        val scroll = rememberScrollState()
        RefreshBox(
            refreshing = bookings.refreshing,
            onRefresh = {
                vm.refreshBookings()
                vm.reloadTasks()
                vm.refreshSetup()
            },
            modifier = Modifier.weight(1f),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .fadingEdges(scroll)
                    .verticalScroll(scroll)
                    .padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = LocalBottomClearance.current),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                if (issues.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        issues.forEachIndexed { index, issue ->
                            ProblemCard(issue.title, issue.text, issue.fix, Modifier.bounceIn(index))
                        }
                    }
                }

                CountdownHero(
                    rollover = rollover,
                    now = now,
                    running = running,
                    chambers = chambers,
                )

                RulesSection()

                if (finished.isNotEmpty()) {
                    HistorySection(
                        finished = finished,
                        open = historyOpen,
                        onToggle = { historyOpen = !historyOpen },
                        onOpen = { openTask = it },
                    )
                }
            }
        }
    }

    openTask?.let { current ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        val task = tasks.firstOrNull { it.id == current.id } ?: current
        ModalBottomSheet(onDismissRequest = { openTask = null }, sheetState = sheet) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp)) {
                TaskDetail(
                    task = task,
                    onCancel = { confirmCancel = task },
                    onRemove = {
                        vm.removeTask(task.id)
                        openTask = null
                    },
                )
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    confirmCancel?.let { cancelling ->
        AlertDialog(
            onDismissRequest = { confirmCancel = null },
            title = { Text("Cancel this snipe?") },
            text = { Text("${dayLabel(cancelling.date)} ${cancelling.start}–${cancelling.end}, Court ${cancelling.court}.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.cancelTask(cancelling.id)
                        confirmCancel = null
                        openTask = null
                        vm.toast("Snipe cancelled")
                    },
                ) { Text("Cancel snipe", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmCancel = null }) { Text("Keep snipe") }
            },
        )
    }
}

/**
 * The page's headline and next week's two slots, as one group of touching pieces. It turns amber as
 * soon as a snipe is armed, so the page's state reads from across the room.
 */
@Composable
private fun CountdownHero(
    rollover: Long,
    now: Long,
    running: Boolean,
    chambers: List<Chamber>,
) {
    val colors = MaterialTheme.colorScheme
    val cc = LocalCourtColors.current
    val effects = MaterialTheme.motionScheme.slowEffectsSpec<Color>()
    val armed = chambers.any { it.state == ShuttleState.ARMED }
    val fill by animateColorAsState(if (armed) cc.armedContainer else colors.primaryContainer, effects, label = "heroFill")
    val ink by animateColorAsState(if (armed) cc.onArmedContainer else colors.onPrimaryContainer, effects, label = "heroInk")
    val rows = chambers.chunked(2)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
        Surface(
            shape = RoundedCornerShape(topStart = SegmentOuter, topEnd = SegmentOuter, bottomStart = SegmentInner, bottomEnd = SegmentInner),
            color = fill,
            modifier = Modifier.fillMaxWidth().bounceIn(0),
        ) {
            Column(Modifier.padding(horizontal = 24.dp, vertical = 20.dp)) {
                Text(
                    when {
                        running -> "The sniper is awake"
                        armed -> "Armed. Fires in"
                        else -> "Next week opens in"
                    },
                    style = MaterialTheme.typography.titleMediumEmphasized,
                    color = ink,
                )
                Countdown(rollover - now, ink, Modifier.padding(vertical = 2.dp))
                Text(
                    when {
                        armed && !running -> "Wakes at 23:50 · fires ${shortDay(rollover)}, 00:00:00 MYT"
                        else -> "${weekRange(rollover)} · opens ${shortDay(rollover)}, 00:00:00 MYT"
                    },
                    style = MaterialTheme.typography.bodyMedium.copy(lineBreak = LineBreak.Heading),
                    color = ink,
                )
            }
        }
        rows.forEachIndexed { rowIndex, row ->
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                horizontalArrangement = Arrangement.spacedBy(SegmentGap),
            ) {
                row.forEachIndexed { index, chamber ->
                    val bottom = rowIndex == rows.lastIndex
                    ChamberCard(
                        chamber = chamber,
                        shape = RoundedCornerShape(
                            topStart = SegmentInner,
                            topEnd = SegmentInner,
                            bottomStart = if (bottom && index == 0) SegmentOuter else SegmentInner,
                            bottomEnd = if (bottom && index == row.lastIndex) SegmentOuter else SegmentInner,
                        ),
                        order = rowIndex * 2 + index + 1,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                    )
                }
            }
        }
    }
}

/** The digits are sized to exactly fill the width they're given, whatever the phone or text size. */
@Composable
private fun Countdown(ms: Long, ink: Color, modifier: Modifier = Modifier) {
    val parts = countdown(ms).split(" ")
    val days = parts.takeIf { it.size == 2 }?.first()?.removeSuffix("d")?.toIntOrNull()
    val minutes = ms.coerceAtLeast(0) / 60_000
    val spoken = "${minutes / 1440} days, ${minutes % 1440 / 60} hours, ${minutes % 60} minutes"
    val digits = MaterialTheme.typography.displayMedium
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val steady = remember(density) { Density(density.density, 1f) }
    BoxWithConstraints(modifier.fillMaxWidth().clearAndSetSemantics { contentDescription = spoken }) {
        val reference = remember(steady, digits) {
            measurer.measure("00:00:00", digits.copy(fontSize = 100.sp), density = steady).size.width
        }
        val size = (98f * constraints.maxWidth / reference).coerceAtMost(112f)
        CompositionLocalProvider(LocalDensity provides steady) {
            Column {
                if (days != null) {
                    Text(
                        if (days == 1) "1 day" else "$days days",
                        style = MaterialTheme.typography.displaySmall.copy(fontSize = (size * 0.42f).sp, lineHeight = (size * 0.6f).sp),
                        color = ink,
                    )
                }
                RollingText(parts.last(), digits.copy(fontSize = size.sp, lineHeight = (size * 1.14f).sp, letterSpacing = 0.sp), ink)
            }
        }
    }
}

@Composable
private fun ChamberCard(chamber: Chamber, shape: Shape, order: Int, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val cc = LocalCourtColors.current
    val source = remember { MutableInteractionSource() }
    val (container, ink) = when (chamber.state) {
        ShuttleState.ARMED -> cc.armedContainer to cc.onArmedContainer
        ShuttleState.BOOKED -> cc.mineContainer to cc.onMineContainer
        ShuttleState.LOST -> colors.errorContainer to colors.onErrorContainer
        else -> colors.surfaceBright to colors.onSurface
    }
    val description = listOfNotNull(chamber.status, chamber.day, chamber.time, chamber.detail).joinToString(", ")
    Surface(
        modifier = modifier
            .bounceIn(order)
            .springPress(source)
            .semantics { contentDescription = description }
            .then(
                if (chamber.onClick != null) {
                    Modifier.clickable(interactionSource = source, indication = null, role = Role.Button) { chamber.onClick.invoke() }
                } else {
                    Modifier
                },
            ),
        shape = shape,
        color = container,
    ) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                ShuttleBadge(chamber.state, 52.dp)
                Spacer(Modifier.weight(1f))
                if (chamber.state == ShuttleState.EMPTY) {
                    Icon(Icons.Rounded.Add, contentDescription = null, tint = colors.onSurfaceVariant)
                } else {
                    Text(chamber.status, style = MaterialTheme.typography.labelLargeEmphasized, color = ink, maxLines = 1)
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(chamber.day, style = MaterialTheme.typography.bodyMedium, color = ink, maxLines = 1)
            Text(
                chamber.time,
                style = MaterialTheme.typography.titleMediumEmphasized,
                color = ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            chamber.detail?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Grouped by where each rule comes from, so its source needs no decoding. */
@Composable
private fun RulesSection() {
    val colors = MaterialTheme.colorScheme
    val sources = RuleSource.entries
    Column {
        SectionLabel("Booking rules")
        Column(verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
            sources.forEachIndexed { index, source ->
                Surface(shape = segmentShape(index, sources.size), color = colors.surfaceBright, modifier = Modifier.fillMaxWidth()) {
                    Column(
                        Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(source.label, style = MaterialTheme.typography.labelLargeEmphasized, color = colors.onSurfaceVariant)
                        RULES.filter { it.source == source }.forEach { rule ->
                            Text(rule.text, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistorySection(
    finished: List<Task>,
    open: Boolean,
    onToggle: () -> Unit,
    onOpen: (Task) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val motion = MaterialTheme.motionScheme
    val turn by animateFloatAsState(if (open) 180f else 0f, motion.defaultSpatialSpec(), label = "turn")
    val count = if (open) finished.size + 1 else 1
    Column(
        Modifier.fillMaxWidth().animateContentSize(motion.defaultSpatialSpec()),
        verticalArrangement = Arrangement.spacedBy(SegmentGap),
    ) {
        Surface(shape = segmentShape(0, count), color = colors.surfaceBright) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clickable(role = Role.Button, onClick = onToggle)
                    .padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Snipe history · ${finished.size}", style = MaterialTheme.typography.titleMediumEmphasized, modifier = Modifier.weight(1f))
                Icon(
                    Icons.Rounded.ExpandMore,
                    contentDescription = if (open) "Hide history" else "Show history",
                    modifier = Modifier.graphicsLayer { rotationZ = turn },
                )
            }
        }
        if (open) {
            finished.forEachIndexed { index, task ->
                val look = taskLook(task.status)
                SegmentRow(
                    shape = segmentShape(index + 1, count),
                    title = "${dayLabel(task.date)} · ${task.start}–${task.end}",
                    subtitle = "${if (task.dryRun) "Dry run" else "Court ${task.bookedCourt ?: task.court}"} · ${look.label}",
                    leading = { ShuttleBadge(if (task.dryRun) ShuttleState.TEST else look.shuttle, 52.dp) },
                    chevron = true,
                    onClick = { onOpen(task) },
                    modifier = Modifier.bounceIn(index),
                )
            }
        }
    }
}

@Composable
private fun TaskDetail(task: Task, onCancel: () -> Unit, onRemove: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val look = taskLook(task.status)
    val liveNow = task.live()
    Column {
        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ShuttleBadge(if (task.dryRun) ShuttleState.TEST else look.shuttle, 72.dp)
            Column(Modifier.weight(1f)) {
                Text(look.label, style = MaterialTheme.typography.labelLargeEmphasized, color = colors.onSurfaceVariant)
                Text("${task.start}–${task.end}", style = MaterialTheme.typography.headlineSmallEmphasized, maxLines = 1)
                Text(dayLabel(task.date), style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            }
        }
        Surface(
            shape = MaterialTheme.shapes.large,
            color = colors.surfaceContainerHigh,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
        ) {
            Column {
                Field(
                    "Court",
                    if (task.bookedCourt != null) {
                        "Court ${task.bookedCourt}"
                    } else {
                        "Court ${task.court}${if (task.anyCourt) ", or any free court" else ""}"
                    },
                )
                HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = colors.outlineVariant)
                Field(
                    if (liveNow) "Fires at" else "Fired at",
                    "${shortDay(task.fireAt)}, ${Instant.ofEpochMilli(task.fireAt).atZone(Umpoint.MYT).format(FIRE_TIME)} MYT",
                )
                HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = colors.outlineVariant)
                Field("Booked as", "${task.event}, ${task.pax} ${if (task.pax == 1) "player" else "players"}")
            }
        }
        task.message?.let {
            Note(
                it,
                if (task.status == "failed" || task.status == "missed") NoteTone.ERROR else NoteTone.INFO,
                Modifier.padding(top = 12.dp),
            )
        }
        when {
            task.status == "armed" -> Button(
                onClick = onCancel,
                shapes = ButtonDefaults.shapes(),
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp).height(ButtonDefaults.MediumContainerHeight),
                colors = ButtonDefaults.buttonColors(containerColor = colors.errorContainer, contentColor = colors.onErrorContainer),
            ) { Text("Cancel snipe", style = MaterialTheme.typography.titleMedium) }
            !liveNow -> Button(
                onClick = onRemove,
                shapes = ButtonDefaults.shapes(),
                modifier = Modifier.fillMaxWidth().padding(top = 20.dp).height(ButtonDefaults.MediumContainerHeight),
            ) { Text("Remove from history", style = MaterialTheme.typography.titleMedium) }
            else -> Text(
                "The sniper is awake right now.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            )
        }
    }
}

@Composable
private fun Field(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(88.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}
