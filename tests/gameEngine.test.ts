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
  getHalfStackRaiseAmount,
  getNextSwapFee,
  getRemainingSuitStats,
  getVisibleBoardCard,
  getVisibleHandCard,
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

  it('supports half-stack long-press raise bypassing normal sub-phase raise cap', () => {
    let state = setupDeterministicState();
    const halfAmt = getHalfStackRaiseAmount(state, 'human');
    assert.equal(halfAmt, 495); // (1000 - 10 ante) / 2
    assert.equal(isActionLegal(state, { type: 'raise', amount: halfAmt, isHalfStack: true }), true);
    state = applyAction(state, { type: 'raise', amount: halfAmt, isHalfStack: true });
    assert.equal(state.players.human.chips, 495);
    assert.equal(state.currentTurn, 'ai');
  });

  it('enforces once-per-turn limits on hack and scan, resets on turn handoff, and seals caught skill', () => {
    let state = setupDeterministicState();
    const origRank = state.players.human.hand[0].card.rank;

    // Human hacks open card #0 (+1) without consuming turn
    state = applyAction(state, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    assert.equal(state.currentTurn, 'human');
    assert.equal(state.players.human.chips, 990 - 40);
    assert.equal(state.players.human.hand[0].card.rank, origRank + 1);
    assert.equal(getVisibleHandCard(state.players.human.hand[0], 'ai', 'human', false).rank, origRank);

    // 2nd hack in the same turn is blocked
    assert.equal(isActionLegal(state, { type: 'hack', handIndex: 0, skill: 'flip-suit' }), false);

    // Swapping tampered open card onto board preserves tamper isolation & hands turn to AI
    state = applyAction(state, { type: 'swap', handIndex: 0, boardIndex: 0 });
    assert.equal(state.currentTurn, 'ai');
    assert.equal(state.board[0].source, 'swapped-in');
    assert.equal(state.board[0].swappedBy, 'human');
    assert.equal(getVisibleBoardCard(state.board[0], 'ai', false).rank, origRank);
    assert.equal(getVisibleBoardCard(state.board[0], 'human', false).rank, origRank + 1);

    // AI scans clean human hand card #1 -> loses prepaid scanCost, turn remains AI, 2nd scan blocked same turn
    state = applyAction(state, { type: 'scan', targetKind: 'hand', targetIndex: 1 });
    assert.equal(state.currentTurn, 'ai');
    assert.equal(state.phase, 'early');
    assert.equal(state.players.ai.chips, 990 - 50);
    assert.equal(isActionLegal(state, { type: 'scan', targetKind: 'board', targetIndex: 0 }), false);

    // Advance one round of flips so AI gets a fresh turn (resetting usedScanThisTurn)
    state = applyAction(state, { type: 'flip', boardIndex: 1 }); // AI flips -> Human turn
    assert.equal(state.usedHackThisTurn, false);
    state = applyAction(state, { type: 'flip', boardIndex: 2 }); // Human flips -> AI turn
    assert.equal(state.usedScanThisTurn, false);

    // AI scans tampered board slot #0 -> AI wins round immediately & seals human's used skill across next hand!
    state = applyAction(state, { type: 'scan', targetKind: 'board', targetIndex: 0 });
    assert.equal(state.phase, 'showdown');
    assert.equal(state.result?.winner, 'ai');
    assert.equal(state.result?.reason, 'scan-caught');
    assert.equal(state.lastAction?.targetKind, 'board');
    assert.equal(state.lastAction?.targetIndex, 0);
    assert.ok(state.players.human.sealedSkills.includes('plus-one'));

    let nextHand = startNextHand(state);
    assert.ok(nextHand.players.human.sealedSkills.includes('plus-one'));
    if (nextHand.currentTurn !== 'human') {
      nextHand = applyAction(nextHand, { type: 'flip', boardIndex: 0 });
    }
    assert.equal(nextHand.currentTurn, 'human');
    assert.equal(isActionLegal(nextHand, { type: 'hack', handIndex: 0, skill: 'plus-one' }), false);
  });

  it('applies hacked board card modifications at showdown so opponent cannot score phantom original pairs', () => {
    // Reproduces exact screenshot case:
    // Human starts with A(P), 3(P), 12(P) (swaps 12(P) or 3(P) -> hacks 3(P) +1 to 4(P) and swaps onto board)
    // AI starts with 5(B), 6(B), 10(P)
    // Board ends with 9(P), 6(P), 4(P) [hacked from 3(P)], 3(B)
    const deckOverride: Card[] = [
      c(14, 'P', 0), c(3, 'P', 0), c(4, 'P', 0), // human: AP, 3P, 4P
      c(5, 'B', 0), c(6, 'B', 0), c(10, 'P', 0), // ai: 5B, 6B, 10P
      c(8, 'P', 0), c(9, 'P', 0), c(6, 'P', 0), c(3, 'B', 0), // board hidden: 8P, 9P, 6P, 3B
    ];
    let state = createInitialState({
      deckOverride,
      tieStarter: 'human',
      config: { startingChips: 1000, ante: 10 },
    });
    // Weaker initial 3-card hand (AI: 10-high vs Human: A-high) acts first
    assert.equal(state.currentTurn, 'ai');
    state = applyAction(state, { type: 'flip', boardIndex: 1 }); // AI flips 9P -> Human turn

    // Human hacks 3P -> 4P, then swaps onto board[0] (getting 8P private!)
    state = applyAction(state, { type: 'hack', handIndex: 1, skill: 'plus-one' });
    state = applyAction(state, { type: 'swap', handIndex: 1, boardIndex: 0 });
    // During active play, AI still sees original 3P on board[0]
    assert.equal(getVisibleBoardCard(state.board[0], 'ai', false).rank, 3);
    assert.equal(getVisibleBoardCard(state.board[0], 'human', false).rank, 4);

    // Flip remaining 2 board cards cleanly (AI flips 6P, Human flips 3B -> AI acts first on river)
    state = applyAction(state, { type: 'flip', boardIndex: 2 });
    state = applyAction(state, { type: 'flip', boardIndex: 3 });

    // Both check on river -> Showdown
    state = applyAction(state, { type: 'check' });
    state = applyAction(state, { type: 'check' });

    assert.equal(state.phase, 'showdown');
    // AI should have ONLY One Pair (6B + 6P), NOT Two Pair from deleted 3P!
    assert.equal(state.result?.aiEval?.categoryName, '一对');
    assert.equal(state.result?.humanEval?.categoryName, '同花');
    assert.equal(state.result?.winner, 'human');
  });

  it('blocks scan and hack while facing a raise (diff > 0) until caller matches the bet', () => {
    let state = setupDeterministicState();
    assert.equal(state.currentTurn, 'human');

    // Human raises +20 -> AI faces diff = 20
    state = applyAction(state, { type: 'raise', amount: 20 });
    assert.equal(state.currentTurn, 'ai');

    // While diff > 0, AI cannot scan or hack before calling!
    assert.equal(isActionLegal(state, { type: 'scan', targetKind: 'hand', targetIndex: 0 }), false);
    assert.equal(isActionLegal(state, { type: 'hack', handIndex: 0, skill: 'plus-one' }), false);

    // AI calls (non-consuming in pre-river) -> diff becomes 0, scan & hack unlock!
    state = applyAction(state, { type: 'call' });
    assert.equal(state.currentTurn, 'ai');
    assert.equal(isActionLegal(state, { type: 'scan', targetKind: 'hand', targetIndex: 0 }), true);
    assert.equal(isActionLegal(state, { type: 'hack', handIndex: 0, skill: 'flip-suit' }), true);
  });
});
