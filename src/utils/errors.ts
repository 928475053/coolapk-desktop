export function getErrorMessage(error: unknown, fallback: string): string {
  const message = typeof error === 'string'
    ? error.trim()
    : error instanceof Error
      ? error.message.trim()
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '').trim()
        : '';
  if (!message) return fallback;
  if (/err_request_captcha_v2|captchaId|dun\.163|163yun\.com\/api/i.test(message)) {
    return '当前操作需要完成人机验证，请稍后重试';
  }
  if (/Coolapk API returned HTTP 501/i.test(message)) {
    return '酷安接口暂时拒绝访问（HTTP 501），请稍后重试';
  }
  return message;
}
