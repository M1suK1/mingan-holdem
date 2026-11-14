import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  type Card,
  type GameConfig,
  type GameState,
  type Rank,
  type Suit,
} from '../src/engine/types.ts';
import {
  createDeck,
  createInitialState,
  applyAction,
  computeBattleSituation,
  computeThreeRaisePresets,
  getCurrentRaiseCap,
  getNextSwapFee,
  getRemainingSuitStats,
  isActionLegal,
  startNextHand,
} from '../src/engine/gameEngine.ts';

function c(rank: Rank, suit: Suit, copy: 0 | 1 = 0): Card {
  return { id: `${rank}${suit}-${copy}`, rank, suit, copy };
}

function makeFixedDeck(): Card[] {
  const priority: Card[] = [
    c(2, 'B', 0), c(7, 'P', 0), c(9, 'B', 0),
    c(14, 'B', 0), c(14, 'P', 0), c(4, 'B', 0),
    c(13, 'P', 0), c(12, 'P', 0), c(11, 'B', 0), c(10, 'P', 0),
  ];
  const used = new Set(priority.map((x) => x.id));
  const rest = createDeck().filter((card) => !used.has(card.id));
  return [...priority, ...rest];
}

function setupDeterministicState(overrides: Partial<GameConfig> = {}): GameState {
  return createInitialState({
    config: { ...DEFAULT_CONFIG, ...overrides },
    deckOverride: makeFixedDeck(),
  });
}

describe('gameEngine: 2-suit 52-card cyber deck & suit telemetry', () => {
  it('builds a 52-card deck with exactly 26 Black (B) and 26 Pink (P) cards', () => {
    const deck = createDeck();
    assert.equal(deck.length, 52);
    assert.equal(deck.filter((x) => x.suit === 'B').length, 26);
    assert.equal(deck.filter((x) => x.suit === 'P').length, 26);
    const uniqueIds = new Set(deck.map((x) => x.id));
    assert.equal(uniqueIds.size, 52);
  });

  it('tracks remaining Black/Pink suit probabilities from viewer perspective', () => {
    const state = setupDeterministicState();
    // Human sees own 3 cards (2B, 7P, 9B) + AI's 3 open cards (14B, 14P, 4B) = 4B + 2P known
    const stats = getRemainingSuitStats(state, 'human');
    assert.equal(stats.totalUnknown, 46);
    assert.equal(stats.blackLeft, 22);
    assert.equal(stats.pinkLeft, 24);
  });
});

describe('gameEngine: dynamic battleground situation', () => {
  it('transitions situation from recon -> intrusion -> overclock -> victory/disconnect', () => {
    let state = setupDeterministicState();
    assert.equal(computeBattleSituation(state), 'recon');

    state = applyAction(state, { type: 'flip', boardIndex: 0 });
    state = applyAction(state, { type: 'flip', boardIndex: 1 });
    assert.equal(computeBattleSituation(state), 'intrusion');

    state = applyAction(state, { type: 'flip', boardIndex: 2 });
    state = applyAction(state, { type: 'flip', boardIndex: 3 });
    assert.equal(state.phase, 'river');
    assert.equal(computeBattleSituation(state), 'overclock');

    state = applyAction(state, { type: 'check' });
    state = applyAction(state, { type: 'check' });
    const endSit = computeBattleSituation(state);
    assert.ok(endSit === 'victory' || endSit === 'disconnect');
  });
});

describe('gameEngine: non-consuming call & core holdem rules', () => {
  it('keeps currentTurn on caller after calling in pre-river so they can swap/flip/raise/end-turn', () => {
    let state = setupDeterministicState();
    assert.equal(isActionLegal(state, { type: 'end-turn' }), false);

    state = applyAction(state, { type: 'raise', amount: 20 });
    assert.equal(state.currentTurn, 'ai');

    state = applyAction(state, { type: 'call' });
    assert.equal(state.currentTurn, 'ai');
    assert.equal(state.justCalledThisTurn, true);
    assert.equal(state.pot, 60);
    assert.equal(isActionLegal(state, { type: 'end-turn' }), true);

    state = applyAction(state, { type: 'swap', handIndex: 0, boardIndex: 0 });
    assert.equal(state.justCalledThisTurn, false);
    assert.equal(state.currentTurn, 'human');
    assert.equal(state.raisesInSubPhase, 0);
  });

  it('enforces raise caps (20/40/100), swap fee isolation & lock, river turn order, and All-In reveal', () => {
    let state = setupDeterministicState();
    assert.equal(getCurrentRaiseCap(state), 20);
    assert.equal(getNextSwapFee(state, 'human'), 20);

    state = applyAction(state, { type: 'swap', handIndex: 0, boardIndex: 0 });
    assert.equal(state.pot, 40);
    assert.equal(state.players.human.hand[0].lockedFromSwap, true);

    // AI flips 1, Human flips 2, AI flips 3 -> Human gets first turn on river
    state = applyAction(state, { type: 'flip', boardIndex: 1 });
    assert.equal(getCurrentRaiseCap(state), 40);
    state = applyAction(state, { type: 'flip', boardIndex: 2 });
    state = applyAction(state, { type: 'flip', boardIndex: 3 });
    assert.equal(state.phase, 'river');
    assert.equal(state.currentTurn, 'human');
    assert.equal(getCurrentRaiseCap(state), 100);

    state = applyAction(state, { type: 'raise', amount: 50 });
    state = applyAction(state, { type: 'fold' });
    assert.equal(state.result?.winner, 'human');

    const next = startNextHand(state);
    assert.equal(next.handNumber, 2);
    assert.equal(next.players.human.chips + next.players.ai.chips + next.pot, 2000);
  });

  it('auto-reveals board and settles on All-In call', () => {
    let state = setupDeterministicState({ startingChips: 25, ante: 10 });
    state = applyAction(state, { type: 'raise', amount: 15 });
    assert.equal(computeBattleSituation(state), 'breach');
    state = applyAction(state, { type: 'call' });
    assert.equal(state.phase, 'showdown');
    assert.ok(state.board.every((b) => b.isOpen));
  });

  it('computes up to 3 clean deduplicated integer raise presets without slider', () => {
    assert.deepEqual(computeThreeRaisePresets(10, 20), [10, 15, 20]);
    assert.deepEqual(computeThreeRaisePresets(10, 40), [10, 25, 40]);
    assert.deepEqual(computeThreeRaisePresets(10, 100), [10, 50, 100]);
    assert.deepEqual(computeThreeRaisePresets(10, 10), [10]);
    assert.deepEqual(computeThreeRaisePresets(8, 12), [8, 10, 12]);
  });
});
