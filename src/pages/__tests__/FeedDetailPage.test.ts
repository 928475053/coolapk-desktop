import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({ detail: vi.fn(), context: vi.fn(), save: vi.fn(), back: vi.fn(), replace: vi.fn(), history: { back: '/' as string | null }, mobile: { value: true } as { value: boolean } }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { getFeedDetail: mocks.detail } }));
vi.mock('../../stores/app', () => ({ useAppStore: () => ({ getFeedDetailContext: mocks.context, setFeedDetailContext: mocks.save }) }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { feedId: '42' }, query: { replyId: '123' } }), useRouter: () => ({ back: mocks.back, replace: mocks.replace, options: { history: { state: mocks.history } } }) }));
vi.mock('../../router', () => ({ router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [] })) } }));
vi.mock('../../composables/usePageTabTitle', () => ({ usePageTabTitle: () => {} }));
vi.mock('../../composables/useOfficialMobileFeedDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../composables/useOfficialMobileFeedDetail')>();
  // 窗口宽度判定（useWideSplitLayout）走真实实现，测试里靠 innerWidth 驱动；
  // 官方移动详情则由 mocks.mobile 控制：既有用例默认 true（返回按钮等），
  // 分栏用例把它关掉 —— 分栏只在非官方移动详情下生效。
  return { ...actual, useOfficialMobileFeedDetail: () => ref(mocks.mobile.value) };
});
import FeedDetailPage from '../FeedDetailPage.vue';
import { useSettingsStore } from '../../stores/settings';

describe('官方详情评论加载', () => {
  it('加载中和失败时仍可返回，直接打开时退回首页', async () => {
    let fail!: (error: Error) => void;
    mocks.context.mockReturnValue(null);
    mocks.detail.mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    mocks.history.back = '/';
    mocks.back.mockClear();
    mocks.replace.mockClear();
    const wrapper = mount(FeedDetailPage, { props: { feedId: '42' }, global: { stubs: { FeedCard: true, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true } } });
    await wrapper.get('[aria-label="返回"]').trigger('click');
    expect(mocks.back).toHaveBeenCalledOnce();
    fail(new Error('offline'));
    await flushPromises();
    mocks.history.back = null;
    await wrapper.get('[aria-label="返回"]').trigger('click');
    expect(mocks.replace).toHaveBeenCalledWith('/');
    wrapper.unmount();
  });
  it('有完整列表上下文时，详情请求未完成也立即开启评论', async () => {
    let finish!: (value: unknown) => void;
    mocks.detail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mocks.context.mockReturnValue({ id: '42', uid: '1', username: '作者', message: '正文', replynum: 40 });
    const wrapper = mount(FeedDetailPage, {
      props: { feedId: '42' },
      global: { stubs: { FeedCard: { props: ['autoOpenComments'], template: '<div class="comments" :data-open="autoOpenComments" />' }, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true } },
    });
    expect(mocks.detail).toHaveBeenCalledWith('42');
    expect(wrapper.find('.comments').attributes('data-open')).toBe('true');
    finish({ data: { id: '42', uid: '1', username: '作者', message: '完整正文' } });
    await flushPromises();
    expect(wrapper.find('.comments').attributes('data-open')).toBe('true');
    wrapper.unmount();
  });
  it('仅有通知摘要时不提前挂载动态或请求评论', async () => {
    let finish!: (value: unknown) => void;
    mocks.detail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mocks.context.mockReturnValue({ id: '42', title: '通知摘要' });
    const wrapper = mount(FeedDetailPage, { props: { feedId: '42' }, global: { stubs: { FeedCard: true, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true } } });
    expect(wrapper.find('feed-card-stub').exists()).toBe(false);
    finish({ data: { id: '42', uid: '1', username: '作者', message: '完整正文' } });
    await flushPromises();
    expect(wrapper.find('feed-card-stub').attributes('autoopencomments')).toBe('true');
    expect(wrapper.find('feed-card-stub').attributes('targetreplyid')).toBe('123');
    wrapper.unmount();
  });
});

describe('详情页在桌面布局下按开关切换分栏', () => {
  const stubs = { FeedCard: { template: '<div class="card-stub" />' }, FeedDetailSplitLayout: { template: '<div class="split-stub" />' }, QuestionAnswerCard: true, LoadingState: true, ErrorState: true, EmptyState: true };

  const mountPage = async (desktopFeedDetailOnClick: boolean) => {
    useSettingsStore().settings.desktopFeedDetailOnClick = desktopFeedDetailOnClick;
    const wrapper = mount(FeedDetailPage, { props: { feedId: '42' }, global: { stubs } });
    await flushPromises();
    return wrapper;
  };

  beforeEach(() => {
    // jsdom 默认 1024：>= 1000，属桌面分栏区间
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
    // 分栏只在非官方移动详情下生效，把文件层 mock 的官方移动详情关掉。
    mocks.mobile.value = false;
    mocks.context.mockReturnValue(null);
    mocks.detail.mockResolvedValue({ data: { id: '42', uid: '456', username: '作者', message: '正文' } });
  });

  it('开关关时渲染单栏（现状）', async () => {
    const wrapper = await mountPage(false);
    expect(wrapper.find('.split-stub').exists()).toBe(false);
    wrapper.unmount();
  });

  it('开关开且窗口 >= 1000px 时渲染分栏', async () => {
    const wrapper = await mountPage(true);
    expect(wrapper.find('.split-stub').exists()).toBe(true);
    expect(wrapper.classes()).toContain('is-split');
    wrapper.unmount();
  });

  it('开关开 + 宽窗口 + 回答详情时根元素不含 is-split（否则页面 overflow:hidden 不可滚动）', async () => {
    // 从回答卡片点进详情：渲染的是 QuestionAnswerCard，不是分栏；
    // is-split 若挂上会把页面锁死成 overflow:hidden，回答卡又没有内部滚动容器，正文会被裁掉。
    mocks.detail.mockResolvedValue({ data: { id: '42', uid: '456', username: '作者', message: '回答正文', feedType: 'answer' } });
    const wrapper = await mountPage(true);
    await flushPromises();
    expect(wrapper.find('.split-stub').exists()).toBe(false);
    expect(wrapper.find('question-answer-card-stub').exists()).toBe(true);
    expect(wrapper.classes()).not.toContain('is-split');
    wrapper.unmount();
  });

  it('触摸设备即使窗口 >= 1000px 也不进分栏（判据必须是布局，不是那个设置开关）', async () => {
    // 关键场景：平板上用户把「官方样式动态详情」关掉了。
    // 旧判据用 !officialMobileDetail —— 它 = 设置 && 布局，设置一旦关掉就恒为 false，
    // 于是触摸设备会误入分栏。现在判据是 !mobileLayout（纯布局判据），与点击侧一致。
    const originalUa = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36',
      configurable: true,
    });

    const wrapper = await mountPage(true);
    expect(wrapper.find('.split-stub').exists()).toBe(false);
    expect(wrapper.classes()).not.toContain('is-split');
    wrapper.unmount();

    if (originalUa) Object.defineProperty(navigator, 'userAgent', originalUa);
  });

  it('开关开但窗口 < 1000px 时回退单栏', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true, writable: true });
    const wrapper = await mountPage(true);
    // viewportWidth 是模块级共享状态：若更早的用例留下了未卸载的订阅者，
    // 本次 mount 不会重新读 innerWidth。补派发一次 resize 覆盖这条路径
    // （无订阅者时是空操作，有订阅者时刷新为当前宽度）。
    window.dispatchEvent(new Event('resize'));
    await flushPromises();
    expect(wrapper.find('.split-stub').exists()).toBe(false);
    wrapper.unmount();
  });
});
