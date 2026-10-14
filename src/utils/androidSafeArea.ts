import { invoke, isTauri } from '@tauri-apps/api/core';

/** 首次挂载前读取安全区，后续旋转与系统区域变化由原生同步，避免状态栏覆盖首屏按钮。 */
export async function initializeAndroidSafeArea() {
  if (!isTauri() || !/android/i.test(navigator.userAgent)) return;
  try {
    const top = await invoke<number>('get_android_safe_area_top');
    if (Number.isFinite(top) && top >= 0) document.documentElement.style.setProperty('--android-safe-area-top', `${top / (window.devicePixelRatio || 1)}px`);
  } catch (error) { console.warn('读取 Android 顶部安全区失败:', error); }
}
