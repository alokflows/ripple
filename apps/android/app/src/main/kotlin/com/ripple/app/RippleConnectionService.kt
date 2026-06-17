package com.ripple.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the Ripple socket (owned by [RippleRepository]) alive when the app's UI
 * is gone and only the keyboard is in use, so received text keeps arriving and
 * the input path never waits to reconnect. Started on pair, stopped on leave.
 */
class RippleConnectionService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val code = intent?.getStringExtra(EXTRA_CODE) ?: RippleRepository.currentCode
        startForeground(NOTIF_ID, buildNotification(code))
        return START_STICKY
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun buildNotification(code: String): Notification {
        ensureChannel(this)
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val detail = if (code.isNotEmpty()) "Code $code · text lands at your cursor" else "Text lands at your cursor"
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_ripple)
            .setContentTitle("Ripple connected")
            .setContentText(detail)
            .setOngoing(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        private const val CHANNEL = "ripple.connection"
        private const val NOTIF_ID = 1
        private const val EXTRA_CODE = "code"

        fun start(ctx: Context, code: String) {
            val i = Intent(ctx, RippleConnectionService::class.java).putExtra(EXTRA_CODE, code)
            ctx.startForegroundService(i)
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, RippleConnectionService::class.java))
        }

        fun ensureChannel(ctx: Context) {
            val mgr = ctx.getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(CHANNEL, "Ripple connection", NotificationManager.IMPORTANCE_LOW)
                )
            }
        }
    }
}
