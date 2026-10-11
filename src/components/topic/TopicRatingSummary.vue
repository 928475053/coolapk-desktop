<template>
  <section class="topic-official-summary">
    <header><h3>酷安评分</h3><button type="button" @click="$emit('detail')">详细数据 <i class="fas fa-chevron-right"></i></button></header>
    <div class="summary-body"><div class="score"><strong>{{ score > 0 ? score.toFixed(1) : '—' }}</strong><span class="boxed-stars"><i v-for="n in 5" :key="n" class="fas fa-star" :class="{ filled: n <= topicScoreStars(score) }"></i></span><small>用户评分</small></div>
      <div class="dimensions"><div v-for="item in dimensions" :key="item.id"><span>{{ item.name }}</span><b><i :style="{ width: `${Math.min(10, item.score) * 10}%` }"></i></b><strong>{{ item.score.toFixed(1) }}</strong></div></div>
    </div>
    <footer><span>{{ Number(detail.star_total_count || 0) }}用户点评 <template v-if="detail.v4_rating_total_count">{{ detail.v4_rating_total_count }}详细点评</template></span><span v-if="Number(detail.allow_rate) !== 1" class="rate-disabled">不可点评</span></footer>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { topicRatingDimensions, topicScoreStars } from '../../utils/topicRating';
const props = defineProps<{ detail: any }>();
defineEmits<{ detail: [] }>();
const score = computed(() => Number(props.detail.star_average_score || props.detail.rating_average_score || 0));
const dimensions = computed(() => topicRatingDimensions(props.detail.rating_item_info));
</script>
<style scoped>
.topic-official-summary { background: var(--surface); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h3 { margin: 0; font-size: 18px; } header button { border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; font-size: 12px; }
.summary-body { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
.score { width: 40%; flex-shrink: 0; text-align: center; display: flex; flex-direction: column; gap: 8px; }.score > strong { font-size: 44px; }.score small { color: var(--text-secondary); font-size: 12px; }
.boxed-stars { display: flex; justify-content: center; gap: 5px; }.boxed-stars i { width: 16px; height: 16px; border-radius: 3px; background: var(--border); color: white; display: grid; place-items: center; font-size: 11px; }.boxed-stars .filled { background: #ffb900; }
.dimensions { flex: 1; min-width: 0; }.dimensions > div { display: grid; grid-template-columns: minmax(50px, 1fr) minmax(35px, 1.3fr) 24px; gap: 6px; align-items: center; margin: 5px 0; font-size: 12px; color: var(--text-secondary); }.dimensions span { text-align: right; }.dimensions strong { font-weight: 400; }.dimensions b { height: 8px; background: var(--border-light); border-radius: 6px; overflow: hidden; }.dimensions b i { display: block; height: 100%; background: #ffb900; border-radius: inherit; }
footer { padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 12px; color: var(--text-secondary); }.rate-disabled { border: 1px solid var(--border); padding: 3px 8px; border-radius: 12px; white-space: nowrap; }
@media(max-width:720px){.topic-official-summary { background: #0002; color: white; }.topic-official-summary header button,.score small,.dimensions > div,footer{color:#fffa}.dimensions b{background:#ffffff15}footer{border-color:#ffffff15}.rate-disabled{border-color:#ffffff30}}
</style>
