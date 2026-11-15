/**
 * LLM 合法动作空间与观察块。
 *
 * 设计原则：
 * 1. 动作清单绝不靠提示词「猜」合法性，全部由引擎谓词 `isActionLegal` 过滤后产出。
 * 2. 每条动作都附带一份可直接照抄的 JSON 样例，降低模型输出非法结构的概率。
 * 3. 观察块只暴露当前行动方有权感知的信息：对手私有牌面、预支托管数额一律不进入提示词。
 */
import type { GameAction, GameState, HackSkillId, PlayerId } from './types.ts';
import {
  computeThreeRaisePresets,
  formatCardShort,
  getBetDiff,
  getHackSkillCost,
  getLegalRaiseRange,
  getNextSwapFee,
  isActionLegal,
  otherPlayer,
} from './gameEngine.ts';

export interface LlmActionOption {
  /** 稳定标识，用于审计日志与非法动作回报 */
  key: string;
  action: GameAction;
  /** 中文说明 */
  label: string;
  /** 可直接照抄的 JSON 样例 */
  example: string;
}

export interface LlmActionSpace {
  actorId: PlayerId;
  /** 是否处于「必须先补齐差额」状态 */
  mustCallFirst: boolean;
  options: LlmActionOption[];
  /** 面向模型的附加约束说明 */
  notes: string[];
}

export const HACK_SKILL_LABELS: Record<HackSkillId, string> = {
  'plus-one': '点数+1',
  'minus-one': '点数-1',
  'flip-suit': '反转花色',
};

export function actionKey(action: GameAction): string {
  switch (action.type) {
    case 'swap':
      return `swap:${action.handIndex}:${action.boardIndex}`;
    case 'flip':
      return `flip:${action.boardIndex}`;
    case 'raise':
      return `raise:${action.amount}${action.isHalfStack ? ':half' : ''}`;
    case 'hack':
      return `hack:${action.handIndex}:${action.skill}`;
    case 'scan':
      return `scan:${action.targetKind}:${action.targetIndex}`;
    default:
      return action.type;
  }
}

export function describeAction(action: GameAction): string {
  switch (action.type) {
    case 'swap':
      return `换牌 手牌#${action.handIndex + 1} 与 公共槽#${action.boardIndex + 1} 互换`;
    case 'flip':
      return `翻开公共槽#${action.boardIndex + 1}`;
    case 'raise':
      return `加注 ${action.amount}${action.isHalfStack ? '（半池）' : ''}`;
    case 'check':
      return '过牌';
    case 'call':
      return '跟注';
    case 'fold':
      return '弃牌';
    case 'end-turn':
      return '结束本回合';
    case 'hack':
      return `黑客技能 ${HACK_SKILL_LABELS[action.skill]} → 手牌#${action.handIndex + 1}`;
    case 'scan':
      return `扫描 ${action.targetKind === 'hand' ? `对手手牌#${action.targetIndex + 1}` : `公共槽#${action.targetIndex + 1}`}`;
    default:
      return '未知动作';
  }
}

/** 依据引擎谓词枚举当前行动方的完整合法动作空间 */
export function enumerateLlmActionSpace(
  state: GameState,
  opts: { useHackerSkills?: boolean } = {}
): LlmActionSpace {
  const useHackerSkills = opts.useHackerSkills ?? true;
  const actorId = state.currentTurn;
  const actor = state.players[actorId];
  const oppId = otherPlayer(actorId);
  const opp = state.players[oppId];
  const diff = getBetDiff(state, actorId);
  const options: LlmActionOption[] = [];
  const notes: string[] = [];

  const push = (action: GameAction, label: string) => {
    if (!isActionLegal(state, action)) return;
    options.push({ key: actionKey(action), action, label, example: JSON.stringify(action) });
  };

  const pushRaisePresets = (afterCallDiff: number) => {
    const range = getLegalRaiseRange(state, actorId, afterCallDiff);
    if (!range.allowed) {
      if (state.raisesInSubPhase > 0) {
        notes.push('本段加注次数已达上限，本轮不可再加注。');
      }
      return;
    }
    for (const amount of computeThreeRaisePresets(range.min, range.max)) {
      push({ type: 'raise', amount }, `加注 ${amount}（区间 ${range.min}~${range.max}）`);
    }
  };

  if (diff > 0) {
    const callAmount = Math.min(diff, actor.chips);
    push({ type: 'call' }, `跟注补齐差额 ${callAmount}`);
    push({ type: 'fold' }, '弃牌退出本手');
    pushRaisePresets(callAmount);
    notes.push(
      '你目前落后差额，必须先 call 补齐才能继续换牌/翻牌；扫描与黑客技能同样要在差额补齐之后才可使用。'
    );
    return { actorId, mustCallFirst: true, options, notes };
  }

  if (state.phase === 'river') {
    push({ type: 'check' }, '过牌');
  }
  if (state.justCalledThisTurn) {
    push({ type: 'end-turn' }, '结束本回合');
  }

  const hiddenSlots = state.board.filter((b) => !b.isOpen).map((b) => b.index);
  for (const boardIndex of hiddenSlots) {
    push({ type: 'flip', boardIndex }, `翻开公共槽#${boardIndex + 1}`);
  }

  const swapFee = getNextSwapFee(state, actorId);
  const swappableHand = actor.hand
    .map((h, i) => (h.visibility === 'open' && !h.lockedFromSwap ? i : -1))
    .filter((i) => i >= 0);
  if (hiddenSlots.length > 0 && swappableHand.length > 0) {
    if (actor.chips >= swapFee) {
      for (const handIndex of swappableHand) {
        for (const boardIndex of hiddenSlots) {
          push(
            { type: 'swap', handIndex, boardIndex },
            `换牌 手牌#${handIndex + 1} 与 暗牌槽#${boardIndex + 1} 互换（手续费 ${swapFee}）`
          );
        }
      }
    } else {
      notes.push(`算力不足以支付换牌手续费 ${swapFee}。`);
    }
  }

  pushRaisePresets(0);

  if (!useHackerSkills) {
    notes.push('本次配置禁用了你使用黑客技能与扫描能力。');
    return { actorId, mustCallFirst: false, options, notes };
  }

  // ---- 黑客技能：以自身明牌为目标，改动仅己方可见 ----
  if (state.usedHackThisTurn) {
    notes.push('本回合黑客技能已经用过，每回合只能执行一次。');
  } else {
    const openTargets = actor.hand
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.visibility === 'open');
    if (openTargets.length === 0) {
      notes.push('你当前没有公开明牌，黑客技能只能作用于自己的明牌。');
    }
    for (const { h, i } of openTargets) {
      const skills: HackSkillId[] = [];
      if (h.card.rank < 14) skills.push('plus-one');
      if (h.card.rank > 2) skills.push('minus-one');
      skills.push('flip-suit');
      for (const skill of skills) {
        if (actor.sealedSkills.includes(skill)) continue;
        const cost = getHackSkillCost(state, skill);
        if (actor.chips < cost) continue;
        push(
          { type: 'hack', handIndex: i, skill },
          `黑客 ${HACK_SKILL_LABELS[skill]} → 手牌#${i + 1}（预支 ${cost} 算力，不占行动次数，对手不可见）`
        );
      }
    }
    const sealedActive = actor.sealedSkills.filter((s) => Boolean(HACK_SKILL_LABELS[s]));
    if (sealedActive.length > 0) {
      notes.push(`以下技能已被封印：${sealedActive.map((s) => HACK_SKILL_LABELS[s]).join('、')}。`);
    }
  }

  // ---- 通用扫描：核实对手目标是否被篡改 ----
  if (state.usedScanThisTurn) {
    notes.push('本回合扫描已经用过，每回合只能执行一次。');
  } else {
    const scanCost = state.config.scanCost;
    if (actor.chips < scanCost) {
      notes.push(`算力不足以支付扫描费用 ${scanCost}。`);
    } else {
      opp.hand.forEach((h, idx) => {
        const key = `${actorId}:hand:${idx}`;
        if (state.scannedKeys.includes(key)) return;
        push(
          { type: 'scan', targetKind: 'hand', targetIndex: idx },
          `扫描对手手牌#${idx + 1}${h.visibility === 'open' ? '（公开明牌）' : '（私有暗牌，盲探）'}（预支 ${scanCost} 算力）`
        );
      });
      for (const slot of state.board) {
        if (!slot.isOpen || slot.swappedBy !== oppId) continue;
        const key = `${actorId}:board:${slot.index}`;
        if (state.scannedKeys.includes(key)) continue;
        push(
          { type: 'scan', targetKind: 'board', targetIndex: slot.index },
          `扫描对手换入的公共槽#${slot.index + 1}（预支 ${scanCost} 算力）`
        );
      }
    }
  }

  return { actorId, mustCallFirst: false, options, notes };
}

export interface LlmSkillTelemetry {
  usedHackThisTurn: boolean;
  usedScanThisTurn: boolean;
  sealedSkills: HackSkillId[];
  /** 只暴露「存在预支托管」，不暴露数额，避免泄露对手是否用技能 */
  escrowActive: boolean;
  hackTargets: Array<{ handIndex: number; card: string; rank: number }>;
  scanHandTargets: number[];
  scanBoardTargets: number[];
}

export function buildLlmSkillTelemetry(
  state: GameState,
  actorId: PlayerId = state.currentTurn
): LlmSkillTelemetry {
  const actor = state.players[actorId];
  const oppId = otherPlayer(actorId);
  const opp = state.players[oppId];
  const hackTargets = actor.hand
    .map((h, i) => ({ handIndex: i, card: formatCardShort(h.card), rank: h.card.rank, visibility: h.visibility }))
    .filter((t) => t.visibility === 'open')
    .map(({ handIndex, card, rank }) => ({ handIndex, card, rank }));

  return {
    usedHackThisTurn: state.usedHackThisTurn,
    usedScanThisTurn: state.usedScanThisTurn,
    sealedSkills: [...actor.sealedSkills],
    escrowActive: state.hackEscrowPot > 0,
    hackTargets,
    scanHandTargets: opp.hand.map((_, i) => i),
    scanBoardTargets: state.board.filter((b) => b.isOpen && b.swappedBy === oppId).map((b) => b.index),
  };
}

export function formatSkillTelemetryBlock(t: LlmSkillTelemetry): string {
  const sealText = t.sealedSkills.length
    ? t.sealedSkills.map((s) => HACK_SKILL_LABELS[s]).join('、')
    : '未被封印';
  return [
    `[技能状态] 本轮黑客已用:${t.usedHackThisTurn ? '是' : '否'} | 本轮扫描已用:${t.usedScanThisTurn ? '是' : '否'} | 技能封印:${sealText}`,
    `[可篡改自身明牌] ${t.hackTargets.length ? t.hackTargets.map((h) => `#${h.handIndex + 1}=${h.card}(点数${h.rank})`).join(' ') : '无'}`,
    `[可扫描目标] 对手手牌索引:${t.scanHandTargets.map((i) => `#${i + 1}`).join(' ') || '无'} | 对手换入公共槽:${t.scanBoardTargets.map((i) => `#${i + 1}`).join(' ') || '无'}`,
    t.escrowActive
      ? '[预支托管] 桌上存在未公开的预支托管算力（不计入公开奖池，结算时才并入）'
      : '[预支托管] 暂无预支',
  ].join('\n');
}
