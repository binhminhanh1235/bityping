/**
 * GitHub Gist Storage Adapter for TypeLearn
 * Hoàn toàn miễn phí, lưu trữ vĩnh viễn, bảo mật bằng Personal Access Token (PAT).
 */

const GIST_FILENAME = 'typelearn-data.json';
const GIST_DESCRIPTION = 'TypeLearn Knowledge Typing Packs (Private Backup)';

/**
 * Tạo headers chuẩn cho GitHub API request
 * @param {string} token
 * @returns {Record<string, string>}
 */
function makeHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json'
  };
  // EdgeOne V8 isolate / Node.js requires a User-Agent header for GitHub API requests
  if (typeof window === 'undefined') {
    headers['User-Agent'] = 'TypeLearn-App';
  }
  return headers;
}

/**
 * Kiểm tra kết nối tới GitHub Token và lấy thông tin user
 * @param {string} token
 * @returns {Promise<{ ok: boolean, user?: string, error?: string }>}
 */
export async function gistVerifyToken(token) {
  if (!token || !token.trim()) {
    return { ok: false, error: 'Chưa nhập GitHub Token' };
  }
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: makeHeaders(token)
    });
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: 'Token không hợp lệ hoặc đã hết hạn' };
      return { ok: false, error: `GitHub API HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, user: data.login };
  } catch (err) {
    return { ok: false, error: `Lỗi kết nối: ${err.message}` };
  }
}

/**
 * Tự động tìm Gist có sẵn hoặc tạo mới nếu chưa có
 * @param {string} token
 * @param {string} [gistId]
 * @returns {Promise<{ ok: boolean, gistId?: string, isNew?: boolean, error?: string }>}
 */
export async function gistFindOrCreate(token, gistId = '') {
  const verify = await gistVerifyToken(token);
  if (!verify.ok) return { ok: false, error: verify.error };

  const cleanGistId = (gistId || '').trim();

  // 1. Nếu người dùng đã cung cấp Gist ID cụ thể
  if (cleanGistId) {
    try {
      const res = await fetch(`https://api.github.com/gists/${cleanGistId}`, {
        headers: makeHeaders(token)
      });
      if (res.ok) {
        return { ok: true, gistId: cleanGistId, isNew: false };
      }
      if (res.status === 404) {
        return { ok: false, error: `Không tìm thấy Gist với ID: ${cleanGistId}` };
      }
      return { ok: false, error: `Lỗi đọc Gist (HTTP ${res.status})` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // 2. Nếu không có Gist ID, tìm kiếm trong danh sách Gists của user
  try {
    const listRes = await fetch('https://api.github.com/gists?per_page=30', {
      headers: makeHeaders(token)
    });
    if (listRes.ok) {
      const gists = await listRes.json();
      const existing = gists.find(
        (g) => g.files && (g.files[GIST_FILENAME] || g.description === GIST_DESCRIPTION)
      );
      if (existing) {
        return { ok: true, gistId: existing.id, isNew: false };
      }
    }

    // 3. Nếu chưa có, tạo Secret Gist mới
    const initialPayload = {
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(
            {
              version: 1,
              updatedAt: new Date().toISOString(),
              packs: []
            },
            null,
            2
          )
        }
      }
    };

    const createRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify(initialPayload)
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      return { ok: false, error: errData.message || `Lỗi tạo Gist HTTP ${createRes.status}` };
    }

    const createdData = await createRes.json();
    return { ok: true, gistId: createdData.id, isNew: true };
  } catch (err) {
    return { ok: false, error: `Lỗi khởi tạo Gist: ${err.message}` };
  }
}

/**
 * Đọc tất cả packs từ GitHub Gist
 * @param {string} token
 * @param {string} gistId
 * @returns {Promise<{ ok: boolean, packs?: Array<any>, error?: string }>}
 */
export async function gistGetPacks(token, gistId) {
  if (!token || !gistId) return { ok: false, error: 'Thiếu Token hoặc Gist ID' };

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: makeHeaders(token)
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const file = data.files && data.files[GIST_FILENAME];
    if (!file || !file.content) {
      return { ok: true, packs: [] };
    }

    const parsed = JSON.parse(file.content);
    return { ok: true, packs: Array.isArray(parsed.packs) ? parsed.packs : [] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Lưu danh sách packs lên GitHub Gist
 * @param {string} token
 * @param {string} gistId
 * @param {Array<any>} packs
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function gistSavePacks(token, gistId, packs) {
  if (!token || !gistId) return { ok: false, error: 'Thiếu Token hoặc Gist ID' };

  try {
    const payload = {
      description: GIST_DESCRIPTION,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(
            {
              version: 1,
              updatedAt: new Date().toISOString(),
              packs: packs || []
            },
            null,
            2
          )
        }
      }
    };

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: makeHeaders(token),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.message || `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
