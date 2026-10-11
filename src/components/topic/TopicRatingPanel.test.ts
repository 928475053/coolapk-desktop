import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getTopicRatingList: vi.fn(), getTopicRatingChart: vi.fn(), getFeedDetail: vi.fn(), openFeedDetail: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../utils/anchorClick', () => ({ handleAnchorClick: vi.fn() }));
vi.mock('../../utils/feedNavigation', () => ({ openFeedDetail: mocks.openFeedDetail }));
import TopicRatingPanel from './TopicRatingPanel.vue';
import TopicRatingTrend from './TopicRatingTrend.vue';

const detail = { id: 76, title: 'iOS27', star_average_score: 8.8, star_total_count: 120, star_5_count: 80,
  rating_item_info: [{ id: 1, name: '流畅度', average_score: 8.1 }], recent_30_days_star_average_score: 8, recent_30_days_star_total_count: 20, recent_30_days_goods_percent: 75 };
const review = (id: number) => ({ id, entityType: 'nodeRating', star: 4, description: `点评${id}`, userInfo: { uid: 1, username: '酷友' }, rating_item_info: [{ name: '流畅度', v4_score: 6 }] });
function panel() { return mount(TopicRatingPanel, { props: { detail }, global: { stubs: { AppAvatar: true, AppImage: true } } }); }
beforeEach(() => { vi.clearAllMocks(); mocks.getTopicRatingChart.mockResolvedValue({ code: 200, data: {} }); mocks.getTopicRatingList.mockResolvedValue({ code: 200, data: [review(1)] }); });
describe('话题点评加载', () => {
  it('按照官方 feed_id 显示评语入口并打开动态，不误判为无评语', async () => {
    mocks.getTopicRatingList.mockResolvedValueOnce({ code: 200, data: [{ ...review(1), description: null, feed_id: '100' }] });
    const wrapper = panel(); await flushPromises();
    expect(wrapper.text()).not.toContain('该用户仅评分');
    expect(wrapper.find('.review-badges').text()).not.toContain('无评语');
    await wrapper.findAll('.review-badges button')[1].trigger('click');
    expect(mocks.openFeedDetail).toHaveBeenCalledWith(expect.anything(), '100'); wrapper.unmount();
  });
  it('展示官方汇总与个人维度，分页保留首尾游标并去重', async () => {
    const wrapper = panel(); await flushPromises();
    expect(wrapper.find('.overall-score').text()).toBe('8.8');
    expect(wrapper.find('.recent-good-rate').text()).toContain('75%');
    expect(wrapper.find('.review-badges button').text()).toContain('详细');
    mocks.getTopicRatingList.mockResolvedValueOnce({ code: 200, data: [review(1), review(2)] });
    await wrapper.find('.load-more').trigger('click'); await flushPromises();
    expect(mocks.getTopicRatingList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, firstItem: '1', lastItem: '1', topicId: '76' }));
    expect(wrapper.findAll('.rating-review')).toHaveLength(2); wrapper.unmount();
  });
  it('筛选重置分页，丢弃旧请求并保持筛选参数', async () => {
    let resolve!: (value: any) => void;
    mocks.getTopicRatingList.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const wrapper = panel(); await wrapper.findAll('.rating-star-selector button')[1].trigger('click'); await flushPromises();
    expect(mocks.getTopicRatingList).toHaveBeenLastCalledWith(expect.objectContaining({ star: 5, page: 1, firstItem: '', lastItem: '' }));
    resolve({ code: 200, data: [review(99)] }); await flushPromises();
    expect(wrapper.text()).not.toContain('点评99');
    await wrapper.findAll('.rating-filters button')[1].trigger('click'); await flushPromises();
    expect(mocks.getTopicRatingList).toHaveBeenLastCalledWith(expect.objectContaining({ star: 5, ratingType: '1' })); wrapper.unmount();
  });
  it('分页失败保留已显示点评，重试同一页', async () => {
    const wrapper = panel(); await flushPromises();
    mocks.getTopicRatingList.mockRejectedValueOnce(new Error('网络失败'));
    await wrapper.find('.load-more').trigger('click'); await flushPromises();
    expect(wrapper.findAll('.rating-review')).toHaveLength(1);
    expect(wrapper.find('.load-error').text()).toBe('网络失败');
    await wrapper.find('.load-more').trigger('click'); await flushPromises();
    expect(mocks.getTopicRatingList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })); wrapper.unmount();
  });
  it('趋势按官方日周月字段切换，保留初始图表作为失败回退', async () => {
    const x = [{ score: 8, count: 20, datelineStr: '10-01' }];
    mocks.getTopicRatingChart.mockResolvedValueOnce({ code: 200, data: { day: { ratingChart: { x } }, week: { ratingChart: { x: [...x, { score: 9, count: 5, datelineStr: '10-08' }] } } } });
    const wrapper = mount(TopicRatingTrend, { props: { topicId: '76' } }); await flushPromises();
    expect(wrapper.findAll('.score-point')).toHaveLength(2);
    await wrapper.findAll('.trend-periods button')[0].trigger('click');
    expect(wrapper.findAll('.score-point')).toHaveLength(1); wrapper.unmount();
    mocks.getTopicRatingChart.mockRejectedValueOnce(new Error('网络失败'));
    const fallback = mount(TopicRatingTrend, { props: { topicId: '76', initialChart: { x } } }); await flushPromises();
    expect(fallback.find('.trend-chart').exists()).toBe(true);
    expect(fallback.find('.trend-error').text()).toContain('网络失败'); fallback.unmount();
  });
  it('初始日数据不覆盖默认周趋势，历史数据保持可滚动并使用官方坐标范围', async () => {
    const x = Array.from({ length: 52 }, (_, index) => ({ score: index < 49 ? 0 : 9.5, count: index < 49 ? 0 : 100, datelineStr: `第${index + 1}周` }));
    mocks.getTopicRatingChart.mockResolvedValueOnce({ code: 200, data: { week: { ratingChart: { x, y: [{ min: 7.5, max: 10 }, { min: 0, max: 500 }] } } } });
    const wrapper = mount(TopicRatingTrend, { props: { topicId: '76', initialChart: { dataType: 'day', x: [{ score: 8, count: 1, datelineStr: '旧日数据' }] } } });
    expect(wrapper.find('.trend-chart').exists()).toBe(false);
    await flushPromises();
    expect(wrapper.findAll('.trend-periods button')[1].attributes('aria-pressed')).toBe('true');
    expect(wrapper.findAll('.score-point')).toHaveLength(52);
    expect(wrapper.find('.chart-scroll').exists()).toBe(true);
    expect(Number(wrapper.find('.chart-scroll svg').attributes('width'))).toBeGreaterThan(360);
    expect(wrapper.findAll('.score-axis')[0].text()).toBe('7.5');
    expect(wrapper.findAll('.count-axis')[5].text()).toBe('500');
    expect(wrapper.find('.score-point').attributes('cy')).toBe('190');
    wrapper.unmount();
  });
});
