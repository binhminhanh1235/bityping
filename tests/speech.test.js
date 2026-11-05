import { describe, it, expect } from 'vitest';
import {
  EDGE_VOICES,
  DEFAULT_EDGE_VOICE,
  PIPER_VOICES,
  DEFAULT_PIPER_VOICE,
  KOKORO_VOICES,
  DEFAULT_KOKORO_VOICE,
  getKokoroStatus,
  subscribeKokoroStatus,
  getPiperStatus,
  subscribePiperStatus,
  speakEnglish,
  preloadSpeech,
  stopSpeech,
  getEnglishVoices
} from '../src/lib/speech.js';

describe('speech.js - Multi-Engine TTS integration', () => {
  it('should export curated EDGE_VOICES and DEFAULT_EDGE_VOICE', () => {
    expect(DEFAULT_EDGE_VOICE).toBe('en-US-JennyNeural');
    expect(Array.isArray(EDGE_VOICES)).toBe(true);
    expect(EDGE_VOICES.length).toBeGreaterThanOrEqual(6);

    const ids = EDGE_VOICES.map((v) => v.id);
    expect(ids).toContain('en-US-JennyNeural');
    expect(ids).toContain('en-US-GuyNeural');
    expect(ids).toContain('en-US-AriaNeural');
  });

  it('should export curated PIPER_VOICES and DEFAULT_PIPER_VOICE', () => {
    expect(DEFAULT_PIPER_VOICE).toBe('en_US-lessac-medium');
    expect(Array.isArray(PIPER_VOICES)).toBe(true);
    expect(PIPER_VOICES.length).toBeGreaterThanOrEqual(4);

    const ids = PIPER_VOICES.map((v) => v.id);
    expect(ids).toContain('en_US-lessac-medium');
    expect(ids).toContain('en_US-amy-low');
  });

  it('should export curated KOKORO_VOICES and DEFAULT_KOKORO_VOICE', () => {
    expect(DEFAULT_KOKORO_VOICE).toBe('af_heart');
    expect(Array.isArray(KOKORO_VOICES)).toBe(true);
    expect(KOKORO_VOICES.length).toBeGreaterThanOrEqual(5);

    const ids = KOKORO_VOICES.map((v) => v.id);
    expect(ids).toContain('af_heart');
    expect(ids).toContain('af_bella');
    expect(ids).toContain('am_adam');
    expect(ids).toContain('bf_emma');
    expect(ids).toContain('bm_george');
  });

  it('should report initial kokoro status and allow subscription', () => {
    const status = getKokoroStatus();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('progress');

    let listenerCallCount = 0;
    const unsub = subscribeKokoroStatus((s) => {
      listenerCallCount++;
      expect(s).toHaveProperty('state');
    });

    expect(listenerCallCount).toBeGreaterThanOrEqual(1);
    unsub();
  });

  it('should report initial piper status and allow subscription', () => {
    const status = getPiperStatus();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('progress');

    let listenerCallCount = 0;
    const unsub = subscribePiperStatus((s) => {
      listenerCallCount++;
      expect(s).toHaveProperty('state');
    });

    expect(listenerCallCount).toBeGreaterThanOrEqual(1);
    unsub();
  });

  it('should handle speakEnglish without crashing across all engines in test environment', async () => {
    // When text is empty, returns early
    await expect(speakEnglish('')).resolves.toBeUndefined();
    await expect(speakEnglish(null)).resolves.toBeUndefined();

    // System engine
    await expect(
      speakEnglish('Hello world', { engine: 'system', rate: 1.0 })
    ).resolves.toBeUndefined();

    // Edge engine
    await expect(
      speakEnglish('Hello world', { engine: 'edge', edgeVoice: DEFAULT_EDGE_VOICE, rate: 1.0 })
    ).resolves.toBeUndefined();

    // Piper engine
    await expect(
      speakEnglish('Hello world', { engine: 'piper', piperVoice: DEFAULT_PIPER_VOICE, rate: 1.0 })
    ).resolves.toBeUndefined();

    // Kokoro engine
    await expect(
      speakEnglish('Hello world', { engine: 'kokoro', kokoroVoice: DEFAULT_KOKORO_VOICE, rate: 1.0 })
    ).resolves.toBeUndefined();
  });

  it('should handle preloadSpeech without crashing across all engines', () => {
    expect(() => preloadSpeech('Hello world', { engine: 'edge' })).not.toThrow();
    expect(() => preloadSpeech('Hello world', { engine: 'piper' })).not.toThrow();
    expect(() => preloadSpeech('Hello world', { engine: 'kokoro' })).not.toThrow();
  });

  it('should handle stopSpeech without crashing', () => {
    expect(() => stopSpeech()).not.toThrow();
  });

  it('should resolve getEnglishVoices gracefully', async () => {
    const voices = await getEnglishVoices();
    expect(Array.isArray(voices)).toBe(true);
  });
});
