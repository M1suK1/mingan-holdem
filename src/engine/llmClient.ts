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
  getLegalRaiseRange,
  getNextSwapFee,
  isActionLegal,
} from './gameEngine.ts';

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
};

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
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return { ...DEFAULT_LLM_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveLlmConfigToStorage(cfg: LlmConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota errors
  }
}

export function serializeStateForLlm(state: GameState): string {
  const ai = state.players.ai;
  const human = state.players.human;
  const boardSummary = state.board
    .map((b, i) => `槽#${i + 1}:${b.isOpen ? formatCardShort(b.card) : '加密暗牌'}`)
    .join(' | ');
  const aiHand = ai.hand
    .map((h, i) => `手牌#${i + 1}:${formatCardShort(h.card)}(${h.visibility === 'open' ? '公开' : '私有加密'})`)
    .join(' ');
  const humanHand = human.hand
    .map((h, i) => `手牌#${i + 1}:${h.visibility === 'open' ? `${formatCardShort(h.card)}(公开)` : '未知加密暗牌'}`)
    .join(' ');

  return [
    `[局数:#${state.handNumber} | 阶段:${state.phase} | 奖池:${state.pot}]`,
    `我方(${ai.name})算力筹码:${ai.chips} 已下注:${ai.roundBet} | 对手(玩家)筹码:${human.chips} 已下注:${human.roundBet}`,
    `我方手牌: ${aiHand}`,
    `玩家可见手牌: ${humanHand}`,
    `中央节点池(4张): ${boardSummary}`,
    `当前需补差额:${getBetDiff(state, 'ai')} | 本段已加注次数:${state.raisesInSubPhase}`,
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

function buildEndpointUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function callOpenAiCompatible(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
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
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model.trim() || 'deepseek-chat',
        temperature: config.temperature,
        messages,
      }),
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
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestOpponentChatReply(params: {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
  chatHistory: ChatMessage[];
  userText: string;
}): Promise<{
  reply: string;
  expression: ContractExpression;
  fromLlm: boolean;
  logEntry?: LlmCallLog;
  errorMsg?: string;
}> {
  const { character, state, llmConfig, chatHistory, userText } = params;

  if (!llmConfig.enabled) {
    const local = generateLocalPersonaReply(
      character,
      state,
      userText,
      llmConfig.overloadPersona
    );
    return { ...local, fromLlm: false };
  }

  const sys = [
    buildCharacterSystemPrompt(character, llmConfig),
    '请严格只输出一段 JSON 对象，格式为：{"reply":"你的中文回复（80字以内，无Emoji）","expression":"calm|smile|surprise|sad|angry|shy"}',
  ].join('\n');

  const recentMsgs = chatHistory.slice(-6).map((m) => ({
    role: (m.sender === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.text,
  }));

  try {
    const { content, durationMs } = await callOpenAiCompatible(llmConfig, [
      { role: 'system', content: sys },
      ...recentMsgs,
      {
        role: 'user',
        content: `【当前牌桌态势】\n${serializeStateForLlm(state)}\n\n【玩家对你说】：${userText}`,
      },
    ]);

    const parsed = extractJsonPayload(content);
    const reply =
      typeof parsed?.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : content.replace(/[\p{Extended_Pictographic}]/gu, '').slice(0, 140);
    const expression = sanitizeExpression(parsed?.expression, 'smile');

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
        summary: `对话响应成功 (${expression})`,
        rawPreview: content.slice(0, 220),
      },
    };
  } catch (err) {
    const fallback = generateLocalPersonaReply(
      character,
      state,
      userText,
      llmConfig.overloadPersona
    );
    const errorMsg = err instanceof Error ? err.message : '未知网络异常';
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
        durationMs: 0,
        summary: `LLM 请求失败，已平滑回退本地语料：${errorMsg}`,
      },
    };
  }
}

export function enumerateLegalActionHints(state: GameState): string[] {
  const hints: string[] = [];
  const diff = getBetDiff(state, 'ai');
  const ai = state.players.ai;
  const raiseRange = getLegalRaiseRange(state, 'ai', diff > 0 ? Math.min(diff, ai.chips) : 0);

  if (diff > 0) {
    hints.push('{"type":"call"}', '{"type":"fold"}');
    if (raiseRange.allowed) {
      hints.push(`{"type":"raise","amount":${raiseRange.min}..${raiseRange.max}}`);
    }
    return hints;
  }

  if (state.phase === 'river') {
    hints.push('{"type":"check"}');
    if (raiseRange.allowed) {
      hints.push(`{"type":"raise","amount":${raiseRange.min}..${raiseRange.max}}`);
    }
    return hints;
  }

  if (state.justCalledThisTurn) {
    hints.push('{"type":"end-turn"}');
  }
  const hiddenSlots = state.board.filter((b) => !b.isOpen).map((b) => b.index);
  if (hiddenSlots.length > 0) {
    hints.push(`{"type":"flip","boardIndex":${hiddenSlots.join('|')}}`);
    const fee = getNextSwapFee(state, 'ai');
    const swappable = ai.hand
      .map((h, i) => (h.visibility === 'open' && !h.lockedFromSwap ? i : -1))
      .filter((i) => i >= 0);
    if (ai.chips >= fee && swappable.length > 0) {
      hints.push(
        `{"type":"swap","handIndex":${swappable.join('|')},"boardIndex":${hiddenSlots.join('|')}}`
      );
    }
  }
  if (raiseRange.allowed) {
    hints.push(`{"type":"raise","amount":${raiseRange.min}..${raiseRange.max}}`);
  }
  return hints;
}

export async function requestLlmPokerDecision(params: {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
}): Promise<{
  action: GameAction;
  reply: string;
  expression: ContractExpression;
  mood: OpponentMood;
  logEntry: LlmCallLog;
} | null> {
  const { character, state, llmConfig } = params;
  if (!llmConfig.enabled || !llmConfig.drivePokerActions) return null;

  const legalHints = enumerateLegalActionHints(state);
  const sys = [
    buildCharacterSystemPrompt(character, llmConfig),
    '现在轮到你出牌决策。请根据牌面与赔率选择一项合法行动，并严格只返回一段 JSON：',
    '{"action": <合法动作对象>, "reply": "出招时的一句简短台词(无Emoji)", "expression": "calm|smile|surprise|sad|angry|shy"}',
    `当前可选合法动作格式：${legalHints.join(' 或 ')}`,
  ].join('\n');

  try {
    const { content, durationMs } = await callOpenAiCompatible(llmConfig, [
      { role: 'system', content: sys },
      { role: 'user', content: serializeStateForLlm(state) },
    ]);
    const parsed = extractJsonPayload(content);
    const candidate = parsed?.action as GameAction | undefined;
    if (!candidate || typeof candidate !== 'object' || !isActionLegal(state, candidate)) {
      return null;
    }
    const expression = sanitizeExpression(parsed?.expression, 'smile');
    const reply =
      typeof parsed?.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : '这一步协议已经写入。';
    const mood: OpponentMood =
      expression === 'smile'
        ? 'confident'
        : expression === 'angry'
          ? 'tense'
          : expression === 'surprise'
            ? 'surprised'
            : 'idle';

    return {
      action: candidate,
      reply,
      expression,
      mood,
      logEntry: {
        id: `llm-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'decision',
        ok: true,
        model: llmConfig.model,
        durationMs,
        summary: `LLM 决策执行: ${candidate.type}`,
        rawPreview: content.slice(0, 220),
      },
    };
  } catch {
    return null;
  }
}
