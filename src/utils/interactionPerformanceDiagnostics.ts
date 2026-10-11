/** rAF 只在滚动/交互后短时运行；事件内容、按键值、目标元素均不持久化。 */
export function installInteractionPerformanceDiagnostics(write: (event: string, detail: string) => void) {
  let frame = 0;
  let stopped = false;
  let paused = false;
  let activeUntil = 0;
  let scrollUntil = 0;
  let previousFrame: number | undefined;
  let pendingInput: number | undefined;
  let lastWarning = -Infinity;
  let frames = 0, frameTime = 0, maxFrame = 0, slowFrames = 0, stalls = 0, scrollStalls = 0;
  let inputs = 0, maxInputDelay = 0, nextFrames = 0, maxNextFrame = 0;
  let timedEvents = 0, maxEventDuration = 0, maxHandler = 0, slowEvents = 0;
  let longAnimations = 0, maxAnimation = 0, animationBlocking = 0;
  const bounds = [16, 33, 50, 100, 200, 500, 1000, Infinity];
  const buckets = bounds.map(() => 0);
  const observers: PerformanceObserver[] = [];
  const available = () => !stopped && !paused && document.visibilityState !== 'hidden';
  const warn = (kind: string, ms: number) => {
    const now = performance.now();
    if (ms < 200 || now - lastWarning < 5000) return;
    lastWarning = now;
    write('jank', `kind=${kind} duration_ms=${Math.round(ms)} visibility=visible`);
  };
  const draw = () => {
    frame = 0;
    if (!available()) return;
    const now = performance.now();
    if (previousFrame !== undefined) {
      const gap = Math.max(0, now - previousFrame);
      frames++; frameTime += gap; maxFrame = Math.max(maxFrame, gap);
      buckets[bounds.findIndex(bound => gap <= bound)]++;
      if (gap >= 50) slowFrames++;
      if (gap >= 100) {
        stalls++;
        // 停顿起点在滚动活跃期内，即使恢复时超过活跃期也计入。
        const scrolling = previousFrame <= scrollUntil;
        if (scrolling) scrollStalls++;
        warn(scrolling ? 'scroll_frame_gap' : 'interaction_frame_gap', gap);
      }
    }
    if (pendingInput !== undefined) {
      const latency = Math.max(0, now - pendingInput);
      nextFrames++; maxNextFrame = Math.max(maxNextFrame, latency);
      warn('input_to_next_raf', latency);
      pendingInput = undefined;
    }
    previousFrame = now;
    if (now < activeUntil) frame = requestAnimationFrame(draw);
    else previousFrame = undefined;
  };
  const activity = (event: Event) => {
    if (!available()) return;
    const now = performance.now();
    const scrolling = event.type === 'scroll' || event.type === 'wheel' || event.type === 'touchmove';
    // 仅真实点击/按键统计输入排队；程序触发的滚动仍可采样帧间隔。
    if (!scrolling && !event.isTrusted) return;
    activeUntil = now + 1500;
    if (scrolling) scrollUntil = activeUntil;
    else {
      let start = event.timeStamp;
      if (start > 1e12) start -= performance.timeOrigin;
      if (Number.isFinite(start) && start > 0 && start <= now) {
        inputs++;
        maxInputDelay = Math.max(maxInputDelay, now - start);
        // 多个事件共用一次 rAF，只保留最早的事件，防止回调队列增长。
        pendingInput = Math.min(pendingInput ?? start, start);
      }
    }
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const eventTypes = ['scroll', 'wheel', 'touchmove', 'pointerdown', 'click', 'keydown'];
  for (const type of eventTypes) window.addEventListener(type, activity, { capture: true, passive: true });
  const observe = (type: string, consume: (entry: PerformanceEntry) => void) => {
    if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes(type)) return false;
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver(list => {
        if (available()) for (const entry of list.getEntries()) consume(entry);
      });
      observer.observe(type === 'event' ? { type, durationThreshold: 16 } as PerformanceObserverInit : { type });
      observers.push(observer);
      return true;
    } catch { observer?.disconnect(); return false; }
  };
  const eventTiming = observe('event', entry => {
    const timing = entry as PerformanceEntry & { processingStart: number; processingEnd: number };
    timedEvents++; maxEventDuration = Math.max(maxEventDuration, entry.duration);
    if (entry.duration >= 200) slowEvents++;
    if (Number.isFinite(timing.processingStart) && Number.isFinite(timing.processingEnd)) {
      maxHandler = Math.max(maxHandler, timing.processingEnd - timing.processingStart);
    }
    warn('event_to_render', entry.duration);
  });
  const longAnimation = observe('long-animation-frame', entry => {
    longAnimations++; maxAnimation = Math.max(maxAnimation, entry.duration);
    const blocking = (entry as PerformanceEntry & { blockingDuration?: number }).blockingDuration;
    if (typeof blocking === 'number' && Number.isFinite(blocking)) animationBlocking += blocking;
    warn('long_animation_frame', entry.duration);
  });
  const reset = () => {
    frames = frameTime = maxFrame = slowFrames = stalls = scrollStalls = 0;
    inputs = maxInputDelay = nextFrames = maxNextFrame = 0;
    timedEvents = maxEventDuration = maxHandler = slowEvents = 0;
    longAnimations = maxAnimation = animationBlocking = 0;
    buckets.fill(0);
  };
  const summary = () => {
    let cumulative = 0;
    const p95 = frames ? bounds[buckets.findIndex(count => { cumulative += count; return cumulative >= Math.ceil(frames * .95); })] : undefined;
    return `active_raf_frames=${frames} active_raf_fps=${frameTime ? (frames * 1000 / frameTime).toFixed(1) : 'unavailable'} frame_gap_p95_le_ms=${p95 === undefined ? 'unavailable' : Number.isFinite(p95) ? p95 : 'over_1000'} max_frame_gap_ms=${Math.round(maxFrame)} frames_ge_50ms=${slowFrames} stalls_ge_100ms=${stalls} scroll_stalls_ge_100ms=${scrollStalls} input_events=${inputs} max_input_capture_delay_ms=${Math.round(maxInputDelay)} input_next_raf_samples=${nextFrames} max_input_to_next_raf_ms=${Math.round(maxNextFrame)} event_timing_supported=${eventTiming} timed_events=${eventTiming ? timedEvents : 'unavailable'} max_event_to_render_ms=${eventTiming ? Math.round(maxEventDuration) : 'unavailable'} max_event_handler_ms=${eventTiming ? Math.round(maxHandler) : 'unavailable'} events_ge_200ms=${eventTiming ? slowEvents : 'unavailable'} loaf_supported=${longAnimation} long_animation_frames=${longAnimation ? longAnimations : 'unavailable'} max_long_animation_frame_ms=${longAnimation ? Math.round(maxAnimation) : 'unavailable'} animation_blocking_ms=${longAnimation ? Math.round(animationBlocking) : 'unavailable'}`;
  };
  const pause = () => {
    paused = true;
    cancelAnimationFrame(frame); frame = 0;
    previousFrame = pendingInput = undefined;
    activeUntil = scrollUntil = 0;
    for (const observer of observers) observer.takeRecords();
  };
  return {
    summary, reset, pause,
    resume: () => { paused = false; },
    stop: () => {
      stopped = true; pause();
      for (const observer of observers) observer.disconnect();
      for (const type of eventTypes) window.removeEventListener(type, activity, true);
    },
  };
}
