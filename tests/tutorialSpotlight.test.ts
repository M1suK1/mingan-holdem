import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTutorialSpotlightPlan,
  clampSpotlightRect,
} from '../src/engine/tutorialSpotlight.ts';
import {
  createSec00TutorialState,
  getSec00Guidance,
  pickSec00AiAction,
} from '../src/engine/sec00Tutorial.ts';
import { applyAction } from '../src/engine/gameEngine.ts';

describe('tutorialSpotlight: 教程四周压暗聚光计划解析', () => {
  it('disables spotlight when outside arena, modal is open, or SEC-00 tutorial is inactive', () => {
    const state = createSec00TutorialState();
    const sec00Guidance = getSec00Guidance(state, {
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
    });

    const offEscapeMap = resolveTutorialSpotlightPlan({
      viewMode: 'escape-map',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: 0,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(offEscapeMap.active, false);
    assert.equal(offEscapeMap.mode, 'off');

    const offModal = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: true,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: 0,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(offModal.active, false);

    const offIdle = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: false,
      sec00IntroIndex: null,
      sec00Guidance: null,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(offIdle.active, false);
  });

  it('guides player across monologue 1/4 ~ 4/4 with top bar, monologue card, and linked table zones', () => {
    const state = createSec00TutorialState();
    const sec00Guidance = getSec00Guidance(state, {
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
    });

    const step0 = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: 0,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(step0.active, true);
    assert.equal(step0.mode, 'sec00-monologue');
    const step0Ids = step0.targets.map((t) => t.id);
    assert.ok(step0Ids.includes('lc-tutorial-guide-bar'));
    assert.ok(step0Ids.includes('sec00-monologue-card'));
    assert.ok(step0Ids.includes('lc-opponent-zone'));
    assert.ok((step0.mobileFallbackTargets ?? []).some((t) => t.id === 'sec00-bar-open-chat'));

    const step1 = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: 1,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    const step1Ids = step1.targets.map((t) => t.id);
    assert.ok(step1Ids.includes('lc-board-zone'));
    assert.ok(step1Ids.includes('lc-player-hand-zone'));

    const step3 = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: 3,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    const step3Ids = step3.targets.map((t) => t.id);
    assert.ok(step3Ids.includes('human-hand-card-2'));
    assert.ok(step3Ids.includes('board-node-card-0'));
    assert.equal(step3.arrow?.fromId, 'human-hand-card-2');
    assert.equal(step3.arrow?.toId, 'board-node-card-0');
  });

  it('elevates ECHO-0 psychological thought dialogue when thoughtSpotlightActive is true', () => {
    const state = createSec00TutorialState();
    const sec00Guidance = getSec00Guidance(state, {
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
    });

    const thoughtPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: true,
    });
    assert.equal(thoughtPlan.active, true);
    assert.equal(thoughtPlan.mode, 'sec00-thought');
    const ids = thoughtPlan.targets.map((t) => t.id);
    assert.ok(ids.includes('lc-tutorial-guide-bar'));
    assert.ok(ids.includes('lc-speech-bubble-active'));
    assert.ok(ids.includes('lc-chat-panel'));
    assert.ok((thoughtPlan.mobileFallbackTargets ?? []).some((t) => t.id === 'hud-btn-mobile-speech-bar'));
  });

  it('tracks hand-to-board, hack-skill, and scan-mode transitions across the SEC-00 ECHO-0 tutorial', () => {
    let s = createSec00TutorialState();
    const swapPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance: getSec00Guidance(s, { selectedHandIndex: null, scanMode: false, showRaiseTiers: false }),
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(swapPlan.mode, 'sec00-step');
    assert.equal(swapPlan.arrow?.fromId, 'human-hand-card-2');
    assert.equal(swapPlan.arrow?.toId, 'board-node-card-0');

    // Progress SEC-00 through swap -> AI raise20 -> call -> flip -> AI flip2 -> raise40 -> AI call+hack+endTurn -> hack+1 -> scan
    s = applyAction(s, { type: 'swap', handIndex: 2, boardIndex: 0 });
    s = applyAction(s, pickSec00AiAction(s)!);
    s = applyAction(s, { type: 'call' });
    s = applyAction(s, { type: 'flip', boardIndex: 1 });
    s = applyAction(s, pickSec00AiAction(s)!);
    s = applyAction(s, { type: 'raise', amount: 40 });
    s = applyAction(s, pickSec00AiAction(s)!);
    s = applyAction(s, pickSec00AiAction(s)!);
    s = applyAction(s, pickSec00AiAction(s)!);

    const hackPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance: getSec00Guidance(s, { selectedHandIndex: null, scanMode: false, showRaiseTiers: false }),
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.ok(hackPlan.targets.some((t) => t.id === 'human-hand-card-0'));
    assert.ok(hackPlan.targets.some((t) => t.id === 'hack-btn-plus-one'));
    assert.equal(hackPlan.arrow?.fromId, 'human-hand-card-0');
    assert.equal(hackPlan.arrow?.toId, 'hack-btn-plus-one');

    s = applyAction(s, { type: 'hack', handIndex: 0, skill: 'plus-one' });

    const beforeScanPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance: getSec00Guidance(s, { selectedHandIndex: null, scanMode: false, showRaiseTiers: false }),
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.ok(beforeScanPlan.targets.some((t) => t.id === 'hack-btn-scan-toggle'));

    const activeScanPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance: getSec00Guidance(s, { selectedHandIndex: null, scanMode: true, showRaiseTiers: false }),
      selectedHandIndex: null,
      scanMode: true,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.ok(activeScanPlan.targets.some((t) => t.id === 'opponent-hand-card-0'));
    assert.equal(activeScanPlan.arrow?.fromId, 'hack-btn-scan-toggle');
    assert.equal(activeScanPlan.arrow?.toId, 'opponent-hand-card-0');
  });

  it('clamps spotlight cutout bounds safely inside viewport', () => {
    const clamped = clampSpotlightRect(
      { left: -4, top: 2, width: 200, height: 100 },
      8,
      1280,
      720
    );
    assert.equal(clamped.left, 0);
    assert.equal(clamped.top, 0);
    assert.equal(clamped.right, 204);
    assert.equal(clamped.bottom, 110);
  });

  it('activates dim-surrounding spotlight targeting hud-btn-rewind when rewind unlocks on first zero compute even outside SEC-00 guide', () => {
    const plan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: false,
      sec00IntroIndex: null,
      sec00Guidance: null,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
      rewindUnlockSpotlightActive: true,
    });
    assert.equal(plan.active, true);
    assert.equal(plan.mode, 'rewind-unlock');
    assert.ok(plan.dimOpacity >= 0.7);
    assert.equal(plan.targets.length, 1);
    assert.equal(plan.targets[0].id, 'hud-btn-rewind');
    assert.equal(plan.targets[0].tone, 'pink');
  });
});
