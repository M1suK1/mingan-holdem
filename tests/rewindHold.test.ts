import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REWIND_HOLD_DURATION_MS,
  REWIND_TAP_MAX_ELAPSED_MS,
  computeRewindHoldProgress,
  resolveRewindTapAction,
  getRewindButtonMeta,
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

  it('produces clear labels and titles for locked, armed, and holding states', () => {
    const locked = getRewindButtonMeta({ humanChips: 500, rewindStepCount: 3, holdProgress: 0 });
    assert.equal(locked.tapEnabled, false);
    assert.equal(locked.isHolding, false);
    assert.equal(locked.mainLabel, '时间回溯');
    assert.ok(locked.subLabel.includes('长按重开'));

    const armed = getRewindButtonMeta({ humanChips: 0, rewindStepCount: 2, holdProgress: 0 });
    assert.equal(armed.tapEnabled, true);
    assert.equal(armed.subLabel, '锚点 x2 · 长按重开');

    const emptyArmed = getRewindButtonMeta({ humanChips: 0, rewindStepCount: 0, holdProgress: 0 });
    assert.equal(emptyArmed.subLabel, '点按重置 · 长按重开');

    const holding = getRewindButtonMeta({ humanChips: 500, rewindStepCount: 2, holdProgress: 65 });
    assert.equal(holding.isHolding, true);
    assert.equal(holding.mainLabel, '重开 65%');
  });
});
