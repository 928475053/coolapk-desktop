export function ratingNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// Official DateUtils requires a year; status strings such as 未公布 are hidden.
export function topicReleaseLabel(value: unknown): string {
  const text = String(value || '');
  const year = text.match(/(\d{4})年/)?.[1];
  if (!year) return '';
  const date = text.replace(`${year}年`, '').match(/^(\d{1,2})月(\d{1,2})日$/);
  if (!date) return `${text}发布`;
  const [, month, day] = date;
  if (Number(day) === 99 && [6, 12].includes(Number(month))) return `${year}年${Number(month) === 6 ? '上' : '下'}半年发布`;
  return `${year}-${month}-${day}发布`;
}

export function hasTopicRating(detail: any): boolean {
  return Boolean(detail?.id) && (Number(detail.open_rate) === 1
    || Number(detail.star_total_count) > 0 || Number(detail.v4_rating_total_count) > 0
    || (Array.isArray(detail.rating_item_info) && detail.rating_item_info.length > 0));
}

export function topicRatingDimensions(raw: unknown, personal = false) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const score = ratingNumber(personal ? item?.v4_score : item?.average_score);
    if (!item?.name || score === null) return [];
    const descriptions = Array.isArray(item.star_desc) ? item.star_desc : [];
    return [{ id: String(item.id || item.name), name: String(item.name), score,
      description: String(descriptions[Math.max(0, Math.round(topicScoreStars(score)) - 1)] || '') }];
  });
}

// 官方 RatingUtils 的十分制到星级映射，不是简单除以二。
export function topicScoreStars(score: number): number {
  for (const [threshold, stars] of [[9.2, 5], [8.4, 4.5], [7.6, 4], [6.8, 3.5], [6, 3], [5, 2.5], [4, 2], [3, 1.5], [1, 1]]) {
    if (score >= threshold) return stars;
  }
  return 0;
}

export function extractTopicRatings(data: unknown): any[] {
  if (Array.isArray(data)) return data.flatMap(extractTopicRatings);
  if (!data || typeof data !== 'object') return [];
  const row = data as Record<string, any>;
  if (String(row.entityType || '').toLowerCase() === 'noderating'
    || (row.star !== undefined && (row.userInfo || row.target_type === '3'))) return [row];
  return extractTopicRatings(row.entities || row.rows || row.data);
}

export function topicRatingCursor(row: any): string {
  return row?.id === undefined || row?.id === null ? '' : String(row.id);
}
