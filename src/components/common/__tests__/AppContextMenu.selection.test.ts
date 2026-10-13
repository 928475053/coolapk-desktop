import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppContextMenu from '../AppContextMenu.vue';

const mocks = vi.hoisted(() => ({ mobile: true, writeText: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: {} }));
vi.mock('../../../utils/platform', async original => ({ ...await original<typeof import('../../../utils/platform')>(), isTouchMobilePlatform: () => mocks.mobile }));
vi.mock('vue-router', () => ({ useRoute: () => ({ fullPath: '/' }), useRouter: () => ({ push: vi.fn() }) }));
let text = '第一段文字';
let rect = { left: 24, top: 300, bottom: 380 };

beforeEach(() => {
  vi.useFakeTimers();
  mocks.mobile = true;
  mocks.writeText.mockClear();
  text = '第一段文字';
  rect = { left: 24, top: 300, bottom: 380 };
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.writeText } });
  vi.spyOn(window, 'getSelection').mockImplementation(() => ({ toString: () => text, rangeCount: 1, getRangeAt: () => ({ getBoundingClientRect: () => rect }) }) as unknown as Selection);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function renderMenu() {
  const wrapper = mount(AppContextMenu, { attachTo: document.body });
  const body = document.createElement('p');
  body.textContent = '第一段文字，第二段文字';
  document.body.appendChild(body);
  body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 330 }));
  await wrapper.vm.$nextTick();
  return { wrapper, body, dispose: () => { wrapper.unmount(); body.remove(); } };
}

it('手机版操作栏优先放在选区上方，上方不足时放在选区下方', async () => {
  const view = await renderMenu();
  try {
    const menu = document.querySelector<HTMLElement>('.app-context-menu')!;
    expect(menu.classList.contains('is-mobile-selection')).toBe(true);
    expect(Number.parseFloat(menu.style.top) + 50).toBeLessThan(rect.top);
    rect = { left: 24, top: 20, bottom: 100 };
    document.dispatchEvent(new Event('selectionchange'));
    await vi.advanceTimersByTimeAsync(150);
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThan(rect.bottom);
    expect(Number.parseFloat(menu.style.left) + Number.parseFloat(menu.style.width)).toBeLessThanOrEqual(382);
  } finally { view.dispose(); }
});

it('拖动手柄时隐藏菜单，松手后跟随新选区且复制最新文本', async () => {
  const view = await renderMenu();
  try {
    const menu = document.querySelector<HTMLElement>('.app-context-menu')!;
    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: [{ clientX: 24, clientY: 380 }] });
    view.body.dispatchEvent(start);
    await view.wrapper.vm.$nextTick();
    expect(menu.style.display).toBe('none');
    expect(start.defaultPrevented).toBe(false);
    text = '第二段文字';
    rect = { left: 24, top: 500, bottom: 550 };
    document.dispatchEvent(new Event('selectionchange'));
    view.body.dispatchEvent(new Event('scroll', { bubbles: false }));
    await vi.advanceTimersByTimeAsync(500);
    expect(menu.style.display).toBe('none');
    view.body.dispatchEvent(new Event('touchend', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(150);
    expect(menu.style.display).not.toBe('none');
    expect(Number.parseFloat(menu.style.top) + 50).toBeLessThan(500);
    menu.dispatchEvent(new Event('scroll'));
    await view.wrapper.vm.$nextTick();
    expect(document.querySelector('.app-context-menu')).not.toBeNull();
    menu.querySelector<HTMLButtonElement>('button')!.click();
    await flushPromises();
    expect(mocks.writeText).toHaveBeenCalledWith('第二段文字');
  } finally { view.dispose(); }
});

it('取消选区后关闭菜单，桌面右键仍按鼠标位置显示', async () => {
  const view = await renderMenu();
  try {
    text = '';
    document.dispatchEvent(new Event('selectionchange'));
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.app-context-menu')).toBeNull();
  } finally { view.dispose(); }
  mocks.mobile = false;
  text = '桌面选区';
  const desktop = await renderMenu();
  try {
    const menu = document.querySelector<HTMLElement>('.app-context-menu')!;
    expect(menu.classList.contains('is-mobile-selection')).toBe(false);
    expect(menu.style.top).toBe('330px');
  } finally { desktop.dispose(); }
});
