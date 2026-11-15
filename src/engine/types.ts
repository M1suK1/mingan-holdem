/**
 * Two-suit cyber deck:
 * 'B' = 黑曜脉冲 (Obsidian Black, 26 cards: 2..A x 2 copies)
 * 'P' = 绯霓电弧 (Neon Pink, 26 cards: 2..A x 2 copies)
 */
export type Suit = 'B' | 'P';

/** 2..14 where 11=J, 12=Q, 13=K, 14=A */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  copy?: 0 | 1;
}

export type PlayerId = 'human' | 'ai';

export type HackSkillId = 'plus-one' | 'minus-one' | 'flip-suit';

export interface HandCard {
  card: Card;
  /** 'open' = visible to both players; 'private' = swapped-in hidden card, visible only to owner */
  visibility: 'open' | 'private';
  /** Once swapped in from board hidden pool, cannot be swapped out again */
  lockedFromSwap: boolean;
  /** Original unmodified card visible to opponent when tampered */
  originalCard?: Card;
  /** Hacker skills applied to this card during the hand */
  tamperedBy?: HackSkillId[];
}

export interface BoardSlot {
  index: number;
  card: Card;
  isOpen: boolean;
  source: 'initial' | 'flipped' | 'swapped-in';
  swappedBy?: PlayerId;
  /** Preserved when a tampered open hand card is swapped onto the board */
  originalCard?: Card;
  tamperedBy?: HackSkillId[];
}

export type SwapFeeMode = 'escalating' | 'fixed';
export type AiStyle = 'balanced' | 'aggressive' | 'cautious';

/** Dynamic battleground environment state driven by match tension */
export type BattleSituation =
  | 'recon'
  | 'intrusion'
  | 'overclock'
  | 'breach'
  | 'victory'
  | 'disconnect';

export interface GameConfig {
  startingChips: number;
  ante: number;
  swapFeeMode: SwapFeeMode;
  escalatingSwapFees: [number, number, number];
  fixedSwapFee: number;
  earlyRaiseCap: number;
  midRaiseCap: number;
  riverRaiseCap: number;
  minRaise: number;
  maxRaisesPerSubPhase: number;
  maxRiverRaises: number;
  aiStyle: AiStyle;
  aiDelayMs: number;
  revealOpponentHidden: boolean;
  showDeckTracker: boolean;
  situationOverride: BattleSituation | 'auto';
  hackPlusCost: number;
  hackMinusCost: number;
  hackFlipSuitCost: number;
  scanCost: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  startingChips: 1000,
  ante: 10,
  swapFeeMode: 'escalating',
  escalatingSwapFees: [20, 40, 60],
  fixedSwapFee: 20,
  earlyRaiseCap: 20,
  midRaiseCap: 40,
  riverRaiseCap: 100,
  minRaise: 10,
  maxRaisesPerSubPhase: 2,
  maxRiverRaises: 3,
  aiStyle: 'balanced',
  aiDelayMs: 680,
  revealOpponentHidden: false,
  showDeckTracker: true,
  situationOverride: 'auto',
  hackPlusCost: 40,
  hackMinusCost: 40,
  hackFlipSuitCost: 55,
  scanCost: 50,
};

export type Phase = 'early' | 'mid' | 'river' | 'showdown';

export interface PlayerState {
  id: PlayerId;
  name: string;
  chips: number;
  roundBet: number;
  totalCommitted: number;
  hand: HandCard[];
  swapCount: number;
  folded: boolean;
  allIn: boolean;
  sealedSkills: HackSkillId[];
}

export type GameAction =
  | { type: 'swap'; handIndex: number; boardIndex: number }
  | { type: 'flip'; boardIndex: number }
  | { type: 'raise'; amount: number; isHalfStack?: boolean }
  | { type: 'check' }
  | { type: 'fold' }
  | { type: 'call' }
  | { type: 'end-turn' }
  | { type: 'hack'; handIndex: number; skill: HackSkillId }
  | { type: 'scan'; targetKind: 'hand' | 'board'; targetIndex: number };

export interface HandEvaluation {
  category: number; // 0..8
  categoryKey:
    | 'high-card'
    | 'one-pair'
    | 'two-pair'
    | 'three-of-a-kind'
    | 'straight'
    | 'flush'
    | 'full-house'
    | 'four-of-a-kind'
    | 'straight-flush';
  categoryName: string;
  tiebreakers: number[];
  score: number;
  bestFive: Card[];
}

export interface ThreeCardEval {
  category: 0 | 1 | 2;
  categoryName: string;
  tiebreakers: number[];
  score: number;
}

export interface VisibleHandSummary {
  knownCount: number;
  hiddenCount: number;
  label: string;
  detail: string;
  category: number;
}

export interface SuitStats {
  blackLeft: number;
  pinkLeft: number;
  totalUnknown: number;
  blackPct: number;
  pinkPct: number;
}

export interface VfxEvent {
  id: string;
  type:
    | 'deal'
    | 'swap'
    | 'flip'
    | 'raise'
    | 'call'
    | 'check'
    | 'fold'
    | 'end-turn'
    | 'hack'
    | 'scan'
    | 'allin-reveal'
    | 'showdown';
  actor: PlayerId;
  handIndex?: number;
  boardIndex?: number;
  targetKind?: 'hand' | 'board';
  targetIndex?: number;
  amount?: number;
  caught?: boolean;
  label: string;
  cardLabel?: string;
}

export interface ActionLogEntry {
  id: string;
  handNumber: number;
  actor: PlayerId | 'system';
  phase: Phase;
  summary: string;
  detail?: string;
  timestamp: number;
}

export interface ShowdownResult {
  winner: PlayerId | 'tie';
  reason: 'fold' | 'showdown' | 'scan-caught';
  potWon: number;
  humanEval?: HandEvaluation;
  aiEval?: HandEvaluation;
  payouts: Record<PlayerId, number>;
  sealedSkills?: HackSkillId[];
}

export interface GameState {
  handNumber: number;
  config: GameConfig;
  deck: Card[];
  board: BoardSlot[];
  players: Record<PlayerId, PlayerState>;
  pot: number;
  phase: Phase;
  currentTurn: PlayerId;
  tieStarter: PlayerId;
  raisesInSubPhase: number;
  justCalledThisTurn: boolean;
  riverChecksInRow: number;
  riverHasBet: boolean;
  usedHackThisTurn: boolean;
  usedScanThisTurn: boolean;
  scannedKeys: string[];
  lastAction?: VfxEvent;
  actionHistory: ActionLogEntry[];
  result?: ShowdownResult;
}

export type OpponentMood =
  | 'idle'
  | 'thinking'
  | 'confident'
  | 'tense'
  | 'surprised'
  | 'victory'
  | 'defeat';

export type ContractExpression = 'calm' | 'smile' | 'surprise' | 'sad' | 'angry' | 'shy';

export interface OpponentDialogue {
  speaker: string;
  mood: OpponentMood;
  expression: ContractExpression;
  text: string;
  reasoningHint?: string;
  timestamp: number;
  fromLlm?: boolean;
}

export interface OpponentAgent {
  readonly id: string;
  readonly displayName: string;
  decide(state: GameState): Promise<{
    action: GameAction;
    dialogue: OpponentDialogue;
  }>;
}
