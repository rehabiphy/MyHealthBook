package com.myhealthbook.sos

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/* Minimal client for the /api/sos routes, used when there's no JS to
   make the call (fall detected or a notification button pressed with
   the app killed). Blocking — always call it off the main thread.
   code -1 = network failure, 0 = not signed in. */
object SosApi {
  data class Result(val code: Int, val body: JSONObject?) {
    val ok get() = code in 200..299
  }

  fun post(ctx: Context, path: String, body: JSONObject = JSONObject()): Result {
    val base = SosPrefs.apiBaseUrl(ctx)
    val token = SosPrefs.token(ctx)
    if (base.isNullOrBlank() || token.isNullOrBlank()) return Result(0, null)

    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(base.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 8000
        readTimeout = 10000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      conn.outputStream.use { it.write(body.toString().toByteArray()) }
      val code = conn.responseCode
      val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }
      Result(code, text?.let { runCatching { JSONObject(it) }.getOrNull() })
    } catch (e: Exception) {
      Result(-1, null)
    } finally {
      conn?.disconnect()
    }
  }
}
