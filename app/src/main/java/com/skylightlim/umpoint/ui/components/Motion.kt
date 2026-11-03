package com.skylightlim.umpoint.ui.components

import android.graphics.Matrix
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.graphics.shapes.Morph
import androidx.graphics.shapes.RoundedPolygon
import androidx.graphics.shapes.toPath
import com.skylightlim.umpoint.ui.theme.pageSpring
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Sinks on touch-down and springs back past its size on release. */
@Composable
fun Modifier.springPress(source: InteractionSource, pressed: Float = 0.92f): Modifier {
    val isPressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) pressed else 1f,
        animationSpec = MaterialTheme.motionScheme.fastSpatialSpec(),
        label = "press",
    )
    return graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}

/**
 * Eases in from a little smaller the first time it appears. It's saved with the screen, so going
 * back to a tab doesn't replay it across the whole page.
 */
@Composable
fun Modifier.bounceIn(order: Int = 0): Modifier {
    val spec = pageSpring<Float>()
    val fade = MaterialTheme.motionScheme.defaultEffectsSpec<Float>()
    var shown by rememberSaveable { mutableStateOf(false) }
    val scale = remember { Animatable(if (shown) 1f else 0.97f) }
    val alpha = remember { Animatable(if (shown) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (shown) return@LaunchedEffect
        delay(order.coerceAtMost(8) * 16L)
        launch { alpha.animateTo(1f, fade) }
        scale.animateTo(1f, spec)
        shown = true
    }
    return graphicsLayer {
        scaleX = scale.value
        scaleY = scale.value
        this.alpha = alpha.value
    }
}

private val TOP_FADE = 20.dp
private val BOTTOM_FADE = 56.dp

/**
 * Scrolling content dissolves where it meets the chrome floating over it, instead of running under
 * it with a hard edge. The top only fades once something has actually scrolled away behind it, and
 * the bottom fades out over [bottom], the space the dock or main action needs.
 */
@Composable
fun Modifier.fadingEdges(state: ScrollableState, bottom: Dp = LocalBottomClearance.current): Modifier {
    val top by animateFloatAsState(
        targetValue = if (state.canScrollBackward) 1f else 0f,
        animationSpec = MaterialTheme.motionScheme.fastEffectsSpec(),
        label = "edge",
    )
    return graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
        .drawWithContent {
            drawContent()
            val topFade = TOP_FADE.toPx()
            if (top > 0f) {
                drawRect(
                    Brush.verticalGradient(0f to Color.Black.copy(alpha = 1f - top), 1f to Color.Black, endY = topFade),
                    size = Size(size.width, topFade),
                    blendMode = BlendMode.DstIn,
                )
            }
            if (bottom > 0.dp) {
                val start = size.height - bottom.toPx()
                drawRect(
                    Brush.verticalGradient(
                        0f to Color.Black,
                        1f to Color.Transparent,
                        startY = start,
                        endY = start + minOf(BOTTOM_FADE.toPx(), bottom.toPx()),
                    ),
                    topLeft = Offset(0f, start),
                    size = Size(size.width, bottom.toPx()),
                    blendMode = BlendMode.DstIn,
                )
            }
        }
}

private val SIDE_FADE = 40.dp

/** A sideways strip fades out at whichever end has more to scroll to, so a tile at the edge reads as "more this way", not cut off. */
@Composable
fun Modifier.fadingSides(state: ScrollableState): Modifier {
    val effects = MaterialTheme.motionScheme.fastEffectsSpec<Float>()
    val start by animateFloatAsState(if (state.canScrollBackward) 1f else 0f, effects, label = "start")
    val end by animateFloatAsState(if (state.canScrollForward) 1f else 0f, effects, label = "end")
    return graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
        .drawWithContent {
            drawContent()
            val fade = SIDE_FADE.toPx()
            if (start > 0f) {
                drawRect(
                    Brush.horizontalGradient(0f to Color.Black.copy(alpha = 1f - start), 1f to Color.Black, endX = fade),
                    size = Size(fade, size.height),
                    blendMode = BlendMode.DstIn,
                )
            }
            if (end > 0f) {
                drawRect(
                    Brush.horizontalGradient(
                        0f to Color.Black,
                        1f to Color.Black.copy(alpha = 1f - end),
                        startX = size.width - fade,
                        endX = size.width,
                    ),
                    topLeft = Offset(size.width - fade, 0f),
                    size = Size(fade, size.height),
                    blendMode = BlendMode.DstIn,
                )
            }
        }
}

/** A shape partway through a morph between two Material polygons. */
private class MorphShape(private val morph: Morph, private val progress: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val path = morph.toPath(progress)
        path.transform(Matrix().apply { setScale(size.width, size.height) })
        return Outline.Generic(path.asComposePath())
    }
}

/** A filled Material shape that springs from one polygon to the next when [polygon] changes. */
@Composable
fun MorphBadge(
    polygon: RoundedPolygon,
    color: Color,
    size: Dp,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val spec = MaterialTheme.motionScheme.slowSpatialSpec<Float>()
    var from by remember { mutableStateOf(polygon) }
    var to by remember { mutableStateOf(polygon) }
    val progress = remember { Animatable(1f) }
    LaunchedEffect(polygon) {
        if (polygon !== to) {
            from = to
            to = polygon
            progress.snapTo(0f)
            progress.animateTo(1f, spec)
        }
    }
    val morph = remember(from, to) { Morph(from, to) }
    Box(
        modifier
            .size(size)
            .clip(MorphShape(morph, progress.value))
            .background(color),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/**
 * Text whose changing characters roll into place on a spring, for live numbers. A digit changes every
 * second and can be very large, so it settles with a small overshoot rather than the usual big one.
 */
@Composable
fun RollingText(text: String, style: TextStyle, color: Color, modifier: Modifier = Modifier) {
    val motion = MaterialTheme.motionScheme
    // Clipped to its line like an odometer, so a digit never flies over what's above or below it.
    Row(modifier.clipToBounds(), verticalAlignment = Alignment.CenterVertically) {
        text.forEachIndexed { index, char ->
            androidx.compose.runtime.key(text.length - index) {
                AnimatedContent(
                    targetState = char,
                    transitionSpec = {
                        val roll = spring<IntOffset>(dampingRatio = 0.68f, stiffness = 900f)
                        (slideInVertically(roll) { it } + fadeIn(motion.fastEffectsSpec()))
                            .togetherWith(slideOutVertically(roll) { -it } + fadeOut(motion.fastEffectsSpec()))
                            .using(SizeTransform(clip = true) { _, _ -> spring<IntSize>(dampingRatio = 1f, stiffness = 900f) })
                    },
                    label = "digit",
                ) { current ->
                    Text(current.toString(), style = style, color = color, softWrap = false, maxLines = 1)
                }
            }
        }
    }
}
