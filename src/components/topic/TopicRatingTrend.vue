<template>
  <section class="rating-trend official-rating-card" aria-label="全部用户评分趋势">
    <div class="trend-header"><h3>全部用户评分趋势</h3><div class="trend-periods">
      <button v-for="item in periods" :key="item.key" type="button" :aria-pressed="period === item.key" @click="period = item.key">{{ item.label }}</button>
    </div></div>
    <div class="chart-legend"><span><i class="score-key"></i>全部用户评分</span><span><i class="count-key"></i>全部用户点评人数</span></div>
    <div v-if="points.length" ref="chartElement" class="trend-chart" role="img" :aria-label="`${periods.find(item => item.key === period)?.label}评分趋势，${points.length} 个数据点，可横向滚动查看历史`">
      <svg class="chart-axes" :viewBox="`0 0 ${chartWidth} 210`" aria-hidden="true">
        <g v-for="(value, index) in scoreTicks" :key="value"><line x1="36" :x2="chartWidth - 38" :y1="scoreY(value)" :y2="scoreY(value)" class="chart-grid" /><text x="30" :y="scoreY(value) + 4" text-anchor="end" class="score-axis">{{ value === 10 ? '10' : value.toFixed(1) }}</text><text :x="chartWidth - 32" :y="scoreY(value) + 4" class="count-axis">{{ Math.round(index * maxCount / 5) }}</text></g>
      </svg>
      <div ref="plotElement" class="chart-scroll" tabindex="0" aria-label="横向滚动查看历史评分">
      <svg :width="plotWidth" :style="{ width: `${plotWidth}px` }" height="210" aria-hidden="true">
      <g v-for="(point, index) in points" :key="index">
        <rect :x="chartX(index) - barWidth / 2" :y="190 - point.count / maxCount * 180" :width="barWidth" :height="point.count / maxCount * 180" rx="5" class="count-bar"><title>{{ point.label }}：{{ point.count }} 人评分</title></rect>
      </g>
      <polyline :points="scoreLine" fill="none" class="score-line" />
      <circle v-for="(point, index) in points" :key="`score-${index}`" :cx="chartX(index)" :cy="scoreY(point.score)" r="3" class="score-point"><title>{{ point.label }}：{{ point.count ? point.score.toFixed(1) + ' 分' : '暂无评分' }}，{{ point.count }} 人评分</title></circle>
      <text v-for="(point, index) in points" :key="`label-${index}`" :x="chartX(index)" y="208" text-anchor="middle" class="date-label">{{ point.label }}</text>
      </svg>
      </div>
    </div>
    <div v-else class="trend-empty">{{ loading ? '正在加载评分趋势...' : error || '暂无评分趋势数据' }}<button v-if="error" type="button" @click="load">重试</button></div>
    <p v-if="error && points.length" class="trend-error">{{ error }} <button type="button" @click="load">重试</button></p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { ratingNumber } from '../../utils/topicRating';
const props = defineProps<{ topicId: string; initialChart?: any }>();
const periods = [{ key: 'day', label: '日' }, { key: 'week', label: '周' }, { key: 'month', label: '月' }];
const period = ref('week');
const data = ref<any>(null);
const loading = ref(false);
const error = ref('');
let requestId = 0;
const chart = computed(() => data.value?.[period.value]?.ratingChart || (period.value === (props.initialChart?.dataType || 'week') ? props.initialChart : null));
const points = computed(() => {
  const source = chart.value?.x;
  if (!Array.isArray(source)) return [];
  return source.flatMap((point: any) => {
    const score = ratingNumber(point.score);
    const count = ratingNumber(point.count);
    return score === null || count === null ? [] : [{ score, count, label: String(point.datelineStr || '') }];
  });
});
const maxCount = computed(() => {
  const axis = ratingNumber(chart.value?.y?.[1]?.max);
  if (axis !== null && axis > 0) return axis;
  const max = Math.max(1, ratingNumber(chart.value?.maxCount) || 0, ...points.value.map(point => point.count));
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
});
const minScore = computed(() => {
  const provided = ratingNumber(chart.value?.y?.[0]?.min);
  if (provided !== null) return provided;
  const valid = points.value.filter(point => point.count > 0 && point.score > 0).map(point => point.score);
  return valid.length ? Math.max(0, Math.floor((Math.min(...valid) - .5) * 2) / 2) : 0;
});
const maxScore = computed(() => Math.max(minScore.value + .5, ratingNumber(chart.value?.y?.[0]?.max) || 10));
const scoreTicks = computed(() => Array.from({ length: 6 }, (_, index) => minScore.value + index * (maxScore.value - minScore.value) / 5));
const chartElement = ref<HTMLElement | null>(null);
const plotElement = ref<HTMLElement | null>(null);
const chartWidth = ref(360);
let resizeObserver: ResizeObserver | undefined;
// Official compact chart uses fixed zoom rather than fitting the entire history.
// Keep the full series scrollable, with the latest six periods visible on phones.
const visibleCount = computed(() => Math.max(6, Math.floor((chartWidth.value - 74) / 52)));
const pointSpacing = computed(() => (chartWidth.value - 74) / Math.min(visibleCount.value, Math.max(1, points.value.length)));
const plotWidth = computed(() => Math.max(chartWidth.value - 74, points.value.length * pointSpacing.value));
function scoreY(score: number) { return 190 - Math.max(0, Math.min(1, (score - minScore.value) / (maxScore.value - minScore.value))) * 180; }
const barWidth = computed(() => pointSpacing.value * .68);
function chartX(index: number) { return (index + .5) * pointSpacing.value; }
const scoreLine = computed(() => points.value.map((point, index) => `${chartX(index)},${scoreY(point.score)}`).join(' '));
async function load() {
  const id = ++requestId;
  loading.value = true; error.value = '';
  try {
    const response = await CoolapkTauriAPI.getTopicRatingChart(props.topicId);
    if (id !== requestId) return;
    if (Number(response?.code) !== 200 || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) throw new Error('评分趋势加载失败');
    data.value = response.data;
  } catch (cause) { if (id === requestId) error.value = cause instanceof Error ? cause.message : String(cause); }
  finally { if (id === requestId) loading.value = false; }
}
watch(chartElement, element => {
  resizeObserver?.disconnect();
  if (!element || typeof ResizeObserver === 'undefined') return;
  resizeObserver = new ResizeObserver(([entry]) => { chartWidth.value = Math.max(180, entry.contentRect.width); });
  resizeObserver.observe(element);
});
watch([points, chartWidth], async () => { await nextTick(); if (plotElement.value) plotElement.value.scrollLeft = plotElement.value.scrollWidth; }, { flush: 'post' });
watch(() => props.topicId, () => { data.value = null; period.value = 'week'; void load(); }, { immediate: true });
onUnmounted(() => { requestId++; resizeObserver?.disconnect(); });
</script>

<style scoped>
.rating-trend { background: var(--surface); padding: 12px; border-radius: 8px; min-width: 0; }
h3 { font-size: 14px; font-weight: 500; margin: 0; }
.trend-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.trend-periods { display: flex; gap: 2px; }
.trend-periods button { border: 0; border-radius: 6px; padding: 5px 10px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.trend-periods button[aria-pressed="true"] { color: var(--brand-primary); background: var(--surface-hover); }
.chart-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary); padding: 10px 0; }
.chart-legend span { display: flex; gap: 4px; align-items: center; }
.chart-legend i { width: 12px; height: 12px; border-radius: 2px; }
.score-key, .score-point { background: #0aa05b; fill: #0aa05b; }
.count-key, .count-bar { background: #ffb900; fill: #ffb900; }
.score-axis { fill: #0aa05b; }.count-axis { fill: #ffb900; }
.trend-chart { position: relative; width: 100%; height: 210px; }
.chart-axes { position: absolute; inset: 0; width: 100%; height: 210px; }
.chart-scroll { position: absolute; left: 36px; right: 38px; top: 0; height: 222px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }
.chart-scroll svg { display: block; max-width: none; }
.chart-grid { stroke: var(--border-light); stroke-width: 1; stroke-dasharray: 4 3; }
.score-line { stroke: #0aa05b; stroke-width: 2; }
text { font-size: 12px; fill: var(--text-secondary); }
.date-label { font-size: 11px; }
.trend-empty { height: 220px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); font-size: 13px; }
.trend-error { font-size: 12px; color: var(--text-secondary); }
.trend-empty button, .trend-error button { color: var(--brand-primary); border: 0; background: transparent; cursor: pointer; }
</style>
