package com.skylightlim.umpoint.together

import org.json.JSONArray
import org.json.JSONObject

/** The signed-in user. [key] brings the account back on another phone. */
data class Person(val code: String, val name: String, val key: String)

enum class FriendStatus { ACCEPTED, INCOMING, OUTGOING }

data class Friend(val code: String, val name: String, val status: FriendStatus)

/** One half hour of a session. Whoever holds it books it from their own phone at 00:00. */
data class Slot(
    val idx: Int,
    val start: String,
    val end: String,
    val claimedBy: String?,
    val name: String?,
    val result: String?,
    val message: String?,
)

data class Invite(val code: String, val name: String, val response: String)

data class Lobby(
    val id: String,
    val host: String,
    val hostName: String,
    val date: String,
    val court: String,
    val event: String,
    val pax: Int,
    val fireAt: Long,
    val closesAt: Long,
    val status: String,
    val slots: List<Slot>,
    val invites: List<Invite>,
) {
    val cancelled get() = status == "cancelled"
    val start get() = slots.first().start
    val end get() = slots.last().end
    val openSlots get() = slots.count { it.claimedBy == null }
    fun slotOf(code: String) = slots.firstOrNull { it.claimedBy == code }
    fun responseOf(code: String) = invites.firstOrNull { it.code == code }?.response
    fun closedAt(now: Long) = cancelled || now >= closesAt
}

data class TogetherState(val me: Person, val friends: List<Friend>, val lobbies: List<Lobby>) {
    val acceptedFriends get() = friends.filter { it.status == FriendStatus.ACCEPTED }
}

private fun JSONObject.text(key: String): String? = if (isNull(key)) null else getString(key)

private inline fun <T> JSONArray.mapObjects(block: (JSONObject) -> T): List<T> =
    (0 until length()).map { block(getJSONObject(it)) }

fun togetherStateFromJson(o: JSONObject): TogetherState {
    val me = o.getJSONObject("me")
    return TogetherState(
        me = Person(me.getString("code"), me.getString("name"), me.getString("key")),
        friends = o.getJSONArray("friends").mapObjects {
            Friend(
                code = it.getString("code"),
                name = it.getString("name"),
                status = when (it.getString("status")) {
                    "accepted" -> FriendStatus.ACCEPTED
                    "incoming" -> FriendStatus.INCOMING
                    else -> FriendStatus.OUTGOING
                },
            )
        },
        lobbies = o.getJSONArray("lobbies").mapObjects { l ->
            Lobby(
                id = l.getString("id"),
                host = l.getString("host"),
                hostName = l.getString("hostName"),
                date = l.getString("date"),
                court = l.getString("court"),
                event = l.getString("event"),
                pax = l.getInt("pax"),
                fireAt = l.getLong("fireAt"),
                closesAt = l.getLong("closesAt"),
                status = l.getString("status"),
                slots = l.getJSONArray("slots").mapObjects {
                    Slot(
                        idx = it.getInt("idx"),
                        start = it.getString("start"),
                        end = it.getString("end"),
                        claimedBy = it.text("claimedBy"),
                        name = it.text("name"),
                        result = it.text("result"),
                        message = it.text("message"),
                    )
                },
                invites = l.getJSONArray("invites").mapObjects {
                    Invite(it.getString("code"), it.getString("name"), it.getString("response"))
                },
            )
        },
    )
}
