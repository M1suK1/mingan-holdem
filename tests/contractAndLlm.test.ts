import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FALLBACK_CONTRACT_CHARACTER,
  moodToExpression,
  parseNightSugarCard,
  resolveCharacterPortrait,
} from '../src/engine/contractCards.ts';
import {
  DEFAULT_LLM_CONFIG,
  extractJsonPayload,
  generateLocalPersonaReply,
} from '../src/engine/llmClient.ts';
import { createInitialState } from '../src/engine/gameEngine.ts';

describe('contractCards: reuse night-sugar-office girl-card JSON & expressions', () => {
  it('parses real Silver Wolf & Yvonne contract cards from night-sugar-office with 6 expressions', async () => {
    const swPath = path.resolve(
      process.cwd(),
      'public/cards/夜糖事务所-契约卡-银狼.json'
    );
    const yvPath = path.resolve(
      process.cwd(),
      'public/cards/夜糖事务所-契约卡-伊冯.json'
    );

    const swRaw = await fs.readFile(swPath, 'utf8');
    const sw = parseNightSugarCard(swRaw, '夜糖事务所-契约卡-银狼.json');
    assert.equal(sw.name, '银狼');
    assert.equal(sw.codename, 'Silver Wolf');
    assert.equal(sw.title, '虚数骇入者');
    assert.ok(sw.traits.length >= 2);
    assert.ok(resolveCharacterPortrait(sw, 'smile').startsWith('data:image/'));
    assert.ok(resolveCharacterPortrait(sw, 'angry').startsWith('data:image/'));
    assert.notEqual(
      resolveCharacterPortrait(sw, 'smile'),
      resolveCharacterPortrait(sw, 'angry')
    );

    const yvRaw = await fs.readFile(yvPath, 'utf8');
    const yv = parseNightSugarCard(yvRaw, '夜糖事务所-契约卡-伊冯.json');
    assert.equal(yv.name, '伊冯');
    assert.ok(yv.voice && yv.voice.samples.length > 0);
    assert.equal(moodToExpression('confident'), 'smile');
    assert.equal(moodToExpression('surprised'), 'surprise');
  });
});

describe('llmClient: JSON extraction & persona-driven chat reply', () => {
  it('extracts structured JSON from fenced or noisy LLM text', () => {
    const parsed = extractJsonPayload('```json\n{"reply":"看穿你的伪装了。","expression":"smile"}\n```');
    assert.equal(parsed?.reply, '看穿你的伪装了。');
    assert.equal(parsed?.expression, 'smile');
  });

  it('generates character-authentic local chat replies using contract card persona & game state', () => {
    const state = createInitialState();
    const res = generateLocalPersonaReply(
      FALLBACK_CONTRACT_CHARACTER,
      state,
      '你手里的牌到底是什么？',
      false
    );
    assert.ok(res.reply.length > 4);
    assert.ok(['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'].includes(res.expression));
    assert.equal(DEFAULT_LLM_CONFIG.enabled, false);
  });
});
