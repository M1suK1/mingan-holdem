import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { playSound, unlockAudioContext, type SoundSettings } from '../engine/soundEngine.ts';
import {
  DESKTOP_GRID_METRICS,
  cellKey,
  computeGridCapacity,
  findNearestFreeGridCell,
  gridCellToPx,
  loadDesktopPersistedState,
  pxToGridCell,
  saveDesktopPersistedState,
  type GridCell,
  type M1EndingStage,
} from '../engine/desktopState.ts';
import { resolveLinLongxinCasualSprite } from '../engine/storyCharacters.ts';
import {
  NetrunnerBrandLogo,
  PixelBrokenShortcutIcon,
  PixelDocFileIcon,
  PixelFolderIcon,
  PixelImageFileIcon,
  PixelMenuIcon,
  PixelRecycleBinIcon,
  PixelVolumeIcon,
  PixelWexinIcon,
  PixelWindowsLogoIcon,
} from './CyberIcons.tsx';

export type DesktopSettingsTarget =
  | 'llm'
  | 'preset-wb'
  | 'tuning'
  | 'protocol'
  | 'p2p'
  | 'cmd';

export interface DesktopIconConfig {
  id: string;
  label: string;
  kind: 'recycle' | 'wexin' | 'mingan-lnk' | 'folder-amber' | 'folder-slate' | 'image' | 'doc';
  accent?: string;
  titleHint?: string;
  defaultCell: GridCell;
}

export const MINGAN_RESTORED_ICON_CONFIG: DesktopIconConfig = {
  id: 'desktop-icon-mingan',
  label: '黑域协议网.lnk',
  kind: 'mingan-lnk',
  titleHint: '黑域协议网：已从回收站还原，双击打开接入终端',
  defaultCell: { col: 0, row: 2 },
};

export const DESKTOP_ALL_ICONS: DesktopIconConfig[] = [
  {
    id: 'desktop-icon-recycle',
    label: '回收站',
    kind: 'recycle',
    titleHint: '回收站（内含已删除的快捷方式，双击打开，支持网格拖拽）',
    defaultCell: { col: 0, row: 0 },
  },
  {
    id: 'desktop-icon-wexin',
    label: '维心',
    kind: 'wexin',
    titleHint: '维心（本地即时通讯客户端 · 当前离线暂无功能，支持网格拖拽）',
    defaultCell: { col: 0, row: 1 },
  },
  {
    id: 'desktop-decor-screenshot',
    label: '未命名截图_final_v2.png',
    kind: 'image',
    defaultCell: { col: 3, row: 0 },
  },
  {
    id: 'desktop-decor-folder-new3',
    label: '新建文件夹 (3)',
    kind: 'folder-amber',
    defaultCell: { col: 6, row: 0 },
  },
  {
    id: 'desktop-decor-workdir',
    label: '工作目录_勿删',
    kind: 'folder-amber',
    defaultCell: { col: 5, row: 1 },
  },
  {
    id: 'desktop-decor-rent-pdf',
    label: '房租水电催缴.pdf',
    kind: 'doc',
    accent: '#FF4757',
    defaultCell: { col: 8, row: 1 },
  },
  {
    id: 'desktop-decor-crash-log',
    label: '系统日志_crash.txt',
    kind: 'doc',
    accent: '#FFB020',
    defaultCell: { col: 2, row: 2 },
  },
  {
    id: 'desktop-decor-backup-2025',
    label: '旧版备份_2025',
    kind: 'folder-slate',
    defaultCell: { col: 7, row: 2 },
  },
  {
    id: 'desktop-decor-hatred-book',
    label: '仇恨之书.txt',
    kind: 'doc',
    accent: '#FF2E88',
    titleHint: '别碰黑域网：双击阅读日记（支持网格拖拽）',
    defaultCell: { col: 5, row: 3 },
  },
  {
    id: 'desktop-decor-temp-dump',
    label: '临时转储_0x4F',
    kind: 'folder-slate',
    defaultCell: { col: 1, row: 4 },
  },
  {
    id: 'desktop-decor-todo-note',
    label: '桌面清理待办.note',
    kind: 'doc',
    accent: '#7AF7FF',
    defaultCell: { col: 7, row: 4 },
  },
];

export const DESKTOP_DECORATIVE_ITEMS = DESKTOP_ALL_ICONS.filter(
  (item) => item.kind !== 'recycle' && item.kind !== 'wexin'
);

export const HATRED_BOOK_DIARY = {
  headline: '【置顶警告：别碰黑域网！！！】',
  entries: [
    {
      stamp: '三天前 20:14 // 维心损友安利',
      body: '死党在维心上给我甩来一个地下加密快捷方式，吹得跟白捡算力似的——说什么「黑域协议网」是个极简双花色算力德扑暗网，不看花色只分黑粉，公共暗区野桌新手一上线就白给 1000 算力，进去随便嘎嘎乱杀。我寻思反正今晚闲着，连上去赚两口外快就下线。',
    },
    {
      stamp: '当晚 23:42 // 十二分钟惨案',
      body: '杀个屁！那鬼地方坐满的全是盯着新人壳层生吞活剥的「算力猎手」！第一桌对面明牌看着平平无奇，摊牌前一秒偷偷发动终端篡改硬把牌面掰成顺子反杀；换了个局更离谱，整桌信号染成一团刺眼的粉红迷彩，好不容易凑成同花还被对面大两对当场碾碎；最后我想翻张公共暗牌翻盘，指尖刚点下去牌背底下直接炸出暗符，把兜里最后几百算力烧得一干二净……前后撑不到十二分钟，1000 算力归零清仓，神经链路还险些被强行扒走。',
    },
    {
      stamp: '次日凌晨 02:18 // 退游立誓',
      body: '总算狼狈拔线保住本地终端，太阳穴到现在还在突突直跳。气得当场把桌面上的「黑域协议网.lnk」拖进回收站眼不见为净，连夜写下这本《仇恨之书》钉在桌面上提醒自己：别碰黑域网！谁再点进去谁是狗！……不过刚才手抖只删进了回收站，还没彻底点清空。万一哪天实在咽不下这口气非要杀回去讨债，回收站里那个残留快捷方式应该还能点开。',
    },
  ],
};

export const HATRED_BOOK_ESCAPE_ENTRY = {
  stamp: '此刻 // 从零号闸门拔线逃回现实',
  lead: '我现在坐在电脑桌前，手心全是冷汗，指尖还在发抖。原本只是不服气被人十二分钟清零算力，才咬牙从回收站里把黑域协议网重新点开想讨个说法……结果谁能想到这一脚直接踩进了黑河企业的底层猎杀网里！一路上应付完那些把算力当命抽的疯子，最后在零号闸门对着四张烧红的火符和对面压死人的黑曜同花顺，脑子都快停机了。如果不是壳里那道奇怪的声音在最后半秒强行帮我重写成四条 A 抢回一条生路，今天我早就交代在网线那头了。能把终端狠狠切断逃回自己的 Windows 桌面，简直跟重新活了一回一样——这次我是真认栽了，也是真长记性了：',
  emphasis: '别碰黑域协议网！不管谁再吹得天花乱坠，这辈子也绝对、永远、再也别碰黑域协议网！',
} as const;

interface WindowsDesktopViewProps {
  soundSettings: SoundSettings;
  onUpdateSoundSettings: (next: SoundSettings) => void;
  onOpenSettingsTarget: (target: DesktopSettingsTarget) => void;
  onEnterFreeTable?: () => void;
  onResetSaveFromDesktop: () => void;
  onLaunchMingan: () => void;
  escapedReality?: boolean;
  playerCodename?: string;
  hasExistingProgress?: boolean;
  progressLabel?: string;
  onPlayUiClick?: () => void;
}

function formatClockParts(now: Date) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  return {
    timeShort: `${hh}:${min}`,
    dateShort: `${yyyy}/${mm}/${dd}`,
    fullTitle: `${yyyy}/${mm}/${dd} ${hh}:${min}:${sec}`,
  };
}

function buildInitialCells(
  cols: number,
  rows: number,
  persistedCells: Record<string, GridCell> | undefined,
  includeMinganLnk: boolean
): Record<string, GridCell> {
  const occupied = new Set<string>();
  const out: Record<string, GridCell> = {};
  const list = includeMinganLnk
    ? [
        DESKTOP_ALL_ICONS[0],
        DESKTOP_ALL_ICONS[1],
        MINGAN_RESTORED_ICON_CONFIG,
        ...DESKTOP_ALL_ICONS.slice(2),
      ]
    : DESKTOP_ALL_ICONS;
  for (const item of list) {
    const desired = persistedCells?.[item.id] ?? item.defaultCell;
    const resolved = findNearestFreeGridCell(desired.col, desired.row, occupied, cols, rows);
    occupied.add(cellKey(resolved));
    out[item.id] = resolved;
  }
  return out;
}

export function WindowsDesktopView({
  soundSettings,
  onUpdateSoundSettings,
  onOpenSettingsTarget,
  onEnterFreeTable,
  onResetSaveFromDesktop,
  onLaunchMingan,
  escapedReality = false,
  playerCodename = 'ZERO-BYTE',
  hasExistingProgress = false,
  progressLabel,
  onPlayUiClick,
}: WindowsDesktopViewProps) {
  const initialPersistedRef = useRef(loadDesktopPersistedState());
  const initialRestored = Boolean(
    initialPersistedRef.current?.minganRestored || hasExistingProgress
  );
  const initialM1Stage: M1EndingStage = initialPersistedRef.current?.m1EndingStage ?? 'none';
  const [selectedIconId, setSelectedIconId] = useState<string | null>(
    initialM1Stage === 'guide-hatred'
      ? 'desktop-decor-hatred-book'
      : initialRestored
        ? MINGAN_RESTORED_ICON_CONFIG.id
        : 'desktop-icon-recycle'
  );
  const [gridCapacity, setGridCapacity] = useState<{ cols: number; rows: number }>(() =>
    computeGridCapacity(
      typeof window !== 'undefined' ? window.innerWidth : 1280,
      typeof window !== 'undefined' ? window.innerHeight - 42 : 680
    )
  );
  const [minganRestored, setMinganRestored] = useState<boolean>(initialRestored);
  const [hatredBookEscapeEntryAdded, setHatredBookEscapeEntryAdded] = useState<boolean>(
    Boolean(initialPersistedRef.current?.hatredBookEscapeEntryAdded)
  );
  const [m1EndingStage, setM1EndingStage] = useState<M1EndingStage>(initialM1Stage);
  const [wexinManualPopupOpen, setWexinManualPopupOpen] = useState<boolean>(false);
  const [iconCells, setIconCells] = useState<Record<string, GridCell>>(() =>
    buildInitialCells(
      gridCapacity.cols,
      gridCapacity.rows,
      initialPersistedRef.current?.iconCells,
      initialRestored
    )
  );
  const [dragLivePos, setDragLivePos] = useState<{
    id: string;
    x: number;
    y: number;
    snapCell: GridCell;
  } | null>(null);

  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [recycleState, setRecycleState] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [hatredBookState, setHatredBookState] = useState<'closed' | 'open' | 'minimized'>('closed');
  const [focusedWindow, setFocusedWindow] = useState<'recycle' | 'hatred-book'>('recycle');
  const [selectedRecycleItemId, setSelectedRecycleItemId] = useState<string>('mingan-lnk');
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [wexinNotice, setWexinNotice] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const startWrapRef = useRef<HTMLDivElement | null>(null);
  const notepadBodyRef = useRef<HTMLDivElement | null>(null);
  const launchTimerRef = useRef<number | null>(null);
  const wexinTimerRef = useRef<number | null>(null);
  const restoredTimerRef = useRef<number | null>(null);
  const blackdomainTimerRef = useRef<number | null>(null);
  const prevPopupKindRef = useRef<'none' | 'blackdomain' | 'wexin'>('none');
  const suppressClickIdRef = useRef<string | null>(null);
  const iconCellsRef = useRef(iconCells);
  iconCellsRef.current = iconCells;
  const gridCapRef = useRef(gridCapacity);
  gridCapRef.current = gridCapacity;

  const dragSessionRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originPxX: number;
    originPxY: number;
    canvasW: number;
    canvasH: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    saveDesktopPersistedState({
      minganRestored,
      iconCells,
      hatredBookEscapeEntryAdded,
      m1EndingStage,
    });
  }, [minganRestored, iconCells, hatredBookEscapeEntryAdded, m1EndingStage]);

  useEffect(() => {
    if (m1EndingStage !== 'entry-written') return;
    if (blackdomainTimerRef.current !== null) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    blackdomainTimerRef.current = window.setTimeout(
      () => {
        blackdomainTimerRef.current = null;
        setM1EndingStage('blackdomain-popup');
      },
      reduced ? 220 : 1300
    );
    return () => {
      if (blackdomainTimerRef.current !== null) {
        window.clearTimeout(blackdomainTimerRef.current);
        blackdomainTimerRef.current = null;
      }
    };
  }, [m1EndingStage]);

  const activePopupKind: 'none' | 'blackdomain' | 'wexin' =
    m1EndingStage === 'wexin-popup' || wexinManualPopupOpen
      ? 'wexin'
      : m1EndingStage === 'blackdomain-popup'
        ? 'blackdomain'
        : 'none';

  useEffect(() => {
    if (prevPopupKindRef.current === activePopupKind) return;
    prevPopupKindRef.current = activePopupKind;
    if (activePopupKind === 'blackdomain') {
      unlockAudioContext();
      playSound('popup-alert');
    } else if (activePopupKind === 'wexin') {
      unlockAudioContext();
      playSound('wexin-ping');
    }
  }, [activePopupKind]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current !== null) {
        window.clearTimeout(launchTimerRef.current);
        launchTimerRef.current = null;
      }
      if (wexinTimerRef.current !== null) {
        window.clearTimeout(wexinTimerRef.current);
        wexinTimerRef.current = null;
      }
      if (restoredTimerRef.current !== null) {
        window.clearTimeout(restoredTimerRef.current);
        restoredTimerRef.current = null;
      }
      if (blackdomainTimerRef.current !== null) {
        window.clearTimeout(blackdomainTimerRef.current);
        blackdomainTimerRef.current = null;
      }
    };
  }, []);

  // Keep grid capacity synced to canvas size & snap any out-of-bounds icons cleanly onto valid grid cells
  useEffect(() => {
    const measureCanvas = () => {
      const el = canvasRef.current;
      if (!el) return;
      const nextCap = computeGridCapacity(el.clientWidth, el.clientHeight);
      setGridCapacity(nextCap);
      setIconCells((prev) => {
        const occupied = new Set<string>();
        const next: Record<string, GridCell> = {};
        let changed = false;
        for (const key of Object.keys(prev)) {
          const cur = prev[key];
          const resolved = findNearestFreeGridCell(
            cur.col,
            cur.row,
            occupied,
            nextCap.cols,
            nextCap.rows
          );
          if (resolved.col !== cur.col || resolved.row !== cur.row) changed = true;
          occupied.add(cellKey(resolved));
          next[key] = resolved;
        }
        return changed ? next : prev;
      });
    };
    measureCanvas();
    window.addEventListener('resize', measureCanvas);
    return () => window.removeEventListener('resize', measureCanvas);
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragSessionRef.current;
      if (!ds || e.pointerId !== ds.pointerId) return;
      const dx = e.clientX - ds.startClientX;
      const dy = e.clientY - ds.startClientY;
      if (!ds.moved && Math.hypot(dx, dy) < 5) return;
      if (!ds.moved) {
        ds.moved = true;
        setSelectedIconId(ds.id);
      }

      const maxX = Math.max(20, ds.canvasW - DESKTOP_GRID_METRICS.iconW - 8);
      const maxY = Math.max(18, ds.canvasH - DESKTOP_GRID_METRICS.iconH - 8);
      const rawX = Math.max(6, Math.min(maxX, ds.originPxX + dx));
      const rawY = Math.max(6, Math.min(maxY, ds.originPxY + dy));

      const cap = gridCapRef.current;
      const occupiedOthers = new Set<string>();
      for (const [k, v] of Object.entries(iconCellsRef.current)) {
        if (k !== ds.id) occupiedOthers.add(cellKey(v));
      }
      const desired = pxToGridCell(rawX, rawY, cap.cols, cap.rows);
      const snapCell = findNearestFreeGridCell(
        desired.col,
        desired.row,
        occupiedOthers,
        cap.cols,
        cap.rows
      );

      setDragLivePos({
        id: ds.id,
        x: rawX,
        y: rawY,
        snapCell,
      });
    };

    const onPointerEnd = (e: PointerEvent) => {
      const ds = dragSessionRef.current;
      if (!ds || e.pointerId !== ds.pointerId) return;
      if (ds.moved) {
        suppressClickIdRef.current = ds.id;
        window.setTimeout(() => {
          if (suppressClickIdRef.current === ds.id) {
            suppressClickIdRef.current = null;
          }
        }, 80);

        const maxX = Math.max(20, ds.canvasW - DESKTOP_GRID_METRICS.iconW - 8);
        const maxY = Math.max(18, ds.canvasH - DESKTOP_GRID_METRICS.iconH - 8);
        const rawX = Math.max(6, Math.min(maxX, ds.originPxX + (e.clientX - ds.startClientX)));
        const rawY = Math.max(6, Math.min(maxY, ds.originPxY + (e.clientY - ds.startClientY)));
        const cap = gridCapRef.current;
        const occupiedOthers = new Set<string>();
        for (const [k, v] of Object.entries(iconCellsRef.current)) {
          if (k !== ds.id) occupiedOthers.add(cellKey(v));
        }
        const desired = pxToGridCell(rawX, rawY, cap.cols, cap.rows);
        const snapped = findNearestFreeGridCell(
          desired.col,
          desired.row,
          occupiedOthers,
          cap.cols,
          cap.rows
        );
        setIconCells((prev) => ({
          ...prev,
          [ds.id]: snapped,
        }));
      }
      dragSessionRef.current = null;
      setDragLivePos(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  useEffect(() => {
    const onDocPointerDown = (e: MouseEvent) => {
      if (!startMenuOpen) return;
      const target = e.target as Node | null;
      if (startWrapRef.current && target && !startWrapRef.current.contains(target)) {
        setStartMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (startMenuOpen) {
        setStartMenuOpen(false);
        return;
      }
      if (focusedWindow === 'hatred-book' && hatredBookState === 'open') {
        setHatredBookState('closed');
      } else if (recycleState === 'open') {
        setRecycleState('closed');
      } else if (hatredBookState === 'open') {
        setHatredBookState('closed');
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [startMenuOpen, recycleState, hatredBookState, focusedWindow]);

  const showWexinPlaceholderHint = () => {
    onPlayUiClick?.();
    if (m1EndingStage === 'wexin-popup' || (escapedReality && m1EndingStage === 'completed')) {
      setWexinManualPopupOpen(true);
      return;
    }
    setWexinNotice('[维心] 本地客户端未挂载通讯证书，当前暂无可用对话。');
    if (wexinTimerRef.current !== null) window.clearTimeout(wexinTimerRef.current);
    wexinTimerRef.current = window.setTimeout(() => {
      setWexinNotice(null);
      wexinTimerRef.current = null;
    }, 3200);
  };

  const triggerMinganLaunch = () => {
    if (isConnecting) return;
    onPlayUiClick?.();
    setStartMenuOpen(false);
    setIsConnecting(true);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    launchTimerRef.current = window.setTimeout(
      () => {
        setIsConnecting(false);
        onLaunchMingan();
      },
      reduced ? 80 : 480
    );
  };

  const handleRestoreMinganToDesktop = () => {
    if (minganRestored) return;
    onPlayUiClick?.();
    const occupied = new Set<string>();
    for (const v of Object.values(iconCellsRef.current)) {
      occupied.add(cellKey(v));
    }
    const cap = gridCapRef.current;
    const restoredCell = findNearestFreeGridCell(
      MINGAN_RESTORED_ICON_CONFIG.defaultCell.col,
      MINGAN_RESTORED_ICON_CONFIG.defaultCell.row,
      occupied,
      cap.cols,
      cap.rows
    );
    setIconCells((prev) => ({
      ...prev,
      [MINGAN_RESTORED_ICON_CONFIG.id]: restoredCell,
    }));
    setMinganRestored(true);
    setRecycleState('closed');
    setSelectedIconId(MINGAN_RESTORED_ICON_CONFIG.id);
    setRestoredNotice('已将「黑域协议网.lnk」还原回桌面！请双击桌面图标打开接入。');
    if (restoredTimerRef.current !== null) window.clearTimeout(restoredTimerRef.current);
    restoredTimerRef.current = window.setTimeout(() => {
      setRestoredNotice(null);
      restoredTimerRef.current = null;
    }, 4200);
  };

  const handleOpenRecycle = () => {
    onPlayUiClick?.();
    setStartMenuOpen(false);
    setRecycleState('open');
    setFocusedWindow('recycle');
    if (!minganRestored) {
      setSelectedRecycleItemId('mingan-lnk');
    }
  };

  const handleOpenHatredBook = () => {
    onPlayUiClick?.();
    setStartMenuOpen(false);
    setHatredBookState('open');
    setFocusedWindow('hatred-book');
  };

  const handleCloseHatredBook = () => {
    onPlayUiClick?.();
    setHatredBookState('closed');
    if (m1EndingStage === 'entry-written') {
      if (blackdomainTimerRef.current !== null) {
        window.clearTimeout(blackdomainTimerRef.current);
        blackdomainTimerRef.current = null;
      }
      setM1EndingStage('blackdomain-popup');
    }
  };

  const handleAddHatredEscapeEntry = () => {
    if (hatredBookEscapeEntryAdded) return;
    onPlayUiClick?.();
    setHatredBookEscapeEntryAdded(true);
    setM1EndingStage('entry-written');
    window.requestAnimationFrame(() => {
      if (notepadBodyRef.current) {
        notepadBodyRef.current.scrollTop = notepadBodyRef.current.scrollHeight;
      }
    });
  };

  const handleCloseBlackdomainPopup = () => {
    onPlayUiClick?.();
    setM1EndingStage('wexin-popup');
  };

  const handleCloseWexinPopup = () => {
    onPlayUiClick?.();
    if (m1EndingStage === 'wexin-popup') {
      setM1EndingStage('completed');
    }
    setWexinManualPopupOpen(false);
  };

  const isNarrowTouch = () =>
    typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleIconPointerDown = (
    id: string,
    e: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (e.button !== 0 || isNarrowTouch()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = iconCells[id] ?? { col: 0, row: 0 };
    const px = gridCellToPx(cell.col, cell.row);
    dragSessionRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originPxX: px.x,
      originPxY: px.y,
      canvasW: Math.max(240, canvas.clientWidth),
      canvasH: Math.max(200, canvas.clientHeight),
      moved: false,
    };
  };

  const activateIconByDoubleOrEnter = (item: DesktopIconConfig) => {
    if (item.kind === 'recycle') {
      handleOpenRecycle();
    } else if (item.kind === 'wexin') {
      showWexinPlaceholderHint();
    } else if (item.kind === 'mingan-lnk') {
      triggerMinganLaunch();
    } else if (item.id === 'desktop-decor-hatred-book') {
      handleOpenHatredBook();
    }
  };

  const visibleIcons = minganRestored
    ? [DESKTOP_ALL_ICONS[0], DESKTOP_ALL_ICONS[1], MINGAN_RESTORED_ICON_CONFIG, ...DESKTOP_ALL_ICONS.slice(2)]
    : DESKTOP_ALL_ICONS;

  const snapPreviewPx = dragLivePos
    ? gridCellToPx(dragLivePos.snapCell.col, dragLivePos.snapCell.row)
    : null;

  const clock = formatClockParts(now);

  return (
    <div
      className="px-desktop-shell"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedIconId(null);
        }
      }}
      role="region"
      aria-label="MINGAN-OS 像素风电脑桌面"
    >
      {/* Wallpaper Watermark & Status Overlay */}
      <div className="px-desktop-wallpaper-grid" aria-hidden="true" />
      <div className="px-desktop-watermark" aria-hidden="true">
        <div>MINGAN-OS 98 // NODE: RL-TERMINAL</div>
        <div className="px-desktop-watermark-sub">
          {minganRestored ? 'LOCAL SESSION · SHORTCUT RESTORED' : 'LOCAL SESSION · EXTERNAL LINK OFFLINE'}
        </div>
      </div>

      {/* Draggable Snap-to-Grid Desktop Icon Canvas */}
      <div
        ref={canvasRef}
        className="px-desktop-canvas"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedIconId(null);
        }}
      >
        {snapPreviewPx && (
          <div
            className="px-desktop-grid-snap-preview"
            style={
              {
                '--desk-px-x': `${snapPreviewPx.x}px`,
                '--desk-px-y': `${snapPreviewPx.y}px`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}

        {visibleIcons.map((item) => {
          const cell = iconCells[item.id] ?? item.defaultCell;
          const isBeingDragged = dragLivePos?.id === item.id;
          const posPx = isBeingDragged
            ? { x: dragLivePos.x, y: dragLivePos.y }
            : gridCellToPx(cell.col, cell.row);
          const isRecycle = item.kind === 'recycle';
          const isWexin = item.kind === 'wexin';
          const isMinganLnk = item.kind === 'mingan-lnk';
          const isHatredBook = item.id === 'desktop-decor-hatred-book';
          const isHatredGuided =
            isHatredBook && m1EndingStage === 'guide-hatred' && hatredBookState !== 'open';
          const hasWexinBadge =
            isWexin &&
            (m1EndingStage === 'wexin-popup' || (escapedReality && m1EndingStage === 'completed'));
          const isInteractive = isRecycle || isWexin || isMinganLnk || isHatredBook;
          const isSelected = selectedIconId === item.id;

          return (
            <button
              id={item.id}
              key={item.id}
              type="button"
              className={`px-desktop-icon is-positioned ${
                isRecycle
                  ? 'is-primary-recycle'
                  : isMinganLnk
                    ? 'is-restored-shortcut'
                    : isHatredBook
                      ? 'is-hatred-book'
                      : isWexin
                        ? 'is-wexin'
                        : 'is-decor'
              } ${isSelected ? 'is-selected' : ''} ${isBeingDragged ? 'is-dragging' : ''} ${
                isHatredGuided ? 'is-m1-guided-target' : ''
              }`}
              style={
                {
                  '--desk-px-x': `${posPx.x}px`,
                  '--desk-px-y': `${posPx.y}px`,
                } as CSSProperties
              }
              onPointerDown={(e) => handleIconPointerDown(item.id, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressClickIdRef.current === item.id) {
                  suppressClickIdRef.current = null;
                  return;
                }
                if (isInteractive && isNarrowTouch()) {
                  activateIconByDoubleOrEnter(item);
                } else {
                  onPlayUiClick?.();
                  setSelectedIconId(item.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (isInteractive) activateIconByDoubleOrEnter(item);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isInteractive) {
                  e.preventDefault();
                  activateIconByDoubleOrEnter(item);
                }
              }}
              title={item.titleHint ?? `${item.label}（可拖拽自动对齐桌面网格）`}
              aria-label={item.titleHint ? `${item.label}（${item.titleHint}）` : item.label}
            >
              <span className="px-desktop-icon-glyph">
                {item.kind === 'recycle' ? (
                  <>
                    <PixelRecycleBinIcon size={34} />
                    {!minganRestored && (
                      <span className="px-desktop-bin-dot" aria-hidden="true">
                        !
                      </span>
                    )}
                  </>
                ) : item.kind === 'wexin' ? (
                  <>
                    <PixelWexinIcon size={34} />
                    {hasWexinBadge && (
                      <span className="px-desktop-wexin-dot" aria-hidden="true">
                        1
                      </span>
                    )}
                  </>
                ) : item.kind === 'mingan-lnk' ? (
                  <PixelBrokenShortcutIcon size={34} />
                ) : item.kind === 'folder-amber' ? (
                  <PixelFolderIcon size={32} tone="amber" />
                ) : item.kind === 'folder-slate' ? (
                  <PixelFolderIcon size={32} tone="slate" />
                ) : item.kind === 'image' ? (
                  <PixelImageFileIcon size={32} />
                ) : (
                  <PixelDocFileIcon size={32} accent={item.accent} />
                )}
              </span>
              <span className="px-desktop-icon-label">{item.label}</span>
              {isHatredGuided && (
                <span className="px-desktop-guide-badge" aria-hidden="true">
                  [!] 点击打开
                </span>
              )}
            </button>
          );
        })}

        {/* Bottom-left helper status hints for selected icons */}
        {selectedIconId === 'desktop-icon-recycle' && recycleState !== 'open' && (
          <div className="px-desktop-status-pill" aria-live="polite">
            <span>
              {minganRestored
                ? '已选中「回收站」· 快捷方式已还原回桌面，可双击查看残留'
                : '已选中「回收站」· 可拖拽图标，双击打开后将「黑域协议网.lnk」还原到桌面'}
            </span>
            <button
              id="desktop-btn-quick-open-recycle"
              type="button"
              className="px-desktop-inline-cta"
              onClick={handleOpenRecycle}
            >
              打开回收站
            </button>
          </div>
        )}

        {selectedIconId === 'desktop-icon-mingan' && minganRestored && (
          <div className="px-desktop-status-pill is-cyan-strong" aria-live="polite">
            <span>已还原「黑域协议网.lnk」· 双击桌面图标（或按 Enter）打开接入黑域</span>
            <button
              id="desktop-btn-quick-launch-mingan"
              type="button"
              className="px-desktop-inline-cta"
              onClick={triggerMinganLaunch}
            >
              打开黑域协议网
            </button>
          </div>
        )}

        {selectedIconId === 'desktop-decor-hatred-book' && hatredBookState !== 'open' && (
          <div className="px-desktop-status-pill is-pink" aria-live="polite">
            <span>
              {m1EndingStage === 'guide-hatred'
                ? '已安全断开黑域终端退回桌面 · 请打开「仇恨之书.txt」追加这次逃生感想'
                : '已选中「仇恨之书.txt」· 标题：别碰黑域网（双击或按 Enter 阅读）'}
            </span>
            <button
              id="desktop-btn-quick-open-hatred"
              type="button"
              className="px-desktop-inline-cta is-pink"
              onClick={handleOpenHatredBook}
            >
              {m1EndingStage === 'guide-hatred' ? '打开仇恨之书' : '打开日记'}
            </button>
          </div>
        )}

        {wexinNotice && (
          <div className="px-desktop-wexin-toast" role="status" aria-live="polite">
            <PixelWexinIcon size={18} />
            <span>{wexinNotice}</span>
          </div>
        )}

        {restoredNotice && (
          <div className="px-desktop-restored-toast" role="status" aria-live="polite">
            <PixelBrokenShortcutIcon size={18} />
            <span>{restoredNotice}</span>
          </div>
        )}
      </div>

      {/* Recycle Bin Explorer Window */}
      {recycleState === 'open' && (
        <section
          id="desktop-window-recycle"
          className={`px-win-explorer ${focusedWindow === 'recycle' ? 'is-window-focused' : ''}`}
          role="dialog"
          aria-modal="false"
          aria-label="回收站资源管理器"
          onMouseDown={() => setFocusedWindow('recycle')}
        >
          <header className="px-win-titlebar">
            <div className="px-win-title-left">
              <PixelRecycleBinIcon size={16} />
              <span>回收站 // MINGAN EXPLORER</span>
            </div>
            <div className="px-win-title-btns">
              <button
                id="recycle-btn-minimize"
                type="button"
                className="px-win-sys-btn"
                onClick={() => {
                  onPlayUiClick?.();
                  setRecycleState('minimized');
                }}
                aria-label="最小化回收站窗口"
                title="最小化"
              >
                _
              </button>
              <button
                id="recycle-btn-close"
                type="button"
                className="px-win-sys-btn is-close"
                onClick={() => {
                  onPlayUiClick?.();
                  setRecycleState('closed');
                }}
                aria-label="关闭回收站窗口"
                title="关闭"
              >
                X
              </button>
            </div>
          </header>

          <div className="px-win-addressbar">
            <span className="px-win-addr-tag">路径</span>
            <span className="px-win-addr-path">Desktop\回收站</span>
            <span className="px-win-addr-count">
              {minganRestored
                ? '2 个对象（仅剩已粉碎残留）'
                : '3 个对象（1 个可还原快捷方式）'}
            </span>
          </div>

          <div className="px-win-list-head" aria-hidden="true">
            <span>名称</span>
            <span>原位置</span>
            <span>状态</span>
          </div>

          <div className="px-win-filelist" role="listbox" aria-label="回收站项目列表">
            {!minganRestored && (
              <button
                id="recycle-item-mingan-lnk"
                type="button"
                role="option"
                aria-selected={selectedRecycleItemId === 'mingan-lnk'}
                className={`px-win-file-row is-recoverable ${
                  selectedRecycleItemId === 'mingan-lnk' ? 'is-selected' : ''
                }`}
                onClick={() => {
                  onPlayUiClick?.();
                  setSelectedRecycleItemId('mingan-lnk');
                }}
                onDoubleClick={handleRestoreMinganToDesktop}
              >
                <span className="px-win-file-name">
                  <PixelBrokenShortcutIcon size={24} />
                  <span>黑域协议网.lnk</span>
                </span>
                <span className="px-win-file-origin">C:\Terminal\Desktop</span>
                <span className="px-win-file-status is-cyan">
                  强制移除残留 · 点击下方「还原」回到桌面
                </span>
              </button>
            )}

            <button
              id="recycle-item-shred-1"
              type="button"
              role="option"
              aria-selected={false}
              disabled
              className="px-win-file-row is-shredded"
            >
              <span className="px-win-file-name">
                <PixelDocFileIcon size={22} accent="#5C667D" />
                <span>blackriver_handshake.tmp</span>
              </span>
              <span className="px-win-file-origin">C:\Windows\Temp</span>
              <span className="px-win-file-status">已彻底粉碎 [0x00]</span>
            </button>

            <button
              id="recycle-item-shred-2"
              type="button"
              role="option"
              aria-selected={false}
              disabled
              className="px-win-file-row is-shredded"
            >
              <span className="px-win-file-name">
                <PixelDocFileIcon size={22} accent="#5C667D" />
                <span>node_key_expired.bak</span>
              </span>
              <span className="px-win-file-origin">C:\Users\Terminal\Keys</span>
              <span className="px-win-file-status">已彻底粉碎 [0x00]</span>
            </button>
          </div>

          <footer className="px-win-footer">
            <div className="px-win-footer-note">
              {minganRestored
                ? hasExistingProgress
                  ? `快捷方式已回到桌面 · 检测到进度：${progressLabel ?? '黑域潜行档案'}`
                  : '快捷方式已还原回桌面，请关闭窗口并在桌面双击「黑域协议网.lnk」打开'
                : '提示：点击「还原到桌面」可将黑域协议网.lnk 放回电脑桌面'}
            </div>
            <div className="px-win-footer-actions">
              <button
                id="recycle-btn-close-footer"
                type="button"
                className="px-win-btn"
                onClick={() => {
                  onPlayUiClick?.();
                  setRecycleState('closed');
                }}
              >
                关闭
              </button>
              {!minganRestored && (
                <button
                  id="recycle-btn-restore-mingan"
                  type="button"
                  className="px-win-btn is-primary"
                  onClick={handleRestoreMinganToDesktop}
                >
                  <PixelBrokenShortcutIcon size={14} />
                  还原到桌面
                </button>
              )}
            </div>
          </footer>
        </section>
      )}

      {/* Notepad Window for 仇恨之书.txt */}
      {hatredBookState === 'open' && (
        <section
          id="desktop-window-hatred-book"
          className={`px-win-explorer px-win-notepad ${
            focusedWindow === 'hatred-book' ? 'is-window-focused' : ''
          }`}
          role="dialog"
          aria-modal="false"
          aria-label="仇恨之书.txt - 记事本"
          onMouseDown={() => setFocusedWindow('hatred-book')}
        >
          <header className="px-win-titlebar is-notepad">
            <div className="px-win-title-left">
              <PixelDocFileIcon size={16} accent="#FF2E88" />
              <span>仇恨之书.txt - 记事本 // NOTEPAD</span>
            </div>
            <div className="px-win-title-btns">
              <button
                id="hatred-btn-minimize"
                type="button"
                className="px-win-sys-btn"
                onClick={() => {
                  onPlayUiClick?.();
                  setHatredBookState('minimized');
                }}
                aria-label="最小化仇恨之书窗口"
                title="最小化"
              >
                _
              </button>
              <button
                id="hatred-btn-close"
                type="button"
                className="px-win-sys-btn is-close"
                onClick={handleCloseHatredBook}
                aria-label="关闭仇恨之书窗口"
                title="关闭"
              >
                X
              </button>
            </div>
          </header>

          <div className="px-win-addressbar">
            <span className="px-win-addr-tag">文件</span>
            <span className="px-win-addr-path">C:\Users\Terminal\Desktop\仇恨之书.txt</span>
            <span className="px-win-addr-count">
              {!hatredBookEscapeEntryAdded && (escapedReality || m1EndingStage === 'guide-hatred')
                ? 'UTF-8 // 可追加新日记'
                : 'UTF-8 // 私人日记'}
            </span>
          </div>

          <div ref={notepadBodyRef} className="px-notepad-body">
            <div className="px-notepad-headline">{HATRED_BOOK_DIARY.headline}</div>
            {HATRED_BOOK_DIARY.entries.map((entry) => (
              <article key={entry.stamp} className="px-notepad-entry">
                <div className="px-notepad-stamp">{entry.stamp}</div>
                <p className="px-notepad-paragraph">{entry.body}</p>
              </article>
            ))}
            {hatredBookEscapeEntryAdded && (
              <article
                key={HATRED_BOOK_ESCAPE_ENTRY.stamp}
                className="px-notepad-entry is-new-escape-entry"
              >
                <div className="px-notepad-stamp is-new">{HATRED_BOOK_ESCAPE_ENTRY.stamp}</div>
                <p className="px-notepad-paragraph">
                  {HATRED_BOOK_ESCAPE_ENTRY.lead}
                  <strong className="px-notepad-emph">
                    {HATRED_BOOK_ESCAPE_ENTRY.emphasis}
                  </strong>
                </p>
              </article>
            )}
          </div>

          <footer className="px-win-footer">
            <div className="px-win-footer-note">
              {hatredBookEscapeEntryAdded
                ? '已写入最新逃生条目 // 别碰黑域协议网！'
                : escapedReality || m1EndingStage === 'guide-hatred'
                  ? '提示：点击右侧「新增条目」写下刚逃出零号闸门的感想'
                  : '备注：拖进回收站的快捷方式尚未彻底清空（Desktop\\回收站）'}
            </div>
            <div className="px-win-footer-actions">
              {!hatredBookEscapeEntryAdded && (escapedReality || m1EndingStage === 'guide-hatred') && (
                <button
                  id="hatred-btn-add-entry"
                  type="button"
                  className="px-win-btn is-primary is-hatred-add"
                  onClick={handleAddHatredEscapeEntry}
                >
                  + 新增条目
                </button>
              )}
              <button
                id="hatred-btn-close-footer"
                type="button"
                className="px-win-btn"
                onClick={handleCloseHatredBook}
              >
                合上日记
              </button>
            </div>
          </footer>
        </section>
      )}

      {/* Bottom-Right Popup 1: 黑域协议网官方通缉通知 */}
      {m1EndingStage === 'blackdomain-popup' && (
        <aside
          id="desktop-popup-blackdomain"
          className="px-desktop-corner-popup is-blackdomain"
          role="dialog"
          aria-modal="false"
          aria-label="黑域协议网官方通知弹窗"
        >
          <header className="px-win-titlebar is-blackdomain-popup">
            <div className="px-win-title-left">
              <NetrunnerBrandLogo size={15} />
              <span>黑域协议网 // 官方协议通知</span>
            </div>
            <button
              id="desktop-popup-blackdomain-close"
              type="button"
              className="px-win-sys-btn is-close"
              onClick={handleCloseBlackdomainPopup}
              aria-label="关闭黑域协议网通知弹窗"
              title="关闭"
            >
              X
            </button>
          </header>

          <div className="px-corner-popup-body">
            <div className="px-corner-popup-tag is-danger">
              MINGAN-NET OFFICIAL NOTICE // 榜单变更通告
            </div>
            <h3 className="px-corner-popup-title">【官方通知】猎杀榜 NO.1 席位更替</h3>
            <p className="px-corner-popup-text">
              零号离线闸门（SEC-04）突围记录已归档，当前节点追捕序列已解除并进入现实静默状态。
            </p>
            <p className="px-corner-popup-text">
              经 <strong>黑域协议网官方榜单仲裁</strong> 核验：终端 <strong>{playerCodename}</strong>{' '}
              已正式取代原榜首，登顶全网 <strong>「猎杀榜 NO.1」</strong>。本次排名变更已在全区公开公告栏同步刷新。
            </p>
          </div>

          <footer className="px-corner-popup-footer">
            <span className="px-corner-popup-meta">ORIGIN: MINGAN_NET_GATEWAY</span>
            <button
              id="desktop-popup-blackdomain-dismiss"
              type="button"
              className="px-win-btn is-danger"
              onClick={handleCloseBlackdomainPopup}
            >
              关闭通知
            </button>
          </footer>
        </aside>
      )}

      {/* Bottom-Right Popup 2: 维心 · 林龙心消息弹窗 */}
      {(m1EndingStage === 'wexin-popup' || wexinManualPopupOpen) && (
        <aside
          id="desktop-popup-wexin-longxin"
          className="px-desktop-corner-popup is-wexin-popup"
          role="dialog"
          aria-modal="false"
          aria-label="维心新消息：林龙心"
        >
          <header className="px-win-titlebar is-wexin-popup">
            <div className="px-win-title-left">
              <PixelWexinIcon size={15} />
              <span>维心 // 收到 1 条新消息</span>
            </div>
            <button
              id="desktop-popup-wexin-top-close"
              type="button"
              className="px-win-sys-btn is-close"
              onClick={handleCloseWexinPopup}
              aria-label="关闭维心消息弹窗"
              title="关闭"
            >
              X
            </button>
          </header>

          <div className="px-corner-popup-body">
            <div className="px-wexin-sender-row">
              <div className="px-wexin-avatar-frame">
                <img
                  src={resolveLinLongxinCasualSprite('surprise')}
                  alt="林龙心"
                  className="px-wexin-popup-avatar"
                />
              </div>
              <div className="px-wexin-sender-meta">
                <span className="px-corner-popup-tag is-pink">维心好友 // 霓虹心同事</span>
                <strong className="px-wexin-sender-name">林龙心</strong>
                <span className="px-wexin-sender-time">刚刚 · 维心桌面端</span>
              </div>
            </div>

            <div className="px-wexin-msg-bubbles">
              <p>
                「等等等等……是我熬夜看错眼了吗？！我几个小时前明明刚在暗道里跟传闻中的『榜一』零小姐打了一场还输了个精光——」
              </p>
              <p>
                「怎么我刚摘下头显刷新一下公开榜单，原先那个榜一名字没了，热乎乎挂在『猎杀榜 NO.1』顶上的……变成你的代号『{playerCodename}』了啊？！！你前几天不是还骂骂咧咧说再也不碰黑域了吗？！」
              </p>
              <p>
                「我现在脑子全打结了，下班别急着跑！老地方奶茶店或者街角拉面馆随便你挑，今晚出来见一面给我好好交代清楚到底发生了什么呀！」
              </p>
            </div>
          </div>

          <footer className="px-corner-popup-footer">
            <span className="px-corner-popup-meta">点击桌面「维心」可随时重看消息</span>
            <button
              id="desktop-popup-wexin-close"
              type="button"
              className="px-win-btn is-wexin-pink"
              onClick={handleCloseWexinPopup}
            >
              收下消息
            </button>
          </footer>
        </aside>
      )}

      {/* Booting / Uplink Transition Overlay */}
      {isConnecting && (
        <div className="px-desktop-uplink-overlay" role="status" aria-live="assertive">
          <div className="px-desktop-uplink-box">
            <div className="px-desktop-uplink-title">
              UPLINKING // 黑域协议网.lnk
            </div>
            <div className="px-desktop-uplink-sub">正在绕过本地防火墙并接入黑域牌桌终端...</div>
          </div>
        </div>
      )}

      {/* Bottom Taskbar */}
      <footer id="desktop-taskbar" className="px-taskbar" aria-label="系统任务栏">
        <div ref={startWrapRef} className="px-taskbar-start-wrap">
          {startMenuOpen && (
            <nav
              id="desktop-start-menu"
              className="px-start-menu"
              aria-label="系统设置开始菜单"
            >
              <div className="px-start-menu-rail" aria-hidden="true">
                <span>MINGAN OS 98</span>
              </div>
              <div className="px-start-menu-body">
                <div className="px-start-menu-header">系统设置 // SETTINGS</div>

                {/* Inline Sound Control */}
                <div className="px-start-sound-box">
                  <button
                    id="start-menu-btn-sound-toggle"
                    type="button"
                    className={`px-start-sound-toggle ${soundSettings.enabled ? 'is-on' : ''}`}
                    onClick={() => {
                      const next = { ...soundSettings, enabled: !soundSettings.enabled };
                      onUpdateSoundSettings(next);
                    }}
                  >
                    <PixelVolumeIcon size={14} muted={!soundSettings.enabled} />
                    <span>{soundSettings.enabled ? '音效开启' : '已静音'}</span>
                  </button>
                  <label htmlFor="start-menu-input-sound-volume" className="px-start-sound-val">
                    {Math.round(soundSettings.volume * 100)}%
                  </label>
                  <input
                    id="start-menu-input-sound-volume"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    className="lc-sound-slider"
                    disabled={!soundSettings.enabled}
                    value={Math.round(soundSettings.volume * 100)}
                    onChange={(e) => {
                      onUpdateSoundSettings({
                        ...soundSettings,
                        volume: Number(e.target.value) / 100,
                      });
                    }}
                  />
                </div>

                {onEnterFreeTable && (
                  <>
                    <button
                      id="start-menu-free-table"
                      type="button"
                      className="px-start-menu-item is-accent-cyan"
                      onClick={() => {
                        onPlayUiClick?.();
                        setStartMenuOpen(false);
                        onEnterFreeTable();
                      }}
                    >
                      <PixelMenuIcon kind="contracts" size={14} />
                      <span>自由对局</span>
                    </button>
                    <div className="px-start-menu-divider" />
                  </>
                )}

                <button
                  id="start-menu-llm"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('llm');
                  }}
                >
                  <PixelMenuIcon kind="llm" size={14} />
                  <span>LLM 网关配置</span>
                </button>

                <button
                  id="start-menu-preset-wb"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('preset-wb');
                  }}
                >
                  <PixelMenuIcon kind="rules" size={14} />
                  <span>预设与世界书管理</span>
                </button>

                <button
                  id="start-menu-tuning"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('tuning');
                  }}
                >
                  <PixelMenuIcon kind="tuning" size={14} />
                  <span>对局数值调优</span>
                </button>

                <button
                  id="start-menu-rules"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('protocol');
                  }}
                >
                  <PixelMenuIcon kind="audit" size={14} />
                  <span>规则与牌型手册</span>
                </button>

                <button
                  id="start-menu-p2p"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('p2p');
                  }}
                >
                  <PixelMenuIcon kind="contracts" size={14} />
                  <span>好友联机 (P2P)</span>
                </button>

                <button
                  id="start-menu-cmd"
                  type="button"
                  className="px-start-menu-item"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onOpenSettingsTarget('cmd');
                  }}
                >
                  <PixelMenuIcon kind="tuning" size={14} />
                  <span>调试控制台 (CMD)</span>
                </button>

                <div className="px-start-menu-divider" />

                <button
                  id="start-menu-reset-save"
                  type="button"
                  className="px-start-menu-item is-danger"
                  onClick={() => {
                    onPlayUiClick?.();
                    setStartMenuOpen(false);
                    onResetSaveFromDesktop();
                  }}
                >
                  <PixelMenuIcon kind="back" size={14} />
                  <span>重置本地存档进度</span>
                </button>
              </div>
            </nav>
          )}

          <button
            id="desktop-btn-start"
            type="button"
            className={`px-taskbar-start-btn ${startMenuOpen ? 'is-active' : ''}`}
            aria-expanded={startMenuOpen}
            aria-controls="desktop-start-menu"
            onClick={() => {
              onPlayUiClick?.();
              setStartMenuOpen((prev) => !prev);
            }}
          >
            <PixelWindowsLogoIcon size={15} />
            <span>开始</span>
          </button>
        </div>

        <div className="px-taskbar-divider" aria-hidden="true" />

        <div className="px-taskbar-tasks">
          {recycleState !== 'closed' && (
            <button
              id="taskbar-btn-recycle"
              type="button"
              className={`px-taskbar-window-tab ${
                recycleState === 'open' && focusedWindow === 'recycle' ? 'is-focused' : ''
              }`}
              onClick={() => {
                onPlayUiClick?.();
                setStartMenuOpen(false);
                if (recycleState === 'open' && focusedWindow === 'recycle') {
                  setRecycleState('minimized');
                } else {
                  setRecycleState('open');
                  setFocusedWindow('recycle');
                }
              }}
            >
              <PixelRecycleBinIcon size={14} />
              <span>回收站</span>
            </button>
          )}
          {hatredBookState !== 'closed' && (
            <button
              id="taskbar-btn-hatred-book"
              type="button"
              className={`px-taskbar-window-tab ${
                hatredBookState === 'open' && focusedWindow === 'hatred-book' ? 'is-focused' : ''
              }`}
              onClick={() => {
                onPlayUiClick?.();
                setStartMenuOpen(false);
                if (hatredBookState === 'open' && focusedWindow === 'hatred-book') {
                  setHatredBookState('minimized');
                } else {
                  setHatredBookState('open');
                  setFocusedWindow('hatred-book');
                }
              }}
            >
              <PixelDocFileIcon size={14} accent="#FF2E88" />
              <span>仇恨之书.txt</span>
            </button>
          )}
          {recycleState === 'closed' && hatredBookState === 'closed' && (
            <span className="px-taskbar-standby">LOCAL_RL // STANDBY</span>
          )}
        </div>

        <div id="desktop-tray" className="px-taskbar-tray">
          <button
            id="desktop-tray-sound-btn"
            type="button"
            className="px-tray-sound-btn"
            onClick={() => {
              onUpdateSoundSettings({
                ...soundSettings,
                enabled: !soundSettings.enabled,
              });
            }}
            aria-label={soundSettings.enabled ? '静音系统音效' : '开启系统音效'}
            title={soundSettings.enabled ? '音效开启（点击静音）' : '已静音（点击开启）'}
          >
            <PixelVolumeIcon size={14} muted={!soundSettings.enabled} />
          </button>

          <div
            id="desktop-taskbar-clock"
            className="px-taskbar-clock"
            title={clock.fullTitle}
            aria-label={`系统时间 ${clock.fullTitle}`}
          >
            <span className="px-clock-time">{clock.timeShort}</span>
            <span className="px-clock-date">{clock.dateShort}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default WindowsDesktopView;
