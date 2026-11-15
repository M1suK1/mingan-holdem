import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, type AiDifficulty, type AiStyle } from '../src/engine/types.ts';
import {
  applyAction,
  createInitialState,
  isActionLegal,
  startNextHand,
} from '../src/engine/gameEngine.ts';
import {
  LocalAiAgent,
  pickBestHackAction,
  resolveEffectiveAiDifficulty,
} from '../src/engine/aiAgent.ts';
import { FALLBACK_CONTRACT_CHARACTER } from '../src/engine/contractCards.ts';

describe('aiAgent: legality and full-hand self-play', () => {
  it('always produces legal actions across styles and completes 12 full hands without deadlock', async () => {
    const styles: AiStyle[] = ['balanced', 'aggressive', 'cautious'];
    const agents = {
      human: new LocalAiAgent('human', 'balanced'),
      ai: new LocalAiAgent('ai', 'aggressive'),
    };

    for (const style of styles) {
      agents.ai = new LocalAiAgent('ai', style);
      let state = createInitialState({
        config: { ...DEFAULT_CONFIG, aiStyle: style, aiDelayMs: 0 },
      });

      for (let h = 0; h < 4; h++) {
        let guard = 0;
        while (state.phase !== 'showdown') {
          guard++;
          assert.ok(guard < 120, `Hand exceeded 120 plies in style=${style}`);
          const actor = state.currentTurn;
          const decision = await agents[actor].decide(state);
          assert.ok(
            isActionLegal(state, decision.action),
            `Illegal AI action ${JSON.stringify(decision.action)} in phase ${state.phase}`
          );
          assert.ok(decision.dialogue.text.length > 0);
          state = applyAction(state, decision.action);
        }

        assert.equal(
          state.players.human.chips + state.players.ai.chips,
          DEFAULT_CONFIG.startingChips * 2
        );

        if (state.players.human.chips > 0 && state.players.ai.chips > 0) {
          state = startNextHand(state);
        } else {
          break;
        }
      }
    }
  });

  it('resolves auto difficulty from threat level and completes legal self-play across rookie/standard/master', async () => {
    assert.equal(resolveEffectiveAiDifficulty('auto', 1), 'rookie');
    assert.equal(resolveEffectiveAiDifficulty('auto', 2), 'standard');
    assert.equal(resolveEffectiveAiDifficulty('auto', 3), 'master');
    assert.equal(resolveEffectiveAiDifficulty('master', 1), 'master');
    assert.equal(resolveEffectiveAiDifficulty('rookie', 5), 'rookie');

    const tiers: Exclude<AiDifficulty, 'auto'>[] = ['rookie', 'standard', 'master'];
    for (const diffTier of tiers) {
      const agents = {
        human: new LocalAiAgent('human', 'balanced', FALLBACK_CONTRACT_CHARACTER, Math.random, diffTier),
        ai: new LocalAiAgent('ai', 'balanced', FALLBACK_CONTRACT_CHARACTER, Math.random, diffTier),
      };
      let state = createInitialState({ config: { ...DEFAULT_CONFIG, aiDelayMs: 0 } });
      for (let h = 0; h < 3; h += 1) {
        let guard = 0;
        while (state.phase !== 'showdown') {
          guard += 1;
          assert.ok(guard < 120, `Exceeded 120 plies on tier=${diffTier}`);
          const actor = state.currentTurn;
          const decision = await agents[actor].decide(state);
          assert.ok(isActionLegal(state, decision.action));
          state = applyAction(state, decision.action);
        }
        assert.equal(state.players.human.chips + state.players.ai.chips, DEFAULT_CONFIG.startingChips * 2);
        if (state.players.human.chips > 0 && state.players.ai.chips > 0) {
          state = startNextHand(state);
        } else {
          break;
        }
      }
    }
  });

  it('picks an upgrading hack action in master mode and never reads hidden human private cards', async () => {
    const stateA = createInitialState({ config: DEFAULT_CONFIG });
    stateA.currentTurn = 'ai';
    stateA.players.ai.hand = [
      { card: { id: 'a0', suit: 'B', rank: 14 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'a1', suit: 'B', rank: 13 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'a2', suit: 'P', rank: 12 }, visibility: 'open', lockedFromSwap: false },
    ];
    stateA.board = [
      { index: 0, card: { id: 'b0', suit: 'B', rank: 11 }, isOpen: true, source: 'flipped' },
      { index: 1, card: { id: 'b1', suit: 'B', rank: 10 }, isOpen: true, source: 'flipped' },
      { index: 2, card: { id: 'b2', suit: 'P', rank: 2 }, isOpen: false, source: 'initial' },
      { index: 3, card: { id: 'b3', suit: 'P', rank: 3 }, isOpen: false, source: 'initial' },
    ];

    // Turning Q(P) into Q(B) via flip-suit completes a 5-card Straight Flush (10-J-Q-K-A Black)!
    const bestHack = pickBestHackAction(stateA, 'ai', 'master');
    assert.ok(bestHack);
    assert.equal(bestHack.type, 'hack');
    if (bestHack.type === 'hack') {
      assert.equal(bestHack.handIndex, 2);
      assert.equal(bestHack.skill, 'flip-suit');
    }

    // Non-omniscience check: changing human private card must not alter deterministic master AI decision
    stateA.players.human.hand[0] = {
      card: { id: 'h0-priv', suit: 'P', rank: 14 },
      visibility: 'private',
      lockedFromSwap: true,
    };
    const stateB = structuredClone(stateA);
    stateB.players.human.hand[0].card = { id: 'h0-priv-alt', suit: 'B', rank: 2 };

    const detRngA = () => 0.42;
    const detRngB = () => 0.42;
    const aiA = new LocalAiAgent('ai', 'balanced', FALLBACK_CONTRACT_CHARACTER, detRngA, 'master');
    const aiB = new LocalAiAgent('ai', 'balanced', FALLBACK_CONTRACT_CHARACTER, detRngB, 'master');
    const decA = await aiA.decide(stateA);
    const decB = await aiB.decide(stateB);
    assert.deepEqual(decA.action, decB.action);
  });
});
