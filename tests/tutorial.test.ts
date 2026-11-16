import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../src/engine/gameEngine.ts';
import {
  TUTORIAL_STAGES,
  createTutorialStageState,
  getTutorialCapabilities,
  getTutorialGuidance,
  pickTutorialOpponentAction,
} from '../src/engine/tutorial.ts';

describe('tutorial: 6-stage deterministic interactive onboarding', () => {
  it('defines 6 ordered stages covering swap/flip -> raise/call -> 2-suit flush -> hack -> scan/seal -> duel', () => {
    assert.equal(TUTORIAL_STAGES.length, 6);
    assert.deepEqual(
      TUTORIAL_STAGES.map((s) => s.id),
      ['swap-flip', 'raise-call', 'two-suit-flush', 'hacker-skills', 'scan-seal', 'boss-duel']
    );
  });

  it('locks hacker & scan skills in stages 1-3, unlocks hack in stage 4, and unlocks scan in stage 5+', () => {
    assert.deepEqual(getTutorialCapabilities(0), {
      allowHack: false,
      allowScan: false,
      allowRaise: false,
    });
    assert.deepEqual(getTutorialCapabilities(1), {
      allowHack: false,
      allowScan: false,
      allowRaise: true,
    });
    assert.deepEqual(getTutorialCapabilities(2), {
      allowHack: false,
      allowScan: false,
      allowRaise: true,
    });
    assert.deepEqual(getTutorialCapabilities(3), {
      allowHack: true,
      allowScan: false,
      allowRaise: true,
    });
    assert.deepEqual(getTutorialCapabilities(4), {
      allowHack: true,
      allowScan: true,
      allowRaise: true,
    });
    assert.deepEqual(getTutorialCapabilities(5), {
      allowHack: true,
      allowScan: true,
      allowRaise: true,
    });
  });

  it('stage 1 (swap-flip) creates legal initial state and completes after human swaps and flips', () => {
    let s = createTutorialStageState(0);
    assert.equal(s.currentTurn, 'human');
    assert.equal(getTutorialGuidance(0, s, { scanMode: false, selectedHandIndex: null }).stagePassed, false);

    // Swap hand[0] with board[0]
    s = applyAction(s, { type: 'swap', handIndex: 0, boardIndex: 0 });
    assert.equal(s.players.human.swapCount, 1);
    assert.equal(s.currentTurn, 'ai');

    // Scripted tutorial opponent flips board[3]
    const aiAct = pickTutorialOpponentAction(0, s);
    assert.ok(aiAct);
    s = applyAction(s, aiAct);
    assert.equal(s.currentTurn, 'human');

    // Human flips board[1] for free -> stage 1 passed!
    s = applyAction(s, { type: 'flip', boardIndex: 1 });
    assert.equal(getTutorialGuidance(0, s, { scanMode: false, selectedHandIndex: null }).stagePassed, true);
  });

  it('stage 2 (raise-call) opens with opponent raise +20 and passes after human calls and raises back', () => {
    let s = createTutorialStageState(1);
    assert.equal(s.currentTurn, 'ai');
    const openRaise = pickTutorialOpponentAction(1, s);
    assert.deepEqual(openRaise, { type: 'raise', amount: 20 });
    s = applyAction(s, openRaise);
    assert.equal(s.currentTurn, 'human');

    // Human calls +20 (non-consuming!) and raises +20 back
    s = applyAction(s, { type: 'call' });
    assert.equal(s.currentTurn, 'human');
    assert.equal(s.justCalledThisTurn, true);

    s = applyAction(s, { type: 'raise', amount: 20 });
    assert.equal(getTutorialGuidance(1, s, { scanMode: false, selectedHandIndex: null }).stagePassed, true);
  });

  it('stage 3 (two-suit-flush) lets human swap into a 5-Pink Flush that beats opponent One Pair', () => {
    let s = createTutorialStageState(2);
    assert.equal(s.currentTurn, 'human');
    // Swap 6B (hand[2]) with board[0] (5P) -> human has QP, 9P, 5P + 7P, 8P on board = Flush!
    s = applyAction(s, { type: 'swap', handIndex: 2, boardIndex: 0 });
    while (s.phase !== 'showdown') {
      if (s.currentTurn === 'ai') {
        const aiAct = pickTutorialOpponentAction(2, s);
        assert.ok(aiAct);
        s = applyAction(s, aiAct);
      } else {
        const nextHidden = s.board.find((b) => !b.isOpen);
        s = applyAction(
          s,
          nextHidden ? { type: 'flip', boardIndex: nextHidden.index } : { type: 'check' }
        );
      }
    }
    assert.equal(s.result?.winner, 'human');
    assert.equal(s.result?.humanEval?.categoryName, '同花');
    assert.equal(getTutorialGuidance(2, s, { scanMode: false, selectedHandIndex: null }).stagePassed, true);
  });

  it('stage 4 (hacker-skills) guides human to apply plus-one hack cleanly', () => {
    let s = createTutorialStageState(3);
    assert.equal(s.currentTurn, 'human');
    s = applyAction(s, { type: 'hack', handIndex: 2, skill: 'plus-one' });
    assert.equal(s.players.human.hand[2].card.rank, 10);
    assert.equal(getTutorialGuidance(3, s, { scanMode: false, selectedHandIndex: null }).stagePassed, true);
  });

  it('stage 5 (scan-seal) scripts opponent tamper and lets human scan-catch & seal opponent skill', () => {
    let s = createTutorialStageState(4);
    assert.equal(s.currentTurn, 'ai');
    // AI scripts hidden hack on hand[0] then flips board[0]
    const hackAct = pickTutorialOpponentAction(4, s);
    assert.equal(hackAct?.type, 'hack');
    s = applyAction(s, hackAct!);
    const flipAct = pickTutorialOpponentAction(4, s);
    assert.equal(flipAct?.type, 'flip');
    s = applyAction(s, flipAct!);

    assert.equal(s.currentTurn, 'human');
    s = applyAction(s, { type: 'scan', targetKind: 'hand', targetIndex: 0 });
    assert.equal(s.phase, 'showdown');
    assert.equal(s.result?.reason, 'scan-caught');
    assert.equal(s.result?.winner, 'human');
    assert.equal(s.players.ai.sealedSkills.includes('plus-one'), true);
    assert.equal(getTutorialGuidance(4, s, { scanMode: false, selectedHandIndex: null }).stagePassed, true);
  });

  it('stage 6 (boss-duel) initializes 300-chip sparring match and passes when opponent chips reach 0', () => {
    const s = createTutorialStageState(5);
    assert.equal(s.players.human.chips, 280); // 300 - 20 ante
    assert.equal(s.players.ai.chips, 280);
    assert.equal(getTutorialGuidance(5, s, { scanMode: false, selectedHandIndex: null }).stagePassed, false);

    const wonState = {
      ...s,
      phase: 'showdown' as const,
      players: {
        ...s.players,
        ai: { ...s.players.ai, chips: 0 },
      },
      result: {
        winner: 'human' as const,
        reason: 'showdown' as const,
        potWon: 600,
        payouts: { human: 600, ai: 0 },
      },
    };
    assert.equal(
      getTutorialGuidance(5, wonState, { scanMode: false, selectedHandIndex: null }).stagePassed,
      true
    );
  });
});
