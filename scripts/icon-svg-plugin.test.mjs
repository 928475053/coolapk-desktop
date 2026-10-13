import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAndroidIconCss } from './icon-svg-plugin.ts';

test('手机导航、搜索、认证和互动图标使用内置 SVG，不依赖字体资源', () => {
  const names = ['fa-house', 'fa-microchip', 'fa-compass', 'fa-user', 'fa-plus', 'fa-magnifying-glass', 'fa-certificate', 'fa-ellipsis-vertical', 'fa-comment', 'fa-thumbs-up', 'fa-star', 'fa-retweet'];
  const css = createAndroidIconCss(names);
  for (const name of names) assert.ok(css.includes(`.${name}::before{--app-icon-svg:url("data:image/svg+xml,`), name);
  assert.ok(css.includes('content:""!important'));
  assert.ok(css.includes('-webkit-mask:var(--app-icon-svg)'));
  assert.ok(!css.includes('.woff'));
  assert.ok(!css.includes('@font-face'));
});

test('实心、空心、品牌图标及旧别名保留各自 SVG', () => {
  const css = createAndroidIconCss(['fa-heart', 'fa-github', 'fa-stream']);
  assert.ok(css.includes('.fas.fa-heart::before'));
  assert.ok(css.includes('.far.fa-heart::before'));
  assert.ok(css.includes('.fab.fa-github::before'));
  assert.ok(css.includes('.fas.fa-stream::before'));
  assert.ok(css.includes(':root[data-icon-renderer="svg"]'));
  const uri = css.match(/data:image\/svg\+xml,([^"\n]+)/)?.[1];
  assert.ok(uri && decodeURIComponent(uri).includes('License'));
});

test('重复名称不重复打包，未知图标保持原有显示', () => {
  assert.equal(createAndroidIconCss(['fa-house', 'fa-house']), createAndroidIconCss(['fa-house']));
  assert.equal(createAndroidIconCss(['fa-no-such-icon', '../house']), '');
});
