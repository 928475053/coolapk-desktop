<template>
  <div class="official-rating-detail-body">
    <section v-if="stars > 0 || dimensions.length" class="personal-rating-card" aria-label="个人评分详情">
      <div class="rating-target-heading"><AppImage v-if="target.logo || feed.target_pic" :src="target.logo || feed.target_pic" image-class="rating-target-logo" fit="cover" /><strong>{{ target.title || feed.target_title }}</strong><span>酷安评分</span></div>
      <div v-if="stars > 0" class="personal-rating-row overall-row"><span>评分</span><div class="personal-stars boxed"><i v-for="value in 5" :key="value" class="fas fa-star" :class="{ active: value <= stars }"></i></div><span class="personal-face"><img :src="faces[Math.max(0, Math.round(stars) - 1)]" alt="">{{ descriptions[Math.max(0, Math.round(stars) - 1)] }}</span></div>
      <div v-for="item in dimensions" :key="item.name" class="personal-rating-row"><span>{{ item.name }}</span><div class="personal-stars"><i v-for="value in 5" :key="value" class="fas fa-star" :class="{ active: value <= item.stars }"></i></div><span class="dimension-description">{{ item.description }}</span></div>
    </section>
    <div v-for="item in comments" :key="item.label" class="personal-rating-comment"><span class="comment-label">{{ item.label }}</span><FeedContent :feed-id="feed.id" :message="item.message" force-expanded /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppImage from '../common/AppImage.vue';
import FeedContent from './FeedContent.vue';
import { ratingNumber, topicScoreStars } from '../../utils/topicRating';
import face1 from '../../assets/official-rating/ic_face_star_1.png';
import face2 from '../../assets/official-rating/ic_face_star_2.png';
import face3 from '../../assets/official-rating/ic_face_star_3.png';
import face4 from '../../assets/official-rating/ic_face_star_4.png';
import face5 from '../../assets/official-rating/ic_face_star_5.png';
const props = defineProps<{ feed: any }>();
const faces = [face1, face2, face3, face4, face5];
const descriptions = ['很差', '较差', '一般', '不错', '非常好'];
const target = computed(() => props.feed.targetRow || props.feed.target_row || {});
const stars = computed(() => topicScoreStars(ratingNumber(props.feed.rating_score ?? props.feed.ratingScore) || 0));
function parse(value: any) { if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch { return null; } }
const dimensions = computed(() => {
  const items = parse(props.feed.rating_item_info ?? props.feed.ratingItemInfo);
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: any) => {
    const score = ratingNumber(item.v4_score ?? item.v4Score);
    if (!item.name || !score) return [];
    // Official RatingItemInfo.getStar divides personal v4_score by two.
    const stars = Math.max(1, Math.min(5, Math.round(score / 2)));
    return [{ name: String(item.name), stars, description: String(item.star_desc?.[stars - 1] || descriptions[stars - 1]) }];
  });
});
const comments = computed(() => {
  const v4 = parse(props.feed.v4_rating_message ?? props.feed.v4RatingMessage);
  if (v4 && typeof v4 === 'object' && !Array.isArray(v4)) {
    const entries = Object.entries(v4).flatMap(([label, value]) => typeof value === 'string' && value ? [{ label, message: value }] : []);
    if (entries.length) return entries;
  }
  const addition = props.feed.comment_addition ?? props.feed.commentAddition;
  const good = props.feed.comment_good ?? props.feed.commentGood;
  const bad = props.feed.comment_bad ?? props.feed.commentBad;
  const general = props.feed.comment_general ?? props.feed.commentGeneral;
  const entries = [{ label: '对象', message: addition }, { label: '优点', message: good }, { label: '缺点', message: bad }, { label: good || bad ? '总评' : '点评', message: general }].filter(item => item.message);
  if (entries.length) return entries;
  const message = String(props.feed.message || props.feed.message_raw_output || '').replace(/^\s*【点评】\s*/, '');
  return message ? [{ label: '点评', message }] : [];
});
</script>

<style scoped>
.official-rating-detail-body { margin-top: 12px; }
.personal-rating-card { padding: 16px; background: var(--background-secondary); border-radius: 10px; }
.rating-target-heading { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
.rating-target-heading :deep(.rating-target-logo) { width: 32px; height: 32px; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.rating-target-heading strong { font-size: 16px; flex: 1; }
.rating-target-heading > span { font-size: 11px; font-weight: 700; color: var(--brand-primary); }
.personal-rating-row { display: grid; grid-template-columns: minmax(80px, 1.1fr) minmax(110px, 1.8fr) minmax(44px, .9fr); align-items: center; gap: 8px; margin-top: 12px; font-size: 14px; }
.personal-stars { display: flex; justify-content: space-between; gap: 5px; color: var(--text-tertiary); }
.personal-stars i.active { color: #ffb900; }
.personal-stars.boxed i { display: grid; place-items: center; background: var(--border-color); color: white; width: 18px; height: 18px; border-radius: 3px; font-size: 12px; }
.personal-stars.boxed i.active { background: #ffb900; }
.personal-face { display: flex; align-items: center; gap: 3px; color: #ee8900; background: #ffb90014; border-radius: 12px; font-size: 12px; white-space: nowrap; }
.personal-face img { width: 20px; height: 20px; }
.dimension-description { color: var(--text-secondary); }
.personal-rating-comment { margin-top: 14px; }
.comment-label { display: inline-block; padding: 3px 8px; border-radius: 4px; color: white; background: #0aa05b; font-size: 14px; font-weight: 600; }
.personal-rating-comment :deep(.feed-content) { margin-top: 6px; }
@media (min-width: 721px) { .personal-rating-card { max-width: 680px; padding: 24px; }.personal-rating-row { grid-template-columns: 120px 200px 1fr; }.personal-stars { justify-content: flex-start; gap: 20px; } }
@media (max-width: 360px) { .personal-rating-card { padding: 12px; }.personal-rating-row { grid-template-columns: 76px minmax(80px, 1fr) 46px; gap: 5px; font-size: 12px; }.personal-face { font-size: 10px; }.personal-face img { width: 16px; height: 16px; }.personal-stars { gap: 2px; } }
</style>
