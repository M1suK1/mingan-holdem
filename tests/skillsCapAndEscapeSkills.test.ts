import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CHEAT_SKILLS,
  MAX_CHEAT_SKILLS,
  MAX_EXTRA_SKILLS,
  MAX_SUPPORT_SKILLS,
  SKILL_POOL_REGISTRY,
  equipExtraSkill,
  equipGroupedSkill,
  getSkillById,
  getSkillGroup,
  needsGroupedSkillReplacement,
  needsSkillReplacement,
} from '../src/engine/skillPool.ts';
import { claimVictoryLoot, createInitialCampaign, resolveMatchVictory } from '../src/engine/campaign.ts';
import { buildPursuerDossier } from '../src/engine/skillPool.ts';
import { FALLBACK_CONTRACT_CHARACTER } from '../src/engine/contractCards.ts';
import { applyAction, createInitialState, isActionLegal, startNextHand } from '../src/engine/gameEngine.ts';
import {
  ESCAPE_ROUTE_NODES,
  claimEscapeNodeSkill,
  createInitialEscapeProgress,
} from '../src/engine/escapeMap.ts';
import { parseDebugCommand } from '../src/engine/debugCmd.ts';

describe('skillsCapAndEscapeSkills: 3槽上限替换与逃亡章节专属技能', () => {
  it('enforces MAX_EXTRA_SKILLS = 3 and supports explicit slot replacement without duplicates', () => {
    assert.equal(MAX_EXTRA_SKILLS, 3);

    let skills: string[] = [];
    skills = equipExtraSkill(skills, 'ghost-packet');
    skills = equipExtraSkill(skills, 'zero-day-peek');
    skills = equipExtraSkill(skills, 'ice-firewall');
    assert.deepEqual(skills, ['ghost-packet', 'zero-day-peek', 'ice-firewall']);

    // Re-equipping an already owned skill does not trigger replacement
    assert.equal(needsSkillReplacement(skills, 'ghost-packet'), false);
    assert.deepEqual(equipExtraSkill(skills, 'ghost-packet'), skills);

    // 4th distinct skill requires replacement
    assert.equal(needsSkillReplacement(skills, 'siphon-cache'), true);
    const replaced = equipExtraSkill(skills, 'siphon-cache', 1);
    assert.deepEqual(replaced, ['ghost-packet', 'siphon-cache', 'ice-firewall']);
    assert.equal(replaced.length, 3);
  });

  it('enforces 3-slot cap in campaign claimVictoryLoot with replaceSlotIndex', () => {
    let camp = createInitialCampaign('TEST');
    camp.acquiredSkills = ['ghost-packet', 'zero-day-peek', 'ice-firewall'];
    const dossier = buildPursuerDossier(FALLBACK_CONTRACT_CHARACTER, 1);
    camp = resolveMatchVictory(camp, FALLBACK_CONTRACT_CHARACTER, dossier);

    const updated = claimVictoryLoot(camp, 'overclock-bluff', 0);
    assert.equal(updated.acquiredSkills.length, 3);
    assert.equal(updated.acquiredSkills[0], 'overclock-bluff');
  });

  it('registers siphon-cache and cold-freq-lock in SKILL_POOL_REGISTRY and binds escape node skills', () => {
    assert.ok(SKILL_POOL_REGISTRY.length >= 11);
    assert.equal(getSkillById('siphon-cache')?.implemented, true);
    assert.equal(getSkillById('cold-freq-lock')?.implemented, true);

    assert.equal(ESCAPE_ROUTE_NODES[1].signatureSkillId, 'siphon-cache');
    assert.equal(ESCAPE_ROUTE_NODES[2].signatureSkillId, 'cold-freq-lock');
    assert.equal(ESCAPE_ROUTE_NODES[3].signatureSkillId, 'pink-mirage');
    assert.equal(ESCAPE_ROUTE_NODES[4].signatureSkillId, 'gate-minefield');
  });

  it('executes siphon-cache on raise while strictly conserving total match chips', () => {
    const state = createInitialState({
      chips: { human: 500, ai: 500 },
      opponentSignatureSkill: 'siphon-cache',
      tieStarter: 'ai',
    });
    // Force AI turn so AI can raise and siphon 25 chips from human
    const aiTurnState = { ...state, currentTurn: 'ai' as const };
    const totalBefore =
      aiTurnState.players.human.chips +
      aiTurnState.players.ai.chips +
      aiTurnState.pot +
      aiTurnState.hackEscrowPot;

    const afterRaise = applyAction(aiTurnState, { type: 'raise', amount: 20 });
    const totalAfter =
      afterRaise.players.human.chips +
      afterRaise.players.ai.chips +
      afterRaise.pot +
      afterRaise.hackEscrowPot;

    assert.equal(totalAfter, totalBefore);
    assert.equal(afterRaise.players.human.chips, aiTurnState.players.human.chips - 25);
    assert.equal(afterRaise.players.ai.chips, aiTurnState.players.ai.chips - 20 + 25);

    // Human equipping siphon-cache also triggers on first raise and conserves total chips
    const humanSiphonState = {
      ...createInitialState({
        chips: { human: 500, ai: 500 },
        playerAcquiredSkills: ['siphon-cache'],
      }),
      currentTurn: 'human' as const,
    };
    const afterHumanRaise = applyAction(humanSiphonState, { type: 'raise', amount: 20 });
    assert.equal(afterHumanRaise.players.ai.chips, humanSiphonState.players.ai.chips - 20);
    assert.equal(afterHumanRaise.players.human.chips, humanSiphonState.players.human.chips - 20 + 20);
  });

  it('enforces cold-freq-lock to block locked basic hack skill for the hand and clears on next hand', () => {
    const state = createInitialState({
      opponentSignatureSkill: 'cold-freq-lock',
      rng: () => 0,
    });
    const locked = state.lockedHumanHackSkill;
    assert.ok(locked === 'plus-one' || locked === 'minus-one' || locked === 'flip-suit');

    const humanTurnState = { ...state, currentTurn: 'human' as const };
    // Ensure rank allows testing the locked skill cleanly
    humanTurnState.players.human.hand[0] = {
      ...humanTurnState.players.human.hand[0],
      card: { id: '7B-0', suit: 'B', rank: 7, copy: 0 },
      visibility: 'open',
    };
    assert.equal(
      isActionLegal(humanTurnState, { type: 'hack', handIndex: 0, skill: locked! }),
      false
    );

    // Also test player using active cold-freq-lock against AI
    const activeState = {
      ...createInitialState({ playerAcquiredSkills: ['cold-freq-lock'] }),
      currentTurn: 'human' as const,
    };
    assert.equal(
      isActionLegal(activeState, { type: 'use-skill', skillId: 'cold-freq-lock' }),
      true
    );
    const afterLock = applyAction(activeState, { type: 'use-skill', skillId: 'cold-freq-lock' });
    assert.ok(afterLock.lockedAiHackSkill);

    const nextHand = startNextHand({ ...afterLock, phase: 'showdown', result: {
      winner: 'human',
      reason: 'fold',
      potWon: 20,
      payouts: { human: 1010, ai: 990 },
    }});
    assert.equal(nextHand.lockedAiHackSkill, undefined);
  });

  it('masks AI first swap/flip details under phantom-shroud while keeping state intact', () => {
    const base = createInitialState({
      opponentSignatureSkill: 'phantom-shroud',
    });
    const aiTurn = { ...base, currentTurn: 'ai' as const };
    const afterFlip = applyAction(aiTurn, { type: 'flip', boardIndex: 0 });
    assert.equal(afterFlip.board[0].isOpen, true);
    assert.ok(afterFlip.lastAction?.label.includes('伪影迷雾'));
    assert.equal(afterFlip.shroudUsedThisHand, true);
  });

  it('triggers gate-minefield trap (1 random slot) deducting 100 compute while conserving chips', () => {
    const autoBase = createInitialState({
      opponentSignatureSkill: 'gate-minefield',
    });
    assert.equal(autoBase.trappedBoardIndices?.length, 1);

    const base = createInitialState({
      chips: { human: 500, ai: 500 },
      opponentSignatureSkill: 'gate-minefield',
      trappedBoardIndices: [1],
    });
    const humanTurn = { ...base, currentTurn: 'human' as const };
    const beforeHumanChips = humanTurn.players.human.chips;
    const beforeAiChips = humanTurn.players.ai.chips;
    const afterTrap = applyAction(humanTurn, { type: 'flip', boardIndex: 1 });

    assert.notEqual(afterTrap.phase, 'showdown');
    assert.equal(afterTrap.players.human.chips, beforeHumanChips - 100);
    assert.equal(afterTrap.players.ai.chips, beforeAiChips + 100);
    assert.equal(afterTrap.triggeredTrapIndex, 1);
    assert.equal(afterTrap.confirmedTrapIndices?.includes(1), true);
    assert.ok(afterTrap.lastAction?.label.includes('灼心·火符'));
  });

  it('parses debug skill and clearskills commands cleanly', () => {
    assert.deepEqual(parseDebugCommand('skill siphon-cache'), {
      ok: true,
      cmd: 'skill',
      skillId: 'siphon-cache',
    });
    assert.deepEqual(parseDebugCommand('clearskills'), { ok: true, cmd: 'clearskills' });
  });

  it('classifies cheat skills (+1/-1/flip-suit/crown-ace/parity-spoof) vs support skills (siphon-cache/ghost-packet) with independent 3-slot caps', () => {
    assert.equal(MAX_CHEAT_SKILLS, 3);
    assert.equal(MAX_SUPPORT_SKILLS, 3);
    assert.deepEqual(DEFAULT_CHEAT_SKILLS, ['plus-one', 'minus-one', 'flip-suit']);

    assert.equal(getSkillGroup('plus-one'), 'cheat');
    assert.equal(getSkillGroup('minus-one'), 'cheat');
    assert.equal(getSkillGroup('flip-suit'), 'cheat');
    assert.equal(getSkillGroup('crown-ace'), 'cheat');
    assert.equal(getSkillGroup('parity-spoof'), 'cheat');

    assert.equal(getSkillGroup('siphon-cache'), 'support');
    assert.equal(getSkillGroup('ghost-packet'), 'support');
    assert.equal(getSkillGroup('cold-freq-lock'), 'support');
    assert.equal(getSkillGroup('trace-scramble'), 'support');

    // Equipping support skills fills support pool without disturbing 3 cheat slots
    let cheat = [...DEFAULT_CHEAT_SKILLS];
    let support: string[] = [];
    assert.equal(needsGroupedSkillReplacement(cheat, support, 'ghost-packet'), false);
    ({ cheat, support } = equipGroupedSkill(cheat, support, 'ghost-packet'));
    ({ cheat, support } = equipGroupedSkill(cheat, support, 'siphon-cache'));
    ({ cheat, support } = equipGroupedSkill(cheat, support, 'zero-day-peek'));
    assert.deepEqual(cheat, DEFAULT_CHEAT_SKILLS);
    assert.deepEqual(support, ['ghost-packet', 'siphon-cache', 'zero-day-peek']);

    // 4th support skill triggers replacement in support pool ONLY
    assert.equal(needsGroupedSkillReplacement(cheat, support, 'ice-firewall'), true);
    ({ cheat, support } = equipGroupedSkill(cheat, support, 'ice-firewall', 1));
    assert.deepEqual(support, ['ghost-packet', 'ice-firewall', 'zero-day-peek']);
    assert.deepEqual(cheat, DEFAULT_CHEAT_SKILLS);

    // Acquiring a new cheat skill (crown-ace) triggers replacement in cheat pool ONLY
    assert.equal(needsGroupedSkillReplacement(cheat, support, 'crown-ace'), true);
    ({ cheat, support } = equipGroupedSkill(cheat, support, 'crown-ace', 1));
    assert.deepEqual(cheat, ['plus-one', 'crown-ace', 'flip-suit']);
    assert.deepEqual(support, ['ghost-packet', 'ice-firewall', 'zero-day-peek']);
  });

  it('persists separate cheat and support 3-slot pools in EscapeMapProgress and blocks replaced cheat skill in gameEngine', () => {
    let esc = createInitialEscapeProgress();
    assert.deepEqual(esc.equippedCheatSkills, ['plus-one', 'minus-one', 'flip-suit']);
    assert.deepEqual(esc.equippedSkills, []);

    esc = claimEscapeNodeSkill(esc, 'siphon-cache');
    assert.deepEqual(esc.equippedSkills, ['siphon-cache']);
    assert.deepEqual(esc.equippedCheatSkills, ['plus-one', 'minus-one', 'flip-suit']);

    // Replace minus-one (slot 1) with crown-ace
    esc = claimEscapeNodeSkill(esc, 'crown-ace', 1);
    assert.deepEqual(esc.equippedCheatSkills, ['plus-one', 'crown-ace', 'flip-suit']);
    assert.deepEqual(esc.equippedSkills, ['siphon-cache']);

    const state = createInitialState({
      chips: { human: 600, ai: 600 },
      playerCheatSkills: esc.equippedCheatSkills,
      playerAcquiredSkills: esc.equippedSkills,
    });
    const humanTurn = { ...state, currentTurn: 'human' as const };
    // Replaced minus-one is no longer usable, while crown-ace IS usable!
    assert.equal(isActionLegal(humanTurn, { type: 'hack', handIndex: 0, skill: 'minus-one' }), false);
    if (humanTurn.players.human.hand[0].card.rank < 14) {
      assert.equal(isActionLegal(humanTurn, { type: 'hack', handIndex: 0, skill: 'crown-ace' }), true);
    }
  });
});
