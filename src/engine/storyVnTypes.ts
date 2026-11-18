import type { ContractExpression } from './types.ts';
import type { SoundCue } from './soundEngine.ts';

export type StoryVnSpeakerKind = 'opponent' | 'narrator' | 'player';

export type StoryVnSpriteMode = 'opponent' | 'dissipating' | 'none' | 'mirror';

export type StoryVnCharacterId = 'echo0' | 'sec01' | 'sec02' | 'sec03' | 'sec04' | 'linlongxin';

export type StoryVnStageEffect =
  | 'none'
  | 'sync-glow'
  | 'reverse-flux'
  | 'error-popups'
  | 'glitch-override'
  | 'mirror-boot'
  | 'sway-back'
  | 'height-drop'
  | 'tremble'
  | 'wings-glow'
  | 'alarm-flash'
  | 'wanted-banner'
  | 'scanline-red'
  | 'radar-ping'
  | 'pursuer-tags'
  | 'alarm-intense'
  | 'alert-stance'
  | 'escape-cta'
  | 'dash-out'
  | 'lean-in'
  | 'blade-slash';

export type StoryVnExpression = ContractExpression | 'err1' | 'err2';

export interface StoryVnDualSprite {
  character: StoryVnCharacterId;
  expression: StoryVnExpression;
  visibility: 'active' | 'dimmed' | 'shell-dim' | 'silhouette' | 'hidden';
  label?: string;
  effect?:
    | 'none'
    | 'sway-back'
    | 'tremble'
    | 'lean-in'
    | 'dissipating'
    | 'flashback'
    | 'blade-cut'
    | 'emerge'
    | 'collide'
    | 'push-apart'
    | 'distanced'
    | 'split-out'
    | 'split-hold'
    | 'split-in';
}

export interface StoryVnLine {
  index: number;
  lineNo: string;
  chapterLabel: string;
  speakerKind: StoryVnSpeakerKind;
  speakerName: string;
  /** Single-center portrait mode (SEC-00) */
  spriteMode?: StoryVnSpriteMode;
  expression?: ContractExpression;
  spriteTag?: string;
  /** Dual / trio portrait mode (SEC-01+) */
  auxLeftSprite?: StoryVnDualSprite;
  leftSprite?: StoryVnDualSprite;
  rightSprite?: StoryVnDualSprite;
  /** Dashed inner-thought box styling */
  isThought?: boolean;
  stageEffect: StoryVnStageEffect;
  hudAlerts?: string[];
  soundCue?: SoundCue;
  tone: 'cyan' | 'glitch' | 'amber' | 'alarm' | 'gold';
  text: string;
  nextButtonOverride?: string;
}
