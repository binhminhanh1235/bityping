import { validateCards } from '../../shared/validate.js';
import { generatePackId } from '../../shared/hash.js';

/**
 * In-memory KV fallback giả lập khi chạy dev/test
 */
class MemoryKv {
  constructor() {
    this.map = new Map();
  }

  async get(key, type = 'text') {
    const val = this.map.get(key);
    if (val === undefined || val === null) return null;
    if (type === 'json') {
      try {
        return typeof val === 'string' ? JSON.parse(val) : val;
      } catch {
        return null;
      }
    }
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  }

  async put(key, value) {
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    this.map.set(key, str);
  }

  async delete(key) {
    this.map.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const keys = [];
    for (const k of this.map.keys()) {
      if (!prefix || k.startsWith(prefix)) {
        keys.push({ name: k });
      }
    }
    return {
      complete: true,
      cursor: '',
      keys
    };
  }
}

// Global in-memory KV singleton dùng khi không có Cloud KV
const defaultMemoryKv = new MemoryKv();

/**
 * Lấy đối tượng KV đang khả dụng
 * @returns {any}
 */
export function getKv() {
  if (typeof globalThis !== 'undefined') {
    if (globalThis.my_kv) return globalThis.my_kv;
    if (globalThis.BITYPING_KV) return globalThis.BITYPING_KV;
    if (globalThis.TYPELEARN_KV) return globalThis.TYPELEARN_KV;
    // Khởi tạo globalThis.my_kv bằng singleton fallback
    globalThis.my_kv = defaultMemoryKv;
    return globalThis.my_kv;
  }
  return defaultMemoryKv;
}

/**
 * Đọc index từ KV
 * @returns {Promise<Array<any>>}
 */
export async function getIndex() {
  const kv = getKv();
  const index = await kv.get('index', 'json');
  return Array.isArray(index) ? index : [];
}

/**
 * Ghi lại index vào KV
 * @param {Array<any>} index
 */
export async function saveIndex(index) {
  const kv = getKv();
  await kv.put('index', JSON.stringify(index));
}

/**
 * Thu thập tất cả card hashes đã có từ index
 * @returns {Promise<Set<string>>}
 */
export async function getAllExistingCardHashes() {
  const index = await getIndex();
  const set = new Set();
  for (const item of index) {
    if (Array.isArray(item.cardHashes)) {
      for (const h of item.cardHashes) {
        set.add(h);
      }
    }
  }
  return set;
}

/**
 * Danh sách chủ đề và thống kê số thẻ
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[], level?: string }>>}
 */
export async function listTopics() {
  const index = await getIndex();
  const topicMap = new Map();

  for (const pack of index) {
    const topic = pack.topic || 'General';
    const current = topicMap.get(topic) || {
      topic,
      cardCount: 0,
      packCount: 0,
      tags: new Set(),
      levels: new Set()
    };

    current.cardCount += pack.cardCount || 0;
    current.packCount += 1;
    if (Array.isArray(pack.tags)) {
      pack.tags.forEach((t) => current.tags.add(t));
    }
    if (pack.level) {
      current.levels.add(pack.level);
    }
    topicMap.set(topic, current);
  }

  const result = [];
  for (const t of topicMap.values()) {
    result.push({
      topic: t.topic,
      cardCount: t.cardCount,
      packCount: t.packCount,
      tags: Array.from(t.tags),
      level: Array.from(t.levels).join(', ') || undefined
    });
  }

  result.sort((a, b) => b.cardCount - a.cardCount || a.topic.localeCompare(b.topic));
  return result;
}

/**
 * Lấy danh sách packs, có thể lọc theo topic
 * @param {string} [topic]
 * @returns {Promise<Array<any>>}
 */
export async function listPacks(topic = '') {
  const index = await getIndex();
  if (!topic || topic.toLowerCase() === 'all') {
    return index;
  }
  const cleanTopic = topic.trim().toLowerCase();
  return index.filter((p) => (p.topic || '').trim().toLowerCase() === cleanTopic);
}

/**
 * Lấy chi tiết 1 pack theo id
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getPack(id) {
  if (!id) return null;
  const kv = getKv();
  const pack = await kv.get(`pack:${id}`, 'json');
  return pack || null;
}

/**
 * Lấy toàn bộ các packs cùng cards bên trong (cho export hoặc sync client)
 * @returns {Promise<Array<any>>}
 */
export async function getAllPacks() {
  const index = await getIndex();
  const packs = [];
  for (const meta of index) {
    const pack = await getPack(meta.id);
    if (pack) {
      packs.push(pack);
    }
  }
  return packs;
}

/**
 * Tạo pack mới từ chuỗi Markdown
 * @param {string} markdown
 * @returns {Promise<{
 *   success: boolean,
 *   packId?: string,
 *   topic?: string,
 *   tags?: string[],
 *   level?: string,
 *   savedCount?: number,
 *   duplicateCount?: number,
 *   duplicates?: Array<any>,
 *   errors?: Array<any>,
 *   message?: string
 * }>}
 */
export async function createPackFromMarkdown(markdown = '') {
  const existingHashes = await getAllExistingCardHashes();
  const validation = validateCards(markdown, existingHashes);

  // Nếu có lỗi cú pháp -> từ chối hoàn toàn
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  // Nếu không có thẻ nào mới (tất cả đều bị trùng)
  if (validation.uniqueCards.length === 0) {
    return {
      success: false,
      errors: [
        {
          code: 'ALL_CARDS_DUPLICATE',
          message: 'Tất cả các thẻ trong pack đều đã tồn tại trong hệ thống'
        }
      ],
      duplicateCount: validation.duplicateCount,
      duplicates: validation.duplicates,
      savedCount: 0
    };
  }

  const topic = validation.meta.topic || 'General';
  const packId = generatePackId(topic);
  const now = new Date().toISOString();

  const packRecord = {
    id: packId,
    topic,
    tags: validation.meta.tags || [],
    level: validation.meta.level || '',
    cards: validation.uniqueCards,
    createdAt: now
  };

  const kv = getKv();
  await kv.put(`pack:${packId}`, JSON.stringify(packRecord));

  // Cập nhật index
  const index = await getIndex();
  index.unshift({
    id: packId,
    topic,
    tags: validation.meta.tags || [],
    level: validation.meta.level || '',
    cardCount: validation.uniqueCards.length,
    cardHashes: validation.uniqueCards.map((c) => c.id),
    createdAt: now
  });
  await saveIndex(index);

  return {
    success: true,
    packId,
    topic,
    tags: validation.meta.tags || [],
    level: validation.meta.level || '',
    savedCount: validation.uniqueCards.length,
    duplicateCount: validation.duplicateCount,
    duplicates: validation.duplicates
  };
}

/**
 * Xoá một pack theo id
 * @param {string} packId
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deletePack(packId) {
  if (!packId) return { success: false, id: packId };
  const kv = getKv();
  await kv.delete(`pack:${packId}`);

  const index = await getIndex();
  const newIndex = index.filter((p) => p.id !== packId);
  await saveIndex(newIndex);

  return { success: true, id: packId };
}

/**
 * Xoá 1 card cụ thể khỏi 1 pack
 * @param {string} packId
 * @param {string} cardId
 * @returns {Promise<{ success: boolean, packId: string, cardId: string, remainingCards: number }>}
 */
export async function deleteCardFromPack(packId, cardId) {
  const pack = await getPack(packId);
  if (!pack) {
    return { success: false, packId, cardId, message: 'Pack không tồn tại' };
  }

  const updatedCards = (pack.cards || []).filter((c) => c.id !== cardId);

  // Nếu pack không còn thẻ nào -> xoá luôn pack
  if (updatedCards.length === 0) {
    await deletePack(packId);
    return { success: true, packId, cardId, remainingCards: 0, packDeleted: true };
  }

  pack.cards = updatedCards;
  const kv = getKv();
  await kv.put(`pack:${packId}`, JSON.stringify(pack));

  // Cập nhật index
  const index = await getIndex();
  const item = index.find((p) => p.id === packId);
  if (item) {
    item.cardCount = updatedCards.length;
    item.cardHashes = updatedCards.map((c) => c.id);
    await saveIndex(index);
  }

  return {
    success: true,
    packId,
    cardId,
    remainingCards: updatedCards.length,
    packDeleted: false
  };
}

/**
 * Dựng lại index bằng cách quét toàn bộ key pack:*
 * @returns {Promise<{ success: boolean, count: number }>}
 */
export async function rebuildIndex() {
  const kv = getKv();
  const listResult = await kv.list({ prefix: 'pack:' });
  const keys = listResult.keys || [];

  const newIndex = [];

  for (const k of keys) {
    const raw = await kv.get(k.name, 'json');
    if (raw && raw.id) {
      newIndex.push({
        id: raw.id,
        topic: raw.topic || 'General',
        tags: raw.tags || [],
        level: raw.level || '',
        cardCount: Array.isArray(raw.cards) ? raw.cards.length : 0,
        cardHashes: Array.isArray(raw.cards) ? raw.cards.map((c) => c.id) : [],
        createdAt: raw.createdAt || new Date().toISOString()
      });
    }
  }

  // Sắp xếp theo ngày tạo mới nhất lên trước
  newIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  await saveIndex(newIndex);

  return {
    success: true,
    count: newIndex.length
  };
}
