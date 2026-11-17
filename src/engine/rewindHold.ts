export const REWIND_HOLD_DURATION_MS = 780;
export const REWIND_TAP_MAX_ELAPSED_MS = 260;

export interface RewindHoldProgressResult {
  progress: number;
  completed: boolean;
}

export function computeRewindHoldProgress(
  elapsedMs: number,
  durationMs: number = REWIND_HOLD_DURATION_MS
): RewindHoldProgressResult {
  const safeDuration = Math.max(1, durationMs);
  const completed = elapsedMs >= safeDuration;
  const rawPct = Math.round((Math.max(0, elapsedMs) / safeDuration) * 100);
  const progress = Math.max(4, Math.min(100, rawPct));
  return { progress, completed };
}

export type RewindTapResolution = 'ignore' | 'locked-toast' | 'rewind-step';

export function resolveRewindTapAction(params: {
  humanChips: number;
  holdTriggered: boolean;
  holdElapsedMs: number;
}): RewindTapResolution {
  if (params.holdTriggered || params.holdElapsedMs >= REWIND_TAP_MAX_ELAPSED_MS) {
    return 'ignore';
  }
  if (params.humanChips > 0) {
    return 'locked-toast';
  }
  return 'rewind-step';
}

export interface RewindButtonMeta {
  tapEnabled: boolean;
  isHolding: boolean;
  mainLabel: string;
  subLabel: string;
  title: string;
}

export function getRewindButtonMeta(params: {
  humanChips: number;
  rewindStepCount: number;
  holdProgress: number;
}): RewindButtonMeta {
  const isHolding = params.holdProgress > 0;
  const tapEnabled = params.humanChips <= 0;
  const mainLabel = isHolding ? `重开 ${params.holdProgress}%` : '时间回溯';
  const subLabel = isHolding
    ? '松手取消 · 重开整场'
    : !tapEnabled
      ? '归零点按 · 长按重开'
      : params.rewindStepCount > 0
        ? `锚点 x${params.rewindStepCount} · 长按重开`
        : '点按重置 · 长按重开';
  const title = tapEnabled
    ? '算力已归零：点按回溯上一步（保留红叉），长按 0.8s 重开整场对局'
    : '算力未归零（点按回溯未激活）；长按 0.8s 可随时重开整场对局解决死局';

  return {
    tapEnabled,
    isHolding,
    mainLabel,
    subLabel,
    title,
  };
}
