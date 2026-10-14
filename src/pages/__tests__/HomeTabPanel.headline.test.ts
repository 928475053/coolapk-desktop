import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it, vi } from 'vitest';
import HomeTabPanel from '../HomeTabPanel.vue';
import { useSettingsStore } from '../../stores/settings';

const api = vi.hoisted(() => ({ getIndexV8EntitiesPaged: vi.fn(), getHotSearchKeywords: vi.fn().mockResolvedValue([]) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));

it.each([390, 1280])('宽度 %s 下头条刷新保留首条锚点，分页只传末条游标', async (width) => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  const feed = (id: string) => ({ id, entityId: id, entityType: 'feed', message: `动态 ${id}`, uid: '123', username: '酷友' });
  api.getIndexV8EntitiesPaged.mockReset();
  api.getIndexV8EntitiesPaged.mockResolvedValueOnce({ data: [feed('100'), feed('90')] })
    .mockResolvedValueOnce({ data: [feed('80'), feed('70')] })
    .mockResolvedValueOnce({ data: [feed('110'), feed('105')] })
    .mockResolvedValueOnce({ data: [feed('120'), feed('115')] })
    .mockRejectedValueOnce(new Error('网络暂时不可用'))
    .mockResolvedValueOnce({ data: [feed('130'), feed('125')] });
  const tab = { title: '头条', page_name: 'V9_HOME_TAB_HEADLINE', url: '/main/headline' };
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  const wrapper = mount(HomeTabPanel, { props: { embedded: true, selected: true, tabKey: tab.page_name, tabs: [tab] }, global: { plugins: [router, createPinia()], stubs: { FeedCard: true, FeedVideoCard: true, AppImage: true } } });
  try {
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 1, firstItem: '', lastItem: '' });
    await wrapper.get('.feed-scroll-container').trigger('scroll');
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 2, firstItem: '', lastItem: '90' });
    // 翻页后刷新仍然使用列表首条，不能使用刚加载的旧动态。
    window.dispatchEvent(new Event('refresh-feeds'));
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 1, firstItem: '100', lastItem: '' });
    window.dispatchEvent(new Event('refresh-feeds'));
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 1, firstItem: '110', lastItem: '' });
    // 刷新失败后重试仍保留锚点，不能退回首次加载的请求。
    window.dispatchEvent(new Event('refresh-feeds'));
    await flushPromises();
    window.dispatchEvent(new Event('refresh-feeds'));
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 1, firstItem: '120', lastItem: '' });
  } finally { wrapper.unmount(); vi.restoreAllMocks(); }
});

it.each(['scroll', 'load'])('双列通过 %s 提前按短列加载，不等待较长列滚到底', async (eventType) => {
  const feed = (id: number) => ({ id, entityId: id, entityType: 'feed', message: `动态 ${id}`, uid: '123', username: '酷友' });
  api.getIndexV8EntitiesPaged.mockReset().mockResolvedValueOnce({ data: [4, 3, 2, 1].map(feed) }).mockResolvedValueOnce({ data: [8, 7, 6, 5].map(feed) });
  const pinia = createPinia();
  useSettingsStore(pinia).settings.feedLayout = 'double';
  const tab = { title: '头条', page_name: 'V9_HOME_TAB_HEADLINE', url: '/main/headline' };
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  const wrapper = mount(HomeTabPanel, { props: { embedded: true, selected: true, tabKey: tab.page_name, tabs: [tab] }, global: { plugins: [router, pinia], stubs: { FeedCard: { props: ['feed'], template: '<article class="feed-card"><img /><span>{{ feed.id }}</span></article>' }, AppImage: true } } });
  try {
    await flushPromises();
    const scroll = wrapper.get('.feed-scroll-container').element as HTMLElement;
    Object.defineProperties(scroll, { clientHeight: { value: 800 }, scrollHeight: { value: 6000 } });
    vi.spyOn(scroll, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 1000, 800));
    const columns = wrapper.findAll('.feed-waterfall-column');
    for (const [index, column] of columns.entries()) {
      (column.element as HTMLElement).style.display = 'flex';
      vi.spyOn(column.element, 'getBoundingClientRect').mockImplementation(() => new DOMRect(index * 500, 0, 500, index === 0 ? 6000 : wrapper.findAll('.feed-card').length > 4 ? 2400 : 1400));
    }
    const originalParents = wrapper.findAll('.feed-card').map(card => card.element.parentElement);
    if (eventType === 'scroll') await wrapper.get('.feed-scroll-container').trigger('scroll');
    else wrapper.get('img').element.dispatchEvent(new Event('load'));
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenCalledTimes(2);
    expect(api.getIndexV8EntitiesPaged).toHaveBeenLastCalledWith({ page: 2, firstItem: '', lastItem: '1' });
    expect(wrapper.findAll('.feed-card')).toHaveLength(8);
    // 预加载追加卡片时，两列原有卡片的归属保持不变。
    expect(wrapper.findAll('.feed-card').filter(card => Number(card.text()) <= 4).map(card => card.element.parentElement)).toEqual(originalParents);
    await wrapper.setProps({ selected: false });
    await wrapper.get('.feed-scroll-container').trigger('scroll');
    await flushPromises();
    expect(api.getIndexV8EntitiesPaged).toHaveBeenCalledTimes(2);
  } finally { wrapper.unmount(); vi.restoreAllMocks(); }
});
