package com.skylightlim.umpoint.ui.components

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearWavyProgressIndicator
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.skylightlim.umpoint.sniper.Umpoint
import com.skylightlim.umpoint.sniper.browserUserAgent
import kotlinx.coroutines.delay

enum class WebViewMode { SIGN_IN, DASHBOARD }

private const val FIRST_PAGE_TIMEOUT_MS = 20_000L
private const val UNREACHABLE = "UMPoint isn’t answering right now. This is on UMPoint’s side, not your phone. Try again later."
private const val OFFLINE = "UMPoint is offline right now, and UM is showing its maintenance page. Try again later."

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun UmpointWebViewDialog(
    mode: WebViewMode,
    reason: String? = null,
    onClose: () -> Unit,
    onSignedIn: () -> Unit,
) {
    val signIn = mode == WebViewMode.SIGN_IN
    val initialUrl = if (signIn) "${Umpoint.BASE}/login/" else "${Umpoint.BASE}/modules/dashboard/"
    var webView by remember { mutableStateOf<WebView?>(null) }
    var loading by remember { mutableStateOf(true) }
    var progress by remember { mutableFloatStateOf(0f) }
    var shownPage by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var blocked by remember { mutableStateOf(false) }
    var finished by remember { mutableStateOf(false) }

    // A server that never answers never finishes loading either, so don't wait on it for ever.
    LaunchedEffect(attempt) {
        delay(FIRST_PAGE_TIMEOUT_MS)
        if (!shownPage && failure == null) {
            webView?.stopLoading()
            failure = UNREACHABLE
        }
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Rounded.Close, contentDescription = "Close")
                    }
                    Text(
                        if (signIn) "Sign in to UMPoint" else "My UMPoint Bookings",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.width(48.dp))
                }

                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (reason != null) {
                        Note(reason, NoteTone.ERROR)
                    }
                    Text(
                        if (signIn) {
                            "Tap “UM Staff and Student” and sign in with your SiswaMail."
                        } else {
                            "Live UMPoint dashboard. Cancelling here updates your local bookings when you close this sheet."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (blocked) {
                        Text(
                            "Google refused to sign in inside the app. Check your network or the WebView user agent.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }

                Box(Modifier.fillMaxWidth().weight(1f).padding(top = 8.dp)) {
                    AndroidView(
                        factory = { context ->
                            WebView(context).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.databaseEnabled = true
                                settings.javaScriptCanOpenWindowsAutomatically = false
                                settings.userAgentString = browserUserAgent(context)
                                val view = this
                                CookieManager.getInstance().apply {
                                    setAcceptCookie(true)
                                    setAcceptThirdPartyCookies(view, true)
                                }
                                webChromeClient = object : WebChromeClient() {
                                    override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                        progress = newProgress / 100f
                                    }
                                }
                                webViewClient = object : WebViewClient() {
                                    override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                        loading = true
                                        blocked = url?.contains("disallowed_useragent") == true
                                    }

                                    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                                        if (request?.isForMainFrame == true) failure = UNREACHABLE
                                    }

                                    override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                                        val status = errorResponse?.statusCode ?: 0
                                        if (request?.isForMainFrame == true && status >= 500) failure = UNREACHABLE
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        loading = false
                                        if (view?.title?.contains("Service Offline") == true) failure = OFFLINE
                                        if (failure == null && url != "about:blank") shownPage = true
                                        if (url?.contains("disallowed_useragent") == true) blocked = true
                                        val inApp = url != null &&
                                            url.startsWith(Umpoint.BASE) &&
                                            !url.contains("/login") &&
                                            !url.contains("/google/")
                                        if (signIn && inApp && !finished) {
                                            finished = true
                                            onSignedIn()
                                        }
                                    }

                                    override fun shouldOverrideUrlLoading(
                                        view: WebView?,
                                        request: WebResourceRequest?,
                                    ): Boolean = false
                                }
                                loadUrl(initialUrl)
                                webView = this
                            }
                        },
                        modifier = Modifier.fillMaxSize(),
                    )
                    val problem = failure
                    when {
                        problem != null -> Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
                            EmptyState(
                                icon = Icons.Rounded.CloudOff,
                                title = "Can’t reach UMPoint",
                                text = problem,
                                action = {
                                    Button(
                                        onClick = {
                                            failure = null
                                            shownPage = false
                                            progress = 0f
                                            attempt++
                                            webView?.loadUrl(initialUrl)
                                        },
                                        shapes = ButtonDefaults.shapes(),
                                    ) { Text("Try again") }
                                },
                            )
                        }
                        !shownPage -> Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                LoadingIndicator(Modifier.size(64.dp))
                            }
                        }
                        // Once a page is up it stays usable: a slow image must never cover Google's form.
                        loading -> LinearWavyProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                        )
                    }
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webView?.apply {
                stopLoading()
                loadUrl("about:blank")
                destroy()
            }
            webView = null
        }
    }
}
