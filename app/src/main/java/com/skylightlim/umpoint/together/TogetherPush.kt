package com.skylightlim.umpoint.together

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.skylightlim.umpoint.BuildConfig
import com.skylightlim.umpoint.MainActivity
import com.skylightlim.umpoint.R
import com.skylightlim.umpoint.sniper.SniperLog

/** Invites and updates over FCM. A phone without it, or a build without keys, still syncs by polling. */
class TogetherPush : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        runCatching { Together.sendDeviceToken(this, token) }
            .onFailure { SniperLog.line(this, "together: couldn't send the device token: ${it.message}") }
    }

    /** Runs on a background thread, and high priority leaves network access open through Doze. */
    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        notify(this, data["kind"].orEmpty(), data["title"].orEmpty(), data["body"].orEmpty(), data["lobby"].orEmpty())
        runCatching { Together.sync(this) }.onFailure { TogetherWorker.now(this) }
    }

    companion object {
        const val EXTRA_OPEN = "umpoint_together"
        private const val CH_INVITES = "together_invites"
        private const val CH_UPDATES = "together_updates"

        fun channels(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CH_INVITES, "Invites to play", NotificationManager.IMPORTANCE_HIGH))
            nm.createNotificationChannel(NotificationChannel(CH_UPDATES, "Session updates", NotificationManager.IMPORTANCE_DEFAULT))
        }

        fun init(ctx: Context) {
            if (BuildConfig.FIREBASE_APP_ID.isBlank() || FirebaseApp.getApps(ctx).isNotEmpty()) return
            FirebaseApp.initializeApp(
                ctx,
                FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build(),
            )
        }

        /** Hands this phone's push address to the server once Google has issued it. */
        fun register(ctx: Context) {
            if (FirebaseApp.getApps(ctx).isEmpty()) return
            val app = ctx.applicationContext
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                Thread {
                    runCatching { Together.sendDeviceToken(app, token) }
                        .onFailure { SniperLog.line(app, "together: couldn't send the device token: ${it.message}") }
                }.start()
            }
        }

        private fun notify(ctx: Context, kind: String, title: String, body: String, lobby: String) {
            val open = PendingIntent.getActivity(
                ctx,
                (kind + lobby).hashCode(),
                Intent(ctx, MainActivity::class.java).putExtra(EXTRA_OPEN, true).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val channel = if (kind == "invite" || kind == "friend") CH_INVITES else CH_UPDATES
            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, channel) else @Suppress("DEPRECATION") Notification.Builder(ctx)
            ctx.getSystemService(NotificationManager::class.java).notify(
                (kind + lobby + title).hashCode(),
                builder.setSmallIcon(R.drawable.umpoint_sniper_icon)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(Notification.BigTextStyle().bigText(body))
                    .setContentIntent(open)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }
}
