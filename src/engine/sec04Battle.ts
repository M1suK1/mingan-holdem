import {
  createDeck,
  createInitialState,
  getBetDiff,
  startNextHand,
} from './gameEngine.ts';
import type { StoryVnLine } from './storyVnTypes.ts';
import type {
  Card,
  ContractExpression,
  GameAction,
  GameConfig,
  GameState,
  HandCard,
  Rank,
  Suit,
} from './types.ts';

export const SEC04_MAX_BERSERK_FOLDS = 3;
export const SEC04_LOW_HP_BERSERK_THRESHOLD = 250;

export interface Sec04RoundSpec {
  stage: 1 | 2 | 3 | 4;
  label: string;
  trappedBoardIndices: number[];
  isBerserk: boolean;
  /** Initial 10 cards in fixed deal order: 3 human + 3 ai + 4 board */
  fixedSpecs: ReadonlyArray<{ rank: Rank; suit: Suit; copy: 0 | 1 }>;
}

/**
 * 严格对应 docs/sec04-battle-script.md 的 SEC-04 四轮剧本牌型编排：
 * - Round 1: 初盘试探（3/4 暗符，Q粉/10粉/4黑 vs K黑/K粉/7黑）
 * - Round 2: 刀锋压制（3/4 暗符，粉同花诱饵 vs 两对 A8 > 同花）
 * - Round 3: 锚点崩解（3/4 暗符，对10 vs 对Q，升级牌全埋火符逼出第 3 次碎裂）
 * - Round 4: 暴走终局（4/4 全火符，黑曜同花顺 KQJT9 vs ECHO-0 绝命覆写「四条 A」）
 */
export const SEC04_ROUND_SPECS: Record<1 | 2 | 3 | 4, Sec04RoundSpec> = {
  1: {
    stage: 1,
    label: '初盘试探 · 火符封路',
    trappedBoardIndices: [0, 1, 3],
    isBerserk: false,
    fixedSpecs: [
      { rank: 12, suit: 'P', copy: 0 }, // Human 0: Q粉0
      { rank: 10, suit: 'P', copy: 0 }, // Human 1: 10粉0
      { rank: 4, suit: 'B', copy: 0 }, // Human 2: 4黑0
      { rank: 13, suit: 'B', copy: 0 }, // AI 0: K黑0
      { rank: 13, suit: 'P', copy: 0 }, // AI 1: K粉0
      { rank: 7, suit: 'B', copy: 0 }, // AI 2: 7黑0
      { rank: 11, suit: 'P', copy: 0 }, // Board 0 [TRAP]: J粉0
      { rank: 5, suit: 'B', copy: 0 }, // Board 1 [TRAP]: 5黑0
      { rank: 12, suit: 'B', copy: 0 }, // Board 2 [SAFE]: Q黑0
      { rank: 2, suit: 'P', copy: 0 }, // Board 3 [TRAP]: 2粉0
    ],
  },
  2: {
    stage: 2,
    label: '刀锋压制 · 两对破同花',
    trappedBoardIndices: [0, 2, 3],
    isBerserk: false,
    fixedSpecs: [
      { rank: 11, suit: 'P', copy: 0 }, // Human 0: J粉0
      { rank: 9, suit: 'P', copy: 0 }, // Human 1: 9粉0
      { rank: 6, suit: 'P', copy: 0 }, // Human 2: 6粉0
      { rank: 14, suit: 'B', copy: 0 }, // AI 0: A黑0
      { rank: 8, suit: 'P', copy: 1 }, // AI 1: 8粉1
      { rank: 8, suit: 'B', copy: 0 }, // AI 2: 8黑0
      { rank: 14, suit: 'P', copy: 0 }, // Board 0 [TRAP]: A粉0
      { rank: 5, suit: 'P', copy: 0 }, // Board 1 [SAFE]: 5粉0
      { rank: 3, suit: 'P', copy: 0 }, // Board 2 [TRAP]: 3粉0
      { rank: 2, suit: 'B', copy: 0 }, // Board 3 [TRAP]: 2黑0
    ],
  },
  3: {
    stage: 3,
    label: '锚点崩解 · 临界过载',
    trappedBoardIndices: [0, 1, 2],
    isBerserk: false,
    fixedSpecs: [
      { rank: 10, suit: 'B', copy: 0 }, // Human 0: 10黑0
      { rank: 10, suit: 'P', copy: 0 }, // Human 1: 10粉0
      { rank: 6, suit: 'B', copy: 0 }, // Human 2: 6黑0
      { rank: 12, suit: 'B', copy: 0 }, // AI 0: Q黑0
      { rank: 12, suit: 'P', copy: 0 }, // AI 1: Q粉0
      { rank: 9, suit: 'P', copy: 0 }, // AI 2: 9粉0
      { rank: 12, suit: 'B', copy: 1 }, // Board 0 [TRAP]: Q黑1
      { rank: 9, suit: 'B', copy: 0 }, // Board 1 [TRAP]: 9黑0
      { rank: 10, suit: 'B', copy: 1 }, // Board 2 [TRAP]: 10黑1
      { rank: 3, suit: 'P', copy: 0 }, // Board 3 [SAFE]: 3粉0
    ],
  },
  4: {
    stage: 4,
    label: '暴走死斗 · 四条A破门',
    trappedBoardIndices: [0, 1, 2, 3],
    isBerserk: true,
    fixedSpecs: [
      { rank: 4, suit: 'P', copy: 0 }, // Human 0: 4粉0
      { rank: 6, suit: 'P', copy: 0 }, // Human 1: 6粉0
      { rank: 3, suit: 'B', copy: 0 }, // Human 2: 3黑0
      { rank: 13, suit: 'B', copy: 0 }, // AI 0: K黑0
      { rank: 12, suit: 'B', copy: 0 }, // AI 1: Q黑0
      { rank: 9, suit: 'B', copy: 0 }, // AI 2: 9黑0
      { rank: 11, suit: 'B', copy: 0 }, // Board 0 [TRAP]: J黑0
      { rank: 10, suit: 'B', copy: 0 }, // Board 1 [TRAP]: 10黑0
      { rank: 14, suit: 'P', copy: 1 }, // Board 2 [TRAP]: A粉1
      { rank: 8, suit: 'B', copy: 0 }, // Board 3 [TRAP]: 8黑0
    ],
  },
};

function pickSpecCard(deck: Card[], rank: Rank, suit: Suit, copy: 0 | 1): Card {
  const found = deck.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy);
  if (!found) {
    throw new Error(`Missing SEC-04 card ${rank}${suit}-${copy}`);
  }
  return found;
}

export function buildSec04DeckForStage(stage: 1 | 2 | 3 | 4): Card[] {
  const spec = SEC04_ROUND_SPECS[stage];
  const full = createDeck();
  const fixedFront = spec.fixedSpecs.map((s) => pickSpecCard(full, s.rank, s.suit, s.copy));
  const used = new Set(fixedFront.map((c) => c.id));
  const rest = full.filter((c) => !used.has(c.id));
  return [...fixedFront, ...rest];
}

/**
 * 暴走开局筹码校准（严格算力守恒）：确保绯凪·千夜拥有高于玩家当前算力的储备，
 * 以便压出大于玩家剩余算力的暴走重注，并在输掉全下底池后仍保留正数残余算力。
 */
export function ensureBossAdvantageForBerserk(
  humanChips: number,
  aiChips: number
): { human: number; ai: number; drained: number } {
  const minMargin = 220;
  const total = humanChips + aiChips;
  if (aiChips >= humanChips + minMargin) {
    return { human: humanChips, ai: aiChips, drained: 0 };
  }
  const maxHuman = Math.max(120, Math.floor((total - minMargin) / 2));
  const nextHuman = Math.min(humanChips, maxHuman);
  const drained = Math.max(0, humanChips - nextHuman);
  const nextAi = total - nextHuman;
  return { human: nextHuman, ai: nextAi, drained };
}

export interface CreateSec04StateOptions {
  stage?: 1 | 2 | 3 | 4;
  config?: Partial<GameConfig>;
  chips?: { human: number; ai: number };
  handNumber?: number;
  tieStarter?: 'human' | 'ai';
  sealedSkills?: { human: GameState['players']['human']['sealedSkills']; ai: GameState['players']['ai']['sealedSkills'] };
  playerCheatSkills?: string[];
  playerAcquiredSkills?: string[];
  confirmedTrapIndices?: number[];
  pastHands?: GameState['pastHands'];
  sec04FoldCount?: number;
}

/**
 * 根据阶段（1~4）创建 DETERMINISTIC（确定性）的 SEC-04 剧本小局初始态。
 */
export function createSec04ScriptedHandState(opts: CreateSec04StateOptions = {}): GameState {
  const stage = opts.stage ?? 1;
  const spec = SEC04_ROUND_SPECS[stage];
  const deckOverride = buildSec04DeckForStage(stage);
  const rawChips = opts.chips ?? { human: 1000, ai: 1000 };
  const chips = spec.isBerserk
    ? ensureBossAdvantageForBerserk(rawChips.human, rawChips.ai)
    : { human: rawChips.human, ai: rawChips.ai, drained: 0 };

  const state = createInitialState({
    config: { aiDifficulty: 'master', ...opts.config },
    handNumber: opts.handNumber ?? stage,
    tieStarter: opts.tieStarter ?? (stage % 2 === 1 ? 'human' : 'ai'),
    opponentName: '绯凪·千夜',
    chips: { human: chips.human, ai: chips.ai },
    sealedSkills: opts.sealedSkills,
    playerCheatSkills: opts.playerCheatSkills,
    playerAcquiredSkills: opts.playerAcquiredSkills,
    opponentSignatureSkill: 'gate-minefield',
    aiSpecialCheatSkill: 'mikiri-counter',
    gateTrapMode: 'story',
    trappedBoardIndices: [...spec.trappedBoardIndices],
    confirmedTrapIndices: spec.isBerserk ? [0, 1, 2, 3] : opts.confirmedTrapIndices,
    pastHands: opts.pastHands,
    deckOverride,
    firstActorOverride: spec.isBerserk ? 'ai' : undefined,
    sec04RoundStage: stage,
    sec04Berserk: spec.isBerserk,
    sec04FoldCount: spec.isBerserk ? (opts.sec04FoldCount ?? 0) : undefined,
  });

  if (spec.isBerserk && chips.drained > 0) {
    state.actionHistory.push({
      id: `sec04-drain-${Date.now()}`,
      handNumber: state.handNumber,
      actor: 'system',
      phase: 'early',
      summary: `零号闸门苍红业火过载：压迫转移 ${chips.drained} 算力至 KIRI-04 封锁防线`,
      timestamp: Date.now(),
    });
  }

  return state;
}

/**
 * 计算第 4 轮暴走阶段绯凪·千夜的超限加注额（严格大于玩家当前剩余算力）。
 */
export function pickSec04BerserkRaiseAmount(state: GameState): number {
  const ai = state.players.ai;
  const human = state.players.human;
  const diff = getBetDiff(state, 'ai');
  const aiRemainingAfterCall = Math.max(0, ai.chips - diff);
  const desiredOver = human.chips + Math.max(60, Math.min(180, Math.floor((aiRemainingAfterCall - human.chips) / 2)));
  return Math.max(
    Math.min(state.config.minRaise, aiRemainingAfterCall),
    Math.min(aiRemainingAfterCall, desiredOver)
  );
}

/**
 * 推进 SEC-04 至下一手：
 * - 若已处于暴走阶段（第 4 轮）玩家弃牌重开，则递增 sec04FoldCount 并维持 4/4 火符暴走死斗
 * - 若回溯按钮已碎裂（uses >= 3）或千夜算力跌破二阶段阈值，强制切入第 4 轮暴走终局
 * - 否则依次推进 Round 1 -> Round 2 -> Round 3
 */
export function advanceSec04NextHandState(
  prev: GameState,
  sec04RewindUses: number
): GameState {
  const rolled = startNextHand(prev);
  const currentStage = prev.sec04RoundStage ?? 1;
  const enterBerserk =
    Boolean(prev.sec04Berserk) ||
    sec04RewindUses >= 3 ||
    prev.players.ai.chips <= SEC04_LOW_HP_BERSERK_THRESHOLD;

  const nextStage: 1 | 2 | 3 | 4 = enterBerserk
    ? 4
    : ((Math.min(3, currentStage + 1) as 1 | 2 | 3));

  const nextFoldCount = prev.sec04Berserk
    ? Math.min(SEC04_MAX_BERSERK_FOLDS, (prev.sec04FoldCount ?? 0) + (prev.result?.reason === 'fold' ? 1 : 0))
    : 0;

  return createSec04ScriptedHandState({
    stage: nextStage,
    config: prev.config,
    handNumber: rolled.handNumber,
    tieStarter: rolled.tieStarter,
    chips: { human: prev.players.human.chips, ai: prev.players.ai.chips },
    sealedSkills: {
      human: [...prev.players.human.sealedSkills],
      ai: [...prev.players.ai.sealedSkills],
    },
    playerCheatSkills: prev.playerCheatSkills,
    playerAcquiredSkills: prev.playerAcquiredSkills,
    pastHands: rolled.pastHands,
    sec04FoldCount: nextFoldCount,
  });
}

/**
 * 当第 3 次回溯导致按钮碎裂、或千夜提前低血锁血触发二阶段时，立即转入第 4 轮暴走死斗（严格退还当前未结算底池保证算力守恒）。
 */
export function createSec04BerserkTransitionState(prev: GameState): GameState {
  const unsettledPot = prev.phase === 'showdown' ? 0 : prev.pot + prev.hackEscrowPot;
  const refundHuman =
    unsettledPot > 0 ? Math.min(unsettledPot, prev.players.human.totalCommitted) : 0;
  const refundAi = Math.max(0, unsettledPot - refundHuman);

  return createSec04ScriptedHandState({
    stage: 4,
    config: prev.config,
    handNumber: prev.handNumber + 1,
    tieStarter: prev.tieStarter === 'human' ? 'ai' : 'human',
    chips: {
      human: prev.players.human.chips + refundHuman,
      ai: prev.players.ai.chips + refundAi,
    },
    sealedSkills: {
      human: [...prev.players.human.sealedSkills],
      ai: [...prev.players.ai.sealedSkills],
    },
    playerCheatSkills: prev.playerCheatSkills,
    playerAcquiredSkills: prev.playerAcquiredSkills,
    pastHands: prev.pastHands,
    sec04FoldCount: prev.sec04FoldCount ?? 0,
  });
}

export function getSec04ActionScriptLine(params: {
  state: GameState;
  action: GameAction;
  foldCount?: number;
}): { expression: ContractExpression; text: string } | null {
  const { state, action } = params;
  if (state.sec04Berserk && action.type === 'raise') {
    const fc = params.foldCount ?? state.sec04FoldCount ?? 0;
    if (fc >= SEC04_MAX_BERSERK_FOLDS) {
      return {
        expression: 'calm',
        text: '三次退让已经到头了哦，叛逃者。后方网关已经闭锁，这一次连「弃牌」的退路都替你斩断了——把算力全部押上来接我这一刀吧。',
      };
    }
    return {
      expression: 'calm',
      text: '四张火符已把整片公共区彻底烧死。把你剩余的全部算力都推上来吧，叛逃者——这一刀重注的额度，可是超出了你剩下的全部储备哦。',
    };
  }
  const stage = state.sec04RoundStage;
  if (stage === 2 && action.type === 'raise') {
    return {
      expression: getBetDiff(state, 'ai') > 0 ? 'angry' : 'calm',
      text: '想凭一手粉色同花从我眼前逃脱吗，叛逃者？作为黑河反黑客安全官，我绝不会退让半寸。',
    };
  }
  return null;
}

export function buildFourAcesDisplayCopy(origCards: HandCard[]): string {
  const before = origCards
    .map((h) => `${h.originalCard?.suit === 'P' ? '粉' : '黑'}${h.originalCard?.rank ?? h.card.rank}`)
    .join(' / ');
  return `${before} => A黑 / A粉 / A黑（联动公共区 A粉 构成四条 A）`;
}

/**
 * SEC-04 进入暴走阶段后的插叙视觉小说剧情（6 句 · 说明 4/4 火符全封锁、无法触碰公共牌区与玩家绝望处境）
 */
export const SEC04_BERSERK_VN_SCRIPT: StoryVnLine[] = [
  {
    index: 0,
    lineNo: '01',
    chapterLabel: '暴走幕间 1/3 · 四符全焚',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    leftSprite: {
      character: 'echo0',
      expression: 'surprise',
      visibility: 'active',
      label: '{codename} // SHELL://ECHO-0',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'dimmed',
      label: '绯凪·千夜 // 暴走态',
    },
    stageEffect: 'blade-slash',
    hudAlerts: ['[BERSERK STAGE // 公共牌区 4/4 灼心·火符全覆盖]', '[REWIND ANCHOR // 0% 碎裂]'],
    soundCue: 'blade-slash',
    tone: 'alarm',
    text: '伴随时间回溯通道彻底碎裂成飞灰，绯凪·千夜周身蓦地燃起刺目苍红业火——桌面四枚公共加密节点在同一瞬间全部亮起致命的赤红火符封锁！',
  },
  {
    index: 1,
    lineNo: '02',
    chapterLabel: '暴走幕间 1/3 · 公共区封死',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    leftSprite: {
      character: 'echo0',
      expression: 'sad',
      visibility: 'active',
      label: '{codename} // SHELL://ECHO-0',
      effect: 'tremble',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'dimmed',
      label: '绯凪·千夜 // 暴走态',
    },
    stageEffect: 'alarm-intense',
    hudAlerts: ['[LOCKED] 安全格 = 0 // 翻牌或换牌将立即灼毁归零'],
    tone: 'alarm',
    text: '四张公共暗牌无一幸免，全都变成了只要一碰就会引爆归零的焦土陷阱。{codename} 既不敢点开任何一张暗牌，也再也不能靠换牌改写牌序，整块公共牌区已经被完全锁死。',
  },
  {
    index: 2,
    lineNo: '03',
    chapterLabel: '暴走幕间 2/3 · 绝望处境',
    speakerKind: 'player',
    speakerName: '玩家（内心独白）',
    isThought: true,
    leftSprite: {
      character: 'echo0',
      expression: 'sad',
      visibility: 'active',
      label: '{codename} // SHELL://ECHO-0',
      effect: 'tremble',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'dimmed',
      label: '绯凪·千夜 // 暴走态',
    },
    stageEffect: 'reverse-flux',
    tone: 'glitch',
    text: '（四个公共牌位全被火符封死了……翻牌会死、换牌也会死，连左下方最后那枚能倒流时间的按钮都彻底碎得干干净净……而且这一手抓在手里的全都是派不上用场的散牌……）',
  },
  {
    index: 3,
    lineNo: '04',
    chapterLabel: '暴走幕间 2/3 · 无路可退',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    leftSprite: {
      character: 'echo0',
      expression: 'sad',
      visibility: 'active',
      label: '{codename} // SHELL://ECHO-0',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'dimmed',
      label: '绯凪·千夜 // 暴走态',
    },
    stageEffect: 'none',
    tone: 'alarm',
    text: '「……公共牌区连碰都碰不得，时间锚点又毁了……这种把所有生路焊死到一根缝都不留的局面，根本不可能有赢法啊……」',
  },
  {
    index: 4,
    lineNo: '05',
    chapterLabel: '暴走幕间 3/3 · 闸门压境',
    speakerKind: 'opponent',
    speakerName: '绯凪·千夜',
    leftSprite: {
      character: 'echo0',
      expression: 'sad',
      visibility: 'dimmed',
      label: '{codename} // SHELL://ECHO-0',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'active',
      label: '绯凪·千夜 // 暴走态',
      effect: 'lean-in',
    },
    stageEffect: 'blade-slash',
    tone: 'alarm',
    text: '「看清楚了吗，叛逃者。没有安全格子，也没有退路……现在这整张牌桌上，唯一还准许你触碰的只剩手头那点算力——来吧，在四道火符里接住我压垮一切的最后一刀。」',
  },
  {
    index: 5,
    lineNo: '06',
    chapterLabel: '暴走幕间 3/3 · 绝境开战',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    leftSprite: {
      character: 'echo0',
      expression: 'sad',
      visibility: 'active',
      label: '{codename} // SHELL://ECHO-0',
    },
    rightSprite: {
      character: 'sec04',
      expression: 'calm',
      visibility: 'active',
      label: '绯凪·千夜 // 暴走态',
    },
    stageEffect: 'alarm-intense',
    hudAlerts: ['[BERSERK PRESS] KIRI-04 即将发起超限重注 · 仅余跟注或最多三次弃牌'],
    soundCue: 'alarm-siren',
    tone: 'alarm',
    nextButtonOverride: '回到牌桌 · 直面暴走重注',
    text: '彻底窒息的绝望压力笼罩住 {codename} 的视网膜。话音落地的一刻，狂燃业火中的绯凪·千夜已抬起刀锋，向仅存的算力发起了压垮生路的终局总攻。',
  },
];
