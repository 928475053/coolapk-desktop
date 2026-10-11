import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPerformanceDiagnostics } from '../performanceDiagnostics';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('performance diagnostics', () => {
  it('aggregates supported long tasks and reports unavailable heap explicitly', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    let callback: PerformanceObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal('PerformanceObserver', class {
      static supportedEntryTypes = ['longtask'];
      constructor(cb: PerformanceObserverCallback) { callback = cb; }
      observe() {}
      takeRecords() { return []; }
      disconnect = disconnect;
    });
    const write = vi.fn();
    cleanup = installPerformanceDiagnostics(write);
    callback!({ getEntries: () => [{ duration: 120 }, { duration: 80 }] } as PerformanceObserverEntryList, {} as PerformanceObserver);
    for (let i = 0; i < 30; i++) { now += 1000; vi.advanceTimersByTime(1000); }
    expect(write.mock.calls.at(-1)![1]).toContain('longtasks=2 longtask_ms=200');
    expect(write.mock.calls.at(-1)![1]).toContain('js_heap_used_bytes=unavailable');
    for (let i = 0; i < 30; i++) { now += 1000; vi.advanceTimersByTime(1000); }
    expect(write.mock.calls.at(-1)![1]).toContain('longtasks=0 longtask_ms=0');
    cleanup();
    expect(disconnect).toHaveBeenCalled();
  });
  it('records numeric DOM counts and a slow event loop without collecting content', () => {
    vi.useFakeTimers();
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.body.innerHTML = '<div class="feed-card">private text</div><img src="https://private.invalid/secret">';
    const write = vi.fn();
    cleanup = installPerformanceDiagnostics(write);
    expect(write.mock.calls[1][1]).toContain('mounted_feed_cards=1');
    expect(write.mock.calls[1][1]).toContain('images=1');
    now = 30_500;
    vi.advanceTimersByTime(1000);
    expect(write.mock.calls.at(-1)![1]).toContain('max_event_loop_delay_ms=29500');
    expect(write.mock.calls.at(-1)![1]).toContain('delayed_ticks=1');
    expect(JSON.stringify(write.mock.calls)).not.toContain('private');
    cleanup();
    const count = write.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(write).toHaveBeenCalledTimes(count);
  });

  it('pauses in background and resets latency after becoming visible', () => {
    vi.useFakeTimers();
    let now = 0;
    let visible: DocumentVisibilityState = 'visible';
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible);
    const write = vi.fn();
    cleanup = installPerformanceDiagnostics(write);
    visible = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    const count = write.mock.calls.length;
    now = 600_000;
    vi.advanceTimersByTime(600_000);
    expect(write).toHaveBeenCalledTimes(count);
    visible = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    for (let i = 0; i < 30; i++) { now += 1000; vi.advanceTimersByTime(1000); }
    expect(write.mock.calls.at(-1)![1]).toContain('max_event_loop_delay_ms=0');
    window.dispatchEvent(new Event('pagehide'));
    now += 60_000;
    vi.advanceTimersByTime(60_000);
    window.dispatchEvent(new Event('pageshow'));
    for (let i = 0; i < 30; i++) { now += 1000; vi.advanceTimersByTime(1000); }
    expect(write.mock.calls.at(-1)![1]).toContain('max_event_loop_delay_ms=0');
  });
});
