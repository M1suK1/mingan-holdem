import { createDeck, createInitialState, getBetDiff } from './gameEngine.ts';
import type { Card, GameAction, GameState, Rank, Suit } from './types.ts';

export interface Sec00MonologueStep {
  index: number;
  tag: string;
  title: string;
  text: string;
  tip: string;
}

export const SEC00_MONOLOGUE_STEPS: Sec00MonologueStep[] = [
  {
    index: 0,
    tag: 'MONOLOGUE 1/4 // 无名野桌',
    title: '“又是混日子的一晚……”',
    text: '黑域公共暗区里随手接了桌野局。对面这个叫 [UNKNOWN_0x00] 的匿名终端，算力只有 110，信号弱得像块快报废的老主板……刚好拿它顺手温习一遍野桌规矩。',
    tip: '提示：桌上的算力就是虚拟实体的「结构防线」，先将对手清零即获胜并夺取其虚拟实体。',
  },
  {
    index: 1,
    tag: 'MONOLOGUE 2/4 // 明暗牌与换牌锁定',
    title: '“台面上 3 张明牌，中间 4 张暗牌……”',
    text: '每人手上的 3 张初始牌都是双方可见的「明牌」。中间 4 张是加密「暗牌」：点击暗牌可以免费翻开；或者付换牌门票把一张明牌换进去，换到手里的牌会变成只有自己能看的「私有暗牌」并锁定。',
    tip: '规则：私有暗牌不可再换出，也不可被黑客篡改；换牌或翻牌后结束本轮操作权。',
  },
  {
    index: 2,
    tag: 'MONOLOGUE 3/4 // 双花色与牌型阶梯',
    title: '“记住，这里只有黑与粉两种花色……”',
    text: '黑曜脉冲 26 张、绯霓电弧 26 张，总共 52 张。正因为同花特别好凑，这里的牌型大小重排为「四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌」——千万别用同花硬碰两对。',
    tip: '机制：对手加注时，点「跟注」只补齐差额、不会结束你的回合，你仍可继续翻牌或反加。',
  },
  {
    index: 3,
    tag: 'MONOLOGUE 4/4 // 准备开局',
    title: '“行了，对面那点算力也就够练手。”',
    text: '先看我这手牌：Q粉、9粉、2黑，正好把那张没用的 2黑 换进公共暗区试试水。要是它真敢在暗地里搞小动作，我再教它怎么收场。',
    tip: '实操将在同一手连贯牌局内完成全部教学，直到当场击穿对方 110 算力。',
  },
];

export type Sec00StepId =
  | 'swap-board0'
  | 'call-raise20'
  | 'flip-board1'
  | 'flush-raise40'
  | 'hack-plus-one'
  | 'scan-catch'
  | 'completed';

export interface Sec00Capabilities {
  allowHack: boolean;
  allowScan: boolean;
  allowRaise: boolean;
}

export interface Sec00Guidance {
  stepId: Sec00StepId;
  badge: string;
  title: string;
  instruction: string;
  subNote: string;
  focusIds: string[];
  completed: boolean;
}

function pickCard(deck: Card[], rank: Rank, suit: Suit, copy: 0 | 1 = 0): Card {
  const found = deck.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy);
  if (!found) {
    throw new Error(`Missing card ${rank}${suit}-${copy}`);
  }
  return found;
}

function buildDeterministicDeck(fixedFront: Card[]): Card[] {
  const full = createDeck();
  const used = new Set(fixedFront.map((c) => c.id));
  const rest = full.filter((c) => !used.has(c.id));
  return [...fixedFront, ...rest];
}

export function createSec00TutorialState(): GameState {
  const full = createDeck();
  // Human: Q粉, 9粉, 2黑 (High Card Q) -> weaker than AI One Pair 10s -> Human acts first
  // AI: 10黑, 10粉, 4黑 (One Pair 10s)
  // Board: 5粉, 7粉, A粉, J黑
  const fixedFront = [
    pickCard(full, 12, 'P', 0),
    pickCard(full, 9, 'P', 0),
    pickCard(full, 2, 'B', 0),
    pickCard(full, 10, 'B', 0),
    pickCard(full, 10, 'P', 0),
    pickCard(full, 4, 'B', 0),
    pickCard(full, 5, 'P', 0),
    pickCard(full, 7, 'P', 0),
    pickCard(full, 14, 'P', 0),
    pickCard(full, 11, 'B', 0),
  ];

  return createInitialState({
    chips: { human: 1000, ai: 110 },
    opponentName: '匿名终端 [UNKNOWN_0x00]',
    tieStarter: 'human',
    deckOverride: buildDeterministicDeck(fixedFront),
  });
}

export function getSec00StepId(state: GameState): Sec00StepId {
  if (state.phase === 'showdown') {
    return 'completed';
  }
  if (state.players.human.swapCount === 0 && !state.board[0]?.isOpen) {
    return 'swap-board0';
  }
  const diff = getBetDiff(state, 'human');
  if (diff > 0) {
    return 'call-raise20';
  }
  if (!state.board[1]?.isOpen) {
    return 'flip-board1';
  }
  const aiTampered = Boolean(state.players.ai.hand[0]?.tamperedBy?.includes('plus-one'));
  if (state.board[2]?.isOpen && !aiTampered) {
    return 'flush-raise40';
  }
  if (aiTampered && !state.usedHackThisTurn) {
    return 'hack-plus-one';
  }
  if (aiTampered && state.usedHackThisTurn) {
    return 'scan-catch';
  }
  return 'flush-raise40';
}

export function getSec00Capabilities(state: GameState): Sec00Capabilities {
  const step = getSec00StepId(state);
  return {
    allowRaise: step === 'flush-raise40',
    allowHack: step === 'hack-plus-one',
    allowScan: step === 'scan-catch',
  };
}

export function isSec00ActionAllowed(state: GameState, action: GameAction): boolean {
  if (state.currentTurn !== 'human' || state.phase === 'showdown') return false;
  const step = getSec00StepId(state);
  switch (step) {
    case 'swap-board0':
      return action.type === 'swap' && action.handIndex === 2 && action.boardIndex === 0;
    case 'call-raise20':
      return action.type === 'call';
    case 'flip-board1':
      return action.type === 'flip' && action.boardIndex === 1;
    case 'flush-raise40':
      return action.type === 'raise' && action.amount === 40 && !action.isHalfStack;
    case 'hack-plus-one':
      return action.type === 'hack' && action.handIndex === 0 && action.skill === 'plus-one';
    case 'scan-catch':
      return action.type === 'scan' && action.targetKind === 'hand' && action.targetIndex === 0;
    default:
      return false;
  }
}

export function pickSec00AiAction(state: GameState): GameAction | null {
  if (state.currentTurn !== 'ai' || state.phase === 'showdown') return null;

  // Turn 1: after human swaps board[0], AI raises +20
  if (state.board[0]?.isOpen && !state.board[1]?.isOpen && state.raisesInSubPhase === 0) {
    return { type: 'raise', amount: 20 };
  }

  // Turn 2: after human calls 20 and flips board[1], AI flips board[2] (reveals A粉 -> Flush!)
  if (state.board[1]?.isOpen && !state.board[2]?.isOpen) {
    return { type: 'flip', boardIndex: 2 };
  }

  // Turn 3: human raised +40 -> AI calls 40 -> AI hacks hand[0] +1 -> AI ends turn
  const aiDiff = getBetDiff(state, 'ai');
  if (aiDiff > 0) {
    return { type: 'call' };
  }
  if (
    state.board[2]?.isOpen &&
    state.justCalledThisTurn &&
    !state.usedHackThisTurn &&
    !state.players.ai.hand[0]?.tamperedBy?.length
  ) {
    return { type: 'hack', handIndex: 0, skill: 'plus-one' };
  }
  if (state.justCalledThisTurn && state.usedHackThisTurn) {
    return { type: 'end-turn' };
  }
  return null;
}

export function getSec00Guidance(
  state: GameState,
  ctx: {
    selectedHandIndex: number | null;
    scanMode: boolean;
    showRaiseTiers: boolean;
  }
): Sec00Guidance {
  const step = getSec00StepId(state);

  if (step === 'completed') {
    return {
      stepId: 'completed',
      badge: '教学通关',
      title: 'SEC-00 匿名终端已击穿',
      instruction: '已在一轮内完成全部基础与黑客实操并抓获篡改，按协议即将提取战利品并撤离！',
      subNote: '提示：对方刚才漏出的异常权限正来自你即将接管的虚拟实体 SHELL://ECHO-0。',
      focusIds: ['action-btn-escape-retreat'],
      completed: true,
    };
  }

  if (step === 'swap-board0') {
    return {
      stepId: 'swap-board0',
      badge: '实操 1/5 · 明暗换牌',
      title: '换走废牌 2黑，藏入私有暗牌',
      instruction:
        ctx.selectedHandIndex === 2
          ? '已选中 2黑！现在点击中央第 1 张暗牌「节点01」（或直接拖过去）完成换牌。'
          : '先点击（或拖拽）己方第 3 张手牌「2黑」，与中央第 1 张暗牌「节点01」互换。',
      subNote: '换入的手牌会变成只有你能看到的「私有暗牌」并锁定不可再换；换牌会消耗门票并轮到对手。',
      focusIds: ctx.selectedHandIndex === 2 ? ['board-node-card-0'] : ['human-hand-card-2', 'board-node-card-0'],
      completed: false,
    };
  }

  if (step === 'call-raise20') {
    return {
      stepId: 'call-raise20',
      badge: '实操 2/5 · 跟注不耗回合',
      title: '对手加注 +20！先点跟注补齐差额',
      instruction: '点击右侧「跟注 20」补齐差额——注意跟注后回合依然属于你，不会直接换人！',
      subNote: '必须先把跟注差额补齐为 0，才能继续翻牌、换牌、加注或发动黑客技能。',
      focusIds: ['lc-action-btn-call'],
      completed: false,
    };
  }

  if (step === 'flip-board1') {
    return {
      stepId: 'flip-board1',
      badge: '实操 3/5 · 免费翻牌',
      title: '跟注未结束回合！现在免费翻开 1 张暗牌',
      instruction: '直接点击中央第 2 张暗牌「节点02」免费翻开，并移交回合给对手。',
      subNote: '翻开公共牌 0 算力消耗，且会将当前段内的加注次数上限重置。',
      focusIds: ['board-node-card-1'],
      completed: false,
    };
  }

  if (step === 'flush-raise40') {
    return {
      stepId: 'flush-raise40',
      badge: '实操 4/5 · 同花成牌与加注施压',
      title: '5 张绯霓同花已成！了解阶梯后加注 +40',
      instruction: ctx.showRaiseTiers
        ? '点击第 3 档「+40」向对手施压！（记住：双花色下 两对 > 同花 > 一对）'
        : '你已凑齐 5 张绯霓同花！点击右侧「加注」打开三档定额，准备选择 +40 施压。',
      subNote: '黑/粉双花色各 26 张让同花更好凑，因此规则将两对排在同花之上；当前 5 张同花已稳压对面一对 10。',
      focusIds: ctx.showRaiseTiers ? ['raise-tier-btn-2'] : ['lc-action-btn-open-raise'],
      completed: false,
    };
  }

  if (step === 'hack-plus-one') {
    return {
      stepId: 'hack-plus-one',
      badge: '实操 5/5 · 黑客篡改（不占回合）',
      title: '异常权限溢出！体验一次 +1 改牌',
      instruction:
        ctx.selectedHandIndex === 0
          ? '已选中 Q粉！点击下方「+1」预支 40 算力将其改写为 K粉（不会结束你的回合）。'
          : '对面刚刚似乎往终端注入了异常改牌信号，你的壳层也短暂解锁了篡改权限！先选中「Q粉」，再点「+1」。',
      subNote: '黑客改牌对敌人隐藏且预支算力也会被掩盖，每回合限用 1 次，改完后你还可以立刻继续操作！',
      focusIds: ctx.selectedHandIndex === 0 ? ['hack-btn-plus-one'] : ['human-hand-card-0', 'hack-btn-plus-one'],
      completed: false,
    };
  }

  return {
    stepId: 'scan-catch',
    badge: '终结教学 · 扫描抓包与一击清零',
    title: '抓住对面偷改底牌的破绽！',
    instruction: ctx.scanMode
      ? '扫描激光已开启！点击对手第 1 张手牌（原 10黑）抓获她的 +1 篡改，一击清零过关！'
      : '对面看似还有 40 算力，其实刚偷改了底牌！点击下方「扫描」按钮开启激光抓包。',
    subNote: '扫描抓获篡改会立刻合并所有预支算力直接判胜并永久封印该技能，正好将匿名终端击穿归零！',
    focusIds: ctx.scanMode ? ['opponent-hand-card-0'] : ['hack-btn-scan-toggle'],
    completed: false,
  };
}
