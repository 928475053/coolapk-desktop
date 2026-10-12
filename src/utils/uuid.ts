/** 用于草稿及界面对象的 ID，不用于认证或安全令牌。 */
export function createUuid(): string {
  const api = globalThis.crypto;
  if (typeof api?.randomUUID === 'function') return api.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof api?.getRandomValues === 'function') {
    api.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
