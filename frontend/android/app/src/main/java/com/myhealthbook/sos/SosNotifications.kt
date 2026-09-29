package com.myhealthbook.sos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.myhealthbook.MainActivity
import com.myhealthbook.R
import java.text.DateFormat
import java.util.Date

object SosNotifications {
  // family phones: the ringing alert. Silent channel — SosAlarmService plays the buzzer itself on the alarm stream.
  const val CH_ALARM = "sos_alarm"
  // same alert when the service can't start: the channel plays the buzzer, on the alarm stream
  const val CH_ALARM_FALLBACK = "sos_alarm_fallback"
  // the faller's own phone: "SOS sent — Cancel"
  const val CH_SENDER = "sos_sender"
  // quiet follow-ups: cancelled / not answered / missed
  const val CH_INFO = "sos_info"
  // the always-on "Fall detection is on" notification the background service must show
  const val CH_MONITOR = "fall_detection"

  const val ID_ALARM = 7001
  const val ID_SENDER = 7002
  const val ID_MONITOR = 7003

  const val EXTRA_ALERT_ID = "sosAlertId"

  fun buzzerUri(ctx: Context): Uri = Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${ctx.packageName}/${R.raw.sos_buzzer}")

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val alarmAudio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    nm.createNotificationChannels(
      listOf(
        NotificationChannel(CH_ALARM, "Family SOS alerts", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Rings when someone in your family circle may have fallen"
          setSound(null, null)
          enableVibration(false)
          setBypassDnd(true)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        },
        NotificationChannel(CH_ALARM_FALLBACK, "Family SOS alerts (backup)", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Used if the SOS alarm can't start normally"
          setSound(buzzerUri(ctx), alarmAudio)
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800)
          setBypassDnd(true)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        },
        NotificationChannel(CH_SENDER, "Your SOS", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Shown when this phone detects a fall and alerts your family"
          enableVibration(true)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        },
        NotificationChannel(CH_INFO, "SOS updates", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "When an SOS is cancelled or goes unanswered"
        },
        NotificationChannel(CH_MONITOR, "Fall detection", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown while fall detection is running"
          setShowBadge(false)
        },
      ),
    )
  }

  /** Opens the app; with an alert id it's also allowed over the lock screen (see MainActivity). */
  fun openAppIntent(ctx: Context, alertId: String?, requestCode: Int): PendingIntent {
    val intent = Intent(ctx, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      if (alertId != null) putExtra(EXTRA_ALERT_ID, alertId)
    }
    return PendingIntent.getActivity(ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun actionIntent(ctx: Context, action: String, alertId: String?, requestCode: Int): PendingIntent {
    val intent = Intent(ctx, SosActionReceiver::class.java).apply {
      this.action = action
      putExtra(EXTRA_ALERT_ID, alertId)
    }
    return PendingIntent.getBroadcast(ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Opens a Google Maps link — in the Maps app when it's installed, the browser otherwise. */
  fun mapsIntent(ctx: Context, mapsUrl: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(mapsUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun base(ctx: Context, channel: String): NotificationCompat.Builder =
    NotificationCompat.Builder(ctx, channel).setSmallIcon(R.drawable.ic_sos_notification).setColor(0xFFE11D48.toInt())

  /** A quiet one-off update, one per alert so "cancelled" replaces "not answered" rather than stacking. */
  fun postInfo(ctx: Context, alertId: String, title: String, text: String, mapsUrl: String? = null) {
    ensureChannels(ctx)
    val n = base(ctx, CH_INFO)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setContentIntent(openAppIntent(ctx, null, alertId.hashCode()))
      .setAutoCancel(true)
      .apply { if (mapsUrl != null) addAction(0, "Open location", mapsIntent(ctx, mapsUrl, alertId.hashCode() + 1)) }
      .build()
    notify(ctx, infoId(alertId), n)
  }

  fun infoId(alertId: String) = 8000 + (alertId.hashCode() and 0xFFFF)

  fun notify(ctx: Context, id: Int, n: android.app.Notification) {
    try {
      NotificationManagerCompat.from(ctx).notify(id, n)
    } catch (e: SecurityException) {
      // notification permission revoked — nothing we can show
    }
  }

  fun cancel(ctx: Context, id: Int) = NotificationManagerCompat.from(ctx).cancel(id)

  fun clock(ms: Long): String = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(ms))
}
