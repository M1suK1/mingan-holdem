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
  const combined = [...hand, ...openBoard];
  if (combined.length >= 5) {
    const evalRes = evaluateSevenCards(combined);
    return Math.min(1, 0.24 + evalRes.category * 0.1 + (evalRes.tiebreakers[0] ?? 7) / 140);
  }
  if (hand.length !== 3) {
    return Math.min(0.95, Math.max(0.15, scoreCardPotential(hand, openBoard) / 500));
  }
  const three = evaluateThreeCards(hand);
  let strength = 0.2 + three.category * 0.28 + (three.tiebreakers[0] ?? 7) / 45;
  const suitCounts = new Map<string, number>();
  for (const c of combined) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const maxSuit = Math.max(...suitCounts.values());
  if (maxSuit >= 4) strength += 0.08;
  else if (maxSuit === 3) strength += 0.03;

  for (const h of hand) {
    if (openBoard.some((b) => b.rank === h.rank)) {
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
  const combined = [...hand, ...openBoard];
  if (combined.length >= 5) {
    const res = evaluateSevenCards(combined);
    return res.category * 100 + (res.tiebreakers[0] ?? 0) * 2 + (res.tiebreakers[1] ?? 0) * 0.1;
  }
  const rankMap = new Map<number, number>();
  const suitMap = new Map<string, number>();
  for (const c of combined) {
    rankMap.set(c.rank, (rankMap.get(c.rank) ?? 0) + 1);
    suitMap.set(c.suit, (suitMap.get(c.suit) ?? 0) + 1);
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

  const high = Math.max(...hand.map((c) => c.rank));
  return score + high;
}

/**
 * 枚举所有合法改牌组合，只在实际明显拔高成牌/听牌结构时选择最优改牌。
 */
export function pickBestHackAction(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty
): GameAction | null {
  if (difficulty === 'rookie') return null;
  if (state.usedHackThisTurn || getBetDiff(state, actorId) > 0) return null;

  const actor = state.players[actorId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const handCards = actor.hand.map((h) => h.card);
  const baseScore = scoreCardPotential(handCards, openBoard);

  let bestAct: GameAction | null = null;
  let bestGain = 0;
  const minGain = difficulty === 'master' ? 55 : 100;

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

function pickBestSwappableHandIndex(
  state: GameState,
  actorId: PlayerId,
  difficulty: EffectiveAiDifficulty
): number | null {
  const actor = state.players[actorId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));

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
  equity: number,
  rng: () => number
): GameAction | null {
  const diff = getBetDiff(state, actorId);
  if (diff > 0 && state.phase !== 'river') return null;
  if (state.usedScanThisTurn) return null;

  const actor = state.players[actorId];
  const oppId = otherPlayer(actorId);
  const opp = state.players[oppId];
  const scanCost = getEffectiveScanCost(state, actorId);
  if (actor.chips < scanCost + (difficulty === 'master' ? 60 : 160)) return null;

  const targets: Array<{ targetKind: 'hand' | 'board'; targetIndex: number; weight: number }> = [];

  opp.hand.forEach((h, idx) => {
    if (state.scannedKeys.includes(`${actorId}:hand:${idx}`)) return;
    // Open cards or swapped-in private cards that look suspicious
    let weight = h.visibility === 'open' ? 1.2 : 1.0;
    if (h.visibility === 'private' && state.phase === 'river') weight += 0.6;
    targets.push({ targetKind: 'hand', targetIndex: idx, weight });
  });

  state.board.forEach((slot) => {
    if (!slot.isOpen || slot.swappedBy !== oppId) return;
    if (state.scannedKeys.includes(`${actorId}:board:${slot.index}`)) return;
    // Player actively swapped this card into the community board -> higher suspicion!
    targets.push({ targetKind: 'board', targetIndex: slot.index, weight: 2.1 });
  });

  if (targets.length === 0) return null;

  let suspicion = 0;
  if (diff >= 30) suspicion += 0.14;
  if (state.phase === 'river' && diff > 0 && equity >= 0.35 && equity <= 0.65) suspicion += 0.18;
  if (state.pastHands?.some((p) => p.humanHadTamper)) suspicion += 0.12;
  if (state.board.some((b) => b.isOpen && b.swappedBy === oppId)) suspicion += 0.1;

  const baseChance =
    difficulty === 'rookie'
      ? 0.02
      : difficulty === 'standard'
        ? 0.06 + suspicion * 0.65
        : 0.1 + suspicion * 1.1;

  if (rng() >= Math.min(0.55, baseChance)) return null;

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

function pickRandomHiddenBoardIndex(state: GameState, rng: () => number): number | null {
  const hidden = state.board.filter((b) => !b.isOpen).map((b) => b.index);
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
  private character: ContractCharacter;
  private readonly rng: () => number;

  constructor(
    playerId: PlayerId = 'ai',
    style: AiStyle = 'balanced',
    character: ContractCharacter = FALLBACK_CONTRACT_CHARACTER,
    rng: () => number = Math.random,
    difficulty: EffectiveAiDifficulty = 'standard'
  ) {
    this.id = `local-ai-${style}-${difficulty}`;
    this.playerId = playerId;
    this.style = style;
    this.difficulty = difficulty;
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

    const aggroBias =
      this.style === 'aggressive' ? 0.1 : this.style === 'cautious' ? -0.08 : 0;
    const effectiveStrength = Math.max(0.04, Math.min(0.99, equity + aggroBias));

    const diff = getBetDiff(state, this.playerId);
    const hiddenCount = getHiddenBoardCount(state);
    const roll = this.rng();
    const speaker = this.displayName;
    const telemetry = serializeStateForLlm(state);
    const lastType = state.lastAction?.type;

    // 1. Smart Scan & Value-Gated Hacker Skill (non-consuming)
    if (lastType !== 'hack' && lastType !== 'scan') {
      const smartScan = pickSmartScanAction(state, this.playerId, this.difficulty, equity, this.rng);
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

      if (diff === 0 && actor.chips >= 220) {
        const smartHack = pickBestHackAction(state, this.playerId, this.difficulty);
        const hackGate = this.difficulty === 'master' ? 0.72 : 0.45;
        if (smartHack && smartHack.type === 'hack') {
          const cost = getEffectiveHackCost(state, this.playerId, smartHack.skill);
          if (actor.chips >= cost + 120 && roll < hackGate) {
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
        if (this.difficulty === 'master' && effectiveStrength >= 0.82 && actor.chips >= 240 && roll < 0.35) {
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
        const bluffChance = this.difficulty === 'master' ? 0.14 : this.style === 'aggressive' ? 0.24 : 0.06;
        if (
          raiseRange.allowed &&
          (effectiveStrength > 0.56 || roll < bluffChance)
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
      const foldMultiplier = this.difficulty === 'master' ? 0.94 : this.difficulty === 'standard' ? 0.85 : 0.65;
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
      if (raiseRange.allowed && effectiveStrength > 0.76 && roll < (this.difficulty === 'master' ? 0.55 : 0.4)) {
        return {
          action: { type: 'raise', amount: raiseRange.max },
          dialogue: buildDialogue(
            speaker,
            'confident',
            `同步差额后再反加 +${raiseRange.max}！概率分布可站在我这边。`,
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
      const preRiverFoldMult = this.difficulty === 'master' ? 0.84 : 0.72;

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
    const swapIdx = pickBestSwappableHandIndex(state, this.playerId, this.difficulty);
    const boardIdx = pickRandomHiddenBoardIndex(state, this.rng);
    const swapFee = getNextSwapFee(state, this.playerId);
    const canSwap =
      hiddenCount > 0 &&
      swapIdx !== null &&
      boardIdx !== null &&
      actor.chips >= swapFee &&
      actor.chips - swapFee > state.config.minRaise;

    if (state.justCalledThisTurn && roll < (this.difficulty === 'master' ? 0.25 : 0.35) && isActionLegal(state, { type: 'end-turn' })) {
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

    const swapThreshold = this.difficulty === 'master' ? 0.56 : 0.62;
    const swapProb = this.difficulty === 'rookie' ? 0.45 : this.difficulty === 'standard' ? 0.68 : 0.84;
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

    if (
      raiseRange.allowed &&
      (effectiveStrength > 0.57 || roll < (this.style === 'aggressive' ? 0.32 : this.difficulty === 'master' ? 0.18 : 0.12))
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
            `向主池注入 +${amt} 算力筹码。跟还是退？`,
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
