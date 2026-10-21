package expo.modules.umpointsniper

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator

/** Sets the 23:50 alarm for the next armed task; called whenever tasks or the clock change. */
object SniperScheduler {
  /** The service starts this long before 00:00 to check the session and the clock. */
  const val PREFLIGHT_MS = 10 * 60_000L
  const val ACTION_PREFLIGHT = "expo.modules.umpointsniper.PREFLIGHT"

  private fun alarmIntent(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
    ctx, 1, Intent(ctx, SniperReceiver::class.java).setAction(ACTION_PREFLIGHT),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  fun openAppIntent(ctx: Context): PendingIntent = PendingIntent.getActivity(
    ctx, 2, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)!!.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )

  fun reschedule(ctx: Context) {
    val am = ctx.getSystemService(AlarmManager::class.java)
    val now = System.currentTimeMillis()
    val armed = SniperStore.all(ctx).filter { it.status == "armed" }
    for (t in armed.filter { now > it.fireAt + Rollover.LATE_MS }) {
      SniperStore.update(ctx, t.id) { it.status = "missed"; it.message = "The phone was off or the app was stopped at 00:00." }
    }
    val next = armed.filter { now <= it.fireAt + Rollover.LATE_MS }.minByOrNull { it.fireAt }
    if (next == null) {
      am.cancel(alarmIntent(ctx))
      return
    }
    val at = next.fireAt - PREFLIGHT_MS
    if (at <= now + 2_000) {
      SniperService.start(ctx)
      return
    }
    // An alarm clock alarm: never deferred, and it brings the phone out of Doze to deliver.
    am.setAlarmClock(AlarmManager.AlarmClockInfo(at, openAppIntent(ctx)), alarmIntent(ctx))
  }
}

class SniperReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    SniperLog.line(ctx, "receiver: ${intent.action}")
    if (intent.action == SniperScheduler.ACTION_PREFLIGHT) SniperService.start(ctx)
    else SniperScheduler.reschedule(ctx) // boot, clock or time zone change, app update
  }
}

class SniperService : Service() {
  companion object {
    const val ACTION_RUN = "expo.modules.umpointsniper.RUN"
    const val ACTION_STOP_RING = "expo.modules.umpointsniper.STOP_RING"
    private const val CH_STATUS = "sniper_status"
    private const val CH_ALARM = "sniper_alarm"
    private const val CH_RESULT = "sniper_result"
    private const val ID_ONGOING = 7001
    private const val ID_RING = 7002

    @Volatile var running = false
      private set

    /** True while the sniper rings for a sign-in; the app opens the sign-in sheet when it sees this. */
    @Volatile var needsSignIn = false
      private set

    fun start(ctx: Context) {
      val i = Intent(ctx, SniperService::class.java).setAction(ACTION_RUN)
      if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
    }

    fun channels(ctx: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = ctx.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(NotificationChannel(CH_STATUS, "Sniper status", NotificationManager.IMPORTANCE_LOW))
      nm.createNotificationChannel(NotificationChannel(CH_RESULT, "Booking results", NotificationManager.IMPORTANCE_HIGH))
      nm.createNotificationChannel(
        NotificationChannel(CH_ALARM, "Sign-in alarm", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Rings when the sniper needs you to sign in before 00:00"
          setSound(null, null) // the service plays the alarm itself, through the alarm stream
          enableVibration(false)
          setBypassDnd(true)
        },
      )
    }
  }

  private var worker: Thread? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var player: MediaPlayer? = null
  private var ongoingTitle = "Sniper armed"
  private var ongoingText = "Getting ready for 00:00:00"

  override fun onBind(intent: Intent?): IBinder? = null

  private fun builder(channel: String): Notification.Builder =
    (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else @Suppress("DEPRECATION") Notification.Builder(this))
      .setSmallIcon(R.drawable.umpoint_sniper_icon)
      .setContentIntent(SniperScheduler.openAppIntent(this))

  private fun ongoingNotification(): Notification =
    builder(CH_STATUS).setContentTitle(ongoingTitle).setContentText(ongoingText).setOngoing(true).build()

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    channels(this)
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(ID_ONGOING, ongoingNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
    } else {
      startForeground(ID_ONGOING, ongoingNotification())
    }
    if (intent?.action == ACTION_STOP_RING) {
      silence()
      if (worker?.isAlive != true) stopSelf()
      return START_NOT_STICKY
    }
    if (worker?.isAlive != true) worker = Thread(::runAll, "umpoint-sniper").also { it.start() }
    return START_NOT_STICKY
  }

  private fun runAll() {
    running = true
    wakeLock = getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "umpoint:sniper")
      .apply { acquire(100 * 60_000L) }
    try {
      while (true) {
        val now = System.currentTimeMillis()
        val due = SniperStore.all(this).filter {
          it.status in setOf("armed", "running", "ringing") && it.fireAt - SniperScheduler.PREFLIGHT_MS <= now + 5_000
        }
        if (due.isEmpty()) break
        val fireAt = due.minOf { it.fireAt }
        val group = due.filter { it.fireAt == fireAt }.sortedBy { it.createdAt }
        if (now > fireAt + Rollover.LATE_MS) {
          group.forEach { finish(it, "missed", "The phone wasn't running the sniper at 00:00.") }
          continue
        }
        Rollover(this, fireAt, group).run()
        // Anything still unfinished in this group (a crash mid-way) must not loop forever.
        SniperStore.all(this).filter { t -> group.any { it.id == t.id } && !t.finished }
          .forEach { finish(it, "failed", "The sniper stopped before finishing.") }
      }
    } catch (t: Throwable) {
      SniperLog.line(this, "worker crashed: ${t.stackTraceToString()}")
      SniperStore.all(this).filter { !it.finished && it.status != "armed" }
        .forEach { finish(it, "failed", "The sniper crashed: ${t.javaClass.simpleName}") }
    } finally {
      silence()
      running = false
      wakeLock?.let { if (it.isHeld) it.release() }
      SniperScheduler.reschedule(this)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  fun ongoing(title: String, text: String) {
    ongoingTitle = title
    ongoingText = text
    getSystemService(NotificationManager::class.java).notify(ID_ONGOING, ongoingNotification())
  }

  fun finish(task: Task, status: String, message: String, court: String? = null) {
    SniperStore.update(this, task.id) {
      it.status = status
      it.message = message
      it.bookedCourt = court
    }
    SniperLog.line(this, "task ${task.id}: $status — $message")
    val title = when (status) {
      "booked" -> "Court booked"
      "dry_run" -> "Sniper test finished"
      else -> "Sniper didn't get the court"
    }
    getSystemService(NotificationManager::class.java)
      .notify(task.id.hashCode(), builder(CH_RESULT).setContentTitle(title).setContentText(message)
        .setStyle(Notification.BigTextStyle().bigText(message)).setAutoCancel(true).build())
  }

  /** Loud alarm plus a full-screen notification, until [stopRing] or the user taps Stop. */
  fun ring(unreachable: Boolean) {
    needsSignIn = !unreachable
    val text = if (unreachable) "The sniper can't reach UMPoint. Check the phone's Wi‑Fi or data before 00:00."
      else "Your UMPoint session expired and couldn't be renewed. Open the app and sign in before 00:00."
    val stop = PendingIntent.getService(
      this, 3, Intent(this, SniperService::class.java).setAction(ACTION_STOP_RING),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val n = builder(CH_ALARM)
      .setContentTitle("Sign in to UMPoint now")
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setFullScreenIntent(SniperScheduler.openAppIntent(this), true)
      .addAction(Notification.Action.Builder(null, "Stop ringing", stop).build())
      .build()
    getSystemService(NotificationManager::class.java).notify(ID_RING, n)
    runCatching {
      player?.release()
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(this@SniperService, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
        isLooping = true
        prepare()
        start()
      }
    }.onFailure { SniperLog.line(this, "alarm sound failed: $it") }
    if (Build.VERSION.SDK_INT >= 26) {
      getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 800, 600), 0))
    }
  }

  /** Stops the sound and vibration but leaves the notification (the user pressed Stop). */
  private fun silence() {
    player?.runCatching { stop(); release() }
    player = null
    getSystemService(Vibrator::class.java)?.cancel()
  }

  fun stopRing() {
    silence()
    needsSignIn = false
    getSystemService(NotificationManager::class.java).cancel(ID_RING)
  }

  override fun onDestroy() {
    silence()
    super.onDestroy()
  }
}
