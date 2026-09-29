package com.myhealthbook.sos

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import kotlin.concurrent.thread

/* Rings a family member's phone for an incoming SOS.

   Runs as a foreground service so the buzzer keeps playing for the whole
   window even with the app killed, and plays it on the ALARM stream —
   notification sounds are muted when the phone is on silent, alarms are
   not. Silence / Dismiss only affect this phone; the sender is told via
   /ack so they can see who has seen it. */
class SosAlarmService : Service() {
  data class Alert(
    val id: String,
    val fromName: String,
    val trigger: String,
    val sentAt: Long,
    val expiresAt: Long,
    val test: Boolean = false,
    val mapsUrl: String? = null, // Google Maps link to where the sender's phone was, when it had a fix
  )

  companion object {
    private const val ACTION_START = "com.myhealthbook.sos.START_ALARM"
    private const val ACTION_TEST = "com.myhealthbook.sos.TEST_ALARM"
    private const val TEST_MS = 8000L

    @Volatile var instance: SosAlarmService? = null
      private set

    // SosModule calls in on React Native's module thread; the player and timers belong to the main thread
    private val main = Handler(Looper.getMainLooper())

    fun start(ctx: Context, alert: Alert) {
      if (alert.expiresAt <= System.currentTimeMillis()) {
        // arrived after the window (phone was offline) — tell, don't ring
        SosNotifications.postInfo(ctx, alert.id, "Missed SOS from ${alert.fromName}", "${whatHappened(alert)} at ${SosNotifications.clock(alert.sentAt)}. Check on them.", alert.mapsUrl)
        return
      }
      val intent = Intent(ctx, SosAlarmService::class.java).apply {
        action = ACTION_START
        putExtra("alert", toJson(alert).toString())
      }
      try {
        ContextCompat.startForegroundService(ctx, intent)
      } catch (e: Exception) {
        // Android refused a background start (ForegroundServiceStartNotAllowedException) —
        // fall back to a notification whose channel plays the buzzer itself
        postFallback(ctx, alert)
      }
    }

    fun test(ctx: Context) {
      val now = System.currentTimeMillis()
      val intent = Intent(ctx, SosAlarmService::class.java).apply {
        action = ACTION_TEST
        putExtra("alert", toJson(Alert("test", "Test", "fall", now, now + TEST_MS, test = true)).toString())
      }
      ContextCompat.startForegroundService(ctx, intent)
    }

    /** The sender cancelled it or the window ran out — stop ringing and leave a quiet note. */
    fun end(ctx: Context, alertId: String, reason: String, fromName: String, sentAt: Long, mapsUrl: String? = null) {
      main.post { instance?.stopFor(alertId) }
      SosNotifications.cancel(ctx, SosNotifications.ID_ALARM)
      if (reason == "cancelled") {
        SosNotifications.postInfo(ctx, alertId, "$fromName is OK", "$fromName cancelled the SOS from ${SosNotifications.clock(sentAt)}.")
      } else {
        // the moment the family most needs to know where to go
        val where = if (mapsUrl != null) " Tap Open location to see where their phone was." else ""
        SosNotifications.postInfo(ctx, alertId, "SOS from $fromName wasn't cancelled", "Their phone raised an SOS at ${SosNotifications.clock(sentAt)} and they didn't call it off. Check on them.$where", mapsUrl)
      }
    }

    fun silence(ctx: Context, alertId: String) {
      main.post { instance?.let { if (it.current?.id == alertId) it.silence() } }
      ack(ctx, alertId, "silenced")
    }

    fun dismiss(ctx: Context, alertId: String) {
      main.post { instance?.stopFor(alertId) }
      SosNotifications.cancel(ctx, SosNotifications.ID_ALARM)
      ack(ctx, alertId, "dismissed")
    }

    private fun ack(ctx: Context, alertId: String, action: String) {
      if (alertId == "test") return
      val app = ctx.applicationContext
      thread { SosApi.post(app, "/api/sos/$alertId/ack", JSONObject().put("action", action)) }
    }

    private fun whatHappened(a: Alert) = if (a.trigger == "manual") "${a.fromName} pressed SOS" else "${a.fromName}'s phone detected a fall"

    private fun toJson(a: Alert) = JSONObject()
      .put("id", a.id).put("fromName", a.fromName).put("trigger", a.trigger)
      .put("sentAt", a.sentAt).put("expiresAt", a.expiresAt).put("test", a.test)
      .apply { if (a.mapsUrl != null) put("mapsUrl", a.mapsUrl) }

    private fun fromJson(s: String) = JSONObject(s).let {
      Alert(
        it.getString("id"), it.getString("fromName"), it.getString("trigger"), it.getLong("sentAt"), it.getLong("expiresAt"), it.optBoolean("test"),
        it.optString("mapsUrl").takeIf { u -> u.isNotBlank() },
      )
    }

    private fun build(ctx: Context, a: Alert, ringing: Boolean, channel: String = SosNotifications.CH_ALARM): android.app.Notification {
      SosNotifications.ensureChannels(ctx)
      val open = SosNotifications.openAppIntent(ctx, if (a.test) null else a.id, 1)
      return SosNotifications.base(ctx, channel)
        .setContentTitle(if (a.test) "Test alarm" else "SOS · ${a.fromName}")
        .setContentText(if (a.test) "This is what your family will hear" else if (ringing) "${whatHappened(a)}. Check on them." else "Alarm silenced · ${whatHappened(a)}")
        .apply { if (a.mapsUrl != null) addAction(0, "Open location", SosNotifications.mapsIntent(ctx, a.mapsUrl, 13)) }
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setWhen(a.expiresAt)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setContentIntent(open)
        .apply { if (ringing) setFullScreenIntent(open, true) }
        .apply { if (ringing) addAction(0, "Silence", SosNotifications.actionIntent(ctx, SosActionReceiver.ACTION_SILENCE, a.id, 11)) }
        .addAction(0, "Dismiss", SosNotifications.actionIntent(ctx, SosActionReceiver.ACTION_DISMISS, a.id, 12))
        .setTimeoutAfter(maxOf(1000L, a.expiresAt - System.currentTimeMillis()))
        .build()
        .apply { if (channel == SosNotifications.CH_ALARM_FALLBACK) flags = flags or android.app.Notification.FLAG_INSISTENT }
    }

    private fun postFallback(ctx: Context, a: Alert) {
      SosNotifications.notify(ctx, SosNotifications.ID_ALARM, build(ctx, a, ringing = true, channel = SosNotifications.CH_ALARM_FALLBACK))
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var savedAlarmVolume: Int? = null
  private var current: Alert? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val alert = intent?.getStringExtra("alert")?.let { runCatching { fromJson(it) }.getOrNull() }
    if (alert == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    // every startForegroundService() must be answered with startForeground() promptly
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
    try {
      ServiceCompat.startForeground(this, SosNotifications.ID_ALARM, build(this, alert, ringing = true), type)
    } catch (e: Exception) {
      postFallback(this, alert)
      stopSelf()
      return START_NOT_STICKY
    }

    // a newer SOS replaces whatever was ringing
    stopSound()
    handler.removeCallbacksAndMessages(null)
    current = alert
    startSound()
    handler.postDelayed({ onWindowEnded(alert) }, maxOf(0L, alert.expiresAt - System.currentTimeMillis()))
    return START_NOT_STICKY
  }

  private fun onWindowEnded(a: Alert) {
    if (current?.id != a.id) return
    stopFor(a.id)
    // the server's "expired" push posts the same note; this covers a phone that doesn't get it
    if (!a.test) end(this, a.id, "expired", a.fromName, a.sentAt, a.mapsUrl)
  }

  fun silence() {
    val a = current ?: return
    stopSound()
    SosNotifications.notify(this, SosNotifications.ID_ALARM, build(this, a, ringing = false))
  }

  fun stopFor(alertId: String) {
    if (current?.id != alertId) return
    current = null
    handler.removeCallbacksAndMessages(null)
    stopSound()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun startSound() {
    val audio = getSystemService(AudioManager::class.java)
    // an SOS has to be heard: lift the alarm volume to max while it rings, put it back after
    savedAlarmVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
    audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)

    player = try {
      MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(this@SosAlarmService, SosNotifications.buzzerUri(this@SosAlarmService))
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      null
    }

    val pattern = longArrayOf(0, 800, 400)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator()?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    else @Suppress("DEPRECATION") vibrator()?.vibrate(pattern, 0)
  }

  private fun stopSound() {
    player?.runCatching { stop(); release() }
    player = null
    vibrator()?.cancel()
    savedAlarmVolume?.let { getSystemService(AudioManager::class.java).setStreamVolume(AudioManager.STREAM_ALARM, it, 0) }
    savedAlarmVolume = null
  }

  private fun vibrator(): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) getSystemService(VibratorManager::class.java)?.defaultVibrator
    else @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopSound()
    instance = null
    super.onDestroy()
  }
}
