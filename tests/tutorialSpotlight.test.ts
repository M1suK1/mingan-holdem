import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTutorialSpotlightPlan,
  clampSpotlightRect,
} from '../src/engine/tutorialSpotlight.ts';
import { createSec00TutorialState, getSec00Guidance } from '../src/engine/sec00Tutorial.ts';
import { createTutorialStageState, getTutorialGuidance } from '../src/engine/tutorial.ts';

describe('tutorialSpotlight: 教程四周压暗聚光计划解析', () => {
  it('disables spotlight when outside arena, modal is open, or no tutorial is active', () => {
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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
      tutorialActive: false,
      tutorialGuidance: null,
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

  it('tracks hand-to-board, hack-skill, and scan-mode transitions during SEC-00 and 6-stage tutorial', () => {
    const state = createSec00TutorialState();
    const swapUnselected = getSec00Guidance(state, {
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
    });
    const swapPlan = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: true,
      sec00IntroIndex: null,
      sec00Guidance: swapUnselected,
      tutorialActive: false,
      tutorialGuidance: null,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(swapPlan.mode, 'sec00-step');
    assert.equal(swapPlan.arrow?.fromId, 'human-hand-card-2');
    assert.equal(swapPlan.arrow?.toId, 'board-node-card-0');

    // Stage 5 of 6-stage tutorial: scan toggle -> opponent-hand-card-0
    const tutState = createTutorialStageState(4);
    const tutBeforeScan = getTutorialGuidance(4, tutState, {
      selectedHandIndex: null,
      scanMode: false,
    });
    const tutPlan1 = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: false,
      sec00IntroIndex: null,
      sec00Guidance: null,
      tutorialActive: true,
      tutorialGuidance: tutBeforeScan,
      selectedHandIndex: null,
      scanMode: false,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.equal(tutPlan1.mode, 'tutorial-step');
    assert.ok(tutPlan1.targets.some((t) => t.id === 'lc-tutorial-guide-bar'));
    assert.ok(tutPlan1.targets.some((t) => t.id === 'hack-btn-scan-toggle'));

    const tutAfterScan = getTutorialGuidance(4, tutState, {
      selectedHandIndex: null,
      scanMode: true,
    });
    const tutPlan2 = resolveTutorialSpotlightPlan({
      viewMode: 'arena',
      hasModalOpen: false,
      hasPendingSkillClaim: false,
      sec00GuideActive: false,
      sec00IntroIndex: null,
      sec00Guidance: null,
      tutorialActive: true,
      tutorialGuidance: tutAfterScan,
      selectedHandIndex: null,
      scanMode: true,
      showRaiseTiers: false,
      thoughtSpotlightActive: false,
    });
    assert.ok(tutPlan2.targets.some((t) => t.id === 'opponent-hand-card-0'));
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
});
