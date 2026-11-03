let cachedVoices = [];

/**
 * Lấy danh sách các giọng đọc tiếng Anh có sẵn trên trình duyệt
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function getEnglishVoices() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      const enVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      cachedVoices = enVoices.length > 0 ? enVoices : voices;
      resolve(cachedVoices);
    };

    const initial = window.speechSynthesis.getVoices();
    if (initial && initial.length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      // Fallback timeout sau 500ms
      setTimeout(loadVoices, 500);
    }
  });
}

/**
 * Phát âm thanh đọc câu tiếng Anh
 * @param {string} text
 * @param {object} [options={}]
 * @param {string} [options.voiceURI]
 * @param {number} [options.rate=1.0]
 * @param {number} [options.pitch=1.0]
 * @param {() => void} [options.onStart]
 * @param {() => void} [options.onEnd]
 */
export function speakEnglish(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    return;
  }

  const { voiceURI, rate = 1.0, pitch = 1.0, onStart, onEnd } = options;

  // Dừng câu nói trước đó
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  utterance.pitch = Math.max(0.5, Math.min(2.0, Number(pitch) || 1.0));

  if (voiceURI && cachedVoices.length > 0) {
    const selectedVoice = cachedVoices.find((v) => v.voiceURI === voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

/**
 * Dừng phát âm thanh
 */
export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
