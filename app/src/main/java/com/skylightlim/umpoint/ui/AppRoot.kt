package com.skylightlim.umpoint.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.PredictiveBackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.ToastTone
import com.skylightlim.umpoint.screens.ArmedHero
import com.skylightlim.umpoint.screens.BookingsScreen
import com.skylightlim.umpoint.screens.CourtsScreen
import com.skylightlim.umpoint.screens.ResultHero
import com.skylightlim.umpoint.screens.SettingsScreen
import com.skylightlim.umpoint.screens.SniperScreen
import com.skylightlim.umpoint.ui.components.DockItem
import com.skylightlim.umpoint.ui.components.FloatingDock
import com.skylightlim.umpoint.ui.components.LocalBottomClearance
import com.skylightlim.umpoint.ui.components.UmpointWebViewDialog
import com.skylightlim.umpoint.ui.components.WebViewMode
import com.skylightlim.umpoint.ui.theme.LocalCourtColors
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Room for the dock (76 dp tall) and the gaps around it, above the system navigation bar. */
private val DOCK_CLEARANCE = 112.dp

private enum class Tab(val label: String) {
    COURTS("Courts"),
    SNIPER("Sniper"),
    BOOKINGS("Bookings"),
}

private fun Tab.icon(selected: Boolean): ImageVector = when (this) {
    Tab.COURTS -> if (selected) Icons.Rounded.GridView else Icons.Outlined.GridView
    Tab.SNIPER -> if (selected) Icons.Rounded.MyLocation else Icons.Outlined.MyLocation
    Tab.BOOKINGS -> if (selected) Icons.Rounded.CalendarMonth else Icons.Outlined.CalendarMonth
}

/** Bounces a navigation icon up when it becomes the selected tab. */
@Composable
private fun TabIcon(tab: Tab, selected: Boolean) {
    val grow by animateFloatAsState(
        targetValue = if (selected) 1.18f else 1f,
        animationSpec = MaterialTheme.motionScheme.fastSpatialSpec(),
        label = "tab",
    )
    Icon(
        tab.icon(selected),
        contentDescription = null,
        modifier = Modifier.graphicsLayer {
            scaleX = grow
            scaleY = grow
        },
    )
}

@Composable
fun AppRoot(vm: AppViewModel) {
    var tabName by rememberSaveable { mutableStateOf(Tab.COURTS.name) }
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    val tab = Tab.valueOf(tabName)
    val session by vm.session.collectAsStateWithLifecycle()
    val signIn by vm.signIn.collectAsStateWithLifecycle()
    val dashboard by vm.dashboard.collectAsStateWithLifecycle()
    val justArmed by vm.justArmed.collectAsStateWithLifecycle()
    val dockHidden by vm.dockHidden.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val seen by vm.seenResults.collectAsStateWithLifecycle()
    val saved = rememberSaveableStateHolder()
    val motion = MaterialTheme.motionScheme

    val snackbar = remember { SnackbarHostState() }
    var snackTone by remember { mutableStateOf(ToastTone.PLAIN) }
    LaunchedEffect(Unit) {
        vm.events.collect { event ->
            snackTone = event.tone
            snackbar.showSnackbar(event.text, withDismissAction = true, duration = SnackbarDuration.Short)
        }
    }

    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        vm.refreshSetup()
    }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            permission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.onResume() }

    val haptics = LocalHapticFeedback.current
    val selectTab: (Tab) -> Unit = { next ->
        if (next != tab) {
            haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
            tabName = next.name
        }
    }
    val openSettings = { settingsOpen = true }

    val scope = rememberCoroutineScope()
    val backProgress = remember { Animatable(0f) }
    val backSpring = motion.defaultSpatialSpec<Float>()
    LaunchedEffect(settingsOpen) { if (settingsOpen) backProgress.snapTo(0f) }
    PredictiveBackHandler(enabled = settingsOpen) { events ->
        try {
            events.collect { backProgress.snapTo(it.progress) }
            settingsOpen = false
        } catch (e: CancellationException) {
            scope.launch { backProgress.animateTo(0f, backSpring) }
            throw e
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 600.dp
        val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            snackbarHost = {
                SnackbarHost(snackbar) { data ->
                    val colors = MaterialTheme.colorScheme
                    val cc = LocalCourtColors.current
                    val (container, content) = when (snackTone) {
                        ToastTone.PLAIN -> colors.inverseSurface to colors.inverseOnSurface
                        ToastTone.BOOKED -> cc.mineContainer to cc.onMineContainer
                        ToastTone.ARMED -> cc.armedContainer to cc.onArmedContainer
                        ToastTone.ERROR -> colors.errorContainer to colors.onErrorContainer
                    }
                    Snackbar(
                        snackbarData = data,
                        shape = MaterialTheme.shapes.large,
                        containerColor = container,
                        contentColor = content,
                    )
                }
            },
        ) { padding ->
            Row(Modifier.fillMaxSize().padding(padding)) {
                if (wide) {
                    NavigationRail(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                        Spacer(Modifier.height(12.dp))
                        Tab.entries.forEach { item ->
                            NavigationRailItem(
                                selected = tab == item,
                                onClick = { selectTab(item) },
                                icon = { TabIcon(item, tab == item) },
                                label = { Text(item.label) },
                            )
                        }
                    }
                }
                Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.widthIn(max = 900.dp).fillMaxHeight()) {
                        AnimatedContent(
                            targetState = tab,
                            transitionSpec = {
                                val forward = targetState.ordinal > initialState.ordinal
                                val spatial = motion.defaultSpatialSpec<IntOffset>()
                                val scale = motion.defaultSpatialSpec<Float>()
                                val fade = motion.defaultEffectsSpec<Float>()
                                (
                                    slideInHorizontally(spatial) { if (forward) it / 3 else -it / 3 } +
                                        scaleIn(scale, initialScale = 0.92f) + fadeIn(fade)
                                    ).togetherWith(
                                    slideOutHorizontally(spatial) { if (forward) -it / 3 else it / 3 } +
                                        scaleOut(scale, targetScale = 0.92f) + fadeOut(fade),
                                )
                            },
                            label = "tab",
                        ) { current ->
                            saved.SaveableStateProvider(current.name) {
                                val clearance = if (wide) 32.dp else DOCK_CLEARANCE + bottomInset
                                CompositionLocalProvider(LocalBottomClearance provides clearance) {
                                when (current) {
                                    Tab.COURTS -> CourtsScreen(vm = vm, session = session, onOpenSettings = openSettings)
                                    Tab.SNIPER -> SniperScreen(
                                        vm = vm,
                                        session = session,
                                        onPickSlot = { date ->
                                            vm.pickDate(date)
                                            selectTab(Tab.COURTS)
                                        },
                                        onOpenSettings = openSettings,
                                    )
                                    Tab.BOOKINGS -> BookingsScreen(vm = vm, session = session, onOpenSettings = openSettings)
                                }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!wide) {
            AnimatedVisibility(
                visible = !dockHidden && !settingsOpen,
                enter = slideInVertically(motion.defaultSpatialSpec<IntOffset>()) { it * 2 },
                exit = slideOutVertically(motion.defaultSpatialSpec<IntOffset>()) { it * 2 },
                modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 12.dp),
            ) {
                FloatingDock(
                    items = Tab.entries.map { item -> DockItem(item.label) { selected -> item.icon(selected) } },
                    selected = tab.ordinal,
                    onSelect = { selectTab(Tab.entries[it]) },
                )
            }
        }

        AnimatedVisibility(
            visible = settingsOpen,
            enter = slideInVertically(motion.defaultSpatialSpec<IntOffset>()) { it } + fadeIn(motion.fastEffectsSpec()),
            exit = slideOutVertically(motion.defaultSpatialSpec<IntOffset>()) { it } + fadeOut(motion.fastEffectsSpec()),
        ) {
            SettingsScreen(
                vm = vm,
                session = session,
                onBack = { settingsOpen = false },
                // The page shrinks and rounds under the back gesture, so it tracks the finger.
                modifier = Modifier
                    .graphicsLayer {
                        val scale = 1f - backProgress.value * 0.06f
                        scaleX = scale
                        scaleY = scale
                        shape = RoundedCornerShape(36.dp * backProgress.value)
                        clip = backProgress.value > 0f
                    },
            )
        }

        justArmed?.let { task ->
            ArmedHero(
                task = task,
                onDone = {
                    vm.dismissArmed()
                    settingsOpen = false
                    tabName = Tab.SNIPER.name
                },
            )
        }

        // A snipe's result takes the whole screen once, the first time the app opens after it.
        tasks.firstOrNull { it.id !in seen && !it.dryRun && it.status in setOf("booked", "failed", "missed") }
            ?.let { task -> ResultHero(task = task, onDone = { vm.acknowledgeResult(task.id) }) }
    }

    if (signIn != null) {
        UmpointWebViewDialog(
            mode = WebViewMode.SIGN_IN,
            reason = signIn?.reason,
            onClose = { vm.dismissSignIn() },
            onSignedIn = { vm.markSignedIn() },
        )
    }
    if (dashboard) {
        UmpointWebViewDialog(
            mode = WebViewMode.DASHBOARD,
            onClose = { vm.hideDashboard() },
            onSignedIn = {},
        )
    }
}
