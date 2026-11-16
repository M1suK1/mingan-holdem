import { LocalAiAgent } from './aiAgent.ts';
import { createInitialState, getBetDiff, isActionLegal } from './gameEngine.ts';
import {
  DEFAULT_CONFIG,
  type Card,
  type GameAction,
  type GameState,
  type Rank,
  type Suit,
} from './types.ts';

export type TutorialStageId =
  | 'swap-flip'
  | 'raise-call'
  | 'two-suit-flush'
  | 'hacker-skills'
  | 'scan-seal'
  | 'boss-duel';

export interface TutorialStageMeta {
  index: number;
  id: TutorialStageId;
  title: string;
  badge: string;
  mechanicTip: string;
}

export interface TutorialCapabilities {
  allowHack: boolean;
  allowScan: boolean;
  allowRaise: boolean;
}

export interface TutorialGuidance {
  instruction: string;
  subNote: string;
  focusIds: string[];
  stagePassed: boolean;
  retryNeeded: boolean;
}

export const TUTORIAL_STAGES: TutorialStageMeta[] = [
  {
    index: 0,
    id: 'swap-flip',
    title: '第 1 关：换牌与翻牌（无黑客技能）',
    badge: '基础操作 1/6',
    mechanicTip: '拖拽手牌或两步点选换入暗牌（换回私有暗牌）；直接点暗牌可免费翻开。',
  },
  {
    index: 1,
    id: 'raise-call',
    title: '第 2 关：加注施压与跟注不耗动作',
    badge: '筹码博弈 2/6',
    mechanicTip: '面对加注时，点「跟注」只补齐差额且不结束回合，之后还能继续翻牌或反加。',
  },
  {
    index: 2,
    id: 'two-suit-flush',
    title: '第 3 关：双花色「同花」的特殊排位',
    badge: '牌型机制 3/6',
    mechanicTip: '只有黑/粉 2 色各 26 张！两对 > 同花 > 一对，换入 5 张绯霓同花即可击败对手一对。',
  },
  {
    index: 3,
    id: 'hacker-skills',
    title: '第 4 关：解锁黑客技能（+1 / -1 / 反色）',
    badge: '底牌篡改 4/6',
    mechanicTip: '篡改己方明牌不占回合，预支算力对敌隐藏；把 9B +1 改为 10B 即可凑出黑曜同花顺！',
  },
  {
    index: 4,
    id: 'scan-seal',
    title: '第 5 关：扫描抓获与技能封印',
    badge: '反制抓包 5/6',
    mechanicTip: '怀疑对手改牌时启用「扫描」点选目标牌；抓获篡改直接收池获胜并永久封印该技能。',
  },
  {
    index: 5,
    id: 'boss-duel',
    title: '第 6 关：综合实战 · 战胜教程对手',
    badge: '毕业考核 6/6',
    mechanicTip: '运用换牌、加注、改牌与扫描，将训练靶机（300 算力）清零即可完成全部教程！',
  },
];

const TUTORIAL_STORAGE_KEY = 'mingan_tutorial_completed_v1';

export function loadTutorialCompleted(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTutorialCompleted(done: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TUTORIAL_STORAGE_KEY, done ? '1' : '0');
  } catch {
    // Ignore storage issues
  }
}

function tc(rank: Rank, suit: Suit, copy: 0 | 1 = 0): Card {
  return { id: `${rank}${suit}-${copy}`, rank, suit, copy };
}

export function getTutorialCapabilities(stageIndex: number): TutorialCapabilities {
  if (stageIndex === 0) {
    return { allowHack: false, allowScan: false, allowRaise: false };
  }
  if (stageIndex === 1 || stageIndex === 2) {
    return { allowHack: false, allowScan: false, allowRaise: true };
  }
  if (stageIndex === 3) {
    return { allowHack: true, allowScan: false, allowRaise: true };
  }
  return { allowHack: true, allowScan: true, allowRaise: true };
}

export function createTutorialStageState(stageIndex: number): GameState {
  const safeIdx = Math.max(0, Math.min(TUTORIAL_STAGES.length - 1, stageIndex));

  if (safeIdx === 0) {
    // Stage 1: Weak human K-9-4 vs AI Pair of A -> Human acts first
    return createInitialState({
      opponentName: '训练靶机 · 银狼',
      config: { ...DEFAULT_CONFIG, startingChips: 600, ante: 20 },
      deckOverride: [
        tc(4, 'B', 0), tc(9, 'P', 0), tc(13, 'P', 0),
        tc(14, 'B', 0), tc(14, 'P', 0), tc(7, 'B', 0),
        tc(13, 'B', 0), tc(9, 'B', 0), tc(3, 'P', 0), tc(6, 'P', 0),
      ],
    });
  }

  if (safeIdx === 1) {
    // Stage 2: Human Pair of A vs AI 10-high -> AI acts first and raises +20
    return createInitialState({
      opponentName: '训练靶机 · 银狼',
      config: { ...DEFAULT_CONFIG, startingChips: 600, ante: 20 },
      deckOverride: [
        tc(14, 'P', 0), tc(14, 'B', 0), tc(11, 'P', 0),
        tc(5, 'B', 0), tc(8, 'P', 0), tc(10, 'B', 0),
        tc(14, 'P', 1), tc(11, 'B', 0), tc(4, 'P', 0), tc(2, 'B', 0),
      ],
    });
  }

  if (safeIdx === 2) {
    // Stage 3: Human Q-9-2 high card (2 Pink) vs AI Pair of 10 -> Human acts first; swap 2B for 5P -> pure Flush (AP, QP, 9P, 7P, 5P)!
    return createInitialState({
      opponentName: '训练靶机 · 银狼',
      config: { ...DEFAULT_CONFIG, startingChips: 600, ante: 20 },
      deckOverride: [
        tc(12, 'P', 0), tc(9, 'P', 0), tc(2, 'B', 0),
        tc(10, 'B', 0), tc(10, 'P', 0), tc(3, 'B', 0),
        tc(5, 'P', 0), tc(7, 'P', 0), tc(14, 'P', 0), tc(4, 'B', 0),
      ],
    });
  }

  if (safeIdx === 3) {
    // Stage 4: Human K-Q-9 (B) vs AI Pair of 6 -> Human acts first; +1 on 9B -> 10B + board 11B, 14B = Straight Flush!
    return createInitialState({
      opponentName: '训练靶机 · 银狼',
      config: { ...DEFAULT_CONFIG, startingChips: 600, ante: 20 },
      deckOverride: [
        tc(12, 'B', 0), tc(13, 'B', 0), tc(9, 'B', 0),
        tc(6, 'B', 0), tc(6, 'P', 0), tc(2, 'B', 0),
        tc(11, 'B', 0), tc(14, 'B', 0), tc(4, 'P', 0), tc(5, 'P', 0),
      ],
    });
  }

  if (safeIdx === 4) {
    // Stage 5: Human Pair of A vs AI 10-high -> AI acts first, secretly hacks hand[0] (+1) and flips board[0]!
    return createInitialState({
      opponentName: '训练靶机 · 银狼',
      config: { ...DEFAULT_CONFIG, startingChips: 600, ante: 20 },
      deckOverride: [
        tc(14, 'B', 0), tc(14, 'P', 0), tc(8, 'B', 0),
        tc(7, 'B', 0), tc(10, 'P', 0), tc(4, 'P', 0),
        tc(11, 'B', 0), tc(5, 'P', 0), tc(3, 'B', 0), tc(2, 'P', 0),
      ],
    });
  }

  // Stage 6: Full 300-chip sparring duel against Rookie trainer bot
  return createInitialState({
    opponentName: '教程靶机 · 银狼(训练态)',
    config: {
      ...DEFAULT_CONFIG,
      startingChips: 300,
      ante: 20,
      aiDifficulty: 'rookie',
      aiPlayStyle: 'conservative',
      aiCheatProfile: 'opportunist',
    },
  });
}

const rookieDuelBot = new LocalAiAgent('ai', 'cautious', undefined, Math.random, 'rookie', 'conservative', 'opportunist');

export function pickTutorialOpponentAction(
  stageIndex: number,
  state: GameState
): GameAction | null {
  if (state.phase === 'showdown' || state.currentTurn !== 'ai') return null;
  const diff = getBetDiff(state, 'ai');

  if (stageIndex === 0) {
    if (diff > 0) return { type: 'call' };
    const hidden = [...state.board].reverse().find((b) => !b.isOpen);
    if (hidden) return { type: 'flip', boardIndex: hidden.index };
    return { type: 'check' };
  }

  if (stageIndex === 1) {
    // Open with +20 raise so player learns non-consuming call!
    const aiHasRaised = state.actionHistory.some(
      (e) => e.actor === 'ai' && e.summary.includes('加注')
    );
    if (!aiHasRaised && diff === 0 && isActionLegal(state, { type: 'raise', amount: 20 })) {
      return { type: 'raise', amount: 20 };
    }
    if (diff > 0) return { type: 'call' };
    const hidden = [...state.board].reverse().find((b) => !b.isOpen);
    if (hidden) return { type: 'flip', boardIndex: hidden.index };
    return { type: 'check' };
  }

  if (stageIndex === 2 || stageIndex === 3) {
    if (diff > 0) return { type: 'call' };
    const hidden = state.board.find((b) => !b.isOpen);
    if (hidden) return { type: 'flip', boardIndex: hidden.index };
    return { type: 'check' };
  }

  if (stageIndex === 4) {
    const aiTampered = state.players.ai.hand[0]?.tamperedBy?.length;
    if (!aiTampered && diff === 0 && !state.usedHackThisTurn) {
      const hackAct: GameAction = { type: 'hack', handIndex: 0, skill: 'plus-one' };
      if (isActionLegal(state, hackAct)) return hackAct;
    }
    if (diff > 0) return { type: 'call' };
    const hidden = state.board.find((b) => !b.isOpen);
    if (hidden) return { type: 'flip', boardIndex: hidden.index };
    return { type: 'check' };
  }

  // Stage 6 synchronous fallback
  if (diff > 0) return { type: 'call' };
  const hidden = state.board.find((b) => !b.isOpen);
  if (hidden) return { type: 'flip', boardIndex: hidden.index };
  return { type: 'check' };
}

export async function decideTutorialOpponentAction(
  stageIndex: number,
  state: GameState
): Promise<GameAction | null> {
  if (state.phase === 'showdown' || state.currentTurn !== 'ai') return null;
  if (stageIndex < 5) {
    return pickTutorialOpponentAction(stageIndex, state);
  }
  const decision = await rookieDuelBot.decide(state);
  return decision.action;
}

export function getTutorialGuidance(
  stageIndex: number,
  state: GameState,
  ui: { scanMode: boolean; selectedHandIndex: number | null }
): TutorialGuidance {
  const humanHasFlipped = state.actionHistory.some(
    (e) => e.actor === 'human' && e.summary.includes('破译公共节点')
  );
  const humanHasCalled = state.actionHistory.some(
    (e) => e.actor === 'human' && e.summary.includes('跟注')
  );
  const humanHasRaised = state.actionHistory.some(
    (e) => e.actor === 'human' && e.summary.includes('加注')
  );
  const humanHasHacked = state.players.human.hand.some((h) => Boolean(h.tamperedBy?.length));
  const diff = getBetDiff(state, 'human');

  if (stageIndex === 0) {
    const passed = state.players.human.swapCount >= 1 && humanHasFlipped;
    if (passed) {
      return {
        instruction: '第 1 关完成！你已掌握「明暗换牌」与「免费翻牌」的核心节奏。',
        subNote: '点击右上角「下一关」继续学习加注与跟注。',
        focusIds: ['tutorial-btn-next'],
        stagePassed: true,
        retryNeeded: false,
      };
    }
    if (state.phase === 'showdown') {
      return {
        instruction: '本手已提前结束，未能同时演练换牌与翻牌。',
        subNote: '点击「重练本关」再来一次。',
        focusIds: ['tutorial-btn-retry'],
        stagePassed: false,
        retryNeeded: true,
      };
    }
    if (state.players.human.swapCount === 0) {
      if (ui.selectedHandIndex === null) {
        return {
          instruction: '步骤 1/2：先点选（或拖拽）己方明牌「4」准备换牌',
          subNote: '当前未开放黑客技能。换入的暗牌会变为你的私有暗牌（PRIV）。',
          focusIds: ['human-hand-card-0'],
          stagePassed: false,
          retryNeeded: false,
        };
      }
      return {
        instruction: '步骤 1/2：再点击中央任意暗牌节点（推荐 节点01），完成互换',
        subNote: '首次换牌消耗 10 门票，被换出的牌将公开留在公共区。',
        focusIds: ['board-node-card-0'],
        stagePassed: false,
        retryNeeded: false,
      };
    }
    const nextHidden = state.board.find((b) => !b.isOpen);
    return {
      instruction: '步骤 2/2：现在直接点击任意未翻开的中央暗牌，免费翻开它！',
      subNote: '翻牌不消耗任何算力，翻完 4 张公共牌即进入终局河牌圈。',
      focusIds: nextHidden ? [`board-node-card-${nextHidden.index}`] : [],
      stagePassed: false,
      retryNeeded: false,
    };
  }

  if (stageIndex === 1) {
    const passed = humanHasCalled && humanHasRaised;
    if (passed) {
      return {
        instruction: '第 2 关完成！跟注只同步筹码，回合控制权仍归你所有。',
        subNote: '点击「下一关」了解双花色「同花」的特殊性。',
        focusIds: ['tutorial-btn-next'],
        stagePassed: true,
        retryNeeded: false,
      };
    }
    if (state.phase === 'showdown') {
      return {
        instruction: '本手已提前进入摊牌，点击「重练本关」演练跟注后反加。',
        subNote: '遇到对手加注后先点跟注，再点加注施压即可。',
        focusIds: ['tutorial-btn-retry'],
        stagePassed: false,
        retryNeeded: true,
      };
    }
    if (diff > 0) {
      return {
        instruction: `步骤 1/2：对手发起了加注！点击右侧「跟注 +${diff}」补齐差额`,
        subNote: '注意观察：补齐后回合不会交给对手，你仍可继续操作！',
        focusIds: ['lc-action-btn-call'],
        stagePassed: false,
        retryNeeded: false,
      };
    }
    return {
      instruction: '步骤 2/2：跟注不消耗动作！现在点击右侧「加注施压」选择任意档位反击',
      subNote: '也可以尝试长按「长按半数」0.7 秒投入一半算力突破限注上限。',
      focusIds: ['lc-action-btn-open-raise', 'raise-tier-btn-0'],
      stagePassed: false,
      retryNeeded: false,
    };
  }

  if (stageIndex === 2) {
    const passed =
      state.phase === 'showdown' &&
      state.result?.winner === 'human' &&
      state.result.humanEval?.categoryName === '同花';
    if (passed) {
      return {
        instruction: '第 3 关完成！你用 5 张绯霓「同花」击败了对手的「一对 10」！',
        subNote: '牢记双花色牌梯：炸弹 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌。',
        focusIds: ['tutorial-btn-next'],
        stagePassed: true,
        retryNeeded: false,
      };
    }
    if (state.phase === 'showdown') {
      return {
        instruction: '未能凑成绯霓同花获胜，点击「重练本关」试试换掉黑色 2B。',
        subNote: '只有黑/粉两色各 26 张，凑同花很容易，所以两对大于同花！',
        focusIds: ['tutorial-btn-retry'],
        stagePassed: false,
        retryNeeded: true,
      };
    }
    if (state.players.human.swapCount === 0) {
      if (ui.selectedHandIndex === null) {
        return {
          instruction: '步骤 1/2：己方已有 2 张绯霓(粉)牌，先点选黑色的「2」准备换掉它',
          subNote: '两副牌只有 2 种花色，凑 5 张同花概率极高（但依然小于两对）。',
          focusIds: ['human-hand-card-2'],
          stagePassed: false,
          retryNeeded: false,
        };
      }
      return {
        instruction: '步骤 1/2：点击节点01（换入隐藏绯霓牌）完成听同花！',
        subNote: '换入后你手牌全为绯霓粉，只等公共牌翻出同花。',
        focusIds: ['board-node-card-0'],
        stagePassed: false,
        retryNeeded: false,
      };
    }
    const nextHidden = state.board.find((b) => !b.isOpen);
    return {
      instruction: nextHidden
        ? '步骤 2/2：继续免费翻开暗牌（或点右侧「过牌」），推进到摊牌验证同花！'
        : '步骤 2/2：点击右侧「过牌」，直接与对手摊牌比大小！',
      subNote: '公共区还有 2 张绯霓牌（7P、AP），足够凑成 5 张同花胜过对手一对。',
      focusIds: nextHidden ? [`board-node-card-${nextHidden.index}`] : ['action-btn-primary-turn'],
      stagePassed: false,
      retryNeeded: false,
    };
  }

  if (stageIndex === 3) {
    if (humanHasHacked) {
      return {
        instruction: '第 4 关完成！你已成功注入黑客篡改（+1）且未消耗当前回合。',
        subNote: '篡改只在己方视角或摊牌时显现，预支算力也会对敌隐藏！点击「下一关」学习反制扫描。',
        focusIds: ['tutorial-btn-next'],
        stagePassed: true,
        retryNeeded: false,
      };
    }
    if (state.phase === 'showdown') {
      return {
        instruction: '本局未触发黑客篡改，点击「重练本关」再试一次。',
        subNote: '先选中己方明牌再点 +1 按钮。',
        focusIds: ['tutorial-btn-retry'],
        stagePassed: false,
        retryNeeded: true,
      };
    }
    if (ui.selectedHandIndex === null) {
      return {
        instruction: '步骤 1/2：黑客技能已解锁！先点击己方明牌「9」（黑曜）选中它',
        subNote: '目标：把 9B 改成 10B，与 Q/K 及公共牌 J/A 凑成皇家同花顺！',
        focusIds: ['human-hand-card-2'],
        stagePassed: false,
        retryNeeded: false,
      };
    }
    return {
      instruction: '步骤 2/2：点击手牌下方「+1」注入黑客协议，将选中牌点数 +1！',
      subNote: '篡改每回合限 1 次且不结束回合，改过的牌下方会标记原牌值。',
      focusIds: ['hack-btn-plus-one'],
      stagePassed: false,
      retryNeeded: false,
    };
  }

  if (stageIndex === 4) {
    const passed =
      state.phase === 'showdown' &&
      state.result?.reason === 'scan-caught' &&
      state.result.winner === 'human';
    if (passed) {
      return {
        instruction: '第 5 关完成！扫描抓获对手篡改，直接没收奖池并永久封印其「+1」技能！',
        subNote: '对手已被封印的技能在本场后续对局中再也无法使用。点击「下一关」进入毕业实战！',
        focusIds: ['tutorial-btn-next'],
        stagePassed: true,
        retryNeeded: false,
      };
    }
    if (state.phase === 'showdown') {
      return {
        instruction: '未能抓获篡改，点击「重练本关」再试一次（记得扫描对手第 1 张牌）。',
        subNote: '扫描每回合限 1 次，猜中对方篡改的牌即可一击制胜！',
        focusIds: ['tutorial-btn-retry'],
        stagePassed: false,
        retryNeeded: true,
      };
    }
    if (!ui.scanMode) {
      return {
        instruction: '步骤 1/2：对手刚才似乎改过牌！点击手牌下方「扫描」按钮开启探测',
        subNote: '扫描会预支 50 算力投入奖池；只要抓获任意篡改牌立刻赢得整局。',
        focusIds: ['hack-btn-scan-toggle'],
        stagePassed: false,
        retryNeeded: false,
      };
    }
    return {
      instruction: '步骤 2/2：现在点击上方对手第 1 张牌执行扫描验真！',
      subNote: '若对手确实修改了该牌，将触发 TAMPERED! 警报并封印对应技能。',
      focusIds: ['opponent-hand-card-0'],
      stagePassed: false,
      retryNeeded: false,
    };
  }

  // Stage 6: boss-duel
  const wonMatch = state.phase === 'showdown' && state.players.ai.chips === 0;
  const lostMatch = state.phase === 'showdown' && state.players.human.chips === 0;
  if (wonMatch) {
    return {
      instruction: '恭喜通过全部 6 关教程！你已击败训练靶机，掌握黑域全部规则！',
      subNote: '点击「完成教程进入正式局」即可开始你的正式黑域追捕战。',
      focusIds: ['tutorial-btn-next'],
      stagePassed: true,
      retryNeeded: false,
    };
  }
  if (lostMatch) {
    return {
      instruction: '训练靶机险胜了这一场！点击「重练本关」再次挑战 300 算力训练靶机。',
      subNote: '善用换牌偷鸡、适时加注与扫描抓包即可轻松拿下。',
      focusIds: ['tutorial-btn-retry'],
      stagePassed: false,
      retryNeeded: true,
    };
  }
  if (state.phase === 'showdown') {
    return {
      instruction: `靶机剩余算力 ${state.players.ai.chips}，点击右侧「下一局协议」继续收割！`,
      subNote: '把对手算力清零即可完成毕业考核。',
      focusIds: ['action-btn-next-hand'],
      stagePassed: false,
      retryNeeded: false,
    };
  }
  return {
    instruction: `最终考核：击败「${state.players.ai.name}」（对手剩余算力 ${state.players.ai.chips}）`,
    subNote: '所有操作已全部解锁，自由组合翻牌、换牌、加注、黑客篡改与扫描抓包！',
    focusIds: [],
    stagePassed: false,
    retryNeeded: false,
  };
}
