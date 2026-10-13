import { getEmojiUrl } from './coolapkEmoji';

/** 直接创建文本、换行和表情节点，草稿里的标签与引号始终作为原文保留。 */
export function createEditorTextNodes(text: string): Node[] {
  const nodes: Node[] = [];
  const appendText = (value: string) => {
    const lines = value.split('\n');
    lines.forEach((line, index) => { if (index) nodes.push(document.createElement('br')); if (line) nodes.push(document.createTextNode(line)); });
  };
  let offset = 0;
  for (const match of text.matchAll(/\[([^\]\r\n]{1,20})\]/g)) {
    appendText(text.slice(offset, match.index));
    const name = match[1], url = getEmojiUrl(name);
    if (!url) appendText(match[0]);
    else {
      const image = document.createElement('img');
      image.className = 'coolapk-emoji'; image.src = url; image.alt = match[0]; image.title = name;
      image.dataset.emoji = match[0]; image.contentEditable = 'false'; nodes.push(image);
    }
    offset = match.index! + match[0].length;
  }
  appendText(text.slice(offset));
  return nodes;
}
