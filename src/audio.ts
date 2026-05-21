// Audio Synthesizer using Web Audio API for satisfying physical bead simulations.

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

export function playBeadSound(tone: 'wooden' | 'chime' | 'digital' | 'bowl', volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const dest = ctx.destination;

    // Master volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(dest);

    if (tone === 'wooden') {
      // Simulate real wooden bead striking another
      // Short high-passed click with exponential decay
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

      gainNode.gain.setValueAtTime(1.0, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      // Low pass filter to make it warmer/wooden
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.05);

    } else if (tone === 'chime') {
      // Crystal chime - high bell ring
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1200, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2400, now); // Harmonic

      gainNode.gain.setValueAtTime(0.6, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);

    } else if (tone === 'digital') {
      // Digital quick blip
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.015);

      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.06);

    } else if (tone === 'bowl') {
      // Deep tibetan singing bowl / temple bell sound
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const o3 = ctx.createOscillator();
      const g = ctx.createGain();

      o1.type = 'sine';
      o1.frequency.setValueAtTime(220, now); // Fundamental

      o2.type = 'sine';
      o2.frequency.setValueAtTime(330, now); // Perfect fifth/harmonics

      o3.type = 'sine';
      o3.frequency.setValueAtTime(440, now); // Octave

      g.gain.setValueAtTime(0.8, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      o1.connect(g);
      o2.connect(g);
      o3.connect(g);
      g.connect(masterGain);

      o1.start(now);
      o2.start(now);
      o3.start(now);
      o1.stop(now + 1.2);
      o2.stop(now + 1.2);
      o3.stop(now + 1.2);
    }
  } catch (err) {
    console.error('Failed to play bead sound:', err);
  }
}

// Special play completion chime
export function playCompletionSound(volume = 0.5) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const dest = ctx.destination;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 1.2, now);
    masterGain.connect(dest);

    // Beautiful ascending chime triad
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
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
