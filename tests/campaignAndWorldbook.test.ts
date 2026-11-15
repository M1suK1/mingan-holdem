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
  vertexTarget,
} from '../src/engine/vertexClient.ts';
import { createInitialState } from '../src/engine/gameEngine.ts';
import { DEFAULT_CONFIG } from '../src/engine/types.ts';
import { serializeStateForLlm } from '../src/engine/llmClient.ts';

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
    assert.ok(express.url.startsWith('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=AIza123'));
    assert.equal(normalizeVertexModel('google/gemini-2.5-pro'), 'gemini-2.5-pro');
  });
});
