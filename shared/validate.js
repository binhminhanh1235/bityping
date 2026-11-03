import { extractFrontMatter, parseCards, extractLinksFromText } from './parseCards.js';
import { generateCardId } from './hash.js';

export const ERROR_CODES = {
  MISSING_TOPIC: 'MISSING_TOPIC',
  PACK_LIMIT_EXCEEDED: 'PACK_LIMIT_EXCEEDED',
  EMPTY_PACK: 'EMPTY_PACK',
  MISSING_EN: 'MISSING_EN',
  MISSING_VI: 'MISSING_VI',
  LENGTH_EXCEEDED: 'LENGTH_EXCEEDED',
  BRACKET_INVALID: 'BRACKET_INVALID',
  LINK_NESTED: 'LINK_NESTED',
  LINK_EMPTY: 'LINK_EMPTY',
  LINK_UNPAIRED: 'LINK_UNPAIRED',
  LINK_DUPLICATE_ID: 'LINK_DUPLICATE_ID'
};

const MAX_PACK_BYTES = 100 * 1024; // 100 KB
const MAX_PACK_CARDS = 200;
const MAX_EN_LENGTH = 500;
const MAX_VI_LENGTH = 600;

/**
 * Kiểm tra tính hợp lệ của dấu ngoặc trong 1 dòng văn bản
 * Không được có [ ] { } ngoài các cụm [text]{n}
 * Cụm không được rỗng hoặc lồng nhau
 * @param {string} text
 * @returns {{ valid: boolean, errors: string[], links: Array<{ id: number, text: string }> }}
 */
function validateBracketsInLine(text = '') {
  const errors = [];
  const links = [];

  // Tìm tất cả cụm [text]{digits}
  const linkRegex = /\[([^\]]*)\]\{(\d+)\}/g;
  let match;
  const matchedRanges = [];

  while ((match = linkRegex.exec(text)) !== null) {
    const rawMatch = match[0];
    const textInside = match[1];
    const id = parseInt(match[2], 10);

    matchedRanges.push({
      start: match.index,
      end: match.index + rawMatch.length
    });

    if (textInside.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.LINK_EMPTY,
        message: `Cụm liên kết {${id}} không được để trống []`
      });
    }

    if (/[\[\]\{\}]/.test(textInside)) {
      errors.push({
        code: ERROR_CODES.LINK_NESTED,
        message: `Cụm liên kết {${id}} chứa dấu ngoặc lồng nhau không hợp lệ`
      });
    }

    links.push({ id, text: textInside });
  }

  // Tạo chuỗi còn lại sau khi bỏ đi các match hợp lệ
  let remainingText = '';
  let lastIdx = 0;
  for (const range of matchedRanges) {
    remainingText += text.slice(lastIdx, range.start);
    lastIdx = range.end;
  }
  remainingText += text.slice(lastIdx);

  // Kiểm tra xem chuỗi còn lại có chứa [ ] { } thừa không
  if (/[\[\]\{\}]/.test(remainingText)) {
    errors.push({
      code: ERROR_CODES.BRACKET_INVALID,
      message: 'Có dấu ngoặc [ ] hoặc { } thừa ngoài định dạng [văn bản]{n}'
    });
  }

  return { errors, links };
}

/**
 * Validate toàn diện một nội dung Markdown pack
 * @param {string} markdown
 * @param {Set<string> | string[]} [existingHashes=[]]
 * @returns {{
 *   valid: boolean,
 *   meta: { topic: string, tags: string[], level?: string },
 *   errors: Array<{ card?: number, line?: number, code: string, message: string }>,
 *   cards: Array<any>,
 *   uniqueCards: Array<any>,
 *   duplicates: Array<any>,
 *   duplicateCount: number,
 *   savedCount: number
 * }}
 */
export function validateCards(markdown = '', existingHashes = []) {
  const errors = [];
  const existingSet = existingHashes instanceof Set ? existingHashes : new Set(existingHashes);

  // 1. Kiểm tra kích thước byte của pack (tối đa 100 KB)
  const byteLength = new TextEncoder().encode(markdown).length;
  if (byteLength > MAX_PACK_BYTES) {
    errors.push({
      code: ERROR_CODES.PACK_LIMIT_EXCEEDED,
      line: 1,
      message: `Kích thước pack (${(byteLength / 1024).toFixed(1)} KB) vượt quá giới hạn 100 KB`
    });
  }

  const { frontMatter, frontMatterEndLine } = extractFrontMatter(markdown);

  // 2. Kiểm tra front matter và topic
  if (!frontMatter || !frontMatter.topic || typeof frontMatter.topic !== 'string' || !frontMatter.topic.trim()) {
    errors.push({
      code: ERROR_CODES.MISSING_TOPIC,
      line: 1,
      message: 'Thiếu trường "topic" bắt buộc trong front matter (--- topic: ... ---)'
    });
  }

  const parsed = parseCards(markdown);
  const { meta, cards, rawCards } = parsed;

  // 3. Kiểm tra số lượng thẻ (1 - 200)
  if (rawCards.length === 0) {
    errors.push({
      code: ERROR_CODES.EMPTY_PACK,
      line: frontMatterEndLine || 1,
      message: 'Không tìm thấy thẻ nào trong pack. Mỗi thẻ cần có cặp dòng en: và vi:'
    });
  } else if (rawCards.length > MAX_PACK_CARDS) {
    errors.push({
      code: ERROR_CODES.PACK_LIMIT_EXCEEDED,
      line: 1,
      message: `Số lượng thẻ (${rawCards.length}) vượt quá giới hạn tối đa 200 thẻ/pack`
    });
  }

  // 4. Validate từng thẻ
  rawCards.forEach((raw, idx) => {
    const cardNum = idx + 1;
    const lineNum = raw.line || 1;

    // Kiểm tra thiếu en: hoặc vi:
    if (raw.rawEn === undefined || raw.rawEn === null) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.MISSING_EN,
        message: `Thẻ #${cardNum} thiếu dòng en:`
      });
      return;
    }
    if (raw.rawVi === undefined || raw.rawVi === null) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.MISSING_VI,
        message: `Thẻ #${cardNum} thiếu dòng vi:`
      });
      return;
    }

    const rawEn = raw.rawEn.trim();
    const rawVi = raw.rawVi.trim();

    if (!rawEn) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.MISSING_EN,
        message: `Thẻ #${cardNum} có nội dung en: bị rỗng`
      });
    }
    if (!rawVi) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.MISSING_VI,
        message: `Thẻ #${cardNum} có nội dung vi: bị rỗng`
      });
    }

    // Giới hạn độ dài: en tối đa 500 ký tự, vi tối đa 600 ký tự
    if (rawEn.length > MAX_EN_LENGTH) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.LENGTH_EXCEEDED,
        message: `Dòng en: (${rawEn.length} ký tự) vượt quá giới hạn tối đa 500 ký tự`
      });
    }
    if (rawVi.length > MAX_VI_LENGTH) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: ERROR_CODES.LENGTH_EXCEEDED,
        message: `Dòng vi: (${rawVi.length} ký tự) vượt quá giới hạn tối đa 600 ký tự`
      });
    }

    // Validate ngoặc và cụm liên kết trong en: và vi:
    const enBrackets = validateBracketsInLine(rawEn);
    for (const err of enBrackets.errors) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: err.code,
        message: `[en] ${err.message}`
      });
    }

    const viBrackets = validateBracketsInLine(rawVi);
    for (const err of viBrackets.errors) {
      errors.push({
        card: cardNum,
        line: lineNum,
        code: err.code,
        message: `[vi] ${err.message}`
      });
    }

    // Kiểm tra duplicate link id trong en:
    const enIdCounts = new Map();
    for (const l of enBrackets.links) {
      enIdCounts.set(l.id, (enIdCounts.get(l.id) || 0) + 1);
    }
    for (const [id, count] of enIdCounts.entries()) {
      if (count > 1) {
        errors.push({
          card: cardNum,
          line: lineNum,
          code: ERROR_CODES.LINK_DUPLICATE_ID,
          message: `Cụm liên kết {${id}} xuất hiện ${count} lần trong dòng en:`
        });
      }
    }

    // Kiểm tra duplicate link id trong vi:
    const viIdCounts = new Map();
    for (const l of viBrackets.links) {
      viIdCounts.set(l.id, (viIdCounts.get(l.id) || 0) + 1);
    }
    for (const [id, count] of viIdCounts.entries()) {
      if (count > 1) {
        errors.push({
          card: cardNum,
          line: lineNum,
          code: ERROR_CODES.LINK_DUPLICATE_ID,
          message: `Cụm liên kết {${id}} xuất hiện ${count} lần trong dòng vi:`
        });
      }
    }

    // Kiểm tra ghép cặp (mỗi {n} ở en phải có ở vi và ngược lại)
    const enIds = new Set(enBrackets.links.map((l) => l.id));
    const viIds = new Set(viBrackets.links.map((l) => l.id));

    for (const enId of enIds) {
      if (!viIds.has(enId)) {
        errors.push({
          card: cardNum,
          line: lineNum,
          code: ERROR_CODES.LINK_UNPAIRED,
          message: `Cụm {${enId}} có ở en: nhưng không có ở vi:`
        });
      }
    }
    for (const viId of viIds) {
      if (!enIds.has(viId)) {
        errors.push({
          card: cardNum,
          line: lineNum,
          code: ERROR_CODES.LINK_UNPAIRED,
          message: `Cụm {${viId}} có ở vi: nhưng không có ở en:`
        });
      }
    }
  });

  // Nếu có lỗi cú pháp -> valid: false, không lưu
  const isValidSyntax = errors.length === 0;

  // 5. Kiểm tra trùng thẻ (Duplicates)
  // Thẻ trùng được lọc ra (không chặn toàn bộ pack nếu cú pháp đúng - Quyết định 14.9)
  const duplicates = [];
  const uniqueCards = [];
  const seenHashesInThisPack = new Set();

  for (const card of cards) {
    const hash = card.id;
    if (seenHashesInThisPack.has(hash)) {
      duplicates.push({
        id: hash,
        en: card.en,
        line: card.line,
        cardIndex: card.cardIndex,
        reason: 'in-pack'
      });
    } else if (existingSet.has(hash)) {
      duplicates.push({
        id: hash,
        en: card.en,
        line: card.line,
        cardIndex: card.cardIndex,
        reason: 'existing'
      });
    } else {
      seenHashesInThisPack.add(hash);
      uniqueCards.push(card);
    }
  }

  return {
    valid: isValidSyntax,
    meta,
    errors,
    cards,
    uniqueCards,
    duplicates,
    duplicateCount: duplicates.length,
    savedCount: uniqueCards.length
  };
}
