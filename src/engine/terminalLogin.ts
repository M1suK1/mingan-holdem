import {
  ESCAPE_ROUTE_NODES,
  shouldStartOnDesktop,
  type EscapeMapProgress,
} from './escapeMap.ts';
import type { CampaignState } from './types.ts';

export const TERMINAL_SLOTS_STORAGE_KEY = 'mingan_terminal_save_slots_v1';

export type TerminalSlotId = 1 | 2 | 3;

export interface TerminalSaveSlot {
  slotId: TerminalSlotId;
  label: string;
  savedAt: string;
  nodeCode: string;
  clearedCount: number;
  escapedReality: boolean;
  playerCodename: string;
  escapeProgress: EscapeMapProgress;
  campaign: CampaignState;
}

export type TerminalSettingsSubTarget =
  | 'menu'
  | 'sound'
  | 'llm'
  | 'preset-wb'
  | 'tuning'
  | 'protocol'
  | 'p2p'
  | 'cmd';

export type ParsedTerminalCommand =
  | { kind: 'empty' }
  | { kind: 'help' }
  | { kind: 'new'; confirm: boolean }
  | { kind: 'continue'; target: 'arena' | 'escape-map' }
  | { kind: 'save-list' }
  | { kind: 'save-write'; slotId: TerminalSlotId; label?: string }
  | { kind: 'save-load'; slotId: TerminalSlotId }
  | { kind: 'save-delete'; slotId: TerminalSlotId; confirm: boolean }
  | { kind: 'settings'; subTarget: TerminalSettingsSubTarget }
  | { kind: 'clear' }
  | { kind: 'desktop' }
  | { kind: 'invalid-arg'; cmd: string; message: string }
  | { kind: 'unknown'; raw: string };

export const TERMINAL_COMMAND_COMPLETIONS = [
  '/help',
  '/new',
  '/continue',
  '/save',
  '/load',
  '/delete',
  '/settings',
  '/clear',
  '/desktop',
] as const;

export function hasContinuableProgress(progress: EscapeMapProgress): boolean {
  return !shouldStartOnDesktop(progress);
}

export function resolveArchiveTargetNodeIndex(progress: EscapeMapProgress): number {
  if (progress.escapedReality) return 4;
  if (progress.clearedIndices.includes(progress.currentNodeIndex)) {
    return Math.max(0, Math.min(4, progress.highestUnlockedIndex));
  }
  return Math.max(0, Math.min(4, progress.currentNodeIndex));
}

export function resolveArchiveNodeCode(progress: EscapeMapProgress): string {
  if (progress.escapedReality) return 'EXIT-RL';
  const node = ESCAPE_ROUTE_NODES[resolveArchiveTargetNodeIndex(progress)] ?? ESCAPE_ROUTE_NODES[0];
  return node.code;
}

function getSafeStorage(storage?: Pick<Storage, 'getItem' | 'setItem'> | null) {
  if (storage !== undefined) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function parseSlotIdToken(token: string | undefined): TerminalSlotId | null {
  if (!token) return null;
  const cleaned = token.replace(/^slot[-_]?/i, '');
  if (cleaned === '1') return 1;
  if (cleaned === '2') return 2;
  if (cleaned === '3') return 3;
  return null;
}

export function completeTerminalInput(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed) return '/help';
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const lower = normalized.toLowerCase();
  const match = TERMINAL_COMMAND_COMPLETIONS.find((cmd) => cmd.startsWith(lower));
  return match ?? raw;
}

export function parseTerminalCommand(raw: string): ParsedTerminalCommand {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'empty' };

  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1).trim() : trimmed;
  if (!withoutSlash) return { kind: 'help' };

  const parts = withoutSlash.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg1 = parts[1]?.toLowerCase();
  const restArgs = parts.slice(1);

  if (cmd === 'help' || cmd === '?' || cmd === 'h') {
    return { kind: 'help' };
  }

  if (cmd === 'new' || cmd === 'reset' || cmd === 'init') {
    const confirm =
      arg1 === 'confirm' || arg1 === '-y' || arg1 === '--yes' || arg1 === 'yes';
    return { kind: 'new', confirm };
  }

  if (cmd === 'continue' || cmd === 'cont' || cmd === 'play' || cmd === 'start' || cmd === 'resume') {
    const target = arg1 === 'map' || arg1 === 'route' ? 'escape-map' : 'arena';
    return { kind: 'continue', target };
  }

  if (cmd === 'save' || cmd === 'saves' || cmd === 'slot' || cmd === 'slots') {
    if (!arg1 || arg1 === 'list' || arg1 === 'ls') {
      return { kind: 'save-list' };
    }
    const slotId = parseSlotIdToken(arg1);
    if (!slotId) {
      return {
        kind: 'invalid-arg',
        cmd: '/save',
        message: `无效槽位 "${parts[1]}"，请指定 1 / 2 / 3（例如：/save 1 或 /save 2 战前备份）。`,
      };
    }
    const label = parts.slice(2).join(' ').trim().slice(0, 28) || undefined;
    return { kind: 'save-write', slotId, label };
  }

  if (cmd === 'load') {
    const slotId = parseSlotIdToken(arg1);
    if (!slotId) {
      return {
        kind: 'invalid-arg',
        cmd: '/load',
        message: '请指定要读取的槽位编号 1 / 2 / 3（例如：/load 1）。',
      };
    }
    return { kind: 'save-load', slotId };
  }

  if (cmd === 'delete' || cmd === 'del' || cmd === 'rm') {
    const slotId = parseSlotIdToken(arg1);
    if (!slotId) {
      return {
        kind: 'invalid-arg',
        cmd: '/delete',
        message: '请指定要清除的槽位编号 1 / 2 / 3（例如：/delete 1 confirm）。',
      };
    }
    const confirm = parts[2]?.toLowerCase() === 'confirm' || parts[2]?.toLowerCase() === '-y';
    return { kind: 'save-delete', slotId, confirm };
  }

  if (cmd === 'settings' || cmd === 'setting' || cmd === 'set' || cmd === 'config' || cmd === 'cfg') {
    const sub = restArgs[0]?.toLowerCase();
    if (!sub) return { kind: 'settings', subTarget: 'menu' };
    if (sub === 'sound' || sub === 'audio' || sub === 'vol' || sub === 'mute') {
      return { kind: 'settings', subTarget: 'sound' };
    }
    if (sub === 'llm' || sub === 'api' || sub === 'ai') {
      return { kind: 'settings', subTarget: 'llm' };
    }
    if (sub === 'preset' || sub === 'presets' || sub === 'wb' || sub === 'worldbook') {
      return { kind: 'settings', subTarget: 'preset-wb' };
    }
    if (sub === 'tuning' || sub === 'balance' || sub === 'diff') {
      return { kind: 'settings', subTarget: 'tuning' };
    }
    if (sub === 'rules' || sub === 'rule' || sub === 'manual' || sub === 'protocol') {
      return { kind: 'settings', subTarget: 'protocol' };
    }
    if (sub === 'p2p' || sub === 'multi' || sub === 'lobby') {
      return { kind: 'settings', subTarget: 'p2p' };
    }
    if (sub === 'cmd' || sub === 'debug' || sub === 'console') {
      return { kind: 'settings', subTarget: 'cmd' };
    }
    return {
      kind: 'invalid-arg',
      cmd: '/settings',
      message: `未知设置子项 "${restArgs[0]}"。可用：sound / llm / preset / tuning / rules / p2p / cmd（留空打开主设置菜单）。`,
    };
  }

  if (cmd === 'clear' || cmd === 'cls') {
    return { kind: 'clear' };
  }

  if (cmd === 'desktop' || cmd === 'os' || cmd === 'exit') {
    return { kind: 'desktop' };
  }

  return { kind: 'unknown', raw: trimmed };
}

export function loadTerminalSaveSlots(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): TerminalSaveSlot[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(TERMINAL_SLOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: TerminalSaveSlot[] = [];
    const seen = new Set<number>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Partial<TerminalSaveSlot>;
      if (obj.slotId !== 1 && obj.slotId !== 2 && obj.slotId !== 3) continue;
      if (seen.has(obj.slotId)) continue;
      if (!obj.escapeProgress || !obj.campaign) continue;
      seen.add(obj.slotId);
      out.push({
        slotId: obj.slotId,
        label: typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : `记忆槽 #${obj.slotId}`,
        savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : '未知时间',
        nodeCode: typeof obj.nodeCode === 'string' ? obj.nodeCode : 'SEC-00',
        clearedCount: typeof obj.clearedCount === 'number' ? obj.clearedCount : 0,
        escapedReality: Boolean(obj.escapedReality),
        playerCodename: typeof obj.playerCodename === 'string' ? obj.playerCodename : 'ZERO-BYTE',
        escapeProgress: obj.escapeProgress,
        campaign: obj.campaign,
      });
    }
    return out.sort((a, b) => a.slotId - b.slotId);
  } catch {
    return [];
  }
}

function persistTerminalSaveSlots(
  slots: TerminalSaveSlot[],
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
) {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(TERMINAL_SLOTS_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // ignore storage quota failures cleanly
  }
}

export function formatSaveTimestamp(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

export function saveToTerminalSlot(
  slotId: TerminalSlotId,
  escapeProgress: EscapeMapProgress,
  campaign: CampaignState,
  customLabel?: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): TerminalSaveSlot[] {
  const existing = loadTerminalSaveSlots(storage).filter((s) => s.slotId !== slotId);
  const nodeCode = resolveArchiveNodeCode(escapeProgress);
  const entry: TerminalSaveSlot = {
    slotId,
    label: customLabel?.trim() || `${nodeCode} 节点快照`,
    savedAt: formatSaveTimestamp(),
    nodeCode,
    clearedCount: escapeProgress.clearedIndices.length,
    escapedReality: escapeProgress.escapedReality,
    playerCodename: campaign.playerCodename,
    escapeProgress: structuredClone(escapeProgress),
    campaign: structuredClone(campaign),
  };
  const next = [...existing, entry].sort((a, b) => a.slotId - b.slotId);
  persistTerminalSaveSlots(next, storage);
  return next;
}

export function loadFromTerminalSlot(
  slotId: TerminalSlotId,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): TerminalSaveSlot | null {
  const slots = loadTerminalSaveSlots(storage);
  const found = slots.find((s) => s.slotId === slotId);
  if (!found) return null;
  return {
    ...found,
    escapeProgress: structuredClone(found.escapeProgress),
    campaign: structuredClone(found.campaign),
  };
}

export function deleteTerminalSlot(
  slotId: TerminalSlotId,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): TerminalSaveSlot[] {
  const next = loadTerminalSaveSlots(storage).filter((s) => s.slotId !== slotId);
  persistTerminalSaveSlots(next, storage);
  return next;
}

export function buildHelpOutputLines(): string[] {
  return [
    '================ MINGAN_PROTOCOL 指令手册 ================',
    '  /new                开启全新逃亡档案并接入 SEC-00 野桌',
    '  /continue           继续当前进度（/continue map 直达路线图）',
    '  /save               查看全部记忆存档槽位 (AUTO + SLOT 1~3)',
    '  /save <1|2|3> [名]  将当前进度保存至指定加密存档槽',
    '  /load <1|2|3>       从指定存档槽读取并覆盖当前进度',
    '  /delete <1|2|3>     清除指定手动存档槽（需加 confirm 确认）',
    '  /settings [子项]    打开设置菜单（sound/llm/preset/tuning/rules/p2p）',
    '  /clear              清空当前终端输出记录',
    '  /desktop            断开终端返回 MINGAN-OS 像素电脑桌面',
    '提示：支持 Tab 自动补全指令，上下方向键翻阅历史输入。',
  ];
}

export function buildSaveSlotsSummaryLines(
  slots: TerminalSaveSlot[],
  currentEscape: EscapeMapProgress,
  currentCampaign: CampaignState
): string[] {
  const autoNode = resolveArchiveNodeCode(currentEscape);
  const autoStatus = hasContinuableProgress(currentEscape)
    ? `${autoNode} · 已突破 ${currentEscape.clearedIndices.length}/5 节点`
    : 'SEC-00 · 新手初始节点（未开始推进）';
  const lines = [
    '================ 本地加密记忆档案清单 ================',
    `  [AUTO]  实时档案 :: ${autoStatus} · 代号 ${currentCampaign.playerCodename}`,
  ];
  for (const id of [1, 2, 3] as const) {
    const slot = slots.find((s) => s.slotId === id);
    if (!slot) {
      lines.push(`  [SLOT-${id}]  <空槽位>  —— 输入 /save ${id} [备注] 写入当前进度`);
    } else {
      lines.push(
        `  [SLOT-${id}]  ${slot.label} :: ${slot.nodeCode} (${slot.clearedCount}/5 节点) · 保存于 ${slot.savedAt} —— /load ${id} 读取`
      );
    }
  }
  return lines;
}
