export const DESKTOP_STATE_STORAGE_KEY = 'mingan_desktop_state_v1';

export interface GridCell {
  col: number;
  row: number;
}

export type M1EndingStage =
  | 'none'
  | 'guide-hatred'
  | 'entry-written'
  | 'blackdomain-popup'
  | 'wexin-popup'
  | 'completed';

const VALID_M1_STAGES: ReadonlySet<M1EndingStage> = new Set([
  'none',
  'guide-hatred',
  'entry-written',
  'blackdomain-popup',
  'wexin-popup',
  'completed',
]);

export interface DesktopPersistedState {
  minganRestored: boolean;
  iconCells: Record<string, GridCell>;
  hatredBookEscapeEntryAdded?: boolean;
  m1EndingStage?: M1EndingStage;
}

export const DESKTOP_GRID_METRICS = {
  padX: 20,
  padY: 18,
  cellW: 114,
  cellH: 100,
  iconW: 102,
  iconH: 88,
} as const;

export function computeGridCapacity(canvasW: number, canvasH: number) {
  const cols = Math.max(
    2,
    Math.floor((canvasW - DESKTOP_GRID_METRICS.padX * 2 + 12) / DESKTOP_GRID_METRICS.cellW)
  );
  const rows = Math.max(
    3,
    Math.floor((canvasH - DESKTOP_GRID_METRICS.padY - 12) / DESKTOP_GRID_METRICS.cellH)
  );
  return { cols, rows };
}

export function gridCellToPx(col: number, row: number) {
  return {
    x: DESKTOP_GRID_METRICS.padX + col * DESKTOP_GRID_METRICS.cellW,
    y: DESKTOP_GRID_METRICS.padY + row * DESKTOP_GRID_METRICS.cellH,
  };
}

export function pxToGridCell(x: number, y: number, cols: number, rows: number): GridCell {
  const rawCol = Math.round((x - DESKTOP_GRID_METRICS.padX) / DESKTOP_GRID_METRICS.cellW);
  const rawRow = Math.round((y - DESKTOP_GRID_METRICS.padY) / DESKTOP_GRID_METRICS.cellH);
  return {
    col: Math.max(0, Math.min(cols - 1, rawCol)),
    row: Math.max(0, Math.min(rows - 1, rawRow)),
  };
}

export function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`;
}

export function findNearestFreeGridCell(
  desiredCol: number,
  desiredRow: number,
  occupiedKeys: Set<string>,
  cols: number,
  rows: number
): GridCell {
  const clampedCol = Math.max(0, Math.min(cols - 1, desiredCol));
  const clampedRow = Math.max(0, Math.min(rows - 1, desiredRow));
  if (!occupiedKeys.has(cellKey({ col: clampedCol, row: clampedRow }))) {
    return { col: clampedCol, row: clampedRow };
  }

  const candidates: Array<{ col: number; row: number; dist: number }> = [];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (occupiedKeys.has(cellKey({ col: c, row: r }))) continue;
      candidates.push({
        col: c,
        row: r,
        dist: Math.hypot(c - clampedCol, r - clampedRow),
      });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist || a.col - b.col || a.row - b.row);
  if (candidates.length > 0) {
    return { col: candidates[0].col, row: candidates[0].row };
  }
  return { col: clampedCol, row: clampedRow };
}

function getSafeStorage(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  if (storage !== undefined) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadDesktopPersistedState(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): DesktopPersistedState | null {
  const store = getSafeStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(DESKTOP_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const minganRestored = Boolean(obj.minganRestored);
    const iconCells: Record<string, GridCell> = {};
    if (obj.iconCells && typeof obj.iconCells === 'object') {
      for (const [id, cell] of Object.entries(obj.iconCells as Record<string, unknown>)) {
        if (!cell || typeof cell !== 'object') continue;
        const c = cell as Record<string, unknown>;
        if (
          typeof c.col === 'number' &&
          Number.isInteger(c.col) &&
          c.col >= 0 &&
          typeof c.row === 'number' &&
          Number.isInteger(c.row) &&
          c.row >= 0
        ) {
          iconCells[id] = { col: c.col, row: c.row };
        }
      }
    }
    const rawStage = obj.m1EndingStage;
    const m1EndingStage: M1EndingStage =
      typeof rawStage === 'string' && VALID_M1_STAGES.has(rawStage as M1EndingStage)
        ? (rawStage as M1EndingStage)
        : 'none';
    const hatredBookEscapeEntryAdded = Boolean(obj.hatredBookEscapeEntryAdded);
    return { minganRestored, iconCells, hatredBookEscapeEntryAdded, m1EndingStage };
  } catch {
    return null;
  }
}

export function saveDesktopPersistedState(
  state: DesktopPersistedState,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(DESKTOP_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures cleanly
  }
}

export function resetDesktopPersistedState(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.removeItem(DESKTOP_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function activateM1DesktopEndingSequence(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): DesktopPersistedState {
  const prev = loadDesktopPersistedState(storage);
  const nextStage: M1EndingStage =
    prev?.m1EndingStage && prev.m1EndingStage !== 'none'
      ? prev.m1EndingStage
      : prev?.hatredBookEscapeEntryAdded
        ? 'blackdomain-popup'
        : 'guide-hatred';
  const next: DesktopPersistedState = {
    minganRestored: prev?.minganRestored ?? true,
    iconCells: prev?.iconCells ?? {},
    hatredBookEscapeEntryAdded: Boolean(prev?.hatredBookEscapeEntryAdded),
    m1EndingStage: nextStage,
  };
  saveDesktopPersistedState(next, storage);
  return next;
}

export function resetM1DesktopEndingSequence(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): DesktopPersistedState | null {
  const prev = loadDesktopPersistedState(storage);
  if (!prev) return null;
  const next: DesktopPersistedState = {
    ...prev,
    hatredBookEscapeEntryAdded: false,
    m1EndingStage: 'none',
  };
  saveDesktopPersistedState(next, storage);
  return next;
}
