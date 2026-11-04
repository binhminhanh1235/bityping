import {
  getAggregatedTopics,
  getAggregatedPacks,
  getPackById as storageGetPackById,
  savePackMarkdown as storageSavePackMarkdown,
  deletePack as storageDeletePack,
  deleteCard as storageDeleteCard,
  exportAllMarkdown as storageExportAllMarkdown,
  syncAllStorages as storageSyncAll,
  getStorageConfig,
  saveStorageConfig
} from './storage/index.js';
import { validateCards } from '../../shared/validate.js';

const API_BASE = '/api';

/**
 * Lấy danh sách topics từ hệ thống lưu trữ đa nguồn
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[] }>>}
 */
export async function fetchTopics() {
  try {
    return await getAggregatedTopics();
  } catch (err) {
    console.warn('[API] Lỗi lấy danh sách topics đa nguồn:', err);
    return [];
  }
}

/**
 * Lấy danh sách packs từ hệ thống lưu trữ đa nguồn
 * @param {object} [params={}]
 * @param {string} [params.topic]
 * @param {boolean} [params.all]
 * @param {boolean} [params.isExport]
 * @returns {Promise<any>}
 */
export async function fetchPacks({ topic = '', all = false, isExport = false } = {}) {
  try {
    if (isExport) {
      const markdown = await storageExportAllMarkdown();
      return { markdown };
    }
    return await getAggregatedPacks({ topic, all });
  } catch (err) {
    console.warn('[API] Lỗi lấy danh sách packs đa nguồn:', err);
    return { packs: [] };
  }
}

/**
 * Lấy chi tiết một pack theo id
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function fetchPackById(id) {
  try {
    return await storageGetPackById(id);
  } catch (err) {
    console.warn(`[API] Lỗi lấy pack ${id}:`, err);
    return null;
  }
}

/**
 * Validate nội dung markdown (Offline-first, không phụ thuộc server)
 * @param {string} markdown
 * @returns {Promise<any>}
 */
export async function validateMarkdown(markdown) {
  try {
    const result = validateCards(markdown, new Set());
    return {
      valid: result.valid,
      errors: result.errors,
      meta: result.meta,
      cards: result.cards,
      duplicateCount: result.duplicateCount,
      duplicates: result.duplicates
    };
  } catch (err) {
    return {
      valid: false,
      errors: [{ code: 'VALIDATE_ERROR', message: 'Lỗi kiểm tra cú pháp: ' + err.message }]
    };
  }
}

/**
 * Lưu pack mới từ Markdown (Write-Through vào các Storage đang bật)
 * @param {string} markdown
 * @returns {Promise<{ success: boolean, packId?: string, topic?: string, savedCount?: number, duplicateCount?: number, duplicates?: any[], errors?: any[], sources?: string[] }>}
 */
export async function savePackMarkdown(markdown) {
  try {
    return await storageSavePackMarkdown(markdown);
  } catch (err) {
    return {
      success: false,
      errors: [{ code: 'STORAGE_ERROR', message: 'Lỗi khi lưu pack: ' + err.message }]
    };
  }
}

/**
 * Xoá một pack khỏi tất cả các storage
 * @param {string} packId
 * @returns {Promise<{ success: boolean, id: string, error?: string }>}
 */
export async function deletePack(packId) {
  try {
    return await storageDeletePack(packId);
  } catch (err) {
    return { success: false, id: packId, error: err.message };
  }
}

/**
 * Xoá một card khỏi pack
 * @param {string} packId
 * @param {string} cardId
 * @returns {Promise<any>}
 */
export async function deleteCard(packId, cardId) {
  try {
    return await storageDeleteCard(packId, cardId);
  } catch (err) {
    return { success: false, packId, cardId, error: err.message };
  }
}

/**
 * Xuất toàn bộ nội dung markdown
 * @returns {Promise<string>}
 */
export async function exportAllMarkdown() {
  try {
    return await storageExportAllMarkdown();
  } catch (err) {
    console.warn('[API] Lỗi xuất markdown:', err);
    return '';
  }
}

/**
 * Đồng bộ hai chiều toàn bộ dữ liệu giữa các kho lưu trữ
 * @returns {Promise<{ success: boolean, syncedCount: number, error?: string, timestamp: string }>}
 */
export async function syncStorages() {
  return await storageSyncAll();
}

/**
 * Re-export storage config getters/setters cho Settings UI
 */
export { getStorageConfig, saveStorageConfig };

/**
 * Dựng lại index từ KV (EdgeOne API)
 * @returns {Promise<any>}
 */
export async function rebuildIndex() {
  try {
    const res = await fetch(`${API_BASE}/rebuild-index`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}
