/**
 * Quản lý Speech Synthesis Đa Động Cơ (Multi-Engine TTS):
 * 1. Microsoft Edge Neural TTS (Cloud AI - Chuẩn phòng thu, ~200ms, 0MB)
 * 2. Web Speech API (Hệ thống / Enhanced - Tức thì 0ms, 0MB, 100% Offline)
 * 3. Piper Neural TTS (VITS WASM - Siêu nhẹ ~15MB, 100% Offline)
 * 4. Kokoro Neural AI (StyleTTS2 WASM Đa Luồng + SIMD, 100% Offline)
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
// 3. Cấu hình giọng Kokoro Neural TTS
// ---------------------------------------------------------------------------
export const KOKORO_VOICES = [
  { id: 'af_heart', name: 'Heart (Nữ Mỹ - Tự nhiên, Ấm áp)', lang: 'en-US', gender: 'female' },
  { id: 'af_bella', name: 'Bella (Nữ Mỹ - Tươi sáng)', lang: 'en-US', gender: 'female' },
  { id: 'am_adam', name: 'Adam (Nam Mỹ - Tự nhiên)', lang: 'en-US', gender: 'male' },
  { id: 'bf_emma', name: 'Emma (Nữ Anh - Chuẩn)', lang: 'en-GB', gender: 'female' },
  { id: 'bm_george', name: 'George (Nam Anh - Chuẩn)', lang: 'en-GB', gender: 'male' }
];

export const DEFAULT_KOKORO_VOICE = 'af_heart';

// ---------------------------------------------------------------------------
// Trạng thái và Listener cho Kokoro
// ---------------------------------------------------------------------------
let kokoroStatus = {
  state: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  progress: 0,
  device: null,
  error: null
};

const kokoroStatusListeners = new Set();

function notifyKokoroStatus() {
  for (const listener of kokoroStatusListeners) {
    try {
      listener({ ...kokoroStatus });
    } catch (err) {
      console.warn('[Speech] Lỗi trong listener Kokoro:', err);
    }
  }
}

export function subscribeKokoroStatus(listener) {
  kokoroStatusListeners.add(listener);
  listener({ ...kokoroStatus });
  return () => {
    kokoroStatusListeners.delete(listener);
  };
}

export function getKokoroStatus() {
  return { ...kokoroStatus };
}

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

function getKokoroCacheKey(text, voice, speed) {
  return `kokoro:${voice}:${Number(speed).toFixed(1)}:${text.trim().toLowerCase()}`;
}

function getEdgeCacheKey(text, voice, speed) {
  return `edge:${voice}:${Number(speed).toFixed(1)}:${text.trim().toLowerCase()}`;
}

function getPiperCacheKey(text, voice, speed) {
  return `piper:${voice}:${Number(speed).toFixed(1)}:${text.trim().toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Quản lý Web Worker (Kokoro)
// ---------------------------------------------------------------------------
let worker = null;
let reqCounter = 0;
const pendingRequests = new Map();

function getWorker() {
  if (typeof window === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('../workers/tts.worker.js', import.meta.url), {
        type: 'module'
      });

      worker.onmessage = (e) => {
        const { type, payload } = e.data || {};

        if (type === 'PROGRESS') {
          kokoroStatus.state = 'loading';
          if (typeof payload.progress === 'number') {
            const pct = Math.round(payload.progress <= 1 ? payload.progress * 100 : payload.progress);
            kokoroStatus.progress = Math.max(kokoroStatus.progress, pct);
          }
          notifyKokoroStatus();
        } else if (type === 'READY') {
          kokoroStatus.state = 'ready';
          kokoroStatus.progress = 100;
          kokoroStatus.device = payload?.device || 'wasm';
          kokoroStatus.error = null;
          notifyKokoroStatus();
        } else if (type === 'INIT_ERROR') {
          kokoroStatus.state = 'error';
          kokoroStatus.error = payload?.error || 'Không thể nạp mô hình KokoroTTS';
          notifyKokoroStatus();
        } else if (type === 'SYNTH_SUCCESS') {
          const { id, audioData, samplingRate } = payload || {};
          const resolver = pendingRequests.get(id);
          if (resolver) {
            pendingRequests.delete(id);
            resolver.resolve({ audioData, samplingRate });
          }
        } else if (type === 'SYNTH_ERROR') {
          const { id, error } = payload || {};
          const resolver = pendingRequests.get(id);
          if (resolver) {
            pendingRequests.delete(id);
            resolver.reject(new Error(error || 'Lỗi sinh âm thanh Kokoro'));
          }
        }
      };

      worker.onerror = (err) => {
        console.error('[Speech Worker Error]:', err);
        kokoroStatus.state = 'error';
        kokoroStatus.error = err.message || 'Worker error';
        notifyKokoroStatus();
      };
    } catch (err) {
      console.warn('[Speech] Không thể khởi tạo Web Worker:', err);
      kokoroStatus.state = 'error';
      kokoroStatus.error = err.message;
      notifyKokoroStatus();
      return null;
    }
  }
  return worker;
}

export function initKokoro() {
  if (typeof window === 'undefined') return;
  if (kokoroStatus.state === 'ready' || kokoroStatus.state === 'loading') return;

  const w = getWorker();
  if (!w) return;

  kokoroStatus.state = 'loading';
  kokoroStatus.progress = 0;
  notifyKokoroStatus();

  w.postMessage({ type: 'INIT' });
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

/**
 * Mã hóa dữ liệu Float32Array sang mảng byte 16-bit PCM WAV
 */
function encodeWAV16Bit(samples, sampleRate = 24000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM 16-bit
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function playKokoroAudio(audioData, samplingRate, onStart, onEnd) {
  if (typeof window === 'undefined') return;
  stopSpeech();

  try {
    const wavBuffer = encodeWAV16Bit(audioData, samplingRate);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    currentAudioUrl = url;

    playBlobUrl(url, onStart, onEnd);
  } catch (err) {
    console.error('[Speech] Lỗi phát âm thanh Kokoro:', err);
    cleanupCurrentAudio();
    if (onEnd) onEnd();
  }
}

// ---------------------------------------------------------------------------
// 4. Web Speech API (Hệ thống - Enhanced)
// ---------------------------------------------------------------------------
let cachedVoices = [];

/**
 * Lấy danh sách giọng đọc tiếng Anh, ưu tiên các giọng Enhanced/Natural
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

      // Ưu tiên các giọng chất lượng cao: Enhanced, Premium, Natural, Online, Google
      const sorted = [...pool].sort((a, b) => {
        const score = (v) => {
          const name = (v.name || '').toLowerCase();
          if (name.includes('enhanced') || name.includes('premium')) return 3;
          if (name.includes('natural') || name.includes('online')) return 2;
          if (name.includes('google') || name.includes('siri')) return 1;
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
      setTimeout(loadVoices, 500);
    }
  });
}

function speakWithSystemSpeech(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    return;
  }

  const { voiceURI, rate = 1.0, pitch = 1.0, onStart, onEnd } = options;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  utterance.pitch = Math.max(0.5, Math.min(2.0, Number(pitch) || 1.0));

  const voices = cachedVoices.length > 0 ? cachedVoices : (window.speechSynthesis.getVoices() || []);
  let selectedVoice = null;
  if (voiceURI && voices.length > 0) {
    selectedVoice = voices.find((v) => v.voiceURI === voiceURI);
  }
  // Bắt buộc chọn voice tiếng Anh để tránh trường hợp HĐH dùng voice mặc định đọc tiếng Anh
  if (!selectedVoice && voices.length > 0) {
    selectedVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || null;
  }
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// 5. Microsoft Edge Neural TTS
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
// 6. Piper Neural TTS (VITS WASM)
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
// 7. Kokoro TTS (StyleTTS2 WASM)
// ---------------------------------------------------------------------------
async function speakWithKokoro(text, options = {}) {
  const {
    kokoroVoice = DEFAULT_KOKORO_VOICE,
    rate = 1.0,
    pitch = 1.0,
    voiceURI,
    onStart,
    onEnd
  } = options;

  if (kokoroStatus.state !== 'ready') {
    if (kokoroStatus.state === 'idle') {
      initKokoro();
    }
    speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
    return;
  }

  const cacheKey = getKokoroCacheKey(text, kokoroVoice, rate);
  if (audioCache.has(cacheKey)) {
    const { audioData, samplingRate } = audioCache.get(cacheKey);
    playKokoroAudio(audioData, samplingRate, onStart, onEnd);
    return;
  }

  const w = getWorker();
  if (!w) {
    speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
    return;
  }

  const id = ++reqCounter;
  try {
    const synthPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Timeout tổng hợp giọng nói Kokoro'));
        }
      }, 60000);

      pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });
    });

    w.postMessage({
      type: 'SYNTHESIZE',
      payload: {
        id,
        text,
        voice: kokoroVoice,
        speed: rate
      }
    });

    const { audioData, samplingRate } = await synthPromise;

    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, { audioData, samplingRate });

    playKokoroAudio(audioData, samplingRate, onStart, onEnd);
  } catch (err) {
    console.warn('[Speech] Kokoro generation failed, fallback to system TTS:', err);
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
 * @param {'edge'|'system'|'piper'|'kokoro'} [options.engine='edge']
 * @param {string} [options.edgeVoice='en-US-JennyNeural']
 * @param {string} [options.piperVoice='en_US-lessac-medium']
 * @param {string} [options.kokoroVoice='af_heart']
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
    kokoroVoice = DEFAULT_KOKORO_VOICE,
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
      speakWithSystemSpeech(text, { voiceURI, rate, pitch, onStart, onEnd });
      break;

    case 'kokoro':
    default:
      await speakWithKokoro(text, { kokoroVoice, rate, pitch, voiceURI, onStart, onEnd });
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
    piperVoice = DEFAULT_PIPER_VOICE,
    kokoroVoice = DEFAULT_KOKORO_VOICE,
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
    return;
  }

  if (engine === 'kokoro') {
    if (kokoroStatus.state !== 'ready') return;
    const cacheKey = getKokoroCacheKey(text, kokoroVoice, rate);
    if (audioCache.has(cacheKey)) return;

    const w = getWorker();
    if (!w) return;

    const id = ++reqCounter;
    const synthPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Preload timeout'));
        }
      }, 45000);

      pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });
    });

    w.postMessage({
      type: 'SYNTHESIZE',
      payload: { id, text, voice: kokoroVoice, speed: rate }
    });

    synthPromise
      .then(({ audioData, samplingRate }) => {
        if (audioCache.size >= MAX_CACHE_SIZE) {
          const oldest = audioCache.keys().next().value;
          audioCache.delete(oldest);
        }
        audioCache.set(cacheKey, { audioData, samplingRate });
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
