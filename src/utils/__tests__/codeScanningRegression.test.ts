import { expect, it } from 'vitest';
import { decodeHtmlEntities, htmlToPlainText } from '../htmlText';
import { createEditorTextNodes } from '../editorTextNodes';
import { getImageUrlByQuality, getStaticAnimatedImageUrl } from '../image';
import { hasFeedMoreSuffix, stripFeedMoreSuffix } from '../feedContent';
import { isUpdateAssetCompatible } from '../updateChecker';
import { renderPublishArticlePreview } from '../publishArticleMarkdown';

it('草稿回填保留标签原文、换行与表情，不创建输入中的 HTML 元素', () => {
  const editor = document.createElement('div');
  editor.append(...createEditorTextNodes('<img src=x onerror=alert(1)>\n[笑哭] &lt;script&gt;'));
  expect(editor.querySelectorAll('img')).toHaveLength(1);
  expect(editor.querySelector('img')?.dataset.emoji).toBe('[笑哭]');
  expect(editor.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  expect(editor.querySelectorAll('br')).toHaveLength(1);
  expect(editor.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(editor.textContent).toContain('&lt;script&gt;');
});

it('文本转换保留正常实体和段落，不重复解码或保留脚本节点', () => {
  expect(decodeHtmlEntities('&amp;lt; &lt; &#39; &#x1f600;')).toBe("&lt; < ' 😀");
  expect(htmlToPlainText('<p>A&amp;B</p><p>下一段<br>正文</p>', true).trim()).toBe('A&B\n下一段\n正文');
  expect(htmlToPlainText('A<b>B</b>C', true, ' ').replace(/\s+/g, ' ').trim()).toBe('A B C');
  const output = htmlToPlainText('<scr<script>ipt>alert(1)</scr<script>ipt><b>安全正文</b>');
  const element = document.createElement('div');
  element.textContent = output;
  expect(element.querySelector('script')).toBeNull();
  expect(element.textContent).toContain('安全正文');
});

it('官方文章的额外实体编码保持兼容，最终预览仍转义危险标签', () => {
  const html = renderPublishArticlePreview({ title: '', cover: null, blocks: [{ id: 'body', type: 'text', text: '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;' }] });
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
});

it('第三方主机伪装酷安域名时不修改图片 URL，真实 CDN 保持缩略图功能', () => {
  for (const url of ['https://coolapk.com.evil.example/a.jpg', 'https://evil.example/coolapk.com/a.jpg', 'https://evil.example/a.jpg?host=coolapk.com']) expect(getImageUrlByQuality(url, 'hd')).toBe(url);
  expect(getStaticAnimatedImageUrl('https://evil.example/coolapk.com/a.gif')).toBe('');
  expect(getImageUrlByQuality('https://image.coolapk.com/a.jpg', 'standard')).toBe('https://image.coolapk.com/a.jpg.s.jpg');
});

it('超长省略号和安装包名称快速结束，保留正常查看更多与安装包选择', () => {
  expect(hasFeedMoreSuffix('.'.repeat(30000) + '普通正文')).toBe(false);
  expect(stripFeedMoreSuffix('正文' + '.'.repeat(30000) + ' 查看更多')).toBe('正文');
  const platform = { os: 'windows', arch: 'x86_64' };
  expect(isUpdateAssetCompatible('coolapk-x64-setup.exe', platform, 'installer')).toBe(true);
  expect(isUpdateAssetCompatible('coolapk-x64-portable-20261013.exe', platform, 'portable')).toBe(true);
  expect(isUpdateAssetCompatible('coolapk-x64-' + 'setup-'.repeat(15000) + 'invalid.txt', platform, 'installer')).toBe(false);
}, 1000);
