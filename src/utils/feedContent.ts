/** 从尾部按字符扫描省略号，避免重复正则分组在长正文上回溯。 */
function precedingEllipsisStart(value: string, end: number): number {
  let cursor = end, start = end;
  while (cursor > 0) {
    while (cursor > 0 && /\s/.test(value[cursor - 1])) cursor--;
    const tokenEnd = cursor;
    if (value[cursor - 1] === '…') { while (cursor > 0 && value[cursor - 1] === '…') cursor--; }
    else if (value[cursor - 1] === '.') { while (cursor > 0 && value[cursor - 1] === '.') cursor--; if (tokenEnd - cursor < 2) break; }
    else break;
    start = cursor;
  }
  return start;
}

function moreSuffixStart(message: string): number {
  const value = message.trimEnd();
  const anchor = value.toLowerCase().lastIndexOf('<a');
  if (anchor >= 0 && /^<a\b[^>]*>\s*查看更多\s*<\/a>\s*$/i.test(value.slice(anchor))) return precedingEllipsisStart(value, anchor);
  if (!value.endsWith('查看更多')) return -1;
  const end = value.length - '查看更多'.length;
  const start = precedingEllipsisStart(value, end);
  return start < end ? start : -1;
}

/** 判断正文末尾是否包含酷安列表接口附加的“查看更多”占位。 */
export function hasFeedMoreSuffix(message: string): boolean { return moreSuffixStart(message) >= 0; }

/** 删除接口占位，正文里的正常“查看更多”文字保持不变。 */
export function stripFeedMoreSuffix(message: string): string {
  let value = message.trimEnd(), start = moreSuffixStart(value);
  while (start >= 0) { value = value.slice(0, start).trimEnd(); start = moreSuffixStart(value); }
  return value;
}

/** 从动态详情对象中提取完整正文。 */
export function getFeedDetailMessage(feed: any): string {
  if (!feed) return '';
  if (Array.isArray(feed)) {
    return feed.map((item) => getFeedDetailMessage(item)).find(Boolean) || '';
  }
  if (typeof feed !== 'object') return '';

  const directMessage = [feed.message, feed.message_raw_output, feed.content, feed.text, feed.note]
    .find((value) => typeof value === 'string' && value.trim());
  if (directMessage) return directMessage;

  for (const nested of [feed.feedInfo, feed.feed, feed.targetRow, feed.targetFeed, feed.data]) {
    const message = getFeedDetailMessage(nested);
    if (message) return message;
  }

  return typeof feed.message_title === 'string' ? feed.message_title : '';
}

/** 解析酷安动态网页版返回的 JSON 正文，作为详情接口被验证码拦截时的兜底。 */
export function parseWebFeedDetail(raw: unknown): any | null {
  if (!raw) return null;

  try {
    const text = typeof raw === 'string' ? raw.trim() : raw;
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    if (!parsed || typeof parsed !== 'object') return null;
    const detail = (parsed as any).data ?? parsed;
    return detail && typeof detail === 'object' ? detail : null;
  } catch {
    return null;
  }
}
