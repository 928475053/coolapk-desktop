import type { InjectionKey } from 'vue';
import type { FeedItem } from '../types/feed';

/** 返回是否已由桌面侧栏接管；不可分栏时交回卡片展开内联评论。 */
export const openDesktopFeedCommentsKey: InjectionKey<(feed: FeedItem) => boolean> = Symbol('openDesktopFeedComments');
