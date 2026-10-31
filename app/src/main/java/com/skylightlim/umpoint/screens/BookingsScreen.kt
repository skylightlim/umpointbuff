package com.skylightlim.umpoint.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.data.BookedSlot
import com.skylightlim.umpoint.data.Booking
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.data.ago
import com.skylightlim.umpoint.data.dateMs
import com.skylightlim.umpoint.data.dayLabel
import com.skylightlim.umpoint.data.parseBooking
import com.skylightlim.umpoint.data.weekOf
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.ui.components.EmptyState
import com.skylightlim.umpoint.ui.components.LocalBottomClearance
import com.skylightlim.umpoint.ui.components.MorphBadge
import com.skylightlim.umpoint.ui.components.RefreshBox
import com.skylightlim.umpoint.ui.components.ScreenFrame
import com.skylightlim.umpoint.ui.components.SectionLabel
import com.skylightlim.umpoint.ui.components.SegmentGap
import com.skylightlim.umpoint.ui.components.bounceIn
import com.skylightlim.umpoint.ui.components.segmentShape
import com.skylightlim.umpoint.ui.theme.LocalCourtColors

@Composable
fun BookingsScreen(
    vm: AppViewModel,
    session: SessionState,
    onOpenSettings: () -> Unit,
) {
    val bookings by vm.bookings.collectAsStateWithLifecycle()
    val now by vm.now.collectAsStateWithLifecycle()
    val list = bookings.data
    val thisMonday = Umpoint.weekStart(now)

    fun groupOf(booking: Booking): String {
        val slot = parseBooking(booking) ?: return "Other"
        val week = weekOf(slot.date)
        return when {
            week == thisMonday -> "This week"
            week > thisMonday -> "Coming up"
            else -> "Earlier"
        }
    }

    ScreenFrame("Bookings", session, onOpenSettings) {
        RefreshBox(
            refreshing = bookings.refreshing,
            onRefresh = { vm.refreshBookings() },
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = LocalBottomClearance.current),
                verticalArrangement = Arrangement.spacedBy(SegmentGap),
            ) {
                item {
                    Text(
                        when {
                            bookings.refreshing -> "Updating…"
                            bookings.error != null -> "Couldn’t refresh: ${bookings.error}"
                            else -> "From your UMPoint dashboard. ${ago(bookings.updatedAt, now)}"
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = if (bookings.error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 4.dp),
                    )
                }

                when {
                    list == null && bookings.error != null -> item {
                        EmptyState(
                            icon = Icons.Rounded.CloudOff,
                            title = "Can’t load bookings",
                            text = bookings.error ?: "",
                            action = {
                                Button(onClick = { vm.refreshBookings() }, shapes = ButtonDefaults.shapes()) { Text("Try again") }
                            },
                        )
                    }
                    list == null -> item {
                        Box(Modifier.fillMaxWidth().padding(vertical = 64.dp), contentAlignment = Alignment.Center) {
                            LoadingIndicator(Modifier.size(64.dp))
                        }
                    }
                    list.isEmpty() -> item {
                        EmptyState(
                            icon = Icons.Rounded.CalendarMonth,
                            title = "No active bookings",
                            text = "Courts you book or snipe will appear here.",
                        )
                    }
                    else -> {
                        val sorted = list.sortedBy { parseBooking(it)?.let { slot -> dateMs(slot.date) } ?: Long.MAX_VALUE }
                        listOf("This week", "Coming up", "Earlier", "Other").forEach { group ->
                            val inGroup = sorted.filter { groupOf(it) == group }
                            if (inGroup.isNotEmpty()) {
                                item(key = group) {
                                    SectionLabel(group, Modifier.padding(top = 16.dp))
                                }
                                itemsIndexed(inGroup, key = { _, b -> b.num + b.invoice }) { index, booking ->
                                    BookingCard(
                                        booking = booking,
                                        slot = parseBooking(booking),
                                        shape = segmentShape(index, inGroup.size),
                                        onCancel = { vm.showDashboard() },
                                        modifier = Modifier.animateItem().bounceIn(index),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BookingCard(booking: Booking, slot: BookedSlot?, shape: Shape, onCancel: () -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val cc = LocalCourtColors.current
    Surface(shape = shape, color = colors.surfaceBright, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                MorphBadge(MaterialShapes.Cookie7Sided, cc.mineContainer, 72.dp) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Court", style = MaterialTheme.typography.labelSmall, color = cc.onMineContainer)
                        Text(slot?.court ?: "–", style = MaterialTheme.typography.titleLargeEmphasized, color = cc.onMineContainer)
                    }
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        slot?.let { dayLabel(it.date) } ?: booking.eventDate,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    slot?.let {
                        Text("${it.start}–${it.end}", style = MaterialTheme.typography.headlineSmallEmphasized, maxLines = 1)
                    }
                    Text(
                        slot?.event?.ifBlank { booking.facility } ?: booking.facility,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (booking.cancellable) {
                OutlinedButton(
                    onClick = onCancel,
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier.padding(top = 12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.error),
                    border = BorderStroke(1.dp, colors.error),
                ) {
                    Icon(Icons.AutoMirrored.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Cancel on UMPoint")
                }
            }
        }
    }
}
