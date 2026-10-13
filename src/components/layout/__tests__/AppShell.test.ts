import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, defineComponent, inject, nextTick, onMounted, ref } from 'vue';
import { desktopFeedCommentsOpenKey, openDesktopFeedCommentsKey } from '../../../utils/desktopFeedComments';

const routeState = vi.hoisted(() => ({ controls: false, value: null as any, back: vi.fn(), replace: vi.fn(), history: { back: '/' as string | null } }));
vi.mock('../../../composables/useDesktopWindow', () => ({ useDesktopWindow: () => ({ showWindowControls: computed(() => routeState.value.controls), usesMacOverlay: ref(false) }) }));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  const { reactive } = await import('vue');
  routeState.value = reactive({ path: '/', fullPath: '/' });
  return {
    ...actual,
    useRoute: () => routeState.value,
    useRouter: () => ({ push: vi.fn(), back: routeState.back, replace: routeState.replace, options: { history: { state: routeState.history } } }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));

import AppShell from '../AppShell.vue';
import { useSettingsStore } from '../../../stores/settings';
import { useAppStore } from '../../../stores/app';

const TopBarStub = { template: '<div class="top-bar-stub"><slot name="narrow-navigation" /></div>' };
const MainSidebarStub = { template: '<div class="main-sidebar-stub" />' };
const PageTabBarStub = { template: '<div class="page-tab-bar-stub" />' };
const NetworkStatusBannerStub = { template: '<div class="network-status-banner-stub" />' };
const MobileTopBarStub = { template: '<div class="mobile-top-bar-stub" />' };
const MobileBottomNavStub = { template: '<div class="mobile-bottom-nav-stub" />' };

describe('AppShell', () => {
  it('桌面窄窗口在固定标题栏返回，宽窗口和移动平台不增加入口', async () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true, writable: true });
    Object.assign(routeState.value, { path: '/feed/42', fullPath: '/feed/42', controls: true });
    const wrapper = mount(AppShell, { global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub, PageTabBar: PageTabBarStub, NetworkStatusBanner: NetworkStatusBannerStub, MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } } });
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(wrapper.find('.top-bar-stub .narrow-titlebar-back').exists()).toBe(true);
    wrapper.get('main').element.scrollTop = 3000;
    await wrapper.get('.narrow-titlebar-back').trigger('click');
    expect(routeState.back).toHaveBeenCalledOnce();
    routeState.history.back = null;
    await wrapper.get('.narrow-titlebar-back').trigger('click');
    expect(routeState.replace).toHaveBeenCalledWith('/');
    routeState.value.controls = false;
    await nextTick();
    expect(wrapper.find('.narrow-titlebar-back').exists()).toBe(false);
    routeState.value.controls = true;
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(wrapper.find('.narrow-titlebar-back').exists()).toBe(false);
    wrapper.unmount();
    Object.defineProperty(window, 'innerWidth', { value: previousWidth, configurable: true, writable: true });
  });
  it('普通列表打开右侧评论保留页面实例，关闭侧栏、设置与导航清除侧栏', async () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 1400, configurable: true, writable: true });
    const Page = defineComponent({ setup() {
      const openComments = inject(openDesktopFeedCommentsKey)!;
      const commentsOpen = inject(desktopFeedCommentsOpenKey)!;
      return { openComments, commentsOpen };
    }, template: '<div :data-comments-open="commentsOpen"><button class="open-right-comments" @click="openComments({ id: \'42\', message: \'正文\' })">评论</button></div>' });
    const wrapper = mount(AppShell, { slots: { default: Page }, global: { stubs: {
      TopBar: TopBarStub, MainSidebar: MainSidebarStub, PageTabBar: PageTabBarStub,
      NetworkStatusBanner: NetworkStatusBannerStub, MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub,
      DesktopFeedCommentPanel: { props: ['feed'], template: '<aside class="right-comments-stub">{{ feed.id }}<button @click="$emit(\'close\')">关闭</button></aside>' },
    } } });
    const settings = useSettingsStore();
    settings.settings.desktopFeedDetailOnClick = false;
    settings.settings.desktopCommentsOnRight = true;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    const page = wrapper.get('.open-right-comments').element;
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('false');
    await wrapper.get('.open-right-comments').trigger('click');
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('true');
    expect(wrapper.get('.right-comments-stub').text()).toContain('42');
    expect(wrapper.get('.open-right-comments').element).toBe(page);
    await wrapper.get('.right-comments-stub button').trigger('click');
    expect(wrapper.find('.right-comments-stub').exists()).toBe(false);
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('false');
    await wrapper.get('.open-right-comments').trigger('click');
    settings.settings.desktopCommentsOnRight = false;
    await nextTick();
    expect(wrapper.find('.right-comments-stub').exists()).toBe(false);
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('false');
    settings.settings.desktopCommentsOnRight = true;
    await nextTick();
    await wrapper.get('.open-right-comments').trigger('click');
    Object.assign(routeState.value, { path: '/discover', fullPath: '/discover' });
    await nextTick();
    expect(wrapper.find('.right-comments-stub').exists()).toBe(false);
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('false');
    Object.assign(routeState.value, { path: '/', fullPath: '/' });
    await nextTick();
    await wrapper.get('.open-right-comments').trigger('click');
    Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(wrapper.find('.right-comments-stub').exists()).toBe(false);
    expect(wrapper.get('[data-comments-open]').attributes('data-comments-open')).toBe('false');
    wrapper.unmount();
    Object.defineProperty(window, 'innerWidth', { value: previousWidth, configurable: true, writable: true });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.assign(routeState.value, { path: '/', fullPath: '/', controls: false });
    routeState.history.back = '/';
  });

  it.each([['iPhone', true], ['Macintosh', true], ['Android', false], ['Windows', false]] as const)('%s 内容页返回手势按平台启用，浮层打开时不穿透', async (device, supported) => {
    vi.stubGlobal('navigator', { userAgent: device, platform: device, maxTouchPoints: 5 });
    Object.assign(routeState.value, { path: '/feed/42', fullPath: '/feed/42' });
    const wrapper = mount(AppShell, { global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub,
      PageTabBar: PageTabBarStub, NetworkStatusBanner: NetworkStatusBannerStub,
      MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } } });
    await nextTick();
    const surface = wrapper.get('main').element;
    function swipe() {
      for (const [type, x] of [['touchstart', 10], ['touchmove', 110], ['touchend', 110]] as const) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const point = { clientX: x, clientY: 100, identifier: 0 };
        Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
        surface.dispatchEvent(event);
      }
    }
    swipe();
    if (!supported) {
      expect(routeState.back).not.toHaveBeenCalled();
      expect(routeState.replace).not.toHaveBeenCalled();
      wrapper.unmount();
      return;
    }
    expect(routeState.back).toHaveBeenCalledOnce();
    useAppStore().openSearch();
    swipe();
    expect(routeState.back).toHaveBeenCalledOnce();
    useAppStore().closeSearch();
    const dialog = document.createElement('div');
    dialog.className = 'dialog-wrapper';
    document.body.appendChild(dialog);
    swipe();
    expect(routeState.back).toHaveBeenCalledOnce();
    dialog.remove();
    routeState.history.back = null;
    swipe();
    expect(routeState.replace).toHaveBeenCalledWith('/');
    Object.assign(routeState.value, { path: '/', fullPath: '/' });
    swipe();
    expect(routeState.back).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it.each(['/digital', '/discover', '/me', '/messages', '/feed/123', '/settings/appearance', '/favorites', '/user/123', '/search'])('%s 切换布局保留路由内容实例、输入和滚动状态', async path => {
    Object.assign(routeState.value, { path, fullPath: path });
    const load = vi.fn();
    const Page = defineComponent({ setup() { onMounted(load); }, template: '<div class="page-state"><input value="未发送的内容" /></div>' });
    const wrapper = mount(AppShell, {
      slots: { default: Page },
      global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub, PageTabBar: PageTabBarStub,
        NetworkStatusBanner: NetworkStatusBannerStub, MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } },
    });
    const original = wrapper.find('.page-state').element;
    original.scrollTop = 320;
    const settings = useSettingsStore();
    for (const disabled of [true, false, true, false]) {
      settings.settings.disableAutoMobileMode = disabled;
      window.dispatchEvent(new Event('resize'));
      await nextTick();
      expect(wrapper.find('.page-state').element).toBe(original);
      expect(original.scrollTop).toBe(320);
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('未发送的内容');
      expect(load).toHaveBeenCalledTimes(1);
    }
    wrapper.unmount();
  });

  it('四个主栏目显示底栏，子页面隐藏，返回主栏目恢复', async () => {
    const wrapper = mount(AppShell, {
      global: { stubs: { TopBar: TopBarStub, MainSidebar: MainSidebarStub,
        PageTabBar: PageTabBarStub, NetworkStatusBanner: NetworkStatusBannerStub,
        MobileTopBar: MobileTopBarStub, MobileBottomNav: MobileBottomNavStub } },
    });
    for (const path of ['/digital', '/discover', '/me', '/', '/messages', '/messages?uid=123',
      '/feed/123', '/settings/appearance', '/my-plugins', '/my-plugins/store', '/favorites', '/user/123', '/search']) {
      Object.assign(routeState.value, { path: path.split('?')[0], fullPath: path });
      await nextTick();
      const visible = ['/', '/digital', '/discover', '/me'].includes(path);
      expect(wrapper.findComponent(MobileBottomNavStub).exists(), path).toBe(visible);
      expect(wrapper.classes().includes('has-mobile-bottom-nav'), path).toBe(visible);
    }
    Object.assign(routeState.value, { path: '/me', fullPath: '/me' });
    await nextTick();
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(true);
    wrapper.unmount();
  });

  it('默认状态下渲染移动端顶栏和底栏，且不包含 prevent-mobile-layout 类名', () => {
    const wrapper = mount(AppShell, {
      global: {
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).not.toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(true);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(true);
  });

  it('开启 disableAutoMobileMode 时隐藏移动端顶栏和底栏，且添加 prevent-mobile-layout 类名', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settingsStore = useSettingsStore(pinia);
    settingsStore.settings.disableAutoMobileMode = true;

    const wrapper = mount(AppShell, {
      global: {
        plugins: [pinia],
        stubs: {
          TopBar: TopBarStub,
          MainSidebar: MainSidebarStub,
          PageTabBar: PageTabBarStub,
          NetworkStatusBanner: NetworkStatusBannerStub,
          MobileTopBar: MobileTopBarStub,
          MobileBottomNav: MobileBottomNavStub,
        },
      },
    });

    expect(wrapper.classes()).toContain('prevent-mobile-layout');
    expect(wrapper.findComponent(MobileTopBarStub).exists()).toBe(false);
    expect(wrapper.findComponent(MobileBottomNavStub).exists()).toBe(false);
  });
});
