import { validateCards } from '../../shared/validate.js';
import { generatePackId } from '../../shared/hash.js';
import { gistGetPacks, gistSavePacks } from '../../src/lib/storage/gist.js';

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
 * Đọc cấu hình Gist từ HTTP headers, EdgeOne context.env, globalThis hoặc process.env
 * @param {any} [context]
 * @returns {{ enabled: boolean, token: string, gistId: string }}
 */
export function resolveGistEnv(context = {}) {
  let token = '';
  let gistId = '';

  // 1. Headers (nếu client hoặc proxy truyền qua headers)
  if (context?.request?.headers) {
    token = context.request.headers.get('x-gist-token') || '';
    gistId = context.request.headers.get('x-gist-id') || '';
  }

  // 2. context.env (EdgeOne environment variables)
  if (context?.env) {
    if (!token) token = context.env.GITHUB_TOKEN || context.env.GIST_TOKEN || '';
    if (!gistId) gistId = context.env.GIST_ID || '';
  }

  // 3. Fallback sang globalThis
  if (typeof globalThis !== 'undefined') {
    if (!token) token = globalThis.GITHUB_TOKEN || globalThis.GIST_TOKEN || '';
    if (!gistId) gistId = globalThis.GIST_ID || '';
  }

  // 4. Fallback sang process.env (Node dev server)
  if (typeof process !== 'undefined' && process?.env) {
    if (!token) token = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN || '';
    if (!gistId) gistId = process.env.GIST_ID || '';
  }

  return {
    enabled: Boolean(token && gistId),
    token: (token || '').trim(),
    gistId: (gistId || '').trim()
  };
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
 * Thu thập tất cả card hashes đã có từ index và Gist
 * @param {any} [context]
 * @returns {Promise<Set<string>>}
 */
export async function getAllExistingCardHashes(context = {}) {
  const set = new Set();
  const allPacks = await getAllPacks(context);
  for (const pack of allPacks) {
    if (Array.isArray(pack.cards)) {
      for (const c of pack.cards) {
        if (c.id) set.add(c.id);
        if (c.hash) set.add(c.hash);
      }
    }
  }
  return set;
}

/**
 * Lấy toàn bộ các packs cùng cards bên trong (hỗ trợ đọc trực tiếp từ GitHub Gist qua context.env)
 * @param {any} [context]
 * @returns {Promise<Array<any>>}
 */
export async function getAllPacks(context = {}) {
  const gistCfg = resolveGistEnv(context);
  let gistPacks = [];

  if (gistCfg.enabled) {
    try {
      const res = await gistGetPacks(gistCfg.token, gistCfg.gistId);
      if (res.ok && Array.isArray(res.packs)) {
        gistPacks = res.packs;
      }
    } catch (e) {
      console.warn('[Store] Lỗi đọc packs từ Gist:', e);
    }
  }

  const index = await getIndex();
  const kvPacks = [];
  for (const meta of index) {
    const pack = await getPack(meta.id, context);
    if (pack) {
      kvPacks.push(pack);
    }
  }

  if (gistPacks.length === 0) return kvPacks;
  if (kvPacks.length === 0) return gistPacks;

  // Hợp nhất (Deduplicate) theo ID
  const packMap = new Map();
  for (const p of gistPacks) {
    if (p && p.id) packMap.set(p.id, p);
  }
  for (const p of kvPacks) {
    if (p && p.id) {
      if (!packMap.has(p.id)) {
        packMap.set(p.id, p);
      } else {
        const existing = packMap.get(p.id);
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const kvTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
        if (kvTime >= existingTime) {
          packMap.set(p.id, p);
        }
      }
    }
  }

  return Array.from(packMap.values());
}

/**
 * Danh sách chủ đề và thống kê số thẻ (đồng bộ với Gist nếu có)
 * @param {any} [context]
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[], level?: string }>>}
 */
export async function listTopics(context = {}) {
  const allPacks = await getAllPacks(context);
  const topicMap = new Map();

  for (const pack of allPacks) {
    const topic = pack.topic || 'General';
    const current = topicMap.get(topic) || {
      topic,
      cardCount: 0,
      packCount: 0,
      tags: new Set(),
      levels: new Set()
    };

    current.cardCount += (pack.cards || []).length || pack.cardCount || 0;
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
 * @param {any} [context]
 * @returns {Promise<Array<any>>}
 */
export async function listPacks(topic = '', context = {}) {
  const allPacks = await getAllPacks(context);
  if (!topic || topic.toLowerCase() === 'all') {
    return allPacks;
  }
  const cleanTopic = topic.trim().toLowerCase();
  return allPacks.filter((p) => (p.topic || '').trim().toLowerCase() === cleanTopic);
}

/**
 * Lấy chi tiết 1 pack theo id
 * @param {string} id
 * @param {any} [context]
 * @returns {Promise<any | null>}
 */
export async function getPack(id, context = {}) {
  if (!id) return null;
  const kv = getKv();
  const pack = await kv.get(`pack:${id}`, 'json');
  if (pack) return pack;

  const gistCfg = resolveGistEnv(context);
  if (gistCfg.enabled) {
    try {
      const res = await gistGetPacks(gistCfg.token, gistCfg.gistId);
      if (res.ok && Array.isArray(res.packs)) {
        const found = res.packs.find((p) => p && p.id === id);
        if (found) return found;
      }
    } catch {}
  }

  return null;
}

/**
 * Tạo pack mới từ chuỗi Markdown (tự động đồng bộ lên Gist nếu cấu hình environment)
 * @param {string} markdown
 * @param {any} [context]
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
export async function createPackFromMarkdown(markdown = '', context = {}) {
  const existingHashes = await getAllExistingCardHashes(context);
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
    createdAt: now,
    updatedAt: now
  };

  // 1. Lưu vào KV nếu có
  const kv = getKv();
  try {
    await kv.put(`pack:${packId}`, JSON.stringify(packRecord));
    const index = await getIndex();
    index.unshift({
      id: packId,
      topic,
      tags: validation.meta.tags || [],
      level: validation.meta.level || '',
      cardCount: validation.uniqueCards.length,
      cardHashes: validation.uniqueCards.map((c) => c.id),
      createdAt: now,
      updatedAt: now
    });
    await saveIndex(index);
  } catch (kvErr) {
    console.warn('[Store] Không thể lưu KV:', kvErr);
  }

  // 2. Lưu vào GitHub Gist nếu có environment variables
  const gistCfg = resolveGistEnv(context);
  if (gistCfg.enabled) {
    try {
      const gRes = await gistGetPacks(gistCfg.token, gistCfg.gistId);
      const packs = (gRes.ok && Array.isArray(gRes.packs)) ? gRes.packs : [];
      const existIdx = packs.findIndex((p) => p.id === packId);
      if (existIdx >= 0) packs[existIdx] = packRecord;
      else packs.unshift(packRecord);
      await gistSavePacks(gistCfg.token, gistCfg.gistId, packs);
    } catch (gErr) {
      console.warn('[Store] Lỗi lưu lên Gist:', gErr);
    }
  }

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
 * Xoá một pack theo id (xoá cả trên KV và Gist)
 * @param {string} packId
 * @param {any} [context]
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deletePack(packId, context = {}) {
  if (!packId) return { success: false, id: packId };
  const kv = getKv();
  try {
    await kv.delete(`pack:${packId}`);
    const index = await getIndex();
    const newIndex = index.filter((p) => p.id !== packId);
    await saveIndex(newIndex);
  } catch {}

  const gistCfg = resolveGistEnv(context);
  if (gistCfg.enabled) {
    try {
      const gRes = await gistGetPacks(gistCfg.token, gistCfg.gistId);
      if (gRes.ok && Array.isArray(gRes.packs)) {
        const filtered = gRes.packs.filter((p) => p.id !== packId);
        await gistSavePacks(gistCfg.token, gistCfg.gistId, filtered);
      }
    } catch (e) {
      console.warn('[Store] Lỗi xoá pack trên Gist:', e);
    }
  }

  return { success: true, id: packId };
}

/**
 * Xoá 1 card cụ thể khỏi 1 pack (cập nhật KV và Gist)
 * @param {string} packId
 * @param {string} cardId
 * @param {any} [context]
 * @returns {Promise<{ success: boolean, packId: string, cardId: string, remainingCards: number }>}
 */
export async function deleteCardFromPack(packId, cardId, context = {}) {
  const pack = await getPack(packId, context);
  if (!pack) {
    return { success: false, packId, cardId, message: 'Pack không tồn tại' };
  }

  const updatedCards = (pack.cards || []).filter((c) => c.id !== cardId);

  // Nếu pack không còn thẻ nào -> xoá luôn pack
  if (updatedCards.length === 0) {
    await deletePack(packId, context);
    return { success: true, packId, cardId, remainingCards: 0, packDeleted: true };
  }

  pack.cards = updatedCards;
  pack.updatedAt = new Date().toISOString();

  const kv = getKv();
  try {
    await kv.put(`pack:${packId}`, JSON.stringify(pack));
    const index = await getIndex();
    const item = index.find((p) => p.id === packId);
    if (item) {
      item.cardCount = updatedCards.length;
      item.cardHashes = updatedCards.map((c) => c.id);
      item.updatedAt = pack.updatedAt;
      await saveIndex(index);
    }
  } catch {}

  const gistCfg = resolveGistEnv(context);
  if (gistCfg.enabled) {
    try {
      const gRes = await gistGetPacks(gistCfg.token, gistCfg.gistId);
      if (gRes.ok && Array.isArray(gRes.packs)) {
        const idx = gRes.packs.findIndex((p) => p.id === packId);
        if (idx >= 0) {
          gRes.packs[idx] = pack;
          await gistSavePacks(gistCfg.token, gistCfg.gistId, gRes.packs);
        }
      }
    } catch (e) {
      console.warn('[Store] Lỗi cập nhật card trên Gist:', e);
    }
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
