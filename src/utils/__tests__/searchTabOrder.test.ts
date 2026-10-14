import { describe, expect, it } from 'vitest';
import { normalizeSearchTabOrder, orderSearchTabs } from '../searchTabOrder';
import type { SearchTabDefinition } from '../../types/search';

const tabs: SearchTabDefinition[] = [
  { key: 'product', searchType: 'product', label: '数码' },
  { key: 'all', searchType: 'all', label: '综合' },
  { key: 'feed', searchType: 'feed', label: '动态' },
  { key: 'apps', searchType: 'apk', label: '应用' },
  { key: 'new', searchType: 'new', label: '新分类' },
];

describe('搜索分类排序', () => {
  it('综合固定第一，按搜索类型调整顺序，保留服务端分类对象与查询键', () => {
    const ordered = orderSearchTabs(tabs, ['apk', 'all', 'feed']);
    expect(ordered.map(tab => tab.label)).toEqual(['综合', '应用', '动态', '数码', '新分类']);
    expect(ordered[1]).toBe(tabs[3]);
    expect(tabs[0].key).toBe('product');
  });

  it('未保存的分类按服务端相对顺序追加，不因过期设置增加或隐藏分类', () => {
    expect(orderSearchTabs(tabs, ['removed', 'apk']).map(tab => tab.key)).toEqual(['all', 'apps', 'product', 'feed', 'new']);
    expect(orderSearchTabs(tabs, []).map(tab => tab.key)).toEqual(['all', 'product', 'feed', 'apps', 'new']);
  });

  it('读取旧配置和损坏数据时去重并保留有效扩展分类', () => {
    expect(normalizeSearchTabOrder(undefined)).toEqual([]);
    expect(normalizeSearchTabOrder({ apk: 1 })).toEqual([]);
    expect(normalizeSearchTabOrder(['all', 'apk', 1, null, '', '  ', ' apk ', 'future', 'a'.repeat(129)])).toEqual(['apk', 'future']);
  });
});
