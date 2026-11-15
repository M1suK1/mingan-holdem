import type { ContractCharacter } from './contractCards.ts';
import { getActiveDisguiseEntity } from './campaign.ts';
import { getSkillById } from './skillPool.ts';
import type { CampaignState, PursuerDossier } from './types.ts';
import type { ThinkingEffort } from './vertexClient.ts';
import { worldbookContext, WORLDBOOK_BUDGET, type WorldbookEntry } from './worldbook.ts';

export type PromptRole = 'system' | 'user' | 'assistant';
export type PromptScope = 'shared' | 'chat' | 'decision' | 'encounter';
export type PromptTask = Exclude<PromptScope, 'shared'>;

export interface PromptEntry {
  id: string;
  name: string;
  content: string;
  role: PromptRole;
  enabled: boolean;
  scope: PromptScope;
  marker?: boolean;
  /** 锁定结构契约词条：永远作为最后一段注入，确保 JSON 字段不被意外破坏 */
  contract?: boolean;
  defaultContent?: string;
  builtin?: boolean;
}

export interface PresetApiOverride {
  enabled?: boolean;
  provider?: 'openai' | 'vertex';
  endpoint?: string;
  apiKey?: string;
  model?: string;
  location?: string;
}

export interface RegexScript {
  id: string;
  name: string;
  find: string;
  replace: string;
  targets: Array<'input' | 'output'>;
  enabled: boolean;
}

export interface ChatPreset {
  id: string;
  name: string;
  description?: string;
  settings: {
    temperature: number;
    topP: number;
    maxTokens: number;
    presencePenalty: number;
    frequencyPenalty: number;
    maxContext: number;
    thinking: boolean;
    thinkingEffort?: ThinkingEffort;
    worldbookBudget?: number;
  };
  prompts: PromptEntry[];
  regex?: RegexScript[];
  api?: PresetApiOverride;
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PRESETS_STORAGE_KEY = 'mingan-cyber-holdem:presets:v1';
export const ACTIVE_PRESET_KEY = 'mingan-cyber-holdem:active-preset:v1';

export const PROMPT_SCOPES: Array<{ id: PromptScope; label: string; hint: string }> = [
  { id: 'shared', label: '共用基底', hint: '世界观、角色扮演、牌桌态势与世界书注入' },
  { id: 'chat', label: '牌桌对话', hint: '右侧通讯栏自由交谈与心理试探' },
  { id: 'decision', label: '出牌决策', hint: 'AI 回合调用大模型执行扑克/黑客动作' },
  { id: 'encounter', label: '追捕演出', hint: '追捕者登场挑衅、夺取实体或诱饵脱逃台词' },
];

export const PROMPT_MACRO_HINTS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'world', label: '黑域世界观', hint: '网络虚拟空间与通缉猎杀底层设定' },
  { key: 'worldbook', label: '命中世界书', hint: '常驻与关键词触发的世界书词条' },
  { key: 'char', label: '追捕者人设', hint: '契约卡性格、习惯、代表台词与特性' },
  { key: 'pursuer', label: '追捕身份档案', hint: '所属派系、威胁等级、虚拟实体代号与动机' },
  { key: 'player', label: '通缉黑客档案', hint: '玩家代号、通缉等级与当前伪装/诱饵状态' },
  { key: 'table', label: '牌桌脱敏报文', hint: '当前手牌/公共牌/筹码/差额（严格过滤暗牌）' },
  { key: 'skills', label: '技能状态', hint: '玩家已掠夺技能与双方被封印技能' },
  { key: 'history', label: '聊天记录', hint: '近期玩家与追捕者的完整通讯对话及心理独白' },
  { key: 'context', label: '本次指令上下文', hint: '具体请求的目标（合法动作清单/玩家发言等）' },
  { key: 'user', label: '玩家代号', hint: '玩家黑客代号' },
];

export const CONTRACT_PROMPTS: PromptEntry[] = [
  {
    id: 'contract-chat',
    name: '对话输出契约（末尾注入）',
    scope: 'chat',
    role: 'system',
    enabled: true,
    contract: true,
    builtin: true,
    content:
      '请严格只输出一段 JSON 对象，禁止 Markdown 代码块或 Emoji 符号。每次回复允许输出 1 至 3 段对话或心理想法（每段不超过200字）：{"segments":[{"kind":"thought","text":"可选心理独白，不超过200字"},{"kind":"speech","text":"实际开口台词，不超过200字"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
    defaultContent:
      '请严格只输出一段 JSON 对象，禁止 Markdown 代码块或 Emoji 符号。每次回复允许输出 1 至 3 段对话或心理想法（每段不超过200字）：{"segments":[{"kind":"thought","text":"可选心理独白，不超过200字"},{"kind":"speech","text":"实际开口台词，不超过200字"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
  },
  {
    id: 'contract-decision',
    name: '出牌决策契约（末尾注入）',
    scope: 'decision',
    role: 'system',
    enabled: true,
    contract: true,
    builtin: true,
    content:
      '现在轮到你出牌。只能从【本次指令上下文】列出的合法动作中选择一项并严格返回 JSON（无 Markdown、无 Emoji；segments 可写 1 至 3 段对话或心理想法，每段不超过200字）：{"action":<合法动作对象>,"segments":[{"kind":"thought","text":"决策心理，不超过200字"},{"kind":"speech","text":"出招台词，不超过200字"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
    defaultContent:
      '现在轮到你出牌。只能从【本次指令上下文】列出的合法动作中选择一项并严格返回 JSON（无 Markdown、无 Emoji；segments 可写 1 至 3 段对话或心理想法，每段不超过200字）：{"action":<合法动作对象>,"segments":[{"kind":"thought","text":"决策心理，不超过200字"},{"kind":"speech","text":"出招台词，不超过200字"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
  },
  {
    id: 'contract-encounter',
    name: '追捕演出契约（末尾注入）',
    scope: 'encounter',
    role: 'system',
    enabled: true,
    contract: true,
    builtin: true,
    content:
      '请以当前追捕者口吻针对局势变化输出 1 至 3 段台词或心理想法（每段不超过200字，无 Markdown、无 Emoji），严格返回 JSON：{"segments":[{"kind":"thought","text":"内心活动"},{"kind":"speech","text":"对黑客的宣言"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
    defaultContent:
      '请以当前追捕者口吻针对局势变化输出 1 至 3 段台词或心理想法（每段不超过200字，无 Markdown、无 Emoji），严格返回 JSON：{"segments":[{"kind":"thought","text":"内心活动"},{"kind":"speech","text":"对黑客的宣言"}],"expression":"calm|smile|surprise|sad|angry|shy"}',
  },
];

function defaultEntries(): PromptEntry[] {
  return [
    {
      id: 'entry-world-core',
      name: '黑域空间世界观',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '{{world}}',
    },
    {
      id: 'entry-pursuer-persona',
      name: '追捕者身份与契约人设',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '【追捕者身份】\n{{pursuer}}\n\n【角色人格与语言风格】\n{{char}}',
    },
    {
      id: 'entry-hacker-target',
      name: '通缉目标与技能状态',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '【通缉目标档案】\n{{player}}\n\n【技能与协议约束】\n{{skills}}',
    },
    {
      id: 'entry-worldbook-inject',
      name: '世界书动态注入区',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '【世界书词条】\n{{worldbook}}',
    },
    {
      id: 'entry-table-state',
      name: '当前牌桌实时态势',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '【牌桌态势】\n{{table}}',
    },
    {
      id: 'entry-chat-style',
      name: '对话演出口径',
      scope: 'chat',
      role: 'system',
      enabled: true,
      builtin: true,
      content:
        '你正在与通缉黑客 {{user}} 在虚拟牌桌上正面交锋。保持追捕者的压迫感、性格反差与口癖，不要泄露你自己的私有暗牌与未公开改牌事实，严禁输出任何 Emoji。',
    },
    {
      id: 'entry-decision-style',
      name: '博弈出牌思路',
      scope: 'decision',
      role: 'system',
      enabled: true,
      builtin: true,
      content:
        '请结合【双花色精确概率重排：四条>同花顺>葫芦>顺子>三条>两对>同花>一对>高牌】与当前赔率权衡动作；若需要误导或施加压力，可将心理战术融入 reply 台词中。',
    },
    {
      id: 'entry-encounter-style',
      name: '开场与胜负协议宣言',
      scope: 'encounter',
      role: 'system',
      enabled: true,
      builtin: true,
      content:
        '根据【本次指令上下文】描述的事件节点（遭遇拦截 / 实体被夺 / 诱饵脱逃 / 剥离玩家本体）发表极具角色辨识度的终局或开场发言。',
    },
    {
      id: 'entry-chat-history',
      name: '历史聊天与心理记忆',
      scope: 'shared',
      role: 'system',
      enabled: true,
      builtin: true,
      content: '【牌桌近期对话历史】\n{{history}}',
    },
    {
      id: 'entry-task-context',
      name: '本次请求上下文',
      scope: 'shared',
      role: 'user',
      enabled: true,
      builtin: true,
      content: '{{context}}',
    },
    ...CONTRACT_PROMPTS.map((c) => ({ ...c })),
  ];
}

export function builtinPresets(): ChatPreset[] {
  const now = '2026-11-15T00:00:00.000Z';
  return [
    {
      id: 'preset-black-domain-editable',
      name: '黑域协议 · 追捕博弈预设（可编辑）',
      description: '默认激活的工作预设，支持自由增删词条、排序、改写宏与采样参数。',
      settings: {
        temperature: 0.78,
        topP: 0.95,
        maxTokens: 0,
        presencePenalty: 0.15,
        frequencyPenalty: 0.15,
        maxContext: 12000,
        thinking: true,
        worldbookBudget: WORLDBOOK_BUDGET,
      },
      prompts: defaultEntries(),
      regex: [],
      builtin: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'preset-black-domain-factory',
      name: '出厂只读底稿（备份）',
      description: '标准黑域协议预设底稿，可随时复制为新预设或用于重置。',
      settings: {
        temperature: 0.75,
        topP: 0.92,
        maxTokens: 0,
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
        maxContext: 12000,
        thinking: true,
        worldbookBudget: WORLDBOOK_BUDGET,
      },
      prompts: defaultEntries(),
      regex: [],
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function applyRegexScripts(
  text: string,
  scripts: RegexScript[] | undefined,
  target: 'input' | 'output'
): string {
  if (!scripts || scripts.length === 0) return text;
  let out = text;
  for (const s of scripts) {
    if (!s.enabled || !s.find || !s.targets.includes(target)) continue;
    try {
      const re = new RegExp(s.find, 'g');
      out = out.replace(re, s.replace);
    } catch {
      // Ignore invalid user regex
    }
  }
  return out;
}

export function buildMacroDictionary(params: {
  character: ContractCharacter;
  dossier: PursuerDossier;
  campaign: CampaignState;
  worldbookText: string;
  tableSummary: string;
  taskContext: string;
  historyText?: string;
  overloadPersona?: boolean;
}): Record<string, string> {
  const {
    character,
    dossier,
    campaign,
    worldbookText,
    tableSummary,
    taskContext,
    historyText,
    overloadPersona,
  } = params;
  const disguise = getActiveDisguiseEntity(campaign);
  const ownedNames = campaign.acquiredSkills
    .map((id) => getSkillById(id)?.name ?? id)
    .join('、');

  const personaDesc =
    overloadPersona && character.witchPersonality
      ? character.witchPersonality
      : character.personality;
  const traitsDesc = character.traits.length
    ? character.traits.map((t) => `${t.name}（${t.description}）`).join('；')
    : '无特殊记录';
  const voiceDesc = character.voice
    ? [
        character.voice.tone ? `语气：${character.voice.tone}` : '',
        character.voice.habits.length ? `习惯：${character.voice.habits.join('；')}` : '',
        character.voice.samples.length
          ? `台词样本：${character.voice.samples.map((s) => `「${s}」`).join(' ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return {
    world:
      '【黑域协议空间】全网络地下虚拟博弈场。对战双方均以虚拟实体投射入局，胜者可依协议剥离败者出战的虚拟实体并从其技能池掠夺一项技能；玩家若佩戴俘获的虚拟实体作为伪装诱饵，战败时仅损失诱饵实体并脱离；若以本体虚拟实体战败则进入彻底失败结局。',
    worldbook: worldbookText || '（本次未命中额外世界书词条）',
    char: [
      `姓名：${character.name}（${character.title} / 代号 ${character.codename}）`,
      `人格：${personaDesc}`,
      `特性：${traitsDesc}`,
      `代表台词：「${character.quote}」`,
      voiceDesc,
    ]
      .filter(Boolean)
      .join('\n'),
    pursuer: [
      `追捕身份：${dossier.identityTitle}（隶属：${dossier.faction}）`,
      `威胁等级：T${dossier.threatLevel} | 虚拟实体：${dossier.virtualEntityName}`,
      `追捕目的：${dossier.motive}`,
    ].join('\n'),
    player: [
      `被通缉黑客：${campaign.playerCodename}（通缉 LV.${campaign.wantedLevel} · 悬赏 ${campaign.bounty}）`,
      `当前牌桌伪装：${disguise.name}（${disguise.isCore ? '本体核心' : '俘获诱饵伪装'}）`,
      `剩余可用诱饵实体：${campaign.capturedEntities.length} 个`,
    ].join('\n'),
    disguise: `${disguise.name}（${disguise.isCore ? '本体' : '诱饵'}）`,
    skills: `玩家已掠夺技能：${ownedNames || '无'}`,
    table: tableSummary,
    history: historyText?.trim() || '（本场尚无历史聊天记录）',
    context: taskContext,
    user: campaign.playerCodename,
  };
}

export function resolveMacros(text: string, dict: Record<string, string>): string {
  return text.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key: string) => {
    return dict[key] ?? '';
  });
}

export interface ComposedPresetResult {
  system: string;
  messages: Array<{ role: PromptRole; content: string }>;
  sections: Array<{ label: string; text: string }>;
  worldbookHits: Array<{ id: string; name: string; reason: 'constant' | 'key' }>;
  worldbookTokens: number;
}

export function composePresetPrompt(params: {
  preset: ChatPreset;
  scope: PromptTask;
  worldbook: WorldbookEntry[];
  character: ContractCharacter;
  dossier: PursuerDossier;
  campaign: CampaignState;
  triggerText: string;
  tableSummary: string;
  taskContext: string;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  overloadPersona?: boolean;
  compactMode?: boolean;
}): ComposedPresetResult {
  const {
    preset,
    scope,
    worldbook,
    character,
    dossier,
    campaign,
    triggerText,
    tableSummary,
    taskContext,
    historyMessages = [],
    overloadPersona,
    compactMode = false,
  } = params;

  const wbRes = compactMode
    ? { text: '', hits: [], tokens: 0, dropped: 0 }
    : worldbookContext(
        `${triggerText}\n${tableSummary}\n${character.name}\n${dossier.faction}`,
        worldbook,
        preset.settings.worldbookBudget ?? WORLDBOOK_BUDGET
      );

  const effectiveHistory = compactMode ? historyMessages.slice(-3) : historyMessages;
  const historyText = effectiveHistory
    .map((h) => (h.role === 'user' ? `玩家：${h.content}` : h.content))
    .join('\n');

  const dict = buildMacroDictionary({
    character,
    dossier,
    campaign,
    worldbookText: wbRes.text,
    tableSummary,
    taskContext,
    historyText,
    overloadPersona,
  });

  const activeEntries = preset.prompts.filter(
    (entry) =>
      entry.enabled &&
      !entry.marker &&
      (entry.scope === 'shared' || entry.scope === scope) &&
      !(compactMode && (entry.id === 'entry-world-core' || entry.id === 'entry-worldbook-inject'))
  );

  const normalEntries = activeEntries.filter((e) => !e.contract);
  const contractEntries = activeEntries.filter((e) => e.contract);
  const fallbackContract = CONTRACT_PROMPTS.find((c) => c.scope === scope);
  const finalContracts =
    contractEntries.length > 0
      ? contractEntries
      : fallbackContract
        ? [fallbackContract]
        : [];

  const sections: Array<{ label: string; text: string }> = [];
  const messages: Array<{ role: PromptRole; content: string }> = [];

  const hasHistoryEntry = normalEntries.some((e) => e.id === 'entry-chat-history' || e.content.includes('{{history}}'));

  for (const entry of normalEntries) {
    const resolved = applyRegexScripts(
      resolveMacros(entry.content, dict),
      preset.regex,
      'input'
    ).trim();
    if (!resolved) continue;
    sections.push({ label: `${entry.name} [${entry.role}]`, text: resolved });
    if (!hasHistoryEntry && entry.id === 'entry-task-context' && historyMessages.length > 0) {
      for (const h of historyMessages) {
        messages.push(h);
      }
    }
    messages.push({ role: entry.role, content: resolved });
  }

  // Ensure locked contract always sits at the very end
  for (const c of finalContracts) {
    const resolved = resolveMacros(c.content, dict).trim();
    if (!resolved) continue;
    sections.push({ label: `${c.name} [契约锁定]`, text: resolved });
    messages.push({ role: 'system', content: resolved });
  }

  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  return {
    system,
    messages,
    sections,
    worldbookHits: wbRes.hits,
    worldbookTokens: wbRes.tokens,
  };
}

export function loadPresets(): ChatPreset[] {
  const defaults = builtinPresets();
  if (typeof window === 'undefined' || !window.localStorage) return defaults;
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults;
    const contractById = new Map(CONTRACT_PROMPTS.map((c) => [c.id, c]));
    const valid = parsed
      .filter(
        (p): p is ChatPreset =>
          Boolean(p && typeof p === 'object' && typeof (p as ChatPreset).id === 'string' && Array.isArray((p as ChatPreset).prompts))
      )
      .map((p) => {
        // 自动将旧存档预设的默认输出上限升至 0（不限制思维链长度）并刷新旧版单句契约
        const nextMax =
          typeof p.settings?.maxTokens === 'number' &&
          p.settings.maxTokens > 0 &&
          p.settings.maxTokens <= 8000
            ? 0
            : p.settings?.maxTokens ?? 0;
        const nextPrompts = p.prompts.map((entry) => {
          const latestContract = contractById.get(entry.id);
          if (latestContract && entry.contract && /不超过(85|65|75)字/.test(entry.content)) {
            return { ...entry, content: latestContract.content, defaultContent: latestContract.content };
          }
          return entry;
        });
        if (!nextPrompts.some((e) => e.id === 'entry-chat-history' || e.content.includes('{{history}}'))) {
          const taskIdx = nextPrompts.findIndex((e) => e.id === 'entry-task-context');
          const historyEntry: PromptEntry = {
            id: 'entry-chat-history',
            name: '历史聊天与心理记忆',
            scope: 'shared',
            role: 'system',
            enabled: true,
            builtin: true,
            content: '【牌桌近期对话历史】\n{{history}}',
          };
          if (taskIdx >= 0) nextPrompts.splice(taskIdx, 0, historyEntry);
          else nextPrompts.push(historyEntry);
        }
        return {
          ...p,
          settings: { ...p.settings, maxTokens: nextMax },
          prompts: nextPrompts,
        };
      });
    return valid.length > 0 ? valid : defaults;
  } catch {
    return defaults;
  }
}

export function savePresets(presets: ChatPreset[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(0, 20)));
  } catch {
    // Ignore quota
  }
}

export function loadActivePresetId(presets: ChatPreset[]): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(ACTIVE_PRESET_KEY);
    if (saved && presets.some((p) => p.id === saved)) return saved;
  }
  return presets[0]?.id ?? 'preset-black-domain-editable';
}

export function saveActivePresetId(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTIVE_PRESET_KEY, id);
  } catch {
    // Ignore
  }
}

export function duplicatePreset(source: ChatPreset): ChatPreset {
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(source)) as ChatPreset,
    id: `preset-custom-${Date.now().toString(36)}`,
    name: `${source.name.replace(/（只读|备份）/g, '').trim()}（副本）`,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function exportPresetJson(preset: ChatPreset): string {
  return JSON.stringify(
    {
      format: 'mingan-preset',
      name: preset.name,
      temp_openai: preset.settings.temperature,
      top_p_openai: preset.settings.topP,
      openai_max_tokens: preset.settings.maxTokens,
      pres_pen_openai: preset.settings.presencePenalty,
      freq_pen_openai: preset.settings.frequencyPenalty,
      openai_max_context: preset.settings.maxContext,
      prompts: preset.prompts.map((p) => ({
        identifier: p.id,
        name: p.name,
        content: p.content,
        role: p.role,
        scope: p.scope,
        enabled: p.enabled,
        marker: p.marker,
        contract: p.contract,
      })),
      regex: preset.regex ?? [],
    },
    null,
    2
  );
}

export function importPresetJson(source: string): {
  ok: boolean;
  message: string;
  preset?: ChatPreset;
} {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(source) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'JSON 解析失败，请检查预设文件格式。' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: '预设根节点不是合法 JSON 对象。' };
  }

  const rawPrompts = Array.isArray(raw.prompts) ? raw.prompts : [];
  const entries: PromptEntry[] = [];
  rawPrompts.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const p = item as Record<string, unknown>;
    const content =
      typeof p.content === 'string'
        ? p.content
        : typeof p.system_prompt === 'string'
          ? p.system_prompt
          : '';
    if (!content.trim() && !p.marker) return;
    const scope: PromptScope =
      p.scope === 'chat' || p.scope === 'decision' || p.scope === 'encounter' || p.scope === 'shared'
        ? p.scope
        : 'shared';
    entries.push({
      id:
        typeof p.identifier === 'string' && p.identifier
          ? p.identifier
          : typeof p.id === 'string' && p.id
            ? p.id
            : `imp-entry-${idx}`,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 44) : `导入词条 ${idx + 1}`,
      content: content.slice(0, 32000),
      role: p.role === 'user' || p.role === 'assistant' ? p.role : 'system',
      enabled: p.enabled !== false && p.disable !== true,
      scope,
      marker: Boolean(p.marker),
      contract: Boolean(p.contract),
    });
  });

  if (entries.length === 0) {
    return { ok: false, message: '未检测到有效 prompts 词条列表。' };
  }

  // Ensure locked contracts exist
  for (const c of CONTRACT_PROMPTS) {
    if (!entries.some((e) => e.id === c.id || (e.contract && e.scope === c.scope))) {
      entries.push({ ...c });
    }
  }

  const now = new Date().toISOString();
  const preset: ChatPreset = {
    id: `preset-imp-${Date.now().toString(36)}`,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, 40)
        : `导入预设 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    description: '由外部 JSON 导入的对话与决策预设',
    settings: {
      temperature: Number(raw.temp_openai ?? raw.temperature) || 0.78,
      topP: Number(raw.top_p_openai ?? raw.top_p) || 0.95,
      maxTokens: Number(raw.openai_max_tokens ?? raw.max_tokens) || 0,
      presencePenalty: Number(raw.pres_pen_openai ?? raw.presence_penalty) || 0.15,
      frequencyPenalty: Number(raw.freq_pen_openai ?? raw.frequency_penalty) || 0.15,
      maxContext: Number(raw.openai_max_context ?? raw.max_context) || 12000,
      thinking: true,
      worldbookBudget: WORLDBOOK_BUDGET,
    },
    prompts: entries,
    regex: [],
    builtin: false,
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, message: `成功导入预设「${preset.name}」（共 ${entries.length} 条词条）。`, preset };
}
