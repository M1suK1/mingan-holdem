export const REWIND_HOLD_DURATION_MS = 780;
export const REWIND_TAP_MAX_ELAPSED_MS = 260;

export const SEC04_REWIND_DURABILITY_STEPS = [100, 72, 48, 0] as const;
export const SEC04_MAX_REWIND_USES = SEC04_REWIND_DURABILITY_STEPS.length - 1;

export type RewindDurabilityStage = 'intact' | 'cracked-1' | 'cracked-2' | 'shattered';
export type RewindChannelWarningLevel = 'none' | 'warn' | 'critical' | 'failed';

export interface RewindDurabilityState {
  isSec04: boolean;
  uses: number;
  maxUses: number;
  durabilityPct: number;
  stage: RewindDurabilityStage;
  isShattered: boolean;
  warningLevel: RewindChannelWarningLevel;
  channelBadgeText: string | null;
  alertTitle: string | null;
  alertDetail: string | null;
}

export function getSec04RewindDurability(
  uses: number,
  isSec04 = true
): RewindDurabilityState {
  if (!isSec04) {
    return {
      isSec04: false,
      uses: 0,
      maxUses: SEC04_MAX_REWIND_USES,
      durabilityPct: 100,
      stage: 'intact',
      isShattered: false,
      warningLevel: 'none',
      channelBadgeText: null,
      alertTitle: null,
      alertDetail: null,
    };
  }

  const safeUses = Math.max(
    0,
    Math.min(SEC04_MAX_REWIND_USES, Math.floor(Number.isFinite(uses) ? uses : 0))
  );
  const durabilityPct = SEC04_REWIND_DURABILITY_STEPS[safeUses];

  if (safeUses === 0) {
    return {
      isSec04: true,
      uses: 0,
      maxUses: SEC04_MAX_REWIND_USES,
      durabilityPct: 100,
      stage: 'intact',
      isShattered: false,
      warningLevel: 'none',
      channelBadgeText: '通道 100%',
      alertTitle: null,
      alertDetail: null,
    };
  }
  if (safeUses === 1) {
    return {
      isSec04: true,
      uses: 1,
      maxUses: SEC04_MAX_REWIND_USES,
      durabilityPct,
      stage: 'cracked-1',
      isShattered: false,
      warningLevel: 'warn',
      channelBadgeText: '通道 72%',
      alertTitle: '算力通道轻度裂纹（72%）',
      alertDetail: 'ECHO-0 时间锚点出现裂痕，高热算力通道正在损耗',
    };
  }
  if (safeUses === 2) {
    return {
      isSec04: true,
      uses: 2,
      maxUses: SEC04_MAX_REWIND_USES,
      durabilityPct,
      stage: 'cracked-2',
      isShattered: false,
      warningLevel: 'critical',
      channelBadgeText: '过载 48%',
      alertTitle: '算力通道临界过载（48%）',
      alertDetail: '时间回溯按钮裂纹加剧！再触发 1 次将彻底碎裂失效',
    };
  }
  return {
    isSec04: true,
    uses: SEC04_MAX_REWIND_USES,
    maxUses: SEC04_MAX_REWIND_USES,
    durabilityPct: 0,
    stage: 'shattered',
    isShattered: true,
    warningLevel: 'failed',
    channelBadgeText: '通道碎裂',
    alertTitle: '时间回溯按钮已碎裂失效（0%）',
    alertDetail: '算力回溯通道彻底断开，本局无法继续回溯或长按重开',
  };
}

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

export type RewindTapResolution =
  | 'ignore'
  | 'locked-toast'
  | 'rewind-step'
  | 'shattered';

export function resolveRewindTapAction(params: {
  humanChips: number;
  holdTriggered: boolean;
  holdElapsedMs: number;
  isShattered?: boolean;
}): RewindTapResolution {
  if (params.isShattered) {
    return 'shattered';
  }
  if (params.holdTriggered || params.holdElapsedMs >= REWIND_TAP_MAX_ELAPSED_MS) {
    return 'ignore';
  }
  if (params.humanChips > 0) {
    return 'locked-toast';
  }
  return 'rewind-step';
}

export function canHoldRewindRestart(params: {
  humanChips: number;
  isShattered?: boolean;
}): boolean {
  return !params.isShattered && params.humanChips <= 0;
}

export interface RewindButtonMeta {
  tapEnabled: boolean;
  holdEnabled: boolean;
  isHolding: boolean;
  disabled: boolean;
  mainLabel: string;
  subLabel: string;
  title: string;
  durability: RewindDurabilityState;
}

export function getRewindButtonMeta(params: {
  humanChips: number;
  rewindStepCount: number;
  holdProgress: number;
  isSec04?: boolean;
  sec04RewindUses?: number;
}): RewindButtonMeta {
  const durability = getSec04RewindDurability(
    params.sec04RewindUses ?? 0,
    Boolean(params.isSec04)
  );

  if (durability.isShattered) {
    return {
      tapEnabled: false,
      holdEnabled: false,
      isHolding: false,
      disabled: true,
      mainLabel: '回溯已碎裂',
      subLabel: '通道断开 · 0%',
      title:
        durability.alertDetail ??
        '算力回溯通道彻底断开，本局无法继续回溯或长按重开',
      durability,
    };
  }

  const tapEnabled = params.humanChips <= 0;
  const holdEnabled = canHoldRewindRestart({
    humanChips: params.humanChips,
    isShattered: durability.isShattered,
  });
  const isHolding = holdEnabled && params.holdProgress > 0;

  if (durability.isSec04) {
    const mainLabel = isHolding
      ? `重开 ${params.holdProgress}%`
      : durability.stage === 'intact'
        ? '时间回溯'
        : `时间回溯 ${durability.durabilityPct}%`;

    const subLabel = isHolding
      ? '松手取消 · 重开整场'
      : durability.stage === 'cracked-1'
        ? !tapEnabled
          ? '裂纹告警 · 通道 72%'
          : '通道不稳 · 点按回溯'
        : durability.stage === 'cracked-2'
          ? !tapEnabled
            ? '临界过载 · 通道 48%'
            : '最后锚点 · 点按即碎'
          : !tapEnabled
            ? '通道 100% · 归零激活'
            : params.rewindStepCount > 0
              ? `锚点 x${params.rewindStepCount} · 100%`
              : '点按重置 · 100%';

    const baseTitle = tapEnabled
      ? '算力已归零：点按回溯上一步（保留红叉），长按 0.8s 重开整场对局'
      : '算力未归零（回溯与长按重开均未激活）：仅在算力归零时可点按回溯上一步或长按 0.8s 重开整场对局';
    const title = durability.alertDetail
      ? `${durability.alertTitle}：${durability.alertDetail}｜${baseTitle}`
      : baseTitle;

    return {
      tapEnabled,
      holdEnabled,
      isHolding,
      disabled: false,
      mainLabel,
      subLabel,
      title,
      durability,
    };
  }

  const mainLabel = isHolding ? `重开 ${params.holdProgress}%` : '时间回溯';
  const subLabel = isHolding
    ? '松手取消 · 重开整场'
    : !tapEnabled
      ? '算力归零后激活'
      : params.rewindStepCount > 0
        ? `锚点 x${params.rewindStepCount} · 长按重开`
        : '点按重置 · 长按重开';
  const title = tapEnabled
    ? '算力已归零：点按回溯上一步（保留红叉），长按 0.8s 重开整场对局'
    : '算力未归零（回溯与长按重开均未激活）：仅在算力归零时可点按回溯上一步或长按 0.8s 重开整场对局';

  return {
    tapEnabled,
    holdEnabled,
    isHolding,
    disabled: false,
    mainLabel,
    subLabel,
    title,
    durability,
  };
}
