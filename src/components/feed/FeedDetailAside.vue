<template>
  <aside class="feed-detail-aside">
    <!-- 工具栏：tab 切换 / 只看楼主 / 排序 / 刷新 -->
    <div class="aside-toolbar">
      <div class="aside-tabs" role="tablist" aria-label="右栏列表切换">
        <button
          v-for="tab in asideTabs"
          :key="tab.value"
          type="button"
          role="tab"
          :class="['aside-tab', { 'is-active': activeTab === tab.value }]"
          :aria-selected="activeTab === tab.value"
          @click="emit('update:activeTab', tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <label class="only-author-toggle" title="只看楼主的评论">
        <input v-model="onlyAuthor" type="checkbox" />
        <span>只看楼主</span>
      </label>

      <select v-model="sortMode" class="aside-sort-select" aria-label="评论排序" title="评论排序">
        <option v-for="option in commentSortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <button type="button" class="aside-refresh-btn" title="刷新" aria-label="刷新" @click="refreshCurrentTab">
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- 回复 tab：评论列表由右栏自己取数维护；排序与只看楼主走服务端，评论组件按接口顺序原样渲染 -->
    <FeedCommentSection
      v-if="activeTab === 'replies'"
      :feed-id="feed.id"
      :feed-uid="authorUid"
      :feed-username="feed.username || feed.userInfo?.username"
      :comments="comments"
      :total-comment-count="feed.replynum"
      :loading="commentsLoading"
      :error="commentsError"
      :has-more-comments="hasMoreComments"
      :loading-more-comments="commentsLoadingMore"
      :load-more-error="commentsLoadMoreError"
      :default-sort-mode="sortMode"
      preserve-api-order
      :hide-collapse-button="true"
      @delete-comment="removeComment"
      @load-more-comments="loadMoreComments"
      @retry-comments="reloadComments"
      @retry-more-comments="loadMoreComments"
    />

    <!-- 点赞 / 转发 tab：内嵌互动列表自己取数分页；刷新通过换 key 重新挂载 -->
    <FeedInteractionListDialog
      v-else
      :key="refreshVersion"
      inline
      :show="true"
      :mode="activeTab"
      :feed-id="feed.id"
      :feed-type="getFeedInteractionType(feed)"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useSettingsStore } from '../../stores/settings';
import FeedCommentSection from './FeedCommentSection.vue';
import FeedInteractionListDialog from './FeedInteractionListDialog.vue';
import { getFeedInteractionType } from '../../utils/feedInteractions';
import {
  COMMENT_SORT_OPTIONS,
  DEFAULT_COMMENT_SORT_MODE,
  getCommentReplyRequestOptions,
  getExpectedCommentCount,
  getReplyData,
  getReplyPageCursor,
  hasMoreReplyPages,
  mergeReplies,
  type CommentSortMode,
} from '../../utils/commentList';

const props = withDefaults(
  defineProps<{
    feed: any;
    activeTab: 'replies' | 'likes' | 'forwards';
  }>(),
  { activeTab: 'replies' },
);

const emit = defineEmits<{
  (e: 'update:activeTab', value: 'replies' | 'likes' | 'forwards'): void;
}>();

const settingsStore = useSettingsStore();

// tab 切换只抛事件给父层，由父层改 activeTab 再传回来。
const asideTabs: ReadonlyArray<{ value: 'replies' | 'likes' | 'forwards'; label: string }> = [
  { value: 'replies', label: '回复' },
  { value: 'likes', label: '点赞' },
  { value: 'forwards', label: '转发' },
];

// 工具栏状态全部组件局部，不进 Pinia。
const onlyAuthor = ref(false);
const sortMode = ref<CommentSortMode>(
  settingsStore.settings.commentDefaultSortMode || DEFAULT_COMMENT_SORT_MODE,
);
const commentSortOptions = COMMENT_SORT_OPTIONS;

const authorUid = computed(() => String(props.feed?.uid || props.feed?.userInfo?.uid || ''));

// 评论取数状态：与 FeedCard 评论区共用同一条数据路径（replyList 分页游标取已加载评论的首尾 ID）。
const comments = ref<any[]>([]);
const commentsLoading = ref(false);
const commentsError = ref('');
const commentsLoadingMore = ref(false);
const commentsLoadMoreError = ref('');
const commentsPage = ref(0);
const hasMoreComments = ref(false);
let commentsFirstItem = '';
let commentsLastItem = '';
let commentsRequestVersion = 0;

// 刷新互动列表用：递增 key 让内嵌互动列表重新挂载并重拉第一页。
const refreshVersion = ref(0);

function loadCommentPage(
  requestedFeedId: string,
  page: number,
  cursor?: { firstItem?: string; lastItem?: string },
): Promise<any[]> {
  return CoolapkTauriAPI.getFeedReplies(requestedFeedId, page, {
    ...getCommentReplyRequestOptions(sortMode.value, onlyAuthor.value),
    ...cursor,
  }).then(getReplyData);
}

function updateCommentCursor(pageReplies: any[], resetFirst = false) {
  const cursor = getReplyPageCursor(pageReplies);
  if (resetFirst || !commentsFirstItem) commentsFirstItem = cursor.firstItem;
  if (cursor.lastItem) commentsLastItem = cursor.lastItem;
}

// 删除成功后在本地移除该条评论：FeedCommentSection 只负责发 API + emit，
// 列表本身由右栏维护，不接这个事件的话界面上评论会删不掉（与 FeedCard 单栏路径一致）。
function removeComment(id: string | number) {
  comments.value = comments.value.filter((c: any) => String(c.id) !== String(id));
}

// 重取第一页并重置游标：首屏、错误重试、刷新、切换只看楼主/排序共用同一段逻辑。
async function reloadComments() {
  const requestedFeedId = String(props.feed?.id ?? '');
  if (!requestedFeedId) return;

  const currentRequest = ++commentsRequestVersion;
  comments.value = [];
  commentsPage.value = 0;
  commentsFirstItem = '';
  commentsLastItem = '';
  commentsError.value = '';
  commentsLoadMoreError.value = '';
  commentsLoadingMore.value = false;
  hasMoreComments.value = false;
  commentsLoading.value = true;

  try {
    const pageReplies = await loadCommentPage(requestedFeedId, 1);
    if (currentRequest !== commentsRequestVersion) return;

    updateCommentCursor(pageReplies, true);
    comments.value = pageReplies;
    commentsPage.value = pageReplies.length > 0 ? 1 : 0;
    hasMoreComments.value = hasMoreReplyPages(
      pageReplies,
      [],
      pageReplies,
      getExpectedCommentCount(props.feed?.replynum),
    );
  } catch (err) {
    if (currentRequest === commentsRequestVersion) {
      console.error('Failed to load comments', err);
      commentsError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (currentRequest === commentsRequestVersion) commentsLoading.value = false;
  }
}

async function loadMoreComments() {
  if (!hasMoreComments.value || commentsLoading.value || commentsLoadingMore.value) {
    return;
  }

  const requestedFeedId = String(props.feed?.id ?? '');
  if (!requestedFeedId) return;

  const currentRequest = commentsRequestVersion;
  const page = commentsPage.value + 1;
  commentsLoadingMore.value = true;
  commentsLoadMoreError.value = '';

  try {
    const pageReplies = await loadCommentPage(requestedFeedId, page, {
      firstItem: commentsFirstItem,
      lastItem: commentsLastItem,
    });
    if (currentRequest !== commentsRequestVersion) return;

    updateCommentCursor(pageReplies);
    const previousReplies = comments.value;
    const mergedReplies = mergeReplies(previousReplies, pageReplies);
    if (mergedReplies.length > previousReplies.length) {
      comments.value = mergedReplies;
      commentsPage.value = page;
    }
    hasMoreComments.value = hasMoreReplyPages(
      pageReplies,
      previousReplies,
      mergedReplies,
      getExpectedCommentCount(props.feed?.replynum),
    );
  } catch (err) {
    if (currentRequest === commentsRequestVersion) {
      console.error('Failed to load more comments', err);
      commentsLoadMoreError.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (currentRequest === commentsRequestVersion) commentsLoadingMore.value = false;
  }
}

// 刷新：评论 tab 重拉第一页；点赞/转发 tab 通过换 key 重新挂载重拉。
function refreshCurrentTab() {
  refreshVersion.value += 1;
  if (props.activeTab === 'replies') void reloadComments();
}

// 只看楼主与排序都走服务端：切换时重新取第一页（同一段重取逻辑），不做本地过滤。
watch([onlyAuthor, sortMode], () => {
  void reloadComments();
});

onMounted(() => {
  // 挂载即预取评论第一页；点赞/转发 tab 的数据由内嵌互动列表自行取数。
  void reloadComments();
});
</script>

<style scoped>
.feed-detail-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}

.aside-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.aside-tabs {
  display: flex;
  flex: 1 1 auto;
  gap: 4px;
}

.aside-tab {
  padding: 5px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill, 999px);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
}

.aside-tab:hover {
  color: var(--text-primary);
}

.aside-tab.is-active {
  background: var(--brand-soft);
  color: var(--brand-primary);
  font-weight: 600;
}

.only-author-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.only-author-toggle input {
  accent-color: var(--brand-primary);
  cursor: pointer;
}

.aside-sort-select {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 10px);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 13px;
}

.aside-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-control, 10px);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
}

.aside-refresh-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}
</style>
