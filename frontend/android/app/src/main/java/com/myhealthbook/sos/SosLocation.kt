package com.myhealthbook.sos

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Looper
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.function.Consumer

/* Where the phone is, for the SOS the family receives. Uses the platform
   LocationManager (GPS + network) — no Play Services dependency.

   A fall is usually detected with the app in the background, so this
   only works with location allowed "All the time"; with "While using
   the app" Android hands a background caller nothing. No location is
   never a reason to hold the SOS back — it just goes out without one. */
object SosLocation {
  private const val FRESH_TIMEOUT_MS = 8000L // how long a fresh fix may hold up the SOS
  private const val GOOD_ENOUGH_M = 50f // a fix this accurate ends the wait straight away
  private const val RECENT_MS = 60_000L // a last-known fix this recent and accurate is used as-is

  fun hasPermission(ctx: Context) =
    granted(ctx, Manifest.permission.ACCESS_FINE_LOCATION) || granted(ctx, Manifest.permission.ACCESS_COARSE_LOCATION)

  /** "All the time" — what fall detection needs, since falls happen with the app closed. */
  fun hasBackgroundPermission(ctx: Context) =
    hasPermission(ctx) && (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || granted(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION))

  private fun granted(ctx: Context, p: String) = ContextCompat.checkSelfPermission(ctx, p) == PackageManager.PERMISSION_GRANTED

  /** Blocking, up to [FRESH_TIMEOUT_MS] — call off the main thread. The body's `location` field, or null. */
  fun current(ctx: Context): JSONObject? {
    if (!hasPermission(ctx)) return null
    val lm = ctx.getSystemService(LocationManager::class.java) ?: return null
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      .filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
    if (providers.isEmpty()) return null // location switched off in quick settings

    val last = try {
      providers.mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time }
    } catch (e: SecurityException) {
      null
    }
    if (last != null && ageMs(last) < RECENT_MS && last.hasAccuracy() && last.accuracy <= GOOD_ENOUGH_M) return toJson(last)

    val fresh = fresh(lm, providers)
    return toJson(better(fresh, last) ?: return null)
  }

  /* Asks every enabled provider for one update and keeps the best that
     arrives in time: network usually answers within a second or two
     indoors, GPS is slower but pinpoint outdoors. */
  private fun fresh(lm: LocationManager, providers: List<String>): Location? {
    val best = AtomicReference<Location?>(null)
    val done = CountDownLatch(1)
    val pending = AtomicInteger(providers.size)
    val listeners = mutableListOf<LocationListener>()
    val cancel = CancellationSignal()

    // every provider answers once (null = it couldn't get a fix); stop waiting when all have, or one is good enough
    fun offer(loc: Location?) {
      if (loc != null) best.accumulateAndGet(loc) { a, b -> better(a, b) }
      if (pending.decrementAndGet() <= 0 || (loc != null && loc.hasAccuracy() && loc.accuracy <= GOOD_ENOUGH_M)) done.countDown()
    }

    try {
      for (p in providers) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          lm.getCurrentLocation(p, cancel, Executor { it.run() }, Consumer<Location?> { offer(it) })
        } else {
          val l = object : LocationListener {
            override fun onLocationChanged(loc: Location) = offer(loc)
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
          }
          listeners += l
          @Suppress("DEPRECATION")
          lm.requestSingleUpdate(p, l, Looper.getMainLooper())
        }
      }
      done.await(FRESH_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    } catch (e: SecurityException) {
      // permission pulled mid-way — use whatever arrived
    } finally {
      cancel.cancel()
      listeners.forEach { runCatching { lm.removeUpdates(it) } }
    }
    return best.get()
  }

  // the more accurate fix, unless it's much older than the other
  private fun better(a: Location?, b: Location?): Location? {
    if (a == null || b == null) return a ?: b
    if (a.time - b.time > 2 * 60_000L) return a
    if (b.time - a.time > 2 * 60_000L) return b
    val accA = if (a.hasAccuracy()) a.accuracy else Float.MAX_VALUE
    val accB = if (b.hasAccuracy()) b.accuracy else Float.MAX_VALUE
    return if (accB < accA) b else a
  }

  private fun ageMs(l: Location) = System.currentTimeMillis() - l.time

  private fun toJson(l: Location) = JSONObject()
    .put("lat", l.latitude)
    .put("lng", l.longitude)
    .apply { if (l.hasAccuracy()) put("accuracy", l.accuracy.toDouble()) }
    .put("at", l.time)
}
