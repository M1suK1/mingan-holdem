import type { ShowdownResult, VfxEvent } from './types.ts';

export type SoundCue =
  | 'flip'
  | 'swap'
  | 'check'
  | 'call'
  | 'raise'
  | 'raise-heavy'
  | 'fold'
  | 'hack'
  | 'scan-clean'
  | 'scan-caught'
  | 'skill'
  | 'win'
  | 'round-loss'
  | 'tie'
  | 'human-bankrupt'
  | 'ai-bankrupt'
  | 'bubble'
  | 'ui-click'
  | 'charge-tick'
  | 'wall-hit'
  | 'blade-slash';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.65,
};

const SOUND_STORAGE_KEY = 'mingan_cyber_sound_settings_v1';

export function sanitizeSoundSettings(
  input: Partial<SoundSettings> | null | undefined
): SoundSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_SOUND_SETTINGS.enabled;
  const rawVol = typeof input.volume === 'number' && Number.isFinite(input.volume)
    ? input.volume
    : DEFAULT_SOUND_SETTINGS.volume;
  const volume = Math.max(0, Math.min(1, Number(rawVol.toFixed(2))));
  return { enabled, volume };
}

export function loadSoundSettings(): SoundSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SOUND_SETTINGS };
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    return sanitizeSoundSettings(JSON.parse(raw) as Partial<SoundSettings>);
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  const clean = sanitizeSoundSettings(settings);
  cachedSettings = clean;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(clean.enabled ? clean.volume : 0, audioCtx.currentTime);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(clean));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function actionToSoundCue(
  action: (Pick<VfxEvent, 'type' | 'amount' | 'caught'> & { actor?: VfxEvent['actor']; label?: string }) | null | undefined
): SoundCue | null {
  if (!action) return null;
  if ((action.type === 'hack' || action.type === 'use-skill') && action.actor && action.actor !== 'human') {
    return null;
  }
  switch (action.type) {
    case 'flip':
      return 'flip';
    case 'swap':
      return 'swap';
    case 'check':
      return 'check';
    case 'call':
      return 'call';
    case 'raise':
      return (action.amount ?? 0) >= 80 ? 'raise-heavy' : 'raise';
    case 'fold':
      return 'fold';
    case 'hack':
      return 'hack';
    case 'scan':
      if (action.label?.includes('见切·燕返')) return 'blade-slash';
      return action.caught ? 'scan-caught' : 'scan-clean';
    case 'use-skill':
      return action.label?.includes('富兰克林之死') ? 'blade-slash' : 'skill';
    default:
      return null;
  }
}

export function showdownToSoundCue(
  result: Pick<ShowdownResult, 'winner' | 'reason'>,
  humanChips: number,
  aiChips: number
): SoundCue {
  if (humanChips <= 0) return 'human-bankrupt';
  if (aiChips <= 0) return 'ai-bankrupt';
  if (result.winner === 'human') return 'win';
  if (result.winner === 'ai') return 'round-loss';
  return 'tie';
}

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let cachedSettings: SoundSettings | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getActiveSettings(): SoundSettings {
  if (!cachedSettings) {
    cachedSettings = loadSoundSettings();
  }
  return cachedSettings;
}

function ensureAudioGraph(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioCtx) {
    audioCtx = new Ctor();
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
    compressor.knee.setValueAtTime(18, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.004, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    const s = getActiveSettings();
    masterGain.gain.setValueAtTime(s.enabled ? s.volume : 0, audioCtx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {
      /* ignore autoplay policy rejection before gesture */
    });
  }

  return masterGain ? { ctx: audioCtx, out: masterGain } : null;
}

export function unlockAudioContext(): void {
  const graph = ensureAudioGraph();
  if (!graph) return;
  if (graph.ctx.state === 'suspended') {
    void graph.ctx.resume().catch(() => {
      /* ignore */
    });
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const len = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buf;
  return buf;
}

function playTone(
  ctx: AudioContext,
  out: AudioNode,
  opts: {
    startOffset?: number;
    duration: number;
    freqStart: number;
    freqEnd?: number;
    type?: OscillatorType;
    gain?: number;
    filterHz?: number;
  }
): void {
  const t0 = ctx.currentTime + (opts.startOffset ?? 0);
  const t1 = t0 + Math.max(0.015, opts.duration);
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(Math.max(30, opts.freqStart), t0);
  if (opts.freqEnd !== undefined && opts.freqEnd !== opts.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.freqEnd), t1);
  }

  const peak = Math.max(0.01, Math.min(0.6, opts.gain ?? 0.2));
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t1);

  if (opts.filterHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.filterHz, t0);
    osc.connect(filter);
    filter.connect(amp);
  } else {
    osc.connect(amp);
  }

  amp.connect(out);
  osc.start(t0);
  osc.stop(t1 + 0.01);
}

function playNoiseSnap(
  ctx: AudioContext,
  out: AudioNode,
  opts: {
    startOffset?: number;
    duration: number;
    centerHz: number;
    q?: number;
    gain?: number;
  }
): void {
  const t0 = ctx.currentTime + (opts.startOffset ?? 0);
  const t1 = t0 + Math.max(0.015, opts.duration);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(opts.centerHz, t0);
  bp.Q.setValueAtTime(opts.q ?? 2.2, t0);

  const amp = ctx.createGain();
  const peak = Math.max(0.01, Math.min(0.45, opts.gain ?? 0.16));
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  amp.gain.exponentialRampToValueAtTime(0.0001, t1);

  src.connect(bp);
  bp.connect(amp);
  amp.connect(out);
  src.start(t0);
  src.stop(t1 + 0.01);
}

export function playSound(cue: SoundCue, opts?: { progress?: number }): boolean {
  const settings = getActiveSettings();
  if (!settings.enabled || settings.volume <= 0) return false;

  const graph = ensureAudioGraph();
  if (!graph) return false;
  const { ctx, out } = graph;
  out.gain.setValueAtTime(settings.volume, ctx.currentTime);

  switch (cue) {
    case 'flip':
      playNoiseSnap(ctx, out, { duration: 0.045, centerHz: 2200, gain: 0.18 });
      playTone(ctx, out, {
        duration: 0.075,
        freqStart: 480,
        freqEnd: 880,
        type: 'triangle',
        gain: 0.2,
      });
      return true;

    case 'swap':
      playTone(ctx, out, {
        duration: 0.09,
        freqStart: 320,
        freqEnd: 780,
        type: 'triangle',
        gain: 0.18,
      });
      playTone(ctx, out, {
        startOffset: 0.13,
        duration: 0.085,
        freqStart: 760,
        freqEnd: 520,
        type: 'square',
        gain: 0.12,
        filterHz: 2400,
      });
      return true;

    case 'check':
      playTone(ctx, out, { duration: 0.045, freqStart: 380, type: 'triangle', gain: 0.14 });
      playTone(ctx, out, { startOffset: 0.055, duration: 0.045, freqStart: 460, type: 'triangle', gain: 0.12 });
      return true;

    case 'call':
      playTone(ctx, out, { duration: 0.06, freqStart: 440, type: 'triangle', gain: 0.18 });
      playTone(ctx, out, { startOffset: 0.055, duration: 0.09, freqStart: 660, type: 'triangle', gain: 0.2 });
      return true;

    case 'raise':
      playTone(ctx, out, { duration: 0.055, freqStart: 523, type: 'square', gain: 0.12, filterHz: 2800 });
      playTone(ctx, out, { startOffset: 0.055, duration: 0.06, freqStart: 659, type: 'square', gain: 0.13, filterHz: 2800 });
      playTone(ctx, out, { startOffset: 0.11, duration: 0.11, freqStart: 880, type: 'triangle', gain: 0.2 });
      return true;

    case 'raise-heavy':
      playTone(ctx, out, { duration: 0.16, freqStart: 150, freqEnd: 62, type: 'sawtooth', gain: 0.24, filterHz: 650 });
      playTone(ctx, out, { startOffset: 0.03, duration: 0.07, freqStart: 587, type: 'square', gain: 0.14, filterHz: 3000 });
      playTone(ctx, out, { startOffset: 0.1, duration: 0.14, freqStart: 880, freqEnd: 1175, type: 'triangle', gain: 0.22 });
      return true;

    case 'fold':
      playTone(ctx, out, {
        duration: 0.19,
        freqStart: 440,
        freqEnd: 165,
        type: 'sawtooth',
        gain: 0.16,
        filterHz: 1100,
      });
      return true;

    case 'hack':
      playTone(ctx, out, { duration: 0.035, freqStart: 920, type: 'square', gain: 0.12, filterHz: 2600 });
      playTone(ctx, out, { startOffset: 0.035, duration: 0.035, freqStart: 1380, type: 'square', gain: 0.13, filterHz: 3000 });
      playTone(ctx, out, { startOffset: 0.07, duration: 0.035, freqStart: 740, type: 'square', gain: 0.11, filterHz: 2400 });
      playTone(ctx, out, { startOffset: 0.105, duration: 0.075, freqStart: 1540, freqEnd: 1180, type: 'triangle', gain: 0.16 });
      return true;

    case 'scan-clean':
      playTone(ctx, out, { duration: 0.15, freqStart: 440, freqEnd: 1140, type: 'sine', gain: 0.18 });
      playTone(ctx, out, { startOffset: 0.16, duration: 0.12, freqStart: 880, type: 'triangle', gain: 0.16 });
      return true;

    case 'scan-caught':
      playTone(ctx, out, { duration: 0.07, freqStart: 980, type: 'square', gain: 0.17, filterHz: 2600 });
      playTone(ctx, out, { startOffset: 0.08, duration: 0.07, freqStart: 1320, type: 'square', gain: 0.18, filterHz: 2800 });
      playTone(ctx, out, { startOffset: 0.16, duration: 0.16, freqStart: 980, freqEnd: 1480, type: 'sawtooth', gain: 0.18, filterHz: 2600 });
      return true;

    case 'skill':
      [523, 659, 784, 1046].forEach((hz, idx) => {
        playTone(ctx, out, {
          startOffset: idx * 0.045,
          duration: 0.09,
          freqStart: hz,
          type: 'triangle',
          gain: 0.16,
        });
      });
      return true;

    case 'win':
      [523, 659, 784, 1046].forEach((hz, idx) => {
        playTone(ctx, out, {
          startOffset: idx * 0.065,
          duration: idx === 3 ? 0.22 : 0.1,
          freqStart: hz,
          type: idx === 3 ? 'triangle' : 'square',
          gain: idx === 3 ? 0.22 : 0.12,
          filterHz: 2800,
        });
      });
      return true;

    case 'round-loss':
      playTone(ctx, out, { duration: 0.18, freqStart: 250, freqEnd: 105, type: 'sawtooth', gain: 0.2, filterHz: 900 });
      playNoiseSnap(ctx, out, { startOffset: 0.04, duration: 0.12, centerHz: 620, q: 1.4, gain: 0.14 });
      return true;

    case 'tie':
      playTone(ctx, out, { duration: 0.12, freqStart: 523, type: 'triangle', gain: 0.15 });
      playTone(ctx, out, { startOffset: 0.08, duration: 0.14, freqStart: 659, type: 'triangle', gain: 0.15 });
      return true;

    case 'human-bankrupt':
      playTone(ctx, out, { duration: 0.42, freqStart: 190, freqEnd: 46, type: 'sawtooth', gain: 0.28, filterHz: 620 });
      playTone(ctx, out, { startOffset: 0.08, duration: 0.34, freqStart: 320, freqEnd: 85, type: 'square', gain: 0.14, filterHz: 950 });
      playNoiseSnap(ctx, out, { duration: 0.24, centerHz: 480, q: 1.1, gain: 0.18 });
      return true;

    case 'ai-bankrupt':
      playNoiseSnap(ctx, out, { duration: 0.14, centerHz: 1800, q: 1.5, gain: 0.16 });
      [660, 880, 1175, 1320].forEach((hz, idx) => {
        playTone(ctx, out, {
          startOffset: 0.06 + idx * 0.055,
          duration: 0.15,
          freqStart: hz,
          type: 'triangle',
          gain: 0.18,
        });
      });
      return true;

    case 'bubble':
      playTone(ctx, out, { duration: 0.032, freqStart: 1120, freqEnd: 1360, type: 'sine', gain: 0.09 });
      return true;

    case 'ui-click':
      playTone(ctx, out, { duration: 0.024, freqStart: 840, freqEnd: 680, type: 'triangle', gain: 0.08 });
      return true;

    case 'charge-tick': {
      const pct = Math.max(0, Math.min(100, opts?.progress ?? 0));
      const hz = 320 + pct * 6.2;
      playTone(ctx, out, { duration: 0.036, freqStart: hz, type: 'triangle', gain: 0.14 });
      return true;
    }

    case 'wall-hit':
      playNoiseSnap(ctx, out, { duration: 0.075, centerHz: 1350, q: 1.6, gain: 0.24 });
      playTone(ctx, out, {
        duration: 0.15,
        freqStart: 195,
        freqEnd: 56,
        type: 'sawtooth',
        gain: 0.26,
        filterHz: 780,
      });
      playTone(ctx, out, {
        startOffset: 0.025,
        duration: 0.09,
        freqStart: 980,
        freqEnd: 410,
        type: 'square',
        gain: 0.14,
        filterHz: 2400,
      });
      return true;

    case 'blade-slash':
      // Razor air whoosh + sharp descending steel slash + metallic ring + severed link snap
      playNoiseSnap(ctx, out, { duration: 0.085, centerHz: 3400, q: 1.9, gain: 0.25 });
      playTone(ctx, out, {
        duration: 0.14,
        freqStart: 2400,
        freqEnd: 460,
        type: 'sawtooth',
        gain: 0.22,
        filterHz: 3800,
      });
      playTone(ctx, out, {
        startOffset: 0.03,
        duration: 0.18,
        freqStart: 1760,
        freqEnd: 1180,
        type: 'sine',
        gain: 0.14,
      });
      playTone(ctx, out, {
        startOffset: 0.045,
        duration: 0.09,
        freqStart: 220,
        freqEnd: 70,
        type: 'square',
        gain: 0.14,
        filterHz: 900,
      });
      return true;

    default:
      return false;
  }
}
