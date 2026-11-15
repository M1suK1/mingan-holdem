import type {
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
} from './types.ts';
import { evaluateSevenCards, evaluateThreeCards } from './evaluator.ts';
import {
  getBetDiff,
  getHackSkillCost,
  getHiddenBoardCount,
  getLegalRaiseRange,
  getNextSwapFee,
  getVisibleBoardCard,
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

function scoreCurrentPartialHand(hand: Card[], openBoard: Card[]): number {
  const combined = [...hand, ...openBoard];
  if (combined.length >= 5) {
    const evalRes = evaluateSevenCards(combined);
    return Math.min(1, 0.24 + evalRes.category * 0.1 + (evalRes.tiebreakers[0] ?? 7) / 140);
  }
  const three = evaluateThreeCards(hand);
  let strength = 0.2 + three.category * 0.28 + (three.tiebreakers[0] ?? 7) / 45;
  const suitCounts = new Map<string, number>();
  for (const c of combined) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const maxSuit = Math.max(...suitCounts.values());
  // In reranked 2-suit deck, Flush sits between One Pair and Two Pair (modest bonus)
  if (maxSuit >= 4) strength += 0.08;
  else if (maxSuit === 3) strength += 0.03;

  for (const h of hand) {
    if (openBoard.some((b) => b.rank === h.rank)) {
      strength += 0.18;
    }
  }
  return Math.min(0.98, strength);
}

function pickWeakestSwappableHandIndex(state: GameState, actorId: PlayerId): number | null {
  const actor = state.players[actorId];
  const openBoard = state.board
    .filter((b) => b.isOpen)
    .map((b) => getVisibleBoardCard(b, actorId, false));
  const rankFreq = new Map<number, number>();
  const suitFreq = new Map<string, number>();

  for (const h of actor.hand) {
    rankFreq.set(h.card.rank, (rankFreq.get(h.card.rank) ?? 0) + 1);
    suitFreq.set(h.card.suit, (suitFreq.get(h.card.suit) ?? 0) + 1);
  }
  for (const b of openBoard) {
    rankFreq.set(b.rank, (rankFreq.get(b.rank) ?? 0) + 1);
    suitFreq.set(b.suit, (suitFreq.get(b.suit) ?? 0) + 1);
  }

  let bestIdx: number | null = null;
  let lowestKeepScore = Infinity;

  actor.hand.forEach((hc, idx) => {
    if (hc.visibility !== 'open' || hc.lockedFromSwap) return;
    const rFreq = rankFreq.get(hc.card.rank) ?? 1;
    const sFreq = suitFreq.get(hc.card.suit) ?? 1;
    const keepScore = rFreq * 22 + sFreq * 6 + hc.card.rank;
    if (keepScore < lowestKeepScore) {
      lowestKeepScore = keepScore;
      bestIdx = idx;
    }
  });

  return bestIdx;
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
  private character: ContractCharacter;
  private readonly rng: () => number;

  constructor(
    playerId: PlayerId = 'ai',
    style: AiStyle = 'balanced',
    character: ContractCharacter = FALLBACK_CONTRACT_CHARACTER,
    rng: () => number = Math.random
  ) {
    this.id = `local-ai-${style}`;
    this.playerId = playerId;
    this.style = style;
    this.character = character;
    this.rng = rng;
  }

  get displayName(): string {
    return `${this.character.name} // ${this.character.codename}`;
  }

  setStyle(style: AiStyle): void {
    this.style = style;
  }

  setCharacter(character: ContractCharacter): void {
    this.character = character;
  }

  async decide(state: GameState): Promise<{
    action: GameAction;
    dialogue: OpponentDialogue;
  }> {
    const actor = state.players[this.playerId];
    const oppId = otherPlayer(this.playerId);
    const opp = state.players[oppId];
    const openBoard = state.board
      .filter((b) => b.isOpen)
      .map((b) => getVisibleBoardCard(b, this.playerId, false));
    const myCards = actor.hand.map((h) => h.card);
    const strength = scoreCurrentPartialHand(myCards, openBoard);

    const aggroBias =
      this.style === 'aggressive' ? 0.14 : this.style === 'cautious' ? -0.1 : 0;
    const effectiveStrength = Math.max(0.05, Math.min(0.99, strength + aggroBias));

    const diff = getBetDiff(state, this.playerId);
    const hiddenCount = getHiddenBoardCount(state);
    const roll = this.rng();
    const speaker = this.displayName;
    const telemetry = serializeStateForLlm(state);

    // Opportunistic non-consuming Scan (allowed when diff === 0 OR on river before calling) or Hacker skill (diff === 0 only)
    const lastType = state.lastAction?.type;
    if ((diff === 0 || state.phase === 'river') && lastType !== 'hack' && lastType !== 'scan') {
      // Non-omniscient Scan when opponent is betting aggressively or in late board
      const scanChance = state.phase === 'river' && diff > 0 ? 0.22 : state.phase !== 'early' ? 0.08 : 0.03;
      if (actor.chips >= state.config.scanCost + 180 && roll < scanChance) {
        const oppOpenIdx = opp.hand.findIndex(
          (h, idx) =>
            h.visibility === 'open' &&
            !state.scannedKeys.includes(`${this.playerId}:hand:${idx}`)
        );
        if (oppOpenIdx !== -1) {
          const scanAct: GameAction = {
            type: 'scan',
            targetKind: 'hand',
            targetIndex: oppOpenIdx,
          };
          if (isActionLegal(state, scanAct)) {
            return {
              action: scanAct,
              dialogue: buildDialogue(
                speaker,
                'tense',
                `你这张明牌的数据流有点可疑……预支 ${state.config.scanCost} 算力扫描验真！`,
                telemetry,
                'angry'
              ),
            };
          }
        }
      }

      // Opportunistic Hacker tamper on an unmodified open hand card (only when diff === 0)
      const hackChance = this.style === 'aggressive' ? 0.14 : this.style === 'balanced' ? 0.09 : 0.04;
      if (diff === 0 && actor.chips >= 280 && roll > 1 - hackChance) {
        const openIdx = actor.hand.findIndex(
          (h) => h.visibility === 'open' && (!h.tamperedBy || h.tamperedBy.length === 0)
        );
        if (openIdx !== -1) {
          const candidates: HackSkillId[] = ['plus-one', 'minus-one', 'flip-suit'];
          const pickSkill = candidates[Math.floor(this.rng() * candidates.length)];
          const hackAct: GameAction = {
            type: 'hack',
            handIndex: openIdx,
            skill: pickSkill,
          };
          if (
            actor.chips >= getHackSkillCost(state, pickSkill) + 150 &&
            isActionLegal(state, hackAct)
          ) {
            return {
              action: hackAct,
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

    if (state.phase === 'river') {
      if (diff === 0) {
        const raiseRange = getLegalRaiseRange(state, this.playerId, 0);
        if (
          raiseRange.allowed &&
          (effectiveStrength > 0.58 || (this.style === 'aggressive' && roll < 0.3))
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
      if (effectiveStrength < potOdds * 0.9 && paid >= 30 && roll > 0.18) {
        return {
          action: { type: 'fold' },
          dialogue: buildDialogue(
            speaker,
            'defeat',
            '这笔算力损耗比不划算，主动切断本轮连接，底池归你。',
            telemetry,
            'sad'
          ),
        };
      }

      const raiseRange = getLegalRaiseRange(state, this.playerId, paid);
      if (raiseRange.allowed && effectiveStrength > 0.78 && roll < 0.45) {
        return {
          action: { type: 'raise', amount: raiseRange.max },
          dialogue: buildDialogue(
            speaker,
            'confident',
            `同步差额后再反加 +${raiseRange.max}！黑粉同花的概率可站在我这边。`,
            telemetry,
            'smile'
          ),
        };
      }

      return {
        action: { type: 'call' },
        dialogue: buildDialogue(
          speaker,
          effectiveStrength > 0.65 ? 'confident' : 'tense',
          `跟注 +${paid}，启动终局解密核验吧！`,
          telemetry,
          effectiveStrength > 0.65 ? 'smile' : 'angry'
        ),
      };
    }

    if (diff > 0) {
      const paid = Math.min(diff, actor.chips);
      const opp = state.players[otherPlayer(this.playerId)];
      const willBeAllIn = actor.chips - paid === 0 || opp.allIn;
      const potOdds = paid / Math.max(1, state.pot + paid);

      if (effectiveStrength < potOdds * 0.78 && paid >= 20 && roll > 0.25) {
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

    const raiseRange = getLegalRaiseRange(state, this.playerId, 0);
    const swapIdx = pickWeakestSwappableHandIndex(state, this.playerId);
    const boardIdx = pickRandomHiddenBoardIndex(state, this.rng);
    const swapFee = getNextSwapFee(state, this.playerId);
    const canSwap =
      hiddenCount > 0 &&
      swapIdx !== null &&
      boardIdx !== null &&
      actor.chips >= swapFee &&
      actor.chips - swapFee > state.config.minRaise;

    if (state.justCalledThisTurn && roll < 0.32 && isActionLegal(state, { type: 'end-turn' })) {
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

    if (canSwap && effectiveStrength < 0.62 && actor.swapCount < 2 && roll < 0.72) {
      const action: GameAction = { type: 'swap', handIndex: swapIdx!, boardIndex: boardIdx! };
      if (isActionLegal(state, action)) {
        return {
          action,
          dialogue: buildDialogue(
            speaker,
            'thinking',
            `投入 ${swapFee} 覆写费置换暗牌槽 #${boardIdx! + 1}——把废码换成私有后门。`,
            telemetry,
            'smile'
          ),
        };
      }
    }

    if (
      raiseRange.allowed &&
      (effectiveStrength > 0.56 || roll < (this.style === 'aggressive' ? 0.35 : 0.16))
    ) {
      const amt =
        effectiveStrength > 0.75
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
            `上点强度，向主池注入 +${amt} 算力筹码。跟还是退？`,
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
