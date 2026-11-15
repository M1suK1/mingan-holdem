import {
  DEFAULT_CONFIG,
  type BattleSituation,
  type BoardSlot,
  type Card,
  type GameAction,
  type GameConfig,
  type GameState,
  type HackSkillId,
  type HandCard,
  type Phase,
  type PlayerId,
  type PlayerState,
  type Rank,
  type Suit,
  type SuitStats,
  type VfxEvent,
} from './types.ts';
import { evaluateSevenCards, pickFirstActor } from './evaluator.ts';

const SUITS: Suit[] = ['B', 'P'];
const COPIES: Array<0 | 1> = [0, 1];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function formatRank(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function formatSuitLabel(suit: Suit): string {
  return suit === 'P' ? '粉' : '黑';
}

export function formatCardShort(card: Card): string {
  return `${formatSuitLabel(card.suit)}${formatRank(card.rank)}`;
}

export function otherPlayer(id: PlayerId): PlayerId {
  return id === 'human' ? 'ai' : 'human';
}

/**
 * 52-card Cyber Deck: 2 suits (Black 'B', Pink 'P') x 13 ranks x 2 copies = 52 cards.
 * Boosts flush probability while keeping all 9 Hold'em hand categories intact.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const copy of COPIES) {
      for (const rank of RANKS) {
        deck.push({ id: `${rank}${suit}-${copy}`, suit, rank, copy });
      }
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getHiddenBoardCount(state: Pick<GameState, 'board'>): number {
  return state.board.filter((b) => !b.isOpen).length;
}

export function getCurrentRaiseCap(state: GameState): number {
  const hidden = getHiddenBoardCount(state);
  if (hidden >= 3) return state.config.earlyRaiseCap;
  if (hidden >= 1) return state.config.midRaiseCap;
  return state.config.riverRaiseCap;
}

export function getNextSwapFee(state: GameState, playerId: PlayerId): number {
  if (state.config.swapFeeMode === 'fixed') {
    return state.config.fixedSwapFee;
  }
  const fees = state.config.escalatingSwapFees;
  const idx = Math.min(state.players[playerId].swapCount, fees.length - 1);
  return fees[idx];
}

export function getBetDiff(state: GameState, actorId: PlayerId): number {
  const opp = state.players[otherPlayer(actorId)];
  const actor = state.players[actorId];
  return Math.max(0, opp.roundBet - actor.roundBet);
}

export function getMaxRaisesAllowed(state: GameState): number {
  return state.phase === 'river'
    ? state.config.maxRiverRaises
    : state.config.maxRaisesPerSubPhase;
}

export function getHackSkillCost(state: Pick<GameState, 'config'>, skill: HackSkillId): number {
  switch (skill) {
    case 'plus-one':
      return state.config.hackPlusCost;
    case 'minus-one':
      return state.config.hackMinusCost;
    case 'flip-suit':
      return state.config.hackFlipSuitCost;
  }
}

export function getHalfStackRaiseAmount(state: GameState, actorId: PlayerId): number {
  if (state.phase === 'showdown') return 0;
  if (state.raisesInSubPhase >= getMaxRaisesAllowed(state)) return 0;
  const actor = state.players[actorId];
  const opp = state.players[otherPlayer(actorId)];
  const diff = getBetDiff(state, actorId);
  const paid = Math.min(diff, actor.chips);
  const remaining = actor.chips - paid;
  if (remaining <= 0 || opp.chips <= 0 || opp.allIn) return 0;

  const half = diff === 0 ? Math.floor(actor.chips / 2) : Math.floor(remaining / 2);
  const minAllowed = Math.min(state.config.minRaise, remaining);
  return Math.min(remaining, Math.max(minAllowed, half));
}

export function getVisibleHandCard(
  hc: HandCard,
  viewerId: PlayerId,
  ownerId: PlayerId,
  revealAll = false
): Card {
  if (viewerId === ownerId || revealAll) return hc.card;
  return hc.originalCard ?? hc.card;
}

export function getVisibleBoardCard(
  slot: BoardSlot,
  viewerId: PlayerId,
  revealAll = false
): Card {
  if (!slot.originalCard || revealAll || slot.swappedBy === viewerId) return slot.card;
  return slot.originalCard;
}

/**
 * Computes unseen Black vs Pink cards from a viewer's legal knowledge (52 total: 26 Black, 26 Pink).
 */
export function getRemainingSuitStats(state: GameState, viewerId: PlayerId = 'human'): SuitStats {
  let seenBlack = 0;
  let seenPink = 0;
  const countCard = (c: Card) => {
    if (c.suit === 'B') seenBlack += 1;
    else seenPink += 1;
  };

  const revealAll = state.phase === 'showdown' || state.config.revealOpponentHidden;
  // Viewer sees all 3 of their own cards
  for (const h of state.players[viewerId].hand) {
    countCard(getVisibleHandCard(h, viewerId, viewerId, revealAll));
  }
  // Viewer sees opponent's open cards (unmodified view unless revealed)
  const oppId = otherPlayer(viewerId);
  const opp = state.players[oppId];
  for (const h of opp.hand) {
    if (revealAll || h.visibility === 'open') {
      countCard(getVisibleHandCard(h, viewerId, oppId, revealAll));
    }
  }
  // Viewer sees open board cards
  for (const slot of state.board) {
    if (revealAll || slot.isOpen) {
      countCard(getVisibleBoardCard(slot, viewerId, revealAll));
    }
  }

  const blackLeft = Math.max(0, 26 - seenBlack);
  const pinkLeft = Math.max(0, 26 - seenPink);
  const totalUnknown = blackLeft + pinkLeft;
  const blackPct = totalUnknown > 0 ? Math.round((blackLeft / totalUnknown) * 100) : 50;
  const pinkPct = totalUnknown > 0 ? 100 - blackPct : 50;

  return { blackLeft, pinkLeft, totalUnknown, blackPct, pinkPct };
}

/**
 * Maps current match tension into 6 distinct cyber-space environment states.
 */
export function computeBattleSituation(state: GameState): BattleSituation {
  if (state.config.situationOverride !== 'auto') {
    return state.config.situationOverride;
  }
  if (state.phase === 'showdown' && state.result) {
    return state.result.winner === 'human' ? 'victory' : 'disconnect';
  }
  if (state.players.human.allIn || state.players.ai.allIn) {
    return 'breach';
  }
  const highPotThreshold = Math.max(120, state.config.ante * 12);
  if (
    state.phase === 'river' ||
    state.pot >= highPotThreshold ||
    state.raisesInSubPhase >= getMaxRaisesAllowed(state)
  ) {
    return 'overclock';
  }
  if (
    state.phase === 'mid' ||
    state.raisesInSubPhase > 0 ||
    state.players.human.swapCount + state.players.ai.swapCount > 0 ||
    getHiddenBoardCount(state) < 4
  ) {
    return 'intrusion';
  }
  return 'recon';
}

function computePhaseFromBoard(board: BoardSlot[]): Phase {
  const hidden = board.filter((b) => !b.isOpen).length;
  if (hidden >= 3) return 'early';
  if (hidden >= 1) return 'mid';
  return 'river';
}

function makeEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface CreateStateOptions {
  config?: Partial<GameConfig>;
  handNumber?: number;
  tieStarter?: PlayerId;
  chips?: Record<PlayerId, number>;
  sealedSkills?: Record<PlayerId, HackSkillId[]>;
  opponentName?: string;
  deckOverride?: Card[];
  rng?: () => number;
}

export function createInitialState(options: CreateStateOptions = {}): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...options.config };
  const handNumber = options.handNumber ?? 1;
  const tieStarter: PlayerId = options.tieStarter ?? (handNumber % 2 === 1 ? 'human' : 'ai');
  const deck = options.deckOverride
    ? [...options.deckOverride]
    : shuffleDeck(createDeck(), options.rng);

  const humanStarting = options.chips?.human ?? config.startingChips;
  const aiStarting = options.chips?.ai ?? config.startingChips;

  const humanAnte = Math.min(config.ante, humanStarting);
  const aiAnte = Math.min(config.ante, aiStarting);

  const humanCards = deck.slice(0, 3);
  const aiCards = deck.slice(3, 6);
  const boardCards = deck.slice(6, 10);

  const human: PlayerState = {
    id: 'human',
    name: '潜行黑客',
    chips: humanStarting - humanAnte,
    roundBet: 0,
    totalCommitted: humanAnte,
    hand: humanCards.map((card) => ({
      card,
      visibility: 'open',
      lockedFromSwap: false,
    })),
    swapCount: 0,
    folded: false,
    allIn: humanStarting - humanAnte === 0,
    sealedSkills: [...(options.sealedSkills?.human ?? [])],
  };

  const ai: PlayerState = {
    id: 'ai',
    name: options.opponentName ?? '银狼',
    chips: aiStarting - aiAnte,
    roundBet: 0,
    totalCommitted: aiAnte,
    hand: aiCards.map((card) => ({
      card,
      visibility: 'open',
      lockedFromSwap: false,
    })),
    swapCount: 0,
    folded: false,
    allIn: aiStarting - aiAnte === 0,
    sealedSkills: [...(options.sealedSkills?.ai ?? [])],
  };

  const anteDiff = humanAnte - aiAnte;
  if (anteDiff > 0) {
    human.chips += anteDiff;
    human.totalCommitted -= anteDiff;
    human.allIn = human.chips === 0;
  } else if (anteDiff < 0) {
    ai.chips += -anteDiff;
    ai.totalCommitted -= -anteDiff;
    ai.allIn = ai.chips === 0;
  }

  const board: BoardSlot[] = boardCards.map((card, index) => ({
    index,
    card,
    isOpen: false,
    source: 'initial',
  }));

  const pot = human.totalCommitted + ai.totalCommitted;
  const firstTurn = pickFirstActor(humanCards, aiCards, tieStarter);

  const initialState: GameState = {
    handNumber,
    config,
    deck: deck.slice(10),
    board,
    players: { human, ai },
    pot,
    phase: 'early',
    currentTurn: firstTurn,
    tieStarter,
    raisesInSubPhase: 0,
    justCalledThisTurn: false,
    riverChecksInRow: 0,
    riverHasBet: false,
    usedHackThisTurn: false,
    usedScanThisTurn: false,
    scannedKeys: [],
    lastAction: {
      id: makeEventId(),
      type: 'deal',
      actor: firstTurn,
      label: `协议 #${handNumber} 握手完成 · ${firstTurn === 'human' ? '我方' : ai.name}先手执行`,
    },
    actionHistory: [
      {
        id: makeEventId(),
        handNumber,
        actor: 'system',
        phase: 'early',
        summary: `第 ${handNumber} 局建立连接：基础算力注入各 ${Math.min(humanAnte, aiAnte)}，奖池 ${pot}`,
        detail: `${firstTurn === 'human' ? '我方' : ai.name}初始3张公开序列较弱，取得先手控制权`,
        timestamp: Date.now(),
      },
    ],
  };

  if (human.allIn || ai.allIn) {
    return autoRunoutToShowdown(initialState, firstTurn);
  }

  return initialState;
}

export function startNextHand(prev: GameState, newConfig?: Partial<GameConfig>): GameState {
  const nextTieStarter: PlayerId = prev.tieStarter === 'human' ? 'ai' : 'human';
  return createInitialState({
    config: newConfig ? { ...prev.config, ...newConfig } : prev.config,
    handNumber: prev.handNumber + 1,
    tieStarter: nextTieStarter,
    opponentName: prev.players.ai.name,
    chips: {
      human: prev.players.human.chips,
      ai: prev.players.ai.chips,
    },
    sealedSkills: {
      human: [...prev.players.human.sealedSkills],
      ai: [...prev.players.ai.sealedSkills],
    },
  });
}

export interface LegalRaiseRange {
  allowed: boolean;
  min: number;
  max: number;
}

export function getLegalRaiseRange(
  state: GameState,
  actorId: PlayerId,
  afterCallDiff = 0
): LegalRaiseRange {
  if (state.phase === 'showdown') return { allowed: false, min: 0, max: 0 };
  if (state.raisesInSubPhase >= getMaxRaisesAllowed(state)) {
    return { allowed: false, min: 0, max: 0 };
  }
  const actor = state.players[actorId];
  const opp = state.players[otherPlayer(actorId)];
  const remaining = actor.chips - afterCallDiff;
  if (remaining <= 0 || opp.chips <= 0 || opp.allIn) {
    return { allowed: false, min: 0, max: 0 };
  }
  const cap = getCurrentRaiseCap(state);
  const max = Math.min(cap, remaining);
  const min = Math.min(state.config.minRaise, max);
  return { allowed: max > 0, min, max };
}

/**
 * Generates up to 3 clean deduplicated integer raise choices (low / mid / max) without a slider.
 */
export function computeThreeRaisePresets(min: number, max: number): number[] {
  if (max <= 0 || min <= 0 || max < min) return [];
  if (min === max) return [min];
  const span = max - min;
  const rawMid = (min + max) / 2;
  let mid: number;
  if (span >= 60) {
    mid = Math.floor(rawMid / 10) * 10;
  } else if (span >= 10) {
    mid = Math.round(rawMid / 5) * 5;
  } else {
    mid = Math.round(rawMid);
  }
  const clampedMid = Math.max(min, Math.min(max, mid));
  return Array.from(new Set([min, clampedMid, max])).sort((a, b) => a - b);
}

export function isActionLegal(state: GameState, action: GameAction): boolean {
  if (state.phase === 'showdown') return false;
  const actorId = state.currentTurn;
  const oppId = otherPlayer(actorId);
  const actor = state.players[actorId];
  const opp = state.players[oppId];
  const diff = getBetDiff(state, actorId);
  const hiddenCount = getHiddenBoardCount(state);

  if (diff === 0) {
    // Non-consuming Hacker Skills (requires diff === 0: must call raises first!)
    if (action.type === 'hack') {
      if (state.usedHackThisTurn) return false;
      if (actor.sealedSkills.includes(action.skill)) return false;
      const cost = getHackSkillCost(state, action.skill);
      if (actor.chips < cost) return false;
      const hCard = actor.hand[action.handIndex];
      if (!hCard || hCard.visibility !== 'open') return false;
      if (action.skill === 'plus-one' && hCard.card.rank >= 14) return false;
      if (action.skill === 'minus-one' && hCard.card.rank <= 2) return false;
      return true;
    }

    // Non-consuming Universal Scan Skill (requires diff === 0: must call raises first!)
    if (action.type === 'scan') {
      if (state.usedScanThisTurn) return false;
      if (actor.chips < state.config.scanCost) return false;
      const scanKey = `${actorId}:${action.targetKind}:${action.targetIndex}`;
      if (state.scannedKeys.includes(scanKey)) return false;
      if (action.targetKind === 'hand') {
        return Boolean(opp.hand[action.targetIndex]);
      }
      const slot = state.board[action.targetIndex];
      return Boolean(slot && slot.isOpen && slot.swappedBy === oppId);
    }

    if (state.phase === 'river') {
      if (action.type === 'check') return true;
      if (action.type === 'raise') {
        if (action.isHalfStack) {
          const halfAmt = getHalfStackRaiseAmount(state, actorId);
          return halfAmt > 0 && action.amount === halfAmt;
        }
        const range = getLegalRaiseRange(state, actorId, 0);
        return range.allowed && action.amount >= range.min && action.amount <= range.max;
      }
      return false;
    }

    if (action.type === 'end-turn') {
      return state.justCalledThisTurn === true;
    }
    if (action.type === 'flip') {
      const slot = state.board[action.boardIndex];
      return Boolean(slot && !slot.isOpen);
    }
    if (action.type === 'swap') {
      if (hiddenCount === 0) return false;
      const fee = getNextSwapFee(state, actorId);
      if (actor.chips < fee) return false;
      const hCard = actor.hand[action.handIndex];
      const bSlot = state.board[action.boardIndex];
      return Boolean(
        hCard &&
          hCard.visibility === 'open' &&
          !hCard.lockedFromSwap &&
          bSlot &&
          !bSlot.isOpen
      );
    }
    if (action.type === 'raise') {
      if (action.isHalfStack) {
        const halfAmt = getHalfStackRaiseAmount(state, actorId);
        return halfAmt > 0 && action.amount === halfAmt;
      }
      const range = getLegalRaiseRange(state, actorId, 0);
      return range.allowed && action.amount >= range.min && action.amount <= range.max;
    }
    return false;
  }

  if (action.type === 'fold' || action.type === 'call') return true;
  if (action.type === 'raise') {
    const paid = Math.min(diff, actor.chips);
    if (actor.chips - paid <= 0 || opp.allIn) return false;
    if (action.isHalfStack) {
      const halfAmt = getHalfStackRaiseAmount(state, actorId);
      return halfAmt > 0 && action.amount === halfAmt;
    }
    const range = getLegalRaiseRange(state, actorId, paid);
    return range.allowed && action.amount >= range.min && action.amount <= range.max;
  }
  return false;
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    config: {
      ...state.config,
      escalatingSwapFees: [...state.config.escalatingSwapFees] as [number, number, number],
    },
    deck: [...state.deck],
    board: state.board.map((b) => ({
      ...b,
      card: { ...b.card },
      originalCard: b.originalCard ? { ...b.originalCard } : undefined,
      tamperedBy: b.tamperedBy ? [...b.tamperedBy] : undefined,
    })),
    players: {
      human: {
        ...state.players.human,
        sealedSkills: [...state.players.human.sealedSkills],
        hand: state.players.human.hand.map((h) => ({
          ...h,
          card: { ...h.card },
          originalCard: h.originalCard ? { ...h.originalCard } : undefined,
          tamperedBy: h.tamperedBy ? [...h.tamperedBy] : undefined,
        })),
      },
      ai: {
        ...state.players.ai,
        sealedSkills: [...state.players.ai.sealedSkills],
        hand: state.players.ai.hand.map((h) => ({
          ...h,
          card: { ...h.card },
          originalCard: h.originalCard ? { ...h.originalCard } : undefined,
          tamperedBy: h.tamperedBy ? [...h.tamperedBy] : undefined,
        })),
      },
    },
    scannedKeys: [...state.scannedKeys],
    actionHistory: [...state.actionHistory],
  };
}

function resolveShowdown(state: GameState): GameState {
  const next = cloneState(state);
  next.justCalledThisTurn = false;
  // At Showdown (when not caught by Scan), any hacked card that entered the public board
  // takes real effect on the table for both hands.
  const boardCards = next.board.map((b) => b.card);
  const humanEval = evaluateSevenCards([
    ...next.players.human.hand.map((h) => h.card),
    ...boardCards,
  ]);
  const aiEval = evaluateSevenCards([
    ...next.players.ai.hand.map((h) => h.card),
    ...boardCards,
  ]);

  let winner: PlayerId | 'tie' = 'tie';
  const payouts: Record<PlayerId, number> = { human: 0, ai: 0 };

  if (humanEval.score > aiEval.score) {
    winner = 'human';
    payouts.human = next.pot;
  } else if (aiEval.score > humanEval.score) {
    winner = 'ai';
    payouts.ai = next.pot;
  } else {
    const half = Math.floor(next.pot / 2);
    const odd = next.pot % 2;
    payouts.human = half + (next.tieStarter === 'human' ? odd : 0);
    payouts.ai = half + (next.tieStarter === 'ai' ? odd : 0);
  }

  next.players.human.chips += payouts.human;
  next.players.ai.chips += payouts.ai;
  next.phase = 'showdown';
  next.result = {
    winner,
    reason: 'showdown',
    potWon: next.pot,
    humanEval,
    aiEval,
    payouts,
  };

  const aiName = next.players.ai.name;
  const winText =
    winner === 'tie'
      ? `序列持平分池（${humanEval.categoryName}）`
      : `${winner === 'human' ? '我方破译成功' : `${aiName}夺取权限`}（${
          (winner === 'human' ? humanEval : aiEval).categoryName
        }）`;

  next.lastAction = {
    id: makeEventId(),
    type: 'showdown',
    actor: winner === 'tie' ? next.tieStarter : winner,
    amount: next.pot,
    label: winText,
  };
  next.actionHistory.push({
    id: makeEventId(),
    handNumber: next.handNumber,
    actor: 'system',
    phase: 'showdown',
    summary: `终局核验：${winText} · 奖池 ${next.pot}`,
    detail: `我方：${humanEval.categoryName} ｜ ${aiName}：${aiEval.categoryName}`,
    timestamp: Date.now(),
  });

  return next;
}

function autoRunoutToShowdown(state: GameState, actor: PlayerId): GameState {
  const next = cloneState(state);
  let flippedAny = false;
  for (const slot of next.board) {
    if (!slot.isOpen) {
      slot.isOpen = true;
      slot.source = 'flipped';
      flippedAny = true;
    }
  }
  if (flippedAny) {
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: 'system',
      phase: 'river',
      summary: '算力全下熔断：自动破译剩余全部加密节点',
      timestamp: Date.now(),
    });
  }
  const settled = resolveShowdown(next);
  if (flippedAny && settled.lastAction) {
    settled.lastAction = {
      ...settled.lastAction,
      type: 'allin-reveal',
      actor,
      label: `全下熔断破译 · ${settled.lastAction.label}`,
    };
  }
  return settled;
}

function performFlip(state: GameState, actorId: PlayerId, boardIndex: number): GameState {
  const next = cloneState(state);
  const slot = next.board[boardIndex];
  slot.isOpen = true;
  slot.source = 'flipped';
  next.raisesInSubPhase = 0;
  next.justCalledThisTurn = false;
  next.usedHackThisTurn = false;
  next.usedScanThisTurn = false;

  const hiddenAfter = getHiddenBoardCount(next);
  const actorLabel = actorId === 'human' ? '我方' : next.players.ai.name;
  const cardTxt = formatCardShort(slot.card);

  if (hiddenAfter === 0) {
    next.phase = 'river';
    next.currentTurn = otherPlayer(actorId);
    next.riverChecksInRow = 0;
    next.riverHasBet = false;
  } else {
    next.phase = computePhaseFromBoard(next.board);
    next.currentTurn = otherPlayer(actorId);
  }

  const summary = `${actorLabel} 破译公共节点 #${boardIndex + 1}（${cardTxt}）`;
  next.lastAction = {
    id: makeEventId(),
    type: 'flip',
    actor: actorId,
    boardIndex,
    cardLabel: cardTxt,
    label: summary,
  };
  next.actionHistory.push({
    id: makeEventId(),
    handNumber: next.handNumber,
    actor: actorId,
    phase: next.phase,
    summary,
    detail:
      hiddenAfter === 0
        ? `全部公共节点已公开，进入终局河牌圈（${
            next.currentTurn === 'human' ? '我方' : next.players.ai.name
          }先手）`
        : undefined,
    timestamp: Date.now(),
  });

  return next;
}

function performSwap(
  state: GameState,
  actorId: PlayerId,
  handIndex: number,
  boardIndex: number
): GameState {
  const next = cloneState(state);
  const actor = next.players[actorId];
  const fee = getNextSwapFee(next, actorId);

  actor.chips -= fee;
  actor.totalCommitted += fee;
  next.pot += fee;
  actor.swapCount += 1;
  next.justCalledThisTurn = false;
  next.usedHackThisTurn = false;
  next.usedScanThisTurn = false;

  const discardedHc = actor.hand[handIndex];
  const discarded = discardedHc.card;
  const drawn = next.board[boardIndex].card;

  actor.hand[handIndex] = {
    card: drawn,
    visibility: 'private',
    lockedFromSwap: true,
  };
  next.board[boardIndex] = {
    index: boardIndex,
    card: discarded,
    isOpen: true,
    source: 'swapped-in',
    swappedBy: actorId,
    originalCard: discardedHc.originalCard,
    tamperedBy: discardedHc.tamperedBy,
  };

  next.raisesInSubPhase = 0;

  const hiddenAfter = getHiddenBoardCount(next);
  const actorLabel = actorId === 'human' ? '我方' : next.players.ai.name;
  const discardedTxt = formatCardShort(discarded);
  const summary = `${actorLabel} 消耗 ${fee} 覆写换牌（释放 ${discardedTxt} 置换加密节点 #${
    boardIndex + 1
  }）`;

  if (actor.chips === 0) {
    actor.allIn = true;
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary,
      timestamp: Date.now(),
    });
    return autoRunoutToShowdown(next, actorId);
  }

  if (hiddenAfter === 0) {
    next.phase = 'river';
    next.currentTurn = otherPlayer(actorId);
    next.riverChecksInRow = 0;
    next.riverHasBet = false;
  } else {
    next.phase = computePhaseFromBoard(next.board);
    next.currentTurn = otherPlayer(actorId);
  }

  next.lastAction = {
    id: makeEventId(),
    type: 'swap',
    actor: actorId,
    handIndex,
    boardIndex,
    amount: fee,
    cardLabel: discardedTxt,
    label: summary,
  };
  next.actionHistory.push({
    id: makeEventId(),
    handNumber: next.handNumber,
    actor: actorId,
    phase: next.phase,
    summary,
    detail:
      hiddenAfter === 0
        ? `最后加密节点已置换，进入终局河牌圈（${
            next.currentTurn === 'human' ? '我方' : next.players.ai.name
          }先手）`
        : undefined,
    timestamp: Date.now(),
  });

  return next;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (!isActionLegal(state, action)) {
    throw new Error(
      `Illegal action ${JSON.stringify(action)} for player ${state.currentTurn} in phase ${state.phase}`
    );
  }

  const actorId = state.currentTurn;
  const oppId = otherPlayer(actorId);
  const actorLabel = actorId === 'human' ? '我方' : state.players.ai.name;

  if (action.type === 'hack') {
    const next = cloneState(state);
    const actor = next.players[actorId];
    const cost = getHackSkillCost(next, action.skill);
    const hc = actor.hand[action.handIndex];
    const prevCard = { ...hc.card };

    actor.chips -= cost;
    actor.totalCommitted += cost;
    next.pot += cost;
    next.usedHackThisTurn = true;

    if (!hc.originalCard) {
      hc.originalCard = { ...prevCard };
    }
    const nextCard = { ...hc.card };
    if (action.skill === 'plus-one') {
      nextCard.rank = (nextCard.rank + 1) as Rank;
    } else if (action.skill === 'minus-one') {
      nextCard.rank = (nextCard.rank - 1) as Rank;
    } else {
      nextCard.suit = nextCard.suit === 'B' ? 'P' : 'B';
    }
    hc.card = nextCard;
    hc.tamperedBy = Array.from(new Set([...(hc.tamperedBy ?? []), action.skill]));

    const skillName =
      action.skill === 'plus-one'
        ? '点数+1'
        : action.skill === 'minus-one'
          ? '点数-1'
          : '反转花色';
    const summary = `${actorLabel} 预支 ${cost} 算力注入黑客协议（${skillName} · 仅己方可见）`;

    next.lastAction = {
      id: makeEventId(),
      type: 'hack',
      actor: actorId,
      handIndex: action.handIndex,
      amount: cost,
      label: summary,
    };
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary: `${actorLabel} 预支 ${cost} 算力执行终端篡改（不占用回合）`,
      timestamp: Date.now(),
    });
    return next;
  }

  if (action.type === 'scan') {
    const next = cloneState(state);
    const actor = next.players[actorId];
    const opp = next.players[oppId];
    const cost = next.config.scanCost;

    actor.chips -= cost;
    actor.totalCommitted += cost;
    next.pot += cost;
    next.usedScanThisTurn = true;
    next.scannedKeys.push(`${actorId}:${action.targetKind}:${action.targetIndex}`);

    let tampered = false;
    let tamperedSkills: HackSkillId[] = [];
    if (action.targetKind === 'hand') {
      const targetHc = opp.hand[action.targetIndex];
      if (
        targetHc?.originalCard &&
        targetHc.tamperedBy &&
        targetHc.tamperedBy.length > 0 &&
        (targetHc.card.rank !== targetHc.originalCard.rank ||
          targetHc.card.suit !== targetHc.originalCard.suit)
      ) {
        tampered = true;
        tamperedSkills = [...targetHc.tamperedBy];
      }
    } else {
      const slot = next.board[action.targetIndex];
      if (
        slot?.originalCard &&
        slot.tamperedBy &&
        slot.tamperedBy.length > 0 &&
        (slot.card.rank !== slot.originalCard.rank ||
          slot.card.suit !== slot.originalCard.suit)
      ) {
        tampered = true;
        tamperedSkills = [...slot.tamperedBy];
      }
    }

    if (tampered) {
      opp.sealedSkills = Array.from(new Set([...opp.sealedSkills, ...tamperedSkills]));
      actor.chips += next.pot;
      next.phase = 'showdown';
      next.justCalledThisTurn = false;
      next.result = {
        winner: actorId,
        reason: 'scan-caught',
        potWon: next.pot,
        payouts: {
          human: actorId === 'human' ? next.pot : 0,
          ai: actorId === 'ai' ? next.pot : 0,
        },
        sealedSkills: tamperedSkills,
      };
      const oppLabel = oppId === 'human' ? '我方' : next.players.ai.name;
      const summary = `${actorLabel} 扫描抓获 ${oppLabel} 篡改底牌！直接夺取奖池 ${next.pot} 并封印技能`;
      next.lastAction = {
        id: makeEventId(),
        type: 'scan',
        actor: actorId,
        targetKind: action.targetKind,
        targetIndex: action.targetIndex,
        amount: cost,
        caught: true,
        label: summary,
      };
      next.actionHistory.push({
        id: makeEventId(),
        handNumber: next.handNumber,
        actor: actorId,
        phase: 'showdown',
        summary,
        timestamp: Date.now(),
      });
      return next;
    }

    const summary = `${actorLabel} 预支 ${cost} 扫描对端节点：数据完整，未发现篡改`;
    next.lastAction = {
      id: makeEventId(),
      type: 'scan',
      actor: actorId,
      targetKind: action.targetKind,
      targetIndex: action.targetIndex,
      amount: cost,
      caught: false,
      label: summary,
    };
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary,
      timestamp: Date.now(),
    });
    return next;
  }

  if (action.type === 'fold') {
    const next = cloneState(state);
    next.justCalledThisTurn = false;
    next.players[actorId].folded = true;
    next.players[oppId].chips += next.pot;
    next.phase = 'showdown';
    next.result = {
      winner: oppId,
      reason: 'fold',
      potWon: next.pot,
      payouts: {
        human: oppId === 'human' ? next.pot : 0,
        ai: oppId === 'ai' ? next.pot : 0,
      },
    };
    const oppLabel = oppId === 'human' ? '我方' : next.players.ai.name;
    const summary = `${actorLabel} 主动断开链路（弃权），${oppLabel} 接管奖池 ${next.pot}`;
    next.lastAction = {
      id: makeEventId(),
      type: 'fold',
      actor: actorId,
      amount: next.pot,
      label: summary,
    };
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: 'showdown',
      summary,
      timestamp: Date.now(),
    });
    return next;
  }

  if (action.type === 'end-turn') {
    const next = cloneState(state);
    next.justCalledThisTurn = false;
    next.usedHackThisTurn = false;
    next.usedScanThisTurn = false;
    next.currentTurn = oppId;
    const summary = `${actorLabel} 保持平注状态，移交回合控制权`;
    next.lastAction = {
      id: makeEventId(),
      type: 'end-turn',
      actor: actorId,
      label: summary,
    };
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary,
      timestamp: Date.now(),
    });
    return next;
  }

  if (action.type === 'check') {
    const next = cloneState(state);
    next.justCalledThisTurn = false;
    next.usedHackThisTurn = false;
    next.usedScanThisTurn = false;
    next.riverChecksInRow += 1;
    const summary = `${actorLabel} 静默过牌`;
    next.lastAction = {
      id: makeEventId(),
      type: 'check',
      actor: actorId,
      label: summary,
    };
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary,
      timestamp: Date.now(),
    });
    if (next.riverChecksInRow >= 2) {
      return resolveShowdown(next);
    }
    next.currentTurn = oppId;
    return next;
  }

  if (action.type === 'raise') {
    const next = cloneState(state);
    const actor = next.players[actorId];
    const diff = getBetDiff(next, actorId);
    const totalPay = diff + action.amount;

    actor.chips -= totalPay;
    actor.roundBet += totalPay;
    actor.totalCommitted += totalPay;
    next.pot += totalPay;
    if (actor.chips === 0) actor.allIn = true;

    next.justCalledThisTurn = false;
    next.usedHackThisTurn = false;
    next.usedScanThisTurn = false;
    next.raisesInSubPhase += 1;
    if (next.phase === 'river') {
      next.riverHasBet = true;
      next.riverChecksInRow = 0;
    }
    next.currentTurn = oppId;

    const verb = action.isHalfStack
      ? '长按半数重注'
      : diff > 0
        ? '同步并反加'
        : actor.allIn
          ? '全下过载加注'
          : '加注施压';
    const summary = `${actorLabel} ${verb} +${action.amount}`;
    const vfx: VfxEvent = {
      id: makeEventId(),
      type: 'raise',
      actor: actorId,
      amount: totalPay,
      label: summary,
    };
    next.lastAction = vfx;
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary,
      timestamp: Date.now(),
    });
    return next;
  }

  if (action.type === 'flip') {
    return performFlip(state, actorId, action.boardIndex);
  }

  if (action.type === 'swap') {
    return performSwap(state, actorId, action.handIndex, action.boardIndex);
  }

  // action.type === 'call'
  const next = cloneState(state);
  const diff = getBetDiff(next, actorId);
  const actor = next.players[actorId];
  const opp = next.players[oppId];
  const paid = Math.min(diff, actor.chips);

  if (paid < diff) {
    const uncalled = diff - paid;
    opp.chips += uncalled;
    opp.roundBet -= uncalled;
    opp.totalCommitted -= uncalled;
    next.pot -= uncalled;
  }

  actor.chips -= paid;
  actor.roundBet += paid;
  actor.totalCommitted += paid;
  next.pot += paid;
  if (actor.chips === 0) actor.allIn = true;

  if (actor.allIn || opp.allIn) {
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary: `${actorLabel} 跟注 +${paid}（触发全下熔断结算）`,
      timestamp: Date.now(),
    });
    return autoRunoutToShowdown(next, actorId);
  }

  if (next.phase === 'river') {
    next.actionHistory.push({
      id: makeEventId(),
      handNumber: next.handNumber,
      actor: actorId,
      phase: next.phase,
      summary: `${actorLabel} 河牌跟注 +${paid}，启动终局比牌`,
      timestamp: Date.now(),
    });
    return resolveShowdown(next);
  }

  next.justCalledThisTurn = true;
  const summary = `${actorLabel} 同步跟注 +${paid}（保留行动权限）`;
  next.lastAction = {
    id: makeEventId(),
    type: 'call',
    actor: actorId,
    amount: paid,
    label: summary,
  };
  next.actionHistory.push({
    id: makeEventId(),
    handNumber: next.handNumber,
    actor: actorId,
    phase: next.phase,
    summary,
    timestamp: Date.now(),
  });
  return next;
}
