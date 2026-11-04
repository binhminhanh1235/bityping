/**
 * IndexedDB Adapter for TypeLearn
 * Bền bỉ, dung lượng lớn (>50MB), hoạt động 100% offline không cần backend.
 * Có sẵn in-memory map fallback khi chạy trong môi trường test/SSR không có IndexedDB.
 */

const DB_NAME = 'TypeLearnDB';
const DB_VERSION = 1;
const STORE_PACKS = 'packs';
const STORE_META = 'meta';

let dbPromise = null;
const memoryPacksStore = new Map();

/**
 * Mở kết nối IndexedDB
 * @returns {Promise<IDBDatabase | null>}
 */
export function openDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PACKS)) {
          db.createObjectStore(STORE_PACKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('[IDB] Lỗi mở IndexedDB:', request.error);
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Lấy tất cả packs từ IndexedDB (hoặc memory fallback)
 * @returns {Promise<Array<any>>}
 */
export async function idbGetAllPacks() {
  const db = await openDB();
  if (!db) {
    return Array.from(memoryPacksStore.values());
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.getAll();

      req.onsuccess = () => {
        resolve(req.result || []);
      };

      req.onerror = () => {
        console.warn('[IDB] Lỗi đọc packs:', req.error);
        resolve(Array.from(memoryPacksStore.values()));
      };
    } catch (e) {
      console.warn('[IDB] Ngoại lệ khi đọc packs:', e);
      resolve(Array.from(memoryPacksStore.values()));
    }
  });
}

/**
 * Lấy chi tiết một pack theo id
 * @param {string} id
 * @returns {Promise<any | null>}
 */
export async function idbGetPack(id) {
  if (!id) return null;
  const db = await openDB();
  if (!db) {
    return memoryPacksStore.get(id) || null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result || null);
      };

      req.onerror = () => {
        resolve(memoryPacksStore.get(id) || null);
      };
    } catch {
      resolve(memoryPacksStore.get(id) || null);
    }
  });
}

/**
 * Lưu hoặc cập nhật một pack vào IndexedDB
 * @param {any} pack
 * @returns {Promise<boolean>}
 */
export async function idbSavePack(pack) {
  if (!pack || !pack.id) return false;
  memoryPacksStore.set(pack.id, pack);

  const db = await openDB();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.put(pack);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(true); // fallback in-memory đã lưu
    } catch {
      resolve(true);
    }
  });
}

/**
 * Lưu nhiều packs cùng một transaction (cho sync)
 * @param {Array<any>} packs
 * @returns {Promise<boolean>}
 */
export async function idbSaveMultiplePacks(packs) {
  if (!Array.isArray(packs) || packs.length === 0) return true;
  for (const p of packs) {
    if (p && p.id) memoryPacksStore.set(p.id, p);
  }

  const db = await openDB();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      const store = tx.objectStore(STORE_PACKS);

      for (const p of packs) {
        if (p && p.id) {
          store.put(p);
        }
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(true);
    } catch {
      resolve(true);
    }
  });
}

/**
 * Xoá một pack khỏi IndexedDB
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function idbDeletePack(id) {
  if (!id) return false;
  memoryPacksStore.delete(id);

  const db = await openDB();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(true);
    } catch {
      resolve(true);
    }
  });
}

/**
 * Xoá toàn bộ dữ liệu trong IndexedDB (Dọn dẹp)
 * @returns {Promise<boolean>}
 */
export async function idbClear() {
  memoryPacksStore.clear();
  const db = await openDB();
  if (!db) return true;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      const store = tx.objectStore(STORE_PACKS);
      const req = store.clear();

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(true);
    } catch {
      resolve(true);
    }
  });
}
