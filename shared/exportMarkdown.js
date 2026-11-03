/**
 * Tái tạo lại chuỗi có đánh dấu [text]{id} từ text thuần và mảng links
 * @param {string} cleanText
 * @param {Array<{ start: number, end: number, id: number }>} links
 * @returns {string}
 */
export function reconstructMarkedText(cleanText = '', links = []) {
  if (!links || links.length === 0) return cleanText;

  // Sắp xếp các link theo start giảm dần để chèn từ cuối về đầu không làm lệch index
  const sorted = [...links].sort((a, b) => b.start - a.start);
  let result = cleanText;

  for (const l of sorted) {
    const before = result.slice(0, l.start);
    const middle = result.slice(l.start, l.end);
    const after = result.slice(l.end);
    result = `${before}[${middle}]{${l.id}}${after}`;
  }

  return result;
}

/**
 * Xuất một danh sách pack thành một chuỗi Markdown hoàn chỉnh
 * @param {Array<{ topic: string, tags?: string[], level?: string, cards: Array<any> }>} packs
 * @returns {string}
 */
export function exportPacksToMarkdown(packs = []) {
  if (!Array.isArray(packs) || packs.length === 0) {
    return '';
  }

  const sections = [];

  for (const pack of packs) {
    const lines = ['---'];
    lines.push(`topic: ${pack.topic || 'General'}`);
    if (pack.tags && pack.tags.length > 0) {
      lines.push(`tags: [${pack.tags.join(', ')}]`);
    }
    if (pack.level) {
      lines.push(`level: ${pack.level}`);
    }
    lines.push('---');
    lines.push('');

    const cards = pack.cards || [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];

      // Nếu có sẵn rawEn và rawVi thì dùng luôn
      let enLine = c.rawEn;
      let viLine = c.rawVi;

      if (!enLine) {
        const enLinks = (c.links || []).map((l) => ({
          id: l.id,
          start: l.enStart,
          end: l.enEnd
        }));
        enLine = reconstructMarkedText(c.en, enLinks);
      }

      if (!viLine) {
        const viLinks = (c.links || []).map((l) => ({
          id: l.id,
          start: l.viStart,
          end: l.viEnd
        }));
        viLine = reconstructMarkedText(c.vi, viLinks);
      }

      lines.push(`en: ${enLine}`);
      lines.push(`vi: ${viLine}`);
      if (c.note || c.rawNote) {
        lines.push(`note: ${c.note || c.rawNote}`);
      }

      if (i < cards.length - 1) {
        lines.push('');
      }
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n\n');
}
