import { generateCardId } from './hash.js';

/**
 * Tách Front Matter và nội dung chính của markdown
 * @param {string} markdown
 * @returns {{ frontMatter: Record<string, any> | null, body: string, frontMatterEndLine: number }}
 */
export function extractFrontMatter(markdown = '') {
  if (typeof markdown !== 'string') {
    return { frontMatter: null, body: '', frontMatterEndLine: 0 };
  }

  const lines = markdown.split(/\r?\n/);
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (startIdx === -1) {
      if (trimmed === '---') {
        startIdx = i;
      } else if (trimmed.length > 0) {
        // Có nội dung trước dấu mở front-matter -> không có front-matter
        break;
      }
    } else {
      if (trimmed === '---') {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return { frontMatter: null, body: markdown, frontMatterEndLine: 0 };
  }

  const fmLines = lines.slice(startIdx + 1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  const frontMatter = parseYamlFrontMatter(fmLines);

  return {
    frontMatter,
    body,
    frontMatterEndLine: endIdx + 1
  };
}

/**
 * Parse đơn giản các trường YAML phổ biến trong front matter
 * @param {string[]} lines
 * @returns {Record<string, any>}
 */
function parseYamlFrontMatter(lines) {
  const meta = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    let val = trimmed.slice(colonIdx + 1).trim();

    // Bỏ ngoặc kép hoặc đơn bao quanh nếu có
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).trim();
    }

    if (key === 'topic') {
      meta.topic = val;
    } else if (key === 'tags') {
      if (val.startsWith('[') && val.endsWith(']')) {
        meta.tags = val
          .slice(1, -1)
          .split(',')
          .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else if (val) {
        meta.tags = val
          .split(',')
          .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        meta.tags = [];
      }
    } else if (key === 'level') {
      meta.level = val.toUpperCase();
    } else {
      meta[key] = val;
    }
  }

  return meta;
}

/**
 * Tách các cụm đánh dấu [văn bản]{n} khỏi chuỗi văn bản
 * Trả về văn bản thuần và danh sách các cụm đã bóc
 * @param {string} rawText
 * @returns {{ cleanText: string, links: Array<{ id: number, start: number, end: number, text: string }> }}
 */
export function extractLinksFromText(rawText = '') {
  const regex = /\[([^\]]*)\]\{(\d+)\}/g;
  let cleanText = '';
  const links = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    // Đoạn text nằm trước match
    cleanText += rawText.slice(lastIndex, match.index);
    const textInside = match[1];
    const linkId = parseInt(match[2], 10);
    const start = cleanText.length;
    cleanText += textInside;
    const end = cleanText.length;

    links.push({
      id: linkId,
      start,
      end,
      text: textInside
    });

    lastIndex = regex.lastIndex;
  }

  // Đoạn text còn lại sau match cuối cùng
  cleanText += rawText.slice(lastIndex);

  return { cleanText, links };
}

/**
 * Phân tích toàn bộ văn bản Markdown thành pack data
 * @param {string} markdown
 * @returns {{
 *   meta: { topic: string, tags: string[], level?: string },
 *   cards: Array<{
 *     id: string,
 *     en: string,
 *     vi: string,
 *     note?: string,
 *     links: Array<{ id: number, enStart: number, enEnd: number, enText: string, viStart: number, viEnd: number, viText: string }>,
 *     rawEn: string,
 *     rawVi: string,
 *     rawNote?: string,
 *     line: number,
 *     cardIndex: number
 *   }>,
 *   rawCards: Array<any>
 * }}
 */
export function parseCards(markdown = '') {
  const { frontMatter, body, frontMatterEndLine } = extractFrontMatter(markdown);
  const meta = {
    topic: frontMatter?.topic || '',
    tags: Array.isArray(frontMatter?.tags) ? frontMatter.tags : [],
    level: frontMatter?.level || ''
  };

  const lines = body.split(/\r?\n/);
  const rawCards = [];
  let currentCard = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const actualLineNum = frontMatterEndLine + i + 1;

    if (!trimmed) {
      if (currentCard && (currentCard.rawEn !== undefined || currentCard.rawVi !== undefined)) {
        rawCards.push(currentCard);
        currentCard = null;
      }
      continue;
    }

    const enMatch = rawLine.match(/^\s*en\s*:\s*(.*)$/i);
    const viMatch = rawLine.match(/^\s*vi\s*:\s*(.*)$/i);
    const noteMatch = rawLine.match(/^\s*note\s*:\s*(.*)$/i);

    if (enMatch) {
      if (currentCard && (currentCard.rawEn !== undefined || currentCard.rawVi !== undefined)) {
        rawCards.push(currentCard);
      }
      currentCard = {
        line: actualLineNum,
        rawEn: enMatch[1],
        rawVi: undefined,
        rawNote: undefined
      };
    } else if (viMatch) {
      if (!currentCard) {
        currentCard = {
          line: actualLineNum,
          rawEn: undefined,
          rawVi: viMatch[1],
          rawNote: undefined
        };
      } else {
        currentCard.rawVi = viMatch[1];
      }
    } else if (noteMatch) {
      if (currentCard) {
        currentCard.rawNote = noteMatch[1];
      }
    }
  }

  if (currentCard && (currentCard.rawEn !== undefined || currentCard.rawVi !== undefined)) {
    rawCards.push(currentCard);
  }

  // Chuyển rawCards thành các thẻ có cấu trúc đầy đủ
  const cards = [];
  rawCards.forEach((raw, idx) => {
    const cardIndex = idx + 1;
    const rawEn = raw.rawEn !== undefined ? raw.rawEn : '';
    const rawVi = raw.rawVi !== undefined ? raw.rawVi : '';
    const rawNote = raw.rawNote !== undefined ? raw.rawNote : '';

    const enParsed = extractLinksFromText(rawEn);
    const viParsed = extractLinksFromText(rawVi);

    // Ghép cặp liên kết
    const links = [];
    const enLinksMap = new Map();
    for (const l of enParsed.links) {
      enLinksMap.set(l.id, l);
    }

    for (const viLink of viParsed.links) {
      const enLink = enLinksMap.get(viLink.id);
      if (enLink) {
        links.push({
          id: viLink.id,
          enStart: enLink.start,
          enEnd: enLink.end,
          enText: enLink.text,
          viStart: viLink.start,
          viEnd: viLink.end,
          viText: viLink.text
        });
      }
    }

    // Sắp xếp các link theo thứ tự xuất hiện ở en
    links.sort((a, b) => a.enStart - b.enStart);

    const cardId = generateCardId(enParsed.cleanText);

    cards.push({
      id: cardId,
      en: enParsed.cleanText,
      vi: viParsed.cleanText,
      note: rawNote ? rawNote.trim() : undefined,
      links,
      rawEn,
      rawVi,
      rawNote: rawNote || undefined,
      line: raw.line,
      cardIndex
    });
  });

  return {
    meta,
    cards,
    rawCards
  };
}
