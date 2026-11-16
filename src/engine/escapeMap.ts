import { MAX_EXTRA_SKILLS, equipExtraSkill } from './skillPool.ts';
import type { AiDifficulty, OpponentSignatureSkillId } from './types.ts';

export interface EscapePoint {
  x: number;
  y: number;
}

export interface EscapeWallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EscapeRouteNode {
  index: number;
  id: string;
  isExit: boolean;
  code: string;
  title: string;
  sector: string;
  opponentName: string;
  opponentSubtitle: string;
  opponentChips: number;
  difficulty: Exclude<AiDifficulty, 'auto'>;
  accentColor: string;
  signatureSkillId?: OpponentSignatureSkillId;
  signatureSkillName?: string;
  signatureSkillDesc?: string;
  rewardSkillChoices?: string[];
  pos: EscapePoint;
  escapePath: EscapePoint[];
  barricadeWalls: EscapeWallSegment[];
}

export interface EscapeTransition {
  fromIndex: number;
  toIndex: number;
  startedAt: number;
}

export interface EscapeMapProgress {
  currentNodeIndex: number;
  highestUnlockedIndex: number;
  clearedIndices: number[];
  revealedWallIndices: number[];
  equippedSkills: string[];
  pendingTransition: EscapeTransition | null;
  escapedReality: boolean;
}

export const ESCAPE_MAP_STORAGE_KEY = 'mingan_escape_map_v1';

export const ESCAPE_ROUTE_NODES: EscapeRouteNode[] = [
  {
    index: 0,
    id: 'node-0-wild-table',
    isExit: false,
    code: 'SEC-00',
    title: '公共暗区野桌',
    sector: '外围游离层 // 初始接入点',
    opponentName: '匿名终端 [UNKNOWN_0x00]',
    opponentSubtitle: '游离区无名对手 · 算力较弱',
    opponentChips: 400,
    difficulty: 'rookie',
    accentColor: '#00f0ff',
    rewardSkillChoices: ['ghost-packet', 'trace-scramble'],
    pos: { x: 88, y: 230 },
    escapePath: [
      { x: 88, y: 230 },
      { x: 168, y: 230 },
      { x: 142, y: 230 },
      { x: 142, y: 150 },
      { x: 218, y: 150 },
      { x: 254, y: 132 },
    ],
    barricadeWalls: [
      { x1: 184, y1: 92, x2: 184, y2: 134 },
      { x1: 184, y1: 166, x2: 184, y2: 278 },
      { x1: 148, y1: 188, x2: 218, y2: 188 },
    ],
  },
  {
    index: 1,
    id: 'node-1-rust-alley',
    isExit: false,
    code: 'SEC-01',
    title: '底层排水巷道',
    sector: '边缘拾荒区 // 第一追击带',
    opponentName: '锈爪·凯斯',
    opponentSubtitle: '算力拾荒猎人 · 偏激进试探',
    opponentChips: 600,
    difficulty: 'rookie',
    accentColor: '#ffb020',
    signatureSkillId: 'siphon-cache',
    signatureSkillName: '算力虹吸',
    signatureSkillDesc: '每手首次主动加注成功时，额外从玩家吸取 25 算力。',
    rewardSkillChoices: ['siphon-cache', 'overclock-bluff'],
    pos: { x: 254, y: 132 },
    escapePath: [
      { x: 254, y: 132 },
      { x: 314, y: 132 },
      { x: 286, y: 156 },
      { x: 286, y: 258 },
      { x: 368, y: 258 },
      { x: 416, y: 286 },
    ],
    barricadeWalls: [
      { x1: 332, y1: 94, x2: 332, y2: 242 },
      { x1: 332, y1: 274, x2: 332, y2: 344 },
      { x1: 294, y1: 182, x2: 366, y2: 182 },
    ],
  },
  {
    index: 2,
    id: 'node-2-audit-gateway',
    isExit: false,
    code: 'SEC-02',
    title: '中继审计网关',
    sector: '灰区路由层 // 合规封锁网',
    opponentName: '白律·赛琳',
    opponentSubtitle: '中继网关审计官 · 稳健反扫',
    opponentChips: 750,
    difficulty: 'standard',
    accentColor: '#38bdf8',
    signatureSkillId: 'cold-freq-lock',
    signatureSkillName: '冷频封锁',
    signatureSkillDesc: '每手开局随机冻结玩家 1 项基础改牌技（+1 / -1 / 反色）。',
    rewardSkillChoices: ['cold-freq-lock', 'ice-firewall'],
    pos: { x: 416, y: 286 },
    escapePath: [
      { x: 416, y: 286 },
      { x: 478, y: 286 },
      { x: 454, y: 258 },
      { x: 454, y: 190 },
      { x: 534, y: 190 },
      { x: 576, y: 142 },
    ],
    barricadeWalls: [
      { x1: 496, y1: 98, x2: 496, y2: 174 },
      { x1: 496, y1: 206, x2: 496, y2: 348 },
      { x1: 460, y1: 238, x2: 530, y2: 238 },
    ],
  },
  {
    index: 3,
    id: 'node-3-phantom-market',
    isExit: false,
    code: 'SEC-03',
    title: '黑市频谱暗道',
    sector: '深层暗巷 // 多线交火带',
    opponentName: '霓影·绯夜',
    opponentSubtitle: '黑市频谱掮客 · 擅长换牌心理战',
    opponentChips: 900,
    difficulty: 'standard',
    accentColor: '#ff2e88',
    signatureSkillId: 'phantom-shroud',
    signatureSkillName: '伪影迷雾',
    signatureSkillDesc: '每手首次换牌或翻牌时隐藏动作槽位与花色日志细节。',
    rewardSkillChoices: ['zero-day-peek', 'phantom-swap'],
    pos: { x: 576, y: 142 },
    escapePath: [
      { x: 576, y: 142 },
      { x: 638, y: 142 },
      { x: 612, y: 168 },
      { x: 612, y: 240 },
      { x: 694, y: 240 },
      { x: 736, y: 272 },
    ],
    barricadeWalls: [
      { x1: 656, y1: 90, x2: 656, y2: 224 },
      { x1: 656, y1: 256, x2: 656, y2: 352 },
      { x1: 620, y1: 188, x2: 690, y2: 188 },
    ],
  },
  {
    index: 4,
    id: 'node-4-zero-gate',
    isExit: false,
    code: 'SEC-04',
    title: '零号离线闸门',
    sector: '边缘断连口 // 终极截杀防线',
    opponentName: '断壁·铁御',
    opponentSubtitle: '闸门守望者 · 高算力高压镇守',
    opponentChips: 1000,
    difficulty: 'master',
    accentColor: '#ff4757',
    signatureSkillId: 'gate-minefield',
    signatureSkillName: '闸门雷区',
    signatureSkillDesc: '公共暗牌中潜藏 3 处算力清零陷阱，翻开或换入踩雷将立刻触发熔断。',
    rewardSkillChoices: ['parity-spoof', 'mirror-checksum'],
    pos: { x: 736, y: 272 },
    escapePath: [
      { x: 736, y: 272 },
      { x: 794, y: 272 },
      { x: 770, y: 242 },
      { x: 770, y: 176 },
      { x: 842, y: 176 },
      { x: 878, y: 196 },
    ],
    barricadeWalls: [
      { x1: 812, y1: 94, x2: 812, y2: 160 },
      { x1: 812, y1: 192, x2: 812, y2: 338 },
      { x1: 774, y1: 222, x2: 844, y2: 222 },
    ],
  },
  {
    index: 5,
    id: 'exit-reality',
    isExit: true,
    code: 'EXIT-RL',
    title: '现实终端出口',
    sector: '物理断开点 // 逃离黑域协议网',
    opponentName: '物理安全断开',
    opponentSubtitle: '已完成全线突围',
    opponentChips: 0,
    difficulty: 'master',
    accentColor: '#10f5a0',
    pos: { x: 878, y: 196 },
    escapePath: [],
    barricadeWalls: [],
  },
];

const MAX_NODE_INDEX = ESCAPE_ROUTE_NODES.length - 1;

export function createInitialEscapeProgress(): EscapeMapProgress {
  return {
    currentNodeIndex: 0,
    highestUnlockedIndex: 0,
    clearedIndices: [],
    revealedWallIndices: [],
    equippedSkills: [],
    pendingTransition: null,
    escapedReality: false,
  };
}

export function claimEscapeNodeSkill(
  progress: EscapeMapProgress,
  skillId: string,
  replaceSlotIndex?: number
): EscapeMapProgress {
  return {
    ...progress,
    equippedSkills: equipExtraSkill(progress.equippedSkills, skillId, replaceSlotIndex),
  };
}

export function markEscapeWallRevealed(
  progress: EscapeMapProgress,
  nodeIndex: number
): EscapeMapProgress {
  const node = ESCAPE_ROUTE_NODES[nodeIndex];
  if (!node || node.isExit) return progress;
  if (progress.revealedWallIndices.includes(nodeIndex)) return progress;
  return {
    ...progress,
    revealedWallIndices: [...progress.revealedWallIndices, nodeIndex].sort((a, b) => a - b),
  };
}

export function resetEscapeProgress(): EscapeMapProgress {
  const initial = createInitialEscapeProgress();
  saveEscapeProgress(initial);
  return initial;
}

export function canEnterEscapeNode(progress: EscapeMapProgress, nodeIndex: number): boolean {
  const node = ESCAPE_ROUTE_NODES[nodeIndex];
  if (!node || node.isExit) return false;
  return nodeIndex >= 0 && nodeIndex <= progress.highestUnlockedIndex;
}

export function markEscapeNodeCleared(
  progress: EscapeMapProgress,
  clearedIndex: number
): EscapeMapProgress {
  const node = ESCAPE_ROUTE_NODES[clearedIndex];
  if (!node || node.isExit) return progress;
  if (clearedIndex > progress.highestUnlockedIndex) return progress;

  const clearedSet = new Set(progress.clearedIndices);
  clearedSet.add(clearedIndex);
  const nextIndex = Math.min(MAX_NODE_INDEX, clearedIndex + 1);
  const highestUnlockedIndex = Math.max(progress.highestUnlockedIndex, nextIndex);

  return {
    ...progress,
    currentNodeIndex: clearedIndex,
    highestUnlockedIndex,
    clearedIndices: Array.from(clearedSet).sort((a, b) => a - b),
    pendingTransition: {
      fromIndex: clearedIndex,
      toIndex: nextIndex,
      startedAt: Date.now(),
    },
    escapedReality: false,
  };
}

export function completeEscapeTransition(progress: EscapeMapProgress): EscapeMapProgress {
  if (!progress.pendingTransition) {
    return progress;
  }
  const toIndex = Math.max(0, Math.min(MAX_NODE_INDEX, progress.pendingTransition.toIndex));
  const targetNode = ESCAPE_ROUTE_NODES[toIndex];
  return {
    ...progress,
    currentNodeIndex: toIndex,
    highestUnlockedIndex: Math.max(progress.highestUnlockedIndex, toIndex),
    pendingTransition: null,
    escapedReality: Boolean(targetNode?.isExit) || progress.escapedReality,
  };
}

export function sanitizeEscapeProgress(raw: unknown): EscapeMapProgress {
  const base = createInitialEscapeProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const clearedIndices = Array.isArray(obj.clearedIndices)
    ? Array.from(
        new Set(
          obj.clearedIndices.filter(
            (n): n is number =>
              typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < MAX_NODE_INDEX
          )
        )
      ).sort((a, b) => a - b)
    : [];

  const revealedWallIndices = Array.isArray(obj.revealedWallIndices)
    ? Array.from(
        new Set(
          obj.revealedWallIndices.filter(
            (n): n is number =>
              typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < MAX_NODE_INDEX
          )
        )
      ).sort((a, b) => a - b)
    : [];

  const equippedSkills = Array.isArray(obj.equippedSkills)
    ? Array.from(
        new Set(obj.equippedSkills.filter((s): s is string => typeof s === 'string' && s.length > 0))
      ).slice(0, MAX_EXTRA_SKILLS)
    : [];

  const maxClearedNext = clearedIndices.length > 0 ? Math.max(...clearedIndices) + 1 : 0;
  const rawHighest =
    typeof obj.highestUnlockedIndex === 'number' && Number.isInteger(obj.highestUnlockedIndex)
      ? obj.highestUnlockedIndex
      : 0;
  const highestUnlockedIndex = Math.max(0, Math.min(MAX_NODE_INDEX, Math.max(rawHighest, maxClearedNext)));

  const rawCurrent =
    typeof obj.currentNodeIndex === 'number' && Number.isInteger(obj.currentNodeIndex)
      ? obj.currentNodeIndex
      : 0;
  const currentNodeIndex = Math.max(0, Math.min(MAX_NODE_INDEX, rawCurrent));

  let pendingTransition: EscapeTransition | null = null;
  if (obj.pendingTransition && typeof obj.pendingTransition === 'object') {
    const tr = obj.pendingTransition as Record<string, unknown>;
    if (
      typeof tr.fromIndex === 'number' &&
      typeof tr.toIndex === 'number' &&
      tr.fromIndex >= 0 &&
      tr.toIndex <= MAX_NODE_INDEX
    ) {
      pendingTransition = {
        fromIndex: tr.fromIndex,
        toIndex: tr.toIndex,
        startedAt: typeof tr.startedAt === 'number' ? tr.startedAt : Date.now(),
      };
    }
  }

  return {
    currentNodeIndex,
    highestUnlockedIndex,
    clearedIndices,
    revealedWallIndices,
    equippedSkills,
    pendingTransition,
    escapedReality: Boolean(obj.escapedReality) && highestUnlockedIndex >= MAX_NODE_INDEX,
  };
}

export function loadEscapeProgress(): EscapeMapProgress {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialEscapeProgress();
    }
    const raw = window.localStorage.getItem(ESCAPE_MAP_STORAGE_KEY);
    if (!raw) return createInitialEscapeProgress();
    return sanitizeEscapeProgress(JSON.parse(raw));
  } catch {
    return createInitialEscapeProgress();
  }
}

export function saveEscapeProgress(progress: EscapeMapProgress): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(ESCAPE_MAP_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota errors
  }
}

export function samplePolylinePoint(
  points: EscapePoint[],
  progress01: number
): { x: number; y: number; angleDeg: number } {
  if (points.length === 0) return { x: 0, y: 0, angleDeg: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angleDeg: 0 };

  const clamped = Math.max(0, Math.min(1, progress01));
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }

  if (total <= 0) {
    return { x: points[0].x, y: points[0].y, angleDeg: 0 };
  }

  const targetDist = clamped * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i += 1) {
    const len = segLengths[i];
    if (acc + len >= targetDist || i === segLengths.length - 1) {
      const localT = len > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / len)) : 1;
      const p0 = points[i];
      const p1 = points[i + 1];
      const x = p0.x + (p1.x - p0.x) * localT;
      const y = p0.y + (p1.y - p0.y) * localT;
      const angleDeg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      return { x, y, angleDeg };
    }
    acc += len;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angleDeg: (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI,
  };
}
