/**
 * MultiStorageManager
 * Điều phối lưu trữ đa nguồn (Local IndexedDB, GitHub Gist, EdgeOne KV)
 * Hỗ trợ Aggregated View, Write-through sync và Bi-directional Reconciliation
 */

import {
  idbGetAllPacks,
  idbGetPack,
  idbSavePack,
  idbSaveMultiplePacks,
  idbDeletePack
} from './idb.js';
import {
  gistGetPacks,
  gistSavePacks,
  gistFindOrCreate,
  gistVerifyToken
} from './gist.js';
import {
  edgeoneGetAllPacks,
  edgeoneSaveMarkdown,
  edgeoneDeletePack,
  edgeoneDeleteCard,
  edgeoneCheckHealth
} from './edgeone.js';
import { getStarterPacks } from '../../data/starterPacks.js';
import { validateCards } from '../../../shared/validate.js';
import { generatePackId } from '../../../shared/hash.js';
import { exportPacksToMarkdown } from '../../../shared/exportMarkdown.js';

const STORAGE_CONFIG_KEY = 'bityping_storage_config';

let memoryConfig = null;

const DEFAULT_CONFIG = {
  local: {
    enabled: true
  },
  gist: {
    enabled: false,
    token: '',
    gistId: '',
    lastSync: null
  },
  edgeone: {
    enabled: true,
    lastSync: null
  }
};

/**
 * Đọc cấu hình lưu trữ an toàn (hỗ trợ fallback in-memory)
 * @returns {typeof DEFAULT_CONFIG}
 */
export function getStorageConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          local: { ...DEFAULT_CONFIG.local, ...(parsed.local || {}) },
          gist: { ...DEFAULT_CONFIG.gist, ...(parsed.gist || {}) },
          edgeone: { ...DEFAULT_CONFIG.edgeone, ...(parsed.edgeone || {}) }
        };
      }
    }
  } catch {}

  if (memoryConfig) return { ...memoryConfig };
  return { ...DEFAULT_CONFIG };
}

/**
 * Cập nhật cấu hình lưu trữ
 * @param {Partial<typeof DEFAULT_CONFIG>} partial
 * @returns {typeof DEFAULT_CONFIG}
 */
export function saveStorageConfig(partial) {
  const current = getStorageConfig();
  const updated = {
    ...current,
    ...partial,
    local: { ...current.local, ...(partial.local || {}) },
    gist: { ...current.gist, ...(partial.gist || {}) },
    edgeone: { ...current.edgeone, ...(partial.edgeone || {}) }
  };
  memoryConfig = updated;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[Storage] Lỗi lưu cấu hình:', e);
  }
  return updated;
}

/**
 * Khởi tạo dữ liệu mặc định ban đầu nếu Local IDB còn rỗng
 */
let isSeeded = false;
async function ensureLocalSeeded() {
  if (isSeeded) return;
  try {
    const existing = await idbGetAllPacks();
    if (!existing || existing.length === 0) {
      const starters = getStarterPacks();
      await idbSaveMultiplePacks(starters);
    }
    isSeeded = true;
  } catch (e) {
    console.warn('[Storage] Lỗi seed starter packs:', e);
  }
}

/**
 * Lấy danh sách packs tổng hợp từ tất cả các storage đang kích hoạt
 * @param {object} [options={}]
 * @param {string} [options.topic]
 * @param {boolean} [options.all]
 * @returns {Promise<{ packs: Array<any> }>}
 */
export async function getAggregatedPacks({ topic = '', all = false } = {}) {
  const config = getStorageConfig();
  const packMap = new Map(); // id -> pack

  // 1. Local IndexedDB
  if (config.local.enabled) {
    await ensureLocalSeeded();
    try {
      const localPacks = await idbGetAllPacks();
      for (const p of localPacks) {
        if (!p || !p.id) continue;
        packMap.set(p.id, {
          ...p,
          sources: ['local']
        });
      }
    } catch (e) {
      console.warn('[Storage] Lỗi đọc từ Local IDB:', e);
    }
  }

  // 2. GitHub Gist
  if (config.gist.enabled && config.gist.token && config.gist.gistId) {
    try {
      const res = await gistGetPacks(config.gist.token, config.gist.gistId);
      if (res.ok && Array.isArray(res.packs)) {
        for (const p of res.packs) {
          if (!p || !p.id) continue;
          if (packMap.has(p.id)) {
            const existing = packMap.get(p.id);
            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const gistTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
            const sources = Array.from(new Set([...(existing.sources || []), 'gist']));

            if (gistTime > existingTime) {
              packMap.set(p.id, { ...p, sources });
            } else {
              packMap.set(p.id, { ...existing, sources });
            }
          } else {
            packMap.set(p.id, {
              ...p,
              sources: ['gist']
            });
          }
        }
      }
    } catch (e) {
      console.warn('[Storage] Lỗi đọc từ Gist:', e);
    }
  }

  // 3. EdgeOne KV
  if (config.edgeone.enabled) {
    try {
      const eoPacks = await edgeoneGetAllPacks();
      for (const p of eoPacks) {
        if (!p || !p.id) continue;
        if (packMap.has(p.id)) {
          const existing = packMap.get(p.id);
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const eoTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
          const sources = Array.from(new Set([...(existing.sources || []), 'edgeone']));

          if (eoTime > existingTime) {
            packMap.set(p.id, { ...p, sources });
          } else {
            packMap.set(p.id, { ...existing, sources });
          }
        } else {
          packMap.set(p.id, {
            ...p,
            sources: ['edgeone']
          });
        }
      }
    } catch (e) {
      console.warn('[Storage] Lỗi đọc từ EdgeOne:', e);
    }
  }

  // Nếu cả 3 storage đều chưa có dữ liệu gì (ví dụ lần đầu mở app)
  if (packMap.size === 0) {
    const starters = getStarterPacks();
    for (const p of starters) {
      packMap.set(p.id, { ...p, sources: ['local'] });
    }
  }

  let list = Array.from(packMap.values());

  // Lọc theo topic nếu có yêu cầu
  if (topic && topic !== 'all') {
    const cleanTopic = topic.trim().toLowerCase();
    list = list.filter((p) => (p.topic || '').trim().toLowerCase() === cleanTopic);
  }

  // Sắp xếp bài mới nhất lên đầu
  list.sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  return { packs: list };
}

/**
 * Lấy chi tiết một pack theo id
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function getPackById(id) {
  if (!id) return null;
  const config = getStorageConfig();

  // Thử Local IDB trước (nhanh nhất)
  if (config.local.enabled) {
    const localPack = await idbGetPack(id);
    if (localPack) return localPack;
  }

  // Thử tìm trong danh sách tổng hợp
  const { packs } = await getAggregatedPacks({ all: true });
  return packs.find((p) => p.id === id) || null;
}

/**
 * Lấy danh sách topics tổng hợp cùng số lượng thẻ
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[] }>>}
 */
export async function getAggregatedTopics() {
  const { packs } = await getAggregatedPacks({ all: true });
  const map = new Map();

  for (const p of packs) {
    const topic = p.topic || 'General';
    const existing = map.get(topic) || {
      topic,
      cardCount: 0,
      packCount: 0,
      tags: new Set()
    };
    existing.cardCount += (p.cards || []).length;
    existing.packCount += 1;
    if (Array.isArray(p.tags)) {
      p.tags.forEach((t) => existing.tags.add(t));
    }
    map.set(topic, existing);
  }

  return Array.from(map.values()).map((item) => ({
    topic: item.topic,
    cardCount: item.cardCount,
    packCount: item.packCount,
    tags: Array.from(item.tags)
  }));
}

/**
 * Thu thập tất cả các card hash hiện có trên toàn hệ thống để chống trùng lặp
 * @returns {Promise<Set<string>>}
 */
async function getAllCardHashes() {
  const { packs } = await getAggregatedPacks({ all: true });
  const set = new Set();
  for (const p of packs) {
    if (Array.isArray(p.cards)) {
      for (const c of p.cards) {
        if (c.id) set.add(c.id);
        if (c.cardHash) set.add(c.cardHash);
      }
    }
  }
  return set;
}

/**
 * Lưu pack mới từ Markdown với chiến lược Write-Through
 * (Ghi đồng thời vào tất cả storage đang bật)
 * @param {string} markdown
 * @returns {Promise<any>}
 */
export async function savePackMarkdown(markdown) {
  const existingHashes = await getAllCardHashes();
  const validation = validateCards(markdown, existingHashes);

  // Lỗi cú pháp
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

  // Toàn bộ thẻ bị trùng lặp
  if (validation.uniqueCards.length === 0) {
    return {
      success: false,
      errors: [
        {
          code: 'ALL_CARDS_DUPLICATE',
          message: 'Tất cả các thẻ trong pack đều đã tồn tại trong các kho lưu trữ'
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

  const config = getStorageConfig();
  const savedSources = [];

  // 1. Write to Local IDB
  if (config.local.enabled) {
    const ok = await idbSavePack(packRecord);
    if (ok) savedSources.push('local');
  }

  // 2. Write to GitHub Gist
  if (config.gist.enabled && config.gist.token && config.gist.gistId) {
    try {
      const currentGist = await gistGetPacks(config.gist.token, config.gist.gistId);
      const existingList = currentGist.ok && Array.isArray(currentGist.packs) ? currentGist.packs : [];
      const updatedList = [packRecord, ...existingList.filter((p) => p.id !== packId)];
      const saveRes = await gistSavePacks(config.gist.token, config.gist.gistId, updatedList);
      if (saveRes.ok) savedSources.push('gist');
    } catch (e) {
      console.warn('[Storage] Ghi Gist thất bại:', e);
    }
  }

  // 3. Write to EdgeOne KV (gọi API server)
  if (config.edgeone.enabled) {
    try {
      const eoRes = await edgeoneSaveMarkdown(markdown);
      if (eoRes && eoRes.success) savedSources.push('edgeone');
    } catch (e) {
      console.warn('[Storage] Ghi EdgeOne thất bại:', e);
    }
  }

  return {
    success: true,
    packId,
    topic,
    tags: packRecord.tags,
    level: packRecord.level,
    savedCount: validation.savedCount,
    duplicateCount: validation.duplicateCount,
    duplicates: validation.duplicates,
    sources: savedSources
  };
}

/**
 * Xoá một pack khỏi tất cả storage đang bật (Write-Through Delete)
 * @param {string} packId
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deletePack(packId) {
  if (!packId) return { success: false, id: packId };
  const config = getStorageConfig();

  // 1. Xoá khỏi Local IDB
  if (config.local.enabled) {
    await idbDeletePack(packId);
  }

  // 2. Xoá khỏi GitHub Gist
  if (config.gist.enabled && config.gist.token && config.gist.gistId) {
    try {
      const currentGist = await gistGetPacks(config.gist.token, config.gist.gistId);
      if (currentGist.ok && Array.isArray(currentGist.packs)) {
        const filtered = currentGist.packs.filter((p) => p.id !== packId);
        await gistSavePacks(config.gist.token, config.gist.gistId, filtered);
      }
    } catch (e) {
      console.warn('[Storage] Xoá trên Gist thất bại:', e);
    }
  }

  // 3. Xoá khỏi EdgeOne KV
  if (config.edgeone.enabled) {
    try {
      await edgeoneDeletePack(packId);
    } catch (e) {
      console.warn('[Storage] Xoá trên EdgeOne thất bại:', e);
    }
  }

  return { success: true, id: packId };
}

/**
 * Xoá một thẻ lẻ khỏi pack
 * @param {string} packId
 * @param {string} cardId
 * @returns {Promise<any>}
 */
export async function deleteCard(packId, cardId) {
  const pack = await getPackById(packId);
  if (!pack) return { success: false, error: 'Không tìm thấy pack' };

  const remainingCards = (pack.cards || []).filter((c) => c.id !== cardId);

  // Nếu hết thẻ -> xoá luôn cả pack
  if (remainingCards.length === 0) {
    await deletePack(packId);
    return { success: true, packDeleted: true };
  }

  const updatedPack = {
    ...pack,
    cards: remainingCards,
    updatedAt: new Date().toISOString()
  };

  const config = getStorageConfig();

  if (config.local.enabled) {
    await idbSavePack(updatedPack);
  }

  if (config.gist.enabled && config.gist.token && config.gist.gistId) {
    try {
      const currentGist = await gistGetPacks(config.gist.token, config.gist.gistId);
      if (currentGist.ok && Array.isArray(currentGist.packs)) {
        const updated = currentGist.packs.map((p) => (p.id === packId ? updatedPack : p));
        await gistSavePacks(config.gist.token, config.gist.gistId, updated);
      }
    } catch {}
  }

  if (config.edgeone.enabled) {
    try {
      await edgeoneDeleteCard(packId, cardId);
    } catch {}
  }

  return { success: true, pack: updatedPack };
}

/**
 * Xuất toàn bộ nội dung Markdown từ tất cả các pack đang có
 * @returns {Promise<string>}
 */
export async function exportAllMarkdown() {
  const { packs } = await getAggregatedPacks({ all: true });
  return exportPacksToMarkdown(packs);
}

/**
 * ĐỒNG BỘ 2 CHIỀU (Bi-directional Reconciliation Sync)
 * Hợp nhất toàn bộ bài học giữa Local IDB, GitHub Gist và EdgeOne KV.
 * Áp dụng nguyên tắc 'latest timestamp wins' đối với các bản ghi cùng ID.
 * @returns {Promise<{ success: boolean, syncedCount: number, error?: string, timestamp: string }>}
 */
export async function syncAllStorages() {
  const config = getStorageConfig();
  const now = new Date().toISOString();

  try {
    // 1. Tải toàn bộ packs từ các nguồn đang bật
    const masterMap = new Map();

    // Nguồn 1: Local IDB
    if (config.local.enabled) {
      await ensureLocalSeeded();
      const localPacks = await idbGetAllPacks();
      for (const p of localPacks) {
        if (p && p.id) masterMap.set(p.id, p);
      }
    }

    // Nguồn 2: GitHub Gist
    if (config.gist.enabled && config.gist.token && config.gist.gistId) {
      const gistRes = await gistGetPacks(config.gist.token, config.gist.gistId);
      if (gistRes.ok && Array.isArray(gistRes.packs)) {
        for (const p of gistRes.packs) {
          if (!p || !p.id) continue;
          if (masterMap.has(p.id)) {
            const existing = masterMap.get(p.id);
            const tExist = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const tGist = new Date(p.updatedAt || p.createdAt || 0).getTime();
            if (tGist > tExist) {
              masterMap.set(p.id, p);
            }
          } else {
            masterMap.set(p.id, p);
          }
        }
      }
    }

    // Nguồn 3: EdgeOne KV
    if (config.edgeone.enabled) {
      const eoPacks = await edgeoneGetAllPacks();
      for (const p of eoPacks) {
        if (!p || !p.id) continue;
        if (masterMap.has(p.id)) {
          const existing = masterMap.get(p.id);
          const tExist = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const tEo = new Date(p.updatedAt || p.createdAt || 0).getTime();
          if (tEo > tExist) {
            masterMap.set(p.id, p);
          }
        } else {
          masterMap.set(p.id, p);
        }
      }
    }

    const unifiedPacks = Array.from(masterMap.values());

    // 2. Ghi đè bộ dữ liệu hợp nhất vào từng storage đang kích hoạt
    // A. Local IDB
    if (config.local.enabled) {
      await idbSaveMultiplePacks(unifiedPacks);
    }

    // B. GitHub Gist
    if (config.gist.enabled && config.gist.token && config.gist.gistId) {
      await gistSavePacks(config.gist.token, config.gist.gistId, unifiedPacks);
    }

    // 3. Cập nhật mốc thời gian sync
    saveStorageConfig({
      gist: { ...config.gist, lastSync: now },
      edgeone: { ...config.edgeone, lastSync: now }
    });

    return {
      success: true,
      syncedCount: unifiedPacks.length,
      timestamp: now
    };
  } catch (err) {
    console.error('[Storage Sync] Lỗi đồng bộ:', err);
    return {
      success: false,
      syncedCount: 0,
      error: err.message,
      timestamp: now
    };
  }
}
