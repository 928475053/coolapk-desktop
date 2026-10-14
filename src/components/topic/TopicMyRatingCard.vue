<template>
  <button class="topic-my-rating" type="button" @click="openMyRating">
    <span class="my-rating-icon" aria-hidden="true"><i class="fas fa-star"></i></span>
    <span class="my-rating-copy"><strong>我的打分</strong><small>{{ rating ? `${rating} 星 · ${reviewTarget ? '查看我的点评' : '查看评分信息'}` : '查看个人评分信息' }}</small></span>
    <span v-if="rating" class="my-rating-stars" :aria-label="`${rating} 星`"><i v-for="n in 5" :key="n" class="fas fa-star" :class="{ filled: n <= rating }" aria-hidden="true"></i></span>
    <i class="fas fa-chevron-right my-rating-arrow" aria-hidden="true"></i>
  </button>
  <AppDialog :is-open="dialogOpen" title="我的打分" :width="420" @close="dialogOpen = false">
    <div class="my-rating-info">
      <strong>{{ detail.title || '话题评分' }}</strong>
      <span class="my-rating-stars" :aria-label="rating ? `${rating} 星` : '暂无评分'"><i v-for="n in 5" :key="n" class="fas fa-star" :class="{ filled: n <= rating }" aria-hidden="true"></i></span>
      <p>{{ rating ? `你已给出 ${rating} 星评分，暂无关联的点评动态。` : '暂未获取到你的个人评分。' }}</p>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppDialog from '../common/AppDialog.vue';
import { useAuthStore } from '../../stores/auth';
import { normalizeCoolapkRoute } from '../../utils/coolapkRoute';
import { openFeedDetail } from '../../utils/feedNavigation';

const props = defineProps<{ detail: any; entity: any }>();
const authStore = useAuthStore();
const router = useRouter();
const dialogOpen = ref(false);
// APK 的 singleRatingCard 只是占位，个人评分与点评地址应从话题 userAction 读取。
const action = computed(() => props.detail.userAction || props.detail.user_action || {});
const rating = computed(() => {
  const value = Number(action.value.rating ?? props.entity.rating ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.min(5, Math.round(value)) : 0;
});
const reviewTarget = computed(() => {
  const url = String(action.value.ratingFeedUrl || action.value.rating_feed_url || '').trim();
  const target = normalizeCoolapkRoute(url);
  if (target && /^\/feed\/\d+(?:[?#]|$)/.test(target)) return target;
  const feed = props.detail.ratingFeed || props.detail.rating_feed;
  const id = String(feed?.id || feed?.feedId || '').trim();
  return /^\d+$/.test(id) && Number(id) > 0 ? `/feed/${id}` : '';
});
function openMyRating() {
  if (!authStore.isLoggedIn) { authStore.openLoginModal(); return; }
  if (reviewTarget.value) {
    const feedId = reviewTarget.value.match(/^\/feed\/(\d+)/)?.[1];
    if (feedId) openFeedDetail(router, feedId, props.detail.ratingFeed || props.detail.rating_feed);
    return;
  }
  dialogOpen.value = true;
}
</script>

<style scoped>
/* 与话题工具栏统一使用轻透底色，星级与操作提示让入口可识别。 */
.topic-my-rating { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; padding: 16px; border: 1px solid color-mix(in srgb, var(--brand-primary) 16%, var(--border)); border-radius: 16px; background: linear-gradient(115deg, color-mix(in srgb, var(--brand-primary) 7%, transparent), transparent 75%), color-mix(in srgb, var(--surface) 78%, transparent); color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; transition: background .18s, border-color .18s; }
.topic-my-rating:hover { border-color: color-mix(in srgb, var(--brand-primary) 45%, var(--border)); background-color: color-mix(in srgb, var(--brand-primary) 5%, var(--surface)); }
.topic-my-rating:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 3px; }
.my-rating-icon { display: grid; place-items: center; flex: 0 0 44px; height: 44px; border-radius: 14px; background: color-mix(in srgb, var(--brand-primary) 12%, transparent); color: var(--brand-primary); font-size: 21px; }
.my-rating-copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; }
.my-rating-copy strong { font-size: 14px; font-weight: 600; }
.my-rating-copy small, .my-rating-info p { color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.my-rating-stars { display: flex; gap: 4px; color: var(--border); font-size: 15px; }
.my-rating-stars .filled { color: var(--brand-primary); }
.my-rating-arrow { color: var(--text-tertiary, var(--text-secondary)); font-size: 12px; }
.my-rating-info { display: flex; align-items: center; flex-direction: column; gap: 18px; padding: 16px 0; text-align: center; }
.my-rating-info .my-rating-stars { font-size: 25px; gap: 8px; }
.my-rating-info p { margin: 0; }
@media (max-width: 480px) { .topic-my-rating { gap: 10px; padding: 12px; } .topic-my-rating .my-rating-stars { gap: 3px; font-size: 12px; } .my-rating-icon { flex-basis: 40px; height: 40px; } }
@media (prefers-reduced-motion: reduce) { .topic-my-rating { transition: none; } }
</style>
