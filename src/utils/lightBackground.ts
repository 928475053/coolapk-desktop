/** 自定义底色始终柔化为浅色，保留深色正文的可读性。空值代表沿用默认主题。 */
export function normalizeLightBackground(value: unknown): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '';
}

export function buildLightBackground(value: unknown): Record<string, string> | null {
  const color = normalizeLightBackground(value);
  if (!color) return null;
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  const minimum = Math.min(...channels);
  const blend = minimum < 220 ? (220 - minimum) / (255 - minimum) : 0;
  const base = channels.map(channel => Math.round(channel + (255 - channel) * blend));
  const mix = (target: number, weight: number) => '#' + base.map(channel => Math.round(channel + (target - channel) * weight).toString(16).padStart(2, '0')).join('');
  return { page: mix(255, 0), secondary: mix(0, 0.025), surface: mix(255, 0.45), hover: mix(255, 0.18), active: mix(0, 0.03), border: mix(0, 0.12), divider: mix(0, 0.06) };
}
