import { useState, useEffect, useRef } from 'preact/hooks';
import {
  handleKeyPress,
  handleBackspace,
  handleSpaceKey,
  calculateTypingMetrics
} from '../lib/typingEngine.js';
import {
  isSpeechRecognitionSupported,
  startDictation,
  compareDictation
} from '../lib/dictation.js';

/**
 * Hiển thị số nhỏ (superscript) cho badge cụm liên kết
 * @param {number} id
 * @returns {string}
 */
function getSuperscriptNumber(id) {
  const sups = {
    0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
    5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹'
  };
  return String(id)
    .split('')
    .map((c) => sups[c] || c)
    .join('');
}

/**
 * Phát hiện thiết bị có màn hình nhỏ như điện thoại di động
 * (Chiều rộng màn hình <= 768px hoặc màn hình xoay ngang điện thoại với cảm ứng chạm)
 * @returns {boolean}
 */
export function checkIsSmallScreen() {
  if (typeof window === 'undefined') return false;
  const isSmallWidth = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  const isMobileLandscape = window.innerHeight <= 500 && (
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
  return Boolean(isSmallWidth || isMobileLandscape);
}

export function BilingualStage({
  card,
  typingState,
  setTypingState,
  onNextCard,
  onSkipCard,
  onRestartCard,
  onPlaySpeech,
  autoNext = false,
  memoryMode = false,
  onRecordStats,
  enableVirtualKeyboard = false,
  onToggleVirtualKeyboard
}) {
  const [hoveredLinkId, setHoveredLinkId] = useState(null);
  const [isBoxFocused, setIsBoxFocused] = useState(true);
  const [autoNextCountdown, setAutoNextCountdown] = useState(null);
  const inputRef = useRef(null);

  // Phát hiện màn hình nhỏ / điện thoại
  const [isSmallScreen, setIsSmallScreen] = useState(() => checkIsSmallScreen());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateScreen = () => {
      setIsSmallScreen(checkIsSmallScreen());
    };
    window.addEventListener('resize', updateScreen);
    window.addEventListener('orientationchange', updateScreen);
    const mql = window.matchMedia && window.matchMedia('(max-width: 768px)');
    mql?.addEventListener?.('change', updateScreen);

    return () => {
      window.removeEventListener('resize', updateScreen);
      window.removeEventListener('orientationchange', updateScreen);
      mql?.removeEventListener?.('change', updateScreen);
    };
  }, []);

  // Dictation state: 'idle' | 'listening' | 'result'
  const [dictState, setDictState] = useState('idle');
  // { words: [{word, match}], isMatch: bool } | null
  const [dictResult, setDictResult] = useState(null);
  const dictControlRef = useRef(null);

  // Detect touch/coarse-pointer device for mobile-only mic button
  const isMobile =
    isSpeechRecognitionSupported() &&
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  // Lắng nghe Visual Viewport khi bàn phím ảo bật/tắt trên mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportChange = () => {
      const vvh = window.visualViewport.height;
      document.documentElement.style.setProperty('--visual-viewport-height', `${vvh}px`);
      if (isBoxFocused && inputRef.current) {
        inputRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport.removeEventListener('resize', handleViewportChange);
      window.visualViewport.removeEventListener('scroll', handleViewportChange);
    };
  }, [isBoxFocused]);

  // Phản hồi khi bật/tắt tùy chọn bàn phím ảo trên di động
  useEffect(() => {
    if (isSmallScreen) {
      if (enableVirtualKeyboard) {
        try {
          inputRef.current?.focus({ preventScroll: true });
        } catch {
          inputRef.current?.focus();
        }
      } else {
        inputRef.current?.blur();
      }
    }
  }, [enableVirtualKeyboard, isSmallScreen]);

  // Tự động focus vào input khi đổi thẻ hoặc load
  // Trên máy tính: luôn focus để gõ phím vật lý ngay lập tức
  // Trên điện thoại/màn hình nhỏ: không tự động mở bàn phím ảo trừ khi bật tùy chọn trong cài đặt
  useEffect(() => {
    const shouldFocus = !isSmallScreen || enableVirtualKeyboard;
    if (shouldFocus && inputRef.current) {
      try {
        inputRef.current.focus({ preventScroll: true });
      } catch {
        inputRef.current.focus();
      }
    }
    // Reset dictation when card changes
    setDictState('idle');
    setDictResult(null);
    dictControlRef.current?.stop();
  }, [card?.id, isSmallScreen, enableVirtualKeyboard]);

  // Xử lý auto-next sau khi hoàn thành
  useEffect(() => {
    if (!typingState.isComplete) {
      setAutoNextCountdown(null);
      return;
    }

    const metrics = calculateTypingMetrics(typingState);
    if (onRecordStats && card?.id) {
      onRecordStats(card.id, {
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        errorCount: typingState.errorCount
      });
    }

    if (autoNext) {
      setAutoNextCountdown(1.2);
      const timer = setTimeout(() => {
        onNextCard();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [typingState.isComplete]);

  // Đảm bảo input luôn nhận focus khi click vào box (nếu được phép mở bàn phím ảo hoặc trên desktop)
  const handleBoxClick = () => {
    const shouldFocus = !isSmallScreen || enableVirtualKeyboard;
    if (shouldFocus) {
      if (inputRef.current) {
        inputRef.current.focus();
        setIsBoxFocused(true);
        if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
          setTimeout(() => {
            inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 120);
        }
      }
    } else {
      // Khi ở màn hình nhỏ và tắt bàn phím ảo: vẫn giữ trạng thái active của stage mà không gọi mở bàn phím ảo
      setIsBoxFocused(true);
    }
  };

  const handleKeyDown = (e) => {
    // 1. Phím tắt toàn cục
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onSkipCard();
        return;
      }
      if (typingState.isComplete) {
        e.preventDefault();
        onNextCard();
        return;
      }
    }

    if (e.key === 'Tab' || (e.ctrlKey && e.key === 'Backspace')) {
      e.preventDefault();
      onRestartCard();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      const updated = { ...typingState };
      handleBackspace(updated);
      setTypingState(updated);
      return;
    }

    if (e.key === ' ') {
      if (typingState.isComplete) {
        e.preventDefault();
        onNextCard();
        return;
      }
      e.preventDefault();
      const updated = { ...typingState };
      handleSpaceKey(updated);
      setTypingState(updated);
      return;
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    e.target.value = ''; // Reset input để không tích lũy buffer

    if (!val || typingState.isComplete || typingState.isComposing) return;

    const char = val[val.length - 1];
    const updated = { ...typingState };
    handleKeyPress(updated, char);
    setTypingState(updated);
  };

  const handleCompositionStart = () => {
    setTypingState((prev) => ({ ...prev, isComposing: true }));
  };

  const handleCompositionEnd = (e) => {
    const updated = { ...typingState, isComposing: false };
    const val = e.data || '';
    if (val) {
      for (const char of val) {
        handleKeyPress(updated, char);
      }
    }
    setTypingState(updated);
  };

  // ── Dictation ──────────────────────────────────────────────────────────────
  const handleDictationToggle = () => {
    if (dictState === 'listening') {
      // Manual stop (usually not needed; auto-stops on silence)
      dictControlRef.current?.stop();
      return;
    }

    // Reset previous result and start
    setDictResult(null);
    setDictState('listening');

    dictControlRef.current = startDictation({
      lang: 'en-US',
      onResult: (transcript) => {
        const target = card?.en || '';
        const result = compareDictation(transcript, target);
        setDictResult({ ...result, transcript });
        setDictState('result');
      },
      onError: (err) => {
        // On error (or no-speech → empty transcript), show empty result
        const result = compareDictation('', card?.en || '');
        setDictResult({ ...result, transcript: '' });
        setDictState('result');
      },
      onEnd: () => {
        // Ensure we leave 'listening' state even without a result event
        setDictState((prev) => (prev === 'listening' ? 'idle' : prev));
      }
    });
  };

  const handleDictationRetry = () => {
    setDictState('idle');
    setDictResult(null);
    // Chỉ refocus hidden input nếu được phép mở bàn phím ảo hoặc trên desktop
    if (!isSmallScreen || enableVirtualKeyboard) {
      inputRef.current?.focus();
    }
  };

  // Render câu tiếng Việt với các cụm liên kết
  const renderVietnameseLine = () => {
    if (!card) return null;

    const viText = card.vi || '';
    const links = (card.links || []).filter((l) => l.viStart !== undefined && l.viEnd !== undefined);

    if (links.length === 0) {
      return <span>{viText}</span>;
    }

    // Sắp xếp theo viStart
    const sorted = [...links].sort((a, b) => a.viStart - b.viStart);
    const elements = [];
    let lastIdx = 0;

    sorted.forEach((l) => {
      if (l.viStart > lastIdx) {
        elements.push(<span>{viText.slice(lastIdx, l.viStart)}</span>);
      }

      const clusterText = viText.slice(l.viStart, l.viEnd);
      const isTargetActive = typingState.activeLinkId === l.id;
      const isHovered = hoveredLinkId === l.id;
      const isCompleted = typingState.completedLinkIds.includes(l.id);

      const colorClass = `link-id-${((l.id - 1) % 5) + 1}`;

      elements.push(
        <span
          className={`link-cluster ${colorClass} ${isTargetActive ? 'active' : ''} ${isHovered ? 'hovered' : ''} ${isCompleted ? 'completed' : ''}`}
          onMouseEnter={() => setHoveredLinkId(l.id)}
          onMouseLeave={() => setHoveredLinkId(null)}
          title={`Cụm liên kết ${l.id}: "${l.enText}"`}
        >
          {clusterText}
          <sup className="link-badge">{getSuperscriptNumber(l.id)}</sup>
        </span>
      );

      lastIdx = l.viEnd;
    });

    if (lastIdx < viText.length) {
      elements.push(<span>{viText.slice(lastIdx)}</span>);
    }

    return elements;
  };

  // Render câu tiếng Anh với trạng thái từng ký tự và con trỏ
  const renderEnglishLine = () => {
    if (!card) return null;

    const charStates = typingState.charStates || [];
    const cursor = typingState.cursor;
    const isComplete = typingState.isComplete;

    return (
      <div className="english-line-inner" style={{ position: 'relative', display: 'inline' }}>
        {charStates.map((cs, idx) => {
          const isCursorHere = idx === cursor && !isComplete;
          const char = cs.char;

          // Chế độ nhớ: nếu chưa gõ và chưa hoàn thành -> ẩn ký tự gợi ý
          let displayChar = char;
          if (memoryMode && !isComplete && cs.status === 'untyped') {
            displayChar = char === ' ' ? ' ' : '•';
          }

          let charClass = `char-span ${cs.status}`;
          if (cs.status === 'error' && char === ' ') {
            charClass += ' char-space-error';
            displayChar = '␣';
          }

          return (
            <span key={idx} className={charClass} style={{ position: 'relative' }}>
              {isCursorHere && (
                <span
                  className="caret-cursor"
                  style={{ left: 0 }}
                />
              )}
              {displayChar}
            </span>
          );
        })}

        {/* Con trỏ ở cuối dòng khi đã gõ đến ký tự cuối cùng */}
        {cursor === charStates.length && !isComplete && (
          <span className="caret-cursor" style={{ display: 'inline-block', position: 'relative', height: '1.2em' }} />
        )}
      </div>
    );
  };

  const metrics = calculateTypingMetrics(typingState);

  return (
    <div className="stage-container">
      {/* Thẻ ẩn bắt phím */}
      <input
        ref={inputRef}
        type="text"
        className="hidden-typing-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        inputMode={isSmallScreen && !enableVirtualKeyboard ? 'none' : 'text'}
        virtualKeyboardPolicy={isSmallScreen && !enableVirtualKeyboard ? 'manual' : 'auto'}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onFocus={() => setIsBoxFocused(true)}
        onBlur={() => setIsBoxFocused(false)}
      />

      {/* Meta Bar */}
      <div className="card-meta-bar">
        <div className="card-topic-tag">
          <span>📚 {card?.topic || 'General'}</span>
          {card?.level && <span className="card-level-badge">{card.level}</span>}
        </div>
        <div className="card-actions-quick">
          <button
            className="icon-btn stage-action-icon"
            onClick={onPlaySpeech}
            title="Đọc lại câu này (Ctrl+P)"
            aria-label="Đọc lại câu này (Ctrl+P)"
          >
            🔊
          </button>
          <button
            className="btn btn-secondary stage-action-btn"
            onClick={onRestartCard}
            title="Gõ lại thẻ này từ đầu (Ctrl+Backspace / Tab)"
            aria-label="Gõ lại thẻ này"
          >
            ↺ Gõ lại
          </button>
          <button
            className="btn btn-secondary stage-action-btn"
            onClick={onSkipCard}
            title="Bỏ qua thẻ này (Ctrl+Enter)"
            aria-label="Bỏ qua thẻ này"
          >
            Bỏ qua ➔
          </button>
          {/* Nút bật/tắt bàn phím ảo trên điện thoại / màn hình nhỏ */}
          {isSmallScreen && onToggleVirtualKeyboard && (
            <button
              type="button"
              className={`icon-btn stage-action-icon${enableVirtualKeyboard ? ' active' : ''}`}
              onClick={onToggleVirtualKeyboard}
              title={enableVirtualKeyboard ? 'Bàn phím ảo di động: Đang BẬT (Bấm để tắt)' : 'Bàn phím ảo di động: Đang TẮT (Bấm để bật)'}
              aria-label={enableVirtualKeyboard ? 'Tắt bàn phím ảo' : 'Bật bàn phím ảo'}
              aria-pressed={enableVirtualKeyboard}
            >
              ⌨️
            </button>
          )}
          {/* Mic button — mobile only (pointer: coarse) + SpeechRecognition available */}
          {isMobile && (
            <button
              className={`icon-btn dictation-btn${dictState === 'listening' ? ' listening' : ''}`}
              onClick={handleDictationToggle}
              title={dictState === 'listening' ? 'Đang nghe… (nhấn để dừng)' : 'Đọc câu tiếng Anh (Dictation)'}
              aria-label={dictState === 'listening' ? 'Đang ghi âm' : 'Bắt đầu đọc'}
              aria-pressed={dictState === 'listening'}
            >
              {dictState === 'listening' ? '⏹' : '🎤'}
            </button>
          )}
        </div>
      </div>

      {/* Hộp gõ song ngữ */}
      <div
        className={`bilingual-box ${isBoxFocused ? 'focused' : ''} ${typingState.isComplete ? 'full-review' : ''}`}
        onClick={handleBoxClick}
      >
        {/* Dòng tiếng Việt */}
        <div className="vietnamese-line">{renderVietnameseLine()}</div>

        {/* Dòng tiếng Anh */}
        <div className="english-line">{renderEnglishLine()}</div>

        {/* Ghi chú ngữ cảnh (nếu có) khi hoàn thành */}
        {typingState.isComplete && card?.note && (
          <div className="note-box">
            <strong>💡 Ghi chú:</strong> {card.note}
          </div>
        )}
      </div>

      {/* Kết quả Dictation */}
      {dictState === 'listening' && (
        <div className="dictation-listening" role="status" aria-live="polite">
          <span className="dictation-pulse">🎤</span>
          <span>Đang nghe… hãy đọc câu tiếng Anh</span>
        </div>
      )}
      {dictState === 'result' && dictResult && (
        <div className={`dictation-result ${dictResult.isMatch ? 'match' : 'mismatch'}`} role="status" aria-live="polite">
          <div className="dictation-result-header">
            {dictResult.isMatch ? '✅ Đúng rồi!' : '❌ Chưa khớp'}
          </div>
          {dictResult.transcript ? (
            <>
              {/* Show verbatim transcript */}
              <div className="dictation-said">
                <span className="dictation-label">Bạn đọc:</span>
                <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  "{dictResult.transcript}"
                </span>
              </div>
              {/* Target words highlighted match / miss */}
              <div className="dictation-said">
                <span className="dictation-label">Mục tiêu:</span>
                <span className="dictation-words">
                  {dictResult.words.map((w, i) => (
                    <span key={i} className={`dictation-word ${w.match ? 'word-match' : 'word-miss'}`}>
                      {w.word}
                    </span>
                  ))}
                </span>
              </div>
            </>
          ) : (
            <div className="dictation-said" style={{ color: 'var(--text-secondary)' }}>
              Không nhận được tiếng nói. Thử lại nhé!
            </div>
          )}
          <div className="dictation-actions">
            <button className="btn btn-secondary stage-action-btn" onClick={handleDictationRetry}
              style={{ fontSize: '0.8rem' }}>
              🎤 Thử lại
            </button>
            {dictResult.isMatch && (
              <button className="btn btn-primary stage-action-btn next-card-btn" onClick={onNextCard}
                style={{ fontSize: '0.8rem' }}>
                Tiếp theo ➔
              </button>
            )}
          </div>
        </div>
      )}

      {/* Kết quả sau khi gõ xong thẻ */}
      {typingState.isComplete && (
        <div className="result-bar">
          <div className="result-metrics">
            <div className="result-item">
              <span className="result-item-label">Tốc độ:</span>
              <span className="val">{metrics.wpm}</span>
              <span className="result-item-unit">WPM</span>
            </div>
            <div className="result-item">
              <span className="result-item-label">Độ chính xác:</span>
              <span className={`val ${metrics.accuracy >= 95 ? 'green' : ''}`}>
                {metrics.accuracy}%
              </span>
            </div>
            <div className="result-item">
              <span className="result-item-label">Thời gian:</span>
              <span className="val">{metrics.durationSeconds}s</span>
            </div>
          </div>

          <div className="result-next-hint">
            {autoNextCountdown !== null ? (
              <span className="result-countdown-hint">Tự chuyển thẻ sau <strong>{autoNextCountdown}s</strong>…</span>
            ) : (
              <span className="result-keyboard-hint">
                Bấm <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để tiếp tục
              </span>
            )}
            <button className="btn btn-primary next-card-btn" onClick={onNextCard}>
              Tiếp theo ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
