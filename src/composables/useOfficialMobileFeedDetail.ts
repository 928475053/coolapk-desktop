import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth);
let subscribers = 0;
function resize() { viewportWidth.value = window.innerWidth; }

/**
 * 是否处于移动端布局：触摸设备，或窄窗口且未禁用自动切换。
 *
 * 与具体开关解耦 —— `shouldUseOfficialMobileFeedDetail` 是「开关 × 布局」，
 * 本函数只回答「布局」，供需要独立判断的调用方复用。
 */
export function isMobileLayout(width: number, touchMobile: boolean, disableAutoMobileMode: boolean): boolean {
  return touchMobile || (width <= 720 && !disableAutoMobileMode);
}

/** 订阅窗口宽度。多个组合式函数共享同一份监听与引用计数，避免重复注册。 */
function useViewportWidth() {
  onMounted(() => { if (subscribers++ === 0) { resize(); window.addEventListener('resize', resize); } });
  onUnmounted(() => { if (--subscribers === 0) window.removeEventListener('resize', resize); });
  return viewportWidth;
}

export function shouldUseOfficialMobileFeedDetail(enabled: boolean, width: number, touchMobile: boolean, disableAutoMobileMode: boolean): boolean {
  return enabled && isMobileLayout(width, touchMobile, disableAutoMobileMode);
}
export function useOfficialMobileFeedDetail() {
  const settings = useSettingsStore();
  const width = useViewportWidth();
  return computed(() => shouldUseOfficialMobileFeedDetail(settings.settings.officialMobileFeedDetail, width.value, isTouchMobilePlatform(), settings.settings.disableAutoMobileMode));
}

/** 当前是否为移动端布局，与任何开关无关。 */
export function useMobileLayout() {
  const settings = useSettingsStore();
  const width = useViewportWidth();
  return computed(() => isMobileLayout(width.value, isTouchMobilePlatform(), settings.settings.disableAutoMobileMode));
}
