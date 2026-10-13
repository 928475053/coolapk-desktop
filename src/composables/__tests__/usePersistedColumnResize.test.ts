import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { usePersistedColumnResize } from '../usePersistedColumnResize';

describe('共用分栏宽度调节与记忆', () => {
  beforeEach(() => { localStorage.clear(); document.body.style.cursor = ''; document.body.style.userSelect = ''; });
  function setup(direction: 1 | -1 = 1) {
    let controls!: ReturnType<typeof usePersistedColumnResize>;
    const wrapper = mount(defineComponent({ setup() {
      controls = usePersistedColumnResize({ storageKey: 'test-column-width', defaultWidth: () => 450, limits: () => ({ min: 280, max: 640 }), direction });
      return () => h('div');
    } }));
    return { wrapper, controls };
  }
  function pointer(type: string, clientX: number, pointerId = 1) {
    const event = new Event(type);
    Object.assign(event, { clientX, pointerId, button: 0 });
    return event as PointerEvent;
  }
  it.each([1, -1] as const)('方向 %s 的拖动保存宽度，重新挂载后恢复', direction => {
    const { wrapper, controls } = setup(direction);
    controls.startResize(pointer('pointerdown', 500));
    window.dispatchEvent(pointer('pointermove', 550));
    window.dispatchEvent(pointer('pointerup', 550));
    expect(controls.visibleWidth.value).toBe(450 + 50 * direction);
    expect(localStorage.getItem('test-column-width')).toBe(String(450 + 50 * direction));
    wrapper.unmount();
    const restored = setup(direction);
    expect(restored.controls.visibleWidth.value).toBe(450 + 50 * direction);
    restored.wrapper.unmount();
  });
  it('限制拖动范围，忽略其他指针，卸载时保存并恢复全局样式', () => {
    document.body.style.cursor = 'crosshair';
    const { wrapper, controls } = setup();
    controls.startResize(pointer('pointerdown', 500));
    window.dispatchEvent(pointer('pointermove', 0, 2));
    expect(controls.visibleWidth.value).toBe(450);
    window.dispatchEvent(pointer('pointermove', 2000));
    expect(controls.visibleWidth.value).toBe(640);
    wrapper.unmount();
    expect(localStorage.getItem('test-column-width')).toBe('640');
    expect(document.body.style.cursor).toBe('crosshair');
    window.dispatchEvent(pointer('pointermove', 0));
    expect(controls.visibleWidth.value).toBe(640);
  });
  it('键盘调节和复位同样保存位置，异常保存值回退默认', () => {
    localStorage.setItem('test-column-width', 'NaN');
    const { wrapper, controls } = setup();
    expect(controls.visibleWidth.value).toBe(450);
    controls.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(localStorage.getItem('test-column-width')).toBe('460');
    controls.resetWidth();
    expect(localStorage.getItem('test-column-width')).toBe('450');
    wrapper.unmount();
  });
  it('自适应默认宽度随容器更新，手动调节后保持记忆，复位后恢复比例', () => {
    const available = ref(1200);
    let controls!: ReturnType<typeof usePersistedColumnResize>;
    const wrapper = mount(defineComponent({ setup() {
      controls = usePersistedColumnResize({ storageKey: 'responsive-width', defaultWidth: () => available.value * .4,
        limits: () => ({ min: 280, max: Math.min(640, available.value - 420) }), direction: -1, responsiveDefault: true });
      return () => h('div');
    } }));
    expect(controls.visibleWidth.value).toBe(480);
    available.value = 1500;
    expect(controls.visibleWidth.value).toBe(600);
    controls.resizeWithKeyboard(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(localStorage.getItem('responsive-width')).toBe('610');
    available.value = 800;
    expect(controls.visibleWidth.value).toBe(380);
    expect(localStorage.getItem('responsive-width')).toBe('610');
    available.value = 1500;
    expect(controls.visibleWidth.value).toBe(610);
    controls.resetWidth();
    expect(localStorage.getItem('responsive-width')).toBeNull();
    expect(controls.visibleWidth.value).toBe(600);
    available.value = 1200;
    expect(controls.visibleWidth.value).toBe(480);
    wrapper.unmount();
  });
});
