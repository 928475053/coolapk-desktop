import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeedActionBar from '../FeedActionBar.vue';
import { ref } from 'vue';
import { mobileDetailActionsHiddenKey } from '../../../composables/useMobileReadingNavigation';

describe('动态互动入口', () => {
  it('详情操作栏随阅读状态收起并禁用交互，普通列表操作栏保持显示', async () => {
    setActivePinia(createPinia());
    const hidden = ref(false);
    const wrapper = mount(FeedActionBar, { props: { feedId: '42', officialDetail: true }, global: { provide: { [mobileDetailActionsHiddenKey as symbol]: hidden } } });
    try {
      hidden.value = true; await wrapper.vm.$nextTick();
      expect(wrapper.classes()).toContain('reading-hidden');
      expect(wrapper.attributes('inert')).toBeDefined();
      expect(wrapper.attributes('aria-hidden')).toBe('true');
      hidden.value = false; await wrapper.vm.$nextTick();
      expect(wrapper.classes()).not.toContain('reading-hidden');
      await wrapper.setProps({ officialDetail: false });
      hidden.value = true; await wrapper.vm.$nextTick();
      expect(wrapper.classes()).not.toContain('reading-hidden');
      expect(wrapper.attributes('inert')).toBeUndefined();
    } finally { wrapper.unmount(); }
  });
  it('在点赞和转发按钮中展示对应数量', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, {
      props: { feedId: '42', likenum: 12, sharenum: 3 },
    });

    expect(wrapper.find('.like-btn span').text()).toBe('12');
    expect(wrapper.find('.share-btn span').text()).toBe('3');
    expect(wrapper.find('[title="查看点赞用户"]').exists()).toBe(false);
    expect(wrapper.find('[title="查看转发列表"]').exists()).toBe(false);
  });

  it('没有互动数量时不显示列表入口', () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, { props: { feedId: '42' } });

    expect(wrapper.find('.like-btn span').text()).toBe('');
    expect(wrapper.find('.share-btn span').text()).toBe('');
    expect(wrapper.find('.comment-btn').text()).toBe('');
    expect(wrapper.find('.fav-btn').text()).toBe('');
  });
  it('官方底栏提供写评论、评论数和独立操作，切换回原样式恢复计数', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, { props: { feedId: '42', officialDetail: true, replynum: 3, likenum: 12, favnum: 5, sharenum: 21 } });
    expect(wrapper.find('.comment-btn').text()).toBe('3');
    expect(wrapper.find('.like-btn').text()).toBe('12');
    expect(wrapper.find('.fav-btn').text()).toBe('5');
    expect(wrapper.find('.share-btn').text()).toBe('21');
    await wrapper.find('.official-write-comment').trigger('click');
    expect(wrapper.emitted('write-comment')).toHaveLength(1);
    await wrapper.setProps({ officialDetail: false });
    expect(wrapper.find('.official-write-comment').exists()).toBe(false);
    expect(wrapper.find('.like-btn').text()).toBe('12');
  });

  it('官方底栏同步异步返回的数量，零数量保留操作文案', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(FeedActionBar, { props: { feedId: '42', officialDetail: true } });
    expect(wrapper.find('.like-btn').text()).toBe('点赞');
    expect(wrapper.find('.fav-btn').text()).toBe('收藏');
    expect(wrapper.find('.share-btn').text()).toBe('转发');
    await wrapper.setProps({ replynum: 656, likenum: 325, favnum: 75, sharenum: 21, favorited: true, userAction: { like: 1, collect: 1 } });
    expect(wrapper.find('.comment-btn').text()).toBe('656');
    expect(wrapper.find('.like-btn').text()).toBe('325');
    expect(wrapper.find('.fav-btn').text()).toBe('75');
    expect(wrapper.find('.share-btn').text()).toBe('21');
    expect(wrapper.find('.like-btn').classes()).toContain('is-liked');
    expect(wrapper.find('.fav-btn').classes()).toContain('is-fav');
    wrapper.unmount();
  });

});
