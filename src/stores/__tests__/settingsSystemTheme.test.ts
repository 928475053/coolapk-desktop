import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../settings';

const events = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: { payload: unknown }) => void),
  stop: vi.fn(),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_name, callback) => { events.callback = callback; return events.stop; }),
}));
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: { load: vi.fn().mockRejectedValue(new Error('use local defaults')) },
}));

describe('Linux system theme', () => {
  let store: ReturnType<typeof useSettingsStore> | undefined;
  const settle = async () => { await flushPromises(); await nextTick(); };
  beforeEach(() => {
    events.callback = undefined;
    events.stop.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64)');
    (window as any).__TAURI_INTERNALS__ = {};
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(invoke).mockImplementation(async command => command === 'get_linux_system_theme' ? 'dark' as any : undefined);
  });
  afterEach(() => {
    store?.$dispose();
    store = undefined;
    delete (window as any).__TAURI_INTERNALS__;
    vi.restoreAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it('uses the portal preference when WebKit reports light, including the native window', async () => {
    store = useSettingsStore();
    await settle();
    expect(store.settings.theme).toBe('system');
    expect(store.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(invoke).toHaveBeenCalledWith('set_window_theme', { theme: 'dark' });
    const darkAccent = document.documentElement.style.getPropertyValue('--brand-primary');
    events.callback?.({ payload: 'light' });
    expect(store.resolvedTheme).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).not.toBe(darkAccent);
  });

  it('keeps a manual choice while tracking the system for the next switch to system', async () => {
    store = useSettingsStore();
    await settle();
    store.setTheme('light');
    await settle();
    events.callback?.({ payload: 'dark' });
    expect(store.resolvedTheme).toBe('light');
    store.setTheme('system');
    await settle();
    expect(store.resolvedTheme).toBe('dark');
  });

  it('falls back to the media query if the portal has no preference', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as any);
    vi.mocked(invoke).mockResolvedValue(undefined);
    store = useSettingsStore();
    await settle();
    expect(store.resolvedTheme).toBe('dark');
    events.callback?.({ payload: 'light' });
    expect(store.resolvedTheme).toBe('light');
    events.callback?.({ payload: null });
    expect(store.resolvedTheme).toBe('dark');
  });

  it('does not overwrite a newer notification with an older initial query', async () => {
    let resolve!: (theme: string) => void;
    vi.mocked(invoke).mockImplementation(command => command === 'get_linux_system_theme'
      ? new Promise<string>(done => { resolve = done; }) as any : Promise.resolve(undefined));
    store = useSettingsStore();
    await settle();
    events.callback?.({ payload: 'dark' });
    resolve('light');
    await settle();
    expect(store.resolvedTheme).toBe('dark');
  });

  it('cleans up the native listener on disposal', async () => {
    store = useSettingsStore();
    await settle();
    store.$dispose();
    expect(events.stop).toHaveBeenCalledTimes(1);
    events.callback?.({ payload: 'light' });
    expect(store.resolvedTheme).toBe('dark');
    store = undefined;
  });

  it.each(['Mozilla/5.0 (Linux; Android 15)', 'Mozilla/5.0 (Windows NT 10.0)'])(
    'does not query the Linux portal for %s', async userAgent => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
      vi.mocked(invoke).mockClear();
      store = useSettingsStore();
      await settle();
      expect(invoke).not.toHaveBeenCalledWith('get_linux_system_theme');
    },
  );
});
