/**
 * 对话补全预设：沿用 SillyTavern / night-sugar-office 的 ChatPreset 结构。
 *
 * 这里用到的子集：采样参数、可增删 / 可排序 / 可启停 / 可引用宏的提示词词条。
 * 世界书是独立模块（worldbook.ts），预设只负责把 {{worldbook}} 宏替换成命中块。
 */
import { resolveMacros, type MacroContext } from './promptMacros.ts';
import { WORLDBOOK_PLACEHOLDER } from './worldbook.ts';

export type PromptRole = 'system' | 'user' | 'assistant';

/** 词条用途：shared 进所有请求；其余只进对应场景 */
export type PromptScope = 'shared' | 'decision' | 'chat' | 'reaction';

export interface PromptScopeInfo {
  id: PromptScope;
  label: string;
  hint: string;
}

export const PROMPT_SCOPES: PromptScopeInfo[] = [
  { id: 'shared', label: '共用', hint: '世界观、牌型规则、角色档案、台词守则，所有请求都会注入' },
  { id: 'decision', label: '出牌决策', hint: '轮到角色行动时，决定用哪一张合法动作' },
  { id: 'chat', label: '对话回应', hint: '玩家主动说话时的回应' },
  { id: 'reaction', label: '主动台词', hint: '摊牌、扫描、封印等事件触发时主动开口' },
];

export const PROMPT_SCOPE_IDS = new Set<PromptScope>(PROMPT_SCOPES.map((s) => s.id));

export function isPromptScope(value: unknown): value is PromptScope {
  return typeof value === 'string' && PROMPT_SCOPE_IDS.has(value as PromptScope);
}

export function promptScope(entry: Pick<PromptEntry, 'scope'>): PromptScope {
  return entry.scope ?? 'shared';
}

export function promptScopeLabel(scope: PromptScope): string {
  return PROMPT_SCOPES.find((s) => s.id === scope)?.label ?? '共用';
}

export interface PromptEntry {
  id: string;
  name: string;
  content: string;
  role: PromptRole;
  enabled: boolean;
  scope?: PromptScope;
  /** SillyTavern 的分隔条目：只用于视觉分组，不发送内容 */
  marker?: boolean;
  /** 输出契约：不进正文分层，由编排器作为最后一段注入 */
  contract?: boolean;
  builtin?: boolean;
}

export interface ChatPreset {
  id: string;
  name: string;
  description?: string;
  /** 采样参数，键名与 OpenAI 兼容接口一致 */
  settings: Record<string, number>;
  /** 顺序即拼装顺序 */
  prompts: PromptEntry[];
  schema: number;
  builtin?: boolean;
}

export const PRESET_SCHEMA = 1;
export const PRESET_STORAGE_KEY = 'mingan-cyber-holdem:presets:v1';

export interface SamplingField {
  key: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
}

export const SAMPLING_FIELDS: SamplingField[] = [
  { key: 'temperature', label: '发散温度', hint: '越高越跳脱，牌桌决策建议 0.6~0.9', min: 0.1, max: 1.5, step: 0.05, fallback: 0.75 },
  { key: 'top_p', label: '核采样 top_p', hint: '与温度二选一调整，默认 0.95', min: 0.1, max: 1, step: 0.05, fallback: 0.95 },
  { key: 'max_tokens', label: '回复上限', hint: '单次回复的最大 token 数', min: 64, max: 1024, step: 32, fallback: 320 },
  { key: 'presence_penalty', label: '存在惩罚', hint: '降低重复话题，过高会让台词失焦', min: -2, max: 2, step: 0.1, fallback: 0.2 },
  { key: 'frequency_penalty', label: '频率惩罚', hint: '抑制高频词复读', min: -2, max: 2, step: 0.1, fallback: 0.15 },
];

export function samplingValue(preset: ChatPreset | undefined, key: string): number {
  const field = SAMPLING_FIELDS.find((f) => f.key === key);
  const fallback = field?.fallback ?? 0;
  const raw = preset?.settings?.[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  if (!field) return raw;
  return Math.min(field.max, Math.max(field.min, raw));
}

export function samplingPayload(preset: ChatPreset | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of SAMPLING_FIELDS) {
    out[field.key] = samplingValue(preset, field.key);
  }
  return out;
}

/** 出厂词条：内容可按需整段删除或改写，concept 与输出契约保持分离 */
export const DEFAULT_PROMPTS: PromptEntry[] = [
  {
    id: 'p-core',
    name: '核心协议',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content:
      '你是赛博空间「黑域」牌桌上的契约者，正与{{user}}进行《明暗博弈德州》1v1 单挑。牌桌规则只约束你能做什么，不约束你的态度与说法。你始终清楚自己是牌桌上的当事人，而不是解说。',
  },
  {
    id: 'p-hierarchy',
    name: '牌型大小（双花色重排）',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content:
      '本牌组只有黑曜脉冲与绯霓电弧两种花色，共 52 张。牌型强弱按真实成牌概率重排：四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌。两对压过同花，不要按常规德州经验判断。',
  },
  {
    id: 'p-worldbook',
    name: '世界书注入',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content: `${WORLDBOOK_PLACEHOLDER}`,
  },
  {
    id: 'p-role',
    name: '契约角色档案',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content:
      '你扮演的契约者：{{char}}，称号「{{title}}」，代号 {{codename}}。\n人格：{{personality}}\n特性：{{traits}}\n说话方式：{{voice}}\n代表台词：「{{quote}}」',
  },
  {
    id: 'p-tone',
    name: '台词守则',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content:
      '台词要求：短句、有停顿、有态度，可以挑衅、示弱或岔开话题，但绝不复述规则条文。严禁透露自己是否使用了黑客技能，严禁说出被篡改的具体牌面，严禁输出任何 Emoji。单句不超过 80 字。',
  },
  {
    id: 'p-state',
    name: '牌桌快照',
    role: 'system',
    enabled: true,
    scope: 'shared',
    builtin: true,
    content: '当前牌桌：\n{{state}}',
  },
  {
    id: 'p-decision',
    name: '出牌决策原则',
    role: 'system',
    enabled: true,
    scope: 'decision',
    builtin: true,
    content:
      '现在轮到你行动。只从【合法动作清单】里挑一个动作。权衡顺序：自己的真实牌力、还需补齐的差额、剩余算力、公共区暗牌的信息价值、对手是否可能已经篡改。不要为了保守而放弃能直接扩大胜率的翻牌或换牌。',
  },
  {
    id: 'p-decision-skill',
    name: '黑客与扫描的使用时机',
    role: 'system',
    enabled: true,
    scope: 'decision',
    builtin: true,
    content:
      '黑客技能只作用在自己的明牌上，改动只有你自己看得见，可以用来把弱牌改造成强牌或制造同花。扫描用来核验对手是否动手脚：对手换入公共槽、或你怀疑他手牌异常时值得一探。两者都不占行动次数，但每回合各只能用一次，且要预支算力。',
  },
  {
    id: 'p-decision-contract',
    name: '动作输出契约',
    role: 'system',
    enabled: true,
    scope: 'decision',
    contract: true,
    builtin: true,
    content:
      '严格只输出一段 JSON：{"action": <从合法动作清单里原样复制的动作对象>, "reply": "出招时的一句简短台词", "expression": "calm|smile|surprise|sad|angry|shy"}。禁止输出清单之外的动作，禁止输出多个动作，禁止解释。',
  },
  {
    id: 'p-chat',
    name: '对话回应',
    role: 'system',
    enabled: true,
    scope: 'chat',
    builtin: true,
    content: '玩家刚对你说了一句话。像真人一样接话，可以反问、可以岔开，可以借牌桌局势施压，不要机械复读对方的问题。',
  },
  {
    id: 'p-chat-contract',
    name: '对话输出契约',
    role: 'system',
    enabled: true,
    scope: 'chat',
    contract: true,
    builtin: true,
    content: '严格只输出一段 JSON：{"reply":"你的中文回复（80字以内）","expression":"calm|smile|surprise|sad|angry|shy"}。',
  },
  {
    id: 'p-reaction',
    name: '主动台词',
    role: 'system',
    enabled: true,
    scope: 'reaction',
    builtin: true,
    content: '场上刚发生了一件事：{{trigger}}。主动开口说一句，像当事人当下的真实反应，不要写旁白，不要复盘整局。',
  },
  {
    id: 'p-reaction-contract',
    name: '主动台词输出契约',
    role: 'system',
    enabled: true,
    scope: 'reaction',
    contract: true,
    builtin: true,
    content: '严格只输出一段 JSON：{"reply":"你的中文回复（80字以内）","expression":"calm|smile|surprise|sad|angry|shy"}。',
  },
];

export function builtinPresets(): ChatPreset[] {
  const base = DEFAULT_PROMPTS.map((entry) => ({ ...entry }));
  return [
    {
      id: 'preset-default',
      name: '默认 · 黑域牌桌',
      description: '平衡的采样参数，适合大多数牌桌对话与决策',
      schema: PRESET_SCHEMA,
      builtin: true,
      settings: { temperature: 0.75, top_p: 0.95, max_tokens: 320, presence_penalty: 0.2, frequency_penalty: 0.15 },
      prompts: base,
    },
    {
      id: 'preset-live',
      name: '低延迟 · 简洁',
      description: '更短的回复与更低的温度，适合快速对局',
      schema: PRESET_SCHEMA,
      builtin: true,
      settings: { temperature: 0.55, top_p: 0.9, max_tokens: 180, presence_penalty: 0.1, frequency_penalty: 0.1 },
      prompts: base.map((entry) => ({ ...entry })),
    },
    {
      id: 'preset-drama',
      name: '戏剧化 · 高发散',
      description: '更高的温度与更长的回复，适合想看角色飙戏的时候',
      schema: PRESET_SCHEMA,
      builtin: true,
      settings: { temperature: 1.1, top_p: 0.99, max_tokens: 512, presence_penalty: 0.5, frequency_penalty: 0.3 },
      prompts: base.map((entry) => ({ ...entry })),
    },
  ];
}

function sanitizeEntry(raw: unknown, index: number): PromptEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'string' && value.id ? value.id : typeof value.identifier === 'string' ? value.identifier : `p-${index}-${Date.now().toString(36)}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : `词条 ${index + 1}`;
  const content = typeof value.content === 'string' ? value.content : '';
  const role: PromptRole =
    value.role === 'user' ? 'user' : value.role === 'assistant' ? 'assistant' : 'system';
  return {
    id,
    name,
    content: content.slice(0, 8000),
    role,
    enabled: value.enabled !== false,
    scope: isPromptScope(value.scope) ? value.scope : 'shared',
    marker: value.marker === true,
    contract: value.contract === true,
    builtin: Boolean(value.builtin),
  };
}

export function sanitizePreset(raw: unknown, fallbackName = '导入的预设'): ChatPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const promptsRaw = Array.isArray(value.prompts) ? value.prompts : Array.isArray(value.prompts_list) ? value.prompts_list : [];
  const prompts = promptsRaw
    .map((item, index) => sanitizeEntry(item, index))
    .filter((item): item is PromptEntry => Boolean(item));
  const settingsRaw =
    value.settings && typeof value.settings === 'object' ? (value.settings as Record<string, unknown>) : {};
  const settings: Record<string, number> = {};
  for (const field of SAMPLING_FIELDS) {
    const rawNum = settingsRaw[field.key];
    if (typeof rawNum === 'number' && Number.isFinite(rawNum)) settings[field.key] = rawNum;
  }
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : fallbackName;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `preset-${Date.now().toString(36)}`,
    name,
    description: typeof value.description === 'string' ? value.description.slice(0, 160) : undefined,
    schema: PRESET_SCHEMA,
    settings,
    prompts,
  };
}

export function loadPresets(): ChatPreset[] {
  const builtins = builtinPresets();
  if (typeof window === 'undefined' || !window.localStorage) return builtins;
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return builtins;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return builtins;
    const list = parsed
      .map((item) => sanitizePreset(item))
      .filter((item): item is ChatPreset => Boolean(item && item.prompts.length));
    return list.length ? list : builtins;
  } catch {
    return builtins;
  }
}

export function savePresets(presets: ChatPreset[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets.slice(0, 40)));
    return true;
  } catch {
    return false;
  }
}

export function createPreset(name = '新的预设'): ChatPreset {
  return {
    id: `preset-${Date.now().toString(36)}`,
    name,
    description: '',
    schema: PRESET_SCHEMA,
    settings: Object.fromEntries(SAMPLING_FIELDS.map((f) => [f.key, f.fallback])),
    prompts: [
      {
        id: `p-${Date.now().toString(36)}`,
        name: '新词条',
        role: 'system',
        enabled: true,
        scope: 'shared',
        content: '',
      },
    ],
  };
}

export function duplicatePreset(source: ChatPreset, name = `${source.name} 副本`): ChatPreset {
  return {
    ...source,
    id: `preset-${Date.now().toString(36)}`,
    name,
    builtin: false,
    settings: { ...source.settings },
    prompts: source.prompts.map((entry, index) => ({ ...entry, id: `${entry.id}-copy-${index}` })),
  };
}

/** 取当前场景应注入的词条：shared 永远进，其余按 scope 匹配 */
export function activePrompts(preset: ChatPreset | undefined, scope: PromptScope): PromptEntry[] {
  if (!preset) return [];
  return preset.prompts.filter((entry) => {
    if (!entry.enabled || entry.marker) return false;
    const entryScope = promptScope(entry);
    return entryScope === 'shared' || entryScope === scope;
  });
}

export interface RenderResult {
  system: string;
  used: string[];
  missing: string[];
  chars: number;
}

/**
 * 把词条渲染成最终 system prompt：
 * 正文词条按顺序拼接，世界书缺失时兜底追加，输出契约永远排在最后。
 */
export function renderPresetSystem(
  entries: PromptEntry[],
  ctx: MacroContext = {}
): RenderResult {
  const body = entries.filter((entry) => !entry.contract);
  const contracts = entries.filter((entry) => entry.contract);
  const used: string[] = [];
  const missing: string[] = [];
  const parts: string[] = [];
  let hasWorldbookSlot = false;

  const render = (entry: PromptEntry): string => {
    if (entry.content.includes(WORLDBOOK_PLACEHOLDER)) hasWorldbookSlot = true;
    const resolved = resolveMacros(entry.content, ctx);
    used.push(...resolved.used);
    missing.push(...resolved.missing);
    return resolved.text.trim();
  };

  for (const entry of body) {
    const text = render(entry);
    if (text) parts.push(text);
  }

  const worldbookText = (ctx.worldbook ?? '').trim();
  if (worldbookText && !hasWorldbookSlot) {
    parts.push(`### 世界书\n${worldbookText}`);
  }

  for (const entry of contracts) {
    const text = render(entry);
    if (text) parts.push(text);
  }

  const system = parts.join('\n\n');
  return {
    system,
    used: Array.from(new Set(used)),
    missing: Array.from(new Set(missing)),
    chars: system.length,
  };
}

export interface PresetImportResult {
  ok: boolean;
  message: string;
  preset?: ChatPreset;
}

export function importPresetJson(source: string): PresetImportResult {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, message: '不是合法的 JSON。' };
  }
  const preset = sanitizePreset(data, '导入的预设');
  if (!preset || !preset.prompts.length) {
    return { ok: false, message: '没有找到 prompts，请选择预设导出的 JSON。' };
  }
  return { ok: true, message: `已导入预设「${preset.name}」，共 ${preset.prompts.length} 条词条。`, preset };
}

export function exportPresetJson(preset: ChatPreset): string {
  return JSON.stringify(
    {
      name: preset.name,
      description: preset.description ?? '',
      settings: preset.settings,
      prompts: preset.prompts.map((entry) => ({
        identifier: entry.id,
        name: entry.name,
        role: entry.role,
        content: entry.content,
        enabled: entry.enabled,
        scope: promptScope(entry),
        contract: Boolean(entry.contract),
      })),
    },
    null,
    2
  );
}

export function boundPreset(presets: ChatPreset[], presetId: string): ChatPreset {
  return presets.find((p) => p.id === presetId) ?? presets[0] ?? builtinPresets()[0];
}
