package com.myhealthbook.sos

import android.content.Context
import android.content.SharedPreferences

/* What the native SOS code needs while the JS app isn't running: where
   the API lives, the signed-in session token, and whether the user
   switched fall detection on. JS keeps these current via SosModule. */
object SosPrefs {
  private const val FILE = "myhealthbook_sos"
  private const val KEY_API = "apiBaseUrl"
  private const val KEY_TOKEN = "token"
  private const val KEY_FALL = "fallEnabled"
  private const val KEY_PENDING_CANCEL = "pendingCancel"

  private fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun apiBaseUrl(ctx: Context): String? = prefs(ctx).getString(KEY_API, null)
  fun token(ctx: Context): String? = prefs(ctx).getString(KEY_TOKEN, null)

  fun setSession(ctx: Context, apiBaseUrl: String?, token: String?) {
    prefs(ctx).edit().putString(KEY_API, apiBaseUrl).putString(KEY_TOKEN, token).apply()
  }

  fun fallEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_FALL, false)
  fun setFallEnabled(ctx: Context, on: Boolean) {
    prefs(ctx).edit().putBoolean(KEY_FALL, on).apply()
  }

  // "Cancel" tapped while the SOS request was still in flight — the sender drops it
  fun pendingCancel(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_PENDING_CANCEL, false)
  fun setPendingCancel(ctx: Context, on: Boolean) {
    prefs(ctx).edit().putBoolean(KEY_PENDING_CANCEL, on).commit()
  }
}
