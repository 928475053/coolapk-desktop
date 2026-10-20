package com.coolapk.desktop

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.netease.nis.captcha.Captcha
import com.netease.nis.captcha.CaptchaConfiguration
import com.netease.nis.captcha.CaptchaListener

/**
 * 使用酷安当前版本同款网易易盾原生 SDK（io.github.yidun:captcha）。
 *
 * 网页版易盾的 validate 与 App 业务 captchaId 的环境不匹配，服务端会把它
 * 当作未验证，导致每次请求都重新弹出滑块。原生 SDK 生成的 validate 才会
 * 被酷安 App API 接受。
 */
@Keep
class CaptchaActivity : Activity() {
    companion object {
        const val EXTRA_CAPTCHA_ID = "captcha_id"
        const val EXTRA_POST_TOKEN = "post_token"
        const val EXTRA_ERROR = "captcha_error"
        @Volatile var pendingResult: String = "pending"
    }

    private var captcha: Captcha? = null
    private var finished = false
    private var captchaId = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        setContentView(FrameLayout(this).apply { setBackgroundColor(Color.TRANSPARENT) })

        captchaId = intent.getStringExtra(EXTRA_CAPTCHA_ID).orEmpty().trim()
        if (captchaId.isBlank()) {
            finishError("验证码 ID 为空")
            return
        }

        val configuration = CaptchaConfiguration.Builder()
            .captchaId(captchaId)
            .timeout(15_000L)
            .languageType(CaptchaConfiguration.LangType.LANG_ZH_CN)
            .theme(CaptchaConfiguration.Theme.LIGHT)
            .listener(object : CaptchaListener {
                // 3.5.x 的回调顺序是 (result, validate, message)，第二个才是
                // 可直接回传给业务接口的校验码。
                override fun onValidate(result: String?, validate: String?, message: String?) {
                    Log.i(
                        "CoolapkCaptcha",
                        "onValidate result_len=${result?.length ?: 0} validate_len=${validate?.length ?: 0} " +
                            "result_prefix=${result?.take(24)} validate_prefix=${validate?.take(24)}",
                    )
                    if (validate.isNullOrBlank()) {
                        finishError("验证码凭证为空")
                        return
                    }
                    runOnUiThread { finishVerified(validate) }
                }

                override fun onError(code: Int, message: String?) {
                    runOnUiThread { finishError(message ?: "人机验证失败（$code）") }
                }

                override fun onClose(closeType: Captcha.CloseType?) {
                    when (closeType) {
                        Captcha.CloseType.USER_CLOSE,
                        Captcha.CloseType.UNDEFINE_CLOSE -> runOnUiThread { finishCancelled() }

                        Captcha.CloseType.VERIFY_SUCCESS_CLOSE,
                        Captcha.CloseType.VALIDATE_QUICK_CLOSE -> {
                            // 成功关闭时 onValidate 通常会紧接着回调；留一点时间，
                            // 避免因回调顺序丢掉 validate。
                            Handler(Looper.getMainLooper()).postDelayed({
                                if (!finished) finishError("验证码已通过但未返回凭证")
                            }, 2_000L)
                        }

                        // TIP_CLOSE 表示“加载提示关闭，马上显示验证弹窗”，
                        // 不是用户取消，必须继续等待。
                        Captcha.CloseType.TIP_CLOSE,
                        null -> Unit
                    }
                }

                override fun onCaptchaShow() {
                    // SDK 已展示验证弹窗，无需额外处理。
                }
            })
            .build(this)

        try {
            captcha = Captcha.getInstance().init(configuration)
            captcha?.validate()
            Handler(Looper.getMainLooper()).postDelayed({
                if (!finished) finishError("等待人机验证超时")
            }, 180_000L)
        } catch (error: Throwable) {
            finishError(error.message ?: error.javaClass.simpleName)
        }
    }

    private fun finishVerified(validate: String) {
        if (finished) return
        finished = true
        val token = "NEC:${captchaId.take(8)}:$validate"
        Log.i("CoolapkCaptcha", "finished token_prefix=${token.take(24)} token_len=${token.length}")
        pendingResult = token
        setResult(RESULT_OK, Intent().putExtra(EXTRA_POST_TOKEN, token))
        finish()
    }

    private fun finishError(message: String) {
        if (finished) return
        finished = true
        val detail = message.trim().ifEmpty { "人机验证失败" }.take(300)
        pendingResult = "error:$detail"
        setResult(
            RESULT_OK,
            Intent().putExtra(EXTRA_ERROR, detail),
        )
        finish()
    }

    private fun finishCancelled() {
        if (finished) return
        finished = true
        pendingResult = "cancelled"
        setResult(RESULT_CANCELED)
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        finishCancelled()
    }

    override fun onDestroy() {
        val instance = captcha
        captcha = null
        if (instance != null) {
            // setResult/finish 已经执行，SDK 清理放到消息队列，避免 destroy()
            // 阻塞 Activity 结果回传，导致主界面一直等待验证码结果。
            Handler(Looper.getMainLooper()).post {
                runCatching { instance.destroy() }
            }
        }
        super.onDestroy()
    }
}
