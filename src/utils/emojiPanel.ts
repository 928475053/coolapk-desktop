import { EMOJI_MAP, getEmojiUrl } from './coolapkEmoji';
import { NIUNIU_EMOJI_MAP } from './niuniuEmojiData';
import { SYSTEM_EMOJIS } from './systemEmojiData';

export interface EmojiPicture { id: string; url: string }
export const isSystemEmoji = (text: string) => SYSTEM_EMOJIS.some(item => item.text === text);
const niuniuUrls = new Set(Object.values(NIUNIU_EMOJI_MAP));
const seen = new Set<string>();
const builtin = Object.entries(EMOJI_MAP).filter(([, source]) => {
  if (seen.has(source)) return false;
  seen.add(source); return true;
}).map(([name, source]) => ({ name, source, url: getEmojiUrl(name) }));
export const EMOJI_GROUPS = [
  { id: 'coolapk', title: '酷安表情', icon: 'fa-face-grin-wide', items: builtin.filter(item => !niuniuUrls.has(item.source) && !/^(?:c_|coolapk_emotion_(?:6[89]|7\d|80|8[5-9]|9[0-4])\.)/.test(item.source)) },
  { id: 'system', title: '系统 Emoji', icon: 'fa-face-smile', items: SYSTEM_EMOJIS.map(item => ({ name: item.text, url: '', label: item.name })) },
  { id: 'coolb', title: '酷币', icon: '', items: builtin.filter(item => /^(?:c_|coolapk_emotion_(?:6[89]|7\d|80|8[5-9]|9[0-4])\.)/.test(item.source)) },
  { id: 'niuniu', title: '牛牛', icon: '', items: builtin.filter(item => niuniuUrls.has(item.source)) },
];

/** 收藏仅接受官方图片域名；不将服务端任意 URL 交给图片下载器。 */
export function normalizeEmojiPictures(data: unknown): EmojiPicture[] {
  if (!Array.isArray(data)) throw new Error('收藏表情列表格式异常');
  const ids = new Set<string>();
  return data.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const id = String(item.id ?? '');
    if (!id || id === '0' || ids.has(id) || typeof item.url !== 'string') return [];
    try {
      const url = new URL(item.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
        || !(url.hostname === 'coolapk.com' || url.hostname.endsWith('.coolapk.com'))) return [];
      ids.add(id); return [{ id, url: url.href }];
    } catch { return []; }
  });
}

export function emojiPictureFile(dataUrl: string): File {
  const match = /^data:(image\/(?:png|jpe?g|pjpeg|gif|webp|avif|bmp|heic|heif))(?:;[^;,\r\n]+)*;base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(dataUrl);
  if (!match || match[2].length > 28_000_000) throw new Error('收藏表情不是受支持的图片，或图片过大');
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const mime = match[1].toLowerCase().replace(/^image\/(?:jpg|pjpeg)$/, 'image/jpeg');
  const ext = mime.split('/')[1];
  return new File([bytes], `收藏表情.${ext}`, { type: mime });
}
