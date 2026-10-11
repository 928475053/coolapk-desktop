import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, emojiPictureFile, normalizeEmojiPictures } from '../emojiPanel';
describe('emoji panel data', () => {
  it('groups all unique builtin images once and separates cows and coins', () => {
    const images = EMOJI_GROUPS.filter(group => group.id !== 'system').flatMap(group => group.items.map(item => item.url));
    expect(new Set(images).size).toBe(images.length);
    expect(EMOJI_GROUPS.every(group => group.items.length > 0)).toBe(true);
    expect(EMOJI_GROUPS.find(group => group.id === 'coolb')!.items.some(item => item.name === '酷币')).toBe(true);
    expect(EMOJI_GROUPS.find(group => group.id === 'niuniu')!.items.some(item => item.name === '牛牛点赞')).toBe(true);
  });
  it('rejects invalid and foreign favorite URLs and duplicate IDs', () => {
    const good = { id: '1', url: 'https://image.coolapk.com/test.gif' };
    expect(normalizeEmojiPictures([good, good, { id: '0' }, { id: '2', url: 'javascript:alert(1)' }, { id: '3', url: 'https://coolapk.com.attacker.invalid/test' }])).toEqual([good]);
    expect(() => normalizeEmojiPictures({ data: [] })).toThrow();
    expect(() => emojiPictureFile('data:text/html;base64,YQ==')).toThrow();
  });
});
