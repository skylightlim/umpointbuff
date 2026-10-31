package com.skylightlim.umpoint.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

/** The gap between rows of one group. */
val SegmentGap = 3.dp

/** Round on the outside of a group and nearly square where its rows meet. */
fun segmentShape(index: Int, count: Int): Shape {
    val outer = 28.dp
    val inner = 6.dp
    return RoundedCornerShape(
        topStart = if (index == 0) outer else inner,
        topEnd = if (index == 0) outer else inner,
        bottomStart = if (index == count - 1) outer else inner,
        bottomEnd = if (index == count - 1) outer else inner,
    )
}

/** The small coloured label above a group, with room for a quiet action at its end. */
@Composable
fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmallEmphasized,
        color = color,
        modifier = modifier.padding(start = 12.dp, end = 12.dp, bottom = 8.dp),
    )
}

/** A squircle holding a row's icon. */
@Composable
fun IconTile(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    container: Color = MaterialTheme.colorScheme.secondaryContainer,
    content: Color = MaterialTheme.colorScheme.onSecondaryContainer,
) {
    Surface(modifier.size(52.dp), shape = RoundedCornerShape(18.dp), color = container) {
        Box(contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(26.dp))
        }
    }
}

/**
 * One row of a group: icon tile, title and subtitle. A trailing control sits behind a thin divider,
 * so it reads as a separate target from the row itself.
 */
@Composable
fun SegmentRow(
    shape: Shape,
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
    leading: (@Composable () -> Unit)? = null,
    color: Color = MaterialTheme.colorScheme.surfaceBright,
    titleColor: Color = MaterialTheme.colorScheme.onSurface,
    subtitleColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    chevron: Boolean = false,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    Surface(modifier = modifier.fillMaxWidth(), shape = shape, color = color) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 76.dp)
                .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            leading?.invoke() ?: icon?.let { IconTile(it) }
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMediumEmphasized, color = titleColor)
                subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = subtitleColor) }
            }
            trailing?.let {
                VerticalDivider(Modifier.height(36.dp), color = MaterialTheme.colorScheme.outlineVariant)
                it()
            }
            if (chevron) {
                Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, contentDescription = null, tint = subtitleColor)
            }
        }
    }
}
