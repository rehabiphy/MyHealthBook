package com.myhealthbook.sos

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/* Watches the accelerometer in the background for as long as the user
   has fall detection on — including with the app swiped away. Android
   only allows that from a foreground service, hence the small permanent
   "Fall detection is on" notification.

   Prefers the wake-up accelerometer with batching: the sensor hub keeps
   collecting while the CPU sleeps and hands over a burst every couple
   of seconds, which costs far less battery than holding the CPU awake.
   Phones without one fall back to a partial wake lock. */
class FallDetectionService : Service(), SensorEventListener {
  companion object {
    private const val SAMPLING_US = 10_000 // 100 Hz — at 50 Hz a short drop's free fall was only 2 samples
    private const val BATCH_US = 2_000_000 // deliver at least every 2 s — the alert is at most that late

    @Volatile var running = false
      private set

    fun start(ctx: Context) {
      ContextCompat.startForegroundService(ctx, Intent(ctx, FallDetectionService::class.java))
    }

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, FallDetectionService::class.java))
    }
  }

  private var sensorManager: SensorManager? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val detector = FallDetector { SosSender.raise(this, "fall") }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    SosNotifications.ensureChannels(this)
    val n = SosNotifications.base(this, SosNotifications.CH_MONITOR)
      .setContentTitle("Fall detection is on")
      .setContentText("If this phone falls, your family gets an SOS")
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setContentIntent(SosNotifications.openAppIntent(this, null, 3))
      .build()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH else 0
    try {
      ServiceCompat.startForeground(this, SosNotifications.ID_MONITOR, n, type)
    } catch (e: Exception) {
      stopSelf()
      return START_NOT_STICKY
    }

    if (!running) {
      val sm = getSystemService(SensorManager::class.java)
      sensorManager = sm
      val wakeUp = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER, true)
      if (wakeUp != null) {
        sm.registerListener(this, wakeUp, SAMPLING_US, BATCH_US)
      } else {
        sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let { sm.registerListener(this, it, SAMPLING_US) }
        wakeLock = getSystemService(PowerManager::class.java)
          .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MyHealthBook:FallDetection")
          .apply { acquire() }
      }
      running = true
    }
    // if Android kills it for memory, bring it back
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent) {
    detector.onSample(event.values[0], event.values[1], event.values[2], event.timestamp / 1_000_000L)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onDestroy() {
    sensorManager?.unregisterListener(this)
    wakeLock?.let { if (it.isHeld) it.release() }
    running = false
    super.onDestroy()
  }
}
