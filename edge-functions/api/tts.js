import { corsPreflight } from '../_lib/response.js';

let ttsInstance = null;

async function getMsEdgeTTS() {
  if (!ttsInstance) {
    const { MsEdgeTTS } = await import('msedge-tts');
    ttsInstance = new MsEdgeTTS();
  }
  return ttsInstance;
}

/**
 * Xử lý preflight CORS
 */
export async function onRequestOptions() {
  return corsPreflight();
}

/**
 * Handler GET /api/tts?text=...&voice=...&rate=...
 */
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const text = url.searchParams.get('text');
    const voice = url.searchParams.get('voice') || 'en-US-JennyNeural';
    const rate = parseFloat(url.searchParams.get('rate') || '1.0');

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Missing text parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const tts = await getMsEdgeTTS();
    const { OUTPUT_FORMAT } = await import('msedge-tts');

    // Chuyển rate số (0.5 - 1.5) thành định dạng rate phần trăm (+0%, +20%, -20%)
    const ratePct = Math.round((rate - 1.0) * 100);
    const rateStr = ratePct >= 0 ? `+${ratePct}%` : `${ratePct}%`;

    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text.trim(), { rate: rateStr });

    const chunks = [];
    const audioBuffer = await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', () => resolve(Buffer.concat(chunks)));
      audioStream.on('error', (err) => reject(err));
      // Timeout 15s nếu mạng nghẽn
      setTimeout(() => reject(new Error('Edge-TTS request timeout')), 15000);
    });

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (err) {
    console.error('[API /api/tts Error]:', err);
    return new Response(JSON.stringify({ error: err.message || 'TTS synthesis failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
