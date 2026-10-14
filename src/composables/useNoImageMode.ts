import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue';
import { useSettingsStore } from '../stores/settings';

export const detailImageScopeKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('detail-image-scope');

/** 仅放行详情子树的图片，不能临时关闭全局无图模式而让后台首页开始加载图片。 */
export function useNoImageMode(scope?: Readonly<Ref<boolean>>) {
  const settings = useSettingsStore();
  const detail = scope ?? inject(detailImageScopeKey, ref(false));
  return computed(() => settings.settings.noImageMode && !(settings.settings.showImagesInDetail && detail.value));
}

/** 标记详情与其大图浮层，供图片加载逻辑和全局隐藏样式共同使用。 */
export function provideDetailImageScope(scope: Readonly<Ref<boolean>> = ref(true)) {
  provide(detailImageScopeKey, scope);
  const settings = useSettingsStore();
  return computed(() => settings.settings.noImageMode && settings.settings.showImagesInDetail && scope.value);
}
