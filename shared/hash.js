/**
 * Chuẩn hoá văn bản tiếng Anh:
 * - Chuyển chữ thường
 * - Gộp các khoảng trắng liên tiếp thành 1 dấu cách đơn
 * - Loại bỏ dấu câu và khoảng trắng ở đầu và cuối chuỗi
 * @param {string} text
 * @returns {string}
 */
export function normalizeEnText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
    .trim();
}

/**
 * Băm FNV-1a 32-bit cho chuỗi, trả về chuỗi hex 8 ký tự
 * @param {string} str
 * @returns {string}
 */
export function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Tạo cardId duy nhất dựa trên nội dung tiếng Anh đã chuẩn hoá
 * @param {string} enText
 * @returns {string}
 */
export function generateCardId(enText) {
  const normalized = normalizeEnText(enText);
  return `c_${fnv1a32(normalized)}`;
}

/**
 * Tạo packId duy nhất kết hợp topic, timestamp và random hex
 * @param {string} topic
 * @returns {string}
 */
export function generatePackId(topic = '') {
  const cleanTopic = (topic || 'pack')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36);
  return `${cleanTopic || 'pack'}-${ts}-${rand}`;
}
