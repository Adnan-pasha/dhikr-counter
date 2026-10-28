// Bead sounds synthesised with the Web Audio API.
//
// Each tone is rendered once into an AudioBuffer (OfflineAudioContext) and replayed from that
// cache, so a tap costs one buffer source instead of building a new oscillator graph. The very
// first tap of a tone, before its buffer is ready, falls back to live synthesis.

import type { SoundTone } from './types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Seconds each tone rings for; also the length of its pre-rendered buffer. */
export const TONE_DURATION: Record<SoundTone, number> = {
  wooden: 0.06,
  chime: 0.32,
  digital: 0.07,
  bowl: 1.25,
};

/** Build one tone into `master` starting at `now`. Shared by live playback and offline rendering. */
function buildTone(ctx: BaseAudioContext, master: AudioNode, tone: SoundTone, now: number) {
  if (tone === 'wooden') {
    // Short, warm wooden click: a falling triangle through a low-pass filter.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (tone === 'chime') {
    // Crystal chime: a high sine with its octave.
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, now);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(master);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  } else if (tone === 'digital') {
    // Quick two-step blip.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.015);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (tone === 'bowl') {
    // Deep singing bowl: fundamental, fifth and octave.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    gain.connect(master);

    for (const freq of [220, 330, 440]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 1.2);
    }
  }
}

const SAMPLE_RATE = 44100;
const bufferCache = new Map<SoundTone, AudioBuffer>();
const pendingRenders = new Map<SoundTone, Promise<AudioBuffer | null>>();

/** Every pre-rendered tone is scaled to this peak so tones are equally loud and never clip. */
export const NORMALIZED_PEAK = 0.8;
const MAX_NORMALIZE_GAIN = 4;

export const peakOf = (data: Float32Array): number => {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  return peak;
};

/** Gain that brings a tone with the given peak to NORMALIZED_PEAK (bounded so noise is not boosted). */
export const normalizeScale = (peak: number): number => {
  if (peak <= 0) return 1;
  return Math.min(MAX_NORMALIZE_GAIN, NORMALIZED_PEAK / peak);
};

/** Render a tone to a mono buffer. Exported so it can be inspected in tests. */
export async function renderToneBuffer(tone: SoundTone): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * TONE_DURATION[tone]), SAMPLE_RATE);
  const master = offline.createGain();
  master.gain.setValueAtTime(1, 0);
  master.connect(offline.destination);
  buildTone(offline, master, tone, 0);
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  const scale = normalizeScale(peakOf(data));
  for (let i = 0; i < data.length; i += 1) data[i] *= scale;
  return rendered;
}

/** Start rendering a tone's buffer in the background (safe to call repeatedly). */
export function warmTone(tone: SoundTone): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(tone);
  if (cached) return Promise.resolve(cached);
  const pending = pendingRenders.get(tone);
  if (pending) return pending;

  const job = (typeof OfflineAudioContext === 'undefined'
    ? Promise.resolve(null)
    : renderToneBuffer(tone).then((buffer) => {
        bufferCache.set(tone, buffer);
        return buffer;
      })
  )
    .catch(() => null)
    .finally(() => pendingRenders.delete(tone));
  pendingRenders.set(tone, job);
  return job;
}

export function playBeadSound(tone: SoundTone, volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const buffer = bufferCache.get(tone);

    if (buffer) {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      return;
    }

    // Buffer not ready yet: play live this once and finish caching for the next tap.
    const master = ctx.createGain();
    master.gain.setValueAtTime(volume, ctx.currentTime);
    master.connect(ctx.destination);
    buildTone(ctx, master, tone, ctx.currentTime);
    void warmTone(tone);
  } catch (err) {
    console.error('Failed to play bead sound:', err);
  }
}

// Special play completion chime
export function playCompletionSound(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 1.2, now);
    masterGain.connect(ctx.destination);

    // Ascending chime: C5, E5, G5, C6.
    const freqs = [523.25, 659.25, 783.99, 1046.5];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(i === freqs.length - 1 ? 0.7 : 0.4, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.8);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.8);
    });
  } catch (err) {
    console.error('Failed to play completion sound:', err);
  }
}
