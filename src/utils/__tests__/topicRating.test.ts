import { describe, expect, it } from 'vitest';
import { extractTopicRatings, hasTopicRating, ratingNumber, topicRatingDimensions, topicScoreStars, topicReleaseLabel } from '../topicRating';

describe('官方话题评分数据', () => {
  it('按照官方日期规则隐藏未公布等状态，不把状态文案当发布日期', () => {
    expect(topicReleaseLabel('未公布')).toBe('');
    expect(topicReleaseLabel(null)).toBe('');
    expect(topicReleaseLabel('2026年10月11日')).toBe('2026-10-11发布');
    expect(topicReleaseLabel('2026年06月99日')).toBe('2026年上半年发布');
  });
  it('使用官方十分制星级边界，维度区分总分和个人分', () => {
    expect([9.2, 9.1, 8.4, 7.6, 6.8, 6, 5, 4, 3, 1, 0].map(topicScoreStars)).toEqual([5, 4.5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0]);
    const items = [{ id: 1, name: '流畅度', average_score: '8.8', v4_score: 6 }];
    expect(topicRatingDimensions(items)[0]?.score).toBe(8.8);
    expect(topicRatingDimensions(items, true)[0]?.score).toBe(6);
    expect(topicRatingDimensions([{ name: '未知' }])).toEqual([]);
  });
  it('缺失数据不转换成零，不把普通动态当作评分记录', () => {
    expect([null, undefined, '', 'abc', -1].map(ratingNumber)).toEqual([null, null, null, null, null]);
    expect(ratingNumber('0')).toBe(0);
    expect(hasTopicRating({ id: 1, open_rate: 1 })).toBe(true);
    expect(hasTopicRating({ id: 1, open_rate: 0 })).toBe(false);
    const review = { entityType: 'nodeRating', id: 5, star: 4, description: '点评', rating_item_info: [{ v4_score: 8 }] };
    expect(extractTopicRatings([{ entities: [review, { entityType: 'feed', id: 6 }] }])).toEqual([review]);
  });
});
