import { installInteractionPerformanceDiagnostics } from './interactionPerformanceDiagnostics';

/** 数值采样，不收集页面内容、地址或用户输入。 */
export function installPerformanceDiagnostics(write: (event: string, detail: string) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let lastTick = performance.now();
  let windowStart = lastTick;
  let maxDelay = 0;
  let delayedTicks = 0;
  let longTasks = 0;
  let longTaskMs = 0;
  let observer: PerformanceObserver | undefined;
  const interactions = installInteractionPerformanceDiagnostics(write);
  try {
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver(list => {
        if (stopped || document.visibilityState === 'hidden') return;
        for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; }
      });
      observer.observe({ entryTypes: ['longtask'] });
    }
  } catch { observer?.disconnect(); observer = undefined; }
  const reset = () => {
    lastTick = windowStart = performance.now();
    maxDelay = delayedTicks = longTasks = longTaskMs = 0;
    interactions.reset();
  };
  const sample = () => {
    const start = performance.now();
    // 仅计数当前挂载 DOM；KeepAlive 分离的节点不包含在内。
    const elements = document.getElementsByTagName('*').length;
    const cards = document.getElementsByClassName('feed-card').length;
    const videos = Array.from(document.getElementsByTagName('video'));
    const playing = videos.filter(video => !video.paused && !video.ended).length;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    const heap = memory && Number.isFinite(memory.usedJSHeapSize) && Number.isFinite(memory.totalJSHeapSize)
      ? `js_heap_used_bytes=${memory.usedJSHeapSize} js_heap_total_bytes=${memory.totalJSHeapSize}`
      : 'js_heap_used_bytes=unavailable js_heap_total_bytes=unavailable';
    write('sample', `window_ms=${Math.round(start - windowStart)} max_event_loop_delay_ms=${Math.round(maxDelay)} delayed_ticks=${delayedTicks} longtask_supported=${Boolean(observer)} longtasks=${observer ? longTasks : 'unavailable'} longtask_ms=${observer ? Math.round(longTaskMs) : 'unavailable'} mounted_elements=${elements} mounted_feed_cards=${cards} images=${document.images.length} videos=${videos.length} playing_videos=${playing} ${heap} ${interactions.summary()} sample_cost_ms=${Math.round(performance.now() - start)}`);
    reset();
  };
  const tick = () => {
    if (stopped || document.visibilityState === 'hidden') return;
    const now = performance.now();
    const delay = Math.max(0, now - lastTick - 1000);
    maxDelay = Math.max(maxDelay, delay);
    if (delay >= 100) delayedTicks++;
    lastTick = now;
    if (now - windowStart >= 30_000) sample();
    timer = setTimeout(tick, 1000);
  };
  const visibility = () => {
    clearTimeout(timer);
    interactions.pause();
    observer?.takeRecords();
    reset(); // 后台限频不能算作前台卡顿。
    if (!stopped && document.visibilityState !== 'hidden') {
      interactions.resume();
      timer = setTimeout(tick, 1000);
    }
  };
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    observer?.disconnect();
    interactions.stop();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('pageshow', resume);
  };
  const pause = () => { clearTimeout(timer); interactions.pause(); reset(); };
  const resume = () => { if (!stopped) visibility(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  write('capabilities', `interval_ms=30000 tick_ms=1000 longtask_supported=${Boolean(observer)} dom_scope=mounted_document`);
  if (document.visibilityState !== 'hidden') sample();
  visibility();
  return stop;
}
