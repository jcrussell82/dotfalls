// ---------------------------------------------------------
// Audio — ambient, minimal, generative. No external files.
// Soft synth pad drone + light piano-ish tap chime + tiny
// impact tick + gentle wind (filtered noise). All built with
// WebAudio oscillators/noise buffers so the project stays
// dependency-free.
//
// Philosophy: audio should lower tension, not add to it.
// Everything is quiet, slow-attacked, and heavily filtered.
// ---------------------------------------------------------

const Audio_ = (() => {
  let ctx = null;
  let master = null;
  let padGain = null;
  let windGain = null;
  let windNoise = null;
  let started = false;
  let enabled = true;

  const NOTE_POOL = [261.63, 293.66, 329.63, 392.00, 440.00]; // C D E G A — open, calm

  function ensureContext() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }

  function makeNoiseBuffer() {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function startAmbient() {
    if (!enabled) return;
    ensureContext();
    if (!ctx || started) return;
    started = true;
    if (ctx.state === 'suspended') ctx.resume();

    // Soft synth pad drone: two detuned slow oscillators through a low-pass filter.
    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    filter.connect(padGain);

    [220, 220.6].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    });

    padGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4);

    // Gentle wind: filtered noise, very quiet, slowly swelling.
    windNoise = ctx.createBufferSource();
    windNoise.buffer = makeNoiseBuffer();
    windNoise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windNoise.start();
    windGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 6);
  }

  function setIntensity(t) {
    // t in [0,1] — as chaos rises, let the wind breathe a little more,
    // but keep it subtle. This is the only place intensity affects audio.
    if (!windGain) return;
    const target = Utils.lerp(0.02, 0.05, Utils.clamp(t, 0, 1));
    windGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
  }

  function pause() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Tiny, soft piano-like chime on tap/split.
  function playTap() {
    if (!enabled) return;
    ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const freq = NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)] * 2;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  // Tiny impact sound for a lost dot — soft, low, brief.
  function playLoss() {
    if (!enabled) return;
    ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  return { startAmbient, setIntensity, pause, resume, playTap, playLoss };
})();
