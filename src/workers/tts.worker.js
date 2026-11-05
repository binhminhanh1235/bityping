import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';

// Tối ưu hóa WebAssembly đa luồng (multi-threading) và SIMD khi trình duyệt hỗ trợ SharedArrayBuffer
if (env?.backends?.onnx?.wasm) {
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
  env.backends.onnx.wasm.numThreads = Math.max(2, Math.min(8, cores));
  env.backends.onnx.wasm.simd = true;
  console.debug(`[KokoroTTS Worker] Khởi tạo WASM với ${env.backends.onnx.wasm.numThreads} luồng (threads), SIMD: ${env.backends.onnx.wasm.simd}`);
}

let ttsInstance = null;
let isInitializing = false;
let initError = null;

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const CURATED_VOICES = ['af_heart', 'af_bella', 'am_adam', 'bf_emma', 'bm_george'];

/**
 * Nạp sẵn các file giọng đọc (.bin) từ thư mục nội bộ /voices/ vào Cache API
 * Điều này tránh việc trình duyệt phải tải chậm hoặc bị chặn từ CDN quốc tế của Hugging Face
 */
async function preloadVoicesIntoCache() {
  if (typeof caches === 'undefined') return;
  const EXPECTED_VOICE_SIZE = 522240; // 510KB chuẩn cho mỗi file .bin
  try {
    const cache = await caches.open('kokoro-voices');
    await Promise.all(
      CURATED_VOICES.map(async (voice) => {
        const hfUrl = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${voice}.bin`;
        try {
          const exists = await cache.match(hfUrl);
          let needsRecache = !exists;
          if (exists) {
            const buf = await exists.clone().arrayBuffer();
            if (buf.byteLength !== EXPECTED_VOICE_SIZE) {
              console.warn(`[KokoroTTS Worker] Voice ${voice} cache hỏng hoặc sai dung lượng (${buf.byteLength} vs ${EXPECTED_VOICE_SIZE}), tải lại...`);
              await cache.delete(hfUrl);
              needsRecache = true;
            }
          }
          if (needsRecache) {
            const localRes = await fetch(`/voices/${voice}.bin`);
            if (localRes.ok) {
              const buffer = await localRes.arrayBuffer();
              await cache.put(
                hfUrl,
                new Response(buffer, {
                  headers: { 'Content-Type': 'application/octet-stream' }
                })
              );
            }
          }
        } catch {
          // Bỏ qua nếu có lỗi nhỏ với từng file voice
        }
      })
    );
  } catch (err) {
    console.warn('[KokoroTTS Worker] Không thể nạp trước voice cache:', err);
  }
}

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};

  if (type === 'INIT') {
    if (ttsInstance) {
      self.postMessage({ type: 'READY', payload: { modelId: MODEL_ID } });
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    initError = null;

    try {
      // QUAN TRỌNG: Kokoro model với quantization 'q8' KHÔNG tương thích với WebGPU trong ONNX Runtime Web.
      // WebGPU int8 dequantize/matmul kernels bị lỗi độ chính xác số học (numerical precision/overflow),
      // dẫn đến âm thanh đầu ra bị méo giọng cực nặng, ngữ điệu lơ lớ nghe như tiếng Thái / Trung / Sims.
      // Tài liệu chính thức kokoro-js nêu rõ: với dtype 'q8', device BẮT BUỘC là 'wasm'.
      // WebAssembly multi-threaded xử lý phép tính q8 an toàn, chuẩn xác 100% âm sắc tiếng Anh bản ngữ.
      const device = 'wasm';

      self.postMessage({ type: 'PROGRESS', payload: { status: 'loading', progress: 0 } });

      ttsInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: device,
        progress_callback: (progressData) => {
          if (progressData && typeof progressData === 'object') {
            self.postMessage({
              type: 'PROGRESS',
              payload: {
                status: progressData.status || 'downloading',
                progress: progressData.progress || 0,
                file: progressData.file || '',
                loaded: progressData.loaded || 0,
                total: progressData.total || 0
              }
            });
          }
        }
      });

      // Nạp sẵn giọng đọc nội bộ vào cache
      await preloadVoicesIntoCache();

      // Khởi động trước (Warm-up) để phonemizer và ONNX session sẵn sàng
      try {
        self.postMessage({ type: 'PROGRESS', payload: { status: 'warming', progress: 95 } });
        await ttsInstance.generate('Ready', { voice: 'af_heart' });
      } catch (warmupErr) {
        console.warn('[KokoroTTS Worker] Warm-up warning:', warmupErr);
      }

      isInitializing = false;
      self.postMessage({ type: 'READY', payload: { modelId: MODEL_ID, device } });
    } catch (err) {
      isInitializing = false;
      initError = err.message || String(err);
      console.error('[KokoroTTS Worker] Lỗi khởi tạo mô hình:', err);
      self.postMessage({ type: 'INIT_ERROR', payload: { error: initError } });
    }
    return;
  }

  if (type === 'SYNTHESIZE') {
    const { id, text, voice = 'af_heart', speed = 1.0 } = payload || {};

    if (!ttsInstance) {
      self.postMessage({
        type: 'SYNTH_ERROR',
        payload: { id, error: 'Mô hình KokoroTTS chưa được nạp sẵn sàng.' }
      });
      return;
    }

    try {
      const startTime = performance.now();
      const rawAudio = await ttsInstance.generate(text, {
        voice,
        speed: Math.max(0.5, Math.min(2.0, Number(speed) || 1.0))
      });
      const duration = (performance.now() - startTime).toFixed(0);
      console.debug(`[KokoroTTS Worker] Tổng hợp thành công câu trong ${duration}ms: "${text.slice(0, 35)}..."`);

      const audioBuffer = rawAudio.audio; // Float32Array
      const samplingRate = rawAudio.sampling_rate || 24000;

      // Chuyển raw audio buffer dạng transferable object để tối ưu hiệu năng
      self.postMessage(
        {
          type: 'SYNTH_SUCCESS',
          payload: {
            id,
            audioData: audioBuffer,
            samplingRate
          }
        },
        [audioBuffer.buffer]
      );
    } catch (err) {
      console.error('[KokoroTTS Worker] Lỗi tổng hợp giọng nói:', err);
      self.postMessage({
        type: 'SYNTH_ERROR',
        payload: { id, error: err.message || String(err) }
      });
    }
  }
};
