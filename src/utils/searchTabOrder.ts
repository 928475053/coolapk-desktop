import type { SearchTabDefinition } from '../types/search';

/** 保留服务端扩展分类，过滤损坏的顺序；综合始终固定在第一位。 */
export function normalizeSearchTabOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 128).map(item => item.trim()).filter(item => item !== 'all'))];
}

/** 只调整现有分类的展示顺序，不修改搜索类型、标签或查询参数。 */
export function orderSearchTabs(tabs: readonly SearchTabDefinition[], value: unknown): SearchTabDefinition[] {
  const ranks = new Map(normalizeSearchTabOrder(value).map((key, index) => [key, index]));
  return [...tabs].sort((left, right) => {
    if (left.searchType === 'all') return right.searchType === 'all' ? 0 : -1;
    if (right.searchType === 'all') return 1;
    return (ranks.get(left.searchType) ?? ranks.size) - (ranks.get(right.searchType) ?? ranks.size);
  });
}
