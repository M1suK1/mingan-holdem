import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEC00_MONOLOGUE_STEPS,
  createSec00TutorialState,
  getSec00Capabilities,
  getSec00Guidance,
  isSec00ActionAllowed,
  pickSec00AiAction,
} from '../src/engine/sec00Tutorial.ts';
import { applyAction, getVisiblePlayerChips } from '../src/engine/gameEngine.ts';
import { evaluateSevenCards } from '../src/engine/evaluator.ts';

describe('sec00Tutorial: 女主 ECHO-0 单轮连贯剧情教学全流程', () => {
  it('provides 4 intro player monologue steps covering rules, 2-suit probabilities, and hand rankings', () => {
    assert.equal(SEC00_MONOLOGUE_STEPS.length, 4);
    const allText = SEC00_MONOLOGUE_STEPS.map((s) => `${s.title} ${s.text}`).join(' ');
    assert.ok(allText.includes('算力'));
    assert.ok(allText.includes('暗牌'));
    assert.ok(allText.includes('两对') && allText.includes('同花'));
  });

  it('completes all 6 teaching steps inside ONE single continuous hand and reduces ECHO-0 chips to 0', () => {
    let state = createSec00TutorialState();
    assert.equal(state.handNumber, 1);
    assert.equal(state.currentTurn, 'human');
    assert.equal(state.players.ai.chips + state.players.ai.totalCommitted, 110);

    // Step 1: Swap 2B (hand[2]) with board[0] (5P)
    let caps = getSec00Capabilities(state);
    assert.equal(caps.allowHack, false);
    assert.equal(caps.allowScan, false);
    assert.equal(isSec00ActionAllowed(state, { type: 'fold' }), false);
    assert.equal(
      isSec00ActionAllowed(state, { type: 'swap', handIndex: 2, boardIndex: 0 }),
      true
    );
    state = applyAction(state, { type: 'swap', handIndex: 2, boardIndex: 0 });
    assert.equal(state.currentTurn, 'ai');

    // AI Turn 1: raise +20
    const ai1 = pickSec00AiAction(state);
    assert.deepEqual(ai1, { type: 'raise', amount: 20 });
    state = applyAction(state, ai1!);
    assert.equal(state.currentTurn, 'human');

    // Step 2a: Call 20 (does NOT end turn)
    let g = getSec00Guidance(state, { selectedHandIndex: null, scanMode: false, showRaiseTiers: false });
    assert.ok(g.focusIds.includes('lc-action-btn-call'));
    assert.equal(isSec00ActionAllowed(state, { type: 'call' }), true);
    state = applyAction(state, { type: 'call' });
    assert.equal(state.currentTurn, 'human');

    // Step 2b: Flip board[1] (7P)
    g = getSec00Guidance(state, { selectedHandIndex: null, scanMode: false, showRaiseTiers: false });
    assert.ok(g.focusIds.includes('board-node-card-1'));
    assert.equal(isSec00ActionAllowed(state, { type: 'flip', boardIndex: 1 }), true);
    state = applyAction(state, { type: 'flip', boardIndex: 1 });
    assert.equal(state.currentTurn, 'ai');

    // AI Turn 2: Flip board[2] (14P) -> Human now has 5-Pink Flush!
    const ai2 = pickSec00AiAction(state);
    assert.deepEqual(ai2, { type: 'flip', boardIndex: 2 });
    state = applyAction(state, ai2!);
    assert.equal(state.currentTurn, 'human');

    const fiveKnown = [
      ...state.players.human.hand.map((h) => h.card),
      state.board[1].card,
      state.board[2].card,
    ];
    assert.equal(evaluateSevenCards(fiveKnown).categoryKey, 'flush');

    // Step 3: Raise +40 with Flush
    g = getSec00Guidance(state, { selectedHandIndex: null, scanMode: false, showRaiseTiers: true });
    assert.ok(g.focusIds.includes('raise-tier-btn-2'));
    assert.equal(isSec00ActionAllowed(state, { type: 'raise', amount: 40 }), true);
    assert.equal(isSec00ActionAllowed(state, { type: 'raise', amount: 10 }), false);
    state = applyAction(state, { type: 'raise', amount: 40 });
    assert.equal(state.currentTurn, 'ai');

    // AI Turn 3: Call 40 -> Hack +1 on hand[0] (prepaying last 40, hidden!) -> End Turn
    const ai3a = pickSec00AiAction(state);
    assert.deepEqual(ai3a, { type: 'call' });
    state = applyAction(state, ai3a!);

    const ai3b = pickSec00AiAction(state);
    assert.deepEqual(ai3b, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    state = applyAction(state, ai3b!);
    // Hidden escrow hides the prepaid 40 from human viewer!
    assert.equal(getVisiblePlayerChips(state, 'ai', 'human'), 40);

    const ai3c = pickSec00AiAction(state);
    assert.deepEqual(ai3c, { type: 'end-turn' });
    state = applyAction(state, ai3c!);
    assert.equal(state.currentTurn, 'human');

    // Step 4: Human unlocks hack and applies +1 on hand[0] (non-consuming!)
    caps = getSec00Capabilities(state);
    assert.equal(caps.allowHack, true);
    assert.equal(caps.allowScan, false);
    g = getSec00Guidance(state, { selectedHandIndex: 0, scanMode: false, showRaiseTiers: false });
    assert.ok(g.focusIds.includes('hack-btn-plus-one'));
    assert.equal(
      isSec00ActionAllowed(state, { type: 'hack', handIndex: 0, skill: 'plus-one' }),
      true
    );
    state = applyAction(state, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    assert.equal(state.currentTurn, 'human');

    // Step 5: Scan AI hand[0] -> caught in the SAME single hand -> AI chips = 0!
    caps = getSec00Capabilities(state);
    assert.equal(caps.allowScan, true);
    g = getSec00Guidance(state, { selectedHandIndex: null, scanMode: true, showRaiseTiers: false });
    assert.ok(g.focusIds.includes('opponent-hand-card-0'));
    assert.equal(
      isSec00ActionAllowed(state, { type: 'scan', targetKind: 'hand', targetIndex: 0 }),
      true
    );
    state = applyAction(state, { type: 'scan', targetKind: 'hand', targetIndex: 0 });

    assert.equal(state.handNumber, 1);
    assert.equal(state.phase, 'showdown');
    assert.equal(state.result?.reason, 'scan-caught');
    assert.equal(state.result?.winner, 'human');
    assert.equal(state.players.ai.chips, 0);
  });
});
