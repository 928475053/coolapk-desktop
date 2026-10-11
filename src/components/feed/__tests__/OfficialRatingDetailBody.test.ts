import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import OfficialRatingDetailBody from '../OfficialRatingDetailBody.vue';

describe('官方点评详情正文', () => {
  it.each([false, true])('同时支持接口原字段与原生归一化字段，维度按个人分换算（归一化=%s）', normalized => {
    const raw = { rating_score: 10, rating_item_info: [{ name: '美观度', v4_score: 10, star_desc: ['粗糙', '普通', '一般', '漂亮', '精致'] }], v4_rating_message: JSON.stringify({ 点评: '具体给好评的理由' }) };
    const fields = normalized ? { ratingScore: raw.rating_score, ratingItemInfo: raw.rating_item_info, v4RatingMessage: raw.v4_rating_message } : raw;
    const wrapper = mount(OfficialRatingDetailBody, { props: { feed: { id: '42', title: 'Zeldq的点评', message: '【点评】摘要', targetRow: { title: 'ColorOS17' }, ...fields } }, global: { stubs: { AppImage: true, FeedContent: { props: ['message'], template: '<div>{{ message }}</div>' } } } });
    expect(wrapper.find('.rating-target-heading').text()).toContain('ColorOS17');
    expect(wrapper.findAll('.overall-row .active')).toHaveLength(5);
    expect(wrapper.findAll('.personal-rating-row')[1].findAll('.active')).toHaveLength(5);
    expect(wrapper.text()).toContain('精致');
    expect(wrapper.text()).toContain('具体给好评的理由');
    expect(wrapper.text()).not.toContain('Zeldq的点评');
    expect(wrapper.text()).not.toContain('【点评】摘要');
  });
  it('旧点评保留分段正文，不补造缺失维度', () => {
    const wrapper = mount(OfficialRatingDetailBody, { props: { feed: { id: '42', commentGood: '优点正文', commentGeneral: '总评正文' } }, global: { stubs: { AppImage: true, FeedContent: { props: ['message'], template: '<div>{{ message }}</div>' } } } });
    expect(wrapper.find('.personal-rating-card').exists()).toBe(false);
    expect(wrapper.text()).toContain('优点正文');
    expect(wrapper.text()).toContain('总评正文');
  });
});
