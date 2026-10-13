import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { getFeedReplies: vi.fn().mockResolvedValue({ data: [] }) } }));
// 导入链会经 FeedCard → FeedCommentSection → anchorClick 拉到真实的 src/router/index.ts，
// 它需要 vue-router 的 createRouter —— 只 mock 'vue-router' 不够，这里一并拦掉。
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../router', () => ({
  router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) },
}));

import FeedDetailSplitLayout from '../FeedDetailSplitLayout.vue';

describe('分栏详情页容器', () => {
  it('左栏是动态卡片，右栏是评论区', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedDetailSplitLayout, {
      props: { feed: { id: '42', uid: '456', username: '作者', message: '正文' } },
      global: { stubs: { FeedCard: { template: '<div class="feed-card-stub" />' }, FeedDetailAside: { template: '<div class="aside-stub" />' } } },
    });
    expect(wrapper.find('.feed-detail-split-left .feed-card-stub').exists()).toBe(true);
    expect(wrapper.find('.feed-detail-split-right .aside-stub').exists()).toBe(true);
    wrapper.unmount();
  });

  it.each([
    ['open-comment', 'replies'],
    ['open-like-list', 'likes'],
    ['open-forward-list', 'forwards'],
  ])('把左栏事件 %s 转成右栏 tab %s', async (event, tab) => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedDetailSplitLayout, {
      props: { feed: { id: '42', uid: '456', username: '作者', message: '正文' } },
      global: { stubs: { FeedCard: true, FeedDetailAside: true } },
    });
    const left = wrapper.findComponent({ name: 'FeedCard' });
    await left.vm.$emit(event);
    expect(wrapper.findComponent({ name: 'FeedDetailAside' }).props('activeTab')).toBe(tab);
    wrapper.unmount();
  });
});
