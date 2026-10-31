package com.skylightlim.umpoint.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

@Composable
fun SettingsScreen(vm: AppViewModel, session: SessionState, onBack: () -> Unit) {
    val prefs by vm.prefs.collectAsStateWithLifecycle()
    val log by vm.log.collectAsStateWithLifecycle()
    var event by remember { mutableStateOf(prefs.event) }
    var confirmSignOut by remember { mutableStateOf(false) }
    val focus = LocalFocusManager.current

    LaunchedEffect(Unit) { event = prefs.event }

    val signedIn = session == SessionState.SIGNED_IN
    val statusText = when (session) {
        SessionState.SIGNED_IN -> "Signed in"
        SessionState.SIGNED_OUT -> "Not signed in"
        SessionState.OFFLINE -> "Can’t reach UMPoint"
        SessionState.UNKNOWN -> "Checking…"
    }
    val dotColor = when (session) {
        SessionState.SIGNED_IN -> MaterialTheme.colorScheme.secondary
        SessionState.SIGNED_OUT -> MaterialTheme.colorScheme.tertiary
        SessionState.OFFLINE -> MaterialTheme.colorScheme.error
        SessionState.UNKNOWN -> MaterialTheme.colorScheme.outline
    }

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
        TopAppBar(
            title = { Text("Settings") },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                }
            },
        )

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .padding(top = 4.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            SectionCard(
                title = "UMPoint account",
                footer = "UMPoint sessions expire after 10–20 idle minutes. The app automatically refreshes credentials using Google OAuth.",
            ) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    StatusDot(dotColor, 10.dp)
                    Text(
                        statusText,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    if (signedIn) {
                        Button(
                            onClick = { confirmSignOut = true },
                            shapes = ButtonDefaults.shapes(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                                contentColor = MaterialTheme.colorScheme.onErrorContainer,
                            ),
                        ) { Text("Sign out") }
                    } else {
                        Button(onClick = { vm.requestSignIn() }, shapes = ButtonDefaults.shapes()) { Text("Sign in") }
                    }
                }
            }

            SectionCard(
                title = "Booking defaults",
                footer = "Applied automatically to every manual booking and sniper attempt.",
                contentPadding = PaddingValues(16.dp),
            ) {
                OutlinedTextField(
                    value = event,
                    onValueChange = {
                        event = it
                        vm.updatePrefs(prefs.copy(event = it.ifBlank { "Badminton practice" }))
                    },
                    label = { Text("Event") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                    modifier = Modifier.fillMaxWidth(),
                )

                Spacer(Modifier.height(16.dp))

                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Players",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        run {
                            FilledTonalIconButton(
                                shapes = IconButtonDefaults.shapes(),
                                onClick = {
                                    vm.updatePrefs(prefs.copy(pax = (prefs.pax - 1).coerceAtLeast(1)))
                                },
                                enabled = prefs.pax > 1,
                            ) { Icon(Icons.Rounded.Remove, contentDescription = "Fewer players") }
                            Text(
                                "${prefs.pax}",
                                style = MaterialTheme.typography.titleMedium,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.widthIn(min = 28.dp),
                            )
                            FilledTonalIconButton(
                                shapes = IconButtonDefaults.shapes(),
                                onClick = {
                                    vm.updatePrefs(prefs.copy(pax = (prefs.pax + 1).coerceAtMost(12)))
                                },
                                enabled = prefs.pax < 12,
                            ) { Icon(Icons.Rounded.Add, contentDescription = "More players") }
                        }
                    }
                }
            }

            SectionCard(
                title = "Diagnostics",
                footer = "Step-by-step logs for verification. App version ${BuildConfig.VERSION_NAME}.",
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .clickable { vm.readLog() }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        Icons.Rounded.Description,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        "Sniper execution log",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.size(18.dp),
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
                    "This forgets your Google sign-in session in the app. Armed snipes will not be able to renew " +
                        "credentials at midnight until you sign in again.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmSignOut = false
                        vm.signOut()
                    },
                ) { Text("Sign out", color = MaterialTheme.colorScheme.error) }
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
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
                Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            "Sniper Log",
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
                        androidx.compose.foundation.text.selection.SelectionContainer {
                            Text(
                                log ?: "",
                                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** A titled group of settings, with an optional line of explanation under it. */
@Composable
private fun SectionCard(
    title: String,
    footer: String? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLargeEmphasized, modifier = Modifier.padding(horizontal = 4.dp))
        Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerLow) {
            Column(Modifier.fillMaxWidth().padding(contentPadding), content = content)
        }
        if (footer != null) {
            Text(
                footer,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}

@Composable
private fun StatusDot(color: Color, size: androidx.compose.ui.unit.Dp) {
    Box(Modifier.size(size).background(color, CircleShape))
}
