package com.skylightlim.umpoint.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Error
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumFlexibleTopAppBar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.graphics.shapes.RoundedPolygon
import androidx.compose.material3.MaterialShapes
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.ui.theme.LocalCourtColors

/** A top-level screen: a flexible app bar that collapses as the content scrolls, and the avatar. */
@Composable
fun ScreenFrame(
    title: String,
    session: SessionState,
    onAccount: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Column(Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection)) {
        MediumFlexibleTopAppBar(
            title = { Text(title) },
            actions = { AccountButton(session, onAccount) },
            scrollBehavior = scroll,
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surface,
                scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
        )
        content()
    }
}

@Composable
private fun AccountButton(session: SessionState, onClick: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val description = when (session) {
        SessionState.SIGNED_IN -> "Settings, signed in"
        SessionState.SIGNED_OUT -> "Settings, not signed in"
        SessionState.OFFLINE -> "Settings, offline"
        SessionState.UNKNOWN -> "Settings"
    }
    IconButton(
        onClick = onClick,
        interactionSource = source,
        modifier = Modifier.springPress(source, pressed = 0.8f),
    ) {
        BadgedBox(
            badge = {
                if (session == SessionState.SIGNED_OUT) {
                    Badge(containerColor = MaterialTheme.colorScheme.error)
                }
            },
        ) {
            Icon(Icons.Rounded.AccountCircle, contentDescription = description, modifier = Modifier.size(32.dp))
        }
    }
}

enum class NoteTone { INFO, WARN, ERROR }

@Composable
fun Note(
    text: String,
    tone: NoteTone,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = MaterialTheme.colorScheme
    val (container, content, icon) = when (tone) {
        NoteTone.INFO -> Triple(colors.surfaceContainerHigh, colors.onSurfaceVariant, Icons.Rounded.Info)
        NoteTone.WARN -> Triple(colors.tertiaryContainer, colors.onTertiaryContainer, Icons.Rounded.Warning)
        NoteTone.ERROR -> Triple(colors.errorContainer, colors.onErrorContainer, Icons.Rounded.Error)
    }
    Surface(modifier = modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large, color = container) {
        Row(
            Modifier.padding(start = 16.dp, end = if (actionLabel != null) 8.dp else 16.dp, top = 8.dp, bottom = 8.dp)
                .heightIn(min = 40.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(20.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium, color = content, modifier = Modifier.weight(1f))
            if (actionLabel != null && onAction != null) {
                FilledTonalButton(onClick = onAction) { Text(actionLabel, maxLines = 1) }
            }
        }
    }
}

@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    text: String,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        MorphBadge(MaterialShapes.Cookie9Sided, MaterialTheme.colorScheme.surfaceContainerHigh, 96.dp) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(36.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(20.dp))
            action()
        }
    }
}

enum class CourtMark { FREE, MINE, ARMED, TAKEN, CLOSED, UNAVAILABLE }

/** One court: a drawn court and a word for its state, selectable only when free. */
@Composable
fun CourtTile(
    court: String,
    mark: CourtMark,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cc = LocalCourtColors.current
    val colors = MaterialTheme.colorScheme
    val motion = MaterialTheme.motionScheme
    val source = remember { MutableInteractionSource() }
    val (container, content) = when {
        selected -> cc.free to colors.surface
        mark == CourtMark.FREE -> cc.freeContainer to cc.onFreeContainer
        mark == CourtMark.MINE -> cc.mineContainer to cc.onMineContainer
        mark == CourtMark.ARMED -> cc.armedContainer to cc.onArmedContainer
        else -> colors.surfaceContainerHigh to colors.onSurfaceVariant
    }
    val fill by animateColorAsState(container, motion.fastEffectsSpec(), label = "fill")
    val ink by animateColorAsState(content, motion.fastEffectsSpec(), label = "ink")
    val corner by animateDpAsState(if (selected) 44.dp else 20.dp, motion.fastSpatialSpec(), label = "corner")
    val grow by animateFloatAsState(if (selected) 1.05f else 1f, motion.defaultSpatialSpec(), label = "grow")
    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = grow
                scaleY = grow
            }
            .springPress(source)
            .heightIn(min = 112.dp)
            .selectable(
                selected = selected,
                enabled = mark == CourtMark.FREE,
                role = Role.RadioButton,
                interactionSource = source,
                indication = null,
                onClick = onClick,
            ),
        shape = RoundedCornerShape(corner),
        color = fill,
    ) {
        Column(
            Modifier.padding(horizontal = 6.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            MiniCourt(ink)
            Text("Court $court", style = MaterialTheme.typography.labelLargeEmphasized, color = ink, maxLines = 1)
            Text(
                when (mark) {
                    CourtMark.FREE -> if (selected) "Chosen" else "Free"
                    CourtMark.MINE -> "Yours"
                    CourtMark.ARMED -> "Armed"
                    CourtMark.TAKEN -> "Taken"
                    CourtMark.CLOSED -> "Closed"
                    CourtMark.UNAVAILABLE -> "Unknown"
                },
                style = MaterialTheme.typography.labelMedium,
                color = ink,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun MiniCourt(color: Color) {
    Canvas(Modifier.width(42.dp).height(26.dp)) {
        val stroke = Stroke(width = 1.6.dp.toPx())
        drawRoundRect(
            color = color,
            topLeft = Offset(1.dp.toPx(), 1.dp.toPx()),
            size = Size(size.width - 2.dp.toPx(), size.height - 2.dp.toPx()),
            cornerRadius = CornerRadius(3.dp.toPx()),
            style = stroke,
        )
        drawLine(color, Offset(size.width / 2f, 2.dp.toPx()), Offset(size.width / 2f, size.height - 2.dp.toPx()), 1.2.dp.toPx())
        val inset = size.width * 0.16f
        drawLine(color.copy(alpha = 0.6f), Offset(inset, 2.dp.toPx()), Offset(inset, size.height - 2.dp.toPx()), 1.dp.toPx())
        drawLine(
            color.copy(alpha = 0.6f),
            Offset(size.width - inset, 2.dp.toPx()),
            Offset(size.width - inset, size.height - 2.dp.toPx()),
            1.dp.toPx(),
        )
    }
}

enum class ShuttleState { EMPTY, ARMED, BOOKED, LOST, TEST }

/** The Material shape each state of a shuttle sits in; the change between them is a morph. */
fun ShuttleState.polygon(): RoundedPolygon = when (this) {
    ShuttleState.EMPTY -> MaterialShapes.Circle
    ShuttleState.ARMED -> MaterialShapes.Cookie9Sided
    ShuttleState.BOOKED -> MaterialShapes.SoftBurst
    ShuttleState.LOST -> MaterialShapes.Slanted
    ShuttleState.TEST -> MaterialShapes.Pill
}

/** The app's mark: a drawn shuttlecock, dashed while its slot is still empty. */
@Composable
fun ShuttleGlyph(state: ShuttleState, ink: Color, size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val cork = Offset(w / 2f, h * 0.68f)
        if (state == ShuttleState.EMPTY) {
            val dash = PathEffect.dashPathEffect(floatArrayOf(w * 0.09f, w * 0.07f))
            val line = w * 0.05f
            drawCircle(ink, radius = w * 0.16f, center = Offset(w / 2f, h * 0.82f), style = Stroke(width = line, pathEffect = dash))
            drawLine(ink, cork, Offset(w / 2f, h * 0.04f), strokeWidth = line, cap = StrokeCap.Round, pathEffect = dash)
            drawLine(ink, cork, Offset(w * 0.18f, h * 0.14f), strokeWidth = line, cap = StrokeCap.Round, pathEffect = dash)
            drawLine(ink, cork, Offset(w * 0.82f, h * 0.14f), strokeWidth = line, cap = StrokeCap.Round, pathEffect = dash)
            drawLine(ink, Offset(w * 0.3f, h * 0.6f), Offset(w * 0.7f, h * 0.6f), strokeWidth = line, cap = StrokeCap.Round, pathEffect = dash)
        } else {
            drawCircle(ink, radius = w * 0.16f, center = Offset(w / 2f, h * 0.82f))
            drawLine(ink, cork, Offset(w / 2f, h * 0.04f), strokeWidth = w * 0.09f, cap = StrokeCap.Round)
            drawLine(ink, cork, Offset(w * 0.18f, h * 0.14f), strokeWidth = w * 0.07f, cap = StrokeCap.Round)
            drawLine(ink, cork, Offset(w * 0.82f, h * 0.14f), strokeWidth = w * 0.07f, cap = StrokeCap.Round)
            drawLine(ink, Offset(w * 0.3f, h * 0.6f), Offset(w * 0.7f, h * 0.6f), strokeWidth = w * 0.06f, cap = StrokeCap.Round)
        }
    }
}

/** The filled shape and ink a shuttle state uses. */
@Composable
fun shuttleColors(state: ShuttleState): Pair<Color, Color> {
    val colors = MaterialTheme.colorScheme
    val cc = LocalCourtColors.current
    return when (state) {
        ShuttleState.EMPTY -> colors.surfaceContainerHighest to colors.onSurfaceVariant
        ShuttleState.ARMED -> cc.armed to cc.onArmed
        ShuttleState.BOOKED -> cc.mine to colors.surface
        ShuttleState.LOST -> colors.error to colors.onError
        ShuttleState.TEST -> colors.primaryContainer to colors.onPrimaryContainer
    }
}

/** A shuttle in its morphing shape. */
@Composable
fun ShuttleBadge(state: ShuttleState, size: Dp, modifier: Modifier = Modifier) {
    val (fill, ink) = shuttleColors(state)
    MorphBadge(state.polygon(), fill, size, modifier) {
        ShuttleGlyph(state, ink, size * 0.56f)
    }
}

/** Pull to refresh with the expressive shape-shifting indicator. */
@Composable
fun RefreshBox(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit,
) {
    val state = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = onRefresh,
        modifier = modifier,
        state = state,
        indicator = {
            PullToRefreshDefaults.LoadingIndicator(
                state = state,
                isRefreshing = refreshing,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        },
        content = content,
    )
}
