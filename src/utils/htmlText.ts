/** HTML 实体只解码一次，避免 &amp;lt; 被连续还原成可执行标签。 */
export function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    if (!name.startsWith('#')) return named[name.toLowerCase()] || entity;
    const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  });
}

/** 在隔离文档中解析富文本，只返回文本；调用方必须用文本插值或文本节点展示结果。 */
export function htmlToPlainText(value: string, breaks = false, separator = ''): string {
  // 文本导出在无浏览器的环境也可使用；逐字符跳过标签，不使用不完整的标签清洗正则。
  if (typeof DOMParser === 'undefined') {
    let result = '', cursor = 0;
    while (cursor < value.length) {
      if (value[cursor] !== '<') { result += value[cursor++]; continue; }
      const end = value.indexOf('>', cursor + 1);
      if (end < 0) { result += value.slice(cursor); break; }
      const tag = value.slice(cursor + 1, end).trim();
      result += breaks && /^(?:br\b|\/(?:p|div|li|tr|h[1-6])\b)/i.test(tag) ? '\n' : separator;
      cursor = end + 1;
    }
    return decodeHtmlEntities(result).replace(/\u00a0/g, ' ');
  }
  const doc = new DOMParser().parseFromString(value, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach(node => node.remove());
  let result = '';
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { result += node.textContent || ''; return; }
    if (!(node instanceof Element)) return;
    if (node.tagName === 'BR') { result += breaks ? '\n' : separator; return; }
    result += separator;
    node.childNodes.forEach(visit);
    result += breaks && /^(P|DIV|LI|TR|H[1-6])$/.test(node.tagName) ? '\n' : separator;
  };
  doc.body.childNodes.forEach(visit);
  return result.replace(/\u00a0/g, ' ');
}
