package com.coolapk.desktop

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.annotation.Keep
import org.json.JSONObject

/**
 * 易盾 Web 验证码需要酷安网页 Origin。主界面使用 Tauri 自定义协议，
 * 直接在主 WebView 初始化会被易盾拒绝；这里用独立 WebView 以
 * https://www.coolapk.com/ 为 Base URL 加载验证码，再把 validate 返回给原生层。
 */
@Keep
class CaptchaActivity : Activity() {
    companion object {
        const val EXTRA_CAPTCHA_ID = "captcha_id"
        const val EXTRA_POST_TOKEN = "post_token"
    }

    private lateinit var webView: WebView
    private var finished = false
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
            addJavascriptInterface(CaptchaBridge(), "AndroidCaptcha")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (finished) return
                    view.evaluateJavascript(
                        "window.startCoolapkCaptcha(${JSONObject.quote(captchaId)})",
                        null,
                    )
                }
            }
        }
        root.addView(webView)
        setContentView(root)

        val html = assets.open("ne_captcha.html")
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }
        webView.loadDataWithBaseURL(
            "https://www.coolapk.com/",
            html,
            "text/html",
            "UTF-8",
            null,
        )
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
