// Synthesised sound effects, all WebAudio, no audio files: short plucks,
// thuds and chimes built from oscillators and filtered noise. The context
// is created lazily on the first user gesture, so loading the page stays
// silent; every call is a no-op while muted or before that first gesture.
// Nothing here fetches or decodes a file, so the game stays fully offline.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      context = new Ctor();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  function noise(dur, gain, filterFreq, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp).connect(ctx.destination);
    source.start(start);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(660, 0.06, 'sine', 0.12);
    },
    playCard() {
      noise(0.12, 0.25, 2400);
      tone(392, 0.12, 'triangle', 0.18, 0, 523);
    },
    hit(hard) {
      tone(hard ? 110 : 160, 0.22, 'sine', 0.5, 0, 55);
      noise(0.15, hard ? 0.4 : 0.25, 900);
    },
    shield() {
      tone(880, 0.18, 'sine', 0.15, 0, 1174);
      tone(1318, 0.12, 'sine', 0.08, 0.05);
    },
    heal() {
      tone(523, 0.25, 'sine', 0.14);
      tone(659, 0.3, 'sine', 0.14, 0.09);
    },
    draw() {
      tone(988, 0.05, 'square', 0.05);
    },
    ward() {
      tone(330, 0.15, 'triangle', 0.16, 0, 440);
    },
    turn() {
      tone(440, 0.1, 'triangle', 0.12);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.2, i * 0.12));
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.4, 'sine', 0.18, i * 0.14));
    },
  };
}
