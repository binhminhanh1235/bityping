import { describe, it, expect } from 'vitest';
import {
  createTypingState,
  handleKeyPress,
  handleBackspace,
  calculateTypingMetrics,
  isPunctuation
} from '../src/lib/typingEngine.js';

describe('src/lib/typingEngine.js', () => {
  it('detects punctuation correctly', () => {
    expect(isPunctuation('.')).toBe(true);
    expect(isPunctuation(',')).toBe(true);
    expect(isPunctuation('!')).toBe(true);
    expect(isPunctuation('?')).toBe(true);
    expect(isPunctuation('a')).toBe(false);
    expect(isPunctuation(' ')).toBe(false);
  });

  it('handles ignoreCase correctly', () => {
    const state = createTypingState('Hello', [], { ignoreCase: true });
    handleKeyPress(state, 'h');
    expect(state.cursor).toBe(1);
    expect(state.charStates[0].status).toBe('correct');

    handleKeyPress(state, 'E');
    expect(state.cursor).toBe(2);
    expect(state.charStates[1].status).toBe('correct');
  });

  it('auto-skips punctuation when ignorePunctuation is true', () => {
    const text = 'Saga, step.';
    const state = createTypingState(text, [], { ignorePunctuation: true });

    // Gõ 's', 'a', 'g', 'a'
    'saga'.split('').forEach((c) => handleKeyPress(state, c));
    expect(state.cursor).toBe(5); // Nhảy qua dấu phẩy ',' tại index 4
    expect(state.charStates[4].status).toBe('skipped-punct');

    // Ký tự tiếp theo là dấu cách ' '
    handleKeyPress(state, ' ');
    expect(state.cursor).toBe(6);

    // Gõ 's', 't', 'e', 'p'
    'step'.split('').forEach((c) => handleKeyPress(state, c));
    // Dấu chấm '.' ở cuối cũng được tự động skip
    expect(state.cursor).toBe(11);
    expect(state.charStates[10].status).toBe('skipped-punct');
    expect(state.isComplete).toBe(true);
  });

  it('allows typing punctuation explicitly even if ignorePunctuation is true', () => {
    const text = 'Go!';
    const state = createTypingState(text, [], { ignorePunctuation: true });

    handleKeyPress(state, 'g');
    handleKeyPress(state, 'o');
    // Người dùng chủ động gõ dấu '!'
    handleKeyPress(state, '!');
    expect(state.isComplete).toBe(true);
  });

  it('supports stop-on-error mode', () => {
    const text = 'Cat';
    const state = createTypingState(text, [], { errorMode: 'stop-on-error' });

    handleKeyPress(state, 'x'); // Sai
    expect(state.cursor).toBe(0); // Không tiến cursor
    expect(state.charStates[0].status).toBe('error');

    handleKeyPress(state, 'c'); // Đúng
    expect(state.cursor).toBe(1);
    expect(state.charStates[0].status).toBe('correct');
  });

  it('supports backspace and undoing errors', () => {
    const text = 'Cat';
    const state = createTypingState(text, [], { errorMode: 'backspace' });

    handleKeyPress(state, 'c');
    handleKeyPress(state, 'z'); // Sai
    expect(state.cursor).toBe(2);
    expect(state.charStates[1].status).toBe('error');

    handleBackspace(state);
    expect(state.cursor).toBe(1);
    expect(state.charStates[1].status).toBe('untyped');

    handleKeyPress(state, 'a');
    expect(state.cursor).toBe(2);
    expect(state.charStates[1].status).toBe('correct');
  });

  it('accurately tracks activeLinkId and completedLinkIds', () => {
    // "A saga is a sequence of transactions."
    // link 1: "sequence" (start: 12, end: 20)
    const links = [{ id: 1, enStart: 12, enEnd: 20, text: 'sequence' }];
    const state = createTypingState('A saga is a sequence of transactions.', links);

    // Gõ tới index 12
    const prefix = 'A saga is a ';
    prefix.split('').forEach((c) => handleKeyPress(state, c));

    expect(state.cursor).toBe(12);
    expect(state.activeLinkId).toBe(1);
    expect(state.completedLinkIds).toEqual([]);

    // Gõ 'sequence' (8 ký tự)
    'sequence'.split('').forEach((c) => handleKeyPress(state, c));
    expect(state.cursor).toBe(20);
    expect(state.activeLinkId).toBe(null);
    expect(state.completedLinkIds).toContain(1);
  });

  it('calculates metrics correctly', () => {
    const state = createTypingState('Quick test.');
    state.startTime = Date.now() - 5000; // 5s trước
    state.totalKeystrokes = 10;
    // Đánh dấu 8 ký tự đúng
    for (let i = 0; i < 8; i++) {
      state.charStates[i].status = 'correct';
    }
    const metrics = calculateTypingMetrics(state);
    expect(metrics.wpm).toBeGreaterThan(0);
    expect(metrics.accuracy).toBe(80);
  });
});
