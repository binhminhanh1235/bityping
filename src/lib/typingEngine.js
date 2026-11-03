/**
 * Kiểm tra xem một ký tự có phải là dấu câu không
 * @param {string} char
 * @returns {boolean}
 */
export function isPunctuation(char) {
  if (!char || char.length !== 1) return false;
  // Ký tự dấu câu thông thường và Unicode punctuation
  return /^[\p{P}\p{S}]$/u.test(char);
}

/**
 * Kiểm tra so khớp 2 ký tự có tính đến ignoreCase
 * @param {string} inputChar
 * @param {string} targetChar
 * @param {boolean} ignoreCase
 * @returns {boolean}
 */
export function matchChar(inputChar, targetChar, ignoreCase = true) {
  if (ignoreCase) {
    return inputChar.toLowerCase() === targetChar.toLowerCase();
  }
  return inputChar === targetChar;
}

/**
 * Tạo trạng thái khởi tạo cho một lượt gõ thẻ
 * @param {string} targetEn
 * @param {Array<any>} links
 * @param {object} options
 * @returns {TypingState}
 */
export function createTypingState(targetEn = '', links = [], options = {}) {
  const {
    ignoreCase = true,
    ignorePunctuation = true,
    errorMode = 'backspace' // 'backspace' | 'stop-on-error' | 'word-lock'
  } = options;

  const charStates = [];
  for (let i = 0; i < targetEn.length; i++) {
    charStates.push({
      char: targetEn[i],
      status: 'untyped', // 'untyped' | 'correct' | 'error' | 'skipped-punct'
      typed: null
    });
  }

  return {
    target: targetEn,
    links: links || [],
    cursor: 0,
    charStates,
    options: {
      ignoreCase,
      ignorePunctuation,
      errorMode
    },
    // Lịch sử phím gõ để hỗ trợ backspace và tính accuracy
    history: [],
    totalKeystrokes: 0,
    errorCount: 0,
    startTime: null,
    endTime: null,
    isComplete: false,
    isComposing: false,
    activeLinkId: null,
    completedLinkIds: []
  };
}

/**
 * Cập nhật activeLinkId và completedLinkIds theo vị trí cursor
 * @param {TypingState} state
 */
export function updateActiveLinks(state) {
  const cursor = state.cursor;
  let activeId = null;
  const completed = [];

  for (const l of state.links) {
    if (cursor >= l.enEnd) {
      completed.push(l.id);
    } else if (cursor >= l.enStart && cursor < l.enEnd) {
      activeId = l.id;
    }
  }

  state.activeLinkId = activeId;
  state.completedLinkIds = completed;
}

/**
 * Tự động nhảy qua các ký tự dấu câu sát tiếp theo nếu bật ignorePunctuation
 * @param {TypingState} state
 */
export function skipPunctuationIfNeeded(state) {
  if (!state.options.ignorePunctuation || state.isComplete) return;

  while (state.cursor < state.target.length) {
    const nextChar = state.target[state.cursor];
    if (isPunctuation(nextChar)) {
      state.charStates[state.cursor].status = 'skipped-punct';
      state.cursor++;
    } else {
      break;
    }
  }

  if (state.cursor >= state.target.length) {
    state.isComplete = true;
    if (!state.endTime) state.endTime = Date.now();
  }
}

/**
 * Xử lý khi người dùng gõ một phím ký tự thông thường
 * @param {TypingState} state
 * @param {string} inputChar
 * @returns {TypingState}
 */
export function handleKeyPress(state, inputChar) {
  if (state.isComplete || !inputChar || inputChar.length !== 1 || state.isComposing) {
    return state;
  }

  if (!state.startTime) {
    state.startTime = Date.now();
  }

  state.totalKeystrokes++;

  // Trước khi xử lý, nếu con trỏ đang ở dấu câu và người dùng không gõ dấu câu đó
  // (ví dụ gõ chữ tiếp theo hoặc space), tự động skip dấu câu đó
  if (state.options.ignorePunctuation && state.cursor < state.target.length) {
    const curTargetChar = state.target[state.cursor];
    if (isPunctuation(curTargetChar) && !matchChar(inputChar, curTargetChar, state.options.ignoreCase)) {
      skipPunctuationIfNeeded(state);
      if (state.isComplete) {
        updateActiveLinks(state);
        return state;
      }
    }
  }

  const targetChar = state.target[state.cursor];
  const isMatch = matchChar(inputChar, targetChar, state.options.ignoreCase);

  if (isMatch) {
    state.charStates[state.cursor].status = 'correct';
    state.charStates[state.cursor].typed = inputChar;
    state.history.push({ index: state.cursor, char: inputChar, status: 'correct' });
    state.cursor++;

    // Tự động nhảy qua dấu câu kế tiếp nếu có
    if (state.options.ignorePunctuation) {
      skipPunctuationIfNeeded(state);
    }
  } else {
    state.errorCount++;

    if (state.options.errorMode === 'stop-on-error') {
      // Chế độ chặn khi gõ sai: không tiến cursor, đánh dấu nhấp nháy lỗi
      state.charStates[state.cursor].status = 'error';
      state.charStates[state.cursor].typed = inputChar;
      return state;
    }

    // Chế độ 'backspace' và 'word-lock': vẫn tiến con trỏ nhưng ghi nhận error
    state.charStates[state.cursor].status = 'error';
    state.charStates[state.cursor].typed = inputChar;
    state.history.push({ index: state.cursor, char: inputChar, status: 'error' });
    state.cursor++;

    if (state.options.ignorePunctuation) {
      skipPunctuationIfNeeded(state);
    }
  }

  if (state.cursor >= state.target.length) {
    state.isComplete = true;
    state.endTime = Date.now();
  }

  updateActiveLinks(state);
  return state;
}

/**
 * Xử lý khi người dùng bấm phím Backspace
 * @param {TypingState} state
 * @returns {TypingState}
 */
export function handleBackspace(state) {
  if (state.isComposing || state.cursor === 0) {
    return state;
  }

  // Nếu câu đã hoàn thành nhưng người dùng muốn sửa lại
  if (state.isComplete) {
    state.isComplete = false;
    state.endTime = null;
  }

  // Lùi cursor
  let prevIdx = state.cursor - 1;

  // Nếu ký tự trước đó là 'skipped-punct', lùi tiếp qua các dấu câu đã skip
  while (prevIdx >= 0 && state.charStates[prevIdx].status === 'skipped-punct') {
    state.charStates[prevIdx].status = 'untyped';
    state.charStates[prevIdx].typed = null;
    prevIdx--;
  }

  if (prevIdx >= 0) {
    // Nếu ở chế độ 'word-lock', kiểm tra xem có vượt qua ranh giới từ đã chốt hay không
    if (state.options.errorMode === 'word-lock') {
      const prevChar = state.target[prevIdx];
      // Nếu lùi tới space đã chốt thì không cho lùi tiếp vào từ trước
      if (prevChar === ' ' && state.charStates[prevIdx].status === 'correct') {
        return state;
      }
    }

    state.charStates[prevIdx].status = 'untyped';
    state.charStates[prevIdx].typed = null;
    state.cursor = prevIdx;
    state.history.pop();
  } else {
    state.cursor = 0;
  }

  updateActiveLinks(state);
  return state;
}

/**
 * Xử lý khi người dùng bấm phím Space
 * @param {TypingState} state
 * @returns {TypingState}
 */
export function handleSpaceKey(state) {
  return handleKeyPress(state, ' ');
}

/**
 * Tính toán các chỉ số thống kê WPM và Accuracy
 * @param {TypingState} state
 * @returns {{ wpm: number, accuracy: number, durationSeconds: number }}
 */
export function calculateTypingMetrics(state) {
  const now = state.endTime || Date.now();
  const startTime = state.startTime || now;
  const durationMs = Math.max(now - startTime, 500); // Tối thiểu 500ms để tránh chia 0
  const durationMinutes = durationMs / 60000;
  const durationSeconds = Math.round(durationMs / 1000);

  let correctChars = 0;
  let totalEvaluated = 0;

  for (const cs of state.charStates) {
    if (cs.status === 'correct' || cs.status === 'skipped-punct') {
      correctChars++;
      totalEvaluated++;
    } else if (cs.status === 'error') {
      totalEvaluated++;
    }
  }

  // WPM chuẩn: (số ký tự đúng / 5) / số phút
  const wpm = Math.max(0, Math.round(correctChars / 5 / durationMinutes));

  // Accuracy: correct / (correct + error)
  const totalTyped = state.totalKeystrokes || totalEvaluated;
  const accuracy = totalTyped > 0 ? Math.max(0, Math.min(100, Math.round((correctChars / totalTyped) * 100))) : 100;

  return {
    wpm,
    accuracy,
    durationSeconds
  };
}
