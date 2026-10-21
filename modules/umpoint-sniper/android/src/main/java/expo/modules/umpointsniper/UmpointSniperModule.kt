package expo.modules.umpointsniper

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.CookieManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class UmpointSniperModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext?.applicationContext ?: throw IllegalStateException("React context lost")

  override fun definition() = ModuleDefinition {
    Name("UmpointSniper")

    Function("userAgent") { browserUserAgent(ctx) }

    Function("tasks") { JSONArray(SniperStore.all(ctx).sortedBy { it.fireAt }.map { it.toJson() }).toString() }

    /** Arms a snipe. fireAt defaults to Monday 00:00 MYT of the slot's week; tests pass their own. */
    Function("arm") { json: String ->
      val o = JSONObject(json)
      val now = System.currentTimeMillis()
      val fireAt = if (o.has("fireAt")) o.getLong("fireAt") else Umpoint.rolloverFor(o.getString("date"))
      require(fireAt > now + 15_000) { "That week is already open — book it directly instead." }
      val task = Task.fromJson(
        o.put("id", UUID.randomUUID().toString().take(8)).put("fireAt", fireAt).put("createdAt", now).put("status", "armed"),
      )
      SniperStore.put(ctx, task)
      SniperLog.line(ctx, "armed ${task.id}: ${task.date} ${task.start}-${task.end} court ${task.court} any=${task.anyCourt} dry=${task.dryRun} fireAt=${task.fireAt}")
      SniperScheduler.reschedule(ctx)
      task.toJson().toString()
    }

    Function("cancel") { id: String ->
      SniperStore.update(ctx, id) { if (it.status == "armed") it.status = "cancelled" }
      SniperScheduler.reschedule(ctx)
    }

    Function("remove") { id: String ->
      SniperStore.remove(ctx, id)
      SniperScheduler.reschedule(ctx)
    }

    Function("status") {
      mapOf("running" to SniperService.running, "needsSignIn" to SniperService.needsSignIn)
    }

    Function("permissions") {
      val c = ctx
      val nm = c.getSystemService(NotificationManager::class.java)
      mapOf(
        "notifications" to nm.areNotificationsEnabled(),
        "exactAlarms" to (Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()),
        "fullScreen" to (Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent()),
        "backgroundRestricted" to (Build.VERSION.SDK_INT >= 28 && c.getSystemService(ActivityManager::class.java).isBackgroundRestricted),
      )
    }

    Function("openSettings") { which: String ->
      val c = ctx
      val pkg = Uri.parse("package:${c.packageName}")
      val intent = when {
        which == "notifications" && Build.VERSION.SDK_INT >= 26 ->
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.packageName)
        which == "fullScreen" && Build.VERSION.SDK_INT >= 34 -> Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg)
        which == "exactAlarms" && Build.VERSION.SDK_INT >= 31 -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg)
        else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      }
      c.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Books a slot in the week that is open now, through the same code the sniper fires. */
    AsyncFunction("bookNow") { json: String ->
      val o = JSONObject(json)
      val now = System.currentTimeMillis()
      val task = Task.fromJson(o.put("id", "now-" + UUID.randomUUID().toString().take(6)).put("fireAt", now).put("createdAt", now))
      val http = UmpointHttp(ctx)
      val booker = Booker(ctx, http) { SniperLog.line(ctx, "[book now ${task.date}] $it") }
      SniperLog.line(ctx, "book now: ${task.date} ${task.start}-${task.end} court ${task.court} any=${task.anyCourt}")
      val r = try {
        booker.book(task, Umpoint.rolloverFor(task.date) / 1000, 0L)
      } catch (e: SessionExpired) {
        Booker.Result("signed_out", "Your UMPoint session expired. Sign in again in Settings.", null)
      }
      SniperLog.line(ctx, "book now result: ${r.status} ${r.message}")
      JSONObject().put("status", r.status).put("message", r.message).put("court", r.court ?: JSONObject.NULL).toString()
    }

    AsyncFunction("clearSession") { UmpointHttp(ctx).clearSession() }

    Function("flushCookies") { CookieManager.getInstance().flush() }

    Function("readLog") { SniperLog.read(ctx) }
  }
}
