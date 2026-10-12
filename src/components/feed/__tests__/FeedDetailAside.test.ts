import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({ getFeedReplies: vi.fn(), getFeedLikeList: vi.fn(), getFeedForwardList: vi.fn() }));
vi.mock('../../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFeedReplies: mocks.getFeedReplies,
    getFeedLikeList: mocks.getFeedLikeList,
    getFeedForwardList: mocks.getFeedForwardList,
  },
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// 导入链会经 FeedCommentSection → anchorClick 拉到真实的 src/router/index.ts，
// 它需要 vue-router 的 createRouter —— 只 mock 'vue-router' 不够，这里一并拦掉。
vi.mock('../../../router', () => ({
  router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) },
}));

import FeedDetailAside from '../FeedDetailAside.vue';

describe('分栏详情页右栏', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeedReplies.mockResolvedValue({ data: [] });
    mocks.getFeedLikeList.mockResolvedValue({ data: [] });
    mocks.getFeedForwardList.mockResolvedValue({ data: [] });
    setActivePinia(createPinia());
  });

  const mountAside = (activeTab: 'replies' | 'likes' | 'forwards' = 'replies') =>
    mount(FeedDetailAside, {
      props: { feed: { id: '42', uid: '456', username: '作者', message: '正文' }, activeTab },
      global: { stubs: { FeedCommentSection: { template: '<div class="comment-section-stub" />' }, FeedInteractionListDialog: { template: '<div class="interaction-stub" />' } } },
    });

  it('渲染三个 tab，当前 tab 高亮', async () => {
    const wrapper = mountAside('replies');
    await flushPromises();
    const tabs = wrapper.findAll('.aside-tab');
    expect(tabs.map((t) => t.text())).toEqual(['回复', '点赞', '转发']);
    expect(tabs[0].classes()).toContain('is-active');
    wrapper.unmount();
  });

  it('点击 tab 抛出 update:activeTab', async () => {
    const wrapper = mountAside('replies');
    await flushPromises();
    await wrapper.findAll('.aside-tab')[2].trigger('click');
    expect(wrapper.emitted('update:activeTab')?.[0]).toEqual(['forwards']);
    wrapper.unmount();
  });

  it('activeTab 为 replies 时渲染评论组件，为 likes 时渲染互动列表', async () => {
    const replies = mountAside('replies');
    await flushPromises();
    expect(replies.find('.comment-section-stub').exists()).toBe(true);
    replies.unmount();

    const likes = mountAside('likes');
    await flushPromises();
    expect(likes.find('.interaction-stub').exists()).toBe(true);
    likes.unmount();
  });

  it('只看楼主走服务端过滤：打开后以 fromFeedAuthor=1 重取第一页', async () => {
    const wrapper = mountAside();
    await flushPromises();
    const toggle = wrapper.find('.only-author-toggle input');
    expect((toggle.element as HTMLInputElement).checked).toBe(false);

    // 初始是「全部」：fromFeedAuthor 为 0
    expect(mocks.getFeedReplies).toHaveBeenLastCalledWith(
      '42', 1, expect.objectContaining({ fromFeedAuthor: 0 }),
    );

    await toggle.setValue(true);
    await flushPromises();
    expect((toggle.element as HTMLInputElement).checked).toBe(true);

    // 打开后交给服务端过滤：fromFeedAuthor 为 1、listType 清空，且重新从第一页取。
    // 若有人把它改成客户端 filter，这条必须失败。
    expect(mocks.getFeedReplies).toHaveBeenLastCalledWith(
      '42', 1, expect.objectContaining({ fromFeedAuthor: 1, listType: '' }),
    );
    wrapper.unmount();
  });

  it('切换排序走服务端：以对应 listType 重取第一页', async () => {
    const wrapper = mountAside();
    await flushPromises();

    await wrapper.find('.aside-sort-select').setValue('likes');
    await flushPromises();
    expect(mocks.getFeedReplies).toHaveBeenLastCalledWith(
      '42', 1, expect.objectContaining({ listType: 'popular', fromFeedAuthor: 0 }),
    );
    wrapper.unmount();
  });
});
