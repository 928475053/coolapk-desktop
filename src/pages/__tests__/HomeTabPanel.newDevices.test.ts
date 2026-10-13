import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it, vi } from 'vitest';
import HomeTabPanel from '../HomeTabPanel.vue';
import PageDataListPage from '../PageDataListPage.vue';

const api = vi.hoisted(() => ({ getDiscoveryPageData: vi.fn(), getHotSearchKeywords: vi.fn().mockResolvedValue([]) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));

it.each([
  ['上市新机', '#/product/releasedProductList?category=phone', 390],
  ['即将上市', '#/product/unreleasedProductList?category=phone', 1280],
])('%s 的更多打开列表、保留分页并可进入产品详情', async (title, url, width) => {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
  const tab = { title: '新机', page_name: 'V11_HOME_NEW', url: 'V11_HOME_NEW' };
  api.getDiscoveryPageData.mockImplementation(async (options) => options.url === 'V11_HOME_NEW'
    ? { data: [{ id: 'new-device-card', entityType: 'card', entityTemplate: 'productTimelineListCard', title, url, entities: [{ id: 5457, entityType: 'product', title: '首页新机' }] }], hasMore: false }
    : { data: [{ id: 5457 + options.page, entityType: 'product', title: `列表新机 ${options.page}` }], hasMore: options.page === 1, lastItem: 'last-product', pageContext: 'product-list-context' });
  const home = defineComponent({ components: { HomeTabPanel }, setup: () => ({ tab }), template: '<HomeTabPanel embedded tab-key="V11_HOME_NEW" :tabs="[tab]" />' });
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: home },
    { path: '/page', component: PageDataListPage },
    { path: '/product/:id', component: { template: '<p>产品详情</p>' } },
  ] });
  await router.push('/');
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router, createPinia()], stubs: { AppImage: true, FeedVideoCard: true } } });
  try {
    await flushPromises();
    const more = wrapper.findAll('.discovery-group-header button').find(button => button.text().includes('更多'));
    expect(more).toBeDefined();
    await more!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/page');
    expect(router.currentRoute.value.query).toMatchObject({ url, title, renderer: 'discovery' });
    expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url, title, page: 1 }));
    expect(wrapper.text()).toContain('列表新机 1');
    await wrapper.get('.page-container').trigger('scroll');
    await flushPromises();
    expect(api.getDiscoveryPageData).toHaveBeenLastCalledWith(expect.objectContaining({ url, page: 2, lastItem: 'last-product', pageContext: 'product-list-context' }));
    expect(wrapper.text()).toContain('列表新机 2');
    const product = wrapper.findAll('button').find(button => button.text().includes('列表新机 1'));
    expect(product).toBeDefined();
    await product!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/product/5458');
  } finally { wrapper.unmount(); vi.restoreAllMocks(); }
});
