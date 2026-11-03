/**
 * Lọc danh sách thẻ từ các pack dựa trên chủ đề được chọn
 * @param {Array<any>} packs
 * @param {string[] | string} selectedTopics
 * @returns {Array<any>}
 */
export function filterCardsByTopics(packs = [], selectedTopics = ['all']) {
  if (!Array.isArray(packs) || packs.length === 0) return [];

  const isAll =
    !selectedTopics ||
    (Array.isArray(selectedTopics) && (selectedTopics.includes('all') || selectedTopics.length === 0)) ||
    selectedTopics === 'all';

  const topicsSet = new Set(
    Array.isArray(selectedTopics)
      ? selectedTopics.map((t) => (t || '').toLowerCase())
      : [String(selectedTopics).toLowerCase()]
  );

  const cards = [];

  for (const pack of packs) {
    const packTopic = (pack.topic || 'General').toLowerCase();
    if (isAll || topicsSet.has(packTopic)) {
      const packCards = pack.cards || [];
      for (const c of packCards) {
        cards.push({
          ...c,
          topic: pack.topic || 'General',
          packId: pack.id,
          tags: pack.tags || [],
          level: pack.level || ''
        });
      }
    }
  }

  return cards;
}

/**
 * Tính trọng số cho một thẻ khi bật chế độ "Ưu tiên thẻ yếu"
 * @param {object} card
 * @param {Record<string, any>} cardHistory
 * @returns {number}
 */
export function calculateCardWeight(card, cardHistory = {}) {
  const stat = cardHistory[card.id];

  // Thẻ chưa bao giờ gặp -> ưu tiên cao
  if (!stat || stat.attempts === 0) {
    return 10;
  }

  // Thẻ có độ chính xác thấp hoặc nhiều lỗi -> trọng số cao hơn
  const errorFactor = (stat.errors || 0) * 0.4;
  const accuracyPenalty = Math.max(0, (100 - (stat.lastAccuracy ?? 100)) * 0.15);

  // Nếu accuracy thấp < 80% thì cộng thêm điểm
  const lowAccBonus = (stat.lastAccuracy ?? 100) < 80 ? 4 : 0;

  return Math.max(1, Math.round(1 + errorFactor + accuracyPenalty + lowAccBonus));
}

/**
 * Chọn một phần tử theo xác suất trọng số
 * @param {Array<any>} items
 * @param {number[]} weights
 * @returns {any}
 */
function weightedRandomChoice(items, weights) {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let randomVal = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    randomVal -= weights[i];
    if (randomVal <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

/**
 * Chọn thẻ kế tiếp không lặp lại 20 thẻ gần nhất, hỗ trợ ưu tiên thẻ yếu
 * @param {object} params
 * @param {Array<any>} params.packs
 * @param {string[] | string} [params.selectedTopics=['all']]
 * @param {string[]} [params.recentCardIds=[]]
 * @param {boolean} [params.prioritizeWeak=false]
 * @param {Record<string, any>} [params.cardHistory={}]
 * @returns {{ card: any | null, recentCardIds: string[] }}
 */
export function pickNextCard({
  packs = [],
  selectedTopics = ['all'],
  recentCardIds = [],
  prioritizeWeak = false,
  cardHistory = {}
} = {}) {
  const allCandidates = filterCardsByTopics(packs, selectedTopics);

  if (allCandidates.length === 0) {
    return { card: null, recentCardIds: [] };
  }

  // Giới hạn lịch sử gần đây: tối đa 20 thẻ, nhưng không quá N - 1 nếu tổng số thẻ <= 20
  const maxRecent = Math.max(0, Math.min(20, allCandidates.length - 1));
  const activeRecentIds = recentCardIds.slice(-maxRecent);
  const recentSet = new Set(activeRecentIds);

  // Lọc ra các thẻ chưa xuất hiện trong danh sách gần đây
  let availableCandidates = allCandidates.filter((c) => !recentSet.has(c.id));

  // Nếu vì lý do nào đó không còn thẻ nào khả dụng, lấy lại toàn bộ danh sách
  if (availableCandidates.length === 0) {
    availableCandidates = allCandidates;
  }

  let chosenCard;

  if (prioritizeWeak && availableCandidates.length > 1) {
    const weights = availableCandidates.map((c) => calculateCardWeight(c, cardHistory));
    chosenCard = weightedRandomChoice(availableCandidates, weights);
  } else {
    const randIndex = Math.floor(Math.random() * availableCandidates.length);
    chosenCard = availableCandidates[randIndex];
  }

  const updatedRecentIds = [...activeRecentIds, chosenCard.id].slice(-20);

  return {
    card: chosenCard,
    recentCardIds: updatedRecentIds
  };
}
