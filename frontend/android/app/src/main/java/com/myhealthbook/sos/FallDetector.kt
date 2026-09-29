package com.myhealthbook.sos

import android.util.Log
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sqrt

/* Recognises a drop from raw accelerometer samples, in three phases:

     free fall  — total acceleration near 0 g for a moment (the phone is
                  falling, so it feels weightless)
     impact     — a sharp spike soon after (it hit the floor)
     stillness  — then it lies still for a while (nobody picked it up)

   A phone tossed on a sofa and grabbed straight back fails the last
   step, which is what keeps everyday handling from paging the family.
   Every threshold is here so they can be tuned from real drop tests. */
class FallDetector(private val onFall: () -> Unit) {
  companion object {
    private const val GRAVITY = 9.80665f
    /* Real drops on a Galaxy S20 bottomed out at only 0.31–0.38 g (the
       phone leaves the hand tilted or spinning, so it never reads a
       clean 0 g) and stayed under 0.45 g for just ~40 ms — while the
       impacts were a clear 4–5 g. Hence a loose free-fall test; the
       impact + stillness steps are what keep walking/running out.

       Tightened after real use paged the family too often: setting the
       phone down briskly or tossing it on a bed/sofa passed every step.
       Those dip to ~0.5 g at best (FREE_FALL_DEPTH_G), land softly
       (IMPACT_G) and usually get picked up within a couple of seconds
       (STILL_MS, plus the orientation check — a phone picked up and held
       steady still reads ~1 g, but it no longer points the same way). */
    const val FREE_FALL_G = 0.6f
    const val FREE_FALL_DEPTH_G = 0.45f // and it must dip at least this low somewhere in the free fall
    const val FREE_FALL_MIN_MS = 80L
    const val IMPACT_G = 3.0f
    const val IMPACT_WINDOW_MS = 1000L // impact must follow free fall within this
    const val SETTLE_MS = 500L // bounces after impact, ignored
    const val STILL_MS = 3000L // then it has to stay put this long
    const val STILL_TOLERANCE_G = 0.25f // allowed wobble around 1 g while "still"
    const val STILL_TILT_DEG = 20.0 // allowed change in which way is "down" while "still"
    const val COOLDOWN_MS = 60_000L // one alert per minute at most
    private val STILL_TILT_COS = cos(Math.toRadians(STILL_TILT_DEG)).toFloat()
  }

  private enum class Phase { IDLE, FREE_FALL, AWAIT_IMPACT, AWAIT_STILL }

  private var phase = Phase.IDLE
  private var freeFallStart = 0L
  private var freeFallMinG = 99f
  private var impactDeadline = 0L
  private var stillStart = 0L
  // unit gravity vector at the start of the still check, taken from the first sample after settling
  private var restX = 0f
  private var restY = 0f
  private var restZ = 0f
  private var haveRest = false
  private var lastFallAt = -COOLDOWN_MS
  private var peakG = 0f // strongest reading while waiting for the impact — logged when there wasn't one

  // for tuning from real drops: adb logcat -s FallDetector
  private fun log(msg: String) = Log.d("FallDetector", msg)

  // per-second min/max, logged only for seconds with something unusual in them
  private var winStart = 0L
  private var winMin = 99f
  private var winMax = 0f

  private fun trace(g: Float, tMs: Long) {
    winMin = minOf(winMin, g)
    winMax = maxOf(winMax, g)
    if (tMs - winStart >= 1000) {
      if (winMin < 0.7f || winMax > 1.8f) log("1s window: min ${"%.2f".format(winMin)} g, max ${"%.2f".format(winMax)} g [$phase]")
      winStart = tMs
      winMin = 99f
      winMax = 0f
    }
  }

  /** [tMs] is the sensor's own event time in ms — batched samples arrive in bursts. */
  fun onSample(x: Float, y: Float, z: Float, tMs: Long) {
    val g = sqrt(x * x + y * y + z * z) / GRAVITY
    trace(g, tMs)

    when (phase) {
      Phase.IDLE -> if (g < FREE_FALL_G) {
        phase = Phase.FREE_FALL
        freeFallStart = tMs
        freeFallMinG = g
      }

      Phase.FREE_FALL -> if (g < FREE_FALL_G) {
        freeFallMinG = minOf(freeFallMinG, g)
      } else {
        val ms = tMs - freeFallStart
        if (ms >= FREE_FALL_MIN_MS && freeFallMinG <= FREE_FALL_DEPTH_G) {
          log("free fall ${ms} ms, low ${"%.2f".format(freeFallMinG)} g — waiting for impact")
          phase = Phase.AWAIT_IMPACT
          impactDeadline = tMs + IMPACT_WINDOW_MS
          peakG = 0f
          checkImpact(g, tMs) // the first sample out of free fall is often the impact itself
        } else {
          if (ms >= 20) log("free fall rejected: ${ms} ms (need $FREE_FALL_MIN_MS), low ${"%.2f".format(freeFallMinG)} g (need $FREE_FALL_DEPTH_G)")
          phase = Phase.IDLE
        }
      }

      Phase.AWAIT_IMPACT -> checkImpact(g, tMs)

      Phase.AWAIT_STILL -> {
        if (tMs < stillStart) return
        if (abs(g - 1f) > STILL_TOLERANCE_G) {
          log("moved after impact (${"%.2f".format(g)} g at ${tMs - stillStart} ms into the still check) — not alerting")
          phase = Phase.IDLE // picked up or still moving — not a fall we alert on
          return
        }
        val n = g * GRAVITY
        val ux = x / n
        val uy = y / n
        val uz = z / n
        if (!haveRest) {
          restX = ux
          restY = uy
          restZ = uz
          haveRest = true
        } else if (ux * restX + uy * restY + uz * restZ < STILL_TILT_COS) {
          log("turned after impact (${tMs - stillStart} ms into the still check) — picked up, not alerting")
          phase = Phase.IDLE
        } else if (tMs - stillStart >= STILL_MS) {
          phase = Phase.IDLE
          if (tMs - lastFallAt >= COOLDOWN_MS) {
            log("FALL — lay still ${STILL_MS} ms, raising SOS")
            lastFallAt = tMs
            onFall()
          } else {
            log("fall ignored — cooldown, ${(COOLDOWN_MS - (tMs - lastFallAt)) / 1000} s left")
          }
        }
      }
    }
  }

  private fun checkImpact(g: Float, tMs: Long) {
    peakG = maxOf(peakG, g)
    if (g >= IMPACT_G) {
      log("impact ${"%.2f".format(g)} g — checking it lies still")
      phase = Phase.AWAIT_STILL
      stillStart = tMs + SETTLE_MS
      haveRest = false
    } else if (tMs > impactDeadline) {
      log("no impact: peak ${"%.2f".format(peakG)} g (need $IMPACT_G)")
      phase = Phase.IDLE
    }
  }
}
