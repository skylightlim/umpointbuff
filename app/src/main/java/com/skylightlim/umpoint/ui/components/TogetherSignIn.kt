package com.skylightlim.umpoint.ui.components

import android.annotation.SuppressLint
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.skylightlim.umpoint.sniper.browserUserAgent
import com.skylightlim.umpoint.together.Together
import java.util.UUID

private fun explain(error: String?): String = when (error) {
    "domain" -> "Use your SiswaMail account. Other Google accounts can’t join."
    "not_configured" -> "The server’s Google sign-in isn’t set up yet."
    "cancelled" -> "Sign-in was cancelled."
    else -> "Google didn’t complete the sign-in. Try again."
}

/**
 * Google sign-in for Play together. It shares the WebView's cookies with the UMPoint sheet, so a
 * signed-in student usually just taps their SiswaMail. The token comes back in the fragment of the
 * final URL, which this dialog reads and never loads.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TogetherSignInDialog(onClose: () -> Unit, onToken: (String) -> Unit) {
    val state = remember { UUID.randomUUID().toString() }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }
    var finished by remember { mutableStateOf(false) }

    /** True when [url] is the end of the flow, so the WebView shouldn't go there. */
    fun intercept(url: String): Boolean {
        if (!url.startsWith(Together.doneUrl())) return false
        if (finished) return true
        val uri = Uri.parse(url)
        val token = uri.fragment?.removePrefix("token=")?.takeIf { it.isNotBlank() }
        when {
            uri.getQueryParameter("state") != state -> problem = explain(null)
            token != null -> {
                finished = true
                onToken(token)
            }
            else -> problem = explain(uri.getQueryParameter("error"))
        }
        return true
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Rounded.Close, contentDescription = "Close")
                    }
                    Text(
                        "Sign in with SiswaMail",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                }
                problem?.let { Note(it, NoteTone.ERROR, Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) }
                AndroidView(
                    factory = { context ->
                        WebView(context).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.userAgentString = browserUserAgent(context)
                            CookieManager.getInstance().setAcceptCookie(true)
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean =
                                    intercept(request?.url?.toString().orEmpty())

                                // Some redirects skip the check above, so look again when a page starts.
                                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                    if (url != null && intercept(url)) view?.stopLoading()
                                }
                            }
                            loadUrl(Together.signInUrl(state))
                            webView = this
                        }
                    },
                    modifier = Modifier.fillMaxWidth().weight(1f),
                )
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            webView?.apply {
                stopLoading()
                destroy()
            }
            webView = null
        }
    }
}
