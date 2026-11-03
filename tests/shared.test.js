import { describe, it, expect } from 'vitest';
import { normalizeEnText, fnv1a32, generateCardId, generatePackId } from '../shared/hash.js';
import { extractFrontMatter, extractLinksFromText, parseCards } from '../shared/parseCards.js';
import { validateCards, ERROR_CODES } from '../shared/validate.js';
import { exportPacksToMarkdown, reconstructMarkedText } from '../shared/exportMarkdown.js';

describe('shared/hash.js', () => {
  it('normalizes English text correctly', () => {
    expect(normalizeEnText('  Hello,   World!  ')).toBe('hello, world');
    expect(normalizeEnText('"A saga is a sequence."')).toBe('a saga is a sequence');
  });

  it('produces consistent 8-character hex hash', () => {
    const h1 = fnv1a32('hello world');
    const h2 = fnv1a32('hello world');
    const h3 = fnv1a32('different text');
    expect(h1).toHaveLength(8);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('generates consistent card IDs', () => {
    const id1 = generateCardId('  A saga is a sequence.  ');
    const id2 = generateCardId('a saga is a sequence');
    expect(id1).toBe(id2);
    expect(id1.startsWith('c_')).toBe(true);
  });
});

describe('shared/parseCards.js', () => {
  it('extracts YAML front matter', () => {
    const md = `---
topic: Microservices
tags: [saga, distributed]
level: B1
---
en: Test
vi: Thử
`;
    const { frontMatter, body } = extractFrontMatter(md);
    expect(frontMatter.topic).toBe('Microservices');
    expect(frontMatter.tags).toEqual(['saga', 'distributed']);
    expect(frontMatter.level).toBe('B1');
    expect(body.includes('en: Test')).toBe(true);
  });

  it('extracts marked links correctly and calculates offsets', () => {
    const raw = 'A saga is a [sequence]{1} of [local transactions]{2}.';
    const { cleanText, links } = extractLinksFromText(raw);
    expect(cleanText).toBe('A saga is a sequence of local transactions.');
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      id: 1,
      start: 12,
      end: 20,
      text: 'sequence'
    });
    expect(links[1]).toEqual({
      id: 2,
      start: 24,
      end: 42,
      text: 'local transactions'
    });
  });

  it('parses multi-card markdown with notes and paired links', () => {
    const md = `---
topic: Microservices
tags: [saga]
level: B1
---

en: A saga is a [sequence]{1} of [local transactions]{2}.
vi: Saga là một [chuỗi]{1} [giao dịch cục bộ]{2}.
note: Mỗi giao dịch có một bước bù trừ đi kèm.

en: If a step fails, the saga [runs]{1} [compensating transactions]{2}.
vi: Nếu một bước thất bại, saga sẽ [chạy]{1} [các giao dịch bù trừ]{2}.
`;
    const result = parseCards(md);
    expect(result.meta.topic).toBe('Microservices');
    expect(result.cards).toHaveLength(2);

    const c1 = result.cards[0];
    expect(c1.en).toBe('A saga is a sequence of local transactions.');
    expect(c1.vi).toBe('Saga là một chuỗi giao dịch cục bộ.');
    expect(c1.note).toBe('Mỗi giao dịch có một bước bù trừ đi kèm.');
    expect(c1.links).toHaveLength(2);
    expect(c1.links[0].id).toBe(1);
    expect(c1.links[0].enText).toBe('sequence');
    expect(c1.links[0].viText).toBe('chuỗi');
  });
});

describe('shared/validate.js', () => {
  it('fails if topic is missing', () => {
    const md = `---
level: B1
---
en: Hello
vi: Xin chào
`;
    const res = validateCards(md);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === ERROR_CODES.MISSING_TOPIC)).toBe(true);
  });

  it('fails if brackets are invalid or link is empty', () => {
    const emptyLinkMd = `---
topic: Test
---
en: An []{1} empty link.
vi: Một []{1} cụm rỗng.
`;
    const res = validateCards(emptyLinkMd);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === ERROR_CODES.LINK_EMPTY)).toBe(true);

    const strayBracketMd = `---
topic: Test
---
en: Stray [ bracket here.
vi: Dấu ngoặc lạc lõng.
`;
    const res2 = validateCards(strayBracketMd);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.code === ERROR_CODES.BRACKET_INVALID)).toBe(true);
  });

  it('fails if link is unpaired or duplicate ID occurs in one line', () => {
    const unpairedMd = `---
topic: Test
---
en: A [step]{1} without vi pair.
vi: Một bước không có cặp.
`;
    const res = validateCards(unpairedMd);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === ERROR_CODES.LINK_UNPAIRED)).toBe(true);

    const dupIdMd = `---
topic: Test
---
en: A [step]{1} and another [step]{1}.
vi: Một [bước]{1} và [bước]{1} khác.
`;
    const res2 = validateCards(dupIdMd);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.code === ERROR_CODES.LINK_DUPLICATE_ID)).toBe(true);
  });

  it('filters duplicates without blocking valid unique cards (Decision 14.9)', () => {
    const md = `---
topic: Test
---
en: The first unique card.
vi: Thẻ độc nhất thứ nhất.

en: The second card to be duplicated.
vi: Thẻ thứ hai sẽ bị trùng.

en: The second card to be duplicated.
vi: Thẻ thứ hai bị lặp lại trong cùng pack.
`;
    const res = validateCards(md);
    expect(res.valid).toBe(true);
    expect(res.savedCount).toBe(2);
    expect(res.duplicateCount).toBe(1);
    expect(res.duplicates[0].reason).toBe('in-pack');
  });

  it('detects duplicates against existing hashes set', () => {
    const existingId = generateCardId('Existing English card');
    const md = `---
topic: Test
---
en: Existing English card.
vi: Thẻ tiếng Anh đã có từ trước.

en: Brand new card.
vi: Thẻ hoàn toàn mới.
`;
    const res = validateCards(md, [existingId]);
    expect(res.valid).toBe(true);
    expect(res.savedCount).toBe(1);
    expect(res.duplicateCount).toBe(1);
    expect(res.duplicates[0].reason).toBe('existing');
  });
});

describe('shared/exportMarkdown.js', () => {
  it('reconstructs markdown from packs data correctly', () => {
    const packs = [
      {
        topic: 'Microservices',
        tags: ['distributed'],
        level: 'B1',
        cards: [
          {
            en: 'A saga is a sequence of local transactions.',
            vi: 'Saga là một chuỗi giao dịch cục bộ.',
            note: 'Ghi chú bù trừ',
            links: [
              { id: 1, enStart: 12, enEnd: 20, viStart: 12, viEnd: 17 },
              { id: 2, enStart: 24, enEnd: 42, viStart: 18, viEnd: 34 }
            ]
          }
        ]
      }
    ];

    const exported = exportPacksToMarkdown(packs);
    expect(exported).toContain('topic: Microservices');
    expect(exported).toContain('[sequence]{1}');
    expect(exported).toContain('[local transactions]{2}');
    expect(exported).toContain('[chuỗi]{1}');
    expect(exported).toContain('[giao dịch cục bộ]{2}');
    expect(exported).toContain('note: Ghi chú bù trừ');
  });
});
