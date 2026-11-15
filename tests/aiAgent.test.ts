import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  type AiCheatProfile,
  type AiDifficulty,
  type AiPlayStyle,
  type AiStyle,
} from '../src/engine/types.ts';
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
import {
  buildPursuerDossier,
  resolvePursuerStrategyProfile,
} from '../src/engine/skillPool.ts';
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

  it('derives distinct strategy profiles from character & pursuer dossier and enforces auditor/phantom-hacker/trap behaviors', async () => {
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    const derived = resolvePursuerStrategyProfile('auto', 'auto', FALLBACK_CONTRACT_CHARACTER, dossier);
    assert.ok(['pressure', 'trap', 'sculptor', 'conservative'].includes(derived.playStyle));
    assert.ok(['auditor', 'phantom-hacker', 'opportunist', 'disruptor'].includes(derived.cheatProfile));

    // Manual override wins over auto
    const manual = resolvePursuerStrategyProfile('trap', 'auditor', FALLBACK_CONTRACT_CHARACTER, dossier);
    assert.equal(manual.playStyle, 'trap');
    assert.equal(manual.cheatProfile, 'auditor');

    // Auditor NEVER chooses hack even when an upgrade is available
    const hackSetup = createInitialState({ config: DEFAULT_CONFIG });
    hackSetup.currentTurn = 'ai';
    hackSetup.players.ai.hand = [
      { card: { id: 'a0', suit: 'B', rank: 14 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'a1', suit: 'B', rank: 13 }, visibility: 'open', lockedFromSwap: false },
      { card: { id: 'a2', suit: 'P', rank: 12 }, visibility: 'open', lockedFromSwap: false },
    ];
    hackSetup.board = [
      { index: 0, card: { id: 'b0', suit: 'B', rank: 11 }, isOpen: true, source: 'flipped' },
      { index: 1, card: { id: 'b1', suit: 'B', rank: 10 }, isOpen: true, source: 'flipped' },
      { index: 2, card: { id: 'b2', suit: 'P', rank: 2 }, isOpen: false, source: 'initial' },
      { index: 3, card: { id: 'b3', suit: 'P', rank: 3 }, isOpen: false, source: 'initial' },
    ];
    assert.equal(pickBestHackAction(hackSetup, 'ai', 'master', 'auditor'), null);

    // Phantom-hacker prefers swapping a previously tampered open card into a hidden board slot
    const phantomState = structuredClone(hackSetup);
    phantomState.players.ai.hand[2].originalCard = { id: 'a2', suit: 'P', rank: 12 };
    phantomState.players.ai.hand[2].card = { id: 'a2', suit: 'B', rank: 12 };
    phantomState.players.ai.hand[2].tamperedBy = ['flip-suit'];
    const phantomAi = new LocalAiAgent(
      'ai',
      'balanced',
      FALLBACK_CONTRACT_CHARACTER,
      () => 0.15,
      'master',
      'sculptor',
      'phantom-hacker'
    );
    const phantomDec = await phantomAi.decide(phantomState);
    assert.equal(phantomDec.action.type, 'swap');
    if (phantomDec.action.type === 'swap') {
      assert.equal(phantomDec.action.handIndex, 2);
    }

    // All 4x4 playStyle x cheatProfile combinations complete full hands legally
    const playStyles: Exclude<AiPlayStyle, 'auto'>[] = ['pressure', 'trap', 'sculptor', 'conservative'];
    const cheatProfiles: Exclude<AiCheatProfile, 'auto'>[] = ['auditor', 'phantom-hacker', 'opportunist', 'disruptor'];
    for (let i = 0; i < playStyles.length; i += 1) {
      const pStyle = playStyles[i];
      const cProf = cheatProfiles[i];
      const agents = {
        human: new LocalAiAgent('human', 'balanced', FALLBACK_CONTRACT_CHARACTER, Math.random, 'standard', 'pressure', 'opportunist'),
        ai: new LocalAiAgent('ai', 'balanced', FALLBACK_CONTRACT_CHARACTER, Math.random, 'master', pStyle, cProf),
      };
      let st = createInitialState({ config: { ...DEFAULT_CONFIG, aiDelayMs: 0 } });
      let guard = 0;
      while (st.phase !== 'showdown') {
        guard += 1;
        assert.ok(guard < 120);
        const dec = await agents[st.currentTurn].decide(st);
        assert.ok(isActionLegal(st, dec.action));
        st = applyAction(st, dec.action);
      }
      assert.equal(st.players.human.chips + st.players.ai.chips, DEFAULT_CONFIG.startingChips * 2);
    }
  });
});
