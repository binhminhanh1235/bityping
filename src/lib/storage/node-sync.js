import { gistGetPacks, gistSavePacks } from './gist.js';
import { validateCards } from '../../../shared/validate.js';
import { generatePackId } from '../../../shared/hash.js';

let fs = null;
let path = null;
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    fs = await import('node:fs');
    path = await import('node:path');
  } catch {}
}

const CONFIG_FILENAME = '.storage-config.json';
const LOCAL_PACKS_FILE = 'data/local-packs.json';

/**
 * Lấy thư mục gốc của project
 * @param {string} [customRoot]
 * @returns {string}
 */
export function getProjectRoot(customRoot = '') {
  if (customRoot) return customRoot;
  if (typeof process !== 'undefined' && process.cwd) {
    return process.cwd();
  }
  return '';
}

/**
 * Đọc cấu hình lưu trữ Node (file .storage-config.json hoặc .env)
 * @param {string} [rootDir]
 * @returns {{
 *   gist: { enabled: boolean, token: string, gistId: string },
 *   localFile: { enabled: boolean, path: string }
 * }}
 */
export function loadNodeStorageConfig(rootDir = '') {
  const root = getProjectRoot(rootDir);
  let config = {
    gist: {
      enabled: false,
      token: '',
      gistId: ''
    },
    localFile: {
      enabled: true,
      path: LOCAL_PACKS_FILE
    }
  };

  // 1. Đọc từ .storage-config.json nếu có fs
  if (fs && path && root) {
    const configPath = path.resolve(root, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.gist) {
          config.gist.enabled = parsed.gist.enabled !== false;
          config.gist.token = parsed.gist.token || '';
          config.gist.gistId = parsed.gist.gistId || '';
        }
      } catch (err) {
        console.warn('[NodeSync] Lỗi đọc .storage-config.json:', err.message);
      }
    }

    // 2. Đọc bổ sung từ .env nếu thiếu
    if (!config.gist.token || !config.gist.gistId) {
      const envPath = path.resolve(root, '.env');
      if (fs.existsSync(envPath)) {
        try {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [k, ...vParts] = trimmed.split('=');
            const key = k.trim();
            const val = vParts.join('=').trim().replace(/^["']|["']$/g, '');
            if ((key === 'GITHUB_TOKEN' || key === 'GIST_TOKEN') && !config.gist.token) {
              config.gist.token = val;
            }
            if (key === 'GIST_ID' && !config.gist.gistId) {
              config.gist.gistId = val;
            }
          }
        } catch {}
      }
    }
  }

  // 3. Fallback sang process.env
  if (typeof process !== 'undefined' && process.env) {
    if (!config.gist.token) {
      config.gist.token = process.env.GITHUB_TOKEN || process.env.GIST_TOKEN || '';
    }
    if (!config.gist.gistId) {
      config.gist.gistId = process.env.GIST_ID || '';
    }
  }

  if (config.gist.token && config.gist.gistId) {
    config.gist.enabled = true;
  }

  return config;
}

/**
 * Ghi cấu hình vào .storage-config.json
 * @param {object} partialConfig
 * @param {string} [rootDir]
 * @returns {boolean}
 */
export function saveNodeStorageConfig(partialConfig, rootDir = '') {
  const root = getProjectRoot(rootDir);
  if (!fs || !path || !root) return false;

  try {
    const current = loadNodeStorageConfig(root);
    const updated = {
      gist: {
        ...current.gist,
        ...(partialConfig.gist || {})
      },
      localFile: {
        ...current.localFile,
        ...(partialConfig.localFile || {})
      }
    };
    if (updated.gist.token && updated.gist.gistId) {
      updated.gist.enabled = true;
    }

    const configPath = path.resolve(root, CONFIG_FILENAME);
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[NodeSync] Lỗi ghi .storage-config.json:', err.message);
    return false;
  }
}

/**
 * Đọc packs từ file data/local-packs.json
 * @param {string} [rootDir]
 * @returns {Array<any>}
 */
export function readLocalPacks(rootDir = '') {
  const root = getProjectRoot(rootDir);
  if (!fs || !path || !root) return [];

  const filePath = path.resolve(root, LOCAL_PACKS_FILE);
  if (!fs.existsSync(filePath)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.packs) ? parsed.packs : []);
  } catch {
    return [];
  }
}

/**
 * Ghi packs vào file data/local-packs.json
 * @param {Array<any>} packs
 * @param {string} [rootDir]
 * @returns {boolean}
 */
export function writeLocalPacks(packs, rootDir = '') {
  const root = getProjectRoot(rootDir);
  if (!fs || !path || !root) return false;

  try {
    const filePath = path.resolve(root, LOCAL_PACKS_FILE);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(packs, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[NodeSync] Lỗi ghi data/local-packs.json:', err.message);
    return false;
  }
}

/**
 * Thu thập tất cả card hashes từ Gist, Local file và KV
 * @param {object} [options]
 * @returns {Promise<Set<string>>}
 */
export async function collectAllCardHashes({ rootDir = '', config = null, kvIndex = [] } = {}) {
  const cfg = config || loadNodeStorageConfig(rootDir);
  const set = new Set();

  // 1. Hashes từ local packs file
  const localPacks = readLocalPacks(rootDir);
  for (const p of localPacks) {
    if (Array.isArray(p.cards)) {
      for (const c of p.cards) {
        if (c.hash) set.add(c.hash);
      }
    }
  }

  // 2. Hashes từ KV index
  for (const item of kvIndex) {
    if (Array.isArray(item.cardHashes)) {
      for (const h of item.cardHashes) {
        set.add(h);
      }
    }
  }

  // 3. Hashes từ GitHub Gist
  if (cfg.gist.enabled && cfg.gist.token && cfg.gist.gistId) {
    try {
      const res = await gistGetPacks(cfg.gist.token, cfg.gist.gistId);
      if (res.ok && Array.isArray(res.packs)) {
        for (const p of res.packs) {
          if (Array.isArray(p.cards)) {
            for (const c of p.cards) {
              if (c.hash) set.add(c.hash);
            }
          }
        }
      }
    } catch {}
  }

  return set;
}

/**
 * Thu thập tất cả topics từ các nguồn
 * @param {object} [options]
 * @returns {Promise<Array<{ topic: string, cardCount: number, packCount: number, tags: string[], level?: string }>>}
 */
export async function collectAllTopics({ rootDir = '', config = null, kvPacks = [] } = {}) {
  const cfg = config || loadNodeStorageConfig(rootDir);
  const packMap = new Map();

  // 1. Local packs file
  const localPacks = readLocalPacks(rootDir);
  for (const p of localPacks) {
    if (p && p.id) packMap.set(p.id, p);
  }

  // 2. KV packs
  for (const p of kvPacks) {
    if (p && p.id && !packMap.has(p.id)) packMap.set(p.id, p);
  }

  // 3. Gist packs
  if (cfg.gist.enabled && cfg.gist.token && cfg.gist.gistId) {
    try {
      const res = await gistGetPacks(cfg.gist.token, cfg.gist.gistId);
      if (res.ok && Array.isArray(res.packs)) {
        for (const p of res.packs) {
          if (p && p.id) packMap.set(p.id, p);
        }
      }
    } catch {}
  }

  const topicMap = new Map();
  for (const pack of packMap.values()) {
    const topic = pack.topic || 'General';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        topic,
        cardCount: 0,
        packCount: 0,
        tags: new Set(),
        levels: new Set()
      });
    }
    const t = topicMap.get(topic);
    t.cardCount += (pack.cards || []).length;
    t.packCount += 1;
    if (Array.isArray(pack.tags)) pack.tags.forEach((tag) => t.tags.add(tag));
    if (pack.level) t.levels.add(pack.level);
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
 * Lưu pack mới vào tất cả storage khả dụng (Gist, Local file, KV)
 * @param {object} params
 * @param {string} params.markdown
 * @param {object} [params.config]
 * @param {string} [params.rootDir]
 * @param {any} [params.kv]
 * @returns {Promise<{
 *   success: boolean,
 *   packId?: string,
 *   topic?: string,
 *   savedCount?: number,
 *   duplicateCount?: number,
 *   duplicates?: Array<any>,
 *   errors?: Array<any>,
 *   targets?: string[],
 *   gistError?: string,
 *   message?: string
 * }>}
 */
export async function syncPackToStorages({ markdown = '', config = null, rootDir = '', kv = null } = {}) {
  const cfg = config || loadNodeStorageConfig(rootDir);
  const existingHashes = await collectAllCardHashes({ rootDir, config: cfg });

  const validation = validateCards(markdown, existingHashes);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors
    };
  }

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

  const targets = [];
  let gistError = null;

  // 1. Lưu vào file cục bộ data/local-packs.json
  const currentLocal = readLocalPacks(rootDir);
  const existingLocalIdx = currentLocal.findIndex((p) => p.id === packId);
  if (existingLocalIdx >= 0) {
    currentLocal[existingLocalIdx] = packRecord;
  } else {
    currentLocal.unshift(packRecord);
  }
  const wroteFile = writeLocalPacks(currentLocal, rootDir);
  if (wroteFile) {
    targets.push('local_file');
  }

  // 2. Lưu lên GitHub Gist nếu cấu hình hợp lệ
  if (cfg.gist.enabled && cfg.gist.token && cfg.gist.gistId) {
    try {
      const gistRes = await gistGetPacks(cfg.gist.token, cfg.gist.gistId);
      let gistPacks = [];
      if (gistRes.ok && Array.isArray(gistRes.packs)) {
        gistPacks = gistRes.packs;
      }
      const existingGistIdx = gistPacks.findIndex((p) => p.id === packId);
      if (existingGistIdx >= 0) {
        gistPacks[existingGistIdx] = packRecord;
      } else {
        gistPacks.unshift(packRecord);
      }

      const saveRes = await gistSavePacks(cfg.gist.token, cfg.gist.gistId, gistPacks);
      if (saveRes.ok) {
        targets.push('gist');
      } else {
        gistError = saveRes.error || 'Lỗi không xác định khi lưu Gist';
      }
    } catch (err) {
      gistError = err.message;
    }
  }

  // 3. Lưu vào KV nếu có
  if (kv) {
    try {
      await kv.put(`pack:${packId}`, JSON.stringify(packRecord));
      const rawIndex = await kv.get('index', 'json');
      const index = Array.isArray(rawIndex) ? rawIndex : [];
      const packMeta = {
        id: packId,
        topic,
        tags: packRecord.tags,
        level: packRecord.level,
        cardCount: packRecord.cards.length,
        cardHashes: packRecord.cards.map((c) => c.hash),
        createdAt: now,
        updatedAt: now
      };
      const existIdx = index.findIndex((p) => p.id === packId);
      if (existIdx >= 0) index[existIdx] = packMeta;
      else index.unshift(packMeta);
      await kv.put('index', JSON.stringify(index));
      targets.push('kv');
    } catch {}
  }

  let message = `Đã tạo thành công pack "${topic}" (${packRecord.cards.length} thẻ mới)`;
  if (targets.includes('gist')) {
    message += ' và đã đồng bộ lên GitHub Gist!';
  } else if (cfg.gist.token && cfg.gist.gistId) {
    message += ` (Lưu cục bộ thành công, nhưng lỗi đồng bộ Gist: ${gistError || 'Chưa thể kết nối'})`;
  } else {
    message += ' vào file cục bộ (data/local-packs.json). Lưu ý: Chưa cấu hình Gist trong .storage-config.json!';
  }

  return {
    success: true,
    packId,
    topic,
    tags: packRecord.tags,
    level: packRecord.level,
    savedCount: packRecord.cards.length,
    duplicateCount: validation.duplicateCount,
    duplicates: validation.duplicates,
    targets,
    gistError,
    message
  };
}
