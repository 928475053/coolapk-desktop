import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type SystemTheme = 'dark' | 'light' | null;

export function isLinuxDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__)
    && /linux/i.test(navigator.userAgent) && !/android/i.test(navigator.userAgent);
}

function normalizeTheme(value: unknown): SystemTheme {
  return value === 'dark' || value === 'light' ? value : null;
}

/** 返回同步清理函数，兼容监听注册尚未完成就销毁 store 的情况。 */
export function observeLinuxSystemTheme(update: (theme: SystemTheme) => void): () => void {
  let disposed = false;
  let revision = 0;
  let unlisten: (() => void) | undefined;
  const refresh = async () => {
    const currentRevision = ++revision;
    try {
      const theme = await invoke<unknown>('get_linux_system_theme');
      if (!disposed && revision === currentRevision) update(normalizeTheme(theme));
    } catch {
      if (!disposed && revision === currentRevision) update(null);
    }
  };
  void (async () => {
    try {
      const stop = await listen<unknown>('linux-system-theme-changed', event => {
        if (disposed) return;
        revision++;
        update(normalizeTheme(event.payload));
      });
      if (disposed) { stop(); return; }
      unlisten = stop;
    } catch { /* 监听不可用时仍尝试初始读取；失败则保留媒体查询回退。 */ }
    if (!disposed) await refresh();
  })();
  // 从后台恢复时重新读取，覆盖休眠期间遗漏的通知。
  const onFocus = () => { void refresh(); };
  window.addEventListener('focus', onFocus);
  return () => {
    disposed = true;
    unlisten?.();
    window.removeEventListener('focus', onFocus);
  };
}
