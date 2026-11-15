import type {
  CampaignState,
  ContractExpression,
  GameAction,
  GameState,
  OpponentMood,
  PursuerDossier,
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
  getVisibleBoardCard,
  getVisibleHandCard,
  isActionLegal,
} from './gameEngine.ts';
import {
  applyRegexScripts,
  builtinPresets,
  composePresetPrompt,
  type ChatPreset,
} from './presets.ts';
import { createInitialCampaign } from './campaign.ts';
import { buildPursuerDossier } from './skillPool.ts';
import {
  builtinWorldbook,
  syncDynamicWorldbookEntries,
  type WorldbookEntry,
} from './worldbook.ts';
import { vertexChat, type ThinkingEffort } from './vertexClient.ts';

export const LLM_STORAGE_KEY = 'mingan-cyber-holdem:llm-config:v1';

export type LlmProvider = 'openai' | 'vertex';
export type LlmAuthMode = 'bearer' | 'x-api-key' | 'header' | 'none';

export interface LlmConfig {
  enabled: boolean;
  drivePokerActions: boolean;
  provider: LlmProvider;
  endpoint: string;
  apiKey: string;
  authMode: LlmAuthMode;
  headerName?: string;
  model: string;
  vertexLocation?: string;
  vertexSecret?: string;
  temperature: number;
  topP?: number;
  maxTokens?: number;
  thinking?: boolean;
  thinkingEffort?: ThinkingEffort;
  decisionThinkingEffort?: ThinkingEffort;
  decisionModel?: string;
  fastDecisionMode?: boolean;
  reactAfterEachRound?: boolean;
  overloadPersona: boolean;
  customSystemPrompt: string;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  drivePokerActions: false,
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  authMode: 'bearer',
  headerName: 'X-API-Key',
  model: 'deepseek-chat',
  vertexLocation: 'us-central1',
  vertexSecret: '',
  temperature: 0.75,
  topP: 0.95,
  maxTokens: 0,
  thinking: true,
  thinkingEffort: 'high',
  decisionThinkingEffort: 'low',
  decisionModel: '',
  fastDecisionMode: true,
  reactAfterEachRound: true,
  overloadPersona: true,
  customSystemPrompt: '',
};

export interface ChatDialogueSegment {
  kind: 'speech' | 'thought';
  text: string;
}

export interface ChatMessage {
  id: string;
  sender: 'human' | 'opponent' | 'system';
  speakerName: string;
  text: string;
  msgKind?: 'speech' | 'thought';
  expression?: ContractExpression;
  timestamp: number;
  tag?: 'action' | 'chat' | 'probe' | 'system';
  fromLlm?: boolean;
}

export interface LlmCallLog {
  id: string;
  timestamp: number;
  kind: 'chat' | 'decision' | 'encounter' | 'ping';
  ok: boolean;
  provider?: LlmProvider;
  model: string;
  durationMs: number;
  summary: string;
  presetName?: string;
  worldbookHits?: string[];
  requestSections?: Array<{ label: string; text: string }>;
  rawPreview?: string;
  reasoning?: string;
}

export function loadSavedLlmConfig(): LlmConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_LLM_CONFIG };
  }
  try {
    const raw = window.localStorage.getItem(LLM_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LLM_CONFIG };
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    const merged = { ...DEFAULT_LLM_CONFIG, ...parsed };
    if (typeof merged.maxTokens === 'number' && merged.maxTokens > 0 && merged.maxTokens <= 8000) {
      merged.maxTokens = 0;
    }
    return merged;
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

/**
 * 严格遵循信息隔离原则序列化牌桌态势：
 * - 绝不向 AI/LLM 泄露玩家私有暗牌或玩家未公开黑客篡改结果
 * - 完整提供本局与前几轮算力投入、胜负战绩、已公开/己方修改及脱敏动作流水
 */
export function serializeStateForLlm(state: GameState): string {
  const ai = state.players.ai;
  const human = state.players.human;
  const revealAll = state.phase === 'showdown' || state.config.revealOpponentHidden;

  const boardSummary = state.board
    .map((b, i) => {
      if (!b.isOpen && !revealAll) return `槽#${i + 1}:加密暗牌`;
      const visible = getVisibleBoardCard(b, 'ai', revealAll);
      const swapTag =
        b.source === 'swapped-in'
          ? b.swappedBy === 'ai'
            ? '(我方换入)'
            : '(玩家换入)'
          : '';
      const selfTamper =
        (b.swappedBy === 'ai' || revealAll) && b.originalCard && b.tamperedBy?.length
          ? `[已改牌:原${formatCardShort(b.originalCard)}]`
          : '';
      return `槽#${i + 1}:${formatCardShort(visible)}${swapTag}${selfTamper}`;
    })
    .join(' | ');

  const aiHand = ai.hand
    .map((h, i) => {
      const tamperTag =
        h.originalCard && h.tamperedBy?.length
          ? `[已改牌:原${formatCardShort(h.originalCard)}]`
          : '';
      return `手牌#${i + 1}:${formatCardShort(h.card)}(${
        h.visibility === 'open' ? '公开' : '私有加密'
      })${tamperTag}`;
    })
    .join(' ');

  const humanHand = human.hand
    .map((h, i) => {
      if (h.visibility !== 'open' && !revealAll) {
        return `手牌#${i + 1}:未知加密暗牌`;
      }
      const visible = getVisibleHandCard(h, 'ai', 'human', revealAll);
      const exposedTamper =
        revealAll && h.originalCard && h.tamperedBy?.length
          ? `[摊牌揭露改牌:原${formatCardShort(h.originalCard)}]`
          : '';
      return `手牌#${i + 1}:${formatCardShort(visible)}(公开)${exposedTamper}`;
    })
    .join(' ');

  const safeActions = state.actionHistory
    .filter((a) => !(a.actor === 'human' && a.summary.includes('终端篡改')))
    .slice(-8)
    .map((a) => `- [${a.phase}] ${a.summary}`)
    .join('\n');

  const pastLines = (state.pastHands ?? []).map((p) => {
    const winLabel =
      p.winner === 'ai' ? '我方胜' : p.winner === 'human' ? '玩家胜' : '平局';
    const reasonLabel =
      p.reason === 'scan-caught'
        ? '扫描抓获篡改'
        : p.reason === 'fold'
          ? '对手弃牌'
          : '摊牌比牌';
    const catTxt =
      p.aiHandCategory && p.humanHandCategory
        ? ` | 牌型:我方[${p.aiHandCategory}] vs 玩家[${p.humanHandCategory}]`
        : '';
    const tamperNotes: string[] = [];
    if (p.humanHadTamper) tamperNotes.push('玩家曾篡改牌面(已暴露)');
    if (p.aiHadTamper) tamperNotes.push('我方曾使用改牌');
    const tamperTxt = tamperNotes.length ? ` | 改牌:${tamperNotes.join('、')}` : '';
    return `- 第#${p.handNumber}局：${winLabel}(${reasonLabel}) | 奖池${p.potWon}（我方累计投入${p.committedByAi} vs 玩家累计投入${p.committedByHuman}）${catTxt}${tamperTxt}`;
  });

  const aiScanned = state.scannedKeys
    .filter((k) => k.startsWith('ai:'))
    .map((k) => k.replace(/^ai:/, ''))
    .join(', ');

  return [
    `[当前局:#${state.handNumber} | 阶段:${state.phase} | 奖池:${state.pot}]`,
    `追捕者(${ai.name})剩余算力:${ai.chips} | 本段已下注:${ai.roundBet} | 本局累计投入:${ai.totalCommitted}`,
    `通缉黑客(玩家)剩余算力:${human.chips} | 本段已下注:${human.roundBet} | 本局累计投入:${human.totalCommitted}`,
    `追捕者手牌: ${aiHand}`,
    `玩家可见手牌: ${humanHand}`,
    `中央节点池(4张): ${boardSummary}`,
    `当前需补差额:${getBetDiff(state, 'ai')} | 本段已加注次数:${state.raisesInSubPhase}`,
    `技能与扫描状态: 本回合已用改牌=${state.usedHackThisTurn ? '是' : '否'} | 本回合已用扫描=${state.usedScanThisTurn ? '是' : '否'} | 已扫描目标=[${aiScanned || '无'}] | 我方被封技能=${ai.sealedSkills.join(',') || '无'} | 玩家被封技能=${human.sealedSkills.join(',') || '无'}`,
    safeActions ? `本局近期动作流水:\n${safeActions}` : '',
    pastLines.length ? `前几轮交锋战绩:\n${pastLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatChatHistoryForLlm(
  chatHistory: ChatMessage[] = [],
  limit = 16
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return chatHistory
    .filter((m) => m.text.trim().length > 0)
    .slice(-limit)
    .map((m) => {
      if (m.sender === 'human') {
        return { role: 'user' as const, content: m.text.trim() };
      }
      const kindTag = m.msgKind === 'thought' ? '[心理想法]' : '[发言]';
      return {
        role: 'assistant' as const,
        content: `${m.speakerName} ${kindTag}：${m.text.trim()}`,
      };
    });
}

export function buildCharacterSystemPrompt(
  character: ContractCharacter,
  config: LlmConfig
): string {
  const personaText =
    config.overloadPersona && character.witchPersonality
      ? `【虚拟实体过载人格】${character.witchPersonality}`
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
    `你正在黑域协议空间扮演追捕者「${character.name}」（称号：${character.title}，代号：${character.codename}）。`,
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

export function sanitizeExpression(
  val: unknown,
  fallback: ContractExpression = 'calm'
): ContractExpression {
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    if ((CONTRACT_EXPRESSIONS as string[]).includes(norm)) {
      return norm as ContractExpression;
    }
    const aliasMap: Record<string, ContractExpression> = {
      surprised: 'surprise',
      shock: 'surprise',
      shocked: 'surprise',
      amazed: 'surprise',
      anger: 'angry',
      mad: 'angry',
      furious: 'angry',
      tense: 'angry',
      happy: 'smile',
      smirk: 'smile',
      grin: 'smile',
      confident: 'smile',
      joy: 'smile',
      nervous: 'shy',
      blush: 'shy',
      embarrassed: 'shy',
      flustered: 'shy',
      upset: 'sad',
      disappointed: 'sad',
      grief: 'sad',
      down: 'sad',
      neutral: 'calm',
      relaxed: 'calm',
    };
    if (aliasMap[norm]) return aliasMap[norm];
  }
  return fallback;
}

function stripEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

export function parseDialogueSegments(
  parsed: Record<string, unknown> | null,
  fallbackText: string
): ChatDialogueSegment[] {
  const out: ChatDialogueSegment[] = [];
  if (parsed && Array.isArray(parsed.segments)) {
    for (const item of parsed.segments) {
      if (out.length >= 3) break;
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const rawText = typeof obj.text === 'string' ? stripEmoji(obj.text).trim() : '';
      if (!rawText) continue;
      const kind: 'speech' | 'thought' = obj.kind === 'thought' ? 'thought' : 'speech';
      out.push({ kind, text: rawText.slice(0, 200) });
    }
  }
  if (out.length === 0 && parsed) {
    if (typeof parsed.thought === 'string' && parsed.thought.trim()) {
      out.push({ kind: 'thought', text: stripEmoji(parsed.thought).trim().slice(0, 200) });
    }
    if (typeof parsed.reply === 'string' && parsed.reply.trim() && out.length < 3) {
      out.push({ kind: 'speech', text: stripEmoji(parsed.reply).trim().slice(0, 200) });
    }
  }
  if (out.length === 0) {
    const clean = stripEmoji(fallbackText).trim().slice(0, 200);
    if (clean) out.push({ kind: 'speech', text: clean });
  }
  return out.slice(0, 3);
}

export function generateLocalPersonaReply(
  character: ContractCharacter,
  state: GameState,
  userMessage: string,
  overloadMode = false
): { reply: string; segments: ChatDialogueSegment[]; expression: ContractExpression } {
  const msg = userMessage.trim();
  const diff = getBetDiff(state, 'human');
  const hiddenCount = getHiddenBoardCount(state);
  const sample =
    character.voice?.samples?.[state.actionHistory.length % (character.voice?.samples?.length || 1)];

  if (/底牌|暗牌|什么牌|同花|顺子/.test(msg)) {
    const thought = '他在试探我私有暗牌的花色分布……绝对不能提前暴露换牌路线。';
    const reply =
      overloadMode && character.witchPersonality
        ? '想窥探我的私有扇区？把你的算力和虚拟实体全部押上来，摊牌时我自然会让你看清。'
        : `想知道我换进来的暗牌是不是黑粉同花？交足底池门票（当前奖池 ${state.pot}）再来套话吧。`;
    return {
      expression: 'smile',
      reply,
      segments: [
        { kind: 'thought', text: thought },
        { kind: 'speech', text: reply },
      ],
    };
  }

  if (/诱饵|伪装|本体|通缉|追捕|实体/.test(msg)) {
    const thought = '如果他身上还套着俘获来的伪装实体，这一场就算打穿算力也未必能抓到本体……';
    const reply =
      '别指望靠一副伪装诱饵就能在黑域协议下全身而退——算力清零之时，我会亲自核验你的本体签名。';
    return {
      expression: 'angry',
      reply,
      segments: [
        { kind: 'thought', text: thought },
        { kind: 'speech', text: reply },
      ],
    };
  }

  if (/投降|弃牌|怕了|不敢|梭哈|加注/.test(msg)) {
    const reply =
      diff > 0
        ? `少用言语干扰我的频段——差额 ${diff} 摆在桌上，先跟注或者反加证明你的胆量。`
        : `心理战对我可不管用。桌面上还有 ${hiddenCount} 个加密节点未揭开，好戏才刚开始。`;
    return {
      expression: 'angry',
      reply,
      segments: [{ kind: 'speech', text: reply }],
    };
  }

  if (/你是谁|名字|来历|夜糖|事务所|契约/.test(msg)) {
    const trait = character.traits[0];
    const reply = `我是「${character.title}」${character.name}（代号 ${character.codename}）。${
      trait ? `小心我的「${trait.name}」特性——` : ''
    }${character.quote}`;
    return {
      expression: 'calm',
      reply,
      segments: [{ kind: 'speech', text: reply }],
    };
  }

  if (sample) {
    const reply = `${sample}（当前底池 ${state.pot}，剩余加密节点 ${hiddenCount}/4）`;
    return {
      expression: state.pot >= 120 ? 'smile' : 'calm',
      reply,
      segments: [{ kind: 'speech', text: reply.slice(0, 200) }],
    };
  }

  const fallback = '收到你的通讯信号了。不过在黑域牌桌上，算力推进的声音可比聊天记录更有说服力。';
  return {
    expression: 'shy',
    reply: fallback,
    segments: [{ kind: 'speech', text: fallback }],
  };
}

function buildEndpointUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function callOpenAiCompatible(
  config: LlmConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  presetSettings?: ChatPreset['settings'],
  effortOverride?: ThinkingEffort,
  timeoutMs = 45000
): Promise<{ content: string; durationMs: number }> {
  const t0 = Date.now();
  const url = buildEndpointUrl(config.endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = config.apiKey.trim();
  if (key && config.authMode !== 'none') {
    if (config.authMode === 'x-api-key') {
      headers['x-api-key'] = key;
    } else if (config.authMode === 'header') {
      headers[config.headerName?.trim() || 'X-API-Key'] = key;
    } else {
      headers.Authorization = `Bearer ${key}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const effort: ThinkingEffort =
    effortOverride ??
    presetSettings?.thinkingEffort ??
    config.thinkingEffort ??
    ((presetSettings?.thinking ?? config.thinking ?? true) ? 'unlimited' : 'off');
  const thinkingEnabled = effort !== 'off';
  const configuredMax = presetSettings?.maxTokens ?? config.maxTokens ?? 0;

  const sendOnce = async (maxTok: number) => {
    const payload: Record<string, unknown> = {
      model: config.model.trim() || 'deepseek-chat',
      temperature: presetSettings?.temperature ?? config.temperature,
      top_p: presetSettings?.topP ?? config.topP ?? 0.95,
      messages,
    };
    if (effort === 'low' || effort === 'medium' || effort === 'high') {
      payload.reasoning_effort = effort;
    } else if (effort === 'minimal') {
      payload.reasoning_effort = 'low';
    }
    // 思维链开启或设为 0（不限制）时，不发送 max_tokens，避免推理代理/思维链被长度截断
    if (!thinkingEnabled && maxTok > 0) {
      payload.max_tokens = maxTok;
    } else if (maxTok > 0 && configuredMax > 0) {
      payload.max_tokens = maxTok;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 140) || res.statusText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content?.trim() ?? '',
      finishReason: choice?.finish_reason,
    };
  };

  try {
    let attempt = await sendOnce(configuredMax);
    if (!attempt.content || attempt.finishReason === 'length') {
      // 被截断时去掉 max_tokens 限制重试一次
      const retryPayload: Record<string, unknown> = {
        model: config.model.trim() || 'deepseek-chat',
        temperature: presetSettings?.temperature ?? config.temperature,
        top_p: presetSettings?.topP ?? config.topP ?? 0.95,
        messages,
      };
      const res2 = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(retryPayload),
        signal: controller.signal,
      });
      if (res2.ok) {
        const d2 = (await res2.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        };
        const c2 = d2.choices?.[0];
        if (c2?.message?.content?.trim()) {
          attempt = { content: c2.message.content.trim(), finishReason: c2.finish_reason };
        }
      }
    }
    if (!attempt.content) {
      throw new Error(`模型返回内容为空${attempt.finishReason ? ` (${attempt.finishReason})` : ''}`);
    }
    return { content: attempt.content, durationMs: Date.now() - t0 };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function dispatchModelCall(params: {
  config: LlmConfig;
  preset?: ChatPreset;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  effortOverride?: ThinkingEffort;
  modelOverride?: string;
  timeoutMs?: number;
}): Promise<{
  content: string;
  reasoning?: string;
  durationMs: number;
  provider: LlmProvider;
  model: string;
}> {
  const { config, preset, messages, effortOverride, modelOverride, timeoutMs } = params;
  const useOverride = Boolean(preset?.api?.enabled);
  const provider: LlmProvider = useOverride
    ? preset?.api?.provider ?? config.provider
    : config.provider;
  const model =
    (modelOverride && modelOverride.trim()) ||
    (useOverride && preset?.api?.model?.trim()) ||
    config.model;
  const effectiveEffort: ThinkingEffort =
    effortOverride ??
    preset?.settings.thinkingEffort ??
    config.thinkingEffort ??
    ((preset?.settings.thinking ?? config.thinking ?? true) ? 'unlimited' : 'off');

  const t0 = Date.now();
  if (provider === 'vertex') {
    const secret =
      (useOverride && preset?.api?.apiKey?.trim()) || config.vertexSecret || config.apiKey || '';
    const location =
      (useOverride && preset?.api?.location?.trim()) || config.vertexLocation || 'us-central1';

    const res = await vertexChat(
      { model: model || 'gemini-2.5-flash', location, secret, timeoutMs },
      messages,
      {
        temperature: preset?.settings.temperature ?? config.temperature,
        topP: preset?.settings.topP ?? config.topP ?? 0.95,
        maxTokens: preset?.settings.maxTokens ?? config.maxTokens ?? 0,
        thinking: effectiveEffort !== 'off',
        thinkingEffort: effectiveEffort,
      }
    );
    if (!res.ok) {
      throw new Error(res.message);
    }
    return {
      content: res.text,
      reasoning: res.reasoning,
      durationMs: Date.now() - t0,
      provider: 'vertex',
      model,
    };
  }

  const effectiveConfig: LlmConfig =
    useOverride && preset?.api
      ? {
          ...config,
          endpoint: preset.api.endpoint?.trim() || config.endpoint,
          apiKey: preset.api.apiKey?.trim() || config.apiKey,
          model,
        }
      : { ...config, model };

  const out = await callOpenAiCompatible(
    effectiveConfig,
    messages,
    preset?.settings,
    effectiveEffort,
    timeoutMs
  );
  return {
    content: out.content,
    durationMs: out.durationMs,
    provider: 'openai',
    model,
  };
}

function resolveRuntimeContext(params: {
  character: ContractCharacter;
  campaign?: CampaignState;
  dossier?: PursuerDossier;
  preset?: ChatPreset;
  worldbook?: WorldbookEntry[];
}) {
  const campaign = params.campaign ?? createInitialCampaign();
  const dossier = params.dossier ?? buildPursuerDossier(params.character, campaign.roundIndex);
  const preset = params.preset ?? builtinPresets()[0];
  const baseWb = params.worldbook ?? builtinWorldbook();
  const syncedWb = syncDynamicWorldbookEntries(baseWb, campaign, params.character, dossier);
  return { campaign, dossier, preset, worldbook: syncedWb };
}

export async function requestOpponentChatReply(params: {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
  chatHistory: ChatMessage[];
  userText: string;
  campaign?: CampaignState;
  dossier?: PursuerDossier;
  preset?: ChatPreset;
  worldbook?: WorldbookEntry[];
}): Promise<{
  reply: string;
  segments: ChatDialogueSegment[];
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

  const rt = resolveRuntimeContext(params);
  const recentMsgs = formatChatHistoryForLlm(chatHistory);

  const extraNote = llmConfig.customSystemPrompt.trim()
    ? `\n【附加导演指令】${llmConfig.customSystemPrompt.trim()}`
    : '';
  const composed = composePresetPrompt({
    preset: rt.preset,
    scope: 'chat',
    worldbook: rt.worldbook,
    character,
    dossier: rt.dossier,
    campaign: rt.campaign,
    triggerText: userText,
    tableSummary: serializeStateForLlm(state),
    taskContext: `玩家对你说道：「${userText}」${extraNote}`,
    historyMessages: recentMsgs,
    overloadPersona: llmConfig.overloadPersona,
  });

  try {
    const out = await dispatchModelCall({
      config: llmConfig,
      preset: rt.preset,
      messages: composed.messages,
    });

    const cleanedContent = applyRegexScripts(out.content, rt.preset.regex, 'output');
    const parsed = extractJsonPayload(cleanedContent);
    const segments = parseDialogueSegments(parsed, cleanedContent);
    const reply = segments.map((s) => s.text).join(' / ');
    const expression = sanitizeExpression(parsed?.expression, 'smile');

    return {
      reply,
      segments,
      expression,
      fromLlm: true,
      logEntry: {
        id: `llm-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'chat',
        ok: true,
        provider: out.provider,
        model: out.model,
        durationMs: out.durationMs,
        summary: `对话响应成功 (${expression})`,
        presetName: rt.preset.name,
        worldbookHits: composed.worldbookHits.map((h) => `${h.name}(${h.reason === 'constant' ? '常驻' : '关键词'})`),
        requestSections: composed.sections,
        rawPreview: out.content.slice(0, 4000),
        reasoning: out.reasoning,
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
        provider: llmConfig.provider,
        model: llmConfig.model,
        durationMs: 0,
        summary: `LLM 请求失败，已平滑回退本地语料：${errorMsg}`,
        presetName: rt.preset.name,
        worldbookHits: composed.worldbookHits.map((h) => h.name),
        requestSections: composed.sections,
      },
    };
  }
}

export async function requestEncounterDialogue(params: {
  eventKind: 'pursuer-arrive' | 'pursuer-defeated' | 'decoy-escape' | 'core-seized' | 'round-settled';
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
  campaign: CampaignState;
  dossier: PursuerDossier;
  chatHistory?: ChatMessage[];
  preset?: ChatPreset;
  worldbook?: WorldbookEntry[];
  detailNote?: string;
  roundResultSummary?: string;
}): Promise<{
  reply: string;
  segments: ChatDialogueSegment[];
  expression: ContractExpression;
  fromLlm: boolean;
  logEntry?: LlmCallLog;
}> {
  const { eventKind, character, state, llmConfig, campaign, dossier, detailNote, roundResultSummary } = params;

  const fallbackWinner = state.result?.winner;
  const fallbackRoundExpr: ContractExpression =
    fallbackWinner === 'ai' ? 'smile' : fallbackWinner === 'human' ? 'sad' : 'surprise';
  const fallbackRoundReply =
    roundResultSummary ??
    (fallbackWinner === 'ai'
      ? `算力池 ${state.result?.potWon ?? 0} 已被我接管。下一局还要继续接入吗？`
      : fallbackWinner === 'human'
        ? `漂亮的牌序博弈……这 ${state.result?.potWon ?? 0} 算力归你了，下一把我会改写策略。`
        : '完全同分平局？一人一半回收算力池，下一局再见真章。');

  const fallbackMap: Record<typeof eventKind, { reply: string; thought?: string; expression: ContractExpression }> = {
    'pursuer-arrive': {
      thought: `通缉目标 ${campaign.playerCodename} 的信号果然落在这个扇区……先把他逼进底池博弈。`,
      reply: `通缉目标 ${campaign.playerCodename}，我是${dossier.identityTitle}。黑域协议已锁定这片扇区，交出你的虚拟实体吧。`,
      expression: 'angry',
    },
    'pursuer-defeated': {
      reply: `可恶……算力防线被你彻底击穿了。按黑域协议，这具虚拟实体和技能权限归你了。`,
      expression: 'sad',
    },
    'decoy-escape': {
      thought: '信号签名在瞬间坍缩成残片……可恶，中了他的替身伪装！',
      reply: `居然只是个伪装诱饵实体？算你滑头……等下次定位到你的本体签名，可没这么好运了！`,
      expression: 'surprise',
    },
    'core-seized': {
      reply: `伪装耗尽了？你的本体虚拟实体已由我正式接管。本次通缉追捕任务完成，断开连接吧。`,
      expression: 'smile',
    },
    'round-settled': {
      reply: fallbackRoundReply,
      expression: fallbackRoundExpr,
    },
  };

  if (!llmConfig.enabled) {
    const fb = fallbackMap[eventKind];
    const segments: ChatDialogueSegment[] = [];
    if (fb.thought) segments.push({ kind: 'thought', text: fb.thought });
    segments.push({ kind: 'speech', text: fb.reply });
    return { reply: fb.reply, segments, expression: fb.expression, fromLlm: false };
  }

  const eventDescMap: Record<typeof eventKind, string> = {
    'pursuer-arrive': `【事件：追捕者拦截开场】你刚刚通过黑域协议定位到通缉黑客 ${campaign.playerCodename}，以虚拟实体姿态降临牌桌，向对方发出开局追捕宣言。`,
    'pursuer-defeated': `【事件：追捕者败北】你的算力已归零，你的虚拟实体即将被玩家按黑域协议夺取，发表不甘或认可的败北台词。`,
    'decoy-escape': `【事件：玩家牺牲伪装诱饵逃脱】你打穿了对手的算力，却发现对方出战的只是一具俘获来的伪装诱饵（${detailNote ?? '诱饵实体'}），让玩家本体成功逃脱，表达震惊或警告。`,
    'core-seized': `【事件：剥离玩家本体实体（失败结局）】玩家以本体虚拟实体出战且算力归零，你成功夺走了玩家本体，宣告这场通缉猎杀圆满收网。`,
    'round-settled': `【事件：单局结算感想】第 #${state.handNumber} 局刚刚结束：${roundResultSummary ?? fallbackRoundReply}。请结合本局摊牌情况、双方算力押注和筹码余量，用 1 至 3 段对话或心理想法发表你的真实感想或心理反应（对下一局保持张力）。`,
  };

  const rt = resolveRuntimeContext({ character, campaign, dossier, preset: params.preset, worldbook: params.worldbook });
  const composed = composePresetPrompt({
    preset: rt.preset,
    scope: 'encounter',
    worldbook: rt.worldbook,
    character,
    dossier,
    campaign,
    triggerText: `${eventKind} ${dossier.faction} 虚拟实体 诱饵 通缉`,
    tableSummary: serializeStateForLlm(state),
    taskContext: eventDescMap[eventKind],
    historyMessages: formatChatHistoryForLlm(params.chatHistory),
    overloadPersona: llmConfig.overloadPersona,
  });

  try {
    const out = await dispatchModelCall({
      config: llmConfig,
      preset: rt.preset,
      messages: composed.messages,
    });
    const cleaned = applyRegexScripts(out.content, rt.preset.regex, 'output');
    const parsed = extractJsonPayload(cleaned);
    const segments = parseDialogueSegments(parsed, fallbackMap[eventKind].reply);
    const reply = segments.map((s) => s.text).join(' / ');
    const expression = sanitizeExpression(parsed?.expression, fallbackMap[eventKind].expression);
    return {
      reply,
      segments,
      expression,
      fromLlm: true,
      logEntry: {
        id: `llm-enc-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'encounter',
        ok: true,
        provider: out.provider,
        model: out.model,
        durationMs: out.durationMs,
        summary: `遭遇剧情响应 (${eventKind})`,
        presetName: rt.preset.name,
        worldbookHits: composed.worldbookHits.map((h) => h.name),
        requestSections: composed.sections,
        rawPreview: out.content.slice(0, 4000),
        reasoning: out.reasoning,
      },
    };
  } catch {
    const fb = fallbackMap[eventKind];
    const segments: ChatDialogueSegment[] = [];
    if (fb.thought) segments.push({ kind: 'thought', text: fb.thought });
    segments.push({ kind: 'speech', text: fb.reply });
    return { reply: fb.reply, segments, expression: fb.expression, fromLlm: false };
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
    if (state.phase === 'river' && !state.usedScanThisTurn && ai.chips >= state.config.scanCost) {
      hints.push('{"type":"scan","targetKind":"hand|board","targetIndex":0..3}');
    }
    return hints;
  }

  if (state.phase === 'river') {
    hints.push('{"type":"check"}');
    if (raiseRange.allowed) {
      hints.push(`{"type":"raise","amount":${raiseRange.min}..${raiseRange.max}}`);
    }
  } else {
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
  }

  // Optional hacker / scan skills when diff === 0
  if (!state.usedHackThisTurn) {
    const openHandIdx = ai.hand
      .map((h, i) => (h.visibility === 'open' ? i : -1))
      .filter((i) => i >= 0);
    const availableSkills = (['plus-one', 'minus-one', 'flip-suit'] as const).filter(
      (s) => !ai.sealedSkills.includes(s)
    );
    if (openHandIdx.length > 0 && availableSkills.length > 0 && ai.chips >= 40) {
      hints.push(
        `{"type":"hack","handIndex":${openHandIdx.join('|')},"skill":"${availableSkills.join('|')}"}`
      );
    }
  }

  if (!state.usedScanThisTurn && ai.chips >= state.config.scanCost) {
    hints.push('{"type":"scan","targetKind":"hand|board","targetIndex":0..3}');
  }

  return hints;
}

export async function requestLlmPokerDecision(params: {
  character: ContractCharacter;
  state: GameState;
  llmConfig: LlmConfig;
  chatHistory?: ChatMessage[];
  campaign?: CampaignState;
  dossier?: PursuerDossier;
  preset?: ChatPreset;
  worldbook?: WorldbookEntry[];
}): Promise<{
  action: GameAction;
  reply: string;
  segments: ChatDialogueSegment[];
  expression: ContractExpression;
  mood: OpponentMood;
  logEntry: LlmCallLog;
} | null> {
  const { character, state, llmConfig } = params;
  if (!llmConfig.enabled || !llmConfig.drivePokerActions) return null;

  const rt = resolveRuntimeContext(params);
  const legalHints = enumerateLegalActionHints(state);
  // 若仅剩唯一强制动作（例如跟注后的 end-turn），跳过网络请求直接交由本地即时完成
  if (legalHints.length <= 1) return null;

  const extraNote = llmConfig.customSystemPrompt.trim()
    ? `\n【附加导演指令】${llmConfig.customSystemPrompt.trim()}`
    : '';
  const fastMode = llmConfig.fastDecisionMode !== false;

  const composed = composePresetPrompt({
    preset: rt.preset,
    scope: 'decision',
    worldbook: rt.worldbook,
    character,
    dossier: rt.dossier,
    campaign: rt.campaign,
    triggerText: `决策 ${state.phase} 博弈 加注 黑客技能 扫描`,
    tableSummary: serializeStateForLlm(state),
    taskContext: `可选合法动作（请择一输出）：${legalHints.join(' 或 ')}${extraNote}`,
    historyMessages: formatChatHistoryForLlm(params.chatHistory),
    overloadPersona: llmConfig.overloadPersona,
    compactMode: fastMode,
  });

  try {
    const out = await dispatchModelCall({
      config: llmConfig,
      preset: rt.preset,
      messages: composed.messages,
      effortOverride: llmConfig.decisionThinkingEffort ?? (fastMode ? 'low' : undefined),
      modelOverride: llmConfig.decisionModel,
      timeoutMs: fastMode ? 18000 : 45000,
    });
    const cleaned = applyRegexScripts(out.content, rt.preset.regex, 'output');
    const parsed = extractJsonPayload(cleaned);
    const candidate = parsed?.action as GameAction | undefined;
    if (!candidate || typeof candidate !== 'object' || !isActionLegal(state, candidate)) {
      return null;
    }
    const expression = sanitizeExpression(parsed?.expression, 'smile');
    const segments = parseDialogueSegments(parsed, '这一步协议已经写入。');
    const reply = segments.map((s) => s.text).join(' / ');
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
      segments,
      expression,
      mood,
      logEntry: {
        id: `llm-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'decision',
        ok: true,
        provider: out.provider,
        model: out.model,
        durationMs: out.durationMs,
        summary: `LLM 决策执行: ${candidate.type}`,
        presetName: rt.preset.name,
        worldbookHits: composed.worldbookHits.map((h) => h.name),
        requestSections: composed.sections,
        rawPreview: out.content.slice(0, 4000),
        reasoning: out.reasoning,
      },
    };
  } catch {
    return null;
  }
}
