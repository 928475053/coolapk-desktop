<template>
  <div ref="panel" class="desktop-feed-comment-panel" :style="{ width: `${visibleWidth}px`, flexBasis: `${visibleWidth}px` }">
    <!-- 普通列表复用话题评论侧栏及其拖动记忆逻辑。 -->
    <div class="comment-panel-resizer" role="separator" tabindex="0" aria-label="调节右侧评论栏宽度" aria-orientation="vertical" :aria-valuemin="widthLimits.min" :aria-valuemax="widthLimits.max" :aria-valuenow="Math.round(visibleWidth)" title="拖动调节宽度，双击恢复默认" @pointerdown="startResize" @keydown="resizeWithKeyboard" @dblclick="resetWidth"></div>
    <TopicFeedCommentAside :feed="feed" @close="$emit('close')" />
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '../../types/feed';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { observeResizeOnFrame } from '../../utils/observeResizeOnFrame';
import TopicFeedCommentAside from '../topic/TopicFeedCommentAside.vue';
import { usePersistedColumnResize } from '../../composables/usePersistedColumnResize';
defineProps<{ feed: FeedItem }>();
defineEmits<{ (event: 'close'): void }>();
const panel = ref<HTMLElement | null>(null);
const parentWidth = ref(1200);
// 默认约占内容区四成；给列表保留空间，窄窗口不覆盖用户保存的宽度。
const widthLimits = computed(() => ({ min: 280, max: Math.max(280, Math.min(640, parentWidth.value - 420)) }));
const { visibleWidth, startResize, resetWidth, resizeWithKeyboard } = usePersistedColumnResize({ storageKey: 'coolapk_list_comment_width', defaultWidth: () => Math.max(360, parentWidth.value * 0.4), limits: () => widthLimits.value, direction: -1, responsiveDefault: true });
let stopObserving: (() => void) | undefined;
onMounted(() => {
  const parent = panel.value?.parentElement;
  if (!parent) return;
  // 应用缩放使用 transform；宽度约束按逻辑像素计算，避免重复放大评论栏。
  const measure = () => { parentWidth.value = parent.clientWidth || parentWidth.value; };
  measure();
  stopObserving = observeResizeOnFrame(parent, measure);
});
onUnmounted(() => { stopObserving?.(); });
</script>

<style scoped>
.desktop-feed-comment-panel { position: relative; flex-grow: 0; flex-shrink: 0; min-width: 0; height: 100%; }
.desktop-feed-comment-panel :deep(.topic-feed-comment-aside) { width: 100%; }
.comment-panel-resizer { position: absolute; inset: 0 auto 0 -4px; width: 8px; cursor: col-resize; touch-action: none; z-index: 40; outline: none; }
.comment-panel-resizer::after { content: ''; position: absolute; inset: 0 3px; background: transparent; }
.comment-panel-resizer:hover::after, .comment-panel-resizer:active::after, .comment-panel-resizer:focus-visible::after { background: var(--brand-primary); }
</style>
