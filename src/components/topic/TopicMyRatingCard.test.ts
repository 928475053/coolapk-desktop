import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '../../stores/auth';
import TopicMyRatingCard from './TopicMyRatingCard.vue';

async function renderCard(detail: any, loggedIn = true) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore(pinia);
  auth.isLoggedIn = loggedIn;
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/topic/:tag', component: { template: '<div />' } },
    { path: '/feed/:id', component: { template: '<div />' } },
  ] });
  await router.push('/topic/iOS27');
  const wrapper = mount(TopicMyRatingCard, { props: { detail, entity: { entityType: 'singleRatingCard' } }, global: {
    plugins: [pinia, router], stubs: { AppDialog: { props: ['isOpen'], template: '<div v-if="isOpen" class="dialog-stub"><slot /></div>' } },
  } });
  return { wrapper, auth, router };
}

describe('话题个人评分入口', () => {
  it('从话题 userAction 读取星级并打开自己的点评', async () => {
    const { wrapper, router } = await renderCard({ title: 'iOS27', userAction: { rating: 4, ratingFeedUrl: 'https://www.coolapk.com/feed/12345' } });
    expect(wrapper.find('.my-rating-copy').text()).toContain('4 星');
    expect(wrapper.findAll('.my-rating-stars .filled')).toHaveLength(4);
    await wrapper.find('.topic-my-rating').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/feed/12345');
    expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    wrapper.unmount();
  });

  it('没有关联点评时展示个人评分信息，而非点击无反馈', async () => {
    const { wrapper, router } = await renderCard({ title: 'iOS27', userAction: { rating: 5 } });
    await wrapper.find('.topic-my-rating').trigger('click');
    expect(wrapper.find('.dialog-stub').text()).toContain('你已给出 5 星评分');
    expect(router.currentRoute.value.path).toBe('/topic/iOS27');
    wrapper.unmount();
  });

  it('未登录时打开登录入口', async () => {
    const { wrapper, auth } = await renderCard({}, false);
    await wrapper.find('.topic-my-rating').trigger('click');
    expect(auth.isLoginModalOpen).toBe(true);
    expect(wrapper.find('.dialog-stub').exists()).toBe(false);
    wrapper.unmount();
  });

  it('不把缺失个人评分伪装成已评分，也不跳转无效的动态 ID', async () => {
    const { wrapper } = await renderCard({ userAction: { ratingFeedUrl: '/feed/invalid' }, ratingFeed: { id: 0 } });
    await wrapper.find('.topic-my-rating').trigger('click');
    expect(wrapper.find('.dialog-stub').text()).toContain('暂未获取到你的个人评分');
    wrapper.unmount();
  });
});
