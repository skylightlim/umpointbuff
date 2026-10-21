package expo.modules.umpointsniper

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant

/**
 * A slot to book. [fireAt] is when to send it: Monday 00:00 MYT of the slot's week for a snipe,
 * or an earlier moment for a test run.
 */
data class Task(
  val id: String,
  val date: String,
  val start: String,
  val end: String,
  val court: String,
  val anyCourt: Boolean,
  val event: String,
  val pax: Int,
  val dryRun: Boolean,
  val measure: Boolean,
  val fireAt: Long,
  val createdAt: Long,
  /** armed, running, ringing, booked, failed, dry_run, missed, cancelled */
  var status: String = "armed",
  var message: String? = null,
  var bookedCourt: String? = null,
  var updatedAt: Long = createdAt,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id).put("date", date).put("start", start).put("end", end).put("court", court)
    .put("anyCourt", anyCourt).put("event", event).put("pax", pax).put("dryRun", dryRun)
    .put("measure", measure).put("fireAt", fireAt).put("createdAt", createdAt).put("status", status)
    .put("message", message ?: JSONObject.NULL).put("bookedCourt", bookedCourt ?: JSONObject.NULL)
    .put("updatedAt", updatedAt)

  val finished get() = status !in setOf("armed", "running", "ringing")

  companion object {
    fun fromJson(o: JSONObject) = Task(
      id = o.getString("id"), date = o.getString("date"), start = o.getString("start"),
      end = o.getString("end"), court = o.getString("court"), anyCourt = o.optBoolean("anyCourt"),
      event = o.getString("event"), pax = o.getInt("pax"), dryRun = o.optBoolean("dryRun"),
      measure = o.optBoolean("measure"), fireAt = o.getLong("fireAt"), createdAt = o.getLong("createdAt"),
      status = o.optString("status", "armed"),
      message = if (o.isNull("message")) null else o.optString("message"),
      bookedCourt = if (o.isNull("bookedCourt")) null else o.optString("bookedCourt"),
      updatedAt = o.optLong("updatedAt", o.getLong("createdAt")),
    )
  }
}

object SniperStore {
  private const val KEEP_FINISHED_MS = 14 * 86_400_000L

  private fun prefs(ctx: Context) = ctx.getSharedPreferences("umpoint_sniper", Context.MODE_PRIVATE)

  @Synchronized
  fun all(ctx: Context): MutableList<Task> {
    val raw = prefs(ctx).getString("tasks", "[]")!!
    val arr = JSONArray(raw)
    return (0 until arr.length()).map { Task.fromJson(arr.getJSONObject(it)) }.toMutableList()
  }

  @Synchronized
  private fun write(ctx: Context, tasks: List<Task>) {
    val now = System.currentTimeMillis()
    val kept = tasks.filter { !it.finished || now - it.updatedAt < KEEP_FINISHED_MS }
    // commit(): the service may be killed right after a booking lands.
    prefs(ctx).edit().putString("tasks", JSONArray(kept.map { it.toJson() }).toString()).commit()
  }

  @Synchronized
  fun put(ctx: Context, task: Task) {
    write(ctx, all(ctx).filter { it.id != task.id } + task)
  }

  @Synchronized
  fun update(ctx: Context, id: String, block: (Task) -> Unit): Task? {
    val tasks = all(ctx)
    val t = tasks.firstOrNull { it.id == id } ?: return null
    block(t)
    t.updatedAt = System.currentTimeMillis()
    write(ctx, tasks)
    return t
  }

  @Synchronized
  fun remove(ctx: Context, id: String) {
    write(ctx, all(ctx).filter { it.id != id })
  }
}

/** Plain-text log plus JSON-lines study files, in the app's external files dir (adb can pull them). */
object SniperLog {
  private const val TAG = "UmpointSniper"

  fun dir(ctx: Context): File = (ctx.getExternalFilesDir(null) ?: ctx.filesDir).also { it.mkdirs() }

  @Synchronized
  fun line(ctx: Context, msg: String) {
    Log.i(TAG, msg)
    runCatching { File(dir(ctx), "sniper.log").appendText("${Instant.now()} $msg\n") }
  }

  @Synchronized
  fun json(ctx: Context, name: String, obj: JSONObject) {
    runCatching { File(dir(ctx), "$name.jsonl").appendText(obj.toString() + "\n") }
  }

  fun save(ctx: Context, name: String, text: String) {
    runCatching { File(File(dir(ctx), "pages").also { it.mkdirs() }, name).writeText(text) }
  }

  fun read(ctx: Context, maxChars: Int = 40_000): String =
    runCatching { File(dir(ctx), "sniper.log").readText().takeLast(maxChars) }.getOrDefault("")
}
