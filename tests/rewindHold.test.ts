import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REWIND_HOLD_DURATION_MS,
  REWIND_TAP_MAX_ELAPSED_MS,
  SEC04_MAX_REWIND_USES,
  SEC04_REWIND_DURABILITY_STEPS,
  canHoldRewindRestart,
  computeRewindHoldProgress,
  resolveRewindTapAction,
  getRewindButtonMeta,
  getSec04RewindDurability,
} from '../src/engine/rewindHold.ts';

describe('rewindHold: 时间回溯点按与长按重开判定', () => {
  it('computes clamped progress and completion threshold accurately', () => {
    assert.deepEqual(computeRewindHoldProgress(0), { progress: 4, completed: false });
    assert.deepEqual(computeRewindHoldProgress(REWIND_HOLD_DURATION_MS / 2), {
      progress: 50,
      completed: false,
    });
    assert.deepEqual(computeRewindHoldProgress(REWIND_HOLD_DURATION_MS), {
      progress: 100,
      completed: true,
    });
    assert.deepEqual(computeRewindHoldProgress(REWIND_HOLD_DURATION_MS + 300), {
      progress: 100,
      completed: true,
    });
  });

  it('ignores click after long-press completed or aborted past tap threshold', () => {
    assert.equal(
      resolveRewindTapAction({
        humanChips: 0,
        holdTriggered: true,
        holdElapsedMs: 0,
      }),
      'ignore'
    );
    assert.equal(
      resolveRewindTapAction({
        humanChips: 0,
        holdTriggered: false,
        holdElapsedMs: REWIND_TAP_MAX_ELAPSED_MS,
      }),
      'ignore'
    );
  });

  it('gates short-tap rewind to zero compute while allowing normal tap at zero chips', () => {
    assert.equal(
      resolveRewindTapAction({
        humanChips: 120,
        holdTriggered: false,
        holdElapsedMs: 80,
      }),
      'locked-toast'
    );
    assert.equal(
      resolveRewindTapAction({
        humanChips: 0,
        holdTriggered: false,
        holdElapsedMs: 90,
      }),
      'rewind-step'
    );
    assert.equal(
      resolveRewindTapAction({
        humanChips: 0,
        holdTriggered: false,
        holdElapsedMs: 0,
      }),
      'rewind-step'
    );
  });

  it('gates long-press restart to zero compute and non-shattered state', () => {
    assert.equal(canHoldRewindRestart({ humanChips: 500 }), false);
    assert.equal(canHoldRewindRestart({ humanChips: 1 }), false);
    assert.equal(canHoldRewindRestart({ humanChips: 0 }), true);
    assert.equal(canHoldRewindRestart({ humanChips: 0, isShattered: false }), true);
    assert.equal(canHoldRewindRestart({ humanChips: 0, isShattered: true }), false);
  });

  it('produces clear labels and titles for locked, armed, and holding states', () => {
    const locked = getRewindButtonMeta({ humanChips: 500, rewindStepCount: 3, holdProgress: 0 });
    assert.equal(locked.tapEnabled, false);
    assert.equal(locked.holdEnabled, false);
    assert.equal(locked.isHolding, false);
    assert.equal(locked.mainLabel, '时间回溯');
    assert.equal(locked.subLabel, '算力归零后激活');

    const lockedWithProgress = getRewindButtonMeta({
      humanChips: 500,
      rewindStepCount: 2,
      holdProgress: 65,
    });
    assert.equal(lockedWithProgress.holdEnabled, false);
    assert.equal(lockedWithProgress.isHolding, false);
    assert.equal(lockedWithProgress.mainLabel, '时间回溯');

    const armed = getRewindButtonMeta({ humanChips: 0, rewindStepCount: 2, holdProgress: 0 });
    assert.equal(armed.tapEnabled, true);
    assert.equal(armed.holdEnabled, true);
    assert.equal(armed.subLabel, '锚点 x2 · 长按重开');

    const emptyArmed = getRewindButtonMeta({ humanChips: 0, rewindStepCount: 0, holdProgress: 0 });
    assert.equal(emptyArmed.subLabel, '点按重置 · 长按重开');

    const holding = getRewindButtonMeta({ humanChips: 0, rewindStepCount: 2, holdProgress: 65 });
    assert.equal(holding.holdEnabled, true);
    assert.equal(holding.isHolding, true);
    assert.equal(holding.mainLabel, '重开 65%');
    assert.equal(holding.disabled, false);
    assert.equal(holding.durability.stage, 'intact');
    assert.equal(holding.durability.durabilityPct, 100);
  });

  it('evolves SEC-04 rewind durability across four stages: 100% -> 72% -> 48% -> shattered', () => {
    assert.deepEqual([...SEC04_REWIND_DURABILITY_STEPS], [100, 72, 48, 0]);
    assert.equal(SEC04_MAX_REWIND_USES, 3);

    const s0 = getSec04RewindDurability(0, true);
    assert.equal(s0.stage, 'intact');
    assert.equal(s0.durabilityPct, 100);
    assert.equal(s0.isShattered, false);
    assert.equal(s0.warningLevel, 'none');

    const s1 = getSec04RewindDurability(1, true);
    assert.equal(s1.stage, 'cracked-1');
    assert.equal(s1.durabilityPct, 72);
    assert.equal(s1.isShattered, false);
    assert.equal(s1.warningLevel, 'warn');
    assert.equal(s1.channelBadgeText, '通道 72%');

    const s2 = getSec04RewindDurability(2, true);
    assert.equal(s2.stage, 'cracked-2');
    assert.equal(s2.durabilityPct, 48);
    assert.equal(s2.isShattered, false);
    assert.equal(s2.warningLevel, 'critical');
    assert.equal(s2.channelBadgeText, '过载 48%');

    const s3 = getSec04RewindDurability(3, true);
    assert.equal(s3.stage, 'shattered');
    assert.equal(s3.durabilityPct, 0);
    assert.equal(s3.isShattered, true);
    assert.equal(s3.warningLevel, 'failed');
    assert.equal(s3.channelBadgeText, '通道碎裂');

    const sOver = getSec04RewindDurability(9, true);
    assert.equal(sOver.stage, 'shattered');
    assert.equal(sOver.durabilityPct, 0);
    assert.equal(sOver.uses, 3);

    const nonSec04 = getSec04RewindDurability(3, false);
    assert.equal(nonSec04.stage, 'intact');
    assert.equal(nonSec04.durabilityPct, 100);
    assert.equal(nonSec04.isShattered, false);
  });

  it('disables tap and long-press metadata once SEC-04 rewind button shatters', () => {
    assert.equal(
      resolveRewindTapAction({
        humanChips: 0,
        holdTriggered: false,
        holdElapsedMs: 50,
        isShattered: true,
      }),
      'shattered'
    );

    const cracked1 = getRewindButtonMeta({
      humanChips: 500,
      rewindStepCount: 1,
      holdProgress: 0,
      isSec04: true,
      sec04RewindUses: 1,
    });
    assert.equal(cracked1.disabled, false);
    assert.equal(cracked1.mainLabel, '时间回溯 72%');
    assert.ok(cracked1.subLabel.includes('72%'));

    const cracked2 = getRewindButtonMeta({
      humanChips: 0,
      rewindStepCount: 1,
      holdProgress: 0,
      isSec04: true,
      sec04RewindUses: 2,
    });
    assert.equal(cracked2.disabled, false);
    assert.equal(cracked2.tapEnabled, true);
    assert.equal(cracked2.mainLabel, '时间回溯 48%');
    assert.ok(cracked2.subLabel.includes('最后锚点'));

    const shattered = getRewindButtonMeta({
      humanChips: 0,
      rewindStepCount: 1,
      holdProgress: 80,
      isSec04: true,
      sec04RewindUses: 3,
    });
    assert.equal(shattered.disabled, true);
    assert.equal(shattered.tapEnabled, false);
    assert.equal(shattered.holdEnabled, false);
    assert.equal(shattered.isHolding, false);
    assert.equal(shattered.mainLabel, '回溯已碎裂');
    assert.equal(shattered.subLabel, '通道断开 · 0%');
  });
});
