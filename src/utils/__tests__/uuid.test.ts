import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from '../uuid';

describe('WebView UUID 兼容', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('存在 randomUUID 时使用原生实现', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'native-id' });
    expect(createUuid()).toBe('native-id');
  });
  it('仅提供 getRandomValues 时生成 UUID v4', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xaa) });
    expect(createUuid()).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  });
  it('缺少 crypto 仍能生成本地 ID', () => {
    vi.stubGlobal('crypto', undefined);
    expect(createUuid()).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  });
});
