import type { InjectionKey, Ref } from 'vue';
import type { FeedItem } from '../types/feed';

/** 返回是否已由桌面侧栏接管；不可分栏时交回卡片展开内联评论。 */
export const openDesktopFeedCommentsKey: InjectionKey<(feed: FeedItem) => boolean> = Symbol('openDesktopFeedComments');

/** 列表右侧评论展开时，推荐栏暂时让出空间；不改变用户的推荐栏设置。 */
export const desktopFeedCommentsOpenKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('desktopFeedCommentsOpen');
