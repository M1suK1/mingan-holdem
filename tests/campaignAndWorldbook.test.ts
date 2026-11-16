import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialCampaign,
  getActiveDisguiseEntity,
  selectMatchDisguise,
  resolveMatchVictory,
  claimVictoryLoot,
  resolveMatchDefeat,
} from '../src/engine/campaign.ts';
import {
  SKILL_POOL_REGISTRY,
  buildPursuerDossier,
  pickLootSkillChoices,
} from '../src/engine/skillPool.ts';
import {
  FALLBACK_CONTRACT_CHARACTER,
  resolveVirtualEntityPortrait,
  resolveRealityPortrait,
} from '../src/engine/contractCards.ts';
import {
  builtinWorldbook,
  worldbookContext,
  syncDynamicWorldbookEntries,
  importWorldbookJson,
  exportWorldbookJson,
} from '../src/engine/worldbook.ts';
import {
  builtinPresets,
  composePresetPrompt,
  exportPresetJson,
  importPresetJson,
} from '../src/engine/presets.ts';
import {
  describeVertexCredential,
  normalizeVertexModel,
  parseVertexServiceAccount,
  thinkingConfigOf,
  vertexChat,
  vertexTarget,
} from '../src/engine/vertexClient.ts';
import {
  generateLocalPersonaReply,
  parseDialogueSegments,
  requestEncounterDialogue,
  requestLlmPokerDecision,
  sanitizeExpression,
  serializeStateForLlm,
} from '../src/engine/llmClient.ts';
import { applyAction, createInitialState, getEffectiveHackCost, getEffectiveScanCost, getNextSwapFee, isActionLegal, startNextHand } from '../src/engine/gameEngine.ts';
import { DEFAULT_CONFIG } from '../src/engine/types.ts';

describe('Campaign: virtual entities, disguise decoy escape, skill loot & failure ending', () => {
  it('initializes player core virtual entity with zero captured decoys and no failure ending', () => {
    const camp = createInitialCampaign('ZERO-BYTE');
    assert.equal(camp.coreEntity.isCore, true);
    assert.equal(camp.activeDisguiseId, camp.coreEntity.id);
    assert.equal(camp.capturedEntities.length, 0);
    assert.equal(camp.status, 'active');
    assert.equal(getActiveDisguiseEntity(camp).isCore, true);
  });

  it('seizes opponent virtual entity and lets player pick 1 skill from pursuer skill pool on victory', () => {
    const camp0 = createInitialCampaign('ZERO-BYTE');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    assert.ok(dossier.skillPoolIds.length >= 2);

    const campLoot = resolveMatchVictory(camp0, FALLBACK_CONTRACT_CHARACTER, dossier);
    assert.equal(campLoot.status, 'loot-select');
    assert.ok(campLoot.pendingLoot);
    assert.equal(campLoot.pendingLoot.seizedEntity.isCore, false);
    assert.ok(campLoot.pendingLoot.skillChoices.length >= 1);

    const chosenSkill = campLoot.pendingLoot.skillChoices[0];
    const campAfter = claimVictoryLoot(campLoot, chosenSkill);
    assert.equal(campAfter.capturedEntities.length, 1);
    assert.deepEqual(campAfter.acquiredSkills, [chosenSkill]);
    assert.equal(campAfter.wantedLevel, camp0.wantedLevel + 1);
    assert.equal(campAfter.status, 'disguise-select');
  });

  it('consumes active captured disguise entity as decoy to escape defeat while keeping skills', () => {
    const camp0 = createInitialCampaign('ZERO-BYTE');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    const campLoot = resolveMatchVictory(camp0, FALLBACK_CONTRACT_CHARACTER, dossier);
    const chosenSkill = campLoot.pendingLoot!.skillChoices[0];
    const campWithDecoy = claimVictoryLoot(campLoot, chosenSkill);

    const decoyId = campWithDecoy.capturedEntities[0].id;
    const campDisguised = selectMatchDisguise(campWithDecoy, decoyId);
    assert.equal(campDisguised.status, 'active');
    assert.equal(getActiveDisguiseEntity(campDisguised).id, decoyId);
    assert.equal(getActiveDisguiseEntity(campDisguised).isCore, false);

    const campEscaped = resolveMatchDefeat(campDisguised, '凯伊', '星穹财团安全官');
    assert.equal(campEscaped.status, 'escaped');
    assert.equal(campEscaped.capturedEntities.length, 0);
    assert.equal(campEscaped.activeDisguiseId, campEscaped.coreEntity.id);
    assert.deepEqual(campEscaped.acquiredSkills, [chosenSkill]);
    assert.ok(campEscaped.lastEscapeLog);
  });

  it('triggers failed-ending when player loses while wearing their core virtual entity', () => {
    const camp0 = createInitialCampaign('ZERO-BYTE');
    const campFailed = resolveMatchDefeat(camp0, '银狼', '黑域仲裁裁决官');
    assert.equal(campFailed.status, 'failed-ending');
    assert.ok(campFailed.failureEnding);
    assert.equal(campFailed.failureEnding.takenByName, '银狼');
  });

  it('exposes extensible skill pool registry and prefers unowned skills when building loot choices', () => {
    assert.ok(SKILL_POOL_REGISTRY.length >= 6);
    const choices = pickLootSkillChoices(['ghost-packet', 'parity-spoof', 'ice-firewall'], ['ghost-packet'], 3);
    assert.ok(!choices.includes('ghost-packet'));
    assert.ok(choices.includes('parity-spoof'));
  });
});

describe('Contract portraits: reality outfit vs witchForm virtual entity', () => {
  it('resolves witchForm portrait for virtual entity and custom portrait for reality', () => {
    const charWithBoth = {
      ...FALLBACK_CONTRACT_CHARACTER,
      portrait: 'data:image/webp;base64,REALITY_PORTRAIT',
      witchPortrait: 'data:image/webp;base64,WITCH_PORTRAIT',
      variants: {
        'custom:calm': 'data:image/webp;base64,REALITY_CALM',
        'witchform:calm': 'data:image/webp;base64,WITCH_CALM',
      },
    };
    assert.equal(resolveVirtualEntityPortrait(charWithBoth, 'calm'), 'data:image/webp;base64,WITCH_CALM');
    assert.equal(resolveRealityPortrait(charWithBoth, 'calm'), 'data:image/webp;base64,REALITY_CALM');
  });
});

describe('Worldbook & Editable Presets (night-sugar-office pattern)', () => {
  it('injects constant worldbook entries and keyword-matched entries within budget', () => {
    const entries = builtinWorldbook();
    const resNoKey = worldbookContext('普通加注跟注', entries, 4000);
    assert.ok(resNoKey.hits.some((h) => h.reason === 'constant'));

    const resWithKey = worldbookContext('我想使用诱饵伪装进入虚拟实体对战并掠夺技能池', entries, 4000);
    assert.ok(resWithKey.hits.some((h) => h.reason === 'key'));
    assert.ok(resWithKey.text.includes('诱饵') || resWithKey.text.includes('技能'));
  });

  it('syncs dynamic campaign & pursuer entries without erasing custom user entries', () => {
    const base = builtinWorldbook();
    const customEntry = {
      id: 'user-custom-1',
      name: '用户自建暗号',
      keys: ['暗门'],
      content: '地下节点的秘密接头暗号。',
      enabled: true,
      constant: false,
      priority: 75,
      order: 20,
    };
    const camp = createInitialCampaign('TEST-RUNNER');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 2);
    const synced = syncDynamicWorldbookEntries([...base, customEntry], camp, FALLBACK_CONTRACT_CHARACTER, dossier);
    assert.ok(synced.some((e) => e.id === 'user-custom-1'));
    const playerEntry = synced.find((e) => e.id === 'wb-dynamic-hacker');
    assert.ok(playerEntry?.content.includes('TEST-RUNNER'));
    const pursuerEntry = synced.find((e) => e.id === 'wb-dynamic-pursuer');
    assert.ok(pursuerEntry?.content.includes(dossier.identityTitle));
  });

  it('round-trips worldbook JSON export/import cleanly', () => {
    const exported = exportWorldbookJson(builtinWorldbook());
    const imported = importWorldbookJson(exported);
    assert.equal(imported.ok, true);
    assert.ok((imported.entries?.length ?? 0) >= 4);
  });

  it('composes preset prompt with macros, worldbook injection, and locked contract at the end', () => {
    const presets = builtinPresets();
    const preset = presets[0];
    const camp = createInitialCampaign('GHOST-7');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    const wb = syncDynamicWorldbookEntries(builtinWorldbook(), camp, FALLBACK_CONTRACT_CHARACTER, dossier);
    const composed = composePresetPrompt({
      preset,
      scope: 'chat',
      worldbook: wb,
      character: FALLBACK_CONTRACT_CHARACTER,
      dossier,
      campaign: camp,
      triggerText: '黑域协议 诱饵 技能池',
      tableSummary: '[测试牌桌状态]',
      taskContext: '回复玩家挑衅',
    });

    assert.ok(composed.system.includes(FALLBACK_CONTRACT_CHARACTER.name));
    assert.ok(composed.system.includes('[测试牌桌状态]'));
    assert.ok(composed.worldbookHits.length >= 1);
    const contractPos = composed.system.lastIndexOf('JSON');
    assert.ok(contractPos > composed.system.length * 0.4);
  });

  it('round-trips SillyTavern-compatible preset JSON export/import', () => {
    const preset = builtinPresets()[0];
    const json = exportPresetJson(preset);
    const res = importPresetJson(json);
    assert.equal(res.ok, true);
    assert.ok(res.preset);
    assert.ok((res.preset?.prompts?.length ?? 0) >= 3);
  });

  it('never leaks human private cards or unrevealed tampered originals to LLM serialization', () => {
    const state = createInitialState({ config: DEFAULT_CONFIG, opponentName: '银狼' });
    state.players.ai.hand = [
      { card: { id: 'ai-0', suit: 'P', rank: 4 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'ai-1', suit: 'P', rank: 5 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'ai-2', suit: 'P', rank: 6 }, visibility: 'open', lockedFromSwap: false },
    ];
    state.board.forEach((b, i) => {
      b.isOpen = i === 0;
      b.card = { id: `b-${i}`, suit: 'P', rank: (7 + i) as 7 | 8 | 9 | 10 };
    });
    state.players.human.hand[0].visibility = 'private';
    state.players.human.hand[0].card = { id: 'secret-p-14', suit: 'P', rank: 14 };
    state.players.human.hand[1].visibility = 'open';
    state.players.human.hand[1].originalCard = { id: 'orig-b-2', suit: 'B', rank: 2 };
    state.players.human.hand[1].card = { id: 'hacked-b-3', suit: 'B', rank: 3 };
    state.players.human.hand[2].visibility = 'open';
    state.players.human.hand[2].card = { id: 'open-p-11', suit: 'P', rank: 11 };

    const text = serializeStateForLlm(state);
    assert.ok(!text.includes('粉A'));
    assert.ok(!text.includes('黑3'));
    assert.ok(text.includes('黑2'));
  });

  it('preserves pastHands summaries across startNextHand and injects chat history + past round facts into LLM prompt without leaking hidden human hacks', () => {
    let h1 = createInitialState({ config: DEFAULT_CONFIG, opponentName: '银狼' });
    h1.currentTurn = 'human';
    h1.players.human.hand[0].visibility = 'open';
    h1.players.human.hand[0].card = { id: 'h-test', suit: 'B', rank: 5 };
    h1 = applyAction(h1, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    h1 = applyAction(h1, { type: 'raise', amount: 20 });
    h1 = applyAction(h1, { type: 'fold' }); // AI folds -> reason fold -> human hack NOT exposed

    const h2 = startNextHand(h1);
    assert.equal(h2.pastHands.length, 1);
    assert.equal(h2.pastHands[0].handNumber, 1);
    assert.equal(h2.pastHands[0].winner, 'human');
    assert.equal(h2.pastHands[0].committedByHuman, 70); // ante 10 + hack 40 + raise 20
    assert.equal(h2.pastHands[0].humanHadTamper, false); // fold does not expose hidden hack

    const llmText = serializeStateForLlm(h2);
    assert.ok(llmText.includes('前几轮交锋战绩'));
    assert.ok(llmText.includes('第#1局'));
    assert.ok(llmText.includes('玩家累计投入70'));
    assert.ok(!llmText.includes('终端篡改'));

    const preset = builtinPresets()[0];
    const camp = createInitialCampaign('GHOST-7');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    const wb = syncDynamicWorldbookEntries(builtinWorldbook(), camp, FALLBACK_CONTRACT_CHARACTER, dossier);
    const composed = composePresetPrompt({
      preset,
      scope: 'decision',
      worldbook: wb,
      character: FALLBACK_CONTRACT_CHARACTER,
      dossier,
      campaign: camp,
      triggerText: '聊天记录',
      tableSummary: llmText,
      taskContext: '决定下一步操作',
      historyMessages: [
        { role: 'user', content: '上一轮我故意诱你弃牌的。' },
        { role: 'assistant', content: '银狼 [发言]：哼，别得意太早。' },
      ],
    });
    assert.ok(composed.system.includes('上一轮我故意诱你弃牌的'));
    assert.ok(composed.system.includes('第#1局'));
  });
});

describe('Google Vertex AI credential & endpoint helpers', () => {
  it('parses service account JSON, detects express key, and builds regional vs global targets', () => {
    const fakeSa = JSON.stringify({
      project_id: 'demo-proj-123',
      client_email: 'runner@demo-proj-123.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
    });
    const sa = parseVertexServiceAccount(fakeSa);
    assert.ok(sa);
    assert.equal(sa.projectId, 'demo-proj-123');
    assert.equal(describeVertexCredential(fakeSa).kind, 'service-account');
    assert.equal(describeVertexCredential('AIzaSyFakeExpressKey123').kind, 'express-key');

    const regional = vertexTarget({ model: 'publishers/google/models/gemini-2.5-pro', location: 'us-central1' }, sa);
    assert.equal(
      regional.url,
      'https://us-central1-aiplatform.googleapis.com/v1/projects/demo-proj-123/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent'
    );

    const express = vertexTarget({ model: 'gemini-2.5-flash', expressKey: 'AIza123' });
    assert.equal(express.url.startsWith('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=AIza123'), true);
    assert.equal(normalizeVertexModel('google/gemini-2.5-pro'), 'gemini-2.5-pro');
  });

  it('leaves thinking budget uncapped (0 or 65536) and falls back to non-thinking when Vertex hits MAX_TOKENS with empty text', async () => {
    const presets = builtinPresets();
    assert.ok(presets[0].settings.maxTokens === 0 || presets[0].settings.maxTokens >= 8000);

    const origFetch = globalThis.fetch;
    let callIdx = 0;
    let firstMaxOutput = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      callIdx += 1;
      const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
      if (callIdx === 1) {
        firstMaxOutput = bodyObj.generationConfig?.maxOutputTokens ?? 0;
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }] }, finishReason: 'MAX_TOKENS' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"segments":[{"kind":"speech","text":"已恢复"}],"expression":"calm"}' }] }, finishReason: 'STOP' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const res = await vertexChat(
        { model: 'gemini-2.5-flash', secret: 'AIzaTestKey123' },
        [{ role: 'user', content: 'hi' }],
        { maxTokens: 0, thinking: true }
      );
      assert.equal(firstMaxOutput, 65536);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.ok(res.text.includes('已恢复'));
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('Dialogue segments (1-3 items, <=200 chars, thought + speech)', () => {
  it('parses up to 3 dialogue segments with speech/thought kinds and 200-char limit', () => {
    const longTxt = '字'.repeat(240);
    const raw = JSON.stringify({
      segments: [
        { kind: 'thought', text: '他突然全下难道手里真有同花？' },
        { kind: 'speech', text: longTxt },
        { kind: 'thought', text: '先试探一下他的呼吸频段。' },
        { kind: 'speech', text: '第四句应被截断丢弃' },
      ],
      expression: 'surprise',
    });
    const parsed = parseDialogueSegments(JSON.parse(raw), '兜底台词');
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].kind, 'thought');
    assert.equal(parsed[1].kind, 'speech');
    assert.equal(parsed[1].text.length, 200);
    assert.equal(parsed[2].kind, 'thought');
  });

  it('supports multi-segment local persona reply with inner thought', () => {
    const state = createInitialState();
    const res = generateLocalPersonaReply(FALLBACK_CONTRACT_CHARACTER, state, '你暗牌是什么', false);
    assert.ok(res.segments.length >= 1 && res.segments.length <= 3);
    assert.ok(res.segments.every((s) => s.text.length <= 200));
  });
});

describe('Protocol Skill Pool mechanics (passive & active skills)', () => {
  it('defines 12 implemented skills in SKILL_POOL_REGISTRY', () => {
    assert.equal(SKILL_POOL_REGISTRY.length, 12);
    assert.ok(SKILL_POOL_REGISTRY.every((s) => s.implemented === true));
  });

  it('applies passive fee reductions for mirror-checksum, entropy-shield, and trace-scramble', () => {
    const base = createInitialState();
    const buffed = createInitialState({
      playerAcquiredSkills: ['mirror-checksum', 'entropy-shield', 'trace-scramble'],
    });
    assert.equal(getEffectiveScanCost(buffed, 'human'), getEffectiveScanCost(base, 'human') - 15);
    assert.equal(getNextSwapFee(buffed, 'human'), Math.max(10, getNextSwapFee(base, 'human') - 10));
    assert.equal(
      getEffectiveHackCost(buffed, 'human', 'plus-one'),
      getEffectiveHackCost(base, 'human', 'plus-one') - 15
    );
  });

  it('executes ghost-packet shield to block one opponent scan catch, and enforces once-per-hand active skill limit', () => {
    let state = createInitialState({
      playerAcquiredSkills: ['ghost-packet', 'zero-day-peek'],
    });
    state.currentTurn = 'human';
    state.players.human.hand[0].visibility = 'open';
    state.players.human.hand[0].card = { id: 'h-open', suit: 'B', rank: 6 };

    // Use ghost-packet + hack on human hand[0]
    state = applyAction(state, { type: 'use-skill', skillId: 'ghost-packet' });
    assert.equal(state.players.human.ghostShield, true);
    assert.equal(state.usedProtocolSkillThisHand, true);

    // Second active protocol skill in the same hand is illegal
    assert.equal(isActionLegal(state, { type: 'use-skill', skillId: 'zero-day-peek', targetIndex: 1 }), false);

    state = applyAction(state, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    // Hand turn to AI and scan human hand[0] -> ghostShield absorbs the catch!
    state.currentTurn = 'ai';
    state.players.ai.roundBet = state.players.human.roundBet;
    state = applyAction(state, { type: 'scan', targetKind: 'hand', targetIndex: 0 });
    assert.notEqual(state.phase, 'showdown');
    assert.equal(state.players.human.ghostShield, false);
    assert.equal(state.lastAction?.caught, false);
  });
});

describe('Thinking effort tuning & round-settled LLM感想', () => {
  it('maps thinkingEffort levels (off/low/medium/high/unlimited) to Vertex thinkingConfig accurately', () => {
    assert.equal(thinkingConfigOf('plain', 'off'), undefined);
    assert.deepEqual(thinkingConfigOf('level', 'low'), { includeThoughts: true, thinkingLevel: 'low' });
    assert.deepEqual(thinkingConfigOf('budget', 'medium'), { includeThoughts: true, thinkingBudget: 4096 });
    assert.deepEqual(thinkingConfigOf('budget', 'unlimited'), { includeThoughts: true, thinkingBudget: -1 });
  });

  it('supports round-settled encounter reflection with ShowdownResult details and fastDecisionMode context compaction', async () => {
    const camp = createInitialCampaign('GHOST-7');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    const state = createInitialState({ config: DEFAULT_CONFIG, opponentName: FALLBACK_CONTRACT_CHARACTER.name });
    state.phase = 'showdown';
    state.result = {
      winner: 'human',
      reason: 'showdown',
      potWon: 240,
      payouts: { human: 240, ai: 0 },
    };

    const res = await requestEncounterDialogue({
      eventKind: 'round-settled',
      character: FALLBACK_CONTRACT_CHARACTER,
      state,
      llmConfig: {
        enabled: false,
        drivePokerActions: false,
        provider: 'openai',
        endpoint: '',
        apiKey: '',
        authMode: 'bearer',
        model: 'deepseek-chat',
        temperature: 0.75,
        thinkingEffort: 'medium',
        decisionThinkingEffort: 'low',
        fastDecisionMode: true,
        overloadPersona: true,
        customSystemPrompt: '',
      },
      campaign: camp,
      dossier,
      roundResultSummary: '第#1局摊牌：玩家以[两对]击败银狼[一对]，赢得奖池 240',
    });
    assert.ok(res.segments.length >= 1);
    assert.ok(res.reply.length > 0);

    const preset = builtinPresets()[0];
    const wb = syncDynamicWorldbookEntries(builtinWorldbook(), camp, FALLBACK_CONTRACT_CHARACTER, dossier);
    const fullComposed = composePresetPrompt({
      preset,
      scope: 'decision',
      worldbook: wb,
      character: FALLBACK_CONTRACT_CHARACTER,
      dossier,
      campaign: camp,
      triggerText: '黑域协议 虚拟实体',
      tableSummary: '[牌桌]',
      taskContext: '选动作',
      compactMode: false,
    });
    const fastComposed = composePresetPrompt({
      preset,
      scope: 'decision',
      worldbook: wb,
      character: FALLBACK_CONTRACT_CHARACTER,
      dossier,
      campaign: camp,
      triggerText: '黑域协议 虚拟实体',
      tableSummary: '[牌桌]',
      taskContext: '选动作',
      compactMode: true,
    });
    assert.ok(fastComposed.system.length < fullComposed.system.length);
    assert.ok(fastComposed.system.includes('黑客作弊'));
    assert.ok(fastComposed.system.includes('协议扫描'));
  });

  it('includes expression switching guidance in contracts and normalizes expression aliases', () => {
    const preset = builtinPresets()[0];
    const chatContract = preset.prompts.find((p) => p.id === 'contract-chat');
    assert.ok(chatContract?.content.includes('立绘神态'));
    assert.equal(sanitizeExpression('Surprised'), 'surprise');
    assert.equal(sanitizeExpression('confident'), 'smile');
    assert.equal(sanitizeExpression('nervous'), 'shy');
    assert.equal(sanitizeExpression('anger'), 'angry');
  });

  it('bundles player pre-typed speech into a single requestLlmPokerDecision call when handoff occurs', async () => {
    const state = createInitialState({ config: DEFAULT_CONFIG, opponentName: FALLBACK_CONTRACT_CHARACTER.name });
    state.currentTurn = 'ai';
    const camp = createInitialCampaign('GHOST-7');
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);

    let capturedBody = '';
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      fetchCalls += 1;
      capturedBody = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: { type: 'flip', boardIndex: 0 },
                  segments: [
                    { kind: 'thought', text: '他想靠话术干扰我，先翻牌试探。' },
                    { kind: 'speech', text: '少拿诱饵挑衅我，看看这张公共牌再说！' },
                  ],
                  expression: 'angry',
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const res = await requestLlmPokerDecision({
        character: FALLBACK_CONTRACT_CHARACTER,
        state,
        llmConfig: {
          enabled: true,
          drivePokerActions: true,
          provider: 'openai',
          endpoint: 'https://example.invalid/v1',
          apiKey: 'test',
          authMode: 'bearer',
          model: 'deepseek-chat',
          temperature: 0.7,
          fastDecisionMode: false,
          overloadPersona: true,
          customSystemPrompt: '',
        },
        campaign: camp,
        dossier,
        bundledUserText: '我有诱饵伪装，你抓不到我本体！',
      });
      assert.equal(fetchCalls, 1);
      assert.ok(res);
      assert.equal(res.action.type, 'flip');
      assert.equal(res.expression, 'angry');
      assert.equal(res.segments.length, 2);
      assert.ok(capturedBody.includes('我有诱饵伪装，你抓不到我本体！'));
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
