/**
 * Quản lý Speech Synthesis Đa Động Cơ (Multi-Engine TTS):
 * 1. Microsoft Edge Neural TTS (Cloud AI - Chuẩn phòng thu, ~200ms, 0MB)
 * 2. Web Speech API (Hệ thống / Enhanced - Tức thì 0ms, 0MB, 100% Offline)
 * 3. Piper Neural TTS (VITS WASM - Siêu nhẹ ~15MB, 100% Offline)
 */

// ---------------------------------------------------------------------------
// 1. Cấu hình giọng Microsoft Edge Neural TTS
// ---------------------------------------------------------------------------
export const EDGE_VOICES = [
  { id: 'en-US-JennyNeural', name: 'Jenny (Nữ Mỹ - Tự nhiên, Ấm áp)', lang: 'en-US', gender: 'female' },
  { id: 'en-US-GuyNeural', name: 'Guy (Nam Mỹ - Trầm ấm, Bản ngữ)', lang: 'en-US', gender: 'male' },
  { id: 'en-US-AriaNeural', name: 'Aria (Nữ Mỹ - Biểu cảm, Trong trẻo)', lang: 'en-US', gender: 'female' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (Nam Mỹ - Chuyên nghiệp)', lang: 'en-US', gender: 'male' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (Nữ Anh - Chuẩn RP)', lang: 'en-GB', gender: 'female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (Nam Anh - Chuẩn RP)', lang: 'en-GB', gender: 'male' }
];

export const DEFAULT_EDGE_VOICE = 'en-US-JennyNeural';

// ---------------------------------------------------------------------------
// 2. Cấu hình giọng Piper Neural TTS (VITS WASM)
// ---------------------------------------------------------------------------
export const PIPER_VOICES = [
  { id: 'en_US-lessac-medium', name: 'Lessac (Nữ Mỹ - Mẫu mực, Chuẩn)', lang: 'en-US', gender: 'female', size: '~15MB' },
  { id: 'en_US-amy-low', name: 'Amy (Nữ Mỹ - Siêu nhẹ ~11MB)', lang: 'en-US', gender: 'female', size: '~11MB' },
  { id: 'en_US-ryan-medium', name: 'Ryan (Nam Mỹ - Rõ ràng)', lang: 'en-US', gender: 'male', size: '~15MB' },
  { id: 'en_GB-alan-medium', name: 'Alan (Nam Anh - Chuẩn)', lang: 'en-GB', gender: 'male', size: '~15MB' }
];

export const DEFAULT_PIPER_VOICE = 'en_US-lessac-medium';

// ---------------------------------------------------------------------------
// Trạng thái và Listener cho Piper
// ---------------------------------------------------------------------------
let piperStatus = {
  state: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  progress: 0,
  error: null
};

const piperStatusListeners = new Set();

function notifyPiperStatus() {
  for (const listener of piperStatusListeners) {
    try {
      listener({ ...piperStatus });
    } catch (err) {
      console.warn('[Speech] Lỗi trong listener Piper:', err);
    }
  }
}

export function subscribePiperStatus(listener) {
  piperStatusListeners.add(listener);
  listener({ ...piperStatus });
  return () => {
    piperStatusListeners.delete(listener);
  };
}

export function getPiperStatus() {
  return { ...piperStatus };
}

export async function initPiper(voiceId = DEFAULT_PIPER_VOICE) {
  if (typeof window === 'undefined') return;
  if (piperStatus.state === 'loading') return;

  piperStatus.state = 'loading';
  piperStatus.progress = 0;
  piperStatus.error = null;
  notifyPiperStatus();

  try {
    const { download, stored } = await import('@mintplex-labs/piper-tts-web');
    const existing = await stored();
    if (!existing.includes(voiceId)) {
      await download(voiceId, (pct) => {
        piperStatus.progress = Math.round((pct || 0) * 100);
        notifyPiperStatus();
      });
    }
    piperStatus.state = 'ready';
    piperStatus.progress = 100;
    notifyPiperStatus();
  } catch (err) {
    console.warn('[Piper] Init error:', err);
    piperStatus.state = 'error';
    piperStatus.error = err.message || 'Không thể nạp mô hình Piper';
    notifyPiperStatus();
  }
}

// ---------------------------------------------------------------------------
// Quản lý LRU Cache âm thanh
// ---------------------------------------------------------------------------
const MAX_CACHE_SIZE = 80;
const audioCache = new Map();

function getEdgeCacheKey(text, voice, speed) {
  return `edge:${voice}:${Number(speed).toFixed(1)}:${text.trim().toLowerCase()}`;
}

function getPiperCacheKey(text, voice, speed) {
  return `piper:${voice}:${Number(speed).toFixed(1)}:${text.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Quản lý phát âm thanh HTMLAudioElement & Blob URLs
// ---------------------------------------------------------------------------
let currentAudio = null;
let currentAudioUrl = null;

function cleanupCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch {}
    currentAudioUrl = null;
  }
}

function playBlobUrl(blobUrl, onStart, onEnd, onError) {
  if (typeof window === 'undefined') return;
  stopSpeech();

  try {
    const audio = new Audio(blobUrl);
    currentAudio = audio;

    audio.onplay = () => {
      if (onStart) onStart();
    };

    audio.onended = () => {
      cleanupCurrentAudio();
      if (onEnd) onEnd();
    };

    audio.onerror = (e) => {
      console.warn('[Speech] Trình phát âm thanh gặp lỗi:', e);
      cleanupCurrentAudio();
      if (onError) {
        onError(e);
      } else if (onEnd) {
        onEnd();
      }
    };

    audio.play().catch((err) => {
      console.warn('[Speech] Trình duyệt chặn autoplay:', err);
      cleanupCurrentAudio();
      if (onError) {
        onError(err);
      } else if (onEnd) {
        onEnd();
      }
    });
  } catch (err) {
    console.error('[Speech] Lỗi khởi tạo audio:', err);
    cleanupCurrentAudio();
    if (onError) {
      onError(err);
    } else if (onEnd) {
      onEnd();
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Web Speech API (Hệ thống - Enhanced / Natural)
// ---------------------------------------------------------------------------
let cachedVoices = [];

/**
 * Lấy danh sách giọng đọc tiếng Anh, ưu tiên các giọng Enhanced/Natural/Online/Google
 */
export function getEnglishVoices() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices() || [];
      const enVoices = allVoices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
      const pool = enVoices.length > 0 ? enVoices : allVoices;

      // Ưu tiên các giọng chất lượng cao: Natural, Online, Enhanced, Premium, Google
      const sorted = [...pool].sort((a, b) => {
        const score = (v) => {
          const name = (v.name || '').toLowerCase();
          if (name.includes('natural') || name.includes('online')) return 4;
          if (name.includes('enhanced') || name.includes('premium')) return 3;
          if (name.includes('google') || name.includes('siri')) return 2;
          if (v.lang && (v.lang.toLowerCase() === 'en-us' || v.lang.toLowerCase() === 'en-gb')) return 1;
          return 0;
        };
        return score(b) - score(a);
      });

      cachedVoices = sorted;
      resolve(cachedVoices);
    };

    const initial = window.speechSynthesis.getVoices();
    if (initial && initial.length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      setTimeout(loadVoices, 300);
    }
  });
}

// Tự động khởi chạy ngay khi module được nạp để nạp sẵn giọng tự nhiên trước khi người dùng gõ
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  getEnglishVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    getEnglishVoices();
  };
}

async function speakWithSystemSpeech(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    return;
  }

  const { voiceURI, rate = 1.0, pitch = 1.0, onStart, onEnd } = options;

  window.speechSynthesis.cancel();

  // Đảm bảo cachedVoices đã nạp
  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    voices = await getEnglishVoices();
  }
  if (!voices || voices.length === 0) {
    voices = window.speechSynthesis.getVoices() || [];
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  utterance.pitch = Math.max(0.5, Math.min(2.0, Number(pitch) || 1.0));

  let selectedVoice = null;
  if (voiceURI && voices.length > 0) {
    selectedVoice = voices.find((v) => v.voiceURI === voiceURI);
  }
  // Bắt buộc chọn voice tiếng Anh chất lượng tốt nhất
  if (!selectedVoice && voices.length > 0) {
    selectedVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || voices[0] || null;
  }
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// 4. Microsoft Edge Neural TTS
// ---------------------------------------------------------------------------
async function speakWithEdgeTTS(text, options = {}) {
  const {
    edgeVoice = DEFAULT_EDGE_VOICE,
    rate = 1.0,
    pitch = 1.0,
    voiceURI,
    onStart,
    onEnd
  } = options;

  const fallbackToSystem = () => {
    speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
  };

  const cacheKey = getEdgeCacheKey(text, edgeVoice, rate);
  if (audioCache.has(cacheKey)) {
    const blobUrl = audioCache.get(cacheKey);
    playBlobUrl(blobUrl, onStart, onEnd, (err) => {
      console.warn('[Speech] Audio cache Edge-TTS bị lỗi, xóa cache và fallback sang giọng hệ thống:', err);
      audioCache.delete(cacheKey);
      try { URL.revokeObjectURL(blobUrl); } catch {}
      fallbackToSystem();
    });
    return;
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:5173';
    const url = `${baseUrl}/api/tts?text=${encodeURIComponent(text.trim())}&voice=${encodeURIComponent(edgeVoice)}&rate=${encodeURIComponent(rate)}`;
    const res = await fetch(url);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !contentType.includes('audio')) {
      throw new Error(`Edge-TTS trả về không hợp lệ (status: ${res.status}, type: ${contentType})`);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Edge-TTS trả về dữ liệu rỗng (0 bytes)');
    }
    const blobUrl = URL.createObjectURL(blob);

    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      const oldVal = audioCache.get(oldestKey);
      if (typeof oldVal === 'string' && oldVal.startsWith('blob:')) {
        try { URL.revokeObjectURL(oldVal); } catch {}
      }
      audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, blobUrl);

    playBlobUrl(blobUrl, onStart, onEnd, (playErr) => {
      console.warn('[Speech] Không thể phát âm thanh Edge-TTS, fallback sang giọng hệ thống:', playErr);
      audioCache.delete(cacheKey);
      try { URL.revokeObjectURL(blobUrl); } catch {}
      fallbackToSystem();
    });
  } catch (err) {
    console.warn('[Speech] Lỗi Edge-TTS, tự động fallback sang giọng hệ thống:', err);
    fallbackToSystem();
  }
}

// ---------------------------------------------------------------------------
// 5. Piper Neural TTS (VITS WASM)
// ---------------------------------------------------------------------------
async function speakWithPiperTTS(text, options = {}) {
  const {
    piperVoice = DEFAULT_PIPER_VOICE,
    rate = 1.0,
    pitch = 1.0,
    voiceURI,
    onStart,
    onEnd
  } = options;

  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
    return;
  }

  const cacheKey = getPiperCacheKey(text, piperVoice, rate);
  if (audioCache.has(cacheKey)) {
    const blobUrl = audioCache.get(cacheKey);
    playBlobUrl(blobUrl, onStart, onEnd);
    return;
  }

  try {
    const { predict, stored } = await import('@mintplex-labs/piper-tts-web');
    const existing = await stored();
    if (!existing.includes(piperVoice)) {
      await initPiper(piperVoice);
    }

    const blob = await predict({ text: text.trim(), voiceId: piperVoice });
    const blobUrl = URL.createObjectURL(blob);

    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      const oldVal = audioCache.get(oldestKey);
      if (typeof oldVal === 'string' && oldVal.startsWith('blob:')) {
        try { URL.revokeObjectURL(oldVal); } catch {}
      }
      audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, blobUrl);

    playBlobUrl(blobUrl, onStart, onEnd);
  } catch (err) {
    console.warn('[Speech] Lỗi Piper TTS, tự động fallback sang giọng hệ thống:', err);
    speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
  }
}

// ---------------------------------------------------------------------------
// Main speakEnglish API
// ---------------------------------------------------------------------------

/**
 * Phát âm thanh đọc câu tiếng Anh với động cơ được chọn
 * @param {string} text
 * @param {object} [options={}]
 * @param {'edge'|'system'|'piper'} [options.engine='edge']
 * @param {string} [options.edgeVoice='en-US-JennyNeural']
 * @param {string} [options.piperVoice='en_US-lessac-medium']
 * @param {string} [options.voiceURI]
 * @param {number} [options.rate=1.0]
 * @param {number} [options.pitch=1.0]
 * @param {() => void} [options.onStart]
 * @param {() => void} [options.onEnd]
 */
export async function speakEnglish(text, options = {}) {
  if (!text || typeof text !== 'string') return;

  const {
    engine = 'edge',
    edgeVoice = DEFAULT_EDGE_VOICE,
    piperVoice = DEFAULT_PIPER_VOICE,
    voiceURI,
    rate = 1.0,
    pitch = 1.0,
    onStart,
    onEnd
  } = options;

  switch (engine) {
    case 'edge':
      await speakWithEdgeTTS(text, { edgeVoice, rate, pitch, voiceURI, onStart, onEnd });
      break;

    case 'piper':
      await speakWithPiperTTS(text, { piperVoice, rate, pitch, voiceURI, onStart, onEnd });
      break;

    case 'system':
    default:
      await speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
      break;
  }
}

/**
 * Nạp trước âm thanh của câu văn trong nền (Background Pre-caching)
 */
export function preloadSpeech(text, options = {}) {
  if (!text || typeof text !== 'string') return;

  const {
    engine = 'edge',
    edgeVoice = DEFAULT_EDGE_VOICE,
    rate = 1.0
  } = options;

  if (engine === 'edge') {
    const cacheKey = getEdgeCacheKey(text, edgeVoice, rate);
    if (audioCache.has(cacheKey)) return;

    const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:5173';
    const url = `${baseUrl}/api/tts?text=${encodeURIComponent(text.trim())}&voice=${encodeURIComponent(edgeVoice)}&rate=${encodeURIComponent(rate)}`;
    fetch(url)
      .then((res) => {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || !contentType.includes('audio')) return null;
        return res.blob();
      })
      .then((blob) => {
        if (!blob || blob.size === 0) return;
        const blobUrl = URL.createObjectURL(blob);
        if (audioCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = audioCache.keys().next().value;
          const oldVal = audioCache.get(oldestKey);
          if (typeof oldVal === 'string' && oldVal.startsWith('blob:')) {
            try { URL.revokeObjectURL(oldVal); } catch {}
          }
          audioCache.delete(oldestKey);
        }
        audioCache.set(cacheKey, blobUrl);
      })
      .catch(() => {});
  }
}

/**
 * Dừng phát âm thanh (tất cả các nguồn)
 */
export function stopSpeech() {
  cleanupCurrentAudio();

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
