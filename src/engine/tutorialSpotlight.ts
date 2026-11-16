import type { Sec00Guidance } from './sec00Tutorial.ts';
import type { TutorialGuidance } from './tutorial.ts';

export type SpotlightTone = 'cyan' | 'amber' | 'pink' | 'emerald';

export type SpotlightRole =
  | 'guide-bar'
  | 'monologue'
  | 'thought'
  | 'hand'
  | 'board'
  | 'skill'
  | 'action'
  | 'opponent'
  | 'pool';

export interface SpotlightTargetSpec {
  id: string;
  label?: string;
  tone?: SpotlightTone;
  padding?: number;
  role?: SpotlightRole;
  subtle?: boolean;
}

export interface SpotlightLinkArrow {
  fromId: string;
  toId: string;
  label?: string;
  tone?: 'cyan' | 'amber';
}

export interface SpotlightPlan {
  active: boolean;
  mode: 'sec00-monologue' | 'sec00-thought' | 'sec00-step' | 'tutorial-step' | 'off';
  dimOpacity: number;
  targets: SpotlightTargetSpec[];
  mobileFallbackTargets?: SpotlightTargetSpec[];
  arrow?: SpotlightLinkArrow | null;
}

export interface SpotlightInputContext {
  viewMode: 'arena' | 'escape-map';
  hasModalOpen: boolean;
  hasPendingSkillClaim: boolean;
  sec00GuideActive: boolean;
  sec00IntroIndex: number | null;
  sec00Guidance: Sec00Guidance | null;
  tutorialActive: boolean;
  tutorialGuidance: TutorialGuidance | null;
  selectedHandIndex: number | null;
  scanMode: boolean;
  showRaiseTiers: boolean;
  thoughtSpotlightActive: boolean;
}

export interface ClampedSpotlightRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function clampSpotlightRect(
  raw: { left: number; top: number; width: number; height: number },
  padding: number,
  viewportW: number,
  viewportH: number
): ClampedSpotlightRect {
  const left = Math.max(0, Math.round(raw.left - padding));
  const top = Math.max(0, Math.round(raw.top - padding));
  const right = Math.min(viewportW, Math.round(raw.left + raw.width + padding));
  const bottom = Math.min(viewportH, Math.round(raw.top + raw.height + padding));
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function classifyFocusTarget(id: string): Omit<SpotlightTargetSpec, 'id'> {
  if (id.startsWith('human-hand-card-')) {
    return { label: '己方手牌', tone: 'cyan', padding: 6, role: 'hand' };
  }
  if (id.startsWith('opponent-hand-card-')) {
    return { label: '扫描目标', tone: 'pink', padding: 6, role: 'opponent' };
  }
  if (id.startsWith('board-node-card-')) {
    return { label: '公共牌区', tone: 'amber', padding: 6, role: 'board' };
  }
  if (id.startsWith('hack-btn-')) {
    return { label: '黑客与扫描技能', tone: 'pink', padding: 5, role: 'skill' };
  }
  if (id.startsWith('lc-action-btn-') || id.startsWith('raise-tier-btn-') || id.startsWith('action-btn-')) {
    return { label: '操作指令', tone: 'emerald', padding: 5, role: 'action' };
  }
  if (id.startsWith('tutorial-btn-')) {
    return { label: '切换关卡', tone: 'emerald', padding: 4, role: 'guide-bar' };
  }
  return { tone: 'cyan', padding: 5 };
}

export function resolveTutorialSpotlightPlan(ctx: SpotlightInputContext): SpotlightPlan {
  if (ctx.viewMode !== 'arena' || ctx.hasModalOpen || ctx.hasPendingSkillClaim) {
    return { active: false, mode: 'off', dimOpacity: 0, targets: [] };
  }

  // 1. Transient ECHO-0 psychological thought spotlight during SEC-00
  if (ctx.sec00GuideActive && !ctx.tutorialActive && ctx.thoughtSpotlightActive) {
    return {
      active: true,
      mode: 'sec00-thought',
      dimOpacity: 0.72,
      targets: [
        { id: 'lc-tutorial-guide-bar', label: '上方教程', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
        { id: 'lc-speech-bubble-active', label: '心理对话', tone: 'pink', padding: 8, role: 'thought' },
        { id: 'lc-chat-panel', label: '通讯记录', tone: 'cyan', padding: 6, role: 'thought', subtle: true },
      ],
      mobileFallbackTargets: [
        { id: 'lc-tutorial-guide-bar', label: '上方教程', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
        { id: 'hud-btn-mobile-speech-bar', label: '点击查看心理对话', tone: 'pink', padding: 6, role: 'thought' },
        { id: 'hud-btn-mobile-chat', label: '通讯抽屉', tone: 'cyan', padding: 5, role: 'thought', subtle: true },
      ],
      arrow: null,
    };
  }

  // 2. SEC-00 opening self-monologue (1/4 ~ 4/4)
  if (ctx.sec00GuideActive && !ctx.tutorialActive && ctx.sec00IntroIndex !== null) {
    const baseTargets: SpotlightTargetSpec[] = [
      { id: 'lc-tutorial-guide-bar', label: '上方教程', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
      { id: 'sec00-monologue-card', label: '开局独白', tone: 'cyan', padding: 8, role: 'monologue' },
    ];
    const mobileFallback: SpotlightTargetSpec[] = [
      { id: 'lc-tutorial-guide-bar', label: '上方教程', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
      { id: 'sec00-bar-open-chat', label: '点此查看独白框', tone: 'amber', padding: 6, role: 'monologue' },
    ];

    let arrow: SpotlightLinkArrow | null = null;
    if (ctx.sec00IntroIndex === 0) {
      baseTargets.push({
        id: 'lc-opponent-zone',
        label: '匿名对手 (110算力)',
        tone: 'pink',
        padding: 6,
        role: 'opponent',
        subtle: true,
      });
      mobileFallback.push({
        id: 'lc-opponent-zone',
        label: '匿名对手 (110算力)',
        tone: 'pink',
        padding: 6,
        role: 'opponent',
        subtle: true,
      });
    } else if (ctx.sec00IntroIndex === 1) {
      baseTargets.push(
        { id: 'lc-board-zone', label: '中央 4 张加密暗牌', tone: 'amber', padding: 6, role: 'board', subtle: true },
        { id: 'lc-player-hand-zone', label: '己方 3 张手牌区', tone: 'cyan', padding: 6, role: 'hand', subtle: true }
      );
      mobileFallback.push(
        { id: 'lc-board-zone', label: '中央 4 张加密暗牌', tone: 'amber', padding: 6, role: 'board', subtle: true },
        { id: 'lc-player-hand-zone', label: '己方 3 张手牌区', tone: 'cyan', padding: 6, role: 'hand', subtle: true }
      );
    } else if (ctx.sec00IntroIndex === 2) {
      baseTargets.push(
        { id: 'lc-pool-slot', label: '算力池防线', tone: 'emerald', padding: 6, role: 'pool', subtle: true },
        { id: 'lc-right-actions', label: '跟注/加注区', tone: 'emerald', padding: 6, role: 'action', subtle: true }
      );
      mobileFallback.push(
        { id: 'lc-pool-slot', label: '算力池防线', tone: 'emerald', padding: 6, role: 'pool', subtle: true },
        { id: 'lc-right-actions', label: '跟注/加注区', tone: 'emerald', padding: 6, role: 'action', subtle: true }
      );
    } else {
      baseTargets.push(
        { id: 'human-hand-card-2', label: '待换出废牌 2黑', tone: 'cyan', padding: 6, role: 'hand' },
        { id: 'board-node-card-0', label: '目标公共暗牌 节点01', tone: 'amber', padding: 6, role: 'board' }
      );
      mobileFallback.push(
        { id: 'human-hand-card-2', label: '待换出废牌 2黑', tone: 'cyan', padding: 6, role: 'hand' },
        { id: 'board-node-card-0', label: '目标公共暗牌 节点01', tone: 'amber', padding: 6, role: 'board' }
      );
      arrow = {
        fromId: 'human-hand-card-2',
        toId: 'board-node-card-0',
        label: '即将互换',
        tone: 'cyan',
      };
    }

    return {
      active: true,
      mode: 'sec00-monologue',
      dimOpacity: 0.74,
      targets: baseTargets,
      mobileFallbackTargets: mobileFallback,
      arrow,
    };
  }

  // 3. SEC-00 interactive hands-on guidance
  if (ctx.sec00GuideActive && !ctx.tutorialActive && ctx.sec00Guidance) {
    const g = ctx.sec00Guidance;
    const targets: SpotlightTargetSpec[] = [
      { id: 'lc-tutorial-guide-bar', label: '当前教学步骤', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
    ];
    let arrow: SpotlightLinkArrow | null = null;

    if (g.stepId === 'swap-board0') {
      if (ctx.selectedHandIndex === 2) {
        targets.push(
          { id: 'human-hand-card-2', label: '已选中 2黑', tone: 'cyan', padding: 5, role: 'hand', subtle: true },
          { id: 'board-node-card-0', label: '点击放入节点01', tone: 'amber', padding: 7, role: 'board' }
        );
      } else {
        targets.push(
          { id: 'human-hand-card-2', label: '点选或拖拽 2黑', tone: 'cyan', padding: 7, role: 'hand' },
          { id: 'board-node-card-0', label: '换入节点01', tone: 'amber', padding: 7, role: 'board' }
        );
      }
      arrow = {
        fromId: 'human-hand-card-2',
        toId: 'board-node-card-0',
        label: '点击或拖入换牌',
        tone: 'amber',
      };
    } else if (g.stepId === 'call-raise20') {
      targets.push({ id: 'lc-action-btn-call', label: '点此跟注 20', tone: 'emerald', padding: 7, role: 'action' });
    } else if (g.stepId === 'flip-board1') {
      targets.push({ id: 'board-node-card-1', label: '点击免费翻牌', tone: 'amber', padding: 7, role: 'board' });
    } else if (g.stepId === 'flush-raise40') {
      if (ctx.showRaiseTiers) {
        targets.push({ id: 'raise-tier-btn-2', label: '选择 +40 施压', tone: 'emerald', padding: 7, role: 'action' });
      } else {
        targets.push({ id: 'lc-action-btn-open-raise', label: '点此打开加注', tone: 'emerald', padding: 7, role: 'action' });
      }
    } else if (g.stepId === 'hack-plus-one') {
      if (ctx.selectedHandIndex === 0) {
        targets.push(
          { id: 'human-hand-card-0', label: '已选中 Q粉', tone: 'cyan', padding: 5, role: 'hand', subtle: true },
          { id: 'hack-btn-plus-one', label: '点击 +1 篡改', tone: 'pink', padding: 7, role: 'skill' }
        );
      } else {
        targets.push(
          { id: 'human-hand-card-0', label: '先选中 Q粉', tone: 'cyan', padding: 7, role: 'hand' },
          { id: 'hack-btn-plus-one', label: '再点 +1 改牌', tone: 'pink', padding: 7, role: 'skill' }
        );
      }
      arrow = {
        fromId: 'human-hand-card-0',
        toId: 'hack-btn-plus-one',
        label: '选牌后注入 +1',
        tone: 'cyan',
      };
    } else if (g.stepId === 'scan-catch') {
      if (ctx.scanMode) {
        targets.push(
          { id: 'hack-btn-scan-toggle', label: '扫描激光已开启', tone: 'pink', padding: 5, role: 'skill', subtle: true },
          { id: 'opponent-hand-card-0', label: '点击抓获对手篡改', tone: 'pink', padding: 8, role: 'opponent' }
        );
        arrow = {
          fromId: 'hack-btn-scan-toggle',
          toId: 'opponent-hand-card-0',
          label: '激光抓包',
          tone: 'amber',
        };
      } else {
        targets.push({ id: 'hack-btn-scan-toggle', label: '点此开启扫描', tone: 'pink', padding: 7, role: 'skill' });
      }
    } else if (g.stepId === 'completed') {
      targets.push({ id: 'action-btn-escape-retreat', label: '提取并撤离', tone: 'emerald', padding: 7, role: 'action' });
    }

    return {
      active: true,
      mode: 'sec00-step',
      dimOpacity: 0.72,
      targets,
      arrow,
    };
  }

  // 4. 6-stage standalone tutorial
  if (ctx.tutorialActive && ctx.tutorialGuidance) {
    const targets: SpotlightTargetSpec[] = [
      { id: 'lc-tutorial-guide-bar', label: '教程引导', tone: 'cyan', padding: 6, role: 'guide-bar', subtle: true },
    ];
    for (const id of ctx.tutorialGuidance.focusIds) {
      if (id === 'lc-tutorial-guide-bar') continue;
      const meta = classifyFocusTarget(id);
      targets.push({ id, ...meta });
    }

    let arrow: SpotlightLinkArrow | null = null;
    const handId = ctx.tutorialGuidance.focusIds.find((id) => id.startsWith('human-hand-card-'));
    const boardId = ctx.tutorialGuidance.focusIds.find((id) => id.startsWith('board-node-card-'));
    const hackId = ctx.tutorialGuidance.focusIds.find((id) => id.startsWith('hack-btn-'));
    if (handId && boardId) {
      arrow = { fromId: handId, toId: boardId, label: '互换手牌', tone: 'amber' };
    } else if (handId && hackId) {
      arrow = { fromId: handId, toId: hackId, label: '注入改牌', tone: 'cyan' };
    }

    return {
      active: true,
      mode: 'tutorial-step',
      dimOpacity: 0.72,
      targets,
      arrow,
    };
  }

  return { active: false, mode: 'off', dimOpacity: 0, targets: [] };
}
