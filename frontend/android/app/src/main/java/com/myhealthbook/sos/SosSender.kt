package com.myhealthbook.sos

import android.content.Context
import android.os.PowerManager
import org.json.JSONObject
import kotlin.concurrent.thread

/* The faller's side: raise the SOS with the server and keep a "Cancel"
   notification up for the 30 s window. Runs entirely natively so it
   works with the app killed. */
object SosSender {
  private const val ATTEMPTS = 4
  private const val RETRY_MS = 3000L

  fun raise(ctx: Context, trigger: String) {
    val app = ctx.applicationContext
    SosNotifications.ensureChannels(app)
    SosPrefs.setPendingCancel(app, false)
    // shown before the network call so there's a Cancel button from the very first second
    notifySender(app, "Fall detected", "Alerting your family… Tap Cancel if you're OK.", alertId = null, expiresAt = null)

    thread {
      val wake = app.getSystemService(PowerManager::class.java)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MyHealthBook:SosSend")
        .apply { acquire(120_000L) } // location wait + every retry at full timeout
      try {
        send(app, trigger)
      } finally {
        if (wake.isHeld) wake.release()
      }
    }
  }

  private fun send(app: Context, trigger: String) {
    // up to a few seconds — worth it so the family knows where to go; the SOS goes out without it if there's none
    val location = runCatching { SosLocation.current(app) }.getOrNull()
    val body = JSONObject().put("trigger", trigger).apply { if (location != null) put("location", location) }

    var res = SosApi.Result(-1, null)
    for (i in 0 until ATTEMPTS) {
      if (SosPrefs.pendingCancel(app)) return finishCancelledBeforeSend(app)
      res = SosApi.post(app, "/api/sos", body)
      if (res.code != -1) break
      if (i < ATTEMPTS - 1) Thread.sleep(RETRY_MS)
    }
    // Cancel tapped during the last attempt, and it never reached the server
    if (!res.ok && SosPrefs.pendingCancel(app)) return finishCancelledBeforeSend(app)

    val alert = if (res.ok) res.body?.optJSONObject("alert") else null
    val id = alert?.optString("id")?.takeIf { it.isNotBlank() }
    when {
      alert != null && id != null -> {
        if (SosPrefs.pendingCancel(app)) {
          // Cancel was tapped while the request was in flight — call it off straight away
          SosApi.post(app, "/api/sos/$id/cancel")
          return finishCancelledBeforeSend(app)
        }
        val count = alert.optJSONArray("recipients")?.length() ?: 0
        val expiresAt = parseIso(alert.optString("expiresAt")) ?: (System.currentTimeMillis() + 30_000L)
        val where = if (alert.optJSONObject("location") != null) " with your location" else " (location unavailable)"
        notifySender(app, "SOS sent to $count family member${if (count == 1) "" else "s"}", "Sent$where. Tap Cancel if you're OK.", id, expiresAt)
        SosEvents.emit("SosRaised", id)
      }
      res.code == 0 || res.code == 401 ->
        notifySender(app, "Fall detected, but you're signed out", "Open MyHealthBook and sign in to keep fall detection working.", null, null, done = true)
      res.ok ->
        // unexpected reply — don't leave the ongoing "Alerting your family…" notification up forever
        notifySender(app, "Fall detected", "Your SOS may not have gone out. Open MyHealthBook or call someone if you need help.", null, null, done = true)
      res.code == 409 ->
        notifySender(app, "Fall detected", "No one in your family circle to alert. Add family in MyHealthBook.", null, null, done = true)
      else ->
        notifySender(app, "Couldn't send your SOS", "Fall detected but there's no internet connection. Call someone if you need help.", null, null, done = true)
    }
  }

  /** Cancel button on the sender notification. [alertId] is null while the request is still in flight. */
  fun cancel(ctx: Context, alertId: String?) {
    val app = ctx.applicationContext
    if (alertId == null) {
      SosPrefs.setPendingCancel(app, true)
      notifySender(app, "Cancelling…", "Your family won't be alerted.", null, null, done = true)
      return
    }
    notifySender(app, "Cancelling SOS…", "Telling your family you're OK.", null, null, done = true)
    thread {
      val res = SosApi.post(app, "/api/sos/$alertId/cancel")
      if (res.ok) {
        notifySender(app, "SOS cancelled", "Your family has been told you're OK.", null, null, done = true)
        SosEvents.emit("SosEnded", alertId)
      } else {
        // keep the Cancel button so it can be tried again
        notifySender(app, "Couldn't cancel the SOS", "No connection. Try again, or let your family know you're OK.", alertId, null)
      }
    }
  }

  private fun finishCancelledBeforeSend(app: Context) {
    SosPrefs.setPendingCancel(app, false)
    notifySender(app, "SOS cancelled", "Your family wasn't alerted.", null, null, done = true)
  }

  private fun notifySender(app: Context, title: String, text: String, alertId: String?, expiresAt: Long?, done: Boolean = false) {
    val b = SosNotifications.base(app, SosNotifications.CH_SENDER)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)
      .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
      .setContentIntent(SosNotifications.openAppIntent(app, alertId, 2))
      .setOnlyAlertOnce(true)
      .setOngoing(!done)
      .setAutoCancel(done)
    if (!done) {
      b.addAction(0, "I'm OK — Cancel", SosNotifications.actionIntent(app, SosActionReceiver.ACTION_CANCEL, alertId, 21))
    }
    if (expiresAt != null) {
      b.setWhen(expiresAt).setUsesChronometer(true).setChronometerCountDown(true)
      b.setTimeoutAfter(maxOf(1000L, expiresAt - System.currentTimeMillis()))
    } else if (done) {
      b.setTimeoutAfter(60_000L)
    }
    SosNotifications.notify(app, SosNotifications.ID_SENDER, b.build())
  }

  private fun parseIso(s: String?): Long? {
    if (s.isNullOrBlank()) return null
    // java.time needs API 26; minSdk is 24. The API sends Date.toISOString(): 2026-09-28T17:38:53.123Z
    val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
    return runCatching { fmt.parse(s)?.time }.getOrNull()
  }
}
