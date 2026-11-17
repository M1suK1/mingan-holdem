import type {
  AiDifficulty,
  AiStyle,
  Card,
  ContractExpression,
  GameAction,
  GameState,
  HackSkillId,
  OpponentAgent,
  OpponentDialogue,
  OpponentMood,
  PlayerId,
  Rank,
} from './types.ts';
import { evaluateSevenCards, evaluateThreeCards } from './evaluator.ts';
import {
  createDeck,
  getBetDiff,
  getEffectiveHackCost,
  getEffectiveScanCost,
  getHalfStackRaiseAmount,
  getHiddenBoardCount,
  getLegalRaiseRange,
  getNextSwapFee,
  getRemainingSuitStats,
  getVisibleBoardCard,
  getVisibleHandCard,
  isActionLegal,
  otherPlayer,
} from './gameEngine.ts';
import {
  FALLBACK_CONTRACT_CHARACTER,
  moodToExpression,
  type ContractCharacter,
} from './contractCards.ts';
import type { EffectiveCheatProfile, EffectivePlayStyle } from './skillPool.ts';
import { serializeStateForLlm } from './llmClient.ts';

export { serializeStateForLlm };

export type EffectiveAiDifficulty = Exclude<AiDifficulty, 'auto'>;

export function resolveEffectiveAiDifficulty(
  setting: AiDifficulty | undefined,
  threatLevel = 1
): EffectiveAiDifficulty {
  if (setting && setting !== 'auto') return setting;
  if (threatLevel <= 1) return 'rookie';
  if (threatLevel === 2) return 'standard';
  return 'master';
}

function scoreCurrentPartialHand(hand: Card[], openBoard: Card[]): number {
  const validHand = hand.filter((c) => !c.isBlank);
  const validBoard = openBoard.filter((c) => !c.isBlank);
  const combined = [...validHand, ...validBoard];
  if (combined.length >= 5) {
    const evalRes = evaluateSevenCards(combined);
    return Math.min(1, 0.24 + evalRes.category * 0.1 + (evalRes.tiebreakers[0] ?? 7) / 140);
  }
  if (validHand.length !== 3 || validBoard.length !== openBoard.length) {
    return Math.min(0.95, Math.max(0.1, scoreCardPotential(validHand, validBoard) / 500));
  }
  const three = evaluateThreeCards(validHand);
  let strength = 0.2 + three.category * 0.28 + (three.tiebreakers[0] ?? 7) / 45;
  const suitCounts = new Map<string, number>();
  for (const c of combined) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + (c.suit === 'P' && c.isDoublePink ? 2 : 1));
  }
  const maxSuit = Math.max(0, ...suitCounts.values());
  if (maxSuit >= 4) strength += 0.08;
  else if (maxSuit === 3) strength += 0.03;

  for (const h of validHand) {
    if (validBoard.some((b) => b.rank === h.rank)) {
      strength += 0.18;
    }
  }
  return Math.min(0.98, strength);
}

/**
 * 严格遵循公平视野边界：只剔除自身手牌、对方公开牌、公共公开牌，构建合法未知牌堆。
 */
function buildUnseenDeckPool(state: GameState, actorId: PlayerId): Card[] {
  const oppId = otherPlayer(actorId);
  const knownIds = new Set<string>();

  for (const h of state.players[actorId].hand) {
    knownIds.add(h.card.id);
    if (h.originalCard) knownIds.add(h.originalCard.id);
  }
  for (const h of state.players[oppId].hand) {
    if (h.visibility === 'open') {
      knownIds.add(getVisibleHandCard(h, actorId, oppId, false).id);
    }
  }
  for (const b of state.board) {
    if (b.isOpen) {
      knownIds.add(getVisibleBoardCard(b, actorId, false).id);
    }
  }

  return createDeck().filter((c) => !knownIds.has(c.id));
}

function estimateHandEquity(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty,
  rng: () => number
): number {
  const actor = state.players[actorId];
  const oppId = otherPlayer(actorId);
  const opp = state.players[oppId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const myCards = actor.hand.map((h) => h.card);
  const basePartial = scoreCurrentPartialHand(myCards, openBoard);

  if (difficulty === 'rookie') {
    return Math.max(0.08, Math.min(0.95, basePartial + (rng() - 0.5) * 0.12));
  }

  const visibleOppCards = opp.hand
    .filter((h) => h.visibility === 'open')
    .map((h) => getVisibleHandCard(h, actorId, oppId, false));

  if (difficulty === 'standard') {
    const suitStats = getRemainingSuitStats(state, actorId);
    let bonus = 0;
    const mySuits = myCards.map((c) => c.suit);
    if (mySuits.filter((s) => s === 'B').length >= 2 && suitStats.blackPct >= 52) bonus += 0.04;
    if (mySuits.filter((s) => s === 'P').length >= 2 && suitStats.pinkPct >= 52) bonus += 0.04;

    let oppThreat = 0;
    if (visibleOppCards.length >= 2 && openBoard.length >= 1) {
      const oppScore = scoreCurrentPartialHand(visibleOppCards, openBoard);
      oppThreat = Math.max(0, (oppScore - 0.55) * 0.25);
    }
    return Math.max(0.05, Math.min(0.98, basePartial + bonus - oppThreat));
  }

  // Master difficulty: fast Monte Carlo equity simulation over legal unseen deck
  const unseen = buildUnseenDeckPool(state, actorId);
  const missingBoardCount = state.board.filter((b) => !b.isOpen).length;
  const missingOppCount = Math.max(0, opp.hand.length - visibleOppCards.length);
  const needed = missingBoardCount + missingOppCount;

  if (unseen.length < needed) return basePartial;

  const SAMPLES = 120;
  let wins = 0;
  let ties = 0;
  const pool = [...unseen];

  for (let s = 0; s < SAMPLES; s += 1) {
    // Partial Fisher-Yates for only `needed` cards
    for (let i = 0; i < needed; i += 1) {
      const j = i + Math.floor(rng() * (pool.length - i));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const simBoard = [...openBoard, ...pool.slice(0, missingBoardCount)];
    const simOppHand = [
      ...visibleOppCards,
      ...pool.slice(missingBoardCount, missingBoardCount + missingOppCount),
    ];

    const myEval = evaluateSevenCards([...myCards, ...simBoard]);
    const oppEval = evaluateSevenCards([...simOppHand, ...simBoard]);
    if (myEval.score > oppEval.score) wins += 1;
    else if (myEval.score === oppEval.score) ties += 1;
  }

  return Math.max(0.03, Math.min(0.99, (wins + ties * 0.5) / SAMPLES));
}

function scoreCardPotential(hand: Card[], openBoard: Card[]): number {
  const validHand = hand.filter((c) => !c.isBlank);
  const validBoard = openBoard.filter((c) => !c.isBlank);
  const combined = [...validHand, ...validBoard];
  if (combined.length === 0) return 0;
  if (combined.length >= 5) {
    const res = evaluateSevenCards(combined);
    return res.category * 100 + (res.tiebreakers[0] ?? 0) * 2 + (res.tiebreakers[1] ?? 0) * 0.1;
  }
  const rankMap = new Map<number, number>();
  const suitMap = new Map<string, number>();
  for (const c of combined) {
    rankMap.set(c.rank, (rankMap.get(c.rank) ?? 0) + 1);
    suitMap.set(c.suit, (suitMap.get(c.suit) ?? 0) + (c.suit === 'P' && c.isDoublePink ? 2 : 1));
  }
  let score = 0;
  for (const cnt of rankMap.values()) {
    if (cnt >= 4) score += 700;
    else if (cnt === 3) score += 400;
    else if (cnt === 2) score += 120;
  }
  const maxSuit = Math.max(0, ...suitMap.values());
  if (maxSuit >= 5) score += 260;
  else if (maxSuit === 4) score += 70;

  const uniqueRanks = Array.from(rankMap.keys()).sort((a, b) => a - b);
  let seqRun = 1;
  let bestRun = 1;
  for (let i = 1; i < uniqueRanks.length; i += 1) {
    if (uniqueRanks[i] === uniqueRanks[i - 1] + 1) {
      seqRun += 1;
      bestRun = Math.max(bestRun, seqRun);
    } else {
      seqRun = 1;
    }
  }
  if (bestRun >= 5) score += 500;
  else if (bestRun === 4) score += 85;
  else if (bestRun === 3) score += 25;

  const high = validHand.length > 0 ? Math.max(...validHand.map((c) => c.rank)) : 0;
  return score + high;
}

/**
 * 枚举所有合法改牌组合，结合不同作弊倾向决定改牌阈值与收益筛选。
 */
export function pickBestHackAction(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty,
  cheatProfile: EffectiveCheatProfile = 'opportunist'
): GameAction | null {
  if (difficulty === 'rookie' || cheatProfile === 'auditor') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;

  const actor = state.players[actorId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const handCards = actor.hand.map((h) => h.card);
  const baseScore = scoreCardPotential(handCards, openBoard);

  let bestAct: GameAction | null = null;
  let bestGain = 0;
  let minGain = difficulty === 'master' ? 55 : 100;
  if (cheatProfile === 'phantom-hacker') minGain = difficulty === 'master' ? 25 : 55;
  else if (cheatProfile === 'opportunist') minGain = 110;
  else if (cheatProfile === 'disruptor') minGain = 45;

  const skills: HackSkillId[] = ['plus-one', 'minus-one', 'flip-suit'];
  for (let idx = 0; idx < actor.hand.length; idx += 1) {
    const hc = actor.hand[idx];
    if (hc.visibility !== 'open' || (hc.tamperedBy && hc.tamperedBy.length > 0)) continue;

    for (const skill of skills) {
      const act: GameAction = { type: 'hack', handIndex: idx, skill };
      if (!isActionLegal(state, act)) continue;

      const simHand = handCards.map((c, i) => {
        if (i !== idx) return c;
        if (skill === 'plus-one') return { ...c, rank: (c.rank + 1) as Rank };
        if (skill === 'minus-one') return { ...c, rank: (c.rank - 1) as Rank };
        return { ...c, suit: c.suit === 'B' ? ('P' as const) : ('B' as const) };
      });
      const afterScore = scoreCardPotential(simHand, openBoard);
      const gain = afterScore - baseScore;
      if (gain > bestGain) {
        bestGain = gain;
        bestAct = act;
      }
    }
  }

  return bestGain >= minGain ? bestAct : null;
}

function pickSpecialCrownAceAction(
  state: GameState,
  actorId: PlayerId
): GameAction | null {
  if (actorId !== 'ai' || state.aiSpecialCheatSkill !== 'crown-ace') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;

  const actor = state.players[actorId];
  if (actor.chips < 180) return null;

  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const handCards = actor.hand.map((h) => h.card);
  const baseScore = scoreCardPotential(handCards, openBoard);

  let bestAct: GameAction | null = null;
  let bestGain = 0;

  for (let idx = 0; idx < actor.hand.length; idx += 1) {
    const hc = actor.hand[idx];
    if (hc.visibility !== 'open' || hc.card.rank >= 14 || (hc.tamperedBy && hc.tamperedBy.length > 0)) {
      continue;
    }
    const act: GameAction = { type: 'hack', handIndex: idx, skill: 'crown-ace' };
    if (!isActionLegal(state, act)) continue;

    const simHand = handCards.map((c, i) => (i === idx ? { ...c, rank: 14 as Rank } : c));
    const gain = scoreCardPotential(simHand, openBoard) - baseScore;
    if (gain > bestGain) {
      bestGain = gain;
      bestAct = act;
    }
  }

  return bestGain >= 60 ? bestAct : null;
}

function pickSpecialNullEraseAction(
  state: GameState,
  actorId: PlayerId
): GameAction | null {
  if (actorId !== 'ai' || state.aiSpecialCheatSkill !== 'null-erase') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;
  if (state.phase === 'river') return null;

  const actor = state.players[actorId];
  if (actor.swapCount >= 2) return null;
  // Wait until any existing NULL card in hand has been swapped onto the board
  if (actor.hand.some((hc) => hc.card.isBlank)) return null;

  const swappableHidden = state.board.filter(
    (b) => !b.isOpen && !state.frozenBoardIndices?.includes(b.index)
  );
  if (swappableHidden.length === 0) return null;

  const hackCost = getEffectiveHackCost(state, actorId, 'null-erase');
  const swapFee = getNextSwapFee(state, actorId);
  if (actor.chips < Math.max(150, hackCost + swapFee + 20)) return null;

  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const handCards = actor.hand.map((h) => h.card);
  const fullScore = scoreCardPotential(handCards, openBoard);

  let bestIdx: number | null = null;
  let bestScore = -Infinity;

  for (let idx = 0; idx < actor.hand.length; idx += 1) {
    const hc = actor.hand[idx];
    if (
      hc.visibility !== 'open' ||
      hc.card.isBlank ||
      (hc.tamperedBy && hc.tamperedBy.length > 0)
    ) {
      continue;
    }
    const act: GameAction = { type: 'hack', handIndex: idx, skill: 'null-erase' };
    if (!isActionLegal(state, act)) continue;

    const remaining = handCards.filter((_, i) => i !== idx);
    const loss = fullScore - scoreCardPotential(remaining, openBoard);
    // Prefer erasing an open card that hurts AI potential the least, while looking high-rank enough to bait swaps
    const baitValue = hc.card.rank * 4 - loss;
    if (baitValue > bestScore) {
      bestScore = baitValue;
      bestIdx = idx;
    }
  }

  return bestIdx !== null && bestScore > -40
    ? { type: 'hack', handIndex: bestIdx, skill: 'null-erase' }
    : null;
}

function pickSpecialPinkDoubleAction(
  state: GameState,
  actorId: PlayerId
): GameAction | null {
  if (actorId !== 'ai' || state.aiSpecialCheatSkill !== 'pink-double') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;

  const actor = state.players[actorId];
  if (actor.chips < 180) return null;

  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const handCards = actor.hand.map((h) => h.card);
  const baseScore = scoreCardPotential(handCards, openBoard);

  let bestAct: GameAction | null = null;
  let bestGain = -Infinity;
  let bestPinkTotal = 0;

  for (let idx = 0; idx < actor.hand.length; idx += 1) {
    const hc = actor.hand[idx];
    if (
      hc.visibility !== 'open' ||
      hc.card.isBlank ||
      hc.card.suit !== 'P' ||
      hc.card.isDoublePink ||
      (hc.tamperedBy && hc.tamperedBy.length > 0)
    ) {
      continue;
    }
    const act: GameAction = { type: 'hack', handIndex: idx, skill: 'pink-double' };
    if (!isActionLegal(state, act)) continue;

    const simHand = handCards.map((c, i) => (i === idx ? { ...c, isDoublePink: true } : c));
    const gain = scoreCardPotential(simHand, openBoard) - baseScore;
    const pinkTotal = [...simHand, ...openBoard].reduce(
      (sum, c) => sum + (!c.isBlank && c.suit === 'P' ? (c.isDoublePink ? 2 : 1) : 0),
      0
    );
    if (gain > bestGain || (gain === bestGain && pinkTotal > bestPinkTotal)) {
      bestGain = gain;
      bestPinkTotal = pinkTotal;
      bestAct = act;
    }
  }

  return bestAct && (bestGain >= 50 || bestPinkTotal >= 4) ? bestAct : null;
}

function pickSpecialMikiriCounterAction(
  state: GameState,
  actorId: PlayerId
): GameAction | null {
  if (actorId !== 'ai' || state.aiSpecialCheatSkill !== 'mikiri-counter') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;

  const actor = state.players[actorId];
  if (actor.chips < 180) return null;

  // At most 1 active counter-trap per hand across hand + board
  const alreadyArmed =
    actor.hand.some((hc) => hc.card.isCounterTrap) ||
    state.board.some((b) => b.swappedBy === actorId && b.card.isCounterTrap);
  if (alreadyArmed) return null;

  for (let idx = 0; idx < actor.hand.length; idx += 1) {
    const hc = actor.hand[idx];
    if (
      hc.visibility !== 'open' ||
      hc.card.isBlank ||
      hc.card.isCounterTrap ||
      (hc.tamperedBy && hc.tamperedBy.length > 0)
    ) {
      continue;
    }
    const act: GameAction = { type: 'hack', handIndex: idx, skill: 'mikiri-counter' };
    if (isActionLegal(state, act)) {
      return act;
    }
  }
  return null;
}

function pickBestSwappableHandIndex(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty,
  cheatProfile: EffectiveCheatProfile = 'opportunist'
): number | null {
  const actor = state.players[actorId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));

  // 潜行改牌流派 / 信息抹除设陷：若手上已有 NULL 废牌或改过的明牌且仍有未锁定槽位，优先将其换入公共牌池以欺骗玩家视线
  if (cheatProfile === 'phantom-hacker' || state.aiSpecialCheatSkill === 'null-erase') {
    const blankIdx = actor.hand.findIndex(
      (hc) => hc.visibility === 'open' && !hc.lockedFromSwap && Boolean(hc.card.isBlank)
    );
    if (blankIdx >= 0) return blankIdx;
    const tamperedIdx = actor.hand.findIndex(
      (hc) => hc.visibility === 'open' && !hc.lockedFromSwap && Boolean(hc.tamperedBy?.length)
    );
    if (tamperedIdx >= 0) return tamperedIdx;
  }

  if (difficulty === 'rookie') {
    let bestIdx: number | null = null;
    let lowestRank = Infinity;
    actor.hand.forEach((hc, idx) => {
      if (hc.visibility !== 'open' || hc.lockedFromSwap) return;
      if (hc.card.rank < lowestRank) {
        lowestRank = hc.card.rank;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  let bestIdx: number | null = null;
  let bestRemainingPotential = -Infinity;

  actor.hand.forEach((hc, idx) => {
    if (hc.visibility !== 'open' || hc.lockedFromSwap) return;
    const remainingTwo = actor.hand.filter((_, i) => i !== idx).map((h) => h.card);
    const pot = scoreCardPotential(remainingTwo, openBoard) - hc.card.rank * 0.2;
    if (pot > bestRemainingPotential) {
      bestRemainingPotential = pot;
      bestIdx = idx;
    }
  });

  return bestIdx;
}

function pickSmartScanAction(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty,
  cheatProfile: EffectiveCheatProfile,
  equity: number,
  rng: () => number
): GameAction | null {
  const diff = getBetDiff(state, actorId);
  if (diff > 0 && state.phase !== 'river') return null;
  if (state.usedScanThisTurn) return null;

  const actor = state.players[actorId];
  const oppId = otherPlayer(actorId);
  const opp = state.players[oppId];
  // If opponent hasn't acted yet this hand, no tampered card can exist — skip scanning
  if (!state.actionHistory.some((e) => e.actor === oppId)) return null;
  const scanCost = getEffectiveScanCost(state, actorId);
  const chipBuffer = cheatProfile === 'auditor' ? 20 : difficulty === 'master' ? 60 : 160;
  if (actor.chips < scanCost + chipBuffer) return null;

  const targets: Array<{ targetKind: 'hand' | 'board'; targetIndex: number; weight: number }> = [];

  opp.hand.forEach((h, idx) => {
    if (h.visibility !== 'open') return;
    if (state.scannedKeys.includes(`${actorId}:hand:${idx}`)) return;
    targets.push({ targetKind: 'hand', targetIndex: idx, weight: 1.2 });
  });

  state.board.forEach((slot) => {
    if (!slot.isOpen || slot.swappedBy !== oppId) return;
    if (state.scannedKeys.includes(`${actorId}:board:${slot.index}`)) return;
    targets.push({
      targetKind: 'board',
      targetIndex: slot.index,
      weight: cheatProfile === 'auditor' ? 2.6 : 2.1,
    });
  });

  if (targets.length === 0) return null;

  let suspicion = 0;
  if (diff >= 30) suspicion += 0.16;
  if (state.phase === 'river' && diff > 0 && equity >= 0.35 && equity <= 0.65) suspicion += 0.18;
  if (state.pastHands?.some((p) => p.humanHadTamper)) suspicion += 0.14;
  if (state.board.some((b) => b.isOpen && b.swappedBy === oppId)) suspicion += 0.12;

  let baseChance =
    difficulty === 'rookie'
      ? 0.02
      : difficulty === 'standard'
        ? 0.06 + suspicion * 0.65
        : 0.1 + suspicion * 1.1;

  if (cheatProfile === 'auditor') baseChance = Math.max(0.18, baseChance + 0.24);
  else if (cheatProfile === 'phantom-hacker') baseChance *= 0.55;
  else if (cheatProfile === 'opportunist') baseChance = diff >= 30 ? baseChance * 1.1 : baseChance * 0.5;

  if (rng() >= Math.min(0.76, baseChance)) return null;

  targets.sort((a, b) => b.weight - a.weight);
  const pick = difficulty === 'rookie'
    ? targets[Math.floor(rng() * targets.length)]
    : targets[0];

  const act: GameAction = {
    type: 'scan',
    targetKind: pick.targetKind,
    targetIndex: pick.targetIndex,
  };
  return isActionLegal(state, act) ? act : null;
}

function pickRandomHiddenBoardIndex(
  state: GameState,
  rng: () => number,
  actorId: PlayerId = 'ai'
): number | null {
  const hidden = state.board
    .filter((b) => !b.isOpen && !(actorId === 'ai' && state.frozenBoardIndices?.includes(b.index)))
    .map((b) => b.index);
  if (hidden.length === 0) return null;
  return hidden[Math.floor(rng() * hidden.length)];
}

function buildDialogue(
  speaker: string,
  mood: OpponentMood,
  text: string,
  reasoningHint?: string,
  expressionOverride?: ContractExpression
): OpponentDialogue {
  return {
    speaker,
    mood,
    expression: expressionOverride ?? moodToExpression(mood),
    text,
    reasoningHint,
    timestamp: Date.now(),
    fromLlm: false,
  };
}

export class LocalAiAgent implements OpponentAgent {
  readonly id: string;
  private readonly playerId: PlayerId;
  private style: AiStyle;
  private difficulty: EffectiveAiDifficulty;
  private playStyle: EffectivePlayStyle;
  private cheatProfile: EffectiveCheatProfile;
  private character: ContractCharacter;
  private readonly rng: () => number;

  constructor(
    playerId: PlayerId = 'ai',
    style: AiStyle = 'balanced',
    character: ContractCharacter = FALLBACK_CONTRACT_CHARACTER,
    rng: () => number = Math.random,
    difficulty: EffectiveAiDifficulty = 'standard',
    playStyle: EffectivePlayStyle = 'pressure',
    cheatProfile: EffectiveCheatProfile = 'opportunist'
  ) {
    this.id = `local-ai-${style}-${difficulty}`;
    this.playerId = playerId;
    this.style = style;
    this.difficulty = difficulty;
    this.playStyle = playStyle;
    this.cheatProfile = cheatProfile;
    this.character = character;
    this.rng = rng;
  }

  get displayName(): string {
    return `${this.character.name} // ${this.character.codename}`;
  }

  setStyle(style: AiStyle): void {
    this.style = style;
  }

  setDifficulty(difficulty: EffectiveAiDifficulty): void {
    this.difficulty = difficulty;
  }

  setStrategy(playStyle: EffectivePlayStyle, cheatProfile: EffectiveCheatProfile): void {
    this.playStyle = playStyle;
    this.cheatProfile = cheatProfile;
  }

  setCharacter(character: ContractCharacter): void {
    this.character = character;
  }

  async decide(state: GameState): Promise<{
    action: GameAction;
    dialogue: OpponentDialogue;
  }> {
    const actor = state.players[this.playerId];
    const opp = state.players[otherPlayer(this.playerId)];
    const equity = estimateHandEquity(state, this.playerId, this.difficulty, this.rng);

    const styleBias =
      this.playStyle === 'pressure'
        ? 0.09
        : this.playStyle === 'conservative'
          ? -0.07
          : this.style === 'aggressive'
            ? 0.07
            : this.style === 'cautious'
              ? -0.06
              : 0;
    const effectiveStrength = Math.max(0.04, Math.min(0.99, equity + styleBias));

    const diff = getBetDiff(state, this.playerId);
    const hiddenCount = getHiddenBoardCount(state);
    const roll = this.rng();
    const speaker = this.displayName;
    const telemetry = serializeStateForLlm(state);
    const lastType = state.lastAction?.type;

    // 0. 信息抹除 / 潜行设陷优先脱手：手上有已抹除的 NULL 牌或潜行改过的明牌时，优先换入未翻开公共节点（即使刚执行完 hack/scan 也应立刻打出）
    if (
      diff === 0 &&
      state.phase !== 'river' &&
      hiddenCount > 0 &&
      actor.swapCount < 2
    ) {
      const boardIdx = pickRandomHiddenBoardIndex(state, this.rng, this.playerId);
      const swapFee = getNextSwapFee(state, this.playerId);
      const blankHandIdx = actor.hand.findIndex(
        (hc) => hc.visibility === 'open' && !hc.lockedFromSwap && Boolean(hc.card.isBlank)
      );
      if (blankHandIdx >= 0 && boardIdx !== null && actor.chips >= swapFee) {
        const nullSwap: GameAction = {
          type: 'swap',
          handIndex: blankHandIdx,
          boardIndex: boardIdx,
        };
        if (isActionLegal(state, nullSwap)) {
          return {
            action: nullSwap,
            dialogue: buildDialogue(
              speaker,
              'thinking',
              `投入 ${swapFee} 覆写费置换暗牌槽 #${boardIdx + 1}——把弱牌换成私有暗门。`,
              telemetry,
              'smile'
            ),
          };
        }
      }

      if (
        (this.cheatProfile === 'phantom-hacker' || state.aiSpecialCheatSkill === 'null-erase') &&
        boardIdx !== null &&
        actor.chips >= swapFee + 40
      ) {
        const tamperedHandIdx = actor.hand.findIndex(
          (hc) => hc.visibility === 'open' && !hc.lockedFromSwap && Boolean(hc.tamperedBy?.length)
        );
        if (tamperedHandIdx >= 0) {
          const trapSwap: GameAction = {
            type: 'swap',
            handIndex: tamperedHandIdx,
            boardIndex: boardIdx,
          };
          if (isActionLegal(state, trapSwap)) {
            return {
              action: trapSwap,
              dialogue: buildDialogue(
                speaker,
                'thinking',
                `投入 ${swapFee} 算力重构节点 #${boardIdx + 1}——真正的好牌该藏在私有扇区里。`,
                telemetry,
                'smile'
              ),
            };
          }
        }
      }
    }

    // 1. Smart Scan & Profile-Driven Hacker Skill (non-consuming)
    if (lastType !== 'hack' && lastType !== 'scan') {
      const crownAceAct = pickSpecialCrownAceAction(state, this.playerId);
      if (crownAceAct && roll < 0.55) {
        return {
          action: crownAceAct,
          dialogue: buildDialogue(
            speaker,
            'confident',
            '哼，连这手牌面都看不懂吗？本小姐可不会在这种杂鱼局里浪费时间。',
            telemetry,
            'smile'
          ),
        };
      }

      const nullEraseAct = pickSpecialNullEraseAction(state, this.playerId);
      if (nullEraseAct && roll < 0.48) {
        return {
          action: nullEraseAct,
          dialogue: buildDialogue(
            speaker,
            'idle',
            '整理一下这一轮的牌面节奏。',
            telemetry,
            'calm'
          ),
        };
      }

      const pinkDoubleAct = pickSpecialPinkDoubleAction(state, this.playerId);
      if (pinkDoubleAct && roll < 0.52) {
        return {
          action: pinkDoubleAct,
          dialogue: buildDialogue(
            speaker,
            'idle',
            '让我理一下这手粉嘟嘟的牌面节奏。',
            telemetry,
            'smile'
          ),
        };
      }

      const mikiriAct = pickSpecialMikiriCounterAction(state, this.playerId);
      if (mikiriAct && roll < 0.55) {
        return {
          action: mikiriAct,
          dialogue: buildDialogue(
            speaker,
            'idle',
            '稍微纳刀调整一下手头的牌序。',
            telemetry,
            'calm'
          ),
        };
      }

      const smartScan = pickSmartScanAction(
        state,
        this.playerId,
        this.difficulty,
        this.cheatProfile,
        equity,
        this.rng
      );
      if (smartScan) {
        return {
          action: smartScan,
          dialogue: buildDialogue(
            speaker,
            'tense',
            `你的下注节奏与牌面结构对不上……预支 ${getEffectiveScanCost(state, this.playerId)} 算力扫描验真！`,
            telemetry,
            'angry'
          ),
        };
      }

      if (diff === 0 && actor.chips >= 200) {
        const smartHack = pickBestHackAction(
          state,
          this.playerId,
          this.difficulty,
          this.cheatProfile
        );
        const hackGate =
          this.cheatProfile === 'phantom-hacker'
            ? 0.9
            : this.cheatProfile === 'disruptor'
              ? 0.8
              : this.cheatProfile === 'opportunist'
                ? state.phase === 'mid' || hiddenCount <= 1
                  ? 0.85
                  : 0.35
                : 0;
        if (smartHack && smartHack.type === 'hack') {
          const cost = getEffectiveHackCost(state, this.playerId, smartHack.skill);
          if (actor.chips >= cost + 100 && roll < hackGate) {
            return {
              action: smartHack,
              dialogue: buildDialogue(
                speaker,
                'idle',
                '让我整理一下这一轮的牌面节奏。',
                telemetry,
                'calm'
              ),
            };
          }
        }
      }
    }

    // 2. River Phase Decisions (all community cards open)
    if (state.phase === 'river') {
      if (diff === 0) {
        const halfThreshold = this.playStyle === 'pressure' ? 0.76 : 0.82;
        const halfProb = this.playStyle === 'pressure' ? 0.45 : this.playStyle === 'trap' ? 0.4 : 0.25;
        if (this.difficulty === 'master' && effectiveStrength >= halfThreshold && actor.chips >= 240 && roll < halfProb) {
          const halfAmt = getHalfStackRaiseAmount(state, this.playerId);
          if (halfAmt > 0 && isActionLegal(state, { type: 'raise', amount: halfAmt, isHalfStack: true })) {
            return {
              action: { type: 'raise', amount: halfAmt, isHalfStack: true },
              dialogue: buildDialogue(
                speaker,
                'confident',
                `算力超频半池压进 +${halfAmt}——这手牌我没打算留给你便宜摊牌！`,
                telemetry,
                'angry'
              ),
            };
          }
        }

        const raiseRange = getLegalRaiseRange(state, this.playerId, 0);
        const bluffChance =
          this.playStyle === 'pressure'
            ? 0.3
            : this.cheatProfile === 'disruptor'
              ? 0.24
              : this.playStyle === 'conservative'
                ? 0.02
                : 0.1;
        const valueThreshold = this.playStyle === 'trap' ? 0.48 : 0.56;
        if (
          raiseRange.allowed &&
          (effectiveStrength > valueThreshold || roll < bluffChance)
        ) {
          const step = Math.max(
            raiseRange.min,
            Math.min(
              raiseRange.max,
              Math.round((raiseRange.min + (raiseRange.max - raiseRange.min) * effectiveStrength) / 10) * 10
            )
          );
          return {
            action: { type: 'raise', amount: step },
            dialogue: buildDialogue(
              speaker,
              'confident',
              `终局节点已经全亮了——加注 +${step}，敢跟进我的核心扇区验牌吗？`,
              telemetry,
              'smile'
            ),
          };
        }
        return {
          action: { type: 'check' },
          dialogue: buildDialogue(
            speaker,
            'idle',
            '先静默过牌，看看你的最后一道指令怎么出。',
            telemetry,
            'calm'
          ),
        };
      }

      const paid = Math.min(diff, actor.chips);
      const potOdds = paid / Math.max(1, state.pot + paid);
      const foldMultiplier =
        this.playStyle === 'conservative'
          ? 0.98
          : this.playStyle === 'pressure'
            ? 0.78
            : this.difficulty === 'master'
              ? 0.92
              : 0.82;
      if (effectiveStrength < potOdds * foldMultiplier && paid >= 25 && roll > (this.difficulty === 'master' ? 0.08 : 0.2)) {
        return {
          action: { type: 'fold' },
          dialogue: buildDialogue(
            speaker,
            'defeat',
            '这笔算力赔率不划算，主动切断本轮连接，底池归你。',
            telemetry,
            'sad'
          ),
        };
      }

      const raiseRange = getLegalRaiseRange(state, this.playerId, paid);
      const reraiseProb = this.playStyle === 'trap' ? 0.72 : this.playStyle === 'pressure' ? 0.6 : 0.42;
      if (raiseRange.allowed && effectiveStrength > 0.74 && roll < reraiseProb) {
        return {
          action: { type: 'raise', amount: raiseRange.max },
          dialogue: buildDialogue(
            speaker,
            'confident',
            `同步差额后再反加 +${raiseRange.max}！这一步陷阱已经合拢了。`,
            telemetry,
            'smile'
          ),
        };
      }

      return {
        action: { type: 'call' },
        dialogue: buildDialogue(
          speaker,
          effectiveStrength > 0.62 ? 'confident' : 'tense',
          `跟注 +${paid}，启动终局解密核验吧！`,
          telemetry,
          effectiveStrength > 0.62 ? 'smile' : 'angry'
        ),
      };
    }

    // 3. Facing a Bet in Early / Mid Phase
    if (diff > 0) {
      const paid = Math.min(diff, actor.chips);
      const willBeAllIn = actor.chips - paid === 0 || opp.allIn;
      const potOdds = paid / Math.max(1, state.pot + paid);
      const preRiverFoldMult =
        this.playStyle === 'conservative' ? 0.92 : this.playStyle === 'pressure' ? 0.68 : 0.82;

      if (effectiveStrength < potOdds * preRiverFoldMult && paid >= 20 && roll > 0.18) {
        return {
          action: { type: 'fold' },
          dialogue: buildDialogue(
            speaker,
            'surprised',
            '压迫感挺强嘛……这一局我先撤出端口，下一把再算账。',
            telemetry,
            'shy'
          ),
        };
      }

      if (willBeAllIn) {
        return {
          action: { type: 'call' },
          dialogue: buildDialogue(
            speaker,
            'tense',
            '全下过载？正合我意，所有加密节点一起掀开吧！',
            telemetry,
            'surprise'
          ),
        };
      }

      return {
        action: { type: 'call' },
        dialogue: buildDialogue(
          speaker,
          effectiveStrength > 0.65 ? 'confident' : 'thinking',
          `先把这 ${paid} 算力补齐推入中枢——我的操作回合还没结束。`,
          telemetry,
          effectiveStrength > 0.65 ? 'smile' : 'calm'
        ),
      };
    }

    // 4. Flat Turn in Early / Mid Phase (Swap, Raise, Flip, End-Turn)
    const raiseRange = getLegalRaiseRange(state, this.playerId, 0);
    const swapIdx = pickBestSwappableHandIndex(
      state,
      this.playerId,
      this.difficulty,
      this.cheatProfile
    );
    const boardIdx = pickRandomHiddenBoardIndex(state, this.rng, this.playerId);
    const swapFee = getNextSwapFee(state, this.playerId);
    const canSwap =
      hiddenCount > 0 &&
      swapIdx !== null &&
      boardIdx !== null &&
      actor.chips >= swapFee &&
      actor.chips - swapFee > state.config.minRaise;

    if (state.justCalledThisTurn && roll < (this.playStyle === 'trap' ? 0.45 : 0.25) && isActionLegal(state, { type: 'end-turn' })) {
      return {
        action: { type: 'end-turn' },
        dialogue: buildDialogue(
          speaker,
          'idle',
          '同步完注码后暂不改写节点，控制权交回给你。',
          telemetry,
          'calm'
        ),
      };
    }

    const swapThreshold = this.playStyle === 'sculptor' ? 0.72 : 0.56;
    const swapProb =
      this.playStyle === 'sculptor'
        ? 0.92
        : this.difficulty === 'rookie'
          ? 0.45
          : this.difficulty === 'standard'
            ? 0.68
            : 0.8;
    if (canSwap && effectiveStrength < swapThreshold && actor.swapCount < 2 && roll < swapProb) {
      const action: GameAction = { type: 'swap', handIndex: swapIdx!, boardIndex: boardIdx! };
      if (isActionLegal(state, action)) {
        return {
          action,
          dialogue: buildDialogue(
            speaker,
            'thinking',
            `投入 ${swapFee} 覆写费置换暗牌槽 #${boardIdx! + 1}——把弱牌换成私有暗门。`,
            telemetry,
            'smile'
          ),
        };
      }
    }

    // 控池陷阱流派：早期拿到高胜率强牌时故意慢打不加注，引诱玩家往底池投算力
    const trapSlowPlay =
      this.playStyle === 'trap' && effectiveStrength >= 0.7 && roll < 0.78;
    const earlyRaiseChance =
      this.playStyle === 'pressure'
        ? 0.4
        : this.cheatProfile === 'disruptor'
          ? 0.3
          : this.playStyle === 'conservative'
            ? 0.05
            : 0.16;

    if (
      !trapSlowPlay &&
      raiseRange.allowed &&
      (effectiveStrength > 0.57 || roll < earlyRaiseChance)
    ) {
      const amt =
        effectiveStrength > 0.74
          ? raiseRange.max
          : Math.max(
              raiseRange.min,
              Math.min(
                raiseRange.max,
                Math.round((raiseRange.max * 0.5) / 10) * 10 || raiseRange.min
              )
            );
      const action: GameAction = { type: 'raise', amount: amt };
      if (isActionLegal(state, action)) {
        return {
          action,
          dialogue: buildDialogue(
            speaker,
            'tense',
            `向主池注入 +${amt} 算力。跟还是退？`,
            telemetry,
            'angry'
          ),
        };
      }
    }

    return {
      action: { type: 'flip', boardIndex: boardIdx ?? 0 },
      dialogue: buildDialogue(
        speaker,
        'idle',
        `免费破译公共节点 #${(boardIdx ?? 0) + 1}，看看黑粉脉冲往哪边偏。`,
        telemetry,
        'calm'
      ),
    };
  }
}
