package com.coolapk.desktop

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.annotation.Keep
import org.json.JSONObject

/**
 * 易盾 Web 验证码需要酷安网页 Origin。主界面使用 Tauri 自定义协议，
 * 直接在主 WebView 初始化会被易盾拒绝；这里用独立 WebView 加载一个
 * 拦截到本地资源的 https://www.coolapk.com/ne_captcha.html 页面，再把
 * validate 返回给原生层。
 */
@Keep
class CaptchaActivity : Activity() {
    companion object {
        const val EXTRA_CAPTCHA_ID = "captcha_id"
        const val EXTRA_POST_TOKEN = "post_token"
        const val EXTRA_ERROR = "captcha_error"
        private const val CAPTCHA_PAGE_URL = "https://www.coolapk.com/ne_captcha.html"
    }

    private lateinit var webView: WebView
    private var finished = false
    private var captchaStarted = false
    private var captchaId = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captchaId = intent.getStringExtra(EXTRA_CAPTCHA_ID).orEmpty()
        if (captchaId.isBlank()) {
            finishCancelled()
            return
        }

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.WHITE)
        }
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.mediaPlaybackRequiresUserGesture = false
            // 易盾会检查 WebView 环境；使用普通移动 Chrome UA，避免厂商 WebView
            // 自带的 "; wv" 标记触发业务侧风控。
            settings.userAgentString =
                "Mozilla/5.0 (Linux; Android 15; 23113RKC6C Build/AQ3A.250226.002) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(CaptchaBridge(), "AndroidCaptcha")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? {
                    // 不要用 data: URL 伪造 Origin。拦截一个真实的酷安 HTTPS
                    // 地址并返回本地 HTML，让 document.origin/referer 都是
                    // https://www.coolapk.com，易盾才能正常下发挑战资源。
                    if (request.url.toString().substringBefore('?') == CAPTCHA_PAGE_URL) {
                        return WebResourceResponse(
                            "text/html",
                            "UTF-8",
                            assets.open("ne_captcha.html"),
                        )
                    }
                    return super.shouldInterceptRequest(view, request)
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (finished || captchaStarted) return
                    if (url.substringBefore('?') != CAPTCHA_PAGE_URL) return
                    captchaStarted = true
                    view.evaluateJavascript(
                        "window.startCoolapkCaptcha(${JSONObject.quote(captchaId)})",
                        null,
                    )
                }
            }
        }
        root.addView(webView)
        setContentView(root)

        webView.loadUrl(CAPTCHA_PAGE_URL)
    }

    @Keep
    inner class CaptchaBridge {
        @Keep
        @JavascriptInterface
        fun onVerified(validate: String) {
            val value = validate.trim()
            if (value.isEmpty()) {
                finishCancelled()
                return
            }
            runOnUiThread {
                if (finished) return@runOnUiThread
                finished = true
                val token = "NEC:${captchaId.take(8)}:$value"
                setResult(
                    RESULT_OK,
                    Intent().putExtra(EXTRA_POST_TOKEN, token),
                )
                webView.destroy()
                finish()
            }
        }

        @Keep
        @JavascriptInterface
        fun onCancelled() {
            runOnUiThread { finishCancelled() }
        }

        @Keep
        @JavascriptInterface
        fun onError(message: String) {
            runOnUiThread { finishError(message) }
        }
    }

    private fun finishError(message: String) {
        if (finished) return
        finished = true
        setResult(
            RESULT_OK,
            Intent().putExtra(
                EXTRA_ERROR,
                message.trim().ifEmpty { "人机验证加载失败" }.take(300),
            ),
        )
        if (::webView.isInitialized) {
            webView.destroy()
        }
        finish()
    }

    private fun finishCancelled() {
        if (finished) return
        finished = true
        setResult(RESULT_CANCELED)
        if (::webView.isInitialized) {
            webView.destroy()
        }
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        finishCancelled()
    }
}
