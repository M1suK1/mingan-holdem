import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type WheelEvent,
} from 'react';
import {
  DEFAULT_CONFIG,
  type Card,
  type ContractExpression,
  type GameAction,
  type GameConfig,
  type GameState,
  type HackSkillId,
} from './engine/types.ts';
import {
  applyAction,
  computeThreeRaisePresets,
  createInitialState,
  formatRank,
  formatSuitLabel,
  getBetDiff,
  getCurrentRaiseCap,
  getEffectiveHackCost,
  getEffectiveScanCost,
  getHalfStackRaiseAmount,
  getHiddenBoardCount,
  getLegalRaiseRange,
  getMaxRaisesAllowed,
  getNextSwapFee,
  getVisibleBoardCard,
  getVisibleHandCard,
  isActionLegal,
  otherPlayer,
  startNextHand,
} from './engine/gameEngine.ts';
import { evaluateVisibleHandSummary } from './engine/evaluator.ts';
import {
  EXPRESSION_META,
  FALLBACK_CONTRACT_CHARACTER,
  deriveAiStyleFromCharacter,
  resolveVirtualEntityPortrait,
  type ContractCardSummary,
  type ContractCharacter,
} from './engine/contractCards.ts';
import {
  fetchContractCatalog,
  loadContractCharacterByFile,
  registerImportedContractCard,
} from './engine/cardRepository.ts';
import {
  createInitialCampaign,
  getActiveDisguiseEntity,
  loadCampaignState,
  resolveMatchDefeat,
  resolveMatchVictory,
  saveCampaignState,
  selectMatchDisguise,
  claimVictoryLoot,
} from './engine/campaign.ts';
import { buildPursuerDossier, getSkillById } from './engine/skillPool.ts';
import {
  loadActivePresetId,
  loadPresets,
  saveActivePresetId,
  savePresets,
  type ChatPreset,
} from './engine/presets.ts';
import {
  loadWorldbook,
  saveWorldbook,
  type WorldbookEntry,
} from './engine/worldbook.ts';
import {
  loadSavedLlmConfig,
  requestEncounterDialogue,
  requestLlmPokerDecision,
  requestOpponentChatReply,
  saveLlmConfigToStorage,
  type ChatDialogueSegment,
  type ChatMessage,
  type LlmCallLog,
  type LlmConfig,
} from './engine/llmClient.ts';
import { LocalAiAgent } from './engine/aiAgent.ts';
import { CyberBackdrop } from './components/CyberBackdrop.tsx';
import { ComputePoolBar } from './components/ComputePoolBar.tsx';
import { CyberCard3D } from './components/CyberCard3D.tsx';
import {
  PixelBroadcastIcon,
  PixelChatIcon,
  PixelFlipSuitIcon,
  PixelGearIcon,
  PixelHoldIcon,
  PixelMenuIcon,
  PixelMinusOneIcon,
  PixelNodesIcon,
  PixelPlusOneIcon,
  PixelRestartIcon,
  PixelScanIcon,
  PixelSendIcon,
  PixelSeverIcon,
  PixelSurgeIcon,
  PixelSwitchUserIcon,
  PixelSyncIcon,
  PixelTierIcon,
} from './components/CyberIcons.tsx';
import {
  ConfirmCyberModal,
  CyberToastHub,
  type CyberToast,
} from './components/CyberToastHub.tsx';

const ContractArchiveModal = lazy(() => import('./components/ContractArchiveModal.tsx'));
const LlmTerminalModal = lazy(() => import('./components/LlmTerminalModal.tsx'));
const PresetWorldbookModal = lazy(() => import('./components/PresetWorldbookModal.tsx'));
const CampaignOutcomeModal = lazy(() => import('./components/CampaignOutcomeModal.tsx'));
const ProtocolManualModal = lazy(() => import('./components/ProtocolManualModal.tsx'));
const SandboxTuningModal = lazy(() => import('./components/SandboxTuningModal.tsx'));

const SETTINGS_MENU_ITEMS: Array<{
  id: string;
  keyName: 'contracts' | 'llm' | 'preset-wb' | 'rules' | 'audit' | 'tuning';
  label: string;
  note: string;
  icon: 'contracts' | 'llm' | 'rules' | 'audit' | 'tuning';
}> = [
  { id: 'menu-contracts', keyName: 'contracts', label: '追捕者档案', note: '切换契约角色并预览现实礼装/虚拟实体双态', icon: 'contracts' },
  { id: 'menu-llm', keyName: 'llm', label: 'LLM 网关', note: '配置 OpenAI 兼容或 Google Vertex AI 接入', icon: 'llm' },
  { id: 'menu-preset-wb', keyName: 'preset-wb', label: '预设与世界书', note: '编辑 SillyTavern 兼容预设词条与世界书注入', icon: 'rules' },
  { id: 'menu-rules', keyName: 'rules', label: '概率与规则', note: '双花色牌型阶梯与黑域实体规则', icon: 'rules' },
  { id: 'menu-audit', keyName: 'audit', label: '对局流水', note: '查看历史出牌与动作日志', icon: 'audit' },
  { id: 'menu-tuning', keyName: 'tuning', label: '数值调优', note: '筹码规模、换牌门票与AI风格', icon: 'tuning' },
];

const BACK_PORTRAIT_STREAMS = [
  { left: '6%', tokens: '01001101  0x7F  SYN::ACK  B_08', dur: '11s', delay: '-1s' },
  { left: '19%', tokens: 'HEX::2E88  110010  MEM::04  BIT', dur: '14s', delay: '-5s' },
  { left: '33%', tokens: '0xA4  HASH::0040  ICE::LINK  101', dur: '10s', delay: '-3s' },
  { left: '49%', tokens: '00110101  NET::BUS  0x1C  PORT', dur: '15s', delay: '-7s' },
  { left: '63%', tokens: 'PKT::PINK  110101  NODE_01  CRC', dur: '12s', delay: '-2s' },
  { left: '77%', tokens: '10101100  ALLOC::09  0x9E  ACK', dur: '13s', delay: '-6s' },
  { left: '91%', tokens: '01110010  ROOT::SYS  0x00  END', dur: '10.5s', delay: '-4s' },
];

const FRONT_PORTRAIT_STREAMS = [
  { left: '22%', tokens: '0xFF  OVR::SYNC  0101', dur: '9.5s', delay: '-2s', accent: false },
  { left: '57%', tokens: 'STREAM::P12  1011  0x7A', dur: '11.5s', delay: '-5.5s', accent: true },
  { left: '82%', tokens: '0110  LINK::LIVE  CRC', dur: '8.8s', delay: '-1.5s', accent: false },
];

const MOSAIC_FLICKER_TILES = Array.from({ length: 96 }, (_, i) => {
  const mod = (i * 7 + Math.floor(i / 12) * 3) % 11;
  return mod === 0 ? 't1' : mod === 2 ? 't2' : mod === 5 ? 't3' : mod === 8 ? 't4' : '';
});

const MOSAIC_FLOOD_CELLS = Array.from({ length: 140 }, (_, i) => {
  const m = (i * 5 + Math.floor(i / 14) * 7) % 9;
  return m <= 1 ? 'pink' : m <= 3 ? 'cyan' : m <= 6 ? 'void' : '';
});

const FIXED_CRUSHED_DOCK_H = 28;

type ActiveModal =
  | { type: 'none' }
  | { type: 'settings-menu' }
  | { type: 'contracts' }
  | { type: 'llm' }
  | { type: 'preset-wb'; section: 'preset' | 'worldbook' }
  | { type: 'protocol'; tab: 'rules' | 'suits' | 'audit' }
  | { type: 'tuning' }
  | { type: 'confirm-reset' };

interface ChatItem {
  id: string;
  sender: 'opponent' | 'human';
  speaker: string;
  text: string;
  msgKind?: 'speech' | 'thought';
  crushed: boolean;
  anim?: 'player-rising';
  riseDy?: number;
}

interface FloatingBubbleState {
  id: string;
  speaker: string;
  text: string;
  msgKind?: 'speech' | 'thought';
  contactDy: number;
  dropDy: number;
}

type QueuedChatTask =
  | { kind: 'opponent'; speaker: string; text: string; msgKind?: 'speech' | 'thought' }
  | { kind: 'human'; text: string };

interface SwapFlightCard {
  rect: { left: number; top: number; width: number; height: number };
  dx: number;
  dy: number;
  card?: Card;
  faceDown: boolean;
  isOwnPrivate?: boolean;
}

interface SwapFlightState {
  id: string;
  actor: 'human' | 'ai';
  handIndex: number;
  boardIndex: number;
  handToBoard: SwapFlightCard;
  boardToHand: SwapFlightCard;
}

export function App() {
  const [character, setCharacter] = useState<ContractCharacter>(FALLBACK_CONTRACT_CHARACTER);
  const [catalog, setCatalog] = useState<ContractCardSummary[]>([FALLBACK_CONTRACT_CHARACTER]);
  const [catalogSource, setCatalogSource] = useState<'api' | 'static' | 'fallback'>('fallback');
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  const [campaign, setCampaign] = useState(() => loadCampaignState());
  const [state, setState] = useState<GameState>(() =>
    createInitialState({
      config: DEFAULT_CONFIG,
      opponentName: FALLBACK_CONTRACT_CHARACTER.name,
      playerAcquiredSkills: loadCampaignState().acquiredSkills,
    })
  );
  const [activeExpression, setActiveExpression] = useState<ContractExpression>('calm');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [draggedHandIndex, setDraggedHandIndex] = useState<number | null>(null);
  const [dragOverBoardIndex, setDragOverBoardIndex] = useState<number | null>(null);
  const [showRaiseTiers, setShowRaiseTiers] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [pendingSkillTargetId, setPendingSkillTargetId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [activeModal, setActiveModal] = useState<ActiveModal>({ type: 'none' });
  const [activeMenuId, setActiveMenuId] = useState('menu-contracts');

  // VFX state & optional manual test override inside Settings
  const [roundLossFlicker, setRoundLossFlicker] = useState(false);
  const [aiRoundLossFlicker, setAiRoundLossFlicker] = useState(false);
  const [vfxTestMode, setVfxTestMode] = useState<'auto' | 'low' | 'bankrupt'>('auto');
  const [swapFlight, setSwapFlight] = useState<SwapFlightState | null>(null);
  const [scanVfx, setScanVfx] = useState<{
    id: string;
    rect: { left: number; top: number; width: number; height: number };
    caught: boolean;
  } | null>(null);

  const holdIntervalRef = useRef<number | null>(null);
  const lastHandledScanIdRef = useRef<string | null>(null);

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadSavedLlmConfig());
  const [llmLogs, setLlmLogs] = useState<LlmCallLog[]>([]);
  const [presets, setPresets] = useState<ChatPreset[]>(() => loadPresets());
  const [activePresetId, setActivePresetId] = useState<string>(() => loadActivePresetId(loadPresets()));
  const [worldbook, setWorldbook] = useState<WorldbookEntry[]>(() => loadWorldbook());
  const [manualDisguiseOpen, setManualDisguiseOpen] = useState(false);
  const [toasts, setToasts] = useState<CyberToast[]>([]);

  const dossier = useMemo(
    () => buildPursuerDossier(character, campaign.roundIndex),
    [character, campaign.roundIndex]
  );
  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? presets[0],
    [presets, activePresetId]
  );
  const activeDisguise = useMemo(() => getActiveDisguiseEntity(campaign), [campaign]);

  useEffect(() => {
    saveCampaignState(campaign);
  }, [campaign]);

  const latestCampaignRef = useRef(campaign);
  latestCampaignRef.current = campaign;
  const latestDossierRef = useRef(dossier);
  latestDossierRef.current = dossier;
  const latestPresetRef = useRef(activePreset);
  latestPresetRef.current = activePreset;
  const latestWorldbookRef = useRef(worldbook);
  latestWorldbookRef.current = worldbook;

  const buildChatHistorySnapshot = useCallback((): ChatMessage[] => {
    const settled: ChatMessage[] = messagesRef.current.map((m, idx) => ({
      id: m.id,
      sender: m.sender,
      speakerName: m.speaker,
      text: m.text,
      msgKind: m.msgKind,
      timestamp: idx,
    }));
    const toChatMsg = (task: QueuedChatTask, idPrefix: string, idx: number): ChatMessage =>
      task.kind === 'human'
        ? {
            id: `${idPrefix}-h-${idx}`,
            sender: 'human',
            speakerName: '潜行黑客',
            text: task.text,
            timestamp: settled.length + idx,
          }
        : {
            id: `${idPrefix}-o-${idx}`,
            sender: 'opponent',
            speakerName: task.speaker,
            text: task.text,
            msgKind: task.msgKind,
            timestamp: settled.length + idx,
          };
    const inFlight = inFlightTaskRef.current
      ? [toChatMsg(inFlightTaskRef.current, 'inflight', 0)]
      : [];
    const pending: ChatMessage[] = queueRef.current.map((q, idx) =>
      toChatMsg(q, 'q', idx + 1)
    );
    return [...settled, ...inFlight, ...pending].slice(-16);
  }, []);

  // Chat Stack & FIFO Bubble Queue
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'init-msg-1',
      sender: 'opponent',
      speaker: FALLBACK_CONTRACT_CHARACTER.name,
      text: '协议连接建立。直接拖牌互换或点击暗牌翻开，让我看看你的牌序。',
      crushed: false,
    },
  ]);
  const [crushingActive, setCrushingActive] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [floatingBubble, setFloatingBubble] = useState<FloatingBubbleState | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [queuedCount, setQueuedCount] = useState(0);

  const chatPanelRef = useRef<HTMLElement | null>(null);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const activeStackRef = useRef<HTMLDivElement | null>(null);

  const queueRef = useRef<QueuedChatTask[]>([]);
  const inFlightTaskRef = useRef<QueuedChatTask | null>(null);
  const isAnimatingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const wheelAccumRef = useRef(0);
  const hasBootedRef = useRef(false);
  const lastHandledSwapIdRef = useRef<string | null>(null);
  const lastHandledShowdownHandRef = useRef<number>(0);
  const pendingBundledChatRef = useRef<string | null>(null);
  const resetEpochRef = useRef(0);
  const chatDraftRef = useRef('');
  chatDraftRef.current = chatDraft;

  const agentRef = useRef(
    new LocalAiAgent('ai', DEFAULT_CONFIG.aiStyle, FALLBACK_CONTRACT_CHARACTER)
  );
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const latestLlmRef = useRef(llmConfig);
  latestLlmRef.current = llmConfig;
  const latestCharRef = useRef(character);
  latestCharRef.current = character;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const charNameRef = useRef(character.name);
  charNameRef.current = character.name;

  const pushToast = useCallback(
    (tone: CyberToast['tone'], title: string, detail?: string) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 3600);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    agentRef.current.setStyle(state.config.aiStyle);
    agentRef.current.setCharacter(character);
  }, [state.config.aiStyle, character]);

  // Load Night-Sugar-Office Contract Catalog & Default Character
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { cards, source } = await fetchContractCatalog();
      if (cancelled) return;
      setCatalog(cards);
      setCatalogSource(source);

      const preferred =
        cards.find((c) => c.name === '银狼') ??
        cards.find((c) => c.name === '伊冯') ??
        cards[0];
      if (preferred) {
        const full = await loadContractCharacterByFile(preferred.fileName);
        if (cancelled) return;
        setCharacter(full);
        setState((prev) => ({
          ...prev,
          players: {
            ...prev.players,
            ai: { ...prev.players.ai, name: full.name },
          },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getWindowCapacity = useCallback(() => {
    const feedH = chatFeedRef.current?.clientHeight ?? 460;
    return Math.max(3, Math.floor((feedH - FIXED_CRUSHED_DOCK_H - 18) / 78));
  }, []);

  const willOverflowStack = useCallback(() => {
    const feedEl = chatFeedRef.current;
    const stackEl = activeStackRef.current;
    const currentMsgs = messagesRef.current;
    const uncrushed = currentMsgs.filter((m) => !m.crushed);
    if (!feedEl || !stackEl || uncrushed.length === 0) return false;

    const crushedCount = currentMsgs.length - uncrushed.length;
    const dockH = crushedCount > 0 ? FIXED_CRUSHED_DOCK_H + 6 : 0;
    return stackEl.offsetHeight + 78 >= feedEl.clientHeight - dockH - 14;
  }, []);

  const computeCoupledDropMetrics = useCallback((willCrush: boolean, text: string) => {
    const panelH = chatPanelRef.current?.clientHeight ?? 520;
    const headerH = 31;
    const formH = 43;
    const feedBottomPad = 8;
    const estLines = Math.max(1, Math.ceil(text.length / 17));
    const estBubbleH = 34 + estLines * 17;

    const currentMsgs = messagesRef.current;
    const crushedCount = currentMsgs.filter((m) => m.crushed).length;
    const currentStackH = activeStackRef.current?.offsetHeight ?? 0;
    const feedBottomY = panelH - formH - feedBottomPad;

    if (willCrush) {
      const currentDockH = crushedCount > 0 ? FIXED_CRUSHED_DOCK_H + 6 : 0;
      const stackTopY = feedBottomY - currentDockH - currentStackH;
      const contactTopY = stackTopY - estBubbleH;
      const contactDy = Math.max(headerH + 8 - 42, Math.round(contactTopY - 42));

      const landingTopY = feedBottomY - (FIXED_CRUSHED_DOCK_H + 6) - estBubbleH;
      const dropDy = Math.max(contactDy + 24, Math.round(landingTopY - 42));
      return { contactDy, dropDy };
    }

    const gap = currentMsgs.some((m) => !m.crushed) ? 8 : 0;
    const dockH = crushedCount > 0 ? FIXED_CRUSHED_DOCK_H + 6 : 0;
    const landingTopY = feedBottomY - dockH - currentStackH - gap - estBubbleH;
    const dropDy = Math.max(headerH + 8, Math.round(landingTopY - 42));
    const contactDy = Math.round(dropDy * 0.48);
    return { contactDy, dropDy };
  }, []);

  // Strict FIFO Speech Queue
  const processNextTask = useCallback(() => {
    if (isAnimatingRef.current) return;
    const next = queueRef.current.shift();
    setQueuedCount(queueRef.current.length);
    if (!next) return;

    inFlightTaskRef.current = next;
    isAnimatingRef.current = true;
    setHistoryOffset(0);
    setEnteringId(null);

    scheduleTimeout(() => {
      if (next.kind === 'opponent') {
        const id = `opp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const willCrush = willOverflowStack();
        const { contactDy, dropDy } = computeCoupledDropMetrics(willCrush, next.text);

        setFloatingBubble({
          id,
          speaker: next.speaker,
          text: next.text,
          msgKind: next.msgKind ?? 'speech',
          contactDy,
          dropDy,
        });

        if (willCrush) {
          scheduleTimeout(() => {
            setCrushingActive(true);
          }, 2183);
        }

        scheduleTimeout(() => {
          setFloatingBubble(null);
          setCrushingActive(false);
          if (inFlightTaskRef.current === next) inFlightTaskRef.current = null;
          setMessages((prev) => {
            const base = willCrush ? prev.map((m) => (m.crushed ? m : { ...m, crushed: true })) : prev;
            return [
              ...base,
              {
                id,
                sender: 'opponent',
                speaker: next.speaker,
                text: next.text,
                msgKind: next.msgKind ?? 'speech',
                crushed: false,
              },
            ];
          });
          isAnimatingRef.current = false;
          processNextTask();
        }, 2950);
      } else {
        const id = `ply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const willCrush = willOverflowStack();

        const spawnHumanRise = (riseDy: number, crushPrev: boolean) => {
          setCrushingActive(false);
          if (inFlightTaskRef.current === next) inFlightTaskRef.current = null;
          setMessages((prev) => {
            const base = crushPrev ? prev.map((m) => (m.crushed ? m : { ...m, crushed: true })) : prev;
            return [
              ...base,
              {
                id,
                sender: 'human',
                speaker: '潜行黑客',
                text: next.text,
                crushed: false,
                anim: 'player-rising',
                riseDy,
              },
            ];
          });

          scheduleTimeout(() => {
            isAnimatingRef.current = false;
            processNextTask();
          }, 560);
        };

        if (willCrush) {
          setCrushingActive(true);
          scheduleTimeout(() => {
            spawnHumanRise(48, true);
          }, 767);
        } else {
          const stackH = activeStackRef.current?.offsetHeight ?? 0;
          spawnHumanRise(stackH + 48, false);
        }
      }
    }, 30);
  }, [computeCoupledDropMetrics, scheduleTimeout, willOverflowStack]);

  const enqueueTask = useCallback(
    (task: QueuedChatTask) => {
      queueRef.current.push(task);
      setQueuedCount(queueRef.current.length);
      processNextTask();
    },
    [processNextTask]
  );

  const enqueueOpponentSegments = useCallback(
    (speaker: string, segments: ChatDialogueSegment[]) => {
      const capped = segments.slice(0, 3);
      for (const seg of capped) {
        const cleanText = seg.text.trim().slice(0, 200);
        if (!cleanText) continue;
        enqueueTask({
          kind: 'opponent',
          speaker,
          text: cleanText,
          msgKind: seg.kind,
        });
      }
    },
    [enqueueTask]
  );

  // One-shot opening speech on mount
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;

    const boot = window.setTimeout(() => {
      enqueueTask({
        kind: 'opponent',
        speaker: FALLBACK_CONTRACT_CHARACTER.name,
        text: FALLBACK_CONTRACT_CHARACTER.quote,
      });
    }, 450);

    return () => {
      window.clearTimeout(boot);
      for (const id of timersRef.current) {
        window.clearTimeout(id);
      }
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset raise panel & transient modes on turn/action changes
  useEffect(() => {
    setShowRaiseTiers(false);
    setScanMode(false);
    setPendingSkillTargetId(null);
    setHoldProgress(0);
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, [state.handNumber, state.actionHistory.length, state.currentTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeModal.type !== 'none') {
          setActiveModal({ type: 'none' });
        } else {
          setShowRaiseTiers(false);
          setScanMode(false);
          setSelectedHandIndex(null);
          setDraggedHandIndex(null);
          setDragOverBoardIndex(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal.type]);

  // Dual-Card Smooth Swap Flight Animation (Triggers for BOTH Player AND Opponent swaps!)
  useEffect(() => {
    const evt = state.lastAction;
    if (!evt || evt.type !== 'swap') return;
    if (evt.handIndex === undefined || evt.boardIndex === undefined) return;
    if (lastHandledSwapIdRef.current === evt.id) return;
    lastHandledSwapIdRef.current = evt.id;

    const handEl = document.getElementById(
      evt.actor === 'human'
        ? `human-hand-card-${evt.handIndex}`
        : `opponent-hand-card-${evt.handIndex}`
    );
    const boardEl = document.getElementById(`board-node-card-${evt.boardIndex}`);
    if (!handEl || !boardEl) return;

    const handRect = handEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();

    const boardSlot = state.board[evt.boardIndex];
    const handHc = state.players[evt.actor].hand[evt.handIndex];
    const revealAll = state.phase === 'showdown' || state.config.revealOpponentHidden;
    const boardCard = boardSlot ? getVisibleBoardCard(boardSlot, 'human', revealAll) : undefined;
    const hideHandFace = evt.actor === 'ai' && !revealAll;
    const handCard = handHc
      ? getVisibleHandCard(handHc, 'human', evt.actor, revealAll)
      : undefined;

    setSwapFlight({
      id: evt.id,
      actor: evt.actor,
      handIndex: evt.handIndex,
      boardIndex: evt.boardIndex,
      handToBoard: {
        rect: {
          left: handRect.left,
          top: handRect.top,
          width: handRect.width,
          height: handRect.height,
        },
        dx: boardRect.left - handRect.left,
        dy: boardRect.top - handRect.top,
        card: boardCard,
        faceDown: false,
      },
      boardToHand: {
        rect: {
          left: boardRect.left,
          top: boardRect.top,
          width: boardRect.width,
          height: boardRect.height,
        },
        dx: handRect.left - boardRect.left,
        dy: handRect.top - boardRect.top,
        card: hideHandFace ? undefined : handCard,
        faceDown: hideHandFace,
        isOwnPrivate: evt.actor === 'human',
      },
    });

    const timer = window.setTimeout(() => {
      setSwapFlight((curr) => (curr?.id === evt.id ? null : curr));
    }, 580);

    return () => window.clearTimeout(timer);
  }, [state.lastAction, state.board, state.players, state.phase, state.config.revealOpponentHidden]);

  // AI Turn Scheduler
  useEffect(() => {
    if (state.phase === 'showdown' || state.currentTurn !== 'ai') return;

    let cancelled = false;
    setIsAiThinking(true);

    const timer = window.setTimeout(async () => {
      try {
        const snapshot = latestStateRef.current;
        if (snapshot.phase === 'showdown' || snapshot.currentTurn !== 'ai') return;

        const cfg = latestLlmRef.current;
        const char = latestCharRef.current;
        const epoch = resetEpochRef.current;
        const bundledUserText = pendingBundledChatRef.current ?? undefined;
        pendingBundledChatRef.current = null;
        const historyBeforeAction = buildChatHistorySnapshot();

        const llmDecision = await requestLlmPokerDecision({
          character: char,
          state: snapshot,
          llmConfig: cfg,
          chatHistory: historyBeforeAction,
          campaign: latestCampaignRef.current,
          dossier: latestDossierRef.current,
          preset: latestPresetRef.current,
          worldbook: latestWorldbookRef.current,
          bundledUserText,
        });

        if (cancelled || resetEpochRef.current !== epoch) return;

        if (llmDecision) {
          setLlmLogs((prev) => [llmDecision.logEntry, ...prev].slice(0, 40));
          setActiveExpression(llmDecision.expression);
          enqueueOpponentSegments(char.name, llmDecision.segments);
          setState((prev) => {
            if (prev.phase === 'showdown' || prev.currentTurn !== 'ai') return prev;
            return applyAction(prev, llmDecision.action);
          });
          return;
        }

        const decision = await agentRef.current.decide(snapshot);
        if (cancelled || resetEpochRef.current !== epoch) return;
        const nextAfterAi = applyAction(snapshot, decision.action);
        setState((prev) => {
          if (prev.phase === 'showdown' || prev.currentTurn !== 'ai') return prev;
          return nextAfterAi;
        });

        if (bundledUserText && cfg.enabled) {
          const chatRes = await requestOpponentChatReply({
            character: char,
            state: nextAfterAi,
            llmConfig: cfg,
            chatHistory: historyBeforeAction,
            userText: bundledUserText,
            actionContextNote: `你刚才已执行牌桌操作：${nextAfterAi.lastAction?.label ?? decision.action.type}`,
            campaign: latestCampaignRef.current,
            dossier: latestDossierRef.current,
            preset: latestPresetRef.current,
            worldbook: latestWorldbookRef.current,
          });
          if (resetEpochRef.current !== epoch) return;
          if (chatRes.logEntry) setLlmLogs((prev) => [chatRes.logEntry!, ...prev].slice(0, 40));
          setActiveExpression(chatRes.expression);
          enqueueOpponentSegments(char.name, chatRes.segments);
        } else {
          setActiveExpression(decision.dialogue.expression);
          if (decision.action.type !== 'hack') {
            enqueueTask({
              kind: 'opponent',
              speaker: char.name,
              text: decision.dialogue.text,
            });
          }
        }
      } finally {
        if (!cancelled) setIsAiThinking(false);
      }
    }, state.config.aiDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    state.handNumber,
    state.currentTurn,
    state.phase,
    state.justCalledThisTurn,
    state.actionHistory.length,
    state.config.aiDelayMs,
    enqueueTask,
    enqueueOpponentSegments,
    buildChatHistorySnapshot,
  ]);

  // Scan action laser sweep VFX + toast feedback (Triggers for BOTH Player & Opponent!)
  useEffect(() => {
    const evt = state.lastAction;
    if (!evt || evt.type !== 'scan') return;
    if (lastHandledScanIdRef.current === evt.id) return;
    lastHandledScanIdRef.current = evt.id;

    if (evt.targetKind !== undefined && evt.targetIndex !== undefined) {
      let targetId: string;
      if (evt.targetKind === 'board') {
        targetId = `board-node-card-${evt.targetIndex}`;
      } else {
        targetId =
          evt.actor === 'human'
            ? `opponent-hand-card-${evt.targetIndex}`
            : `human-hand-card-${evt.targetIndex}`;
      }
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        setScanVfx({
          id: evt.id,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          caught: Boolean(evt.caught),
        });
        window.setTimeout(() => {
          setScanVfx((curr) => (curr?.id === evt.id ? null : curr));
        }, 980);
      }
    }

    if (evt.caught) {
      pushToast(
        evt.actor === 'human' ? 'success' : 'error',
        evt.actor === 'human' ? '扫描抓获对端篡改！' : `${character.name} 扫描抓获了我方篡改！`,
        evt.label
      );
    } else {
      pushToast(
        'info',
        evt.actor === 'human' ? '扫描核验完成：未被篡改' : `${character.name} 扫描未发现异常`,
        `已预支 ${evt.amount ?? state.config.scanCost} 算力至奖池`
      );
    }
  }, [state.lastAction, state.config.scanCost, character.name, pushToast]);

  // Showdown reaction + Round Loss Mosaic Flicker (Both Player & Opponent!)
  useEffect(() => {
    if (state.phase !== 'showdown' || !state.result) return;
    if (lastHandledShowdownHandRef.current === state.handNumber) return;
    lastHandledShowdownHandRef.current = state.handNumber;

    const res = state.result;
    const expr: ContractExpression =
      res.winner === 'ai' ? 'smile' : res.winner === 'human' ? 'sad' : 'surprise';
    setActiveExpression(expr);

    if (res.winner === 'ai') {
      setRoundLossFlicker(true);
      window.setTimeout(() => setRoundLossFlicker(false), 1200);
    } else if (res.winner === 'human') {
      setAiRoundLossFlicker(true);
      window.setTimeout(() => setAiRoundLossFlicker(false), 1200);
    }

    const line =
      res.reason === 'scan-caught'
        ? res.winner === 'human'
          ? `切……居然被你扫出底层篡改了？算力池 ${res.potWon} 归你，这手技能也被封印了。`
          : `抓到你偷偷改牌了哦！直接判负并封印技能，奖池 ${res.potWon} 我收下了。`
        : res.winner === 'ai'
          ? `算力池 ${res.potWon} 已被我全数接管。下一局还要继续接入吗？`
          : res.winner === 'human'
            ? `漂亮的牌序博弈……这 ${res.potWon} 算力归你了，下一把我会改写策略。`
            : `完全同分平局？一人一半回收算力池，下一局再见真章。`;

    // 普通小局结束（双方筹码均未归零）：由 LLM 结合本局胜负、牌型与算力变动发表感想
    if (state.players.ai.chips > 0 && state.players.human.chips > 0) {
      const cfg = latestLlmRef.current;
      const bundledUserText = pendingBundledChatRef.current ?? undefined;
      pendingBundledChatRef.current = null;
      if (cfg.enabled && (cfg.reactAfterEachRound !== false || Boolean(bundledUserText))) {
        const currChar = latestCharRef.current;
        const winTxt =
          res.winner === 'human'
            ? '玩家胜出'
            : res.winner === 'ai'
              ? `${currChar.name}胜出`
              : '平局分池';
        const reasonTxt =
          res.reason === 'scan-caught'
            ? '扫描抓获篡改直接判胜'
            : res.reason === 'fold'
              ? '对手弃牌'
              : `摊牌比牌（我方[${res.aiEval?.categoryName ?? '未知'}] vs 玩家[${res.humanEval?.categoryName ?? '未知'}]）`;
        const roundResultSummary = `第#${state.handNumber}局${winTxt}（${reasonTxt}），奖池 ${res.potWon}；我方本局投入 ${state.players.ai.totalCommitted}（余 ${state.players.ai.chips}），玩家投入 ${state.players.human.totalCommitted}（余 ${state.players.human.chips}）。`;

        void requestEncounterDialogue({
          eventKind: 'round-settled',
          character: currChar,
          state,
          llmConfig: cfg,
          campaign: latestCampaignRef.current,
          dossier: latestDossierRef.current,
          chatHistory: buildChatHistorySnapshot(),
          preset: latestPresetRef.current,
          worldbook: latestWorldbookRef.current,
          roundResultSummary,
          bundledUserText,
        }).then((enc) => {
          if (enc.logEntry) setLlmLogs((p) => [enc.logEntry!, ...p].slice(0, 40));
          setActiveExpression(enc.expression);
          enqueueOpponentSegments(currChar.name, enc.fromLlm ? enc.segments : [{ kind: 'speech', text: line }]);
        });
      } else {
        enqueueTask({ kind: 'opponent', speaker: character.name, text: line });
      }
      return;
    }

    enqueueTask({ kind: 'opponent', speaker: character.name, text: line });

    // 整场算力归零：触发黑域协议虚拟实体夺取 / 诱饵逃脱 / 失败结局
    if (state.players.ai.chips === 0) {
      const winnerCamp = latestCampaignRef.current;
      const currDossier = latestDossierRef.current;
      const currChar = latestCharRef.current;
      const bundledUserText = pendingBundledChatRef.current ?? undefined;
      pendingBundledChatRef.current = null;
      scheduleTimeout(() => {
        const latest = latestStateRef.current;
        if (latest.phase !== 'showdown' || latest.players.ai.chips !== 0) return;
        setCampaign((prev) => resolveMatchVictory(prev, currChar, currDossier));
      }, 1150);
      void requestEncounterDialogue({
        eventKind: 'pursuer-defeated',
        character: currChar,
        state,
        llmConfig: latestLlmRef.current,
        campaign: winnerCamp,
        dossier: currDossier,
        chatHistory: buildChatHistorySnapshot(),
        preset: latestPresetRef.current,
        worldbook: latestWorldbookRef.current,
        bundledUserText,
      }).then((enc) => {
        if (enc.logEntry) setLlmLogs((p) => [enc.logEntry!, ...p].slice(0, 40));
        if (enc.fromLlm) {
          setActiveExpression(enc.expression);
          enqueueOpponentSegments(currChar.name, enc.segments);
        }
      });
    } else if (state.players.human.chips === 0) {
      const loserCamp = latestCampaignRef.current;
      const currDossier = latestDossierRef.current;
      const currChar = latestCharRef.current;
      const activeEnt = getActiveDisguiseEntity(loserCamp);
      const eventKind = activeEnt.isCore ? 'core-seized' : 'decoy-escape';
      const bundledUserText = pendingBundledChatRef.current ?? undefined;
      pendingBundledChatRef.current = null;
      scheduleTimeout(() => {
        const latest = latestStateRef.current;
        if (latest.phase !== 'showdown' || latest.players.human.chips !== 0) return;
        setCampaign((prev) => resolveMatchDefeat(prev, currChar.name, currDossier.identityTitle));
      }, 1150);
      void requestEncounterDialogue({
        eventKind,
        character: currChar,
        state,
        llmConfig: latestLlmRef.current,
        campaign: loserCamp,
        dossier: currDossier,
        chatHistory: buildChatHistorySnapshot(),
        preset: latestPresetRef.current,
        worldbook: latestWorldbookRef.current,
        detailNote: activeEnt.name,
        bundledUserText,
      }).then((enc) => {
        if (enc.logEntry) setLlmLogs((p) => [enc.logEntry!, ...p].slice(0, 40));
        if (enc.fromLlm) {
          setActiveExpression(enc.expression);
          enqueueOpponentSegments(currChar.name, enc.segments);
        }
      });
    }
  }, [state.phase, state.result, state.handNumber, state.players.ai.chips, state.players.human.chips, state, character.name, enqueueTask, enqueueOpponentSegments, scheduleTimeout, buildChatHistorySnapshot]);

  const cancelHoldHalfRaise = useCallback(() => {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  const applyActionWithPreInputBundle = (action: GameAction) => {
    const nextState = applyAction(latestStateRef.current, action);
    setState(nextState);
    const buffered = chatDraftRef.current.trim();
    if (
      buffered.length > 0 &&
      (nextState.currentTurn === 'ai' || nextState.phase === 'showdown')
    ) {
      setChatDraft('');
      pendingBundledChatRef.current = buffered;
      enqueueTask({ kind: 'human', text: buffered });
    }
  };

  const executeHumanAction = (action: GameAction) => {
    cancelHoldHalfRaise();
    setSelectedHandIndex(null);
    setDraggedHandIndex(null);
    setDragOverBoardIndex(null);
    setShowRaiseTiers(false);
    setScanMode(false);
    setPendingSkillTargetId(null);
    applyActionWithPreInputBundle(action);
  };

  const startHoldHalfRaise = (halfAmt: number) => {
    if (halfAmt <= 0 || holdIntervalRef.current !== null) return;
    const startMs = Date.now();
    const durationMs = 720;
    setHoldProgress(4);
    holdIntervalRef.current = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - startMs) / durationMs) * 100));
      setHoldProgress(pct);
      if (pct >= 100) {
        if (holdIntervalRef.current !== null) {
          window.clearInterval(holdIntervalRef.current);
          holdIntervalRef.current = null;
        }
        setHoldProgress(0);
        executeHumanAction({ type: 'raise', amount: halfAmt, isHalfStack: true });
      }
    }, 24);
  };

  const handleExecuteHack = (skill: HackSkillId) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (getBetDiff(state, 'human') > 0) {
      pushToast('warn', '遭遇加注，请先跟注', '必须先补齐跟注差额，才能使用黑客或扫描技能');
      return;
    }
    if (state.players.human.sealedSkills.includes(skill)) {
      pushToast('error', '该黑客技能已被封印', '本局对抗中无法再次使用该篡改协议');
      return;
    }
    if (selectedHandIndex === null) {
      pushToast('warn', '请先点击一张己方明牌', '黑客技能仅可对当前手上的公开明牌使用');
      return;
    }
    const action: GameAction = { type: 'hack', handIndex: selectedHandIndex, skill };
    if (!isActionLegal(state, action)) {
      const hc = state.players.human.hand[selectedHandIndex];
      const cost = getEffectiveHackCost(state, 'human', skill);
      if (state.players.human.chips < cost) {
        pushToast('warn', `算力不足（需预支 ${cost}）`);
      } else if (!hc || hc.visibility !== 'open') {
        pushToast('warn', '仅可对己方公开明牌使用篡改技能');
      } else {
        pushToast('warn', skill === 'plus-one' ? '当前已是最大点数 A' : '当前已是最小点数 2');
      }
      return;
    }
    setState((prev) => applyAction(prev, action));
    pushToast('info', '黑客协议注入成功', '改变结果仅己方可见，且可继续交换或行动');
  };

  const handleUseAcquiredSkill = (skillId: string) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (getBetDiff(state, 'human') > 0) {
      pushToast('warn', '遭遇加注，请先跟注', '必须先补齐跟注差额，才能释放掠夺技能');
      return;
    }
    if (state.usedProtocolSkillThisHand) {
      pushToast('warn', '本局已释放过掠夺技能', '每小局最多激活 1 次主动掠夺技能');
      return;
    }
    const sk = getSkillById(skillId);
    if (!sk || sk.targetMode === 'passive') return;

    if (sk.targetMode === 'hidden-board') {
      if (hiddenCount === 0) {
        pushToast('warn', '桌面已无未公开暗槽');
        return;
      }
      setPendingSkillTargetId((prev) => (prev === skillId ? null : skillId));
      setScanMode(false);
      setSelectedHandIndex(null);
      return;
    }

    let targetIndex = 0;
    if (sk.targetMode === 'human-open-hand') {
      if (selectedHandIndex === null) {
        pushToast('warn', '请先点击一张己方明牌', `选中明牌后再点击「${sk.name}」`);
        return;
      }
      targetIndex = selectedHandIndex;
    } else if (sk.targetMode === 'human-locked-hand') {
      const lockedIdx = state.players.human.hand.findIndex(
        (h) => h.visibility === 'private' && h.lockedFromSwap
      );
      if (lockedIdx < 0) {
        pushToast('warn', '当前没有被锁定的己方私有暗牌');
        return;
      }
      targetIndex = lockedIdx;
    }

    const action: GameAction = { type: 'use-skill', skillId, targetIndex };
    if (!isActionLegal(state, action)) {
      pushToast('warn', `无法释放「${sk.name}」`, `请确认可用算力是否充足（需 ${sk.costHint ?? 40}）`);
      return;
    }
    executeHumanAction(action);
    pushToast('success', `已激活「${sk.name}」`, sk.summary);
  };

  const handleExecuteScan = (targetKind: 'hand' | 'board', targetIndex: number) => {
    if (!scanMode || state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (getBetDiff(state, 'human') > 0 && state.phase !== 'river') {
      setScanMode(false);
      pushToast('warn', '遭遇加注，请先跟注', '公共牌未全明前必须先补齐跟注差额，才能进行扫描');
      return;
    }
    const action: GameAction = { type: 'scan', targetKind, targetIndex };
    if (!isActionLegal(state, action)) {
      pushToast('warn', '该节点本轮已扫描过或算力不足');
      setScanMode(false);
      return;
    }
    setScanMode(false);
    applyActionWithPreInputBundle(action);
  };

  const handleSelectHumanCard = (handIndex: number) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown' || state.phase === 'river') {
      return;
    }
    const diff = getBetDiff(state, 'human');
    if (diff > 0) {
      const paid = Math.min(diff, state.players.human.chips);
      pushToast(
        'warn',
        '请先补齐跟注差额',
        `右侧点击「跟注 +${paid}」（不消耗行动权），随后即可拖拽或点牌互换。`
      );
      return;
    }

    if (selectedHandIndex === handIndex) {
      setSelectedHandIndex(null);
      return;
    }

    const hc = state.players.human.hand[handIndex];
    if (!hc || hc.visibility !== 'open' || hc.lockedFromSwap) return;

    const swapFee = getNextSwapFee(state, 'human');
    if (state.players.human.chips < swapFee) {
      pushToast(
        'warn',
        `换牌门票不足（需 ${swapFee} 算力）`,
        '可直接点击上方未翻开暗牌免费翻牌。'
      );
      return;
    }

    setSelectedHandIndex(handIndex);
  };

  const handleSelectBoardSlot = (boardIndex: number) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    const slot = state.board[boardIndex];
    if (!slot || slot.isOpen) return;

    if (pendingSkillTargetId) {
      const action: GameAction = {
        type: 'use-skill',
        skillId: pendingSkillTargetId,
        targetIndex: boardIndex,
      };
      if (!isActionLegal(state, action)) {
        pushToast('warn', '当前暗槽不可作为该技能目标或算力不足');
        setPendingSkillTargetId(null);
        return;
      }
      const sk = getSkillById(pendingSkillTargetId);
      executeHumanAction(action);
      pushToast(
        'success',
        `「${sk?.name ?? pendingSkillTargetId}」生效`,
        pendingSkillTargetId === 'zero-day-peek'
          ? `窥视节点 #${boardIndex + 1}：${formatSuitLabel(slot.card.suit)}${formatRank(slot.card.rank)}`
          : `暗槽 #${boardIndex + 1} 已对对端封锁换牌`
      );
      return;
    }

    const diff = getBetDiff(state, 'human');
    if (diff > 0) {
      const paid = Math.min(diff, state.players.human.chips);
      pushToast(
        'warn',
        '请先补齐跟注差额',
        `右侧点击「跟注 +${paid}」（不消耗行动权），随后即可直接翻牌或互换。`
      );
      return;
    }

    if (selectedHandIndex !== null) {
      const swapFee = getNextSwapFee(state, 'human');
      if (state.players.human.chips < swapFee) {
        setSelectedHandIndex(null);
        pushToast('warn', '算力不足以支付换牌费', '已取消手牌选中');
        return;
      }
      executeHumanAction({
        type: 'swap',
        handIndex: selectedHandIndex,
        boardIndex,
      });
      return;
    }

    executeHumanAction({ type: 'flip', boardIndex });
  };

  // Drag-and-Drop Swap Handlers
  const handleHandDragStart = (handIndex: number, e: DragEvent<HTMLDivElement>) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown' || state.phase === 'river') {
      e.preventDefault();
      return;
    }
    const diff = getBetDiff(state, 'human');
    if (diff > 0) {
      e.preventDefault();
      pushToast('warn', '请先补齐跟注差额', '补齐跟注后即可拖拽手牌与暗牌互换');
      return;
    }
    const hc = state.players.human.hand[handIndex];
    const swapFee = getNextSwapFee(state, 'human');
    if (!hc || hc.visibility !== 'open' || hc.lockedFromSwap || state.players.human.chips < swapFee) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', String(handIndex));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedHandIndex(handIndex);
    setSelectedHandIndex(null);
  };

  const handleBoardDrop = (boardIndex: number, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const handIdx = raw !== '' ? Number(raw) : draggedHandIndex;
    setDraggedHandIndex(null);
    setDragOverBoardIndex(null);

    if (handIdx === null || !Number.isInteger(handIdx)) return;
    if (state.currentTurn !== 'human' || state.phase === 'showdown' || state.phase === 'river') return;
    const slot = state.board[boardIndex];
    if (!slot || slot.isOpen) return;
    if (getBetDiff(state, 'human') > 0) return;

    const swapFee = getNextSwapFee(state, 'human');
    if (state.players.human.chips < swapFee) {
      pushToast('warn', `换牌门票不足（需 ${swapFee}）`);
      return;
    }

    executeHumanAction({
      type: 'swap',
      handIndex: handIdx,
      boardIndex,
    });
  };

  const handleNextHand = () => {
    setSelectedHandIndex(null);
    setShowRaiseTiers(false);
    setActiveExpression('calm');
    setState((prev) => startNextHand(prev));
  };

  const performFullReset = (
    customConfig?: GameConfig,
    nextCharacter?: ContractCharacter,
    overrideAcquiredSkills?: string[]
  ) => {
    const targetChar = nextCharacter ?? character;
    const cfg = customConfig ?? state.config;
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
    queueRef.current = [];
    inFlightTaskRef.current = null;
    resetEpochRef.current += 1;
    isAnimatingRef.current = false;
    setQueuedCount(0);
    setFloatingBubble(null);
    setCrushingActive(false);
    setHistoryOffset(0);
    setSelectedHandIndex(null);
    setDraggedHandIndex(null);
    setShowRaiseTiers(false);
    setPendingSkillTargetId(null);
    setVfxTestMode('auto');
    setRoundLossFlicker(false);
    setAiRoundLossFlicker(false);
    setActiveExpression('calm');
    setActiveModal({ type: 'none' });
    lastHandledShowdownHandRef.current = 0;
    pendingBundledChatRef.current = null;
    const freshState = createInitialState({
      config: cfg,
      opponentName: targetChar.name,
      playerAcquiredSkills: overrideAcquiredSkills ?? latestCampaignRef.current.acquiredSkills,
    });
    setState(freshState);
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'opponent',
        speaker: targetChar.name,
        text: '黑域连接重构完毕。新的一轮追捕博弈开始了，请亮出你的牌序。',
        crushed: false,
      },
    ]);
    return freshState;
  };

  const advanceToNextPursuerMatch = async (nextCamp: typeof campaign) => {
    let nextChar = character;
    if (catalog.length > 1) {
      const currIdx = catalog.findIndex((c) => c.fileName === character.fileName);
      const nextCard = catalog[(currIdx + 1) % catalog.length];
      try {
        nextChar = await loadContractCharacterByFile(nextCard.fileName);
        setCharacter(nextChar);
      } catch {
        // Keep current character if loading fails
      }
    }
    const nextDossier = buildPursuerDossier(nextChar, nextCamp.roundIndex);
    const freshState = performFullReset(
      { ...state.config, aiStyle: deriveAiStyleFromCharacter(nextChar) },
      nextChar,
      nextCamp.acquiredSkills
    );
    const arrive = await requestEncounterDialogue({
      eventKind: 'pursuer-arrive',
      character: nextChar,
      state: freshState,
      llmConfig: latestLlmRef.current,
      campaign: nextCamp,
      dossier: nextDossier,
      chatHistory: buildChatHistorySnapshot(),
      preset: latestPresetRef.current,
      worldbook: latestWorldbookRef.current,
    });
    if (arrive.logEntry) {
      setLlmLogs((p) => [arrive.logEntry!, ...p].slice(0, 40));
    }
    setActiveExpression(arrive.expression);
    enqueueOpponentSegments(nextChar.name, arrive.segments);
  };

  const handleSwitchContractFile = async (fileName: string) => {
    setIsLoadingCard(true);
    try {
      const nextChar = await loadContractCharacterByFile(fileName);
      const suggestedStyle = deriveAiStyleFromCharacter(nextChar);
      setCharacter(nextChar);
      setActiveExpression('smile');
      setState((prev) => ({
        ...prev,
        config: { ...prev.config, aiStyle: suggestedStyle },
        players: {
          ...prev.players,
          ai: { ...prev.players.ai, name: nextChar.name },
        },
      }));
      enqueueTask({
        kind: 'opponent',
        speaker: nextChar.name,
        text: nextChar.quote || `契约窗口已切换至我的频段——我是${nextChar.name}。`,
      });
      pushToast('success', `已切换对手为「${nextChar.name}」`);
      setActiveModal({ type: 'none' });
    } catch (err) {
      pushToast('error', '读取契约卡失败', err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoadingCard(false);
    }
  };

  const handleQuickSwitchOpponent = async () => {
    if (catalog.length <= 1) {
      setActiveModal({ type: 'contracts' });
      return;
    }
    const currIdx = catalog.findIndex((c) => c.fileName === character.fileName);
    const nextCard = catalog[(currIdx + 1) % catalog.length];
    await handleSwitchContractFile(nextCard.fileName);
  };

  const handleImportJsonCard = (rawJson: string, fileName: string) => {
    try {
      const imported = registerImportedContractCard(rawJson, fileName);
      setCatalog((prev) => [
        imported,
        ...prev.filter((item) => item.fileName !== imported.fileName),
      ]);
      setCharacter(imported);
      setActiveExpression('smile');
      setState((prev) => ({
        ...prev,
        players: {
          ...prev.players,
          ai: { ...prev.players.ai, name: imported.name },
        },
      }));
      pushToast('success', `契约卡导入成功：${imported.name}`);
    } catch (err) {
      pushToast(
        'error',
        '契约卡格式校验未通过',
        err instanceof Error ? err.message : '请上传有效的 night-sugar/girl-card JSON'
      );
    }
  };

  const handleSendChat = async () => {
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    setChatDraft('');

    const historySnapshot = buildChatHistorySnapshot();
    enqueueTask({ kind: 'human', text: trimmed });

    const res = await requestOpponentChatReply({
      character,
      state: latestStateRef.current,
      llmConfig,
      chatHistory: historySnapshot,
      userText: trimmed,
      campaign,
      dossier,
      preset: activePreset,
      worldbook,
    });
    if (res.logEntry) {
      setLlmLogs((prev) => [res.logEntry!, ...prev].slice(0, 40));
    }
    setActiveExpression(res.expression);
    enqueueOpponentSegments(character.name, res.segments);
  };

  const handleReplayBubble = () => {
    const sample =
      character.voice?.samples?.[0] ??
      character.quote ??
      '数据流正常，准备下一手博弈。';
    enqueueTask({ kind: 'opponent', speaker: character.name, text: sample });
  };

  // Live Hand Summaries (Respecting hidden tamper isolation: opponent only sees unmodified cards!)
  const openBoardCardsForHuman = useMemo(
    () =>
      state.board
        .filter((b) => b.isOpen || state.config.revealOpponentHidden)
        .map((b) => getVisibleBoardCard(b, 'human', state.phase === 'showdown' || state.config.revealOpponentHidden)),
    [state.board, state.config.revealOpponentHidden, state.phase]
  );

  const humanSummary = useMemo(() => {
    const known = [...state.players.human.hand.map((h) => h.card), ...openBoardCardsForHuman];
    return evaluateVisibleHandSummary(known, 0);
  }, [state.players.human.hand, openBoardCardsForHuman]);

  const opponentSummary = useMemo(() => {
    const revealAll = state.phase === 'showdown' || state.config.revealOpponentHidden;
    const knownAi = state.players.ai.hand
      .filter((h) => revealAll || h.visibility === 'open')
      .map((h) => getVisibleHandCard(h, 'human', 'ai', revealAll));
    const hiddenAiCount = state.players.ai.hand.length - knownAi.length;
    return evaluateVisibleHandSummary([...knownAi, ...openBoardCardsForHuman], hiddenAiCount);
  }, [state.players.ai.hand, openBoardCardsForHuman, state.phase, state.config.revealOpponentHidden]);

  // Sliding Window Math for Chat
  const crushedCount = messages.filter((m) => m.crushed).length;
  const windowCap = getWindowCapacity();
  const bottomIdx = Math.max(0, crushedCount - historyOffset);
  const topIdx =
    historyOffset === 0
      ? messages.length - 1
      : Math.min(messages.length - 1, bottomIdx + windowCap - 1);
  const hiddenBelow = messages.slice(0, bottomIdx);
  const windowItems = messages.slice(bottomIdx, Math.min(messages.length, topIdx + 2));

  const handleFeedWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (crushedCount === 0 || isAnimatingRef.current) return;
    if (
      (e.deltaY > 0 && wheelAccumRef.current < 0) ||
      (e.deltaY < 0 && wheelAccumRef.current > 0)
    ) {
      wheelAccumRef.current = 0;
    }
    wheelAccumRef.current += e.deltaY;

    if (wheelAccumRef.current >= 45) {
      wheelAccumRef.current = 0;
      setHistoryOffset((prev) => {
        if (prev >= crushedCount) return prev;
        const nextOffset = prev + 1;
        const enteringMsg = messagesRef.current[crushedCount - nextOffset];
        if (enteringMsg) setEnteringId(enteringMsg.id);
        return nextOffset;
      });
    } else if (wheelAccumRef.current <= -45) {
      wheelAccumRef.current = 0;
      setEnteringId(null);
      setHistoryOffset((prev) => Math.max(0, prev - 1));
    }
  };

  // Game State Derivations
  const human = state.players.human;
  const ai = state.players.ai;
  const isShowdown = state.phase === 'showdown';
  const isHumanTurn = state.currentTurn === 'human' && !isShowdown;
  const diff = getBetDiff(state, 'human');
  const paid = Math.min(diff, human.chips);
  const willBeAllIn = human.chips - paid === 0 || ai.allIn;
  const hiddenCount = getHiddenBoardCount(state);
  const swapFee = getNextSwapFee(state, 'human');
  const raiseRange = getLegalRaiseRange(state, 'human', diff > 0 ? paid : 0);
  const raisePresets = raiseRange.allowed
    ? computeThreeRaisePresets(raiseRange.min, raiseRange.max)
    : [];
  const halfRaiseAmt = getHalfStackRaiseAmount(state, 'human');
  const raiseCap = getCurrentRaiseCap(state);
  const maxRaises = getMaxRaisesAllowed(state);
  const revealAllAi = isShowdown || state.config.revealOpponentHidden;
  const evt = state.lastAction;

  // Damage & Defeat VFX State (Applies to BOTH Human and Opponent!)
  const isBankrupt =
    vfxTestMode === 'bankrupt' ||
    (isShowdown && (human.chips === 0 || ai.chips === 0));
  const isAiLowCompute =
    !isBankrupt &&
    (vfxTestMode === 'low' || (ai.chips > 0 && ai.chips <= state.config.startingChips * 0.3));
  const isHumanLowCompute =
    !isBankrupt &&
    (vfxTestMode === 'low' || (human.chips > 0 && human.chips <= state.config.startingChips * 0.3));
  const isLowCompute = isAiLowCompute || isHumanLowCompute;

  // 虚拟空间对战中，追捕者采用魔女化虚拟实体形象（无魔女化差分时平滑回退）
  const portraitSrc = resolveVirtualEntityPortrait(
    character,
    activeExpression
  );
  const accentColor = llmConfig.overloadPersona
    ? '#FF4757'
    : character.color || '#FF2E88';

  const humanWinIds = new Set(state.result?.humanEval?.bestFive.map((c) => c.id) ?? []);
  const aiWinIds = new Set(state.result?.aiEval?.bestFive.map((c) => c.id) ?? []);
  const boardWinIds = new Set(
    state.result?.winner === 'human'
      ? (state.result.humanEval?.bestFive.map((c) => c.id) ?? [])
      : state.result?.winner === 'ai'
        ? (state.result.aiEval?.bestFive.map((c) => c.id) ?? [])
        : []
  );

  return (
    <div className="lc-shell">
      <CyberBackdrop situation={isBankrupt ? 'breach' : isLowCompute ? 'overclock' : 'recon'} pot={state.pot} />

      {/* Centered & Aligned 3x3 Tactical Stage */}
      <main className="lc-stage-grid" aria-label="牌桌主视区">
        {/* COL 1, ROW 1-2: Vertical Compute Pool Bar */}
        <aside className="lc-pool-slot" aria-label="算力池计量栏">
          <ComputePoolBar
            pot={state.pot}
            startingChips={state.config.startingChips}
            lastAction={state.lastAction}
          />
        </aside>

        {/* COL 1, ROW 3: Bottom-Left 3-Button System Stack */}
        <div className="lc-left-action-stack" role="group" aria-label="系统快捷控制栏">
          <button
            id="hud-btn-settings"
            type="button"
            className="lc-stack-btn"
            onClick={() => setActiveModal({ type: 'settings-menu' })}
            aria-label="打开集成设置菜单"
          >
            <span className="lc-btn-inline">
              <PixelGearIcon size={15} />
              设置
            </span>
            <span className="lc-stack-sub">系统菜单</span>
          </button>

          <button
            id="hud-btn-quick-restart"
            type="button"
            className="lc-stack-btn amber"
            onClick={() => performFullReset()}
          >
            <span className="lc-btn-inline">
              <PixelRestartIcon size={15} />
              快速重开
            </span>
            <span className="lc-stack-sub">重置牌桌</span>
          </button>

          <button
            id="hud-btn-switch-char"
            type="button"
            className="lc-stack-btn pink"
            onClick={handleQuickSwitchOpponent}
          >
            <span className="lc-btn-inline">
              <PixelSwitchUserIcon size={15} />
              换人
            </span>
            <span className="lc-stack-sub">切换对手</span>
          </button>
        </div>

        {/* COL 2, ROW 1: Enlarged Opponent Window + Layered Vertical Data Streams + Docked 3 Cards */}
        <section
          className={`lc-hud-box lc-opponent-zone ${isLowCompute ? 'is-low-compute' : ''} ${
            isBankrupt ? 'is-bankrupt' : ''
          }`}
          style={{ '--char-accent': accentColor } as CSSProperties}
          aria-label="对手状态与手牌区"
        >
          <header className="lc-opp-topbar">
            <div className="lc-opp-name">
              <span className="lc-opp-dot" aria-hidden="true" />
              <span>
                {character.name} · {dossier.identityTitle}
              </span>
            </div>
            <span className="lc-opp-codename">
              {isAiThinking
                ? 'THINKING...'
                : `${EXPRESSION_META[activeExpression].label} · R${campaign.roundIndex} · T${dossier.threatLevel}`}
            </span>
          </header>

          <div className="lc-opp-portrait-layer">
            {/* Layer 1 (z:1): Majority of Vertical Data Streams BEHIND Portrait */}
            <div className="lc-opp-streams-back" aria-hidden="true">
              {BACK_PORTRAIT_STREAMS.map((s, idx) => (
                <div
                  key={idx}
                  className="lc-opp-stream-col"
                  style={{ left: s.left, animationDuration: s.dur, animationDelay: s.delay }}
                >
                  <span>{s.tokens}</span>
                  <span>{s.tokens}</span>
                </div>
              ))}
            </div>

            {/* Layer 2 (z:2): Character Portrait Cutout */}
            <img
              src={portraitSrc}
              alt={`${character.name}半身立绘`}
              className="lc-opp-portrait-img"
              width={550}
              height={420}
            />

            {/* Layer 3 (z:3): Minority of Vertical Data Streams IN FRONT of Portrait */}
            <div className="lc-opp-streams-front" aria-hidden="true">
              {FRONT_PORTRAIT_STREAMS.map((s, idx) => (
                <div
                  key={idx}
                  className={`lc-opp-stream-col ${s.accent ? 'accent' : ''}`}
                  style={{ left: s.left, animationDuration: s.dur, animationDelay: s.delay }}
                >
                  <span>{s.tokens}</span>
                  <span>{s.tokens}</span>
                </div>
              ))}
            </div>

            <div className="lc-opp-portrait-fade" aria-hidden="true" />

            {/* Damage Effect 1B: Opponent Single-Round Defeat Mosaic Hit */}
            {aiRoundLossFlicker && (
              <div className="lc-opp-mosaic-hit" aria-hidden="true">
                {MOSAIC_FLICKER_TILES.slice(0, 80).map((cls, i) => (
                  <span key={i} className={`lc-mosaic-tile ${cls}`} />
                ))}
              </div>
            )}

            {/* Damage Effect 3: Bankrupt (0 Compute) Mosaic Engulfment */}
            {isBankrupt && (
              <>
                <div className="lc-mosaic-flood-overlay" aria-hidden="true">
                  {MOSAIC_FLOOD_CELLS.map((tone, i) => (
                    <span key={i} className={`lc-mosaic-flood-cell ${tone}`} />
                  ))}
                </div>
                <div className="lc-bankrupt-banner" aria-hidden="true">
                  {human.chips === 0 ? 'COMPUTE DEPLETED // SYSTEM CRASH' : 'TARGET BROKEN // ROOT TAKEOVER'}
                </div>
              </>
            )}
          </div>

          <div className="lc-opp-cards-dock">
            <div className="lc-status-strip">
              <span className="lc-micro-tag pink">
                对端：{opponentSummary.label} · {opponentSummary.detail}
              </span>
              <span className="lc-micro-tag">可用算力 {ai.chips}</span>
            </div>

            <div className="lc-cards-row">
              {ai.hand.map((hc, idx) => {
                const isPrivate = hc.visibility === 'private';
                const showFace = !isPrivate || revealAllAi;
                const visibleCard = getVisibleHandCard(hc, 'human', 'ai', revealAllAi);
                const isSwappingHidden = Boolean(
                  swapFlight && swapFlight.actor === 'ai' && swapFlight.handIndex === idx
                );
                const alreadyScanned = state.scannedKeys.includes(`human:hand:${idx}`);
                const canScanCard =
                  scanMode &&
                  isHumanTurn &&
                  !alreadyScanned &&
                  human.chips >= getEffectiveScanCost(state, 'human');

                const aiTamperLabel =
                  revealAllAi &&
                  hc.originalCard &&
                  (hc.card.rank !== hc.originalCard.rank || hc.card.suit !== hc.originalCard.suit)
                    ? `原:${formatSuitLabel(hc.originalCard.suit)}${formatRank(hc.originalCard.rank)}`
                    : undefined;

                return (
                  <CyberCard3D
                    key={`ai-hand-${idx}`}
                    id={`opponent-hand-card-${idx}`}
                    card={showFace ? visibleCard : undefined}
                    faceDown={!showFace}
                    size="sm"
                    backCode="暗码"
                    isSwappingHidden={isSwappingHidden}
                    tamperLabel={aiTamperLabel}
                    isScanTarget={canScanCard}
                    isScannedClean={alreadyScanned}
                    justActed={Boolean(
                      !isSwappingHidden &&
                        evt &&
                        evt.actor === 'ai' &&
                        evt.type === 'swap' &&
                        evt.handIndex === idx
                    )}
                    isWinner={
                      isShowdown && state.result?.winner === 'ai' && aiWinIds.has(hc.card.id)
                    }
                    actionHint={
                      canScanCard
                        ? `点击扫描 ${character.name} 手牌 #${idx + 1}（预支 ${getEffectiveScanCost(
                            state,
                            'human'
                          )}）`
                        : undefined
                    }
                    onClick={canScanCard ? () => handleExecuteScan('hand', idx) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* COL 2, ROW 2: 4 Community Cards (Direct Flip + Click-Swap + Drag-Drop Target) */}
        <section className="lc-hud-box lc-board-zone" aria-label="公共加密节点区">
          <div className="lc-board-header">
            <span className="lc-board-title">
              <PixelNodesIcon size={13} />
              BOARD // 公共加密节点
            </span>
            <span className="lc-micro-tag cyan">
              剩余暗牌 {hiddenCount}/4 · 限注 {raiseCap}
            </span>
          </div>

          <div className="lc-cards-row">
            {state.board.map((slot) => {
              const isHidden = !slot.isOpen;
              const clickableHidden = isHumanTurn && isHidden && !scanMode;
              const showFace = slot.isOpen || (isHidden && state.config.revealOpponentHidden);
              const visibleBoardCard = getVisibleBoardCard(slot, 'human', revealAllAi);
              const isDropTarget = draggedHandIndex !== null && clickableHidden && diff === 0;
              const isDropHover = isDropTarget && dragOverBoardIndex === slot.index;
              const isSwappingHidden = Boolean(
                swapFlight && swapFlight.boardIndex === slot.index
              );
              const alreadyScannedBoard = state.scannedKeys.includes(`human:board:${slot.index}`);
              const canScanBoard =
                scanMode &&
                isHumanTurn &&
                slot.isOpen &&
                slot.swappedBy === 'ai' &&
                !alreadyScannedBoard &&
                human.chips >= getEffectiveScanCost(state, 'human');

              const boardTamperLabel =
                (slot.swappedBy === 'human' || revealAllAi) &&
                slot.originalCard &&
                (slot.card.rank !== slot.originalCard.rank ||
                  slot.card.suit !== slot.originalCard.suit)
                  ? `原:${formatSuitLabel(slot.originalCard.suit)}${formatRank(slot.originalCard.rank)}`
                  : undefined;

              const isPeeked = isHidden && state.peekedBoardIndices.includes(slot.index);
              const isFrozen = isHidden && state.frozenBoardIndices.includes(slot.index);
              const nodeBackCode = isPeeked
                ? `窥:${formatSuitLabel(slot.card.suit)}${formatRank(slot.card.rank)}`
                : isFrozen
                  ? '锁槽'
                  : `节点0${slot.index + 1}`;
              const hint = canScanBoard
                ? `点击扫描对端换出的节点 #${slot.index + 1}（预支 ${getEffectiveScanCost(state, 'human')}）`
                : pendingSkillTargetId && isHidden
                  ? `点击对暗槽 #${slot.index + 1} 释放「${getSkillById(pendingSkillTargetId)?.name ?? '技能'}」`
                  : !clickableHidden
                    ? undefined
                    : draggedHandIndex !== null
                      ? `松手将手牌 #${draggedHandIndex + 1} 与节点 #${slot.index + 1} 互换（门票 ${swapFee}）`
                      : selectedHandIndex !== null
                        ? `点击将手牌 #${selectedHandIndex + 1} 与节点 #${slot.index + 1} 互换（门票 ${swapFee}）`
                        : `点击直接免费翻开节点 #${slot.index + 1}`;

              return (
                <CyberCard3D
                  key={`board-slot-${slot.index}`}
                  id={`board-node-card-${slot.index}`}
                  card={showFace ? visibleBoardCard : undefined}
                  faceDown={!showFace}
                  size="md"
                  backCode={nodeBackCode}
                  targetable={clickableHidden && (diff === 0 || Boolean(pendingSkillTargetId))}
                  isDropTarget={isDropTarget}
                  isDropHover={isDropHover}
                  isSwappingHidden={isSwappingHidden}
                  swapSource={slot.source === 'swapped-in' ? slot.swappedBy : undefined}
                  tamperLabel={boardTamperLabel}
                  isScanTarget={canScanBoard}
                  isScannedClean={alreadyScannedBoard}
                  justActed={Boolean(
                    !isSwappingHidden &&
                      evt &&
                      (evt.type === 'flip' || evt.type === 'swap') &&
                      evt.boardIndex === slot.index
                  )}
                  isWinner={isShowdown && boardWinIds.has(slot.card.id)}
                  actionHint={hint}
                  onClick={
                    canScanBoard
                      ? () => handleExecuteScan('board', slot.index)
                      : clickableHidden
                        ? () => handleSelectBoardSlot(slot.index)
                        : undefined
                  }
                  onDragOver={
                    clickableHidden && diff === 0
                      ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverBoardIndex !== slot.index) {
                            setDragOverBoardIndex(slot.index);
                          }
                        }
                      : undefined
                  }
                  onDragLeave={
                    clickableHidden
                      ? () => {
                          if (dragOverBoardIndex === slot.index) {
                            setDragOverBoardIndex(null);
                          }
                        }
                      : undefined
                  }
                  onDrop={
                    clickableHidden && diff === 0
                      ? (e) => handleBoardDrop(slot.index, e)
                      : undefined
                  }
                />
              );
            })}
          </div>

          <div className="lc-board-hint">
            {!isHumanTurn
              ? isShowdown
                ? `第 #${state.handNumber} 局结算：${
                    state.result?.winner === 'human'
                      ? '我方胜出'
                      : state.result?.winner === 'ai'
                        ? `${character.name}胜出`
                        : '平局分池'
                  }`
                : `等待 ${character.name} 行动...`
              : scanMode
                ? `扫描模式激活：点击上方 ${character.name} 的牌或换出牌验真（预支 ${state.config.scanCost}，不占回合）`
                : diff > 0
                  ? `遭遇加注：请先点击右侧「跟注 +${paid}」（不消耗行动）`
                  : draggedHandIndex !== null
                    ? `拖拽手牌 #${draggedHandIndex + 1}：松手放到任意暗牌即可互换（门票 ${swapFee}）`
                    : selectedHandIndex !== null
                      ? `已选中明牌 #${selectedHandIndex + 1}：可点击暗牌互换，或点下方黑客技能篡改`
                      : '点暗牌=翻牌 ｜ 拖拽或先点己方明牌=互换/黑客篡改'}
          </div>
        </section>

        {/* COL 2, ROW 3: Player Pure Portrait Avatar (Left) + 3 Cards + Hacker & Scan Skill Bar */}
        <section
          className={`lc-hud-box lc-player-hand-zone ${isHumanLowCompute ? 'is-low-compute' : ''}`}
          aria-label="己方手牌序列区"
        >
          <div className="lc-player-main-split">
            <button
              id="player-btn-switch-disguise"
              type="button"
              className={`lc-player-avatar-only ${activeDisguise.isCore ? 'is-core' : 'is-decoy'}`}
              style={{ '--entity-accent': activeDisguise.accentColor } as CSSProperties}
              onClick={() => {
                if (state.handNumber === 1 && state.actionHistory.length === 0) {
                  setManualDisguiseOpen(true);
                } else if (campaign.capturedEntities.length === 0) {
                  pushToast('info', '暂无俘获诱饵', '击败追捕者后可夺取其虚拟实体作为伪装诱饵');
                } else {
                  pushToast('warn', '对局进行中不可更换伪装', '请在下一场追捕开始时切换出战虚拟实体');
                }
              }}
              title={`${activeDisguise.name}（${activeDisguise.isCore ? '本体核心' : '诱饵伪装'} · 通缉LV.${campaign.wantedLevel}）`}
              aria-label={`当前出战虚拟实体头像：${activeDisguise.name}`}
            >
              <img
                src={activeDisguise.virtualPortrait}
                alt={activeDisguise.name}
                className={`lc-avatar-only-img ${activeDisguise.isCore ? '' : 'is-fullbody-crop'}`}
              />
            </button>

            <div className="lc-player-cards-col">
              <div className="lc-status-strip" style={{ width: '100%' }}>
                <span className="lc-micro-tag cyan">
                  己方：{humanSummary.label} · {humanSummary.detail}
                </span>
                <span className="lc-micro-tag">可用算力 {human.chips}</span>
              </div>

              <div className="lc-cards-row">
                {human.hand.map((hc, idx) => {
                  const isPrivate = hc.visibility === 'private';
                  const canSelectOpen = isHumanTurn && !isPrivate;
                  const canDrag =
                    isHumanTurn &&
                    state.phase !== 'river' &&
                    !isPrivate &&
                    !hc.lockedFromSwap &&
                    hiddenCount > 0 &&
                    diff === 0 &&
                    human.chips >= swapFee;
                  const isSwappingHidden = Boolean(
                    swapFlight && swapFlight.actor === 'human' && swapFlight.handIndex === idx
                  );
                  const tamperLabel =
                    hc.originalCard &&
                    (hc.card.rank !== hc.originalCard.rank || hc.card.suit !== hc.originalCard.suit)
                      ? `原:${formatSuitLabel(hc.originalCard.suit)}${formatRank(hc.originalCard.rank)}`
                      : undefined;

                  return (
                    <CyberCard3D
                      key={`human-hand-${idx}`}
                      id={`human-hand-card-${idx}`}
                      card={hc.card}
                      faceDown={false}
                      size="lg"
                      isOwnPrivate={isPrivate}
                      selected={selectedHandIndex === idx}
                      draggable={canDrag}
                      isDragSource={draggedHandIndex === idx}
                      isSwappingHidden={isSwappingHidden}
                      tamperLabel={tamperLabel}
                      justActed={Boolean(
                        !isSwappingHidden &&
                          evt &&
                          ((evt.actor === 'human' && evt.type === 'swap' && evt.handIndex === idx) ||
                            (evt.actor === 'human' && evt.type === 'hack' && evt.handIndex === idx))
                      )}
                      isWinner={
                        isShowdown && state.result?.winner === 'human' && humanWinIds.has(hc.card.id)
                      }
                      actionHint={
                        isPrivate
                          ? '己方私有暗牌（不可换出，不可篡改）'
                          : canDrag
                            ? '拖拽至暗牌互换；点击选中后可用黑客技能或点暗牌互换'
                            : canSelectOpen
                              ? '点击选中明牌以使用黑客技能'
                              : undefined
                      }
                      onClick={canSelectOpen ? () => handleSelectHumanCard(idx) : undefined}
                      onDragStart={canDrag ? (e) => handleHandDragStart(idx, e) : undefined}
                      onDragEnd={() => {
                        setDraggedHandIndex(null);
                        setDragOverBoardIndex(null);
                      }}
                    />
                  );
                })}
              </div>

              {/* Hacker Skills (+1 / -1 / Flip Suit) + Universal Scan Bar */}
              <div className="lc-hack-bar" role="group" aria-label="黑客与扫描技能栏">
                {(
                  [
                    {
                      id: 'hack-btn-plus-one',
                      skill: 'plus-one' as const,
                      label: '+1',
                      cost: getEffectiveHackCost(state, 'human', 'plus-one'),
                      icon: <PixelPlusOneIcon size={12} />,
                    },
                    {
                      id: 'hack-btn-minus-one',
                      skill: 'minus-one' as const,
                      label: '-1',
                      cost: getEffectiveHackCost(state, 'human', 'minus-one'),
                      icon: <PixelMinusOneIcon size={12} />,
                    },
                    {
                      id: 'hack-btn-flip-suit',
                      skill: 'flip-suit' as const,
                      label: '反色',
                      cost: getEffectiveHackCost(state, 'human', 'flip-suit'),
                      icon: <PixelFlipSuitIcon size={12} />,
                    },
                  ] as const
                ).map((btn) => {
                  const isSealed = human.sealedSkills.includes(btn.skill);
                  const usedThisTurn = state.usedHackThisTurn;
                  const disabled = !isHumanTurn || diff > 0 || isSealed || usedThisTurn || human.chips < btn.cost;
                  return (
                    <button
                      key={btn.skill}
                      id={btn.id}
                      type="button"
                      className={`lc-hack-btn ${isSealed ? 'is-sealed' : ''}`}
                      disabled={disabled}
                      onClick={() => handleExecuteHack(btn.skill)}
                      title={
                        diff > 0
                          ? '遭遇加注，请先在右侧跟注后再使用技能'
                          : isSealed
                            ? '此技能已被扫描抓获封印'
                            : usedThisTurn
                              ? '黑客技能每回合限用 1 次'
                              : `先选中己方明牌再点此技能（预支 ${btn.cost}，每回合限 1 次）`
                      }
                    >
                      {btn.icon}
                      <span>{isSealed ? '封印' : usedThisTurn ? '已用' : btn.label}</span>
                      {!isSealed && !usedThisTurn && <span className="lc-hack-cost">{btn.cost}</span>}
                    </button>
                  );
                })}

                <button
                  id="hack-btn-scan-toggle"
                  type="button"
                  className={`lc-hack-btn is-scan ${scanMode ? 'is-active' : ''}`}
                  disabled={
                    !isHumanTurn ||
                    (diff > 0 && state.phase !== 'river') ||
                    state.usedScanThisTurn ||
                    human.chips < getEffectiveScanCost(state, 'human')
                  }
                  onClick={() => {
                    setPendingSkillTargetId(null);
                    setScanMode((s) => !s);
                  }}
                  title={
                    diff > 0 && state.phase !== 'river'
                      ? '公共牌未全明时遭遇加注，请先在右侧跟注后再进行扫描'
                      : state.usedScanThisTurn
                        ? '扫描技能每回合限用 1 次'
                        : `激活后点击对手手牌或换出牌检测是否被篡改（预支 ${getEffectiveScanCost(
                            state,
                            'human'
                          )}，公共牌全明时可先扫描再决定是否跟注）`
                  }
                >
                  <PixelScanIcon size={12} />
                  <span>{state.usedScanThisTurn ? '已用' : scanMode ? '取消' : '扫描'}</span>
                  {!state.usedScanThisTurn && (
                    <span className="lc-hack-cost">{getEffectiveScanCost(state, 'human')}</span>
                  )}
                </button>
              </div>

              {campaign.acquiredSkills.length > 0 && (
                <div className="lc-acquired-skill-bar" role="group" aria-label="已掠夺协议技能槽">
                  {campaign.acquiredSkills.map((sid, sIdx) => {
                    const sk = getSkillById(sid);
                    if (!sk) return null;
                    const isPassive = sk.targetMode === 'passive';
                    const isTargeting = pendingSkillTargetId === sid;
                    const cost = sk.costHint ?? 0;
                    const disabled =
                      isPassive ||
                      !isHumanTurn ||
                      diff > 0 ||
                      state.usedProtocolSkillThisHand ||
                      human.chips < cost;
                    return (
                      <button
                        key={sid}
                        id={`acquired-skill-btn-${sIdx}`}
                        type="button"
                        className={`lc-acquired-skill-chip ${isPassive ? 'is-passive' : ''} ${
                          isTargeting ? 'is-targeting' : ''
                        }`}
                        disabled={disabled}
                        onClick={() => handleUseAcquiredSkill(sid)}
                        title={sk.summary}
                      >
                        <span>{isTargeting ? `选暗槽:${sk.name}` : sk.name}</span>
                        {!isPassive && <span className="lc-hack-cost">{cost}</span>}
                        {isPassive && <span className="lc-hack-cost">被动</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="lc-player-footer">
                <span>
                  {campaign.acquiredSkills.length > 0
                    ? `已获技能: ${campaign.acquiredSkills.map((id) => getSkillById(id)?.name ?? id).slice(-2).join(' / ')}`
                    : 'PRIV=私有暗牌 · MOD=篡改仅己方可见'}
                </span>
                <span>换牌门票：{swapFee}</span>
              </div>
            </div>
          </div>
        </section>

        {/* COL 3, ROW 1-2: Top-Aligned Fixed-Size Chat Panel */}
        <aside
          className="lc-right-upper-col"
          style={{ '--char-accent': accentColor } as CSSProperties}
          aria-label="右侧通讯栏"
        >
          <section
            ref={chatPanelRef}
            className="lc-hud-box lc-chat-panel"
            aria-label="聊天堆积栏"
          >
            <header className="lc-chat-header">
              <span className="lc-chat-title">
                <PixelChatIcon size={13} />
                CHAT // 通讯栏
              </span>
              <div className="lc-chat-actions">
                {queuedCount > 0 && (
                  <span className="lc-micro-tag" style={{ padding: '1px 5px', fontSize: 9.5 }}>
                    队列 {queuedCount}
                  </span>
                )}
                <button
                  id="chat-btn-replay-bubble"
                  type="button"
                  className="lc-chat-replay-btn"
                  onClick={handleReplayBubble}
                  title="触发一次对手气泡弹出-悬浮-压底跌落"
                >
                  <PixelBroadcastIcon size={12} />
                  发言
                </button>
              </div>
            </header>

            {floatingBubble && (
              <div
                key={floatingBubble.id}
                className={`lc-speech-bubble ${
                  floatingBubble.msgKind === 'thought' ? 'is-thought' : ''
                }`}
                style={
                  {
                    '--contact-dy': `${floatingBubble.contactDy}px`,
                    '--drop-dy': `${floatingBubble.dropDy}px`,
                  } as CSSProperties
                }
                aria-live="polite"
              >
                <svg
                  viewBox="0 0 12 16"
                  shapeRendering="crispEdges"
                  className="lc-speech-pointer"
                  aria-hidden="true"
                >
                  <path d="M12 0V16H8V12H4V9H0V7H4V4H8V0H12Z" fill={accentColor} />
                  <path d="M12 2V14H9V11H6V9H3V7H6V5H9V2H12Z" fill="#0B0911" />
                </svg>
                <div className="lc-chat-meta opponent">
                  <span>{floatingBubble.speaker}</span>
                  <span>{floatingBubble.msgKind === 'thought' ? 'THOUGHT' : 'OPP'}</span>
                </div>
                <div>{floatingBubble.text}</div>
              </div>
            )}

            <div
              ref={chatFeedRef}
              className="lc-chat-feed"
              onWheel={handleFeedWheel}
              role="log"
              aria-live="polite"
            >
              {(hiddenBelow.length > 0 || historyOffset > 0) && (
                <div className="lc-crushed-dock" aria-label="压缩历史状态栏">
                  <div className="lc-crushed-slivers">
                    {hiddenBelow.slice(-3).map((old) => (
                      <div key={old.id} className={`lc-crushed-sliver ${old.sender}`} />
                    ))}
                  </div>
                  <div className="lc-crushed-caption">
                    <span>
                      {hiddenBelow.length > 0
                        ? `历史压缩 x${hiddenBelow.length}`
                        : '已达最早历史'}
                    </span>
                    <span>
                      {historyOffset === 0
                        ? '向下滚查看'
                        : historyOffset >= crushedCount
                          ? '向上滚返回'
                          : `${historyOffset}/${crushedCount} · 滚轮翻阅`}
                    </span>
                  </div>
                </div>
              )}

              <div ref={activeStackRef} className="lc-active-stack">
                {windowItems.map((msg, localIdx) => {
                  const globalIdx = bottomIdx + localIdx;
                  const isScrolledAbove = globalIdx > topIdx;
                  const isCrushingNow = crushingActive && !msg.crushed;
                  const isEnteringBottom = enteringId === msg.id;

                  return (
                    <article
                      key={msg.id}
                      className={`lc-chat-msg ${msg.sender} ${
                        msg.msgKind === 'thought' ? 'is-thought' : ''
                      } ${msg.anim ?? ''} ${isCrushingNow ? 'is-crushing-now' : ''} ${
                        isScrolledAbove ? 'is-scrolled-above' : ''
                      } ${isEnteringBottom ? 'enter-from-bottom' : ''}`}
                      style={
                        msg.riseDy !== undefined
                          ? ({ '--rise-dy': `${msg.riseDy}px` } as CSSProperties)
                          : undefined
                      }
                    >
                      <div className="lc-chat-msg-inner">
                        <div className={`lc-chat-meta ${msg.sender}`}>
                          <span>{msg.speaker}</span>
                          <span>
                            {msg.sender === 'opponent'
                              ? msg.msgKind === 'thought'
                                ? 'THOUGHT'
                                : 'OPP'
                              : 'YOU'}
                          </span>
                        </div>
                        <div>{msg.text}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <form
              className="lc-chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
            >
              <label
                htmlFor="chat-input-preview"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                }}
              >
                输入聊天消息
              </label>
              <input
                id="chat-input-preview"
                type="text"
                className="lc-chat-input"
                placeholder={`向 ${character.name} 预输入对话（执行操作后随动作一起发送，回车直发）...`}
                value={chatDraft}
                maxLength={200}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
              />
              <button
                id="chat-btn-send-preview"
                type="submit"
                className="lc-chat-send-btn"
                disabled={!chatDraft.trim()}
                title={
                  isHumanTurn && chatDraft.trim()
                    ? '点击直接发送；若直接出牌，本句将随操作一起合并发给 LLM'
                    : '发送消息'
                }
              >
                <PixelSendIcon size={13} />
                {isHumanTurn && chatDraft.trim() ? '直发' : '发送'}
              </button>
            </form>
          </section>
        </aside>

        {/* COL 3, ROW 3: Right-Side 3 Vertically Stacked Tactical Action Boxes */}
        <div className="lc-action-stack" role="group" aria-label="右侧战术指令栏">
          {isShowdown && state.result ? (
            <>
              {human.chips > 0 && ai.chips > 0 ? (
                <button
                  id="action-btn-next-hand"
                  type="button"
                  className="lc-stack-btn"
                  onClick={handleNextHand}
                >
                  <span className="lc-btn-inline">
                    <PixelSyncIcon size={15} />
                    下一局协议
                  </span>
                  <span className="lc-stack-sub">第 #{state.handNumber + 1} 局</span>
                </button>
              ) : (
                <button
                  id="action-btn-match-restart"
                  type="button"
                  className="lc-stack-btn pink"
                  onClick={() => performFullReset()}
                >
                  <span className="lc-btn-inline">
                    <PixelRestartIcon size={15} />
                    {human.chips > 0 ? '完胜！重开' : '算力归零！重开'}
                  </span>
                  <span className="lc-stack-sub">恢复 {state.config.startingChips}</span>
                </button>
              )}

              <button
                id="action-btn-showdown-summary"
                type="button"
                className="lc-stack-btn amber"
                onClick={() => setActiveModal({ type: 'protocol', tab: 'audit' })}
              >
                <span className="lc-btn-inline">
                  <PixelMenuIcon kind="audit" size={15} />
                  {state.result.reason === 'showdown' &&
                  state.result.humanEval &&
                  state.result.aiEval
                    ? `${state.result.humanEval.categoryName} vs ${state.result.aiEval.categoryName}`
                    : `${otherPlayer(state.result.winner === 'tie' ? 'human' : state.result.winner) === 'human' ? '我方' : character.name}弃牌`}
                </span>
                <span className="lc-stack-sub">奖池 {state.result.potWon}</span>
              </button>

              <button
                id="action-btn-showdown-reset"
                type="button"
                className="lc-stack-btn danger"
                onClick={() => setActiveModal({ type: 'confirm-reset' })}
              >
                <span className="lc-btn-inline">
                  <PixelSeverIcon size={14} />
                  重置整场
                </span>
                <span className="lc-stack-sub">清空进度</span>
              </button>
            </>
          ) : !isHumanTurn ? (
            <>
              <button id="action-btn-ai-wait-1" type="button" className="lc-stack-btn" disabled>
                <span className="lc-btn-inline">
                  <PixelSyncIcon size={15} />
                  对端推演中
                </span>
                <span className="lc-stack-sub">{character.name} 回合</span>
              </button>
              <button id="action-btn-ai-wait-2" type="button" className="lc-stack-btn pink" disabled>
                <span className="lc-btn-inline">
                  <PixelSurgeIcon size={15} />
                  加注锁定
                </span>
                <span className="lc-stack-sub">上限 {raiseCap}</span>
              </button>
              <button id="action-btn-ai-wait-3" type="button" className="lc-stack-btn danger" disabled>
                <span className="lc-btn-inline">
                  <PixelSeverIcon size={14} />
                  等待响应
                </span>
                <span className="lc-stack-sub">请稍候</span>
              </button>
            </>
          ) : showRaiseTiers && raiseRange.allowed ? (
            <>
              <div className="lc-raise-tiers-mini-row">
                {raisePresets.map((amt, tierIdx) => (
                  <button
                    key={amt}
                    id={`raise-tier-btn-${tierIdx}`}
                    type="button"
                    className={`lc-stack-btn ${tierIdx === raisePresets.length - 1 ? 'amber' : 'pink'}`}
                    onClick={() => executeHumanAction({ type: 'raise', amount: amt })}
                  >
                    <span className="lc-btn-inline">
                      <PixelTierIcon level={(tierIdx + 1) as 1 | 2 | 3} size={13} />+{amt}
                    </span>
                  </button>
                ))}
              </div>

              <button
                id="raise-btn-hold-half"
                type="button"
                className="lc-stack-btn amber lc-hold-btn"
                disabled={halfRaiseAmt <= 0}
                onPointerDown={() => startHoldHalfRaise(halfRaiseAmt)}
                onPointerUp={cancelHoldHalfRaise}
                onPointerLeave={cancelHoldHalfRaise}
                onPointerCancel={cancelHoldHalfRaise}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    startHoldHalfRaise(halfRaiseAmt);
                  }
                }}
                onKeyUp={cancelHoldHalfRaise}
                title="长按 0.72 秒投入当前自身一半算力"
              >
                <div className="lc-hold-fill" style={{ width: `${holdProgress}%` }} aria-hidden="true" />
                <span className="lc-btn-inline">
                  <PixelHoldIcon size={15} />
                  长按半数 +{halfRaiseAmt}
                </span>
                <span className="lc-stack-sub">
                  {holdProgress > 0 ? `充能 ${holdProgress}%` : '按住 0.7s 投入 50%'}
                </span>
              </button>

              <button
                id="raise-tier-btn-back-cancel"
                type="button"
                className="lc-stack-btn"
                onClick={() => {
                  cancelHoldHalfRaise();
                  setShowRaiseTiers(false);
                }}
              >
                <span className="lc-btn-inline">
                  <PixelMenuIcon kind="back" size={14} />
                  返回指令
                </span>
                <span className="lc-stack-sub">取消加注</span>
              </button>
            </>
          ) : diff > 0 ? (
            <>
              <button
                id="lc-action-btn-call"
                type="button"
                className="lc-stack-btn"
                onClick={() => executeHumanAction({ type: 'call' })}
              >
                <span className="lc-btn-inline">
                  <PixelSyncIcon size={15} />
                  {state.phase === 'river'
                    ? `跟注摊牌 +${paid}`
                    : willBeAllIn
                      ? `全下跟注 +${paid}`
                      : `跟注 +${paid}`}
                </span>
                <span className="lc-stack-sub">
                  {state.phase === 'river' || willBeAllIn ? '亮牌核验' : '不消耗行动'}
                </span>
              </button>

              <button
                id="lc-action-btn-open-reraise"
                type="button"
                className="lc-stack-btn pink"
                disabled={!raiseRange.allowed || willBeAllIn}
                onClick={() => setShowRaiseTiers(true)}
              >
                <span className="lc-btn-inline">
                  <PixelSurgeIcon size={15} />
                  反加注
                </span>
                <span className="lc-stack-sub">
                  {raiseRange.allowed && !willBeAllIn ? '三档定额' : '已达上限'}
                </span>
              </button>

              <button
                id="lc-action-btn-fold"
                type="button"
                className="lc-stack-btn danger"
                onClick={() => executeHumanAction({ type: 'fold' })}
              >
                <span className="lc-btn-inline">
                  <PixelSeverIcon size={14} />
                  弃牌断连
                </span>
                <span className="lc-stack-sub">放弃奖池</span>
              </button>
            </>
          ) : (
            <>
              <button
                id="action-btn-primary-turn"
                type="button"
                className="lc-stack-btn"
                disabled={state.phase !== 'river' && !state.justCalledThisTurn}
                onClick={() =>
                  executeHumanAction({
                    type: state.phase === 'river' ? 'check' : 'end-turn',
                  })
                }
              >
                <span className="lc-btn-inline">
                  <PixelSyncIcon size={15} />
                  {state.phase === 'river' ? '静默过牌' : '结束回合'}
                </span>
                <span className="lc-stack-sub">
                  {state.phase === 'river'
                    ? '0 算力'
                    : state.justCalledThisTurn
                      ? '保留跟注移交'
                      : '请点牌翻/换或加注'}
                </span>
              </button>

              <button
                id="lc-action-btn-open-raise"
                type="button"
                className="lc-stack-btn pink"
                disabled={!raiseRange.allowed}
                onClick={() => {
                  setSelectedHandIndex(null);
                  setShowRaiseTiers(true);
                }}
              >
                <span className="lc-btn-inline">
                  <PixelSurgeIcon size={15} />
                  加注施压
                </span>
                <span className="lc-stack-sub">
                  {raiseRange.allowed
                    ? `三档 (${state.raisesInSubPhase}/${maxRaises})`
                    : '翻/换牌后重置'}
                </span>
              </button>

              <button
                id="action-btn-fold-idle"
                type="button"
                className="lc-stack-btn danger"
                onClick={() => executeHumanAction({ type: 'fold' })}
              >
                <span className="lc-btn-inline">
                  <PixelSeverIcon size={14} />
                  弃牌断连
                </span>
                <span className="lc-stack-sub">放弃奖池</span>
              </button>
            </>
          )}
        </div>
      </main>

      {/* Dual-Card Smooth Swap Flight Layer (Player & Opponent!) */}
      {swapFlight && (
        <div className="lc-swap-flight-layer" aria-hidden="true">
          <div
            className="lc-swap-flight-card"
            style={
              {
                left: swapFlight.handToBoard.rect.left,
                top: swapFlight.handToBoard.rect.top,
                width: swapFlight.handToBoard.rect.width,
                height: swapFlight.handToBoard.rect.height,
                '--fly-dx': `${swapFlight.handToBoard.dx}px`,
                '--fly-dy': `${swapFlight.handToBoard.dy}px`,
              } as CSSProperties
            }
          >
            <FlightCardShell
              card={swapFlight.handToBoard.card}
              faceDown={false}
              isOwnPrivate={false}
            />
          </div>

          <div
            className="lc-swap-flight-card"
            style={
              {
                left: swapFlight.boardToHand.rect.left,
                top: swapFlight.boardToHand.rect.top,
                width: swapFlight.boardToHand.rect.width,
                height: swapFlight.boardToHand.rect.height,
                '--fly-dx': `${swapFlight.boardToHand.dx}px`,
                '--fly-dy': `${swapFlight.boardToHand.dy}px`,
              } as CSSProperties
            }
          >
            <FlightCardShell
              card={swapFlight.boardToHand.card}
              faceDown={swapFlight.boardToHand.faceDown}
              isOwnPrivate={swapFlight.boardToHand.isOwnPrivate}
            />
          </div>
        </div>
      )}

      {/* Laser Scan Sweep VFX Overlay (Both Player & Opponent Scans!) */}
      {scanVfx && (
        <div
          key={scanVfx.id}
          className={`lc-scan-beam-overlay ${scanVfx.caught ? 'caught' : ''}`}
          style={{
            left: scanVfx.rect.left - 3,
            top: scanVfx.rect.top - 3,
            width: scanVfx.rect.width + 6,
            height: scanVfx.rect.height + 6,
          }}
          aria-hidden="true"
        >
          <div className="lc-scan-grid" />
          <div className="lc-scan-laser" />
          <span className="lc-scan-result-tag">
            {scanVfx.caught ? 'TAMPERED!' : 'VERIFIED'}
          </span>
        </div>
      )}

      {/* Damage Effect 1: Single Round Defeat Mosaic Flicker Overlay */}
      {roundLossFlicker && (
        <div className="lc-mosaic-flicker-overlay" aria-hidden="true">
          {MOSAIC_FLICKER_TILES.map((cls, i) => (
            <span key={i} className={`lc-mosaic-tile ${cls}`} />
          ))}
        </div>
      )}

      <CyberToastHub toasts={toasts} onDismiss={dismissToast} />

      {/* Integrated Settings Menu Overlay */}
      {activeModal.type === 'settings-menu' && (
        <div
          className="lc-settings-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="系统集成设置菜单"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal({ type: 'none' });
          }}
        >
          <div className="lc-settings-menu">
            <div style={{ textAlign: 'center' }}>
              <h2 className="lc-glitch-title">系统设置</h2>
              <div className="lc-glitch-sub">&lt; CODE : MINGAN &gt;</div>
            </div>

            <div className="lc-menu-list" role="menu">
              {SETTINGS_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  id={item.id}
                  type="button"
                  role="menuitem"
                  className={`lc-menu-item ${activeMenuId === item.id ? 'active' : ''}`}
                  onMouseEnter={() => setActiveMenuId(item.id)}
                  onClick={() => {
                    if (item.keyName === 'contracts') setActiveModal({ type: 'contracts' });
                    else if (item.keyName === 'llm') setActiveModal({ type: 'llm' });
                    else if (item.keyName === 'preset-wb')
                      setActiveModal({ type: 'preset-wb', section: 'preset' });
                    else if (item.keyName === 'rules') setActiveModal({ type: 'protocol', tab: 'suits' });
                    else if (item.keyName === 'audit') setActiveModal({ type: 'protocol', tab: 'audit' });
                    else if (item.keyName === 'tuning') setActiveModal({ type: 'tuning' });
                  }}
                >
                  <PixelMenuIcon kind={item.icon} size={15} />
                  {item.label}
                </button>
              ))}
              <button
                id="menu-close-back"
                type="button"
                role="menuitem"
                className="lc-menu-item"
                onClick={() => setActiveModal({ type: 'none' })}
              >
                <PixelMenuIcon kind="back" size={15} />
                返回牌局
              </button>
            </div>

            {/* Quick VFX Preview Toggles so user can inspect all damage states for both sides */}
            <div className="lc-vfx-strip">
              <span className="lc-menu-note">战损与危机特效即时预览（含对手受击）</span>
              <div className="lc-vfx-btn-row">
                <button
                  id="vfx-test-round-loss"
                  type="button"
                  className={`lc-vfx-chip ${roundLossFlicker ? 'active' : ''}`}
                  onClick={() => {
                    setActiveModal({ type: 'none' });
                    setRoundLossFlicker(true);
                    setAiRoundLossFlicker(true);
                    window.setTimeout(() => {
                      setRoundLossFlicker(false);
                      setAiRoundLossFlicker(false);
                    }, 1200);
                  }}
                >
                  单轮败北闪烁
                </button>
                <button
                  id="vfx-test-low-compute"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'low' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'low' ? 'auto' : 'low'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'low' ? '关闭红流警报' : '低算力红流'}
                </button>
                <button
                  id="vfx-test-bankrupt"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'bankrupt' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'bankrupt' ? 'auto' : 'bankrupt'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'bankrupt' ? '恢复立绘' : '归零淹没扭曲'}
                </button>
                <button
                  id="vfx-test-reset"
                  type="button"
                  className="lc-vfx-chip"
                  onClick={() => {
                    setVfxTestMode('auto');
                    setRoundLossFlicker(false);
                    setAiRoundLossFlicker(false);
                    setActiveModal({ type: 'none' });
                  }}
                >
                  恢复正常
                </button>
              </div>
            </div>

            <div className="lc-menu-note">
              {SETTINGS_MENU_ITEMS.find((i) => i.id === activeMenuId)?.note ??
                '支持拖拽手牌至暗牌互换'}
            </div>
          </div>
        </div>
      )}

      {/* Lazy-Loaded System Modals */}
      <Suspense fallback={null}>
        {activeModal.type === 'contracts' && (
          <ContractArchiveModal
            catalog={catalog}
            catalogSource={catalogSource}
            activeCharacter={character}
            isLoadingCard={isLoadingCard}
            onSelectCardFile={handleSwitchContractFile}
            onImportJsonText={handleImportJsonCard}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'llm' && (
          <LlmTerminalModal
            config={llmConfig}
            character={character}
            dossier={dossier}
            campaign={campaign}
            state={state}
            activePreset={activePreset}
            worldbook={worldbook}
            chatHistory={buildChatHistorySnapshot()}
            logs={llmLogs}
            onSaveConfig={(next) => {
              setLlmConfig(next);
              saveLlmConfigToStorage(next);
            }}
            onAppendLog={(entry) => setLlmLogs((prev) => [entry, ...prev].slice(0, 40))}
            onClearLogs={() => setLlmLogs([])}
            onOpenPresetWorldbook={(sec) => setActiveModal({ type: 'preset-wb', section: sec })}
            onNotify={pushToast}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'preset-wb' && (
          <PresetWorldbookModal
            initialSection={activeModal.section}
            presets={presets}
            activePresetId={activePreset.id}
            worldbook={worldbook}
            campaign={campaign}
            character={character}
            dossier={dossier}
            onUpdatePresets={(nextPresets, nextActiveId) => {
              setPresets(nextPresets);
              savePresets(nextPresets);
              if (nextActiveId) {
                setActivePresetId(nextActiveId);
                saveActivePresetId(nextActiveId);
              }
            }}
            onUpdateWorldbook={(nextWb) => {
              setWorldbook(nextWb);
              saveWorldbook(nextWb);
            }}
            onNotify={pushToast}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {(campaign.status === 'loot-select' ||
          campaign.status === 'escaped' ||
          campaign.status === 'failed-ending' ||
          campaign.status === 'disguise-select' ||
          manualDisguiseOpen) && (
          <CampaignOutcomeModal
            campaign={campaign}
            onSelectDisguise={(entityId) => {
              const nextCamp = selectMatchDisguise(campaign, entityId);
              setCampaign(nextCamp);
              setManualDisguiseOpen(false);
              const chosen = getActiveDisguiseEntity(nextCamp);
              pushToast(
                'info',
                `已切换出战虚拟实体：${chosen.name}`,
                chosen.isCore ? '警告：以本体迎战败北将触发失败结局' : '安全：当前实体可作为诱饵抵消一次失败'
              );
            }}
            onClaimLootSkill={(skillId) => {
              const nextCamp = claimVictoryLoot(campaign, skillId);
              setCampaign(nextCamp);
              void advanceToNextPursuerMatch(nextCamp);
            }}
            onContinueAfterEscape={() => {
              const nextCamp = {
                ...campaign,
                status: (campaign.capturedEntities.length > 0 ? 'disguise-select' : 'active') as
                  | 'disguise-select'
                  | 'active',
                lastEscapeLog: null,
              };
              setCampaign(nextCamp);
              void advanceToNextPursuerMatch(nextCamp);
            }}
            onRestartCampaign={() => {
              const fresh = createInitialCampaign(campaign.playerCodename);
              setCampaign(fresh);
              setManualDisguiseOpen(false);
              performFullReset(undefined, undefined, []);
              pushToast('success', '已重构黑域本体档案，重新开始潜行');
            }}
            onCloseOptional={
              manualDisguiseOpen && campaign.status === 'active'
                ? () => setManualDisguiseOpen(false)
                : undefined
            }
          />
        )}

        {activeModal.type === 'protocol' && (
          <ProtocolManualModal
            initialTab={activeModal.tab}
            config={state.config}
            history={state.actionHistory}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'tuning' && (
          <SandboxTuningModal
            config={state.config}
            onApplyLive={(partial) =>
              setState((prev) => ({
                ...prev,
                config: { ...prev.config, ...partial },
              }))
            }
            onApplyAndRestart={(nextCfg) => performFullReset(nextCfg)}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}
      </Suspense>

      {activeModal.type === 'confirm-reset' && (
        <ConfirmCyberModal
          title="确认重置整场像素赌局？"
          description={`此操作将终止当前牌局，并将你与「${character.name}」的算力全部重置为 ${state.config.startingChips}。`}
          confirmLabel="确认重置战场"
          onConfirm={() => performFullReset()}
          onCancel={() => setActiveModal({ type: 'none' })}
        />
      )}
    </div>
  );
}

function FlightCardShell({
  card,
  faceDown,
  isOwnPrivate,
}: {
  card?: Card;
  faceDown: boolean;
  isOwnPrivate?: boolean;
}) {
  if (faceDown || !card) {
    return (
      <div className="px-card-face px-card-back" style={{ transform: 'none' }}>
        <div className="px-back-grid-icon" aria-hidden="true">
          <span />
        </div>
        <span className="px-back-code">SWAP</span>
      </div>
    );
  }
  const isPink = card.suit === 'P';
  const rankTxt = formatRank(card.rank);
  const hexCode = `0x${card.rank.toString(16).toUpperCase().padStart(2, '0')}`;
  return (
    <div
      className={`px-card-face px-card-front ${isPink ? 'suit-P' : 'suit-B'} ${
        isOwnPrivate ? 'own-private-blink' : ''
      }`}
    >
      <div className="px-card-hud-top">
        <span className="px-card-hex">{hexCode}</span>
        {isOwnPrivate ? (
          <span className="px-card-priv-tag">PRIV</span>
        ) : (
          <span className="px-card-mini-dot" />
        )}
      </div>
      <div className="px-card-hero-stage">
        <span
          className={`px-card-hero-rank ${isPink ? 'rank-pink' : 'rank-cyan'} ${
            rankTxt === '10' ? 'is-ten' : ''
          }`}
        >
          {rankTxt}
        </span>
      </div>
      <div className="px-card-hud-bot">
        <span className="px-card-suit-bar" />
        <span className="px-card-pips">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}

export default App;
