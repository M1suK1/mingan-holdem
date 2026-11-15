import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, formatCardShort } from '../src/engine/gameEngine.ts';
import { DEFAULT_CONFIG, type GameState, type PlayerId } from '../src/engine/types.ts';
import {
  buildLlmSkillTelemetry,
  enumerateLlmActionSpace,
} from '../src/engine/llmActionSpace.ts';
import {
  DEFAULT_LLM_CONFIG,
  normalizeLlmConfig,
  requestLlmPokerDecision,
  serializeStateForLlm,
} from '../src/engine/llmClient.ts';
import {
  DEFAULT_PROMPTS,
  activePrompts,
  builtinPresets,
  exportPresetJson,
  importPresetJson,
  renderPresetSystem,
  samplingPayload,
} from '../src/engine/llmPreset.ts';
import {
  builtinWorldbook,
  exportWorldbookJson,
  importWorldbookJson,
  roleWorldbookEntry,
  worldbookContext,
} from '../src/engine/worldbook.ts';
import { resolveMacros } from '../src/engine/promptMacros.ts';
import { composeOpponentPrompt } from '../src/engine/llmPrompt.ts';
import { FALLBACK_CONTRACT_CHARACTER } from '../src/engine/contractCards.ts';

/** 把行动权强制交给 AI，避免测试依赖发牌随机先手 */
function aiToAct(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialState({ config: DEFAULT_CONFIG });
  return { ...base, currentTurn: 'ai' as PlayerId, ...overrides };
}

const originalFetch = globalThis.fetch;

function stubFetch(replies: string[]): { calls: number } {
  const counter = { calls: 0 };
  globalThis.fetch = (async () => {
    const content = replies[Math.min(counter.calls, replies.length - 1)] ?? '';
    counter.calls += 1;
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;
  return counter;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('llmActionSpace: 合法动作空间由引擎谓词推导', () => {
  it('差额为零时同时给出黑客技能与扫描目标', () => {
    const state = aiToAct();
    const space = enumerateLlmActionSpace(state);
    assert.equal(space.mustCallFirst, false);
    assert.ok(space.options.some((o) => o.action.type === 'hack'), '应包含黑客技能');
    assert.ok(space.options.some((o) => o.action.type === 'scan'), '应包含扫描');
    assert.ok(space.options.some((o) => o.action.type === 'flip'), '应包含翻牌');
    // 每个样例都能被 JSON.parse 回原动作，模型才可能逐字照抄
    for (const option of space.options) {
      assert.deepEqual(JSON.parse(option.example), option.action);
    }
  });

  it('关闭 useHackerSkills 后不再出现篡改与扫描', () => {
    const space = enumerateLlmActionSpace(aiToAct(), { useHackerSkills: false });
    assert.equal(space.options.some((o) => o.action.type === 'hack'), false);
    assert.equal(space.options.some((o) => o.action.type === 'scan'), false);
    assert.ok(space.notes.some((note) => note.includes('禁用')));
  });

  it('每回合一次的限额与封印会裁剪掉对应动作', () => {
    const used = enumerateLlmActionSpace(aiToAct({ usedHackThisTurn: true, usedScanThisTurn: true }));
    assert.equal(used.options.some((o) => o.action.type === 'hack'), false);
    assert.equal(used.options.some((o) => o.action.type === 'scan'), false);

    const base = aiToAct();
    const sealed: GameState = {
      ...base,
      players: {
        ...base.players,
        ai: { ...base.players.ai, sealedSkills: ['plus-one', 'minus-one', 'flip-suit'] },
      },
    };
    const sealedSpace = enumerateLlmActionSpace(sealed);
    assert.equal(sealedSpace.options.some((o) => o.action.type === 'hack'), false);
    assert.ok(sealedSpace.notes.some((note) => note.includes('封印')));
  });

  it('差额未补齐时只给跟注/弃牌/加注，并提示必须先跟注', () => {
    const base = aiToAct();
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        human: { ...base.players.human, roundBet: base.players.ai.roundBet + 40, chips: base.players.human.chips - 40 },
      },
    };
    const space = enumerateLlmActionSpace(state);
    assert.equal(space.mustCallFirst, true);
    assert.ok(space.options.some((o) => o.action.type === 'call'));
    assert.ok(space.options.some((o) => o.action.type === 'fold'));
    assert.equal(space.options.some((o) => o.action.type === 'hack'), false);
    assert.equal(space.options.some((o) => o.action.type === 'scan'), false);
    assert.ok(space.notes.some((note) => note.includes('补齐')));
  });

  it('扫描只指向对手手牌与对手换入的公共槽', () => {
    const state = aiToAct();
    const telemetry = buildLlmSkillTelemetry(state, 'ai');
    assert.deepEqual(telemetry.scanHandTargets, state.players.human.hand.map((_, i) => i));
    assert.deepEqual(telemetry.scanBoardTargets, []);
  });
});

describe('llmClient: 观察块不泄露私有牌面与托管数额', () => {
  it('对手私有手牌只报「未知加密暗牌」，预支托管只报存在不报数额', () => {
    const base = aiToAct();
    const secretCard = { id: 'secret', suit: 'B' as const, rank: 14 as const };
    const state: GameState = {
      ...base,
      hackEscrowPot: 313,
      players: {
        ...base.players,
        human: {
          ...base.players.human,
          hand: [{ card: secretCard, visibility: 'private', lockedFromSwap: false }, base.players.human.hand[1]],
        },
      },
    };
    const text = serializeStateForLlm(state);
    assert.equal(text.includes(formatCardShort(secretCard)), false, '不得出现私有牌面');
    assert.ok(text.includes('未知加密暗牌'));
    assert.equal(text.includes('313'), false, '不得暴露托管数额');
    assert.ok(text.includes('未公开的预支托管'));
  });
});

describe('llmPreset / worldbook: 可编辑预设与世界书注入', () => {
  it('出厂预设带完整采样参数与契约词条', () => {
    const presets = builtinPresets();
    assert.ok(presets.length >= 3);
    const preset = presets[0];
    assert.equal(preset.prompts.some((entry) => entry.contract), true);
    const sampling = samplingPayload(preset);
    assert.ok(sampling.temperature > 0 && sampling.temperature <= 1.5);
    assert.ok(sampling.max_tokens >= 64);
  });

  it('按场景裁剪词条并始终保留共用词条', () => {
    const preset = builtinPresets()[0];
    const decision = activePrompts(preset, 'decision');
    const chat = activePrompts(preset, 'chat');
    assert.ok(decision.every((entry) => entry.scope === 'shared' || entry.scope === 'decision'));
    assert.ok(chat.some((entry) => entry.scope === 'chat'));
    assert.equal(chat.some((entry) => entry.scope === 'decision'), false);
  });

  it('渲染时契约排在最后，世界书与宏都被展开', () => {
    const preset = builtinPresets()[0];
    const entries = activePrompts(preset, 'decision');
    const result = renderPresetSystem(entries, {
      character: FALLBACK_CONTRACT_CHARACTER,
      state: aiToAct(),
      worldbook: '### 换牌协议\n换牌要付手续费。',
    });
    assert.ok(result.system.includes('换牌要付手续费'));
    assert.ok(result.system.includes(FALLBACK_CONTRACT_CHARACTER.name));
    const contract = preset.prompts.find((entry) => entry.contract);
    assert.ok(contract);
    assert.ok(result.system.trimEnd().endsWith(contract!.content.trim()), '契约必须是最后一段');
    assert.deepEqual(result.missing, []);
  });

  it('未识别的宏原样保留并被记录', () => {
    const result = resolveMacros('你好 {{char}}，{{unknown_macro}}', {
      character: FALLBACK_CONTRACT_CHARACTER,
    });
    assert.ok(result.text.includes(FALLBACK_CONTRACT_CHARACTER.name));
    assert.ok(result.text.includes('{{unknown_macro}}'));
    assert.deepEqual(result.missing, ['unknown_macro']);
  });

  it('世界书常驻词条必进，关键词命中才进，预算不足时丢弃', () => {
    const entries = builtinWorldbook(FALLBACK_CONTRACT_CHARACTER);
    const hits = worldbookContext('我们换个牌吧，手续费怎么算', entries);
    assert.ok(hits.hits.some((hit) => hit.reason === 'constant'));
    assert.ok(hits.hits.some((hit) => hit.reason === 'key'));

    const miss = worldbookContext('今天天气不错', entries);
    assert.equal(miss.hits.every((hit) => hit.reason === 'constant'), true);

    const tiny = worldbookContext('换牌', entries, 40);
    assert.ok(tiny.dropped > 0);
    assert.ok(tiny.chars <= 40);
  });

  it('契约角色词条由当前卡自动生成且只读', () => {
    const entry = roleWorldbookEntry(FALLBACK_CONTRACT_CHARACTER);
    assert.equal(entry.generated, true);
    assert.ok(entry.content.includes(FALLBACK_CONTRACT_CHARACTER.name));
  });

  it('预设与世界书都能导出后原样导入', () => {
    const preset = builtinPresets()[0];
    const presetRound = importPresetJson(exportPresetJson(preset));
    assert.equal(presetRound.ok, true);
    assert.equal(presetRound.preset?.prompts.length, preset.prompts.length);

    const entries = builtinWorldbook(FALLBACK_CONTRACT_CHARACTER);
    const wbRound = importWorldbookJson(exportWorldbookJson(entries));
    assert.equal(wbRound.ok, true);
    assert.equal(wbRound.entries?.length, entries.length);
  });
});

describe('llmPrompt: 编排结果可直接作为 system prompt', () => {
  it('决策场景同时包含规则、角色、世界书与合法动作宏', () => {
    const state = aiToAct();
    const space = enumerateLlmActionSpace(state);
    const composed = composeOpponentPrompt({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      config: { ...DEFAULT_LLM_CONFIG, worldbookEnabled: true },
      scope: 'decision',
      legalActions: space.options,
      presetId: 'preset-default',
    });
    assert.ok(composed.system.includes('四条'));
    assert.ok(composed.system.includes(FALLBACK_CONTRACT_CHARACTER.name));
    assert.ok(composed.worldbook.hits.length > 0);
    assert.ok(composed.system.includes('只从【合法动作清单】里挑一个动作'));
    assert.equal(composed.missing.length, 0);

    const withMacro = renderPresetSystem(
      [
        {
          id: 'macro-probe',
          name: '动作宏探针',
          role: 'system',
          enabled: true,
          scope: 'decision',
          content: '可执行动作：{{legal_actions}}',
        },
      ],
      { character: FALLBACK_CONTRACT_CHARACTER, state, legalActions: space.options.map((o) => o.example) }
    );
    assert.ok(withMacro.system.includes(space.options[0].example));
  });

  it('关闭世界书后不再注入命中块', () => {
    const state = aiToAct();
    const composed = composeOpponentPrompt({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      config: { ...DEFAULT_LLM_CONFIG, worldbookEnabled: false },
      scope: 'chat',
    });
    assert.equal(composed.worldbook.hits.length, 0);
    assert.equal(composed.system.includes('### 黑域协议'), false);
  });
});

describe('llmClient: 决策请求的纠错重试与回退', () => {
  it('首次返回非法动作时带纠正重试，第二次拿到合法动作', async () => {
    const state = aiToAct();
    const legal = enumerateLlmActionSpace(state).options[0];
    const counter = stubFetch([
      '{"action":{"type":"teleport"},"reply":"我先走了"}',
      `{"action":${legal.example},"reply":"这步我接了。","expression":"smile"}`,
    ]);
    const result = await requestLlmPokerDecision({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      llmConfig: { ...DEFAULT_LLM_CONFIG, enabled: true, drivePokerActions: true, maxRetries: 1 },
    });
    assert.ok(result);
    assert.equal(counter.calls, 2);
    assert.equal(result?.ok, true);
    assert.equal(result?.attempts, 2);
    assert.deepEqual(result?.action, legal.action);
    assert.equal(result?.logEntry.ok, true);
    assert.ok(result?.logEntry.summary.includes('决策'));
  });

  it('连续非法动作时回退并留下失败审计日志', async () => {
    const state = aiToAct();
    stubFetch(['{"action":{"type":"raise","amount":999999}}']);
    const result = await requestLlmPokerDecision({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      llmConfig: { ...DEFAULT_LLM_CONFIG, enabled: true, drivePokerActions: true, maxRetries: 1 },
    });
    assert.ok(result);
    assert.equal(result?.action, null);
    assert.equal(result?.ok, false);
    assert.equal(result?.logEntry.ok, false);
    assert.ok(result?.logEntry.summary.includes('回退本地策略核'));
  });

  it('未启用或未开启接管时直接返回 null，交给本地策略核', async () => {
    const state = aiToAct();
    const disabled = await requestLlmPokerDecision({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      llmConfig: DEFAULT_LLM_CONFIG,
    });
    assert.equal(disabled, null);

    const notDriving = await requestLlmPokerDecision({
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      llmConfig: { ...DEFAULT_LLM_CONFIG, enabled: true, drivePokerActions: false },
    });
    assert.equal(notDriving, null);
  });

  it('配置规范化补齐新字段并夹紧越界值', () => {
    const normalized = normalizeLlmConfig({
      enabled: true,
      temperature: 9,
      maxRetries: 99,
      requestTimeoutMs: 1,
      presetId: '',
    });
    assert.equal(normalized.temperature, 1.3);
    assert.equal(normalized.maxRetries, 3);
    assert.equal(normalized.requestTimeoutMs, 4000);
    assert.equal(normalized.presetId, 'preset-default');
    assert.equal(normalized.worldbookEnabled, true);
    assert.equal(DEFAULT_PROMPTS.length > 0, true);
  });
});
