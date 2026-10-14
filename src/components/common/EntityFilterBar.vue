<template>
  <div class="entity-filter-container" :class="{ 'is-glass': glass }"><div class="entity-filter-bar" :class="{ 'has-feed-type': showFeedTypeControl }">
    <div class="filter-main">
      <!-- 1. 左侧排序选项胶囊；输入关键词后切换为 APK 动态搜索排序 -->
      <div v-if="showSort && activeOptions.length > 0" class="filter-options" role="tablist" aria-label="动态排序">
        <button
          v-for="opt in activeOptions"
          :key="opt.key"
          type="button"
          role="tab"
          :class="['filter-btn', { active: currentSortKey === opt.key }]"
          :aria-selected="currentSortKey === opt.key"
          :aria-pressed="currentSortKey === opt.key"
          @click="handleSelectSort(opt.key)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div v-else class="filter-placeholder-spacer"></div>

      <!-- 2. APK 动态搜索的第二个维度：动态类型 -->
      <div v-if="showFeedTypeControl" ref="feedTypeControlRef" class="filter-type-control">
        <span class="filter-type-label">动态类型</span>
        <button
          type="button"
          class="filter-type-trigger"
          aria-haspopup="listbox"
          :aria-expanded="feedTypeMenuOpen"
          aria-label="选择动态类型"
          @click="toggleFeedTypeMenu"
          @keydown.esc="closeFeedTypeMenu"
        >
          <span>{{ currentFeedTypeLabel }}</span>
          <i :class="['fas', feedTypeMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down']" aria-hidden="true"></i>
        </button>
        <div v-if="feedTypeMenuOpen" class="filter-type-menu" role="listbox" aria-label="动态类型">
          <button
            v-for="opt in feedTypeOptionList"
            :key="opt.key"
            type="button"
            role="option"
            :aria-selected="currentFeedType === opt.key"
            :class="['filter-type-option', { active: currentFeedType === opt.key }]"
            @click="handleSelectFeedType(opt.key)"
          >
            <span>{{ opt.label }}</span>
            <i v-if="currentFeedType === opt.key" class="fas fa-check" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. 右侧搜索框 -->
    <div v-if="showSearch" class="filter-actions">
      <div class="filter-search-box">
        <i
          class="fas fa-search filter-search-icon"
          title="搜索动态"
          aria-label="搜索动态"
          @click="handleTriggerSearch"
        ></i>
        <input
          ref="searchInputRef"
          v-model="internalKeyword"
          type="text"
          class="filter-search-input"
          :placeholder="computedPlaceholder"
          :aria-label="computedPlaceholder"
          @keydown.enter="handleTriggerSearch"
        />
        <button
          v-if="internalKeyword"
          type="button"
          class="search-clear-btn"
          title="清空搜索"
          aria-label="清空搜索"
          @click="handleClearKeyword"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div></div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, inject } from 'vue';
import { useRouter, routerKey, type Router } from 'vue-router';

export interface SortOptionItem {
  key: string;
  label: string;
  listType?: string;
  searchSort?: string;
  isStrict?: boolean;
  url?: string;
}

export interface FeedTypeOption {
  key: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    sort?: string;
    sortOptions?: SortOptionItem[];
    searchSortOptions?: SortOptionItem[];
    feedType?: string;
    feedTypeOptions?: FeedTypeOption[];
    showFeedType?: boolean;
    showSort?: boolean;
    showSearch?: boolean;
    glass?: boolean;
    searchKeyword?: string;
    placeholder?: string;
    targetTitle?: string;
    scopeType?: string;
    scopeParam?: string;
    scopeTab?: string;
    autoNavigateSearch?: boolean;
  }>(),
  {
    modelValue: '',
    sort: '',
    sortOptions: () => [
      { key: 'default', label: '默认' },
      { key: 'latest', label: '最新' },
      { key: 'hot', label: '热度' },
    ],
    searchSortOptions: () => [],
    feedType: 'all',
    feedTypeOptions: () => [],
    showFeedType: false,
    showSort: true,
    showSearch: true,
    searchKeyword: '',
    placeholder: '',
    targetTitle: '',
    scopeType: '',
    scopeParam: '',
    scopeTab: 'feed',
    autoNavigateSearch: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:sort', value: string): void;
  (e: 'change', value: string): void;
  (e: 'update:feedType', value: string): void;
  (e: 'change-feed-type', value: string): void;
  (e: 'update:searchKeyword', value: string): void;
  (e: 'clear'): void;
  (e: 'search', payload: { keyword: string; sort: string; targetTitle: string; query: string; routeQuery: Record<string, string> }): void;
}>();

const router = useRouter() || (inject(routerKey, null) as Router | null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const feedTypeControlRef = ref<HTMLElement | null>(null);
const feedTypeMenuOpen = ref(false);
const internalKeyword = ref(props.searchKeyword || '');

watch(() => props.searchKeyword, (val) => {
  if (val !== undefined && val !== internalKeyword.value) {
    internalKeyword.value = val;
  }
});

watch(internalKeyword, (val) => {
  emit('update:searchKeyword', val);
  if (!val.trim()) {
    emit('clear');
  }
});

const options = computed<SortOptionItem[]>(() => {
  return Array.isArray(props.sortOptions) && props.sortOptions.length > 0
    ? props.sortOptions
    : [
        { key: 'default', label: '默认' },
        { key: 'latest', label: '最新' },
        { key: 'hot', label: '热度' },
      ];
});

const searchOptions = computed<SortOptionItem[]>(() => {
  return Array.isArray(props.searchSortOptions) ? props.searchSortOptions : [];
});

const activeOptions = computed<SortOptionItem[]>(() => {
  return internalKeyword.value.trim() && searchOptions.value.length > 0
    ? searchOptions.value
    : options.value;
});

const feedTypeOptionList = computed<FeedTypeOption[]>(() => {
  return Array.isArray(props.feedTypeOptions) ? props.feedTypeOptions : [];
});

const showFeedTypeControl = computed(() => {
  return Boolean(props.showFeedType && internalKeyword.value.trim() && feedTypeOptionList.value.length > 0);
});

const currentSortKey = computed(() => {
  return props.sort || props.modelValue || activeOptions.value[0]?.key || 'default';
});

const currentFeedType = computed(() => {
  return props.feedType || feedTypeOptionList.value[0]?.key || 'all';
});

const currentFeedTypeLabel = computed(() => {
  return feedTypeOptionList.value.find((option) => option.key === currentFeedType.value)?.label || '全部';
});

const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return props.targetTitle ? `搜索${props.targetTitle}动态` : '搜索动态';
});

function handleFeedTypeOutsidePointerDown(event: PointerEvent) {
  if (!feedTypeControlRef.value?.contains(event.target as Node)) {
    closeFeedTypeMenu();
  }
}

function closeFeedTypeMenu() {
  feedTypeMenuOpen.value = false;
  document.removeEventListener('pointerdown', handleFeedTypeOutsidePointerDown);
}

function toggleFeedTypeMenu() {
  feedTypeMenuOpen.value = !feedTypeMenuOpen.value;
  if (feedTypeMenuOpen.value) {
    document.addEventListener('pointerdown', handleFeedTypeOutsidePointerDown);
  } else {
    document.removeEventListener('pointerdown', handleFeedTypeOutsidePointerDown);
  }
}

function handleSelectSort(key: string) {
  if (currentSortKey.value === key) return;
  emit('update:modelValue', key);
  emit('update:sort', key);
  emit('change', key);
}

function handleSelectFeedType(value: string) {
  closeFeedTypeMenu();
  if (currentFeedType.value === value) return;
  emit('update:feedType', value);
  emit('change-feed-type', value);
}

watch(showFeedTypeControl, (visible) => {
  if (!visible) closeFeedTypeMenu();
});

onBeforeUnmount(() => {
  closeFeedTypeMenu();
});

function handleClearKeyword() {
  internalKeyword.value = '';
  searchInputRef.value?.focus();
}

async function handleTriggerSearch() {
  const kw = internalKeyword.value.trim();
  const title = String(props.targetTitle || '').trim();

  const routeQuery: Record<string, string> = {};

  if (props.scopeType) {
    routeQuery.q = kw;
    routeQuery.tab = props.scopeTab || 'feed';
    routeQuery.pageType = props.scopeType;
    routeQuery.pageParam = props.scopeParam || title;
  } else {
    routeQuery.q = kw && title ? `${title} ${kw}` : kw || title;
  }

  emit('search', {
    keyword: kw,
    sort: currentSortKey.value,
    targetTitle: title,
    query: routeQuery.q || '',
    routeQuery,
  });

  if (props.autoNavigateSearch && routeQuery.q && router) {
    router.push({ path: '/search', query: routeQuery }).catch((err) => {
      console.warn('EntityFilterBar router push error:', err);
    });
  }
}
</script>

<style scoped>
.entity-filter-container { container-type: inline-size; width: 100%; min-width: 0; flex-shrink: 0; }
.entity-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  gap: 8px 12px;
  width: 100%;
  box-sizing: border-box;
}

.filter-main {
  /* 排序、动态类型与搜索共同按实际宽度换行，避免固定断点浪费空间。 */
  display: contents;
}

.filter-placeholder-spacer {
  flex: 1;
}

.filter-options {
  display: flex;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  align-items: center;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  border-radius: 16px;
  padding: 2px;
  height: 32px;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.filter-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  padding: 0 12px;
  height: 26px;
  line-height: 26px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  border-radius: 13px;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
}

.filter-btn:hover {
  color: var(--text-primary, #0f172a);
}

.filter-btn.active {
  background: var(--brand-primary, #10b981);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
}

.filter-actions {
  display: flex;
  align-items: center;
  flex: 1 1 155px;
  min-width: 0;
  max-width: 240px;
  margin-left: auto;
}

.filter-type-control {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
  border-radius: 16px;
  background: var(--surface, #ffffff);
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.filter-type-label {
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  white-space: nowrap;
}

.filter-type-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 112px;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text-primary, #0f172a);
  background: transparent;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
}

.filter-type-trigger i {
  color: var(--text-secondary, #64748b);
  font-size: 10px;
}

.filter-type-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: -1px;
  z-index: 20;
  min-width: 132px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
  border-radius: 12px;
  background: var(--surface, #ffffff);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16);
}

.filter-type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  color: var(--text-primary, #0f172a);
  background: transparent;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.filter-type-option:hover,
.filter-type-option.active {
  color: var(--brand-primary, #10b981);
  background: var(--brand-soft, rgba(16, 185, 129, 0.1));
}

.filter-type-option i {
  font-size: 11px;
}

.filter-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
  border-radius: 16px;
  padding: 0 10px;
  height: 32px;
  box-sizing: border-box;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  min-width: 0;
}

.filter-search-box:hover {
  border-color: var(--border-hover, rgba(0, 0, 0, 0.2));
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
}

.filter-search-box:focus-within {
  border-color: var(--brand-primary, #10b981);
  background: var(--surface, #ffffff);
  box-shadow: 0 0 0 2.5px rgba(16, 185, 129, 0.18);
  width: 100%;
}

.filter-search-icon {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.15s ease;
}

.filter-search-icon:hover {
  color: var(--brand-primary, #10b981);
}

.filter-search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 12.5px;
  color: var(--text-primary, #0f172a);
  width: 100%;
  padding: 0;
  min-width: 0;
}

.filter-search-input::placeholder {
  color: var(--text-secondary, #64748b);
  opacity: 0.75;
}

.search-clear-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  padding: 2px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.search-clear-btn:hover {
  color: var(--text-primary, #0f172a);
}

/* 窄区域允许搜索填满余下空间，不强制排序和搜索各占一行。 */
@container (max-width: 640px) {
  .filter-actions { max-width: none; }
}

/* 玻璃由话题工具栏整体承载，排序和类型筛选不再各自绘制独立玻璃卡片。 */
.is-glass :is(.filter-options, .filter-type-control) { background: transparent; border-color: transparent; box-shadow: none; }
.is-glass .filter-search-box { background: color-mix(in srgb, var(--surface) 18%, transparent); border-color: var(--topic-glass-edge, #ffffff9c); box-shadow: inset 0 1px 0 #ffffff30; }
.is-glass .filter-type-menu {
  background: linear-gradient(145deg, #ffffff38, transparent 50%, #ffffff0a), var(--topic-glass-tint, color-mix(in srgb, var(--surface) 45%, transparent));
  border-color: var(--topic-glass-edge, #ffffff9c);
  box-shadow: 0 4px 14px #00000009, inset 0 1px 0 var(--topic-glass-edge, #ffffff9c), inset 0 -1px 0 #ffffff18;
  -webkit-backdrop-filter: blur(24px) saturate(165%);
  backdrop-filter: blur(24px) saturate(165%);
}
/* 玻璃排序栏与首页栏目统一，用文字和下划线表示选中状态。 */
.is-glass .filter-btn.active { position: relative; background: transparent; color: var(--text-primary); font-weight: 700; box-shadow: none; }
.is-glass .filter-btn.active::after { content: ''; position: absolute; bottom: 0; left: 50%; width: 20px; height: 3px; border-radius: 3px; background: var(--brand-primary); transform: translateX(-50%); pointer-events: none; }
.is-glass .filter-search-box:focus-within { border-color: color-mix(in srgb, var(--brand-primary) 65%, var(--topic-glass-edge, white)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 15%, transparent), inset 0 1px 0 #ffffff60; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .is-glass .filter-type-menu { background: var(--surface); } }
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) { .is-glass .filter-type-menu { background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; border-color: var(--border); } }
</style>
