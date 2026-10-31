package com.skylightlim.umpoint.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

data class DockItem(val label: String, val icon: (selected: Boolean) -> ImageVector)

private val CELL_WIDTH = 100.dp
private val CELL_HEIGHT = 64.dp
private val INSET = 6.dp

/**
 * A floating pill of tabs, with content scrolling behind it. The selected blob has two edges on
 * separate springs: the edge leading the move arrives first, so it stretches and then catches up.
 */
@Composable
fun FloatingDock(
    items: List<DockItem>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val quick = spring<androidx.compose.ui.unit.Dp>(dampingRatio = 0.5f, stiffness = 900f)
    val lazy = spring<androidx.compose.ui.unit.Dp>(dampingRatio = 0.55f, stiffness = 320f)
    val left = CELL_WIDTH * selected
    val right = left + CELL_WIDTH
    val previous = remember { intArrayOf(selected, selected) }
    if (previous[1] != selected) {
        previous[0] = previous[1]
        previous[1] = selected
    }
    val forward = previous[1] >= previous[0]
    val start by animateDpAsState(left, if (forward) lazy else quick, label = "dockStart")
    val end by animateDpAsState(right, if (forward) quick else lazy, label = "dockEnd")

    Surface(modifier, shape = CircleShape, color = colors.surfaceContainerHighest, shadowElevation = 6.dp) {
        Box(Modifier.padding(INSET).height(CELL_HEIGHT).width(CELL_WIDTH * items.size)) {
            Box(
                Modifier
                    .offset(x = start)
                    .width(end - start)
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(colors.primary),
            )
            Row(Modifier.selectableGroup(), horizontalArrangement = Arrangement.Start) {
                items.forEachIndexed { index, item ->
                    val isSelected = index == selected
                    val ink by animateColorAsState(
                        if (isSelected) colors.onPrimary else colors.onSurfaceVariant,
                        MaterialTheme.motionScheme.fastEffectsSpec(),
                        label = "dockInk",
                    )
                    val source = remember { MutableInteractionSource() }
                    Column(
                        Modifier
                            .width(CELL_WIDTH)
                            .height(CELL_HEIGHT)
                            .springPress(source, pressed = 0.86f)
                            .selectable(
                                selected = isSelected,
                                role = Role.Tab,
                                interactionSource = source,
                                indication = null,
                                onClick = { onSelect(index) },
                            ),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(item.icon(isSelected), contentDescription = null, tint = ink, modifier = Modifier.size(24.dp))
                        Text(item.label, style = MaterialTheme.typography.labelMedium, color = ink, maxLines = 1)
                    }
                }
            }
        }
    }
}
