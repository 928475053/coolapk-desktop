import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, KeepAlive } from 'vue';

const mocks = vi.hoisted(() => ({ notifications: vi.fn(), reply: vi.fn(), openFeed: vi.fn(), push: vi.fn(), anchor: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: {
  getNotifications: mocks.notifications, getReplyDetail: mocks.reply, clearNotificationCount: vi.fn(),
} }));
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ isLoggedIn: true }) }));
vi.mock('../../stores/notifications', () => ({ useNotificationStore: () => ({
  categoryCounts: { comment: 0 }, markCategoryViewed: () => 0, applyCategoryCount: vi.fn(),
  beginNotificationClear: vi.fn(), markNotificationsCleared: vi.fn(),
}) }));
vi.mock('../../utils/feedNavigation', () => ({ openFeedDetail: mocks.openFeed }));
vi.mock('../../utils/anchorClick', () => ({ handleAnchorClick: mocks.anchor }));
vi.mock('../../utils/richText', () => ({ renderCoolapkRichText: (text: string) => text }));
import NotificationsPage from '../NotificationsPage.vue';

describe('通知评论点击入口', () => {
  beforeEach(() => vi.clearAllMocks());
  async function mountPage(item: any) {
    mocks.notifications.mockImplementation(async (_tab: string, page: number) => ({ data: page === 1 ? [item] : [] }));
    const wrapper = mount(defineComponent({ components: { NotificationsPage, KeepAlive }, template: '<KeepAlive><NotificationsPage /></KeepAlive>' }), {
      global: { stubs: { AppAvatar: true, AppButton: true, LoadingState: true, ErrorState: true, EmptyState: true } },
    });
    await flushPromises();
    return wrapper;
  }

  it('评论正文携带目标回复，查看原动态单独打开完整动态', async () => {
    const item = { id: '99', target_type: 'feed_reply', target_id: '222',
      note: '评论了你的动态：<a href="/feed/333?rid=222">评论内容</a>' };
    const wrapper = await mountPage(item);
    await wrapper.get('.notify-action a').trigger('click');
    await flushPromises();
    expect(mocks.openFeed).toHaveBeenLastCalledWith(expect.anything(), '333', item, '222');
    await wrapper.get('.original-feed-preview').trigger('click');
    expect(mocks.openFeed).toHaveBeenLastCalledWith(expect.anything(), '333', item);
    wrapper.unmount();
  });

  it('没有动态 ID 的评论通知先查询评论所属动态', async () => {
    const item = { id: '99', target_type: 'feed_reply', target_id: '222', message: '回复内容' };
    mocks.reply.mockResolvedValue({ data: { id: '222', feedId: '333' } });
    const wrapper = await mountPage(item);
    await wrapper.get('.notify-message').trigger('click');
    await flushPromises();
    expect(mocks.reply).toHaveBeenCalledWith('222');
    expect(mocks.openFeed).toHaveBeenCalledWith(expect.anything(), '333', item, '222');
    wrapper.unmount();
  });

  it('评论里的用户链接继续打开用户，不被评论定位覆盖', async () => {
    const wrapper = await mountPage({ id: '99', target_type: 'feed_reply', target_id: '222',
      message: '<a href="/u/555">@用户</a>' });
    await wrapper.get('.notify-message a').trigger('click');
    await flushPromises();
    expect(mocks.openFeed).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith('/user/555');
    wrapper.unmount();
  });
});
