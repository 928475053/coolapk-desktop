import { computed, onActivated, onDeactivated, onUnmounted, ref } from 'vue';

type ColumnResizeOptions = { storageKey: string; defaultWidth: () => number; limits: () => { min: number; max: number }; direction?: 1 | -1; responsiveDefault?: boolean };

/** 话题栏和动态详情共用拖拽逻辑，松手时保存宽度，重新进入时恢复。 */
export function usePersistedColumnResize(options: ColumnResizeOptions) {
  const width = ref(readWidth());
  const dragging = ref(false);
  const visibleWidth = computed(() => clamp(width.value ?? options.defaultWidth()));
  let pointerId: number | null = null;
  let startX = 0, startWidth = 0;
  let previousCursor = '', previousUserSelect = '';

  function clamp(value: number) { const { min, max } = options.limits(); return Math.min(max, Math.max(min, value)); }
  function readWidth() {
    try {
      const saved = Number(localStorage.getItem(options.storageKey));
      if (Number.isFinite(saved) && saved > 0) return saved;
    } catch { /* 存储不可用时保留默认宽度。 */ }
    // 自适应模式仅记忆用户调节的宽度；未调节时随容器更新默认比例。
    return options.responsiveDefault ? undefined : options.defaultWidth();
  }
  function saveWidth() {
    try {
      if (width.value === undefined) localStorage.removeItem(options.storageKey);
      else localStorage.setItem(options.storageKey, String(width.value));
    } catch { /* 保存失败不影响当前调节。 */ }
  }
  function restoreWidth() { if (!dragging.value) width.value = readWidth(); }
  function resetWidth() { width.value = options.responsiveDefault ? undefined : options.defaultWidth(); saveWidth(); }
  function startResize(event: PointerEvent) {
    if (event.button !== 0 || dragging.value) return;
    event.preventDefault();
    pointerId = event.pointerId;
    startX = event.clientX;
    startWidth = visibleWidth.value;
    dragging.value = true;
    previousCursor = document.body.style.cursor;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', moveResize);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
    window.addEventListener('blur', stopResize);
  }
  function moveResize(event: PointerEvent) {
    if (event.pointerId === pointerId) width.value = clamp(startWidth + (event.clientX - startX) * (options.direction ?? 1));
  }
  function finishResize(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    if (event.type === 'pointerup') moveResize(event);
    stopResize();
  }
  function stopResize() {
    if (!dragging.value) return;
    dragging.value = false;
    pointerId = null;
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    window.removeEventListener('pointermove', moveResize);
    window.removeEventListener('pointerup', finishResize);
    window.removeEventListener('pointercancel', finishResize);
    window.removeEventListener('blur', stopResize);
    saveWidth();
  }
  function resizeWithKeyboard(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') resetWidth();
    else { width.value = clamp(visibleWidth.value + (event.key === 'ArrowLeft' ? -1 : 1) * (options.direction ?? 1) * (event.shiftKey ? 40 : 10)); saveWidth(); }
  }
  onActivated(restoreWidth);
  onDeactivated(stopResize);
  onUnmounted(stopResize);
  return { visibleWidth, dragging, startResize, resetWidth, restoreWidth, resizeWithKeyboard };
}
