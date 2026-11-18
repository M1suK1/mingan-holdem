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
  | 'blade-slash'
  | 'fire-burn'
  | 'rewind-crack'
  | 'rewind-shatter'
  | 'alarm-siren'
  | 'popup-alert'
  | 'wexin-ping';

export interface SoundSettings {
  enabled: boolean;
  volume: number;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.65,
};

export type BgmSceneId =
  | 'desktop'
  | 'escape-map'
  | 'story-vn'
  | 'table-calm'
  | 'table-tension';

export interface BgmSettings {
  enabled: boolean;
  volume: number;
}

export const DEFAULT_BGM_SETTINGS: BgmSettings = {
  enabled: true,
  volume: 0.55,
};

export interface BgmTrackMeta {
  title: string;
  subtitle: string;
  bpm: number;
}

export const BGM_TRACK_META: Record<BgmSceneId, BgmTrackMeta> = {
  desktop: {
    title: 'MINGAN-OS // 凌晨待机',
    subtitle: '现实主机底噪与电波微光',
    bpm: 88,
  },
  'escape-map': {
    title: 'NEURAL-MESH // 暗网潜行',
    subtitle: '路由规划与防火墙渗透脉冲',
    bpm: 104,
  },
  'story-vn': {
    title: 'ECHO-0 // 共情残响',
    subtitle: '记忆碎片与夜色合成琴音',
    bpm: 80,
  },
  'table-calm': {
    title: 'BLACK-DOMAIN // 双花博弈',
    subtitle: '低频暗涌与心理牌桌律动',
    bpm: 114,
  },
  'table-tension': {
    title: 'CRITICAL-OVERCLOCK // 零号死斗',
    subtitle: '全火符暴走与高频压迫脉冲',
    bpm: 134,
  },
};

export interface BgmSceneContext {
  viewMode: 'desktop' | 'terminal-login' | 'escape-map' | 'arena';
  activeVnKind?: string | null;
  activeEscapeNodeIndex?: number | null;
  sec04ClimaxPhase?: string | null;
  isBossBerserk?: boolean;
  isDangerCompute?: boolean;
  isOfflineDisconnected?: boolean;
}

export function resolveBgmScene(ctx: BgmSceneContext): BgmSceneId {
  if (ctx.isOfflineDisconnected) {
    return 'desktop';
  }
  if (ctx.activeVnKind === 'sec04-berserk') {
    return 'table-tension';
  }
  if (ctx.activeVnKind) {
    return 'story-vn';
  }
  if (ctx.viewMode === 'desktop' || ctx.viewMode === 'terminal-login') {
    return 'desktop';
  }
  if (ctx.viewMode === 'escape-map') {
    return 'escape-map';
  }
  if (ctx.sec04ClimaxPhase && ctx.sec04ClimaxPhase !== 'idle') {
    return 'table-tension';
  }
  if (ctx.activeEscapeNodeIndex === 4 || ctx.isBossBerserk || ctx.isDangerCompute) {
    return 'table-tension';
  }
  return 'table-calm';
}

const SOUND_STORAGE_KEY = 'mingan_cyber_sound_settings_v1';
const BGM_STORAGE_KEY = 'mingan_cyber_bgm_settings_v1';
const BGM_MIX_HEADROOM = 0.42;

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

export function sanitizeBgmSettings(
  input: Partial<BgmSettings> | null | undefined
): BgmSettings {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_BGM_SETTINGS };
  }
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_BGM_SETTINGS.enabled;
  const rawVol = typeof input.volume === 'number' && Number.isFinite(input.volume)
    ? input.volume
    : DEFAULT_BGM_SETTINGS.volume;
  const volume = Math.max(0, Math.min(1, Number(rawVol.toFixed(2))));
  return { enabled, volume };
}

export function loadBgmSettings(): BgmSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BGM_SETTINGS };
    const raw = localStorage.getItem(BGM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BGM_SETTINGS };
    return sanitizeBgmSettings(JSON.parse(raw) as Partial<BgmSettings>);
  } catch {
    return { ...DEFAULT_BGM_SETTINGS };
  }
}

export function saveBgmSettings(settings: BgmSettings): void {
  const clean = sanitizeBgmSettings(settings);
  cachedBgmSettings = clean;
  applyBgmMasterGain();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BGM_STORAGE_KEY, JSON.stringify(clean));
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
  if (action.label?.includes('灼心·火符')) {
    return 'fire-burn';
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
let bgmMasterGain: GainNode | null = null;
let bgmTrackGain: GainNode | null = null;
let cachedSettings: SoundSettings | null = null;
let cachedBgmSettings: BgmSettings | null = null;
let noiseBuffer: AudioBuffer | null = null;

let desiredBgmScene: BgmSceneId | null = null;
let playingBgmScene: BgmSceneId | null = null;
let bgmStepIndex = 0;
let bgmNextStepTime = 0;
let bgmSchedulerTimer: number | null = null;
let visibilityHooked = false;

function getActiveSettings(): SoundSettings {
  if (!cachedSettings) {
    cachedSettings = loadSoundSettings();
  }
  return cachedSettings;
}

function getActiveBgmSettings(): BgmSettings {
  if (!cachedBgmSettings) {
    cachedBgmSettings = loadBgmSettings();
  }
  return cachedBgmSettings;
}

function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

function computeTargetBgmLevel(): number {
  const b = getActiveBgmSettings();
  if (!b.enabled || isPageHidden() || !desiredBgmScene) return 0;
  return Number((b.volume * BGM_MIX_HEADROOM).toFixed(4));
}

function applyBgmMasterGain(rampSec = 0.08): void {
  if (!bgmMasterGain || !audioCtx) return;
  const now = audioCtx.currentTime;
  const target = computeTargetBgmLevel();
  try {
    bgmMasterGain.gain.cancelScheduledValues(now);
    bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, now);
    bgmMasterGain.gain.linearRampToValueAtTime(target, now + Math.max(0.02, rampSec));
  } catch {
    bgmMasterGain.gain.setValueAtTime(target, now);
  }
}

function ensureVisibilityListener(): void {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return;
    if (document.hidden) {
      applyBgmMasterGain(0.12);
    } else {
      bgmNextStepTime = audioCtx.currentTime + 0.06;
      applyBgmMasterGain(0.24);
    }
  });
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

    bgmMasterGain = audioCtx.createGain();
    bgmMasterGain.gain.setValueAtTime(computeTargetBgmLevel(), audioCtx.currentTime);
    bgmMasterGain.connect(compressor);

    bgmTrackGain = audioCtx.createGain();
    bgmTrackGain.gain.setValueAtTime(1, audioCtx.currentTime);
    bgmTrackGain.connect(bgmMasterGain);

    compressor.connect(audioCtx.destination);
    ensureVisibilityListener();
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
  if (graph.ctx.state === 'running') {
    syncBgmScheduler();
    return;
  }
  if (graph.ctx.state === 'suspended') {
    void graph.ctx
      .resume()
      .then(() => {
        syncBgmScheduler();
      })
      .catch(() => {
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

    case 'fire-burn':
      // Ignition flame whoosh + crackling embers + low burn impact
      playNoiseSnap(ctx, out, { duration: 0.36, centerHz: 680, q: 1.2, gain: 0.28 });
      playNoiseSnap(ctx, out, { startOffset: 0.04, duration: 0.08, centerHz: 2600, q: 1.8, gain: 0.16 });
      playNoiseSnap(ctx, out, { startOffset: 0.14, duration: 0.09, centerHz: 3100, q: 2.0, gain: 0.14 });
      playTone(ctx, out, {
        duration: 0.24,
        freqStart: 195,
        freqEnd: 56,
        type: 'sawtooth',
        gain: 0.18,
        filterHz: 520,
      });
      return true;

    case 'rewind-crack':
      // Brittle crystal-digital fracture + warning chime drop
      playNoiseSnap(ctx, out, { duration: 0.06, centerHz: 2800, q: 2.2, gain: 0.2 });
      playTone(ctx, out, {
        duration: 0.11,
        freqStart: 1480,
        freqEnd: 620,
        type: 'triangle',
        gain: 0.18,
      });
      playTone(ctx, out, {
        startOffset: 0.045,
        duration: 0.12,
        freqStart: 420,
        freqEnd: 185,
        type: 'sawtooth',
        gain: 0.15,
        filterHz: 1100,
      });
      return true;

    case 'rewind-shatter':
      // Full anchor glass-circuit shatter + sub-channel power collapse
      playNoiseSnap(ctx, out, { duration: 0.14, centerHz: 3600, q: 1.5, gain: 0.28 });
      playNoiseSnap(ctx, out, { startOffset: 0.09, duration: 0.16, centerHz: 1750, q: 1.3, gain: 0.22 });
      playTone(ctx, out, {
        duration: 0.26,
        freqStart: 1240,
        freqEnd: 110,
        type: 'sawtooth',
        gain: 0.24,
        filterHz: 1600,
      });
      playTone(ctx, out, {
        startOffset: 0.06,
        duration: 0.32,
        freqStart: 240,
        freqEnd: 48,
        type: 'square',
        gain: 0.16,
        filterHz: 680,
      });
      return true;

    case 'alarm-siren':
      // Dual-pulse high-priority cyber security breach siren
      playTone(ctx, out, {
        duration: 0.16,
        freqStart: 880,
        freqEnd: 1320,
        type: 'square',
        gain: 0.16,
        filterHz: 2600,
      });
      playTone(ctx, out, {
        startOffset: 0.18,
        duration: 0.16,
        freqStart: 1320,
        freqEnd: 780,
        type: 'sawtooth',
        gain: 0.15,
        filterHz: 2400,
      });
      playTone(ctx, out, {
        startOffset: 0.36,
        duration: 0.18,
        freqStart: 920,
        freqEnd: 1380,
        type: 'square',
        gain: 0.15,
        filterHz: 2600,
      });
      return true;

    case 'popup-alert':
      // Classic Win98-cyber system warning popup double chime (low stern pulse + crisp high alert tone)
      playTone(ctx, out, {
        duration: 0.11,
        freqStart: 523.25,
        freqEnd: 440,
        type: 'square',
        gain: 0.18,
        filterHz: 2200,
      });
      playTone(ctx, out, {
        startOffset: 0.095,
        duration: 0.22,
        freqStart: 880,
        freqEnd: 830,
        type: 'triangle',
        gain: 0.22,
        filterHz: 3200,
      });
      return true;

    case 'wexin-ping':
      // Crisp two-note instant messenger notification bell (B5 -> E6)
      playTone(ctx, out, {
        duration: 0.09,
        freqStart: 987.77,
        freqEnd: 987.77,
        type: 'sine',
        gain: 0.2,
      });
      playTone(ctx, out, {
        startOffset: 0.085,
        duration: 0.22,
        freqStart: 1318.51,
        freqEnd: 1318.51,
        type: 'triangle',
        gain: 0.22,
        filterHz: 4200,
      });
      return true;

    default:
      return false;
  }
}

// =========================================================================
// Procedural Cyber-Noir Web Audio BGM Synthesizer & Scene Sequencer
// 100% original mathematical synthesis, zero external audio assets.
// =========================================================================

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playBgmPadChord(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  midis: readonly number[],
  durationSec: number,
  gain = 0.085,
  cutoffHz = 780
): void {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoffHz, when);
  filter.frequency.linearRampToValueAtTime(cutoffHz * 1.35, when + durationSec * 0.45);
  filter.frequency.linearRampToValueAtTime(cutoffHz * 0.85, when + durationSec);
  filter.Q.setValueAtTime(0.9, when);

  const env = ctx.createGain();
  const attack = Math.min(0.45, durationSec * 0.25);
  const peak = gain / Math.max(1, Math.sqrt(midis.length));
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peak, when + attack);
  env.gain.setValueAtTime(peak * 0.86, Math.max(when + attack, when + durationSec * 0.72));
  env.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);

  filter.connect(env);
  env.connect(out);

  for (let i = 0; i < midis.length; i += 1) {
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(midiToFreq(midis[i]), when);
    osc.detune.setValueAtTime(i % 2 === 0 ? -4 : 4, when);
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + durationSec + 0.04);
  }
}

function playBgmBass(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  midi: number,
  durationSec: number,
  options?: { gain?: number; waveform?: OscillatorType; cutoffHz?: number }
): void {
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  const freq = midiToFreq(midi);
  osc.type = options?.waveform ?? 'sawtooth';
  osc.frequency.setValueAtTime(freq, when);
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq, when);

  const cutoff = options?.cutoffHz ?? 460;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff * 1.65, when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(110, cutoff * 0.6), when + durationSec);
  filter.Q.setValueAtTime(2.4, when);

  const peak = options?.gain ?? 0.2;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peak, when + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);

  osc.connect(filter);
  sub.connect(filter);
  filter.connect(env);
  env.connect(out);

  osc.start(when);
  sub.start(when);
  osc.stop(when + durationSec + 0.02);
  sub.stop(when + durationSec + 0.02);
}

function playBgmPluck(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  midi: number,
  durationSec: number,
  options?: { gain?: number; waveform?: OscillatorType; cutoffHz?: number; shimmer?: boolean }
): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();

  const freq = midiToFreq(midi);
  osc.type = options?.waveform ?? 'triangle';
  osc.frequency.setValueAtTime(freq, when);

  const cutoff = options?.cutoffHz ?? 2600;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(420, cutoff * 0.35), when + durationSec);

  const peak = options?.gain ?? 0.12;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peak, when + 0.014);
  env.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);

  osc.connect(filter);
  filter.connect(env);
  env.connect(out);
  osc.start(when);
  osc.stop(when + durationSec + 0.03);

  if (options?.shimmer) {
    const overtone = ctx.createOscillator();
    const overEnv = ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, when);
    overEnv.gain.setValueAtTime(0.0001, when);
    overEnv.gain.linearRampToValueAtTime(peak * 0.28, when + 0.016);
    overEnv.gain.exponentialRampToValueAtTime(0.0001, when + durationSec * 0.72);
    overtone.connect(overEnv);
    overEnv.connect(out);
    overtone.start(when);
    overtone.stop(when + durationSec * 0.75 + 0.02);
  }
}

function playBgmKick(ctx: AudioContext, out: AudioNode, when: number, gain = 0.22): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(118, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.11);

  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(gain, when + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);

  osc.connect(env);
  env.connect(out);
  osc.start(when);
  osc.stop(when + 0.18);
}

function playBgmSnare(ctx: AudioContext, out: AudioNode, when: number, gain = 0.11): void {
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.setValueAtTime(2100, when);
  hp.Q.setValueAtTime(0.9, when);
  const nEnv = ctx.createGain();
  nEnv.gain.setValueAtTime(0.0001, when);
  nEnv.gain.linearRampToValueAtTime(gain, when + 0.005);
  nEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);
  noiseSrc.connect(hp);
  hp.connect(nEnv);
  nEnv.connect(out);
  noiseSrc.start(when);
  noiseSrc.stop(when + 0.13);

  const body = ctx.createOscillator();
  const bEnv = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(185, when);
  body.frequency.exponentialRampToValueAtTime(92, when + 0.065);
  bEnv.gain.setValueAtTime(0.0001, when);
  bEnv.gain.linearRampToValueAtTime(gain * 0.65, when + 0.004);
  bEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.075);
  body.connect(bEnv);
  bEnv.connect(out);
  body.start(when);
  body.stop(when + 0.09);
}

function playBgmHat(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  options?: { gain?: number; duration?: number; cutoffHz?: number }
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(options?.cutoffHz ?? 6200, when);
  const env = ctx.createGain();
  const dur = options?.duration ?? 0.032;
  const peak = options?.gain ?? 0.045;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peak, when + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(hp);
  hp.connect(env);
  env.connect(out);
  src.start(when);
  src.stop(when + dur + 0.02);
}

const DESKTOP_CHORDS: readonly (readonly number[])[] = [
  [50, 53, 57, 64], // Dm9
  [46, 50, 53, 57], // Bbmaj7
  [43, 46, 50, 57], // Gm9
  [45, 50, 52, 55], // Asus4
];
const DESKTOP_BASS = [38, 34, 31, 33] as const;
const DESKTOP_CHIMES: Readonly<Record<number, number>> = {
  2: 69,
  6: 76,
  10: 77,
  14: 72,
  18: 77,
  22: 74,
  26: 69,
  30: 72,
  34: 74,
  38: 81,
  42: 77,
  46: 74,
  50: 76,
  54: 74,
  58: 73,
  62: 69,
};

const ESCAPE_CHORDS: readonly (readonly number[])[] = [
  [52, 55, 59, 62], // Em7
  [48, 52, 55, 59], // Cmaj7
  [45, 48, 52, 55], // Am7
  [47, 52, 54, 57], // B7sus4
];
const ESCAPE_BASS = [40, 36, 33, 35] as const;
const ESCAPE_ARP = [64, 67, 71, 74, 71, 67, 76, 71] as const;

const STORY_VN_CHORDS: readonly (readonly number[])[] = [
  [45, 52, 57, 59, 60], // Am9
  [41, 48, 53, 57, 64], // Fmaj7(9)
  [48, 55, 60, 64, 59], // Cmaj7
  [40, 47, 52, 55, 62], // Em7
];
const STORY_VN_ARP = [64, 69, 71, 72, 71, 69, 67, 64] as const;
const STORY_VN_MELODY: Readonly<Record<number, number>> = {
  0: 76,
  3: 72,
  6: 74,
  10: 71,
  16: 69,
  20: 72,
  24: 76,
  28: 74,
  32: 79,
  36: 76,
  40: 74,
  44: 72,
  48: 71,
  52: 74,
  56: 76,
  60: 71,
};

const TABLE_CALM_BASS_ROOTS = [33, 29, 38, 40] as const; // Am -> F -> Dm -> E
const TABLE_CALM_STABS: readonly (readonly number[])[] = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];
const TABLE_CALM_LEAD: Readonly<Record<number, number>> = {
  0: 76,
  6: 72,
  12: 69,
  22: 71,
  32: 74,
  38: 72,
  44: 69,
  54: 68,
  60: 71,
};

const TENSION_BASS_ROOTS = [30, 38, 35, 37] as const; // F# -> D -> B -> C#
const TENSION_ARP = [66, 67, 69, 73, 78, 76, 74, 73] as const; // F#4 Phrygian

function stepDurationSecForScene(scene: BgmSceneId): number {
  const bpm = BGM_TRACK_META[scene].bpm;
  // Ambient tracks step in 8th notes for spacious phrasing; groove/boss tracks step in 16ths
  const division = scene === 'desktop' || scene === 'story-vn' ? 2 : 4;
  return 60 / bpm / division;
}

function scheduleBgmStep(
  ctx: AudioContext,
  out: AudioNode,
  scene: BgmSceneId,
  step: number,
  when: number
): void {
  const idx = ((step % 64) + 64) % 64;
  const bar = Math.floor(idx / 16);
  const inBar = idx % 16;
  const dt = stepDurationSecForScene(scene);

  switch (scene) {
    case 'desktop': {
      if (inBar === 0) {
        playBgmPadChord(ctx, out, when, DESKTOP_CHORDS[bar], dt * 15.6, 0.1, 640);
        playBgmBass(ctx, out, when, DESKTOP_BASS[bar], dt * 7.2, {
          gain: 0.11,
          waveform: 'triangle',
          cutoffHz: 260,
        });
      }
      if (inBar === 8) {
        playBgmBass(ctx, out, when, DESKTOP_BASS[bar] + 12, dt * 3.8, {
          gain: 0.065,
          waveform: 'sine',
          cutoffHz: 240,
        });
      }
      const chime = DESKTOP_CHIMES[idx];
      if (chime !== undefined) {
        playBgmPluck(ctx, out, when, chime, dt * 3.6, {
          gain: 0.085,
          waveform: 'sine',
          cutoffHz: 2200,
          shimmer: true,
        });
      }
      if (inBar % 4 === 2) {
        playBgmHat(ctx, out, when, { gain: 0.015, duration: 0.022, cutoffHz: 7200 });
      }
      break;
    }

    case 'escape-map': {
      if (inBar === 0) {
        playBgmPadChord(ctx, out, when, ESCAPE_CHORDS[bar], dt * 15.2, 0.09, 780);
      }
      if (inBar % 2 === 0) {
        const root = ESCAPE_BASS[bar];
        const note = inBar % 4 === 2 ? root + 12 : root;
        playBgmBass(ctx, out, when, note, dt * 1.7, {
          gain: inBar % 4 === 0 ? 0.16 : 0.09,
          waveform: 'triangle',
          cutoffHz: 360,
        });
      }
      if (inBar === 0 || inBar === 6 || inBar === 10) {
        playBgmKick(ctx, out, when, 0.14);
      }
      if (inBar % 4 === 2) {
        playBgmHat(ctx, out, when, { gain: 0.036, duration: 0.03 });
      }
      if (inBar % 2 === 1) {
        const arpNote = ESCAPE_ARP[(idx >> 1) % ESCAPE_ARP.length] + (bar === 1 ? -1 : 0);
        playBgmPluck(ctx, out, when, arpNote, dt * 2.2, {
          gain: 0.075,
          waveform: 'triangle',
          cutoffHz: 1850,
        });
      }
      break;
    }

    case 'story-vn': {
      if (inBar === 0) {
        playBgmPadChord(ctx, out, when, STORY_VN_CHORDS[bar], dt * 15.6, 0.115, 760);
        playBgmBass(ctx, out, when, STORY_VN_CHORDS[bar][0] - 12, dt * 8, {
          gain: 0.1,
          waveform: 'sine',
          cutoffHz: 240,
        });
      }
      if (inBar % 2 === 0) {
        const arp = STORY_VN_ARP[(inBar >> 1) % STORY_VN_ARP.length] + (bar === 1 ? -4 : bar === 2 ? 3 : 0);
        playBgmPluck(ctx, out, when, arp, dt * 2.6, {
          gain: 0.068,
          waveform: 'triangle',
          cutoffHz: 1650,
        });
      }
      const melody = STORY_VN_MELODY[idx];
      if (melody !== undefined) {
        playBgmPluck(ctx, out, when, melody, dt * 4.2, {
          gain: 0.11,
          waveform: 'sine',
          cutoffHz: 2600,
          shimmer: true,
        });
      }
      break;
    }

    case 'table-calm': {
      const root = TABLE_CALM_BASS_ROOTS[bar];
      if (inBar % 4 === 0) {
        playBgmKick(ctx, out, when, 0.21);
        playBgmBass(ctx, out, when, root, dt * 1.9, {
          gain: 0.19,
          waveform: 'sawtooth',
          cutoffHz: 420,
        });
      } else if (inBar % 4 === 2) {
        playBgmHat(ctx, out, when, { gain: 0.055, duration: 0.042, cutoffHz: 6000 });
        playBgmBass(ctx, out, when, root + 12, dt * 1.4, {
          gain: 0.13,
          waveform: 'triangle',
          cutoffHz: 520,
        });
      } else if (inBar % 2 === 1) {
        playBgmHat(ctx, out, when, { gain: 0.02, duration: 0.02, cutoffHz: 7800 });
      }
      if (inBar === 0 || inBar === 6 || inBar === 12) {
        playBgmPadChord(ctx, out, when, TABLE_CALM_STABS[bar], dt * 3.4, 0.075, 1180);
      }
      const lead = TABLE_CALM_LEAD[idx];
      if (lead !== undefined) {
        playBgmPluck(ctx, out, when, lead, dt * 3.2, {
          gain: 0.1,
          waveform: 'triangle',
          cutoffHz: 2400,
          shimmer: true,
        });
      }
      break;
    }

    case 'table-tension': {
      const root = TENSION_BASS_ROOTS[bar];
      if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 14) {
        playBgmKick(ctx, out, when, 0.24);
      }
      if (inBar === 4 || inBar === 12) {
        playBgmSnare(ctx, out, when, 0.115);
      }
      playBgmHat(ctx, out, when, {
        gain: inBar % 2 === 0 ? 0.042 : 0.022,
        duration: inBar % 4 === 2 ? 0.042 : 0.022,
        cutoffHz: 6600,
      });
      if (inBar % 2 === 0) {
        const octaveJump = inBar % 4 === 2 ? 12 : 0;
        playBgmBass(ctx, out, when, root + octaveJump, dt * 1.65, {
          gain: 0.2,
          waveform: 'sawtooth',
          cutoffHz: 580 + (bar === 3 ? 160 : 0),
        });
      }
      if (inBar === 0) {
        playBgmPadChord(
          ctx,
          out,
          when,
          [root + 24, root + 27 + (bar === 1 || bar === 3 ? 1 : 0), root + 31],
          dt * 14,
          0.085,
          1050
        );
      }
      if (inBar % 2 === 0) {
        const arpOffset = bar === 1 ? -4 : bar === 2 ? -7 : bar === 3 ? -5 : 0;
        const arpNote = TENSION_ARP[(idx >> 1) % TENSION_ARP.length] + arpOffset;
        playBgmPluck(ctx, out, when, arpNote, dt * 1.75, {
          gain: 0.095,
          waveform: 'sawtooth',
          cutoffHz: 2100,
        });
      }
      break;
    }
  }
}

function runBgmLookahead(): void {
  if (!audioCtx || audioCtx.state !== 'running' || !playingBgmScene || !bgmTrackGain) return;
  const horizon = audioCtx.currentTime + 0.22;
  let guard = 0;
  while (bgmNextStepTime < horizon && guard < 16) {
    scheduleBgmStep(audioCtx, bgmTrackGain, playingBgmScene, bgmStepIndex, bgmNextStepTime);
    bgmNextStepTime += stepDurationSecForScene(playingBgmScene);
    bgmStepIndex = (bgmStepIndex + 1) % 64;
    guard += 1;
  }
}

function stopBgmSchedulerOnly(): void {
  if (bgmSchedulerTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(bgmSchedulerTimer);
    bgmSchedulerTimer = null;
  }
}

function syncBgmScheduler(forceRestart = false): void {
  if (typeof window === 'undefined') return;
  if (!desiredBgmScene) {
    stopBgmSchedulerOnly();
    playingBgmScene = null;
    applyBgmMasterGain(0.2);
    return;
  }
  if (!audioCtx || audioCtx.state !== 'running') return;

  if (!forceRestart && playingBgmScene === desiredBgmScene && bgmSchedulerTimer !== null) {
    applyBgmMasterGain(0.18);
    return;
  }

  stopBgmSchedulerOnly();

  // Gently duck and re-create clean track sub-bus to avoid abrupt click on switch
  const prevTrack = bgmTrackGain;
  if (prevTrack) {
    const now = audioCtx.currentTime;
    try {
      prevTrack.gain.cancelScheduledValues(now);
      prevTrack.gain.setValueAtTime(prevTrack.gain.value, now);
      prevTrack.gain.linearRampToValueAtTime(0.0001, now + 0.28);
    } catch {
      prevTrack.gain.setValueAtTime(0.0001, now);
    }
    window.setTimeout(() => {
      try {
        prevTrack.disconnect();
      } catch {
        // Ignore already disconnected node
      }
    }, 340);
  }

  if (bgmMasterGain) {
    const nextTrack = audioCtx.createGain();
    const now = audioCtx.currentTime;
    nextTrack.gain.setValueAtTime(0.0001, now);
    nextTrack.gain.linearRampToValueAtTime(1, now + 0.32);
    nextTrack.connect(bgmMasterGain);
    bgmTrackGain = nextTrack;
  }

  playingBgmScene = desiredBgmScene;
  bgmStepIndex = 0;
  bgmNextStepTime = audioCtx.currentTime + 0.06;
  applyBgmMasterGain(0.25);
  runBgmLookahead();
  bgmSchedulerTimer = window.setInterval(runBgmLookahead, 85);
}

export function setBgmScene(scene: BgmSceneId | null): void {
  desiredBgmScene = scene;
  if (!scene) {
    stopBgm();
    return;
  }
  if (audioCtx && audioCtx.state === 'running') {
    syncBgmScheduler(false);
  }
}

export function previewBgmScene(scene: BgmSceneId): boolean {
  desiredBgmScene = scene;
  const graph = ensureAudioGraph();
  if (!graph) return false;
  if (graph.ctx.state === 'running') {
    syncBgmScheduler(true);
  } else {
    void graph.ctx
      .resume()
      .then(() => {
        syncBgmScheduler(true);
      })
      .catch(() => {
        /* ignore */
      });
  }
  return true;
}

export function stopBgm(): void {
  desiredBgmScene = null;
  playingBgmScene = null;
  stopBgmSchedulerOnly();
  applyBgmMasterGain(0.22);
}

export function getCurrentBgmScene(): BgmSceneId | null {
  return desiredBgmScene;
}
