package com.myhealthbook.sos

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Fall detection was on before the phone restarted (or the app updated) — turn it back on.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (SosPrefs.fallEnabled(ctx) && !SosPrefs.token(ctx).isNullOrBlank()) {
      runCatching { FallDetectionService.start(ctx) }
    }
  }
}
