import { evaluateSevenCards } from './evaluator.ts';
import type { Card, GameState, PlayerId, Rank, Suit } from './types.ts';

export type DebugHandPreset = 'quads' | 'fullhouse' | 'flush';

export type ParsedDebugCommand =
  | { ok: true; cmd: 'help' }
  | { ok: true; cmd: 'win' }
  | { ok: true; cmd: 'lose' }
  | { ok: true; cmd: 'next' }
  | { ok: true; cmd: 'goto'; nodeIndex: number }
  | { ok: true; cmd: 'chips'; target: PlayerId; amount: number }
  | { ok: true; cmd: 'hand'; preset: DebugHandPreset }
  | { ok: true; cmd: 'reveal' }
  | { ok: true; cmd: 'skill'; skillId: string }
  | { ok: true; cmd: 'clearskills' }
  | { ok: true; cmd: 'reset' }
  | { ok: true; cmd: 'resetprofile' }
  | { ok: true; cmd: 'clear' }
  | { ok: false; error: string };

export interface DebugCommandMeta {
  syntax: string;
  quickCmd: string;
  desc: string;
}

export const DEBUG_CHEAT_COMMANDS: DebugCommandMeta[] = [
  { syntax: 'win (别名: clearnode / gg)', quickCmd: 'win', desc: '直接赢下当前牌局并击穿对手算力，自动触发过关与钻缝动画' },
  { syntax: 'next', quickCmd: 'next', desc: '跳过当前过场/推进并解锁进入下一个逃亡节点' },
  { syntax: 'goto <0-4>', quickCmd: 'goto 4', desc: '直接传送至指定逃亡节点牌局 (0..4)' },
  { syntax: 'chips <player|ai> <数值>', quickCmd: 'chips ai 10', desc: '直接修改己方或对手剩余算力' },
  { syntax: 'hand <quads|fullhouse|flush>', quickCmd: 'hand quads', desc: '把当前牌面改写为四条A / 葫芦 / 同花便于测试摊牌' },
  { syntax: 'skill <技能ID>', quickCmd: 'skill siphon-cache', desc: '直接获取指定额外技能（满 3 槽自动触发替换弹窗）' },
  { syntax: 'clearskills', quickCmd: 'clearskills', desc: '清空当前已装备的额外协议技能槽' },
  { syntax: 'reveal', quickCmd: 'reveal', desc: '开关透视模式（查看对手暗牌与未翻公共牌）' },
  { syntax: 'lose', quickCmd: 'lose', desc: '将己方算力清 0（用于测试战败与重试状态）' },
  { syntax: 'reset', quickCmd: 'reset', desc: '重置逃亡路线进度与已显形暗墙' },
  { syntax: 'resetprofile (别名: wipe)', quickCmd: 'resetprofile', desc: '彻底重置玩家档案（路线/暗墙/实体/技能/教程）' },
  { syntax: 'clear', quickCmd: 'clear', desc: '清空 CMD 控制台输出历史' },
];

export function parseDebugCommand(rawInput: string): ParsedDebugCommand {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: '请输入指令（输入 help 查看全部作弊码）' };
  }

  const parts = trimmed.split(/\s+/);
  const head = parts[0].toLowerCase();

  switch (head) {
    case 'help':
    case '?':
      return { ok: true, cmd: 'help' };
    case 'win':
    case 'clearnode':
    case 'gg':
      return { ok: true, cmd: 'win' };
    case 'lose':
      return { ok: true, cmd: 'lose' };
    case 'next':
      return { ok: true, cmd: 'next' };
    case 'reveal':
      return { ok: true, cmd: 'reveal' };
    case 'clearskills':
      return { ok: true, cmd: 'clearskills' };
    case 'skill': {
      const skillId = (parts[1] ?? '').trim().toLowerCase();
      if (!skillId) {
        return {
          ok: false,
          error: '用法: skill <技能ID>，如 skill siphon-cache / skill cold-freq-lock / skill ghost-packet',
        };
      }
      return { ok: true, cmd: 'skill', skillId };
    }
    case 'reset':
      return { ok: true, cmd: 'reset' };
    case 'resetprofile':
    case 'wipe':
    case 'clearprofile':
      return { ok: true, cmd: 'resetprofile' };
    case 'clear':
    case 'cls':
      return { ok: true, cmd: 'clear' };
    case 'goto': {
      const idx = Number(parts[1]);
      if (parts.length !== 2 || !Number.isInteger(idx) || idx < 0 || idx > 4) {
        return { ok: false, error: '用法: goto <0-4>，例如 goto 2' };
      }
      return { ok: true, cmd: 'goto', nodeIndex: idx };
    }
    case 'chips': {
      const whoRaw = (parts[1] ?? '').toLowerCase();
      const target: PlayerId | null =
        whoRaw === 'player' || whoRaw === 'human' || whoRaw === 'me'
          ? 'human'
          : whoRaw === 'ai' || whoRaw === 'opp' || whoRaw === 'enemy'
            ? 'ai'
            : null;
      const amount = Number(parts[2]);
      if (!target || !Number.isFinite(amount)) {
        return { ok: false, error: '用法: chips <player|ai> <数值>，例如 chips ai 10' };
      }
      return { ok: true, cmd: 'chips', target, amount: Math.max(0, Math.round(amount)) };
    }
    case 'hand': {
      const preset = (parts[1] ?? '').toLowerCase();
      if (preset !== 'quads' && preset !== 'fullhouse' && preset !== 'flush') {
        return { ok: false, error: '用法: hand <quads|fullhouse|flush>' };
      }
      return { ok: true, cmd: 'hand', preset };
    }
    default:
      return { ok: false, error: `未知指令 "${parts[0]}"，输入 help 查看可用作弊码` };
  }
}

export function applyDebugWinHand(state: GameState): GameState {
  const totalMatchChips =
    state.players.human.chips +
    state.players.ai.chips +
    state.pot +
    (state.hackEscrowPot ?? 0);

  const openBoard = state.board.map((slot) => ({ ...slot, isOpen: true }));
  const openHumanHand = state.players.human.hand.map((h) => ({ ...h, visibility: 'open' as const }));
  const openAiHand = state.players.ai.hand.map((h) => ({ ...h, visibility: 'open' as const }));

  const humanEval = evaluateSevenCards([
    ...openHumanHand.map((h) => h.card),
    ...openBoard.map((b) => b.card),
  ]);
  const aiEval = evaluateSevenCards([
    ...openAiHand.map((h) => h.card),
    ...openBoard.map((b) => b.card),
  ]);

  const wonPot = Math.max(0, totalMatchChips - state.players.human.chips);

  return {
    ...state,
    phase: 'showdown',
    pot: 0,
    hackEscrowPot: 0,
    board: openBoard,
    players: {
      human: {
        ...state.players.human,
        chips: totalMatchChips,
        hiddenHackEscrow: 0,
        hand: openHumanHand,
      },
      ai: {
        ...state.players.ai,
        chips: 0,
        hiddenHackEscrow: 0,
        hand: openAiHand,
      },
    },
    result: {
      winner: 'human',
      reason: 'showdown',
      potWon: wonPot,
      humanEval,
      aiEval,
      payouts: {
        human: totalMatchChips,
        ai: 0,
      },
    },
    lastAction: {
      id: `cmd-win-${Date.now()}`,
      actor: 'human',
      type: 'showdown',
      label: '[CMD] 执行调试指令 win：直接过关结算',
    },
  };
}

export function applyDebugLoseHand(state: GameState): GameState {
  const totalMatchChips =
    state.players.human.chips +
    state.players.ai.chips +
    state.pot +
    (state.hackEscrowPot ?? 0);
  const openBoard = state.board.map((slot) => ({ ...slot, isOpen: true }));
  const openHumanHand = state.players.human.hand.map((h) => ({ ...h, visibility: 'open' as const }));
  const openAiHand = state.players.ai.hand.map((h) => ({ ...h, visibility: 'open' as const }));
  const wonPot = Math.max(0, totalMatchChips - state.players.ai.chips);

  return {
    ...state,
    phase: 'showdown',
    pot: 0,
    hackEscrowPot: 0,
    board: openBoard,
    players: {
      human: {
        ...state.players.human,
        chips: 0,
        hiddenHackEscrow: 0,
        hand: openHumanHand,
      },
      ai: {
        ...state.players.ai,
        chips: totalMatchChips,
        hiddenHackEscrow: 0,
        hand: openAiHand,
      },
    },
    result: {
      winner: 'ai',
      reason: 'showdown',
      potWon: wonPot,
      payouts: {
        human: 0,
        ai: totalMatchChips,
      },
    },
    lastAction: {
      id: `cmd-lose-${Date.now()}`,
      actor: 'human',
      type: 'showdown',
      label: '[CMD] 执行调试指令 lose：己方算力清 0',
    },
  };
}

export function applyDebugChipsOverride(
  state: GameState,
  target: PlayerId,
  amount: number
): GameState {
  const safeAmount = Math.max(0, Math.round(amount));
  return {
    ...state,
    players: {
      ...state.players,
      [target]: {
        ...state.players[target],
        chips: safeAmount,
      },
    },
  };
}

function makeCard(rank: Rank, suit: Suit, copy: 0 | 1): Card {
  return { id: `${rank}${suit}-${copy}`, suit, rank, copy };
}

export function applyDebugPresetHand(state: GameState, preset: DebugHandPreset): GameState {
  let humanCards: Card[];
  let boardCards: Card[];
  let aiCards: Card[];

  if (preset === 'quads') {
    humanCards = [makeCard(14, 'B', 0), makeCard(14, 'B', 1), makeCard(14, 'P', 0)];
    boardCards = [
      makeCard(14, 'P', 1),
      makeCard(10, 'B', 0),
      makeCard(7, 'P', 0),
      makeCard(3, 'B', 0),
    ];
    aiCards = [makeCard(13, 'B', 0), makeCard(13, 'P', 0), makeCard(9, 'B', 0)];
  } else if (preset === 'fullhouse') {
    humanCards = [makeCard(13, 'B', 0), makeCard(13, 'P', 0), makeCard(11, 'B', 0)];
    boardCards = [
      makeCard(13, 'B', 1),
      makeCard(11, 'P', 0),
      makeCard(6, 'B', 0),
      makeCard(2, 'P', 0),
    ];
    aiCards = [makeCard(10, 'B', 0), makeCard(9, 'P', 0), makeCard(4, 'B', 0)];
  } else {
    humanCards = [makeCard(14, 'P', 0), makeCard(12, 'P', 0), makeCard(9, 'P', 0)];
    boardCards = [
      makeCard(7, 'P', 0),
      makeCard(4, 'P', 0),
      makeCard(10, 'B', 0),
      makeCard(3, 'B', 0),
    ];
    aiCards = [makeCard(13, 'B', 0), makeCard(8, 'B', 0), makeCard(2, 'B', 0)];
  }

  return {
    ...state,
    players: {
      human: {
        ...state.players.human,
        hand: state.players.human.hand.map((h, i) => ({
          ...h,
          card: humanCards[i] ?? h.card,
          originalCard: undefined,
          tamperedBy: undefined,
        })),
      },
      ai: {
        ...state.players.ai,
        hand: state.players.ai.hand.map((h, i) => ({
          ...h,
          card: aiCards[i] ?? h.card,
          originalCard: undefined,
          tamperedBy: undefined,
        })),
      },
    },
    board: state.board.map((slot, i) => ({
      ...slot,
      card: boardCards[i] ?? slot.card,
      originalCard: undefined,
      tamperedBy: undefined,
    })),
  };
}
