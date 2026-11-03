package com.skylightlim.umpoint.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.skylightlim.umpoint.data.countdown
import com.skylightlim.umpoint.data.dayLabel
import com.skylightlim.umpoint.data.shortDay
import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.ui.components.MorphBadge
import com.skylightlim.umpoint.ui.components.RollingText
import com.skylightlim.umpoint.ui.components.ShuttleGlyph
import com.skylightlim.umpoint.ui.components.ShuttleState
import com.skylightlim.umpoint.ui.theme.LocalCourtColors
import kotlinx.coroutines.delay

/** Hero moment one: arming. A shape bursts up and morphs while the countdown starts rolling. */
@Composable
fun ArmedHero(task: Task, onDone: () -> Unit) {
    val cc = LocalCourtColors.current
    val colors = MaterialTheme.colorScheme
    val grow = remember { Animatable(0.2f) }
    var shape by remember { mutableStateOf(MaterialShapes.Circle) }
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    val spec = MaterialTheme.motionScheme.slowSpatialSpec<Float>()
    val cookie = MaterialShapes.Cookie9Sided
    val source = remember { MutableInteractionSource() }

    BackHandler(onBack = onDone)
    LaunchedEffect(Unit) {
        shape = cookie
        grow.animateTo(1f, spec)
    }
    LaunchedEffect(Unit) {
        val shownAt = System.currentTimeMillis()
        while (System.currentTimeMillis() - shownAt < 2_800) {
            now = System.currentTimeMillis()
            delay(200)
        }
        onDone()
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(colors.scrim.copy(alpha = 0.72f))
            .clickable(interactionSource = source, indication = null, onClick = onDone)
            .safeDrawingPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            MorphBadge(
                shape,
                cc.armed,
                240.dp,
                Modifier.graphicsLayer {
                    scaleX = grow.value
                    scaleY = grow.value
                },
            ) {
                ShuttleGlyph(ShuttleState.ARMED, cc.onArmed, 136.dp)
            }
            Surface(shape = MaterialTheme.shapes.extraLarge, color = cc.armedContainer) {
                Column(
                    Modifier.padding(horizontal = 28.dp, vertical = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Armed", style = MaterialTheme.typography.displaySmall, color = cc.onArmedContainer)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "${dayLabel(task.date)} · ${task.start}–${task.end} · Court ${task.court}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = cc.onArmedContainer,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(12.dp))
                    RollingText(
                        countdown(task.fireAt - now),
                        MaterialTheme.typography.titleLargeEmphasized.copy(fontFeatureSettings = "tnum"),
                        cc.onArmedContainer,
                    )
                    Text(
                        "until it fires, ${shortDay(task.fireAt)}, 00:00:00",
                        style = MaterialTheme.typography.bodySmall,
                        color = cc.onArmedContainer,
                    )
                }
            }
        }
    }
}

/** Hero moment two: the answer you wake up to, booked or not, with the reason. */
@Composable
fun ResultHero(task: Task, onDone: () -> Unit) {
    val cc = LocalCourtColors.current
    val colors = MaterialTheme.colorScheme
    val booked = task.status == "booked"
    val container = if (booked) cc.mineContainer else colors.errorContainer
    val content = if (booked) cc.onMineContainer else colors.onErrorContainer
    val badge = if (booked) cc.mine else colors.error
    val badgeInk = if (booked) colors.surface else colors.onError
    val grow = remember { Animatable(0.2f) }
    val spec = MaterialTheme.motionScheme.slowSpatialSpec<Float>()
    val haptics = LocalHapticFeedback.current
    var shape by remember { mutableStateOf(MaterialShapes.Circle) }
    val target = if (booked) MaterialShapes.SoftBurst else MaterialShapes.Slanted

    BackHandler(onBack = onDone)
    LaunchedEffect(task.id) {
        haptics.performHapticFeedback(if (booked) HapticFeedbackType.Confirm else HapticFeedbackType.Reject)
        shape = target
        grow.animateTo(1f, spec)
    }

    Surface(Modifier.fillMaxSize(), color = container) {
        Column(
            Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.weight(1f))
            MorphBadge(
                shape,
                badge,
                200.dp,
                Modifier.graphicsLayer {
                    scaleX = grow.value
                    scaleY = grow.value
                },
            ) {
                Icon(
                    if (booked) Icons.Rounded.Check else Icons.Rounded.Close,
                    contentDescription = null,
                    tint = badgeInk,
                    modifier = Modifier.size(88.dp),
                )
            }
            Spacer(Modifier.height(32.dp))
            Text(
                if (booked) "Booked" else "Not booked",
                style = MaterialTheme.typography.displayMedium,
                color = content,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                "${dayLabel(task.date)} · ${task.start}–${task.end}",
                style = MaterialTheme.typography.titleLargeEmphasized,
                color = content,
                textAlign = TextAlign.Center,
            )
            Text(
                if (booked) {
                    "Court ${task.bookedCourt ?: task.court}"
                } else {
                    task.message ?: "The sniper couldn’t get this slot."
                },
                style = MaterialTheme.typography.bodyLarge,
                color = content,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
            Spacer(Modifier.weight(1f))
            Button(
                onClick = onDone,
                shapes = ButtonDefaults.shapes(),
                // The page's own colours turned inside out, so nothing from the wallpaper clashes with it.
                colors = ButtonDefaults.buttonColors(containerColor = content, contentColor = container),
                modifier = Modifier.fillMaxWidth().height(ButtonDefaults.MediumContainerHeight),
            ) { Text("Done", style = MaterialTheme.typography.titleMedium) }
        }
    }
}
