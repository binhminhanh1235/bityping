const API_BASE = '/api';

/**
 * Lấy danh sách topics từ server
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[] }>>}
 */
export async function fetchTopics() {
  try {
    const res = await fetch(`${API_BASE}/topics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.topics || [];
  } catch (err) {
    console.warn('[API] Lỗi lấy danh sách topics:', err);
    return [];
  }
}

/**
 * Lấy danh sách packs hoặc toàn bộ packs
 * @param {object} [params={}]
 * @param {string} [params.topic]
 * @param {boolean} [params.all]
 * @param {boolean} [params.isExport]
 * @returns {Promise<any>}
 */
export async function fetchPacks({ topic = '', all = false, isExport = false } = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (topic && topic !== 'all') searchParams.set('topic', topic);
    if (all) searchParams.set('all', '1');
    if (isExport) searchParams.set('export', '1');

    const queryStr = searchParams.toString();
    const url = `${API_BASE}/packs${queryStr ? '?' + queryStr : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] Lỗi lấy danh sách packs:', err);
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
    const res = await fetch(`${API_BASE}/packs/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.pack || null;
  } catch (err) {
    console.warn(`[API] Lỗi lấy pack ${id}:`, err);
    return null;
  }
}

/**
 * Validate nội dung markdown mà không lưu
 * @param {string} markdown
 * @returns {Promise<any>}
 */
export async function validateMarkdown(markdown) {
  try {
    const res = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });
    return await res.json();
  } catch (err) {
    return {
      valid: false,
      errors: [{ code: 'NETWORK_ERROR', message: 'Lỗi kết nối tới máy chủ: ' + err.message }]
    };
  }
}

/**
 * Lưu pack mới từ Markdown
 * @param {string} markdown
 * @returns {Promise<{ success: boolean, packId?: string, topic?: string, savedCount?: number, duplicateCount?: number, duplicates?: any[], errors?: any[] }>}
 */
export async function savePackMarkdown(markdown) {
  try {
    const res = await fetch(`${API_BASE}/packs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      errors: [{ code: 'NETWORK_ERROR', message: 'Lỗi kết nối khi lưu pack: ' + err.message }]
    };
  }
}

/**
 * Xoá một pack
 * @param {string} packId
 * @returns {Promise<{ success: boolean, id: string }>}
 */
export async function deletePack(packId) {
  try {
    const res = await fetch(`${API_BASE}/packs/${packId}`, {
      method: 'DELETE'
    });
    return await res.json();
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
    const res = await fetch(`${API_BASE}/packs/${packId}?cardId=${cardId}`, {
      method: 'DELETE'
    });
    return await res.json();
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
    const res = await fetch(`${API_BASE}/packs?export=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.markdown || '';
  } catch (err) {
    console.warn('[API] Lỗi xuất markdown:', err);
    return '';
  }
}

/**
 * Dựng lại index từ KV
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
