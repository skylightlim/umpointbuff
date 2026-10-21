package expo.modules.umpointsniper

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * The phone's Chrome user agent without the WebView markers. Google refuses sign-in in a page
 * that says it is a WebView ("; wv"), so the sign-in sheet and every request use this.
 */
fun browserUserAgent(ctx: Context): String =
  WebSettings.getDefaultUserAgent(ctx).replace("; wv", "").replace(Regex("Version/\\d+(\\.\\d+)* "), "")

/**
 * HTTP to UMPoint over the WebView's cookie store, which the sign-in sheet and React Native's
 * fetch also use — one session for the whole app.
 */
class UmpointHttp(private val ctx: Context) {
  val ua = browserUserAgent(ctx)
  private val cookies = CookieManager.getInstance()

  class Resp(val url: String, val code: Int, val location: String?, val date: Long?, val body: String, val sentAt: Long, val receivedAt: Long)

  fun request(
    url: String,
    body: ByteArray? = null,
    contentType: String? = null,
    referer: String? = null,
  ): Resp {
    val conn = URL(url).openConnection() as HttpURLConnection
    try {
      conn.instanceFollowRedirects = false
      conn.connectTimeout = 10_000
      conn.readTimeout = 20_000
      conn.useCaches = false
      conn.setRequestProperty("User-Agent", ua)
      conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
      cookies.getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
      if (referer != null) {
        conn.setRequestProperty("Referer", referer)
        conn.setRequestProperty("Origin", Umpoint.BASE)
      }
      val sentAt = System.currentTimeMillis()
      if (body != null) {
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", contentType)
        conn.setFixedLengthStreamingMode(body.size)
        conn.outputStream.use { it.write(body) }
      }
      val code = conn.responseCode
      val receivedAt = System.currentTimeMillis()
      for ((k, v) in conn.headerFields) {
        if (k != null && k.equals("Set-Cookie", ignoreCase = true)) v.forEach { cookies.setCookie(url, it) }
      }
      val stream = if (code >= 400) conn.errorStream else conn.inputStream
      val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
      val date = conn.getHeaderFieldDate("Date", 0L).takeIf { it > 0 }
      return Resp(url, code, conn.getHeaderField("Location"), date, text, sentAt, receivedAt)
    } finally {
      conn.disconnect()
    }
  }

  private fun form(vararg fields: Pair<String, String>): ByteArray =
    fields.joinToString("&") { (k, v) -> URLEncoder.encode(k, "UTF-8") + "=" + URLEncoder.encode(v, "UTF-8") }
      .toByteArray()

  /** true = signed in, false = bounced to the login page, null = couldn't reach UMPoint. */
  fun sessionAlive(): Boolean? = try {
    val r = request("${Umpoint.BASE}/modules/dashboard/")
    when {
      r.code in 300..399 -> !(r.location ?: "").contains("/login")
      r.code == 200 -> !r.body.contains("name=\"usrpasswd\"")
      else -> null
    }
  } catch (e: Exception) {
    null
  }

  /** The "UM Staff and Student" Google OAuth link from the login page. */
  fun oauthUrl(): String? = runCatching {
    val r = request("${Umpoint.BASE}/login/")
    Regex("href=\"(https://accounts\\.google\\.com/o/oauth2/auth[^\"]+)\"").find(r.body)
      ?.groupValues?.get(1)?.replace("&amp;", "&")
  }.getOrNull()

  /**
   * Signs in again without the user: follows Google's OAuth redirects with the Google cookies the
   * sign-in sheet left behind. Works while that Google session lasts and needs no account picker.
   */
  fun renewByRedirects(oauth: String): Boolean = try {
    var url = oauth
    var landed = false
    for (hop in 0 until 12) {
      val r = request(url)
      val loc = r.location
      if (r.code in 300..399 && loc != null) {
        url = URL(URL(url), loc).toString()
        continue
      }
      landed = url.startsWith(Umpoint.BASE) && !url.contains("/login")
      break
    }
    landed && sessionAlive() == true
  } catch (e: Exception) {
    false
  }

  /** Same as [renewByRedirects] but in an off-screen WebView, for when Google wants JavaScript. */
  @SuppressLint("SetJavaScriptEnabled")
  fun renewInWebView(oauth: String, timeoutMs: Long = 45_000): Boolean {
    val done = CountDownLatch(1)
    val main = Handler(Looper.getMainLooper())
    var web: WebView? = null
    main.post {
      try {
        web = WebView(ctx).apply {
          settings.javaScriptEnabled = true
          settings.domStorageEnabled = true
          settings.userAgentString = ua
          webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
              if (url.startsWith(Umpoint.BASE) && !url.contains("/login") && !url.contains("/google/")) done.countDown()
            }
          }
          loadUrl(oauth)
        }
      } catch (t: Throwable) {
        done.countDown()
      }
    }
    done.await(timeoutMs, TimeUnit.MILLISECONDS)
    main.post { web?.destroy() }
    cookies.flush()
    return sessionAlive() == true
  }

  /** The week grid of [court]: [weekTs] is the week's Monday 00:00 MYT in seconds; calflag t = this week, n = next. */
  fun grid(court: String, weekTs: Long, calflag: String, today: String): Grid {
    val r = request(
      "${Umpoint.BASE}/modules/mbook/",
      form(
        "act" to "bookweek", "doproc" to "0", "spid" to Umpoint.SPID.getValue(court), "theday" to weekTs.toString(),
        "calflag" to calflag, "initdate" to today, "recnum" to "0", "inputo" to "sdbook",
      ),
      "application/x-www-form-urlencoded",
    )
    if (r.code in 300..399) throw SessionExpired()
    return Grid.parse(r.body)
  }

  fun submitBooking(fields: List<Pair<String, String?>>): Resp {
    val boundary = "----WebKitFormBoundary" + List(16) { "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
    return request(
      "${Umpoint.BASE}/modules/mbook/index.php",
      Umpoint.multipart(fields, boundary),
      "multipart/form-data; boundary=$boundary",
      referer = "${Umpoint.BASE}/modules/mbook/",
    )
  }

  fun clearSession() {
    // Expire UMPoint's cookies only; the Google cookies stay so signing back in is one tap.
    for (name in listOf("PHPSESSID", "cookiesession1")) {
      cookies.setCookie(Umpoint.BASE, "$name=; Max-Age=0; Path=/")
    }
    cookies.flush()
  }
}

class SessionExpired : Exception("UMPoint session expired")
