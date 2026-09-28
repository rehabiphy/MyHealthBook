package com.myhealthbook.sos

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference
import kotlin.concurrent.thread

/* Native → JS events ("SosRaised", "SosChanged", "SosEnded") so an open
   app can update its SOS screens straight away. No-op when JS isn't running. */
object SosEvents {
  internal var context: WeakReference<ReactApplicationContext>? = null

  fun emit(name: String, alertId: String) {
    val ctx = context?.get() ?: return
    if (!ctx.hasActiveReactInstance()) return
    runCatching { ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, alertId) }
  }
}

/* JS side: src/lib/sosNative.js */
class SosModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  init {
    SosEvents.context = WeakReference(reactContext)
    SosNotifications.ensureChannels(reactContext)
  }

  override fun getName() = "SosModule"

  /** Kept current by AuthContext — the native side makes API calls with it while the app is killed. */
  @ReactMethod
  fun configure(apiBaseUrl: String, token: String?) {
    SosPrefs.setSession(reactContext, apiBaseUrl, token)
    if (token == null) {
      // signed out: no one to raise an SOS as
      SosPrefs.setFallEnabled(reactContext, false)
      FallDetectionService.stop(reactContext)
    }
  }

  @ReactMethod
  fun setFallDetection(enabled: Boolean, promise: Promise) {
    try {
      SosPrefs.setFallEnabled(reactContext, enabled)
      if (enabled) FallDetectionService.start(reactContext) else FallDetectionService.stop(reactContext)
      /* The service comes up asynchronously — resolve once it has (or
         after 3 s), so the status JS reads next is already accurate. */
      thread {
        var waited = 0
        while (FallDetectionService.running != enabled && waited < 3000) {
          Thread.sleep(100)
          waited += 100
        }
        promise.resolve(FallDetectionService.running)
      }
    } catch (e: Exception) {
      SosPrefs.setFallEnabled(reactContext, false)
      promise.reject("E_FALL_DETECTION", e.message ?: "Couldn't start fall detection", e)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val power = reactContext.getSystemService(PowerManager::class.java)
    val nm = reactContext.getSystemService(NotificationManager::class.java)
    promise.resolve(
      Arguments.createMap().apply {
        putBoolean("fallEnabled", SosPrefs.fallEnabled(reactContext))
        putBoolean("fallRunning", FallDetectionService.running)
        putBoolean("batteryUnrestricted", power.isIgnoringBatteryOptimizations(reactContext.packageName))
        putBoolean("fullScreenAllowed", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent())
      },
    )
  }

  /** Called by the FCM handlers (foreground and killed-app) for a type "sos" push. */
  @ReactMethod
  fun startAlarm(data: ReadableMap) {
    SosAlarmService.start(
      reactContext,
      SosAlarmService.Alert(
        id = data.getString("alertId") ?: return,
        fromName = data.getString("fromName") ?: "Family",
        trigger = data.getString("trigger") ?: "fall",
        sentAt = data.getString("sentAt")?.toLongOrNull() ?: System.currentTimeMillis(),
        expiresAt = data.getString("expiresAt")?.toLongOrNull() ?: (System.currentTimeMillis() + 30_000L),
      ),
    )
  }

  /** A type "sos_end" push — the sender cancelled or the window ran out. */
  @ReactMethod
  fun endAlarm(data: ReadableMap) {
    SosAlarmService.end(
      reactContext,
      data.getString("alertId") ?: return,
      data.getString("reason") ?: "expired",
      data.getString("fromName") ?: "Family",
      data.getString("sentAt")?.toLongOrNull() ?: System.currentTimeMillis(),
    )
  }

  // the in-app SOS screen's buttons do the same as the notification's
  @ReactMethod
  fun silenceAlarm(alertId: String) = SosAlarmService.silence(reactContext, alertId)

  @ReactMethod
  fun dismissAlarm(alertId: String) = SosAlarmService.dismiss(reactContext, alertId)

  @ReactMethod
  fun cancelMySos(alertId: String) = SosSender.cancel(reactContext, alertId)

  // "Simulate a fall": runs the exact native path a real fall takes
  @ReactMethod
  fun simulateFall() = SosSender.raise(reactContext, "fall")

  @ReactMethod
  fun testAlarm() = SosAlarmService.test(reactContext)

  @ReactMethod
  fun openBatterySettings() {
    // the list screen, not the direct "allow" prompt — that one is restricted by Play policy
    openSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
  }

  @ReactMethod
  fun openFullScreenSettings() {
    if (Build.VERSION.SDK_INT >= 34) {
      openSettings(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${reactContext.packageName}")))
    }
  }

  @ReactMethod
  fun openAppSettings() {
    openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${reactContext.packageName}")))
  }

  private fun openSettings(intent: Intent) {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      reactContext.startActivity(intent)
    } catch (e: Exception) {
      reactContext.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${reactContext.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }
  }

  // required by NativeEventEmitter on the JS side
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}
}
