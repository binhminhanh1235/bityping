/**
 * EdgeOne KV Storage Adapter for TypeLearn
 * Kết nối tới REST API chạy trên Tencent EdgeOne Pages Edge Functions
 */

const API_BASE = '/api';

function getUrl(path) {
  if (typeof window !== 'undefined') return path;
  return `http://localhost${path}`;
}

/**
 * Kiểm tra kết nối tới EdgeOne API và KV
 * @returns {Promise<{ ok: boolean, status?: string }>}
 */
export async function edgeoneCheckHealth() {
  try {
    const res = await fetch(getUrl(`${API_BASE}/topics`), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return { ok: false, status: `HTTP ${res.status}` };
    }
    return { ok: true, status: 'Connected' };
  } catch (err) {
    return { ok: false, status: err.name === 'TimeoutError' ? 'Timeout' : err.message };
  }
}

/**
 * Lấy toàn bộ packs từ EdgeOne KV
 * @returns {Promise<Array<any>>}
 */
export async function edgeoneGetAllPacks() {
  try {
    const res = await fetch(getUrl(`${API_BASE}/packs?all=1`), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.packs) ? data.packs : [];
  } catch (e) {
    console.warn('[EdgeOne Storage] Lỗi lấy danh sách packs:', e);
    return [];
  }
}

/**
 * Lưu pack mới qua API EdgeOne
 * @param {string} markdown
 * @returns {Promise<any>}
 */
export async function edgeoneSaveMarkdown(markdown) {
  try {
    const res = await fetch(getUrl(`${API_BASE}/packs`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });
    return await res.json();
  } catch (err) {
    return { success: false, errors: [{ code: 'EDGEONE_ERROR', message: err.message }] };
  }
}

/**
 * Xoá pack trên EdgeOne
 * @param {string} packId
 * @returns {Promise<boolean>}
 */
export async function edgeoneDeletePack(packId) {
  try {
    const res = await fetch(getUrl(`${API_BASE}/packs/${packId}`), { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * Xoá thẻ lẻ trên EdgeOne
 * @param {string} packId
 * @param {string} cardId
 * @returns {Promise<any>}
 */
export async function edgeoneDeleteCard(packId, cardId) {
  try {
    const res = await fetch(getUrl(`${API_BASE}/packs/${packId}?cardId=${cardId}`), { method: 'DELETE' });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}
