package com.skylightlim.umpoint.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ButtonGroupDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ToggleButton
import androidx.compose.material3.ToggleButtonDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.skylightlim.umpoint.AppViewModel
import com.skylightlim.umpoint.data.CourtIds
import com.skylightlim.umpoint.data.SessionState
import com.skylightlim.umpoint.data.dayLabel
import com.skylightlim.umpoint.data.nextRollover
import com.skylightlim.umpoint.data.weekOf
import com.skylightlim.umpoint.sniper.Task
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.together.CLOSE_BEFORE_MS
import com.skylightlim.umpoint.together.Friend
import com.skylightlim.umpoint.together.FriendStatus
import com.skylightlim.umpoint.together.Lobby
import com.skylightlim.umpoint.together.Slot
import com.skylightlim.umpoint.together.Together
import com.skylightlim.umpoint.together.TogetherState
import com.skylightlim.umpoint.together.TogetherViewModel
import com.skylightlim.umpoint.together.ruleConflict
import com.skylightlim.umpoint.ui.components.EmptyState
import com.skylightlim.umpoint.ui.components.Note
import com.skylightlim.umpoint.ui.components.NoteTone
import com.skylightlim.umpoint.ui.components.SectionLabel
import com.skylightlim.umpoint.ui.components.SegmentGap
import com.skylightlim.umpoint.ui.components.SegmentRow
import com.skylightlim.umpoint.ui.components.segmentShape
import com.skylightlim.umpoint.ui.theme.LocalCourtColors

private const val SIGN_IN_FIRST = "Sign in to UMPoint first, so your phone can book at 00:00."
private val LENGTHS = listOf(2 to "1 h", 3 to "1.5 h", 4 to "2 h", 5 to "2.5 h", 6 to "3 h")
private const val CODE_MIN = 3
private const val CODE_MAX = 20
private val STARTS = (18 until 38).map { Umpoint.hhmm(it * 30) }

/** A sheet or dialog waiting on the user: only one can be up at a time. */
private sealed interface Ask {
    data object NewSession : Ask
    data class InviteMore(val lobby: Lobby) : Ask
    data class GiveUp(val lobby: Lobby) : Ask
    data class CallOff(val lobby: Lobby) : Ask
    data class RemoveFriend(val friend: Friend) : Ask
    data class ShowKey(val key: String) : Ask
}

@Composable
fun TogetherScreen(
    vm: TogetherViewModel,
    app: AppViewModel,
    session: SessionState,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val signedIn by vm.signedIn.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val tasks by app.tasks.collectAsStateWithLifecycle()
    val now by app.now.collectAsStateWithLifecycle()
    val prefs by app.prefs.collectAsStateWithLifecycle()
    val colors = MaterialTheme.colorScheme
    var ask by remember { mutableStateOf<Ask?>(null) }
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.notes.collect { snackbar.showSnackbar(it, withDismissAction = true) } }

    // Taking a half hour commits this phone to booking it, so it has to be able to.
    fun needsUmpoint(): Boolean {
        if (session != SessionState.SIGNED_OUT) return false
        app.requestSignIn(SIGN_IN_FIRST)
        return true
    }

    Surface(modifier.fillMaxSize(), color = colors.surfaceContainer) {
        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                TopAppBar(
                    title = { Text("Play together", style = MaterialTheme.typography.headlineMedium) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = colors.surfaceContainer),
                )
                val current = state
                when {
                    !Together.configured -> EmptyState(
                        icon = Icons.Rounded.Groups,
                        title = "Not set up yet",
                        text = "This build has no Play together server. Everything else works as usual.",
                    )
                    !signedIn -> JoinForm(busy = busy, onCreate = vm::createAccount, onRestore = vm::restore)
                    current == null -> EmptyState(
                        icon = Icons.Rounded.Groups,
                        title = "Can’t load your friends",
                        text = "Your account is safe. Check your connection and try again.",
                        action = { Button(onClick = { vm.refresh() }, enabled = !busy, shapes = ButtonDefaults.shapes()) { Text("Try again") } },
                    )
                    else -> SignedIn(
                        state = current,
                        tasks = tasks,
                        now = now,
                        busy = busy,
                        vm = vm,
                        onAsk = { ask = it },
                        onAccept = { lobby -> if (!needsUmpoint()) vm.accept(lobby) },
                    )
                }
            }

            val current = state
            if (signedIn && current != null && Together.configured) {
                Button(
                    onClick = { if (!needsUmpoint()) ask = Ask.NewSession },
                    enabled = current.acceptedFriends.isNotEmpty(),
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .imePadding()
                        .navigationBarsPadding()
                        .padding(start = 16.dp, end = 16.dp, bottom = 12.dp)
                        .fillMaxWidth()
                        .heightIn(min = 64.dp),
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null)
                    Spacer(Modifier.widthIn(min = 8.dp))
                    Text(
                        if (current.acceptedFriends.isEmpty()) "Add a friend to start a session" else "New session",
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
            }

            SnackbarHost(
                snackbar,
                modifier = Modifier.align(Alignment.BottomCenter).imePadding().navigationBarsPadding().padding(bottom = 84.dp),
            ) { data ->
                Snackbar(snackbarData = data, shape = MaterialTheme.shapes.large)
            }
        }
    }

    when (val asking = ask) {
        null -> Unit
        Ask.NewSession -> state?.let { s ->
            NewSessionSheet(
                friends = s.acceptedFriends,
                tasks = tasks,
                now = now,
                onDismiss = { ask = null },
                onCreate = { date, start, slots, court, invite ->
                    vm.create(date, start, slots, court, prefs.event, prefs.pax, invite)
                    ask = null
                },
            )
        }
        is Ask.InviteMore -> state?.let { s ->
            InviteMoreSheet(
                lobby = asking.lobby,
                friends = s.acceptedFriends.filter { f -> asking.lobby.invites.none { it.code == f.code } },
                onDismiss = { ask = null },
                onInvite = {
                    vm.inviteMore(asking.lobby, it)
                    ask = null
                },
            )
        }
        is Ask.GiveUp -> Confirm(
            title = "Give up your half hour?",
            text = "Your snipe for it is cancelled and it goes to whoever accepts next.",
            action = "Give up",
            keep = "Keep it",
            onConfirm = { vm.giveUp(asking.lobby) },
            onDismiss = { ask = null },
        )
        is Ask.CallOff -> Confirm(
            title = "Call this session off?",
            text = "Everyone’s snipes for it are cancelled. This can’t be undone.",
            action = "Call off",
            keep = "Keep session",
            onConfirm = { vm.callOff(asking.lobby) },
            onDismiss = { ask = null },
        )
        is Ask.RemoveFriend -> Confirm(
            title = "Remove ${asking.friend.name}?",
            text = "Sessions you’re both in carry on. You just can’t invite each other any more.",
            action = "Remove",
            keep = "Keep",
            onConfirm = { vm.removeFriend(asking.friend.code) },
            onDismiss = { ask = null },
        )
        is Ask.ShowKey -> AlertDialog(
            onDismissRequest = { ask = null },
            icon = { Icon(Icons.Rounded.Key, contentDescription = null) },
            title = { Text("Your recovery key") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SelectionContainer { Text(asking.key, style = MaterialTheme.typography.titleMedium) }
                    Text("Enter it on a new phone to bring back your code and friends. If you lose it, ask the friend who runs this app.")
                }
            },
            confirmButton = { TextButton(onClick = { ask = null }) { Text("Done") } },
        )
    }
}

@Composable
private fun Confirm(title: String, text: String, action: String, keep: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm()
                    onDismiss()
                },
            ) { Text(action, color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(keep) } },
    )
}

/** Keeps only what a friend code can hold, so the field shows exactly the code the person will get. */
private fun codeInput(text: String) = text.lowercase().filter { it in 'a'..'z' || it in '0'..'9' }.take(CODE_MAX)

@Composable
private fun JoinForm(busy: Boolean, onCreate: (code: String, name: String) -> Unit, onRestore: (key: String) -> Unit) {
    var restoring by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var key by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().navigationBarsPadding(),
    ) {
        EmptyState(
            icon = Icons.Rounded.Groups,
            title = if (restoring) "Welcome back" else "Book longer, together",
            text = if (restoring) {
                "Your recovery key brings back your friend code and friends, and signs out your old phone."
            } else {
                "Open a session, and friends each take the next half hour. At 00:00 on Monday every phone books its own part, under its own account."
            },
        )
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (restoring) {
                OutlinedTextField(
                    value = key,
                    // Left as typed, because the server ignores case and spacing: rewriting a field mid-typing can drop characters.
                    onValueChange = { key = it },
                    label = { Text("Recovery key") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = { onRestore(key) },
                    enabled = key.isNotBlank() && !busy,
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                ) { Text("Bring back my account") }
            } else {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(30) },
                    label = { Text("Your name") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = codeInput(it) },
                    label = { Text("Your friend code") },
                    supportingText = { Text("$CODE_MIN to $CODE_MAX letters or numbers. You can’t change it later.") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = { onCreate(code, name.trim()) },
                    enabled = name.isNotBlank() && code.length >= CODE_MIN && !busy,
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                ) { Text(if (code.length >= CODE_MIN) "Create “$code”" else "Create my account", maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
            TextButton(
                onClick = { restoring = !restoring },
                shapes = ButtonDefaults.shapes(),
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) { Text(if (restoring) "I’m new here" else "I already have an account") }
        }
    }
}

@Composable
private fun SignedIn(
    state: TogetherState,
    tasks: List<Task>,
    now: Long,
    busy: Boolean,
    vm: TogetherViewModel,
    onAsk: (Ask) -> Unit,
    onAccept: (Lobby) -> Unit,
) {
    val me = state.me.code
    val invites = state.lobbies.filter { it.responseOf(me) == "pending" && !it.closedAt(now) }
    // Includes ones the user said no to: while the tender is open they can still change their mind.
    val sessions = state.lobbies.filter { it !in invites }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(horizontal = 16.dp)
            .navigationBarsPadding()
            .padding(top = 8.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (invites.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
                SectionLabel("Invites")
                invites.forEach { lobby ->
                    InviteCard(
                        lobby = lobby,
                        conflict = ruleConflict(lobby.date, lobby.id, tasks, ::weekOf),
                        busy = busy,
                        onAccept = { onAccept(lobby) },
                        onDecline = { vm.decline(lobby) },
                    )
                }
            }
        }
        if (sessions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionLabel("Sessions", Modifier.padding(bottom = 0.dp))
                sessions.forEach { lobby ->
                    SessionCard(
                        lobby = lobby,
                        me = me,
                        now = now,
                        busy = busy,
                        hasFriendsLeft = state.acceptedFriends.any { f -> lobby.invites.none { it.code == f.code } },
                        onJoin = { onAccept(lobby) },
                        onAsk = onAsk,
                    )
                }
            }
        }
        FriendsSection(state.friends, busy, vm, onAsk)
        SegmentRow(
            shape = segmentShape(0, 1),
            title = state.me.name,
            subtitle = "Your friend code: ${state.me.code}",
            icon = Icons.Rounded.Person,
            trailing = {
                IconButton(onClick = { onAsk(Ask.ShowKey(state.me.key)) }) {
                    Icon(Icons.Rounded.Key, contentDescription = "Show your recovery key")
                }
            },
        )
    }
}

@Composable
private fun InviteCard(lobby: Lobby, conflict: String?, busy: Boolean, onAccept: () -> Unit, onDecline: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val next = lobby.slots.firstOrNull { it.claimedBy == null }
    Surface(shape = MaterialTheme.shapes.extraLarge, color = colors.surfaceBright, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column {
                Text("${lobby.hostName} · Court ${lobby.court}", style = MaterialTheme.typography.titleLargeEmphasized)
                Text("${dayLabel(lobby.date)}, ${lobby.start}–${lobby.end}", style = MaterialTheme.typography.bodyLarge, color = colors.onSurfaceVariant)
            }
            Text(
                if (next != null) {
                    "If you accept now you book ${next.start}–${next.end}. Your phone sends it at 00:00 Monday, under your own UMPoint account, and it counts as one of your two bookings that week."
                } else {
                    "Every half hour has someone booking it. You can still say you’ll come and play."
                },
                style = MaterialTheme.typography.bodyMedium,
            )
            conflict?.let { Note(it, NoteTone.WARN) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onAccept,
                    enabled = !busy && conflict == null,
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                ) { Text(if (next != null) "Accept" else "I’ll play") }
                FilledTonalButton(
                    onClick = onDecline,
                    enabled = !busy,
                    shapes = ButtonDefaults.shapes(),
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                ) { Text("Decline") }
            }
        }
    }
}

@Composable
private fun SessionCard(
    lobby: Lobby,
    me: String,
    now: Long,
    busy: Boolean,
    hasFriendsLeft: Boolean,
    onJoin: () -> Unit,
    onAsk: (Ask) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val closed = lobby.closedAt(now)
    val mine = lobby.slotOf(me)
    val hosting = lobby.host == me
    val elsewhere = lobby.invites.filter { it.response == "pending" || it.response == "declined" || it.response == "player" }
    Surface(shape = MaterialTheme.shapes.extraLarge, color = colors.surfaceBright, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column {
                Text("${dayLabel(lobby.date)} · Court ${lobby.court}", style = MaterialTheme.typography.titleLargeEmphasized)
                Text(
                    "${lobby.start}–${lobby.end}" + if (hosting) "" else ", hosted by ${lobby.hostName}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = colors.onSurfaceVariant,
                )
            }
            if (lobby.cancelled) {
                Note("${lobby.hostName.takeIf { !hosting } ?: "You"} called this session off.", NoteTone.INFO)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    lobby.slots.forEach { SlotLine(it, me, closed) }
                }
                if (closed && lobby.openSlots > 0 && lobby.slots.none { it.result != null }) {
                    Note("The tender closed with ${lobby.openSlots} half ${if (lobby.openSlots == 1) "hour" else "hours"} unclaimed, so nobody will book them.", NoteTone.WARN)
                }
            }
            if (elsewhere.isNotEmpty() && !lobby.cancelled) {
                Text(
                    elsewhere.joinToString(" · ") {
                        it.name + when (it.response) {
                            "pending" -> " hasn’t answered"
                            "player" -> " will play"
                            else -> " can’t make it"
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                )
            }
            if (!closed) {
                FlowRowActions {
                    if (mine == null && lobby.openSlots > 0) {
                        Button(onClick = onJoin, enabled = !busy, shapes = ButtonDefaults.shapes()) { Text("Take a half hour") }
                    }
                    if (mine != null && hasFriendsLeft) {
                        FilledTonalButton(onClick = { onAsk(Ask.InviteMore(lobby)) }, enabled = !busy, shapes = ButtonDefaults.shapes()) {
                            Text("Invite more")
                        }
                    }
                    if (mine != null && !hosting) {
                        TextButton(onClick = { onAsk(Ask.GiveUp(lobby)) }, enabled = !busy, shapes = ButtonDefaults.shapes()) {
                            Text("Give up my half hour", color = colors.error)
                        }
                    }
                    if (hosting) {
                        TextButton(onClick = { onAsk(Ask.CallOff(lobby)) }, enabled = !busy, shapes = ButtonDefaults.shapes()) {
                            Text("Call off", color = colors.error)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowActions(content: @Composable () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) { content() }
}

/** One half hour: who holds it and how it went. The word carries the meaning, the colour backs it up. */
@Composable
private fun SlotLine(slot: Slot, me: String, closed: Boolean) {
    val colors = MaterialTheme.colorScheme
    val cc = LocalCourtColors.current
    val isMine = slot.claimedBy == me
    val (word, container, content) = when {
        slot.result == "booked" -> Triple("Booked", cc.mineContainer, cc.onMineContainer)
        slot.result != null -> Triple(if (slot.result == "missed") "Missed" else "Not booked", colors.errorContainer, colors.onErrorContainer)
        // Only this phone's own snipe is known to be armed; the server just knows who took the rest.
        slot.claimedBy != null -> Triple(if (isMine) "Armed" else "Taken", cc.armedContainer, cc.onArmedContainer)
        closed -> Triple("Nobody", colors.surfaceContainerHighest, colors.onSurfaceVariant)
        else -> Triple("Open", cc.freeContainer, cc.onFreeContainer)
    }
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 32.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("${slot.start}–${slot.end}", style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            Text(
                if (isMine) "You" else slot.name ?: "",
                style = MaterialTheme.typography.titleSmallEmphasized,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Chip(word, container, content)
        }
        slot.message?.takeIf { it.isNotBlank() && slot.result != "booked" }?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun Chip(text: String, container: Color, content: Color) {
    Surface(shape = CircleShape, color = container) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = content, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
private fun FriendsSection(friends: List<Friend>, busy: Boolean, vm: TogetherViewModel, onAsk: (Ask) -> Unit) {
    val colors = MaterialTheme.colorScheme
    val focus = LocalFocusManager.current
    var code by rememberSaveable { mutableStateOf("") }
    val ordered = friends.sortedWith(compareBy({ it.status != FriendStatus.INCOMING }, { it.status != FriendStatus.ACCEPTED }, { it.name.lowercase() }))
    val count = ordered.size + 1

    fun add() {
        if (code.isBlank()) return
        vm.addFriend(code)
        code = ""
        focus.clearFocus()
    }

    Column {
        SectionLabel("Friends")
        Column(verticalArrangement = Arrangement.spacedBy(SegmentGap)) {
            ordered.forEachIndexed { index, friend ->
                SegmentRow(
                    shape = segmentShape(index, count),
                    title = friend.name,
                    subtitle = when (friend.status) {
                        FriendStatus.ACCEPTED -> friend.code
                        FriendStatus.INCOMING -> "Wants to play together"
                        FriendStatus.OUTGOING -> "Waiting for them to accept"
                    },
                    icon = Icons.Rounded.Person,
                    trailing = {
                        if (friend.status == FriendStatus.INCOMING) {
                            FilledTonalButton(onClick = { vm.answerFriend(friend.code, true) }, enabled = !busy, shapes = ButtonDefaults.shapes()) { Text("Accept") }
                        }
                        IconButton(
                            onClick = {
                                if (friend.status == FriendStatus.INCOMING) vm.answerFriend(friend.code, false) else onAsk(Ask.RemoveFriend(friend))
                            },
                            enabled = !busy,
                        ) {
                            Icon(Icons.Rounded.Close, contentDescription = if (friend.status == FriendStatus.INCOMING) "Decline" else "Remove ${friend.name}")
                        }
                    },
                )
            }
            Surface(shape = segmentShape(ordered.size, count), color = colors.surfaceBright) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = codeInput(it) },
                    label = { Text("Add by friend code") },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(onClick = ::add, enabled = code.isNotBlank() && !busy) {
                            Icon(Icons.Rounded.PersonAdd, contentDescription = "Send friend request")
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.None,
                        autoCorrectEnabled = false,
                        keyboardType = KeyboardType.Ascii,
                        imeAction = ImeAction.Send,
                    ),
                    keyboardActions = KeyboardActions(onSend = { add() }),
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewSessionSheet(
    friends: List<Friend>,
    tasks: List<Task>,
    now: Long,
    onDismiss: () -> Unit,
    onCreate: (date: String, start: String, slots: Int, court: String, invite: List<String>) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    // Past the closing time, the coming rollover can no longer take new claims, so offer the one after.
    val rollover = remember {
        val next = nextRollover(now)
        if (now >= next - CLOSE_BEFORE_MS) next + Umpoint.WEEK_MS else next
    }
    val dates = remember(rollover) { (1..4).map { Umpoint.mytDate(rollover + it * 86_400_000L) } }
    var date by rememberSaveable { mutableStateOf<String?>(null) }
    var start by rememberSaveable { mutableStateOf<String?>(null) }
    var slots by rememberSaveable { mutableStateOf(4) }
    var court by rememberSaveable { mutableStateOf<String?>(null) }
    val invited = remember { mutableStateListOf<String>() }

    fun fits(count: Int) = start == null || Umpoint.minutes(start!!) + count * 30 <= Umpoint.minutes(Umpoint.CLOSE)
    val length = if (fits(slots)) slots else LENGTHS.lastOrNull { fits(it.first) }?.first
    val conflict = date?.let { ruleConflict(it, null, tasks, ::weekOf) }
    val ready = date != null && start != null && length != null && court != null && invited.isNotEmpty() && conflict == null

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = colors.surfaceContainer) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("New session", style = MaterialTheme.typography.headlineSmall)

            Step("Date")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                dates.forEach { d ->
                    FilterChip(selected = date == d, onClick = { date = d }, label = { Text(dayLabel(d)) }, modifier = Modifier.heightIn(min = 48.dp))
                }
            }

            Step("Start")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // A session needs at least two half hours, so the last start is 18:00.
                STARTS.filter { Umpoint.minutes(it) + 60 <= Umpoint.minutes(Umpoint.CLOSE) }.forEach { s ->
                    FilterChip(selected = start == s, onClick = { start = s }, label = { Text(s) }, modifier = Modifier.heightIn(min = 48.dp))
                }
            }

            Step("Length")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween)) {
                LENGTHS.forEachIndexed { index, (count, label) ->
                    ToggleButton(
                        checked = length == count,
                        onCheckedChange = { slots = count },
                        enabled = fits(count),
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                        shapes = when (index) {
                            0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
                            LENGTHS.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
                            else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
                        },
                        contentPadding = PaddingValues(horizontal = 2.dp),
                        colors = ToggleButtonDefaults.colors(containerColor = colors.surfaceBright),
                    ) { Text(label, maxLines = 1) }
                }
            }

            Step("Court")
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(ButtonGroupDefaults.ConnectedSpaceBetween)) {
                CourtIds.ALL.forEachIndexed { index, id ->
                    ToggleButton(
                        checked = court == id,
                        onCheckedChange = { court = id },
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                        shapes = when (index) {
                            0 -> ButtonGroupDefaults.connectedLeadingButtonShapes()
                            CourtIds.ALL.lastIndex -> ButtonGroupDefaults.connectedTrailingButtonShapes()
                            else -> ButtonGroupDefaults.connectedMiddleButtonShapes()
                        },
                        colors = ToggleButtonDefaults.colors(containerColor = colors.surfaceBright),
                    ) { Text("Court $id", maxLines = 1) }
                }
            }

            Step("Invite")
            FriendPicker(friends, invited)

            Note(
                if (length != null) {
                    "You book the first half hour. Friends take the other ${length - 1} in the order they accept. Everyone stays on this court, so a taken half hour leaves a gap instead of splitting the session."
                } else {
                    "That start is too late for this length."
                },
                NoteTone.INFO,
            )
            conflict?.let { Note(it, NoteTone.WARN) }

            Button(
                onClick = { onCreate(date!!, start!!, length!!, court!!, invited.toList()) },
                enabled = ready,
                shapes = ButtonDefaults.shapes(),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
            ) { Text("Open the tender") }
        }
    }
}

@Composable
private fun InviteMoreSheet(lobby: Lobby, friends: List<Friend>, onDismiss: () -> Unit, onInvite: (List<String>) -> Unit) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val invited = remember { mutableStateListOf<String>() }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, containerColor = MaterialTheme.colorScheme.surfaceContainer) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Invite to ${dayLabel(lobby.date)}, ${lobby.start}–${lobby.end}", style = MaterialTheme.typography.titleLarge)
            FriendPicker(friends, invited)
            Button(
                onClick = { onInvite(invited.toList()) },
                enabled = invited.isNotEmpty(),
                shapes = ButtonDefaults.shapes(),
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
            ) { Text("Invite") }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FriendPicker(friends: List<Friend>, invited: MutableList<String>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        friends.forEach { friend ->
            val on = friend.code in invited
            FilterChip(
                selected = on,
                onClick = { if (on) invited.remove(friend.code) else invited.add(friend.code) },
                label = { Text(friend.name, maxLines = 1) },
                modifier = Modifier.heightIn(min = 48.dp),
            )
        }
    }
}

@Composable
private fun Step(title: String) {
    Text(title, style = MaterialTheme.typography.titleMediumEmphasized, modifier = Modifier.padding(top = 4.dp))
}
