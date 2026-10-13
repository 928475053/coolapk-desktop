import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import DesktopFeedCommentPanel from '../DesktopFeedCommentPanel.vue';

const resize = vi.hoisted(() => ({ notify: () => {}, disconnect: vi.fn() }));
vi.mock('../../../utils/observeResizeOnFrame', () => ({ observeResizeOnFrame: (_element: Element, callback: () => void) => {
  resize.notify = callback;
  return resize.disconnect;
} }));

describe('桌面列表评论栏宽度', () => {
  let containerWidth = 1500;
  beforeEach(() => {
    localStorage.clear(); containerWidth = 1500; resize.disconnect.mockClear();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => containerWidth);
  });
  afterEach(() => vi.restoreAllMocks());
  function render() {
    return mount(DesktopFeedCommentPanel, { attachTo: document.body, props: { feed: { id: '42' } as any },
      global: { stubs: { TopicFeedCommentAside: true } } });
  }
  it('默认占内容区四成并限制最大宽度，窗口缩小时为信息流保留空间', async () => {
    const w = render(); await nextTick();
    const handle = w.get('[role="separator"]');
    expect(handle.attributes('aria-valuenow')).toBe('600');
    containerWidth = 2000; resize.notify(); await nextTick();
    expect(handle.attributes('aria-valuenow')).toBe('640');
    containerWidth = 720; resize.notify(); await nextTick();
    expect(handle.attributes('aria-valuenow')).toBe('300');
    expect(handle.attributes('aria-valuemax')).toBe('300');
    w.unmount(); expect(resize.disconnect).toHaveBeenCalledOnce();
  });
  it('保留已有调节宽度，窄窗口不改写记忆，双击后恢复自适应默认', async () => {
    localStorage.setItem('coolapk_list_comment_width', '620');
    const w = render(); await nextTick();
    const handle = w.get('[role="separator"]');
    expect(handle.attributes('aria-valuenow')).toBe('620');
    containerWidth = 800; resize.notify(); await nextTick();
    expect(handle.attributes('aria-valuenow')).toBe('380');
    expect(localStorage.getItem('coolapk_list_comment_width')).toBe('620');
    containerWidth = 1500; resize.notify(); await nextTick();
    expect(handle.attributes('aria-valuenow')).toBe('620');
    await handle.trigger('dblclick');
    expect(handle.attributes('aria-valuenow')).toBe('600');
    expect(localStorage.getItem('coolapk_list_comment_width')).toBeNull();
    containerWidth = 1200; resize.notify(); await nextTick();
    expect(handle.attributes('aria-valuenow')).toBe('480');
    w.unmount();
  });
  it('应用使用 transform 缩放时保持逻辑宽度比例，避免评论栏重复放大', async () => {
    containerWidth = 1000;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1500 } as DOMRect);
    const w = render(); await nextTick();
    expect(w.get('[role="separator"]').attributes('aria-valuenow')).toBe('400');
    w.unmount();
  });
});
