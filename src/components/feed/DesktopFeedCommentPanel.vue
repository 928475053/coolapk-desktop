<template>
  <div ref="panel" class="desktop-feed-comment-panel" :style="{ width: `${visibleWidth}px`, flexBasis: `${visibleWidth}px` }">
    <!-- 普通列表复用话题评论侧栏及其拖动记忆逻辑。 -->
    <div class="comment-panel-resizer" role="separator" tabindex="0" aria-label="调节右侧评论栏宽度" aria-orientation="vertical" :aria-valuemin="280" :aria-valuemax="640" :aria-valuenow="Math.round(visibleWidth)" title="拖动调节宽度，双击恢复默认" @pointerdown="startResize" @keydown="resizeWithKeyboard" @dblclick="resetWidth"></div>
    <TopicFeedCommentAside :feed="feed" @close="$emit('close')" />
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '../../types/feed';
import { onMounted, onUnmounted, ref } from 'vue';
import { observeResizeOnFrame } from '../../utils/observeResizeOnFrame';
import TopicFeedCommentAside from '../topic/TopicFeedCommentAside.vue';
import { usePersistedColumnResize } from '../../composables/usePersistedColumnResize';
defineProps<{ feed: FeedItem }>();
defineEmits<{ (event: 'close'): void }>();
const panel = ref<HTMLElement | null>(null);
const parentWidth = ref(1200);
// 给列表保留空间；窗口缩小时仅限制显示宽度，不覆盖保存值。
const { visibleWidth, startResize, resetWidth, resizeWithKeyboard } = usePersistedColumnResize({ storageKey: 'coolapk_list_comment_width', defaultWidth: () => 380, limits: () => ({ min: 280, max: Math.max(280, Math.min(640, parentWidth.value - 420)) }), direction: -1 });
let stopObserving: (() => void) | undefined;
onMounted(() => {
  const parent = panel.value?.parentElement;
  if (!parent) return;
  const measure = () => { parentWidth.value = parent.getBoundingClientRect().width || parentWidth.value; };
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
