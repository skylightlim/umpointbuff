package com.skylightlim.umpoint.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.BuildConfig
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.ui.components.SectionLabel
import com.skylightlim.umpoint.ui.components.SegmentGap
import com.skylightlim.umpoint.ui.components.SegmentRow
import com.skylightlim.umpoint.ui.components.segmentShape

@Composable
fun SettingsScreen(vm: AppViewModel, session: SessionState, onBack: () -> Unit, modifier: Modifier = Modifier) {
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val log by vm.log.collectAsStateWithLifecycle()
    var event by remember { mutableStateOf(prefs.event) }
    var confirmSignOut by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val colors = MaterialTheme.colorScheme

    LaunchedEffect(Unit) { event = prefs.event }

    Surface(modifier.fillMaxSize(), color = colors.surfaceContainer) {
        Column(Modifier.fillMaxSize()) {
            TopAppBar(
                title = { Text("Settings", style = MaterialTheme.typography.headlineMedium) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.surfaceContainer),
            )

            Column(
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .navigationBarsPadding()
                    .padding(top = 8.dp, bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Column {
                    SectionLabel("UMPoint account")
                    SegmentRow(
                        shape = segmentShape(0, 1),
                        title = when (session) {
                            SessionState.SIGNED_IN -> "Signed in"
                            SessionState.SIGNED_OUT -> "Not signed in"
                            SessionState.OFFLINE -> "Can’t reach UMPoint"
                            SessionState.UNKNOWN -> "Checking…"
                        },
                        subtitle = "Renews by itself.",
                        icon = Icons.Rounded.AccountCircle,
                        trailing = {
                            if (session == SessionState.SIGNED_IN) {
                                Button(
                                    onClick = { confirmSignOut = true },
                                    shapes = ButtonDefaults.shapes(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = colors.errorContainer,
                                        contentColor = colors.onErrorContainer,
                                    ),
                                ) { Text("Sign out", maxLines = 1) }
                            } else {
                                Button(onClick = { vm.requestSignIn() }, shapes = ButtonDefaults.shapes()) {
                                    Text("Sign in", maxLines = 1)
                                }
                            }
                        },
                    )
                }

                Column {
                    SectionLabel("Booking defaults")
                    Column(verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
                        Surface(shape = segmentShape(0, 2), color = colors.surfaceBright) {
                            OutlinedTextField(
                                value = event,
                                onValueChange = {
                                    event = it
                                    vm.updatePrefs(prefs.copy(event = it.ifBlank { "Badminton practice" }))
                                },
                                label = { Text("Event name") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                            )
                        }
                        SegmentRow(
                            shape = segmentShape(1, 2),
                            title = "Players",
                            icon = Icons.Rounded.Groups,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                FilledTonalIconButton(
                                    onClick = { vm.updatePrefs(prefs.copy(pax = (prefs.pax - 1).coerceAtLeast(1))) },
                                    enabled = prefs.pax > 1,
                                    shapes = IconButtonDefaults.shapes(),
                                ) { Icon(Icons.Rounded.Remove, contentDescription = "Fewer players") }
                                Text(
                                    "${prefs.pax}",
                                    style = MaterialTheme.typography.titleMediumEmphasized,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.widthIn(min = 28.dp),
                                )
                                FilledTonalIconButton(
                                    onClick = { vm.updatePrefs(prefs.copy(pax = (prefs.pax + 1).coerceAtMost(12))) },
                                    enabled = prefs.pax < 12,
                                    shapes = IconButtonDefaults.shapes(),
                                ) { Icon(Icons.Rounded.Add, contentDescription = "More players") }
                            }
                        }
                    }
                    Text(
                        "Used for every booking and snipe.",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.onSurfaceVariant,
                        modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp),
                    )
                }

                Column {
                    SectionLabel("Diagnostics")
                    SegmentRow(
                        shape = segmentShape(0, 1),
                        title = "Sniper log",
                        subtitle = "Each step of every snipe. App version ${BuildConfig.VERSION_NAME}.",
                        icon = Icons.Rounded.Description,
                        chevron = true,
                        onClick = { vm.readLog() },
                    )
                }
            }
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = {
                Text(
                    "This forgets your Google sign-in in the app. Armed snipes can’t renew their session at midnight " +
                        "until you sign in again.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmSignOut = false
                        vm.signOut()
                    },
                ) { Text("Sign out", color = colors.error) }
            },
            dismissButton = {
                TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") }
            },
        )
    }

    if (log != null) {
        Dialog(
            onDismissRequest = { vm.closeLog() },
            properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
        ) {
            Surface(Modifier.fillMaxSize(), color = colors.surface) {
                Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Sniper log",
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                        )
                        IconButton(onClick = { vm.closeLog() }) {
                            Icon(Icons.Rounded.Close, contentDescription = "Close")
                        }
                    }
                    Column(
                        Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 20.dp)
                            .padding(bottom = 24.dp),
                    ) {
                        SelectionContainer {
                            Text(
                                log ?: "",
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                color = colors.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}
