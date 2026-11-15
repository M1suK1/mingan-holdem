/**
 * 提示词宏：把牌桌事实与契约角色档案展开成可读文本。
 *
 * 与 night-sugar-office 的 promptMacros 同构：返回命中/缺失信息，便于在编辑器里做变量预览。
 * 未识别的宏原样保留，不抛错，避免玩家写错一个变量就整条提示词失效。
 */
import type { ContractExpression, GameState, OpponentMood } from './types.ts';
import type { ContractCharacter } from './contractCards.ts';
import { formatCardShort, getBetDiff, getHiddenBoardCount, getVisibleBoardCard } from './gameEngine.ts';

export interface MacroContext {
  character?: ContractCharacter;
  state?: GameState;
  /** 事件驱动的主动台词场景描述 */
  trigger?: string;
  /** 当前合法动作的 JSON 样例 */
  legalActions?: string[];
  /** 世界书命中块 */
  worldbook?: string;
  mood?: OpponentMood;
  expression?: ContractExpression;
}

export interface MacroSpec {
  key: string;
  label: string;
  hint: string;
  group: string;
}

export const MACRO_SPECS: MacroSpec[] = [
  { key: 'char', label: '角色名', hint: '当前契约卡角色名', group: '角色' },
  { key: 'user', label: '玩家称呼', hint: '固定为「玩家」', group: '角色' },
  { key: 'title', label: '角色称号', hint: '契约卡里的 title', group: '角色' },
  { key: 'codename', label: '角色代号', hint: '契约卡里的 codename', group: '角色' },
  { key: 'quote', label: '代表台词', hint: '契约卡里的 quote', group: '角色' },
  { key: 'personality', label: '人格设定', hint: '人格描述（可随过载人格切换）', group: '角色' },
  { key: 'traits', label: '角色特性', hint: '特性名与说明', group: '角色' },
  { key: 'voice', label: '说话方式', hint: '语气、语言习惯与原声样本', group: '角色' },
  { key: 'worldbook', label: '世界书', hint: '命中的世界书词条正文', group: '世界' },
  { key: 'state', label: '牌桌快照', hint: '完整牌桌状态序列化文本', group: '牌桌' },
  { key: 'pot', label: '奖池', hint: '公开奖池算力', group: '牌桌' },
  { key: 'chips', label: '我方算力', hint: '角色剩余算力', group: '牌桌' },
  { key: 'opp_chips', label: '对手算力', hint: '玩家剩余算力', group: '牌桌' },
  { key: 'diff', label: '待补差额', hint: '当前需要补齐的算力差额', group: '牌桌' },
  { key: 'phase', label: '阶段', hint: 'early / mid / river / showdown', group: '牌桌' },
  { key: 'board', label: '公共牌', hint: '公共槽已公开的牌面', group: '牌桌' },
  { key: 'hand', label: '我方手牌', hint: '角色自己的手牌', group: '牌桌' },
  { key: 'hidden_count', label: '暗牌数', hint: '公共区尚未翻开的槽位数', group: '牌桌' },
  { key: 'skill_state', label: '技能状态', hint: '黑客/扫描使用情况与封印技能', group: '技能' },
  { key: 'legal_actions', label: '合法动作', hint: '当前可执行动作的 JSON 清单', group: '技能' },
  { key: 'trigger', label: '场上事件', hint: '主动台词触发的事件描述', group: '事件' },
  { key: 'mood', label: '当前情绪', hint: '对手情绪枚举值', group: '事件' },
  { key: 'expression', label: '表情', hint: '立绘表情枚举值', group: '事件' },
];

const MACRO_KEYS = new Set(MACRO_SPECS.map((m) => m.key));

export function macroGroupNames(): string[] {
  return Array.from(new Set(MACRO_SPECS.map((m) => m.group)));
}

function boardText(state: GameState): string {
  return state.board
    .map((b, i) => `#${i + 1}:${b.isOpen ? formatCardShort(getVisibleBoardCard(b, 'ai', false)) : '暗牌'}`)
    .join(' ');
}

function skillStateText(state: GameState): string {
  const ai = state.players.ai;
  return [
    `黑客本回合已用:${state.usedHackThisTurn ? '是' : '否'}`,
    `扫描本回合已用:${state.usedScanThisTurn ? '是' : '否'}`,
    ai.sealedSkills.length ? `已封印:${ai.sealedSkills.join(',')}` : '已封印:无',
  ].join(' | ');
}

function resolveOne(key: string, ctx: MacroContext): string | undefined {
  const { character, state } = ctx;
  switch (key) {
    case 'char':
      return character?.name;
    case 'user':
      return '玩家';
    case 'title':
      return character?.title;
    case 'codename':
      return character?.codename;
    case 'quote':
      return character?.quote;
    case 'personality':
      return character?.personality ?? character?.witchPersonality;
    case 'traits':
      return character?.traits?.length
        ? character.traits.map((t) => `${t.name}（${t.description}）`).join('；')
        : undefined;
    case 'voice':
      return character?.voice
        ? [character.voice.tone, character.voice.habits.join('；'), character.voice.samples.map((s) => `「${s}」`).join(' ')]
            .filter(Boolean)
            .join(' / ')
        : undefined;
    case 'worldbook':
      return ctx.worldbook;
    case 'state':
      return state ? describeStateForMacro(state) : undefined;
    case 'pot':
      return state ? String(state.pot) : undefined;
    case 'chips':
      return state ? String(state.players.ai.chips) : undefined;
    case 'opp_chips':
      return state ? String(state.players.human.chips) : undefined;
    case 'diff':
      return state ? String(getBetDiff(state, 'ai')) : undefined;
    case 'phase':
      return state?.phase;
    case 'board':
      return state ? boardText(state) : undefined;
    case 'hand':
      return state
        ? state.players.ai.hand
            .map((h, i) => `#${i + 1}:${formatCardShort(h.card)}(${h.visibility === 'open' ? '明' : '暗'})`)
            .join(' ')
        : undefined;
    case 'hidden_count':
      return state ? String(getHiddenBoardCount(state)) : undefined;
    case 'skill_state':
      return state ? skillStateText(state) : undefined;
    case 'legal_actions':
      return ctx.legalActions?.length ? ctx.legalActions.join('\n') : undefined;
    case 'trigger':
      return ctx.trigger;
    case 'mood':
      return ctx.mood;
    case 'expression':
      return ctx.expression;
    default:
      return undefined;
  }
}

/** 供宏使用的精简快照，避免把整份 GameState 塞进提示词 */
export function describeStateForMacro(state: GameState): string {
  return [
    `第${state.handNumber}手 / 阶段:${state.phase} / 奖池:${state.pot}`,
    `我方算力:${state.players.ai.chips} 已下注:${state.players.ai.roundBet}`,
    `对手算力:${state.players.human.chips} 已下注:${state.players.human.roundBet}`,
    `公共牌: ${boardText(state)}`,
    `我方手牌: ${state.players.ai.hand
      .map((h, i) => `#${i + 1}:${formatCardShort(h.card)}(${h.visibility === 'open' ? '明' : '暗'})`)
      .join(' ')}`,
  ].join('\n');
}

export function resolveMacros(
  text: string,
  ctx: MacroContext = {}
): { text: string; used: string[]; missing: string[] } {
  const used: string[] = [];
  const missing: string[] = [];
  const out = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (raw, rawKey: string) => {
    const key = rawKey.toLowerCase();
    if (!MACRO_KEYS.has(key)) {
      missing.push(rawKey);
      return raw;
    }
    const value = resolveOne(key, ctx);
    if (value === undefined || value === '') {
      missing.push(rawKey);
      return '';
    }
    used.push(key);
    return value;
  });
  return { text: out, used: Array.from(new Set(used)), missing: Array.from(new Set(missing)) };
}

export function macroPreview(key: string, ctx: MacroContext = {}): string {
  const value = resolveOne(key, ctx);
  return value === undefined || value === '' ? '（当前上下文无法解析）' : value;
}
