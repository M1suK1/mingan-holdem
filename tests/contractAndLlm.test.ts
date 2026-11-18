import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  FALLBACK_CONTRACT_CHARACTER,
  moodToExpression,
  parseNightSugarCard,
  resolveCharacterPortrait,
  resolveShowdownOpponentExpression,
} from '../src/engine/contractCards.ts';
import {
  DEFAULT_LLM_CONFIG,
  extractJsonPayload,
  generateLocalPersonaReply,
} from '../src/engine/llmClient.ts';
import { LocalAiAgent } from '../src/engine/aiAgent.ts';
import {
  applyAction,
  createDeck,
  createInitialState,
  getBetDiff,
  getLegalRaiseRange,
} from '../src/engine/gameEngine.ts';

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

    // Local chat replies should not trigger angry casually
    assert.notEqual(
      generateLocalPersonaReply(FALLBACK_CONTRACT_CHARACTER, state, '你是靠诱饵伪装逃跑吗？', false).expression,
      'angry'
    );
    assert.notEqual(
      generateLocalPersonaReply(FALLBACK_CONTRACT_CHARACTER, state, '怕了就投降吧', false).expression,
      'angry'
    );
  });

  it('restricts angry expression to >=300 single-round compute loss and AI re-raises', async () => {
    assert.equal(
      resolveShowdownOpponentExpression({ winner: 'ai', payouts: { human: 0, ai: 400 } }, 200),
      'smile'
    );
    assert.equal(
      resolveShowdownOpponentExpression({ winner: 'tie', payouts: { human: 200, ai: 200 } }, 200),
      'surprise'
    );
    assert.equal(
      resolveShowdownOpponentExpression({ winner: 'human', payouts: { human: 590, ai: 0 } }, 295),
      'sad'
    );
    assert.equal(
      resolveShowdownOpponentExpression({ winner: 'human', payouts: { human: 600, ai: 0 } }, 300),
      'angry'
    );

    // Verify AI re-raise emits angry while proactive actions never emit angry
    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;
    // Human: 2B, 3P, 4B (weak) vs AI: AP, AB, KP (strong) -> Human acts first cleanly when tieStarter='human'
    const fixedFront = [
      pick(2, 'B', 0),
      pick(3, 'P', 0),
      pick(4, 'B', 0),
      pick(14, 'P', 0),
      pick(14, 'B', 0),
      pick(13, 'P', 0),
    ];
    const usedIds = new Set(fixedFront.map((c) => c.id));
    const deckOverride = [...fixedFront, ...full.filter((c) => !usedIds.has(c.id))];

    let s = createInitialState({
      chips: { human: 1000, ai: 1000 },
      tieStarter: 'human',
      deckOverride,
    });
    // Proactive check: AI with diff === 0 never emits angry
    const firstTurnState = { ...s, currentTurn: 'ai' as const };
    const proactiveAi = new LocalAiAgent(
      'ai',
      'aggressive',
      FALLBACK_CONTRACT_CHARACTER,
      () => 0.2,
      'master',
      'pressure',
      'opportunist'
    );
    const proactiveDec = await proactiveAi.decide(firstTurnState);
    assert.notEqual(proactiveDec.dialogue.expression, 'angry');

    // Re-raise check: Human raises, AI facing diff > 0 counter-raises with angry
    const humanRaiseMin = getLegalRaiseRange(s, 'human', 0).min;
    s = applyAction(s, { type: 'raise', amount: humanRaiseMin });
    assert.ok(getBetDiff(s, 'ai') > 0);
    let sawReRaise = false;
    for (let k = 1; k <= 10; k += 1) {
      let prngSeed = k * 7919;
      const seededRng = () => {
        prngSeed = (Math.imul(prngSeed, 1664525) + 1013904223) >>> 0;
        return prngSeed / 4294967296;
      };
      const counterAi = new LocalAiAgent(
        'ai',
        'aggressive',
        FALLBACK_CONTRACT_CHARACTER,
        seededRng,
        'master',
        'pressure',
        'opportunist'
      );
      const reRaiseDec = await counterAi.decide(s);
      if (reRaiseDec.action.type === 'raise') {
        assert.equal(reRaiseDec.dialogue.expression, 'angry');
        sawReRaise = true;
        break;
      }
      assert.notEqual(reRaiseDec.dialogue.expression, 'angry');
    }
    assert.equal(sawReRaise, true);
  });
});
