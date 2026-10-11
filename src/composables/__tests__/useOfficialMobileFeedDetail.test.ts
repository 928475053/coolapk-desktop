import { describe, it, expect } from 'vitest';
import { isMobileLayout, shouldUseOfficialMobileFeedDetail } from '../useOfficialMobileFeedDetail';
import { normalizeSettings } from '../../stores/settings';
describe('官方移动详情的默认与回退', () => {
  it('旧配置默认开启，显式关闭经过配置规范化仍然保留', () => {
    expect(normalizeSettings({}).officialMobileFeedDetail).toBe(true);
    expect(normalizeSettings({ officialMobileFeedDetail: false }).officialMobileFeedDetail).toBe(false);
  });
  it('手机和平板启用；桌面宽窗保持原详情，禁用窄窗移动模式也保持原详情', () => {
    expect(shouldUseOfficialMobileFeedDetail(true, 360, true, false)).toBe(true);
    expect(shouldUseOfficialMobileFeedDetail(true, 1024, true, false)).toBe(true);
    expect(shouldUseOfficialMobileFeedDetail(true, 1200, false, false)).toBe(false);
    expect(shouldUseOfficialMobileFeedDetail(true, 360, false, true)).toBe(false);
    expect(shouldUseOfficialMobileFeedDetail(false, 360, true, false)).toBe(false);
  });
});
describe('移动端布局判定', () => {
  it('触摸设备恒为移动端布局，与宽度无关', () => {
    expect(isMobileLayout(1200, true, false)).toBe(true);
    expect(isMobileLayout(360, true, false)).toBe(true);
  });
  it('非触摸设备仅在窄窗且未禁用自动切换时算移动端布局', () => {
    expect(isMobileLayout(720, false, false)).toBe(true);
    expect(isMobileLayout(721, false, false)).toBe(false);
    expect(isMobileLayout(360, false, true)).toBe(false);
  });
});
