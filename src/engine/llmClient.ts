import type {
  ContractExpression,
  GameAction,
  GameState,
  OpponentMood,
} from './types.ts';
import {
  CONTRACT_EXPRESSIONS,
  type ContractCharacter,
} from './contractCards.ts';
import {
  formatCardShort,
  getBetDiff,
  getHiddenBoardCount,
  getVisibleBoardCard,
  getVisibleHandCard,
  isActionLegal,
} from './gameEngine.ts';
import {
  actionKey,
  buildLlmSkillTelemetry,
  describeAction,
  enumerateLlmActionSpace,
  formatSkillTelemetryBlock,
  type LlmActionOption,
} from './llmActionSpace.ts';
import { composeOpponentPrompt } from './llmPrompt.ts';

export const LLM_STORAGE_KEY = 'mingan-cyber-holdem:llm-config:v1';

export interface LlmConfig {
  enabled: boolean;
  drivePokerActions: boolean;
  endpoint: string;
  apiKey: string;
  authMode: 'bearer' | 'none';
  model: string;
  temperature: number;
  overloadPersona: boolean;
  customSystemPrompt: string;
  /** 允许模型使用黑客技能与扫描（动作空间会同步裁剪） */
  useHackerSkills: boolean;
  /** 关键事件由模型主动开口，关闭时改用本地语料模板 */
  proactiveChat: boolean;
  /** 单次请求超时（毫秒） */
  requestTimeoutMs: number;
  /** 非法动作或无响应时的额外重试次数（0~3） */
  maxRetries: number;
  /** 绑定的对话补全预设 id */
  presetId: string;
  /** 是否注入世界书命中块 */
  worldbookEnabled: boolean;
  /** 世界书注入预算（字符） */
  worldbookBudget: number;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  drivePokerActions: false,
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  authMode: 'bearer',
  model: 'deepseek-chat',
  temperature: 0.75,
  overloadPersona: false,
  customSystemPrompt: '',
  useHackerSkills: true,
  proactiveChat: true,
  requestTimeoutMs: 18000,
  maxRetries: 1,
  presetId: 'preset-default',
  worldbookEnabled: true,
  worldbookBudget: 1600,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 合并并夹紧配置，兼容旧版本 localStorage 里缺失的新字段 */
export function normalizeLlmConfig(partial: Partial<LlmConfig> | null | undefined): LlmConfig {
  const merged = { ...DEFAULT_LLM_CONFIG, ...(partial ?? {}) };
  return {
    ...merged,
    enabled: Boolean(merged.enabled),
    drivePokerActions: Boolean(merged.drivePokerActions),
    overloadPersona: Boolean(merged.overloadPersona),
    useHackerSkills: merged.useHackerSkills !== false,
    proactiveChat: merged.proactiveChat !== false,
    presetId: typeof merged.presetId === 'string' && merged.presetId ? merged.presetId : 'preset-default',
    worldbookEnabled: merged.worldbookEnabled !== false,
    worldbookBudget: Math.round(
      clampNumber(merged.worldbookBudget, 200, 6000, DEFAULT_LLM_CONFIG.worldbookBudget)
    ),
    temperature: clampNumber(merged.temperature, 0.1, 1.3, DEFAULT_LLM_CONFIG.temperature),
    requestTimeoutMs: Math.round(
      clampNumber(merged.requestTimeoutMs, 4000, 60000, DEFAULT_LLM_CONFIG.requestTimeoutMs)
    ),
    maxRetries: Math.round(clampNumber(merged.maxRetries, 0, 3, DEFAULT_LLM_CONFIG.maxRetries)),
  };
}

export interface ChatMessage {
  id: string;
  sender: 'human' | 'opponent' | 'system';
  speakerName: string;
  text: string;
  expression?: ContractExpression;
  timestamp: number;
  tag?: 'action' | 'chat' | 'probe' | 'system';
  fromLlm?: boolean;
}

export interface LlmCallLog {
  id: string;
  timestamp: number;
  kind: 'chat' | 'decision' | 'ping';
  ok: boolean;
  model: string;
  durationMs: number;
  summary: string;
  rawPreview?: string;
}

export function loadSavedLlmConfig(): LlmConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_LLM_CONFIG };
  }
  try {
    const raw = window.localStorage.getItem(LLM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LLM_CONFIG };
    return normalizeLlmConfig(JSON.parse(raw) as Partial<LlmConfig>);
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveLlmConfigToStorage(cfg: LlmConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(normalizeLlmConfig(cfg)));
  } catch {
    // Ignore storage quota errors
  }
}

export function serializeStateForLlm(state: GameState): string {
  const ai = state.players.ai;
  const human = state.players.human;
  const boardSummary = state.board
    .map((b, i) => `槽#${i + 1}:${b.isOpen ? formatCardShort(getVisibleBoardCard(b, 'ai', false)) : '加密暗牌'}`)
    .join(' | ');
  const aiHand = ai.hand
    .map((h, i) => `手牌#${i + 1}:${formatCardShort(h.card)}(${h.visibility === 'open' ? '公开' : '私有加密'})`)
    .join(' ');
  const humanHand = human.hand
    .map((h, i) =>
      `手牌#${i + 1}:${
        h.visibility === 'open'
          ? `${formatCardShort(getVisibleHandCard(h, 'ai', 'human', false))}(公开)`
          : '未知加密暗牌'
      }`
    )
    .join(' ');

  return [
    `[局数:#${state.handNumber} | 阶段:${state.phase} | 奖池:${state.pot}]`,
    `我方(${ai.name})算力筹码:${ai.chips} 已下注:${ai.roundBet} | 对手(玩家)筹码:${human.chips} 已下注:${human.roundBet}`,
    `我方手牌: ${aiHand}`,
    `玩家可见手牌: ${humanHand}`,
    `中央节点池(4张): ${boardSummary}`,
    `当前需补差额:${getBetDiff(state, 'ai')} | 本段已加注次数:${state.raisesInSubPhase}`,
    formatSkillTelemetryBlock(buildLlmSkillTelemetry(state, 'ai')),
  ].join('\n');
}

export function buildCharacterSystemPrompt(
  character: ContractCharacter,
  config: LlmConfig
): string {
  const personaText =
    config.overloadPersona && character.witchPersonality
      ? `【深层过载态人格】${character.witchPersonality}`
      : `【常态人格】${character.personality}`;

  const traitsLine = character.traits.length
    ? `【角色特性】${character.traits.map((t) => `${t.name}（${t.description}）`).join('；')}`
    : '';

  const voiceLines = character.voice
    ? [
        character.voice.tone ? `说话方式：${character.voice.tone}` : '',
        character.voice.habits.length ? `语言习惯：${character.voice.habits.join('；')}` : '',
        character.voice.samples.length
          ? `原声台词参考：${character.voice.samples.map((s) => `「${s}」`).join(' ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return [
    `你正在赛博空间黑客牌桌游戏中扮演「${character.name}」（称号：${character.title}，代号：${character.codename}）。`,
    `你们正在进行《明暗博弈德州（黑/粉双花色52张版）》1v1单挑。全过程请用贴合角色的自然中文回答，严禁输出任何Emoji表情符号。`,
    `【双花色精确概率重排牌型大小】四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌。`,
    `【代表台词】「${character.quote}」`,
    personaText,
    traitsLine,
    voiceLines,
    config.customSystemPrompt ? `【额外指令】${config.customSystemPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function extractJsonPayload(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeExpression(val: unknown, fallback: ContractExpression = 'calm'): ContractExpression {
  if (typeof val === 'string' && (CONTRACT_EXPRESSIONS as string[]).includes(val)) {
    return val as ContractExpression;
  }
  return fallback;
}

/**
 * Character-authentic offline reply synthesizer using real fields from night-sugar-office contract card.
 */
export function generateLocalPersonaReply(
  character: ContractCharacter,
  state: GameState,
  userMessage: string,
  overloadMode = false
): { reply: string; expression: ContractExpression } {
  const msg = userMessage.trim();
  const diff = getBetDiff(state, 'human');
  const hiddenCount = getHiddenBoardCount(state);
  const sample = character.voice?.samples?.[state.actionHistory.length % (character.voice?.samples?.length || 1)];

  if (/底牌|暗牌|什么牌|同花|顺子/.test(msg)) {
    return {
      expression: 'smile',
      reply: overloadMode && character.witchPersonality
        ? `想偷看我的私有扇区？把你的视线和筹码全押上来，等终局摊牌那一刻我自然会让你看个够。`
        : `想知道我换进来的暗牌是不是黑粉同花？交足底池门票（当前奖池 ${state.pot}）再来套我的话吧。`,
    };
  }

  if (/投降|弃牌|怕了|不敢|梭哈|加注/.test(msg)) {
    return {
      expression: 'angry',
      reply:
        diff > 0
          ? `少用言语干扰我的频段——现在差额 ${diff} 摆在桌上，先跟注或者反加证明你的胆量。`
          : `心理战对我可不管用。桌面上还有 ${hiddenCount} 个加密节点未揭开，好戏才刚开始。`,
    };
  }

  if (/你是谁|名字|来历|夜糖|事务所|契约/.test(msg)) {
    const trait = character.traits[0];
    return {
      expression: 'calm',
      reply: `我是「${character.title}」${character.name}（代号 ${character.codename}）。${
        trait ? `小心我的「${trait.name}」特性——` : ''
      }${character.quote}`,
    };
  }

  if (sample) {
    return {
      expression: state.pot >= 120 ? 'smile' : 'calm',
      reply: `${sample}（当前底池 ${state.pot}，剩余加密节点 ${hiddenCount}/4）`,
    };
  }

  return {
    expression: 'shy',
    reply: `收到你的通讯信号了。不过在牌桌上，筹码推进的声音可比聊天记录更有说服力。`,
  };
}

/** 牌桌上触发主动台词的事件 */
export type ChatTrigger =
  | { kind: 'hand-start'; handNumber: number }
  | { kind: 'human-raise'; amount: number; big: boolean }
  | { kind: 'showdown-win'; potWon: number }
  | { kind: 'showdown-loss'; potWon: number }
  | { kind: 'showdown-tie'; potWon: number }
  | { kind: 'scan-caught-me' }
  | { kind: 'scan-success' }
  | { kind: 'skills-sealed' };

export function describeChatTrigger(trigger: ChatTrigger): string {
  switch (trigger.kind) {
    case 'hand-start':
      return `新一手开始（第 ${trigger.handNumber} 手），对手刚接入牌桌。`;
    case 'human-raise':
      return trigger.big
        ? `对手刚刚下了一笔重注，一次性推进 ${trigger.amount} 算力。`
        : `对手加注了 ${trigger.amount} 算力。`;
    case 'showdown-win':
      return `本手结算，你赢下了 ${trigger.potWon} 算力的奖池。`;
    case 'showdown-loss':
      return `本手结算，你输掉了 ${trigger.potWon} 算力的奖池。`;
    case 'showdown-tie':
      return `本手平局，${trigger.potWon} 算力奖池均分。`;
    case 'scan-caught-me':
      return '对手用扫描协议抓到了你的终端篡改，本手你直接判负，黑客技能也被封印了。';
    case 'scan-success':
      return '你用扫描协议抓到了对手的终端篡改，本手直接判胜，并封印了对方的黑客技能。';
    case 'skills-sealed':
      return '你的黑客技能此前已被封印，后续无法再使用篡改协议。';
    default:
      return '牌桌出现新状况。';
  }
}

/** 事件驱动的本地语料兜底（离线 / 请求失败时使用） */
export function generateLocalTriggerReply(
  character: ContractCharacter,
  _state: GameState,
  trigger: ChatTrigger
): { reply: string; expression: ContractExpression } {
  const sample = character.voice?.samples?.[0];
  switch (trigger.kind) {
    case 'hand-start':
      return {
        expression: 'calm',
        reply:
          trigger.handNumber <= 1
            ? `${character.quote}先手让你，别让我太早看见你的底牌。`
            : `第 ${trigger.handNumber} 手了，牌序重新洗过，前几手的账我还记得。`,
      };
    case 'human-raise':
      return {
        expression: trigger.big ? 'surprise' : 'smile',
        reply: trigger.big
          ? `一口气推 ${trigger.amount} 算力进来？要么是铁心诈唬，要么是真握着东西。`
          : `加 ${trigger.amount}？这点压力还不至于让我掉线。`,
      };
    case 'showdown-win':
      return {
        expression: 'smile',
        reply: `${trigger.potWon} 算力收下了。记住，牌桌上最贵的东西是信息差。`,
      };
    case 'showdown-loss':
      return {
        expression: 'sad',
        reply: `这 ${trigger.potWon} 算力归你。下一手我会重新对齐你的频率。`,
      };
    case 'showdown-tie':
      return {
        expression: 'surprise',
        reply: `平局？${trigger.potWon} 算力对半切——牌序难得同步一次。`,
      };
    case 'scan-caught-me':
      return {
        expression: 'surprise',
        reply: '居然扫到了底层？这手算你赢，篡改端口也被你封了。',
      };
    case 'scan-success':
      return {
        expression: 'smile',
        reply: '数据指纹不对——你的篡改被我的扫描协议抓到了，这手判负。',
      };
    case 'skills-sealed':
      return {
        expression: 'angry',
        reply: '篡改端口已经封死，剩下的牌面只能硬碰硬了。',
      };
    default:
      return {
        expression: 'calm',
        reply: sample ?? `${character.name}：牌池状态更新，继续。`,
      };
  }
}


function buildEndpointUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function callOpenAiCompatible(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { timeoutMs?: number; sampling?: Record<string, number> } = {}
): Promise<{ content: string; durationMs: number }> {
  const t0 = Date.now();
  const url = buildEndpointUrl(config.endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.authMode === 'bearer' && config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(
    2000,
    Math.round(options.timeoutMs ?? config.requestTimeoutMs ?? DEFAULT_LLM_CONFIG.requestTimeoutMs)
  );
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const sampling = options.sampling ?? {};
  const body: Record<string, unknown> = {
    model: config.model.trim() || 'deepseek-chat',
    temperature: sampling.temperature ?? config.temperature,
    messages,
  };
  for (const key of ['top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty']) {
    const value = sampling[key];
    if (typeof value === 'number' && Number.isFinite(value)) body[key] = value;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 120) || res.statusText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new Error('模型返回内容为空');
    }
    return { content, durationMs: Date.now() - t0 };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface ChatReplyParams {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
  /** 最近聊天记忆（时间升序），用于维持对话上下文 */
  chatHistory?: Array<{ sender: 'human' | 'opponent' | 'system'; text: string }>;
  /** 玩家发言；与 trigger 二选一 */
  userText?: string;
  /** 主动台词事件 */
  trigger?: ChatTrigger;
}

export async function requestOpponentChatReply(params: ChatReplyParams): Promise<{
  reply: string;
  expression: ContractExpression;
  fromLlm: boolean;
  logEntry?: LlmCallLog;
  errorMsg?: string;
}> {
  const { character, state, llmConfig, chatHistory = [], userText, trigger } = params;

  const fallback = trigger
    ? generateLocalTriggerReply(character, state, trigger)
    : generateLocalPersonaReply(character, state, userText ?? '', llmConfig.overloadPersona);

  if (!llmConfig.enabled) {
    return { ...fallback, fromLlm: false };
  }
  if (trigger && !llmConfig.proactiveChat) {
    return { ...fallback, fromLlm: false };
  }

  const triggerText = trigger ? describeChatTrigger(trigger) : undefined;
  const composed = composeOpponentPrompt({
    character,
    state,
    config: llmConfig,
    scope: trigger ? 'reaction' : 'chat',
    sceneText: [userText ?? '', triggerText ?? ''].join('\n'),
    triggerText,
  });

  const memory = chatHistory.slice(-8).map((m) => ({
    role: (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.text,
  }));

  const userContent = trigger
    ? `【场上事件】${triggerText ?? ''}`
    : `【玩家对你说】：${userText ?? ''}`;

  const maxAttempts = 1 + Math.min(1, llmConfig.maxRetries);
  let errorMsg = '';
  let lastDuration = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const { content, durationMs } = await callOpenAiCompatible(
        llmConfig,
        [
          { role: 'system', content: composed.system },
          ...memory,
          { role: 'user', content: userContent },
        ],
        { sampling: composed.sampling }
      );
      lastDuration = durationMs;

      const parsed = extractJsonPayload(content);
      const reply =
        typeof parsed?.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : content.replace(/[\p{Extended_Pictographic}]/gu, '').slice(0, 140);
      const expression = sanitizeExpression(parsed?.expression, trigger ? 'calm' : 'smile');

      return {
        reply,
        expression,
        fromLlm: true,
        logEntry: {
          id: `llm-${Date.now()}`,
          timestamp: Date.now(),
          kind: 'chat',
          ok: true,
          model: llmConfig.model,
          durationMs,
          summary: `${trigger ? `主动台词(${trigger.kind})` : '对话响应'}成功 (${expression})`,
          rawPreview: content.slice(0, 220),
        },
      };
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : '未知网络异常';
    }
  }

  return {
    ...fallback,
    fromLlm: false,
    errorMsg,
    logEntry: {
      id: `llm-${Date.now()}`,
      timestamp: Date.now(),
      kind: 'chat',
      ok: false,
      model: llmConfig.model,
      durationMs: lastDuration,
      summary: `LLM ${trigger ? '主动台词' : '对话'}请求失败，已平滑回退本地语料：${errorMsg}`,
    },
  };
}

/**
 * 旧接口保留：把合法动作空间压平成「可直接照抄的 JSON 样例」列表。
 * 新增的 hack / scan 也在此列出（受 useHackerSkills 与引擎谓词双重约束）。
 */
export function enumerateLegalActionHints(state: GameState, useHackerSkills = true): string[] {
  return enumerateLlmActionSpace(state, { useHackerSkills }).options.map((o) => o.example);
}

export interface LlmDecisionResult {
  action: GameAction | null;
  optionKey?: string;
  reply: string;
  expression: ContractExpression;
  mood: OpponentMood;
  attempts: number;
  ok: boolean;
  errorMsg?: string;
  logEntry: LlmCallLog;
}

function moodFromExpression(expression: ContractExpression): OpponentMood {
  if (expression === 'smile') return 'confident';
  if (expression === 'angry') return 'tense';
  if (expression === 'surprise') return 'surprised';
  if (expression === 'sad') return 'defeat';
  return 'idle';
}

function buildDecisionUserMessage(options: LlmActionOption[], notes: string[]): string {
  return [
    '【合法动作清单（每行一项，「=>」后是可直接照抄的 JSON）】',
    ...options.map((o) => `- ${o.label} => ${o.example}`),
    notes.length ? `【附加约束】\n${notes.map((n) => `- ${n}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function validateDecisionAction(
  state: GameState,
  candidate: unknown,
  useHackerSkills: boolean
): { action?: GameAction; error?: string } {
  if (!candidate || typeof candidate !== 'object') {
    return { error: 'action 字段缺失或不是对象' };
  }
  const act = candidate as GameAction;
  const type = (candidate as { type?: unknown }).type;
  if (typeof type !== 'string') {
    return { error: 'action.type 缺失或不是字符串' };
  }
  if ((act.type === 'hack' || act.type === 'scan') && !useHackerSkills) {
    return { error: '本次配置禁止使用黑客技能与扫描协议' };
  }
  if (!isActionLegal(state, act)) {
    return {
      error: `动作 "${act.type}" 在当前局面非法（差额未补齐 / 次数用尽 / 算力不足 / 目标不存在）`,
    };
  }
  return { action: act };
}

/**
 * 请求一次 LLM 出牌决策。
 * 返回 null 表示「本次未启用 LLM 决策」，调用方应直接使用本地策略核。
 * 返回 action 为 null 表示「尝试过但没有拿到合法动作」，调用方同样回退本地核，但审计日志已留痕。
 */
export async function requestLlmPokerDecision(params: {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
}): Promise<LlmDecisionResult | null> {
  const { character, state, llmConfig } = params;
  if (!llmConfig.enabled || !llmConfig.drivePokerActions) return null;

  const space = enumerateLlmActionSpace(state, { useHackerSkills: llmConfig.useHackerSkills });
  if (space.options.length === 0) return null;

  const composed = composeOpponentPrompt({
    character,
    state,
    config: llmConfig,
    scope: 'decision',
    sceneText: space.options.map((o) => o.label).join(' '),
    legalActions: space.options,
  });
  const user = buildDecisionUserMessage(space.options, space.notes);
  const convo: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: composed.system },
    { role: 'user', content: user },
  ];

  const maxAttempts = 1 + llmConfig.maxRetries;
  let lastError = '未获得响应';
  let lastRaw = '';
  let totalMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { content, durationMs } = await callOpenAiCompatible(llmConfig, convo, {
        sampling: composed.sampling,
      });
      totalMs += durationMs;
      lastRaw = content;

      const parsed = extractJsonPayload(content);
      const verdict = validateDecisionAction(state, parsed?.action, llmConfig.useHackerSkills);

      if (verdict.action) {
        const action = verdict.action;
        const expression = sanitizeExpression(parsed?.expression, 'smile');
        const reply =
          typeof parsed?.reply === 'string' && parsed.reply.trim()
            ? parsed.reply.trim()
            : `${describeAction(action)}。`;
        return {
          action,
          optionKey: actionKey(action),
          reply,
          expression,
          mood: moodFromExpression(expression),
          attempts: attempt,
          ok: true,
          logEntry: {
            id: `llm-${Date.now()}`,
            timestamp: Date.now(),
            kind: 'decision',
            ok: true,
            model: llmConfig.model,
            durationMs,
            summary: `LLM 决策：${describeAction(action)}${attempt > 1 ? `（第 ${attempt} 次尝试）` : ''}`,
            rawPreview: content.slice(0, 220),
          },
        };
      }
      lastError = verdict.error ?? '模型未给出可执行动作';
    } catch (err) {
      lastError = err instanceof Error ? err.message : '未知网络异常';
    }

    convo.push({ role: 'assistant', content: lastRaw || '（空响应）' });
    convo.push({
      role: 'user',
      content: `上一步无效：${lastError}。请重新只输出一个 JSON 对象，action 必须逐字取自合法动作清单，不要解释。`,
    });
  }

  return {
    action: null,
    reply: '',
    expression: 'calm',
    mood: 'thinking',
    attempts: maxAttempts,
    ok: false,
    errorMsg: lastError,
    logEntry: {
      id: `llm-${Date.now()}`,
      timestamp: Date.now(),
      kind: 'decision',
      ok: false,
      model: llmConfig.model,
      durationMs: totalMs,
      summary: `LLM 连续 ${maxAttempts} 次未给出合法动作（${lastError}），已回退本地策略核`,
      rawPreview: lastRaw.slice(0, 220),
    },
  };
}
