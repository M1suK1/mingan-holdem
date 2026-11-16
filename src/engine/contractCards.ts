import type { ContractExpression, OpponentMood } from './types.ts';

export const CONTRACT_EXPRESSIONS: ContractExpression[] = [
  'calm',
  'smile',
  'surprise',
  'sad',
  'angry',
  'shy',
];

export const EXPRESSION_META: Record<
  ContractExpression,
  { label: string; cyberCode: string; desc: string }
> = {
  calm: { label: '平静', cyberCode: 'SYNC_STABLE', desc: '心率平稳，冷静审视桌面数据流' },
  smile: { label: '微笑', cyberCode: 'CONFIDENCE_UP', desc: '嘴角扬起，似乎握有高权重底牌或诱导陷阱' },
  surprise: { label: '惊讶', cyberCode: 'SIGNAL_SPIKE', desc: '遭遇意料之外的加注或牌面突变' },
  sad: { label: '低落', cyberCode: 'LINK_DRAIN', desc: '算力受损或关键听牌落空' },
  angry: { label: '警觉', cyberCode: 'ICE_ALERT', desc: '进入高压攻防姿态，准备强硬反击' },
  shy: { label: '动摇', cyberCode: 'FLUCTUATION', desc: '偷鸡被看穿或节奏被打乱时的微妙神情' },
};

export interface ContractTrait {
  id: string;
  name: string;
  polarity: 'positive' | 'neutral' | 'negative';
  tags: string[];
  description: string;
}

export interface ContractVoice {
  tone: string;
  habits: string[];
  samples: string[];
}

export interface ContractCardSummary {
  fileName: string;
  name: string;
  codename: string;
  title: string;
  element: string;
  archetype: string;
  color: string;
  quote: string;
  stats: { magic: number; insight: number; agility: number; empathy: number };
  expressionCount: number;
  hasVoice: boolean;
  bytes?: number;
}

export interface ContractCharacter extends ContractCardSummary {
  id: string;
  goal: string;
  appearance: string;
  personality: string;
  witchPersonality?: string;
  outfitDescription: string;
  traits: ContractTrait[];
  voice?: ContractVoice;
  portrait: string;
  witchPortrait?: string;
  variants: Record<string, string>;
}

export const FALLBACK_CONTRACT_CHARACTER: ContractCharacter = {
  id: 'silver-wolf-fallback',
  fileName: '夜糖事务所-契约卡-银狼.json',
  name: '银狼',
  codename: 'Silver Wolf',
  title: '虚数骇入者',
  element: '月影系',
  archetype: '控制',
  color: '#FF2E88',
  quote: '现实也不过是个写满漏洞的底层程序，只要找对后门，改写它只要三秒钟。',
  goal: '黑入空月残存的数据节点，找出当年三方交出名单的原始日志。',
  appearance:
    '留着蓬松银灰色卷曲单马尾，发尾渐变为数码电光蓝；额前架着反光偏光护目镜，眼瞳中带着漫不经心的审视。',
  personality:
    '态度慵懒且游离于规矩之外，将现实博弈视同游戏通关，对枯燥规则缺乏耐心，却热衷于破解谜题与逆向心理工程。',
  witchPersonality:
    '她依然用拖沓倦怠的语调说话，却将“游戏通关”异化为无法容忍任何变量脱离掌控的绝对偏执。',
  outfitDescription:
    '黑蓝拼色短款战术夹克，挂有游戏手柄按键模块的多功能腰带与便携式解码终端。',
  stats: { magic: 74, insight: 87, agility: 54, empathy: 45 },
  traits: [
    {
      id: 'weakness-implant',
      name: '弱点植入',
      polarity: 'positive',
      tags: ['骇客'],
      description: '洞悉对手下注频率后强行植入心理漏洞，诱导对手做出错误弃牌或跟注。',
    },
    {
      id: 'data-roam',
      name: '数据巡游',
      polarity: 'neutral',
      tags: ['测算'],
      description: '对黑/粉双色脉冲分布极其敏感，擅长在暗牌池中嗅出同花链路。',
    },
  ],
  voice: {
    tone: '慵懒简短的电子游戏玩家口吻，喜欢用通关、读档、漏洞比喻牌局。',
    habits: ['常把加注称作上强度，把换牌称作刷词条', '极少大惊小怪，哪怕全下也像在投币续关'],
    samples: [
      '这手牌的概率分支我已经跑完了，你确定还要往底池里塞算力？',
      '明牌只是给你看的诱饵，真正的后门藏在暗牌槽里。',
      '行吧，这回合算你操作漂亮——下一把可没这么好混过去。',
    ],
  },
  expressionCount: 6,
  hasVoice: true,
  portrait: '/assets/opponent-halfbody.webp',
  variants: {},
};

function cleanStr(val: unknown, fallback = ''): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
}

function cleanStat(val: unknown, fallback = 60): number {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.max(1, Math.min(100, Math.round(val)))
    : fallback;
}

export function parseNightSugarCard(
  rawInput: string | Record<string, unknown>,
  fileName = 'imported-card.json'
): ContractCharacter {
  const parsed =
    typeof rawInput === 'string'
      ? (JSON.parse(rawInput) as Record<string, unknown>)
      : rawInput;

  const girl = (parsed.girl ?? parsed) as Record<string, unknown>;
  if (!girl || typeof girl !== 'object' || !cleanStr(girl.name)) {
    throw new Error('无效的夜糖事务所契约卡格式：缺少角色名称字段');
  }

  const name = cleanStr(girl.name, '未知骇客');
  const rawStats = (girl.stats ?? {}) as Record<string, unknown>;
  const stats = {
    magic: cleanStat(rawStats.magic, 65),
    insight: cleanStat(rawStats.insight, 70),
    agility: cleanStat(rawStats.agility, 60),
    empathy: cleanStat(rawStats.empathy, 55),
  };

  const traits: ContractTrait[] = [];
  if (Array.isArray(girl.traits)) {
    for (const item of girl.traits) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      const tName = cleanStr(t.name);
      if (!tName) continue;
      const pol = t.polarity;
      traits.push({
        id: cleanStr(t.id, `trait-${traits.length}`),
        name: tName,
        polarity:
          pol === 'positive' || pol === 'negative' || pol === 'neutral' ? pol : 'neutral',
        tags: Array.isArray(t.tags)
          ? t.tags.filter((x): x is string => typeof x === 'string')
          : ['契约特性'],
        description: cleanStr(t.description, '来自夜糖事务所契约档案的固有特性。'),
      });
    }
  }

  let voice: ContractVoice | undefined;
  if (girl.voice && typeof girl.voice === 'object') {
    const v = girl.voice as Record<string, unknown>;
    const tone = cleanStr(v.tone);
    const habits = Array.isArray(v.habits)
      ? v.habits.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    const samples = Array.isArray(v.samples)
      ? v.samples.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
    if (tone || habits.length || samples.length) {
      voice = { tone, habits, samples };
    }
  }

  const variants: Record<string, string> = {};
  if (girl.importedVariants && typeof girl.importedVariants === 'object') {
    for (const [k, v] of Object.entries(girl.importedVariants as Record<string, unknown>)) {
      if (typeof v === 'string' && v.startsWith('data:image/')) {
        variants[k] = v;
      }
    }
  }

  // Primary portrait resolution: girl.portrait -> wardrobe[0].portrait -> custom:calm -> any variant -> fallback
  let portrait = cleanStr(girl.portrait);
  if (!portrait && Array.isArray(girl.wardrobe)) {
    for (const w of girl.wardrobe) {
      if (w && typeof w === 'object') {
        const wp = cleanStr((w as Record<string, unknown>).portrait);
        if (wp) {
          portrait = wp;
          break;
        }
      }
    }
  }
  if (!portrait) {
    portrait =
      variants['custom:calm'] ??
      Object.values(variants)[0] ??
      '/assets/opponent-halfbody.webp';
  }

  let witchPortrait: string | undefined;
  if (girl.witchForm && typeof girl.witchForm === 'object') {
    const wp = cleanStr((girl.witchForm as Record<string, unknown>).portrait);
    if (wp) witchPortrait = wp;
  }

  return {
    id: `ns-${fileName.replace(/\.json$/i, '')}-${name}`,
    fileName,
    name,
    codename: cleanStr(girl.codename, 'NET-OPERATIVE'),
    title: cleanStr(girl.title, '契约接入者'),
    element: cleanStr(girl.element, '数据系'),
    archetype: cleanStr(girl.archetype, '博弈'),
    color: cleanStr(girl.color, '#FF2E88'),
    quote: cleanStr(girl.quote, '连接已建立，让我看看你的底牌够不够硬。'),
    goal: cleanStr(girl.goal, '在深层数据赌局中赢取最高访问权限。'),
    appearance: cleanStr(girl.appearance, '来自夜糖事务所档案库的契约特工。'),
    personality: cleanStr(girl.personality, '冷静敏锐，擅长在信息不对称的博弈中寻找破绽。'),
    witchPersonality: cleanStr(girl.witchPersonality) || undefined,
    outfitDescription: cleanStr(girl.outfitDescription, '战术黑客接入礼装。'),
    stats,
    traits,
    voice,
    expressionCount: Object.keys(variants).length,
    hasVoice: Boolean(voice),
    portrait,
    witchPortrait,
    variants,
  };
}

export function resolveCharacterPortrait(
  character: ContractCharacter,
  expression: ContractExpression,
  overloadMode = false
): string {
  const prefixes = overloadMode ? ['witchform', 'custom'] : ['custom', 'witchform'];
  for (const prefix of prefixes) {
    const exact = character.variants[`${prefix}:${expression}`];
    if (exact) return exact;
  }
  for (const [k, v] of Object.entries(character.variants)) {
    if (k.endsWith(`:${expression}`)) return v;
  }
  if (overloadMode && character.witchPortrait) {
    return character.witchPortrait;
  }
  return character.portrait || '/assets/opponent-halfbody.webp';
}

/** 虚拟实体形象（魔女化形象），无魔女化差分时平滑回退至常态立绘 */
export function resolveVirtualEntityPortrait(
  character: ContractCharacter,
  expression: ContractExpression = 'calm'
): string {
  const exact = character.variants[`witchform:${expression}`];
  if (exact) return exact;
  if (character.variants['witchform:calm']) return character.variants['witchform:calm'];
  if (character.witchPortrait) return character.witchPortrait;
  return resolveCharacterPortrait(character, expression, true);
}

/** 现实形象（契约礼装），用于现实/虚拟双世界对照与后续拓展 */
export function resolveRealityPortrait(
  character: ContractCharacter,
  expression: ContractExpression = 'calm'
): string {
  const exact = character.variants[`custom:${expression}`];
  if (exact) return exact;
  if (character.variants['custom:calm']) return character.variants['custom:calm'];
  return character.portrait || '/assets/opponent-halfbody.webp';
}

export function moodToExpression(mood: OpponentMood): ContractExpression {
  switch (mood) {
    case 'confident':
    case 'victory':
      return 'smile';
    case 'tense':
      return 'angry';
    case 'surprised':
      return 'surprise';
    case 'defeat':
      return 'sad';
    case 'thinking':
    case 'idle':
    default:
      return 'calm';
  }
}

export function deriveAiStyleFromCharacter(
  character: ContractCharacter
): 'balanced' | 'aggressive' | 'cautious' {
  if (character.stats.magic >= 76 || character.archetype.includes('强袭') || character.archetype.includes('爆发')) {
    return 'aggressive';
  }
  if (character.stats.empathy >= 75 || character.archetype.includes('治愈') || character.archetype.includes('守卫')) {
    return 'cautious';
  }
  return 'balanced';
}
