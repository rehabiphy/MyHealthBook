package com.myhealthbook.sos

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/* Buttons on the SOS notifications. Handled natively so they work with
   the app killed — no JS has to start for a tap to take effect. */
class SosActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_SILENCE = "com.myhealthbook.sos.SILENCE"
    const val ACTION_DISMISS = "com.myhealthbook.sos.DISMISS"
    const val ACTION_CANCEL = "com.myhealthbook.sos.CANCEL"
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    val alertId = intent.getStringExtra(SosNotifications.EXTRA_ALERT_ID)
    when (intent.action) {
      ACTION_SILENCE -> alertId?.let { SosAlarmService.silence(ctx, it) }
      ACTION_DISMISS -> alertId?.let { SosAlarmService.dismiss(ctx, it) }
      ACTION_CANCEL -> SosSender.cancel(ctx, alertId)
    }
    alertId?.let { SosEvents.emit("SosChanged", it) }
  }
}
