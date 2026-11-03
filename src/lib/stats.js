const STATS_STORAGE_KEY = 'bityping_session_stats';
const CARD_STATS_STORAGE_KEY = 'bityping_card_history';

/**
 * Lấy thống kê phiên làm việc hiện tại
 * @returns {{ cardsCompleted: number, totalWpm: number, avgWpm: number, avgAccuracy: number, currentStreak: number, bestStreak: number }}
 */
export function getSessionStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Không dùng được localStorage
  }
  return {
    cardsCompleted: 0,
    totalWpm: 0,
    avgWpm: 0,
    avgAccuracy: 100,
    currentStreak: 0,
    bestStreak: 0
  };
}

/**
 * Lấy lịch sử thống kê theo từng thẻ
 * @returns {Record<string, { attempts: number, errors: number, lastAccuracy: number, lastWpm: number, lastSeenAt: number }>}
 */
export function getCardHistory() {
  try {
    const raw = localStorage.getItem(CARD_STATS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Không dùng được localStorage
  }
  return {};
}

/**
 * Ghi nhận một thẻ vừa hoàn thành
 * @param {string} cardId
 * @param {{ wpm: number, accuracy: number, errorCount: number }} metrics
 * @returns {object} Thống kê mới cập nhật
 */
export function recordCardCompletion(cardId, { wpm, accuracy, errorCount }) {
  const session = getSessionStats();
  const cardHistory = getCardHistory();

  // Cập nhật session
  session.cardsCompleted += 1;
  session.totalWpm += wpm;
  session.avgWpm = Math.round(session.totalWpm / session.cardsCompleted);

  // Tính running average accuracy
  session.avgAccuracy = Math.round(
    (session.avgAccuracy * (session.cardsCompleted - 1) + accuracy) / session.cardsCompleted
  );

  // Cập nhật streak: accuracy >= 90% thì tăng streak, ngược lại reset về 0
  if (accuracy >= 90) {
    session.currentStreak += 1;
    if (session.currentStreak > session.bestStreak) {
      session.bestStreak = session.currentStreak;
    }
  } else {
    session.currentStreak = 0;
  }

  // Cập nhật card history
  const existingCard = cardHistory[cardId] || {
    attempts: 0,
    errors: 0,
    lastAccuracy: 100,
    lastWpm: 0,
    lastSeenAt: 0
  };

  existingCard.attempts += 1;
  existingCard.errors += errorCount;
  existingCard.lastAccuracy = accuracy;
  existingCard.lastWpm = wpm;
  existingCard.lastSeenAt = Date.now();
  cardHistory[cardId] = existingCard;

  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(CARD_STATS_STORAGE_KEY, JSON.stringify(cardHistory));
  } catch (e) {
    // Bỏ qua lỗi quota
  }

  return { session, cardHistory };
}

/**
 * Xoá toàn bộ thống kê phiên
 */
export function resetSessionStats() {
  try {
    localStorage.removeItem(STATS_STORAGE_KEY);
  } catch (e) {}
  return getSessionStats();
}
