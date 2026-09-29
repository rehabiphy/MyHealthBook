package com.myhealthbook.pdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import kotlin.concurrent.thread

/* Turns a downloaded PDF report into one JPEG per page, so the app can
   show it in its own viewer (src/components/ReportViewer.jsx) — Android's
   WebView can't display PDFs, and sending a health report to an online
   viewer isn't an option. Uses the platform PdfRenderer: no library,
   works offline.

   Only files inside the app's own cache folder are read, and the pages
   are written next to them; the viewer deletes both when it closes. */
class PdfPagesModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val MAX_PAGES = 60 // a report longer than this shows its first 60 pages
    private const val MAX_WIDTH = 1600 // px — sharp enough to zoom into, small enough to keep memory sane
  }

  override fun getName() = "PdfPages"

  /** Resolves { pages: [{ uri, width, height }], pageCount, truncated }. */
  @ReactMethod
  fun render(pdfPath: String, outDir: String, widthPx: Double, promise: Promise) {
    val cache = reactContext.cacheDir.canonicalFile
    val pdf = File(pdfPath.removePrefix("file://")).canonicalFile
    val out = File(outDir.removePrefix("file://")).canonicalFile
    if (!pdf.path.startsWith(cache.path + File.separator) || !out.path.startsWith(cache.path + File.separator)) {
      promise.reject("E_PDF_PATH", "Only files in the app's cache can be opened")
      return
    }

    thread(name = "PdfPages") {
      var fd: ParcelFileDescriptor? = null
      var renderer: PdfRenderer? = null
      try {
        out.mkdirs()
        fd = ParcelFileDescriptor.open(pdf, ParcelFileDescriptor.MODE_READ_ONLY)
        renderer = PdfRenderer(fd)
        val width = widthPx.toInt().coerceIn(600, MAX_WIDTH)
        val count = renderer.pageCount
        val pages = Arguments.createArray()

        for (i in 0 until minOf(count, MAX_PAGES)) {
          renderer.openPage(i).use { page ->
            val height = (width.toFloat() * page.height / page.width).toInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            try {
              bmp.eraseColor(Color.WHITE) // PDF pages render onto transparency; a report reads on white
              page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              val file = File(out, "page-${i + 1}.jpg")
              FileOutputStream(file).use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }
              pages.pushMap(
                Arguments.createMap().apply {
                  putString("uri", "file://${file.path}")
                  putInt("width", width)
                  putInt("height", height)
                },
              )
            } finally {
              bmp.recycle() // one page's bitmap at a time, never the whole document
            }
          }
        }

        promise.resolve(
          Arguments.createMap().apply {
            putArray("pages", pages)
            putInt("pageCount", count)
            putBoolean("truncated", count > MAX_PAGES)
          },
        )
      } catch (e: SecurityException) {
        promise.reject("E_PDF_LOCKED", "This PDF is password-protected, so it can't be previewed here", e)
      } catch (e: OutOfMemoryError) {
        promise.reject("E_PDF_MEMORY", "This PDF is too large to preview on this phone", e)
      } catch (e: Exception) {
        promise.reject("E_PDF_INVALID", "This PDF couldn't be opened — the file may be damaged", e)
      } finally {
        runCatching { renderer?.close() }
        runCatching { fd?.close() }
      }
    }
  }
}
