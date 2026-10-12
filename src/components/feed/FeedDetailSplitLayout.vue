<template>
  <!-- 分栏详情页容器：左栏动态卡片（detail 模式，互动列表交给宿主渲染），
       右栏评论/点赞/转发由 FeedDetailAside 自行取数维护。
       右栏按 feed.id 加 key：FeedDetailAside 内部不监听 feed.id 变化，
       父层跨动态复用时必须重新挂载，否则评论数据会串到上一条动态。 -->
  <div class="feed-detail-split">
    <div class="feed-detail-split-left">
      <FeedCard
        :feed="feed"
        detail-mode
        :disable-inline-comments="true"
        :external-interaction-lists="true"
        :auto-open-comments="false"
        @open-comment="activeTab = 'replies'"
        @open-like-list="activeTab = 'likes'"
        @open-forward-list="activeTab = 'forwards'"
      />
    </div>
    <div class="feed-detail-split-right">
      <FeedDetailAside :key="feed.id" v-model:active-tab="activeTab" :feed="feed" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FeedCard from './FeedCard.vue';
import FeedDetailAside from './FeedDetailAside.vue';

defineProps<{
  feed: any;
}>();

// 右栏当前 tab：左栏卡片点评论/点赞/转发入口时切换过来，
// 右栏自己点 tab 也会经 update:activeTab 同步回来。
const activeTab = ref<'replies' | 'likes' | 'forwards'>('replies');
</script>

<style scoped>
/* 高度约束完全来自 height: 100%：FeedDetailAside 根元素是 height:100% + overflow-y:auto，
   只有父层有确定高度时它才会独立滚动；两栏各自 overflow-y:auto，互不干扰。 */
.feed-detail-split {
  display: flex;
  height: 100%;
}

.feed-detail-split-left {
  flex: 0 0 45%;
  min-width: 420px;
  overflow-y: auto;
}

.feed-detail-split-right {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
}
</style>
