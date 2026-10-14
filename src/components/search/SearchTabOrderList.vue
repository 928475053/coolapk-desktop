<template>
  <ol ref="listRoot" class="search-order-list" aria-label="搜索分类顺序">
    <li class="search-order-item search-order-fixed">
      <span class="search-order-label"><i class="fas fa-layer-group" aria-hidden="true"></i>综合</span>
      <span class="fixed-hint"><i class="fas fa-lock" aria-hidden="true"></i> 固定第一</span>
    </li>
    <li v-for="tab in displayedTabs" :key="tab.searchType" class="search-order-item" :class="{ 'is-dragging': floating?.tab.searchType === tab.searchType }" :data-search-type="tab.searchType">
      <span class="search-order-label"><i v-if="tab.icon" :class="tab.icon" aria-hidden="true"></i>{{ tab.label }}</span>
      <button type="button" class="search-order-handle" :aria-label="`拖动调整${tab.label}顺序`" title="拖动排序；也可按 Alt + 上下方向键调整" @pointerdown="startDrag($event, tab)" @dragstart.prevent @keydown.alt.up.prevent="moveWithKeyboard(tab.searchType, -1)" @keydown.alt.down.prevent="moveWithKeyboard(tab.searchType, 1)">
        <i class="fas fa-grip-lines" aria-hidden="true"></i>
      </button>
    </li>
  </ol>
  <Teleport to="body">
    <div v-if="floating" class="search-order-floating" aria-hidden="true" :style="{ left: `${floating.x}px`, top: `${floating.y}px`, width: `${floating.width}px`, minHeight: `${floating.height}px` }">
      <span class="search-order-label"><i v-if="floating.tab.icon" :class="floating.tab.icon"></i>{{ floating.tab.label }}</span>
      <i class="fas fa-grip-lines"></i>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import type { SearchTabDefinition } from '../../types/search';

const props = defineProps<{ tabs: SearchTabDefinition[] }>();
const emit = defineEmits<{ reorder: [order: string[]] }>();
const listRoot = ref<HTMLOListElement | null>(null);
const draft = ref<SearchTabDefinition[] | null>(null);
const displayedTabs = computed(() => (draft.value ?? props.tabs).filter(tab => tab.searchType !== 'all'));
const floating = ref<{ tab: SearchTabDefinition; x: number; y: number; width: number; height: number } | null>(null);
let drag: { pointerId: number; tab: SearchTabDefinition; startX: number; startY: number; x: number; y: number; offsetX: number; offsetY: number; width: number; height: number; scroll: HTMLElement | null } | null = null;
let scrollFrame = 0;

function startDrag(event: PointerEvent, tab: SearchTabDefinition) {
  if (event.button !== 0 || event.isPrimary === false || drag || tab.searchType === 'all') return;
  const row = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-search-type]');
  if (!row) return;
  const rect = row.getBoundingClientRect();
  // 仅拖动手柄拦截触摸，列表正文仍可正常上下滚动。
  event.preventDefault();
  drag = { pointerId: event.pointerId, tab, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height, scroll: listRoot.value?.closest<HTMLElement>('.settings-content') ?? null };
  window.addEventListener('pointermove', moveDrag, { passive: false });
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', cancelPointer);
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('keydown', cancelWithKeyboard);
}

function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!floating.value && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
  event.preventDefault();
  drag.x = event.clientX; drag.y = event.clientY;
  if (!draft.value) draft.value = [...displayedTabs.value];
  updatePosition();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
}

function updatePosition() {
  if (!drag || !listRoot.value) return;
  const { tab, x, y, offsetX, offsetY, width, height } = drag;
  floating.value = { tab, x: x - offsetX, y: y - offsetY, width, height };
  const bounds = listRoot.value.getBoundingClientRect();
  if (x < bounds.left - 24 || x > bounds.right + 24) return;
  // 用悬浮行中心与其余行中心比较，综合不参与目标位置计算。
  const rows = Array.from(listRoot.value.querySelectorAll<HTMLElement>('[data-search-type]')).filter(row => row.dataset.searchType !== tab.searchType);
  const center = y - offsetY + height / 2;
  const target = rows.filter(row => center > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2).length;
  const current = displayedTabs.value.findIndex(item => item.searchType === tab.searchType);
  if (current === target) return;
  const next = displayedTabs.value.filter(item => item.searchType !== tab.searchType);
  next.splice(target, 0, tab);
  draft.value = next;
}

function autoScroll() {
  scrollFrame = 0;
  if (!drag || !floating.value) return;
  const scroller = drag.scroll;
  if (scroller) {
    const bounds = scroller.getBoundingClientRect();
    if (drag.x >= bounds.left && drag.x <= bounds.right) {
      const delta = drag.y < bounds.top + 48 ? -Math.min(14, (bounds.top + 48 - drag.y) / 3) : drag.y > bounds.bottom - 48 ? Math.min(14, (drag.y - bounds.bottom + 48) / 3) : 0;
      const before = scroller.scrollTop;
      scroller.scrollTop += delta;
      if (scroller.scrollTop !== before) updatePosition();
    }
  }
  scrollFrame = requestAnimationFrame(autoScroll);
}

function finishDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const bounds = listRoot.value?.getBoundingClientRect();
  const inside = bounds && event.clientX >= bounds.left - 24 && event.clientX <= bounds.right + 24 && event.clientY >= bounds.top - 24 && event.clientY <= bounds.bottom + 24;
  const order = floating.value && inside ? displayedTabs.value.map(tab => tab.searchType) : null;
  const changed = order && order.some((key, index) => key !== props.tabs.filter(tab => tab.searchType !== 'all')[index]?.searchType);
  // 松手才写入设置；取消、失焦或移出列表放开均丢弃预览顺序。
  cancelDrag();
  if (order && changed) emit('reorder', order);
}

function cancelPointer(event: PointerEvent) { if (event.pointerId === drag?.pointerId) cancelDrag(); }
function cancelWithKeyboard(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); cancelDrag(); } }
function cancelDrag() {
  drag = null; floating.value = null; draft.value = null;
  cancelAnimationFrame(scrollFrame); scrollFrame = 0;
  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', finishDrag);
  window.removeEventListener('pointercancel', cancelPointer);
  window.removeEventListener('blur', cancelDrag);
  window.removeEventListener('keydown', cancelWithKeyboard);
}

function moveWithKeyboard(key: string, offset: number) {
  if (drag) return;
  const tabs = [...displayedTabs.value], from = tabs.findIndex(tab => tab.searchType === key), to = from + offset;
  if (from < 0 || to < 0 || to >= tabs.length) return;
  const [tab] = tabs.splice(from, 1);
  tabs.splice(to, 0, tab!);
  emit('reorder', tabs.map(item => item.searchType));
}

watch(() => props.tabs, cancelDrag);
onDeactivated(cancelDrag);
onBeforeUnmount(cancelDrag);
</script>

<style scoped>
.search-order-list { list-style: none; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-control); overflow: hidden; }
.search-order-item, .search-order-floating { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 12px; min-width: 0; min-height: 52px; background: var(--surface); }
.search-order-item + .search-order-item { border-top: 1px solid var(--border-light); }
.search-order-fixed { background: var(--background-secondary); }
.fixed-hint { flex-shrink: 0; color: var(--text-tertiary); font-size: var(--font-size-caption); }
.search-order-label { display: flex; align-items: center; gap: 10px; min-width: 0; overflow-wrap: anywhere; font-size: var(--font-size-sub); color: var(--text-primary); }
.search-order-label > i { flex: 0 0 20px; text-align: center; color: var(--text-secondary); }
.search-order-handle { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; color: var(--text-tertiary); cursor: grab; touch-action: none; user-select: none; }
.search-order-handle:hover { color: var(--brand-primary); }
.search-order-handle:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: -2px; border-radius: var(--radius-control); }
.search-order-item.is-dragging { background: var(--brand-soft); }
.search-order-item.is-dragging > * { opacity: 0.25; }
.search-order-floating { position: fixed; z-index: 1000; pointer-events: none; user-select: none; border: 1px solid var(--brand-primary); border-radius: var(--radius-control); box-shadow: var(--shadow-dropdown); cursor: grabbing; }
</style>
