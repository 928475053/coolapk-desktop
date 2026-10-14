import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import SearchTabOrderList from '../SearchTabOrderList.vue';

const tabs = [
  { key: 'product', searchType: 'product', label: '数码' },
  { key: 'feed', searchType: 'feed', label: '动态' },
  { key: 'apk', searchType: 'apk', label: '应用' },
];

function pointer(target: EventTarget, type: string, y: number, options: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 270, clientY: y, pointerType: 'mouse', ...options });
  target.dispatchEvent(event);
}

function mountList() {
  const host = document.createElement('section');
  host.className = 'settings-content'; document.body.append(host);
  const wrapper = mount(SearchTabOrderList, { props: { tabs }, attachTo: host });
  const rect = (top: number, height: number) => ({ x: 0, y: top, left: 0, right: 300, top, bottom: top + height, width: 300, height, toJSON: () => ({}) });
  vi.spyOn(wrapper.get('ol').element, 'getBoundingClientRect').mockImplementation(() => rect(0, 208));
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => rect(0, 208));
  for (const row of wrapper.findAll('[data-search-type]')) {
    vi.spyOn(row.element, 'getBoundingClientRect').mockImplementation(() => rect((wrapper.findAll('[data-search-type]').findIndex(item => item.element === row.element) + 1) * 52, 52));
  }
  return { wrapper, host };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('搜索分类拖动排序', () => {
  it.each(['mouse', 'touch'])('%s 拖动应用到综合后，仅松手保存且综合不可拖动', async pointerType => {
    const { wrapper } = mountList();
    expect(wrapper.get('.search-order-fixed').find('button').exists()).toBe(false);
    const handle = wrapper.get('[aria-label="拖动调整应用顺序"]').element;
    pointer(handle, 'pointerdown', 182, { pointerType });
    pointer(window, 'pointermove', 65, { pointerType });
    await nextTick();
    expect(wrapper.findAll('[data-search-type]').map(row => row.attributes('data-search-type'))).toEqual(['apk', 'product', 'feed']);
    expect(document.querySelector('.search-order-floating')?.textContent).toContain('应用');
    expect(wrapper.emitted('reorder')).toBeUndefined();
    pointer(window, 'pointerup', 65, { pointerType });
    await nextTick();
    expect(wrapper.emitted('reorder')).toEqual([[['apk', 'product', 'feed']]]);
    expect(document.querySelector('.search-order-floating')).toBeNull();
    wrapper.unmount();
  });

  it.each(['pointercancel', 'escape', 'blur', 'outside'])('%s 取消拖动，恢复原顺序且不保存', async action => {
    const { wrapper } = mountList();
    pointer(wrapper.get('[aria-label="拖动调整应用顺序"]').element, 'pointerdown', 182);
    pointer(window, 'pointermove', 65);
    await nextTick();
    if (action === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    else if (action === 'blur') window.dispatchEvent(new Event('blur'));
    else pointer(window, action === 'outside' ? 'pointerup' : 'pointercancel', 65, { clientX: action === 'outside' ? 600 : 270 });
    await nextTick();
    expect(wrapper.findAll('[data-search-type]').map(row => row.attributes('data-search-type'))).toEqual(['product', 'feed', 'apk']);
    expect(wrapper.emitted('reorder')).toBeUndefined();
    expect(document.querySelector('.search-order-floating')).toBeNull();
    wrapper.unmount();
  });

  it('轻触、右键和其他手指不能改变顺序', async () => {
    const { wrapper } = mountList();
    const handle = wrapper.get('[aria-label="拖动调整应用顺序"]').element;
    pointer(handle, 'pointerdown', 182, { button: 2 });
    pointer(window, 'pointermove', 65);
    pointer(window, 'pointerup', 65);
    pointer(handle, 'pointerdown', 182);
    pointer(window, 'pointermove', 65, { pointerId: 2 });
    pointer(window, 'pointerup', 65, { pointerId: 2 });
    pointer(window, 'pointermove', 184);
    pointer(window, 'pointerup', 184);
    await nextTick();
    expect(wrapper.emitted('reorder')).toBeUndefined();
    expect(document.querySelector('.search-order-floating')).toBeNull();
    wrapper.unmount();
  });

  it('拖到上边界仍在综合之后，Alt 方向键也可排序且不能越界', async () => {
    const { wrapper } = mountList();
    pointer(wrapper.get('[aria-label="拖动调整应用顺序"]').element, 'pointerdown', 182);
    pointer(window, 'pointermove', 10);
    pointer(window, 'pointerup', 10);
    expect(wrapper.emitted('reorder')?.[0]).toEqual([['apk', 'product', 'feed']]);
    await wrapper.get('[aria-label="拖动调整数码顺序"]').trigger('keydown', { key: 'ArrowUp', altKey: true });
    expect(wrapper.emitted('reorder')).toHaveLength(1);
    await wrapper.get('[aria-label="拖动调整应用顺序"]').trigger('keydown', { key: 'ArrowUp', altKey: true });
    expect(wrapper.emitted('reorder')?.[1]).toEqual([['product', 'apk', 'feed']]);
    wrapper.unmount();
  });

  it('靠近边缘持续滚动，卸载后停止动画并移除监听', async () => {
    let frame: FrameRequestCallback | undefined;
    const request = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 42; });
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request); vi.stubGlobal('cancelAnimationFrame', cancel);
    const { wrapper, host } = mountList();
    pointer(wrapper.get('[aria-label="拖动调整数码顺序"]').element, 'pointerdown', 78);
    pointer(window, 'pointermove', 200);
    frame?.(0);
    expect(host.scrollTop).toBeGreaterThan(0);
    wrapper.unmount();
    expect(cancel).toHaveBeenCalledWith(42);
    pointer(window, 'pointermove', 65);
    expect(document.querySelector('.search-order-floating')).toBeNull();
  });
});
