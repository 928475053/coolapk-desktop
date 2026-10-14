import { expect, it } from 'vitest';
import { buildLightBackground, normalizeLightBackground } from '../lightBackground';

it('默认与无效底色沿用主题，不接受颜色之外的内容', () => {
  expect(buildLightBackground('')).toBeNull();
  expect(buildLightBackground('url(https://example.com)')).toBeNull();
  expect(normalizeLightBackground('#E5E7EB')).toBe('#e5e7eb');
});

it.each(['#000000', '#ff0000', '#0000ff', '#e5e7eb', '#eee8dc'])('底色 %s 柔化后保留浅色正文对比度与卡片层次', color => {
  const palette = buildLightBackground(color)!;
  const luminance = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  expect((luminance(palette.surface) + 0.05) / (luminance('#17191c') + 0.05)).toBeGreaterThan(7);
  expect(luminance(palette.surface)).toBeGreaterThan(luminance(palette.page));
});
