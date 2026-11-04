/**
 * dictation.js — Thin wrapper around Web Speech API (SpeechRecognition)
 * for the TypeLearn mobile dictation feature.
 *
 * Supported: Chrome/Edge (desktop+Android), Safari iOS 15+
 * Unsupported: Firefox → isSpeechRecognitionSupported() returns false
 */

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

/**
 * Whether the current browser supports SpeechRecognition.
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported() {
  return !!SpeechRecognition;
}

/**
 * Create and start a one-shot dictation session.
 *
 * @param {object} opts
 * @param {string}   opts.lang       BCP-47 language tag, e.g. 'en-US'
 * @param {function} opts.onResult   Called with the final transcript string
 * @param {function} opts.onError    Called with an error message string
 * @param {function} opts.onEnd      Called when the session ends (always)
 * @returns {{ stop: function }} control handle to abort early
 */
export function startDictation({ lang = 'en-US', onResult, onError, onEnd }) {
  if (!SpeechRecognition) {
    onError?.('SpeechRecognition not supported');
    onEnd?.();
    return { stop: () => {} };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false; // only final results
  recognition.maxAlternatives = 1;
  recognition.continuous = false; // auto-stop after silence

  let ended = false;

  const finish = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? '';
    onResult?.(transcript.trim());
  };

  recognition.onerror = (event) => {
    // 'no-speech' is benign — treat as empty result
    if (event.error === 'no-speech') {
      onResult?.('');
    } else {
      onError?.(event.error);
    }
  };

  recognition.onend = finish;

  recognition.start();

  return {
    stop: () => {
      try { recognition.stop(); } catch (_) { /* ignore */ }
    }
  };
}

/**
 * Compare a dictated transcript against the target sentence.
 * Uses case-insensitive word-level matching (mirrors typing engine ignoreCase).
 *
 * @param {string} transcript  What the user said
 * @param {string} target      The expected English sentence
 * @returns {{ words: Array<{word:string, match:boolean}>, isMatch: boolean }}
 */
export function compareDictation(transcript, target) {
  // Normalise: lowercase, collapse spaces, strip leading/trailing punctuation per word
  const normalise = (s) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s']/g, '') // strip punctuation except apostrophes
      .replace(/\s+/g, ' ');

  const spokenWords = normalise(transcript).split(' ').filter(Boolean);
  const targetWords = normalise(target).split(' ').filter(Boolean);

  // Build word-level diff aligned to target
  const words = targetWords.map((tw, i) => ({
    word: tw,
    match: spokenWords[i] === tw
  }));

  const isMatch =
    spokenWords.length === targetWords.length &&
    words.every((w) => w.match);

  return { words, isMatch };
}
