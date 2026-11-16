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
  type PlayerId,
} from './engine/types.ts';
import {
  applyAction,
  computeThreeRaisePresets,
  createInitialState,
  formatRank,
  formatSuitLabel,
  formatTamperLabel,
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
  getVisiblePlayerChips,
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
import {
  DEFAULT_CHEAT_SKILLS,
  MAX_CHEAT_SKILLS,
  MAX_SUPPORT_SKILLS,
  PLAY_STYLE_META,
  CHEAT_PROFILE_META,
  SKILL_POOL_REGISTRY,
  buildPursuerDossier,
  equipGroupedSkill,
  getSkillById,
  getSkillGroup,
  needsGroupedSkillReplacement,
  resolvePursuerStrategyProfile,
} from './engine/skillPool.ts';
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
import { LocalAiAgent, resolveEffectiveAiDifficulty } from './engine/aiAgent.ts';
import {
  createNextHandReadyState,
  getNextHandReadySummary,
  mirrorStateForGuestView,
  reduceNextHandReadyState,
  sanitizeStateForGuest,
  type NextHandReadyState,
  type P2pPacket,
  type P2pPeerProfile,
} from './engine/p2pProtocol.ts';
import {
  WebRtcP2pTransport,
  WsRelayP2pTransport,
  fetchRoomOffer,
  pollRoomAnswer,
  probeRoomCapabilities,
  publishRoomAnswer,
  publishRoomOffer,
  type P2pConnectionStatus,
  type P2pRole,
  type P2pTransport,
} from './engine/p2pTransport.ts';
import {
  actionToSoundCue,
  loadSoundSettings,
  playSound,
  saveSoundSettings,
  showdownToSoundCue,
  unlockAudioContext,
  type SoundSettings,
} from './engine/soundEngine.ts';
import {
  DEBUG_CHEAT_COMMANDS,
  applyDebugChipsOverride,
  applyDebugLoseHand,
  applyDebugPresetHand,
  applyDebugWinHand,
  parseDebugCommand,
} from './engine/debugCmd.ts';
import type { DebugCmdLogEntry } from './components/DebugCmdModal.tsx';
import {
  ESCAPE_ROUTE_NODES,
  canEnterEscapeNode,
  claimEscapeNodeSkill,
  completeEscapeTransition,
  loadEscapeProgress,
  markEscapeNodeCleared,
  markEscapeWallRevealed,
  resetEscapeProgress,
  saveEscapeProgress,
  type EscapeMapProgress,
} from './engine/escapeMap.ts';
import {
  SEC00_MONOLOGUE_STEPS,
  createSec00TutorialState,
  getSec00Capabilities,
  getSec00Guidance,
  isSec00ActionAllowed,
  pickSec00AiAction,
} from './engine/sec00Tutorial.ts';
import {
  formatMuteGarbledText,
  getStoryCharacterByEscapeNode,
  isMuteGarbledCharacter,
  pickMuteActionThought,
  resolveEcho0Sprite,
  resolveSec01Sprite,
  resolveSec02Sprite,
} from './engine/storyCharacters.ts';
import { resolveTutorialSpotlightPlan } from './engine/tutorialSpotlight.ts';
import { CyberBackdrop } from './components/CyberBackdrop.tsx';
import Sec00TutorialOverlay from './components/Sec00TutorialOverlay.tsx';
import { TutorialSpotlightOverlay } from './components/TutorialSpotlightOverlay.tsx';
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
const P2pLobbyModal = lazy(() => import('./components/P2pLobbyModal.tsx'));
const EscapeRouteMapView = lazy(() => import('./components/EscapeRouteMapView.tsx'));
const DebugCmdModal = lazy(() => import('./components/DebugCmdModal.tsx'));
const SkillLootReplaceModal = lazy(() => import('./components/SkillLootReplaceModal.tsx'));

const SETTINGS_MENU_ITEMS: Array<{
  id: string;
  keyName: 'tutorial' | 'cmd' | 'p2p' | 'contracts' | 'llm' | 'preset-wb' | 'rules' | 'audit' | 'tuning';
  label: string;
  note: string;
  icon: 'contracts' | 'llm' | 'rules' | 'audit' | 'tuning';
}> = [
  { id: 'menu-tutorial', keyName: 'tutorial', label: '重玩新手教学 (ECHO-0)', note: '重开 SEC-00 匿名终端单轮连贯教学与规则聚光引导', icon: 'rules' },
  { id: 'menu-cmd', keyName: 'cmd', label: '调试控制台 (CMD)', note: '输入作弊码（win 直接过关 / goto / chips / hand / reveal）', icon: 'tuning' },
  { id: 'menu-p2p', keyName: 'p2p', label: '好友联机 (P2P)', note: 'WebRTC 端到端与好友开桌对战，防抓包视野隔离', icon: 'contracts' },
  { id: 'menu-contracts', keyName: 'contracts', label: '追捕者档案', note: '切换契约角色并预览现实礼装/虚拟实体双态', icon: 'contracts' },
  { id: 'menu-llm', keyName: 'llm', label: 'LLM 网关', note: '配置 OpenAI 兼容或 Google Vertex AI 接入', icon: 'llm' },
  { id: 'menu-preset-wb', keyName: 'preset-wb', label: '预设与世界书', note: '编辑 SillyTavern 兼容预设词条与世界书注入', icon: 'rules' },
  { id: 'menu-rules', keyName: 'rules', label: '概率与规则', note: '双花色牌型阶梯与黑域实体规则', icon: 'rules' },
  { id: 'menu-audit', keyName: 'audit', label: '对局流水', note: '查看历史出牌与动作日志', icon: 'audit' },
  { id: 'menu-tuning', keyName: 'tuning', label: '数值调优', note: '算力规模、换牌门票与AI风格', icon: 'tuning' },
];

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const FLOOD_DATA_STREAMS = Array.from({ length: 42 }, (_, i) => {
  const clusterBase = [3, 9, 14, 21, 28, 37, 46, 54, 62, 71, 79, 86, 93][i % 13];
  const leftPct = Math.max(0.5, Math.min(97.5, clusterBase + (seededUnit(i + 1) - 0.5) * 9.5));
  const dur = 1.15 + seededUnit(i + 41) * 2.45;
  const delay = -seededUnit(i + 83) * 2.8;
  const fontSize = 9.5 + seededUnit(i + 127) * 6.5;
  const opacity = 0.42 + seededUnit(i + 173) * 0.56;
  const letterSpacing = 0.08 + seededUnit(i + 211) * 0.22;
  const variant = Math.floor(seededUnit(i + 251) * 4);
  return {
    left: `${leftPct.toFixed(1)}%`,
    dur: `${dur.toFixed(2)}s`,
    delay: `${delay.toFixed(2)}s`,
    fontSize: `${fontSize.toFixed(1)}px`,
    opacity: Number(opacity.toFixed(2)),
    letterSpacing: `${letterSpacing.toFixed(2)}em`,
    tokens:
      variant === 0
        ? '0xERR  MEM::0000  SYS::CRASH  OVERFLOW  01011001  FATAL'
        : variant === 1
          ? 'BREACH!!  NULL_PTR  11100010  CORE_MELTDOWN  0xDEAD'
          : variant === 2
            ? 'DROP_ALL  0x4F  PACKET_LOSS  10110110  LINK_SEVERED'
            : '01001110  SEGFAULT  0xFF00  STACK_CORRUPT  ABORT',
  };
});

const PORTRAIT_TEAR_SLICES = [
  { top: 0, bottom: 84, cls: 'slice-a' },
  { top: 15, bottom: 71, cls: 'slice-b' },
  { top: 28, bottom: 56, cls: 'slice-c' },
  { top: 43, bottom: 40, cls: 'slice-d' },
  { top: 59, bottom: 23, cls: 'slice-e' },
  { top: 76, bottom: 0, cls: 'slice-f' },
] as const;

const MOSAIC_FLICKER_SHARDS = Array.from({ length: 52 }, (_, i) => {
  const w = 3.5 + seededUnit(i + 301) * 22;
  const h = 2.2 + seededUnit(i + 353) * 11;
  const left = seededUnit(i + 401) * (100 - w * 0.6);
  const top = seededUnit(i + 449) * (100 - h * 0.6);
  const t = seededUnit(i + 503);
  const tone = t < 0.28 ? 't1' : t < 0.56 ? 't2' : t < 0.84 ? 't3' : 't4';
  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
    width: `${w.toFixed(1)}%`,
    height: `${h.toFixed(1)}%`,
    tone,
  };
});

const MOSAIC_FLOOD_SHARDS = Array.from({ length: 68 }, (_, i) => {
  const w = 5 + seededUnit(i + 601) * 26;
  const h = 3.5 + seededUnit(i + 653) * 15;
  const left = seededUnit(i + 701) * (100 - w * 0.5);
  const top = seededUnit(i + 751) * (100 - h * 0.5);
  const t = seededUnit(i + 809);
  const tone = t < 0.26 ? 'pink' : t < 0.48 ? 'cyan' : t < 0.82 ? 'void' : 'red';
  const delay = (seededUnit(i + 863) * 0.55).toFixed(2);
  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
    width: `${w.toFixed(1)}%`,
    height: `${h.toFixed(1)}%`,
    tone,
    delay: `${delay}s`,
  };
});

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

const FIXED_CRUSHED_DOCK_H = 28;

type ActiveModal =
  | { type: 'none' }
  | { type: 'settings-menu' }
  | { type: 'cmd' }
  | { type: 'p2p' }
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
  const [escapeProgress, setEscapeProgress] = useState<EscapeMapProgress>(() => loadEscapeProgress());
  const [viewMode, setViewMode] = useState<'arena' | 'escape-map'>('arena');
  const [activeEscapeNodeIndex, setActiveEscapeNodeIndex] = useState<number | null>(() => {
    const initEsc = loadEscapeProgress();
    return initEsc.escapedReality ? 0 : Math.min(4, initEsc.currentNodeIndex);
  });
  const escapeProgressRef = useRef(escapeProgress);
  escapeProgressRef.current = escapeProgress;
  const activeEscapeNodeRef = useRef(activeEscapeNodeIndex);
  activeEscapeNodeRef.current = activeEscapeNodeIndex;
  const escapeClearQueuedForMatchRef = useRef(false);

  const [sec00GuideActive, setSec00GuideActive] = useState<boolean>(() => {
    const initEsc = loadEscapeProgress();
    const initNodeIdx = initEsc.escapedReality ? 0 : Math.min(4, initEsc.currentNodeIndex);
    return initNodeIdx === 0 && !initEsc.clearedIndices.includes(0);
  });
  const [sec00IntroIndex, setSec00IntroIndex] = useState<number | null>(() => {
    const initEsc = loadEscapeProgress();
    const initNodeIdx = initEsc.escapedReality ? 0 : Math.min(4, initEsc.currentNodeIndex);
    return initNodeIdx === 0 && !initEsc.clearedIndices.includes(0) ? 0 : null;
  });
  const [thoughtSpotlightActive, setThoughtSpotlightActive] = useState(false);
  const thoughtSpotlightTimerRef = useRef<number | null>(null);
  const sec00GuideActiveRef = useRef(sec00GuideActive);
  sec00GuideActiveRef.current = sec00GuideActive;
  const sec00IntroIndexRef = useRef(sec00IntroIndex);
  sec00IntroIndexRef.current = sec00IntroIndex;

  const [state, setState] = useState<GameState>(() => {
    const initEsc = loadEscapeProgress();
    const initNodeIdx = initEsc.escapedReality ? 0 : Math.min(4, initEsc.currentNodeIndex);
    if (initNodeIdx === 0 && !initEsc.clearedIndices.includes(0)) {
      return createSec00TutorialState();
    }
    const initNode = ESCAPE_ROUTE_NODES[initNodeIdx] ?? ESCAPE_ROUTE_NODES[0];
    return createInitialState({
      config: { ...DEFAULT_CONFIG, aiDifficulty: initNode.difficulty },
      chips: { human: DEFAULT_CONFIG.startingChips, ai: initNode.opponentChips },
      opponentName: initNode.opponentName,
      opponentSignatureSkill: initNode.signatureSkillId,
      aiSpecialCheatSkill: initNode.specialCheatSkillId,
      playerCheatSkills: initEsc.equippedCheatSkills,
      playerAcquiredSkills: initEsc.equippedSkills,
    });
  });
  const [pendingSkillClaim, setPendingSkillClaim] = useState<{
    title: string;
    subtitle: string;
    choices: string[];
    clearedNodeIndex?: number;
  } | null>(null);
  const [activeExpression, setActiveExpression] = useState<ContractExpression>('calm');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [draggedHandIndex, setDraggedHandIndex] = useState<number | null>(null);
  const [dragOverBoardIndex, setDragOverBoardIndex] = useState<number | null>(null);
  const [showRaiseTiers, setShowRaiseTiers] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [pendingSkillTargetId, setPendingSkillTargetId] = useState<string | null>(null);
  const [slashBurstKey, setSlashBurstKey] = useState<string | null>(null);
  const lastSlashedHandRef = useRef<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [activeModal, setActiveModal] = useState<ActiveModal>({ type: 'none' });
  const [activeMenuId, setActiveMenuId] = useState('menu-contracts');

  // VFX state & optional manual test override inside Settings
  const [roundLossFlicker, setRoundLossFlicker] = useState(false);
  const [aiRoundLossFlicker, setAiRoundLossFlicker] = useState(false);
  const [vfxTestMode, setVfxTestMode] = useState<
    'auto' | 'human-low' | 'human-bankrupt' | 'ai-low' | 'ai-bankrupt'
  >('auto');
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

  // P2P Multiplayer State
  const [p2pStatus, setP2pStatus] = useState<P2pConnectionStatus>('idle');
  const [p2pDetail, setP2pDetail] = useState('未连接');
  const [p2pRole, setP2pRole] = useState<P2pRole | null>(null);
  const [p2pLatency, setP2pLatency] = useState<number | null>(null);
  const [remotePeer, setRemotePeer] = useState<P2pPeerProfile | null>(null);
  const [localP2pName, setLocalP2pName] = useState('潜行黑客');
  const [p2pOfferToken, setP2pOfferToken] = useState('');
  const [p2pAnswerToken, setP2pAnswerToken] = useState('');
  const [p2pRoomCode, setP2pRoomCode] = useState('');
  const [p2pNextHandReady, setP2pNextHandReady] = useState<NextHandReadyState>(
    () => createNextHandReadyState()
  );
  const p2pNextHandReadyRef = useRef<NextHandReadyState>(p2pNextHandReady);
  p2pNextHandReadyRef.current = p2pNextHandReady;
  const p2pMatchActiveRef = useRef(false);
  const p2pTransportRef = useRef<P2pTransport | null>(null);
  const p2pSeqRef = useRef(0);
  const p2pRoomPollRef = useRef<number | null>(null);
  const isP2pConnected = p2pStatus === 'connected';
  const isP2pHost = isP2pConnected && p2pRole === 'host';
  const isP2pGuest = isP2pConnected && p2pRole === 'guest';
  const isP2pSessionActive =
    isP2pConnected ||
    (p2pMatchActiveRef.current && (p2pStatus === 'connecting' || p2pStatus === 'waiting-answer'));

  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadMobileChat, setUnreadMobileChat] = useState(0);
  const mobileChatOpenRef = useRef(mobileChatOpen);
  mobileChatOpenRef.current = mobileChatOpen;
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());

  const [toasts, setToasts] = useState<CyberToast[]>([]);
  const [cmdLogs, setCmdLogs] = useState<DebugCmdLogEntry[]>([
    {
      id: 'cmd-init',
      tone: 'info',
      text: 'BLACK-DOMAIN DEBUG CONSOLE READY // 输入 help 查看作弊码，输入 win 直接过关（支持按 ~ 或 F9 唤起）',
    },
  ]);

  const activeEscapeNode =
    activeEscapeNodeIndex !== null ? ESCAPE_ROUTE_NODES[activeEscapeNodeIndex] ?? null : null;
  const activeStoryCharacter =
    activeEscapeNode && !isP2pConnected
      ? getStoryCharacterByEscapeNode(activeEscapeNode.index)
      : null;
  const effectiveCharacter = activeStoryCharacter ?? character;

  const dossier = useMemo(
    () => buildPursuerDossier(effectiveCharacter, campaign.roundIndex),
    [effectiveCharacter, campaign.roundIndex]
  );
  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? presets[0],
    [presets, activePresetId]
  );
  const activeDisguise = useMemo(() => getActiveDisguiseEntity(campaign), [campaign]);

  useEffect(() => {
    saveCampaignState(campaign);
  }, [campaign]);

  useEffect(() => {
    saveEscapeProgress(escapeProgress);
  }, [escapeProgress]);

  const latestCampaignRef = useRef(campaign);
  latestCampaignRef.current = campaign;
  const latestDossierRef = useRef(dossier);
  latestDossierRef.current = dossier;
  const latestPresetRef = useRef(activePreset);
  latestPresetRef.current = activePreset;
  const latestWorldbookRef = useRef(worldbook);
  latestWorldbookRef.current = worldbook;
  const p2pRoleRef = useRef(p2pRole);
  p2pRoleRef.current = p2pRole;
  const localP2pNameRef = useRef(localP2pName);
  localP2pNameRef.current = localP2pName;
  const remotePeerRef = useRef(remotePeer);
  remotePeerRef.current = remotePeer;
  const activeDisguiseRef = useRef(activeDisguise);
  activeDisguiseRef.current = activeDisguise;

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

  const stopP2pRoomPoll = useCallback(() => {
    if (p2pRoomPollRef.current !== null) {
      window.clearInterval(p2pRoomPollRef.current);
      p2pRoomPollRef.current = null;
    }
  }, []);

  const pushP2pStateToGuest = useCallback((hostState: GameState) => {
    const tr = p2pTransportRef.current;
    if (!tr || tr.role !== 'host') return;
    p2pSeqRef.current += 1;
    const guestState = mirrorStateForGuestView(sanitizeStateForGuest(hostState));
    tr.send({ type: 'STATE_SYNC', seq: p2pSeqRef.current, state: guestState });
  }, []);

  const buildLocalPeerProfile = useCallback((): P2pPeerProfile => {
    const char = latestCharRef.current;
    const dis = activeDisguiseRef.current;
    const rawPortrait = dis.virtualPortrait || './assets/opponent-halfbody.webp';
    // Avoid stuffing 200KB base64 images directly into HELLO when characterFileName can resolve locally
    const lightweightPortrait =
      rawPortrait.startsWith('data:') && (dis.sourceCharacterFile || char.fileName)
        ? './assets/opponent-halfbody.webp'
        : rawPortrait;
    return {
      name: localP2pNameRef.current.trim() || '潜行黑客',
      codename: dis.codename || 'ZERO-BYTE',
      title: dis.isCore ? '潜行黑客本体' : dis.name,
      portrait: lightweightPortrait,
      accentColor: dis.accentColor || '#00F0FF',
      characterFileName: dis.sourceCharacterFile || char.fileName,
    };
  }, []);

  const handleP2pPacketRef = useRef<(pkt: P2pPacket) => void>(() => {});
  const onP2pStatusChangeRef = useRef<(status: P2pConnectionStatus, detail?: string) => void>(() => {});

  const disconnectP2p = useCallback(() => {
    stopP2pRoomPoll();
    p2pTransportRef.current?.close();
    p2pTransportRef.current = null;
    p2pMatchActiveRef.current = false;
    setP2pStatus('idle');
    setP2pDetail('未连接');
    setP2pRole(null);
    setP2pLatency(null);
    setRemotePeer(null);
    setP2pOfferToken('');
    setP2pAnswerToken('');
    setP2pRoomCode('');
    setP2pNextHandReady(createNextHandReadyState());
    pushToast('info', '已断开 P2P 联机', '已切回单机模式');
  }, [stopP2pRoomPoll, pushToast]);

  const initP2pTransport = useCallback(
    (role: P2pRole) => {
      stopP2pRoomPoll();
      p2pTransportRef.current?.close();
      p2pMatchActiveRef.current = false;
      setP2pRole(role);
      p2pRoleRef.current = role;
      setP2pOfferToken('');
      setP2pAnswerToken('');
      setP2pNextHandReady(createNextHandReadyState());
      const tr = new WebRtcP2pTransport(role, {
        onStatusChange: (s, d) => onP2pStatusChangeRef.current(s, d),
        onPacket: (pkt) => handleP2pPacketRef.current(pkt),
        onLatency: (ms) => setP2pLatency(ms),
      });
      p2pTransportRef.current = tr;
      return tr;
    },
    [stopP2pRoomPoll]
  );

  const initWsRelayTransport = useCallback(
    (role: P2pRole) => {
      stopP2pRoomPoll();
      p2pTransportRef.current?.close();
      p2pMatchActiveRef.current = false;
      setP2pRole(role);
      p2pRoleRef.current = role;
      setP2pOfferToken('');
      setP2pAnswerToken('');
      setP2pNextHandReady(createNextHandReadyState());
      const tr = new WsRelayP2pTransport(role, {
        onStatusChange: (s, d) => onP2pStatusChangeRef.current(s, d),
        onPacket: (pkt) => handleP2pPacketRef.current(pkt),
        onLatency: (ms) => setP2pLatency(ms),
      });
      p2pTransportRef.current = tr;
      return tr;
    },
    [stopP2pRoomPoll]
  );

  useEffect(() => {
    return () => {
      stopP2pRoomPoll();
      p2pTransportRef.current?.close();
    };
  }, [stopP2pRoomPoll]);

  onP2pStatusChangeRef.current = (nextStatus, detail) => {
    setP2pStatus(nextStatus);
    if (detail) setP2pDetail(detail);
    if (nextStatus === 'connected') {
      stopP2pRoomPoll();
      const tr = p2pTransportRef.current;
      const role = p2pRoleRef.current;
      if (tr) {
        tr.send({ type: 'HELLO', peer: buildLocalPeerProfile() });
        if (role === 'host') {
          if (p2pMatchActiveRef.current) {
            pushP2pStateToGuest(latestStateRef.current);
            tr.send({
              type: 'NEXT_HAND_READY_SYNC',
              hostReady: p2pNextHandReadyRef.current.hostReady,
              guestReady: p2pNextHandReadyRef.current.guestReady,
            });
            pushToast('success', 'P2P 连接已恢复', '已自动同步当前牌桌进度');
          } else {
            p2pMatchActiveRef.current = true;
            const fresh = createInitialState({
              config: { ...latestStateRef.current.config },
              opponentName: remotePeerRef.current?.name ?? '联机好友',
              playerAcquiredSkills: [],
            });
            setState(fresh);
            setP2pNextHandReady(createNextHandReadyState());
            setMessages([
              {
                id: `p2p-start-${Date.now()}`,
                sender: 'opponent',
                speaker: '系统信标',
                text: 'P2P 直连牌桌已建立，双方信息严格隔离开局！',
                crushed: false,
              },
            ]);
            pushP2pStateToGuest(fresh);
            pushToast('success', 'P2P 直连成功（房主）', '已向好友下发初始发牌');
          }
        } else {
          if (p2pMatchActiveRef.current) {
            tr.send({ type: 'SYNC_REQ' });
            pushToast('success', '已重连云端房间', '正在同步最新牌桌进度...');
          } else {
            p2pMatchActiveRef.current = true;
            pushToast('success', 'P2P 直连成功（客机）', '正在同步房主牌桌...');
          }
        }
      }
      setActiveModal({ type: 'none' });
    } else if (nextStatus === 'closed' || nextStatus === 'error') {
      pushToast('warn', 'P2P 连接状态提示', detail || '连接已关闭');
    }
  };

  handleP2pPacketRef.current = (pkt) => {
    const role = p2pRoleRef.current;
    if (pkt.type === 'HELLO') {
      setRemotePeer(pkt.peer);
      setState((prev) => ({
        ...prev,
        players: {
          ...prev.players,
          ai: { ...prev.players.ai, name: pkt.peer.name },
        },
      }));
      if (pkt.peer.characterFileName) {
        void loadContractCharacterByFile(pkt.peer.characterFileName)
          .then((loaded) => {
            const resolvedImg = resolveVirtualEntityPortrait(loaded, 'calm');
            setRemotePeer((curr) => (curr ? { ...curr, portrait: resolvedImg } : curr));
          })
          .catch(() => {
            /* keep lightweight portrait */
          });
      }
      enqueueTask({
        kind: 'opponent',
        speaker: pkt.peer.name,
        text: `已建立直连——我是「${pkt.peer.title}」${pkt.peer.name}。请出牌！`,
      });
      return;
    }
    if (pkt.type === 'STATE_SYNC' && role === 'guest') {
      setState(pkt.state);
      return;
    }
    if (pkt.type === 'ACTION_REQ' && role === 'host') {
      const curr = latestStateRef.current;
      if (curr.phase === 'showdown' || curr.currentTurn !== 'ai') return;
      if (!isActionLegal(curr, pkt.action)) return;
      const next = applyAction(curr, pkt.action);
      setState(next);
      pushP2pStateToGuest(next);
      if (pkt.bundledSpeech) {
        enqueueTask({
          kind: 'opponent',
          speaker: remotePeerRef.current?.name ?? next.players.ai.name,
          text: pkt.bundledSpeech,
        });
      }
      return;
    }
    if (pkt.type === 'CHAT_MSG') {
      if (pkt.expression) setActiveExpression(pkt.expression);
      enqueueTask({
        kind: 'opponent',
        speaker: pkt.speaker,
        text: pkt.text,
        msgKind: pkt.msgKind,
      });
      return;
    }
    if (pkt.type === 'EXPRESSION_SYNC') {
      setActiveExpression(pkt.expression);
      return;
    }
    if (pkt.type === 'SYNC_REQ' && role === 'host') {
      pushP2pStateToGuest(latestStateRef.current);
      p2pTransportRef.current?.send({
        type: 'NEXT_HAND_READY_SYNC',
        hostReady: p2pNextHandReadyRef.current.hostReady,
        guestReady: p2pNextHandReadyRef.current.guestReady,
      });
      return;
    }
    if (pkt.type === 'READY_NEXT_HAND' && role === 'host') {
      const curr = latestStateRef.current;
      if (curr.phase !== 'showdown') return;
      const nextReady = reduceNextHandReadyState(p2pNextHandReadyRef.current, 'guest', pkt.ready);
      const summary = getNextHandReadySummary(nextReady);
      if (summary.bothReady) {
        const resetReady = createNextHandReadyState();
        setP2pNextHandReady(resetReady);
        setSelectedHandIndex(null);
        setShowRaiseTiers(false);
        setActiveExpression('calm');
        const nextHand = startNextHand(curr);
        setState(nextHand);
        pushP2pStateToGuest(nextHand);
        p2pTransportRef.current?.send({
          type: 'NEXT_HAND_READY_SYNC',
          hostReady: false,
          guestReady: false,
        });
      } else {
        setP2pNextHandReady(nextReady);
        p2pTransportRef.current?.send({
          type: 'NEXT_HAND_READY_SYNC',
          hostReady: nextReady.hostReady,
          guestReady: nextReady.guestReady,
        });
        pushToast('info', '好友已准备开启下一局', '点击「准备下一局 (1/2)」即可发牌');
      }
      return;
    }
    if (pkt.type === 'NEXT_HAND_READY_SYNC' && role === 'guest') {
      setP2pNextHandReady({
        hostReady: pkt.hostReady,
        guestReady: pkt.guestReady,
      });
      return;
    }
    if (pkt.type === 'NEXT_HAND_REQ' && role === 'host') {
      const curr = latestStateRef.current;
      if (curr.phase !== 'showdown') return;
      const nextReady = reduceNextHandReadyState(p2pNextHandReadyRef.current, 'guest', true);
      if (getNextHandReadySummary(nextReady).bothReady) {
        setP2pNextHandReady(createNextHandReadyState());
        const next = startNextHand(curr);
        setState(next);
        pushP2pStateToGuest(next);
      } else {
        setP2pNextHandReady(nextReady);
        p2pTransportRef.current?.send({
          type: 'NEXT_HAND_READY_SYNC',
          hostReady: nextReady.hostReady,
          guestReady: nextReady.guestReady,
        });
      }
      return;
    }
    if (pkt.type === 'REMATCH_REQ' && role === 'host') {
      setP2pNextHandReady(createNextHandReadyState());
      const fresh = createInitialState({
        config: latestStateRef.current.config,
        opponentName: remotePeerRef.current?.name ?? '联机好友',
        playerAcquiredSkills: [],
      });
      setState(fresh);
      pushP2pStateToGuest(fresh);
      p2pTransportRef.current?.send({
        type: 'NEXT_HAND_READY_SYNC',
        hostReady: false,
        guestReady: false,
      });
    }
  };

  const handleHostCreateRoomRelay = async (code: string) => {
    try {
      const caps = await probeRoomCapabilities();
      if (caps.wsRelay) {
        const ws = initWsRelayTransport('host');
        setP2pRoomCode(code);
        ws.connect(code);
        pushToast('info', `云端房间 ${code} 已开启`, '把 6 位房间号发给好友即可跨网秒连');
        return;
      }
      const tr = initP2pTransport('host');
      setP2pRoomCode(code);
      const offer = await tr.createHostOffer();
      setP2pOfferToken(offer);
      await publishRoomOffer(code, offer);
      pushToast('info', `房间 ${code} 已创建`, '等待好友输入房间号加入');
      p2pRoomPollRef.current = window.setInterval(async () => {
        const answer = await pollRoomAnswer(code);
        if (answer) {
          stopP2pRoomPoll();
          setP2pAnswerToken(answer);
          await tr.completeHostAnswer(answer);
        }
      }, 1100);
    } catch (err) {
      pushToast('error', '房间建房失败', err instanceof Error ? err.message : '未知错误');
    }
  };

  const handleGuestJoinRoomRelay = async (code: string) => {
    try {
      const caps = await probeRoomCapabilities();
      if (caps.wsRelay) {
        const ws = initWsRelayTransport('guest');
        setP2pRoomCode(code);
        ws.connect(code);
        pushToast('info', `正在加入云端房间 ${code}`, '无需穿透防火墙，正在建立通道...');
        return;
      }
      const tr = initP2pTransport('guest');
      setP2pRoomCode(code);
      const offer = await fetchRoomOffer(code);
      const answer = await tr.acceptHostOffer(offer);
      setP2pAnswerToken(answer);
      await publishRoomAnswer(code, answer);
      pushToast('info', `已提交房间 ${code} 应答`, '等待建立 P2P 直连...');
    } catch (err) {
      pushToast('error', '加入房间失败', err instanceof Error ? err.message : '请核对房间号');
    }
  };

  const handleHostCreateManualOffer = async () => {
    try {
      const tr = initP2pTransport('host');
      const offer = await tr.createHostOffer();
      setP2pOfferToken(offer);
      pushToast('success', 'Offer 邀请码已生成', '请点击「复制邀请码发给好友」');
    } catch (err) {
      setP2pStatus('error');
      setP2pDetail('生成邀请码失败');
      pushToast('error', '生成邀请码失败', err instanceof Error ? err.message : '未知错误');
    }
  };

  const handleGuestAcceptManualOffer = async (offer: string) => {
    try {
      const tr = initP2pTransport('guest');
      const answer = await tr.acceptHostOffer(offer);
      setP2pAnswerToken(answer);
      pushToast('success', 'Answer 应答码已生成', '请点击「复制应答码发回给房主」');
    } catch (err) {
      setP2pStatus('error');
      setP2pDetail('解析邀请码失败');
      pushToast('error', '解析邀请码失败', err instanceof Error ? err.message : '请确认完整粘贴 MGP2P 邀请码');
    }
  };

  const handleHostConfirmManualAnswer = async (answer: string) => {
    try {
      const tr = p2pTransportRef.current;
      if (!(tr instanceof WebRtcP2pTransport)) return;
      await tr.completeHostAnswer(answer);
    } catch (err) {
      pushToast('error', '应答确认失败', err instanceof Error ? err.message : '请确认 Answer 应答码正确');
    }
  };

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
  const [messages, setMessages] = useState<ChatItem[]>(() => {
    const initEsc = loadEscapeProgress();
    const initNodeIdx = initEsc.escapedReality ? 0 : Math.min(4, initEsc.currentNodeIndex);
    if (initNodeIdx === 0 && !initEsc.clearedIndices.includes(0)) {
      return [];
    }
    const initNode = ESCAPE_ROUTE_NODES[initNodeIdx] ?? ESCAPE_ROUTE_NODES[0];
    const initStory = getStoryCharacterByEscapeNode(initNodeIdx);
    if (initStory && isMuteGarbledCharacter(initStory.id)) {
      return [
        {
          id: 'init-msg-1',
          sender: 'opponent',
          speaker: initNode.opponentName,
          text: formatMuteGarbledText(`已接入 ${initNode.code} · ${initNode.title}`),
          msgKind: 'speech',
          crushed: false,
        },
        {
          id: 'init-msg-2',
          sender: 'opponent',
          speaker: initNode.opponentName,
          text: initStory.quote,
          msgKind: 'thought',
          crushed: false,
        },
      ];
    }
    return [
      {
        id: 'init-msg-1',
        sender: 'opponent',
        speaker: initNode.opponentName,
        text: `已接入 ${initNode.code} · ${initNode.title}。亮出你的牌序吧。`,
        crushed: false,
      },
    ];
  });
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
  const lastSoundActionIdRef = useRef<string | null>(null);
  const lastChargeStepRef = useRef<number>(-1);
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
  const latestCharRef = useRef(effectiveCharacter);
  latestCharRef.current = effectiveCharacter;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const charNameRef = useRef(effectiveCharacter.name);
  charNameRef.current = effectiveCharacter.name;

  const effectiveAiDifficulty = useMemo(
    () => resolveEffectiveAiDifficulty(state.config.aiDifficulty, dossier.threatLevel),
    [state.config.aiDifficulty, dossier.threatLevel]
  );
  const effectiveStrategy = useMemo(
    () =>
      resolvePursuerStrategyProfile(
        state.config.aiPlayStyle,
        state.config.aiCheatProfile,
        effectiveCharacter,
        dossier
      ),
    [state.config.aiPlayStyle, state.config.aiCheatProfile, effectiveCharacter, dossier]
  );

  useEffect(() => {
    agentRef.current.setStyle(state.config.aiStyle);
    agentRef.current.setDifficulty(effectiveAiDifficulty);
    agentRef.current.setStrategy(effectiveStrategy.playStyle, effectiveStrategy.cheatProfile);
    agentRef.current.setCharacter(effectiveCharacter);
  }, [state.config.aiStyle, effectiveAiDifficulty, effectiveStrategy, effectiveCharacter]);

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
        if (activeEscapeNodeRef.current === null) {
          setState((prev) => ({
            ...prev,
            players: {
              ...prev.players,
              ai: { ...prev.players.ai, name: full.name },
            },
          }));
        }
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
        if (next.msgKind === 'thought' && sec00GuideActiveRef.current) {
          if (thoughtSpotlightTimerRef.current !== null) {
            window.clearTimeout(thoughtSpotlightTimerRef.current);
          }
          setThoughtSpotlightActive(true);
          thoughtSpotlightTimerRef.current = window.setTimeout(() => {
            thoughtSpotlightTimerRef.current = null;
            setThoughtSpotlightActive(false);
          }, 2200);
        }
        playSound('bubble');

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
      let finalTask = task;
      if (
        task.kind === 'opponent' &&
        task.msgKind !== 'thought' &&
        isMuteGarbledCharacter(latestCharRef.current.id)
      ) {
        finalTask = { ...task, text: formatMuteGarbledText(task.text) };
      }
      if (finalTask.kind === 'opponent' && !mobileChatOpenRef.current) {
        setUnreadMobileChat((c) => Math.min(99, c + 1));
      }
      queueRef.current.push(finalTask);
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

  // One-shot opening speech on mount (only in free-play contract mode, never in Escape Route / SEC-00 / Tutorial)
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;

    const boot = window.setTimeout(() => {
      if (
        sec00GuideActiveRef.current ||
        activeEscapeNodeRef.current !== null
      ) {
        return;
      }
      const curr = latestCharRef.current;
      enqueueTask({
        kind: 'opponent',
        speaker: curr.name,
        text: curr.quote,
      });
    }, 450);

    return () => {
      window.clearTimeout(boot);
      if (thoughtSpotlightTimerRef.current !== null) {
        window.clearTimeout(thoughtSpotlightTimerRef.current);
        thoughtSpotlightTimerRef.current = null;
      }
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
  }, [state.lastAction, state.board, state.players, state.phase, state.config.revealOpponentHidden]);

  useEffect(() => {
    if (!swapFlight) return;
    const activeId = swapFlight.id;
    const timer = window.setTimeout(() => {
      setSwapFlight((curr) => (curr?.id === activeId ? null : curr));
    }, 580);
    return () => window.clearTimeout(timer);
  }, [swapFlight?.id]);

  useEffect(() => {
    if (state.phase === 'showdown' || pendingSkillClaim) {
      setSwapFlight(null);
    }
  }, [state.phase, pendingSkillClaim]);

  // AI & Tutorial Turn Scheduler (Skipped during P2P friend multiplayer!)
  useEffect(() => {
    if (isP2pSessionActive || state.phase === 'showdown' || state.currentTurn !== 'ai') return;
    if (sec00GuideActive && sec00IntroIndex !== null) return;

    if (sec00GuideActive) {
      let cancelled = false;
      setIsAiThinking(true);
      const timer = window.setTimeout(() => {
        try {
          const snapshot = latestStateRef.current;
          if (
            cancelled ||
            !sec00GuideActiveRef.current ||
            snapshot.phase === 'showdown' ||
            snapshot.currentTurn !== 'ai'
          ) {
            return;
          }
          const act = pickSec00AiAction(snapshot);
          if (act) {
            setState((prev) => {
              if (prev.phase === 'showdown' || prev.currentTurn !== 'ai') return prev;
              return applyAction(prev, act);
            });
            if (act.type === 'hack') {
              setActiveExpression('smile');
              enqueueTask({
                kind: 'opponent',
                speaker: snapshot.players.ai.name,
                msgKind: 'thought',
                text: '（故意把篡改信号漏得这么明显……只要扫一眼就能抓到破绽。快一点，来击穿我。）',
              });
            } else if (act.type === 'flip') {
              enqueueTask({
                kind: 'opponent',
                speaker: snapshot.players.ai.name,
                msgKind: 'thought',
                text: '（比牌型我已经输了……刚好。借这一局，把「那份东西」写进他的实体壳层里。）',
              });
            } else if (act.type === 'raise') {
              enqueueTask({
                kind: 'opponent',
                speaker: snapshot.players.ai.name,
                msgKind: 'thought',
                text: '（信号极度不稳……追踪节点正在向这片野区合拢……必须……逃出去。）',
              });
            }
          }
        } finally {
          if (!cancelled) setIsAiThinking(false);
        }
      }, 480);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        setIsAiThinking(false);
      };
    }

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
          enqueueOpponentSegments(snapshot.players.ai.name, llmDecision.segments);
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
          enqueueOpponentSegments(snapshot.players.ai.name, chatRes.segments);
        } else {
          setActiveExpression(decision.dialogue.expression);
          if (decision.action.type !== 'hack') {
            enqueueTask({
              kind: 'opponent',
              speaker: snapshot.players.ai.name,
              text: decision.dialogue.text,
            });
            if (isMuteGarbledCharacter(char.id)) {
              const innerThought = pickMuteActionThought(decision.action.type);
              enqueueTask({
                kind: 'opponent',
                speaker: snapshot.players.ai.name,
                msgKind: 'thought',
                text: innerThought,
              });
            }
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
    sec00GuideActive,
    sec00IntroIndex,
    isP2pSessionActive,
    enqueueTask,
    enqueueOpponentSegments,
    buildChatHistorySnapshot,
  ]);

  // Unlock Web Audio API on first user gesture (iOS Safari / Chrome autoplay policy)
  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Synchronized Action Sound Effects (Human, AI, and P2P Remote Actions)
  useEffect(() => {
    const evt = state.lastAction;
    if (!evt || lastSoundActionIdRef.current === evt.id) return;
    lastSoundActionIdRef.current = evt.id;
    const cue = actionToSoundCue(evt);
    if (cue) {
      playSound(cue);
    }
  }, [state.lastAction]);

  // Blade-Slash VFX when "富兰克林之死" severs one of player's cheat skills
  useEffect(() => {
    const locked = state.lockedHumanHackSkill;
    if (!locked || state.phase === 'showdown') return;
    const key = `${state.handNumber}:${locked}`;
    if (lastSlashedHandRef.current === key) return;
    lastSlashedHandRef.current = key;
    setSlashBurstKey(key);
    playSound('blade-slash');
    const skName = getSkillById(locked)?.name ?? locked;
    pushToast(
      'warn',
      '富兰克林之死 · 挥刃断链',
      `${state.players.ai.name}已切割你的「${skName}」作弊链路，本手无法使用`
    );
    const timer = window.setTimeout(() => {
      setSlashBurstKey((curr) => (curr === key ? null : curr));
    }, 950);
    return () => window.clearTimeout(timer);
  }, [state.handNumber, state.lockedHumanHackSkill, state.phase, state.players.ai.name, pushToast]);

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
        evt.actor === 'human'
          ? '扫描抓获对端篡改！'
          : `${state.players.ai.name} 扫描抓获了我方篡改！`,
        evt.label
      );
    } else {
      pushToast(
        'info',
        evt.actor === 'human'
          ? '扫描核验完成：未被篡改'
          : `${state.players.ai.name} 扫描未发现异常`,
        `已预支 ${evt.amount ?? state.config.scanCost} 算力至奖池`
      );
    }
  }, [state.lastAction, state.config.scanCost, state.players.ai.name, pushToast]);

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
    playSound(showdownToSoundCue(res, state.players.human.chips, state.players.ai.chips));

    const line =
      res.reason === 'scan-caught'
        ? res.winner === 'human'
          ? `居然扫出了对手底层篡改！算力池 ${res.potWon} 归我方。`
          : `抓到我方改牌了……算力池 ${res.potWon} 归对端。`
        : res.winner === 'ai'
          ? `算力池 ${res.potWon} 已被对手接管。`
          : res.winner === 'human'
            ? `漂亮的牌序博弈，本局算力池 ${res.potWon} 到手！`
            : `完全同分平局，双方平分算力池 ${res.potWon}。`;

    if (isP2pConnected) {
      enqueueTask({
        kind: 'opponent',
        speaker: remotePeerRef.current?.name ?? character.name,
        text: line,
      });
      return;
    }

    // 普通小局结束（双方算力均未归零）：由 LLM 结合本局胜负、牌型与算力变动发表感想
    if (state.players.ai.chips > 0 && state.players.human.chips > 0) {
      const cfg = latestLlmRef.current;
      const bundledUserText = pendingBundledChatRef.current ?? undefined;
      pendingBundledChatRef.current = null;
      if (cfg.enabled && (cfg.reactAfterEachRound !== false || Boolean(bundledUserText))) {
        const currChar = latestCharRef.current;
        const speakerName = state.players.ai.name;
        const winTxt =
          res.winner === 'human'
            ? '玩家胜出'
            : res.winner === 'ai'
              ? `${speakerName}胜出`
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
          enqueueOpponentSegments(speakerName, enc.fromLlm ? enc.segments : [{ kind: 'speech', text: line }]);
        });
      } else {
        enqueueTask({ kind: 'opponent', speaker: state.players.ai.name, text: line });
        if (isMuteGarbledCharacter(latestCharRef.current.id)) {
          enqueueTask({
            kind: 'opponent',
            speaker: state.players.ai.name,
            msgKind: 'thought',
            text:
              res.winner === 'ai'
                ? '（啊哈、咬碎了一大口！！好甜……你的骨头在发抖吧？再多端上来一点算力呀！！）'
                : res.reason === 'scan-caught'
                  ? '（啧……爪子被夹住了吗？！可恶、可恶！！还没咬断你的脖子呢，不准逃啊！！）'
                  : '（哼……只是让你侥幸啃走一点碎肉而已。下一局就把你的手指和牌一起剁碎！！）',
          });
        }
      }
      return;
    }

    if (!sec00GuideActiveRef.current || state.players.ai.chips > 0) {
      enqueueTask({ kind: 'opponent', speaker: state.players.ai.name, text: line });
    }

    // 整场算力归零：优先处理逃亡路线图节点循环，否则走原契约追捕流程
    if (state.players.ai.chips === 0) {
      if (activeEscapeNodeRef.current !== null) {
        const clearedIdx = activeEscapeNodeRef.current;
        const clearedNode = ESCAPE_ROUTE_NODES[clearedIdx];
        if (!escapeClearQueuedForMatchRef.current) {
          escapeClearQueuedForMatchRef.current = true;
          if (sec00GuideActiveRef.current) {
            setActiveExpression('surprise');
            enqueueTask({
              kind: 'opponent',
              speaker: clearedNode?.opponentName ?? '匿名终端 [UNKNOWN_0x00]',
              text: '算力归零。按黑域协议，这具虚拟实体归你了。……别回头，带上它走。',
            });
          }
          const hasSkillLoot = Boolean(clearedNode?.rewardSkillChoices?.length);
          pushToast(
            'success',
            `突破 ${clearedNode?.code ?? '节点'}：${clearedNode?.title ?? ''}`,
            hasSkillLoot
              ? '正在提取敌方协议技能，选择后即切回逃亡路线图...'
              : '正在切回逃亡路线图，执行围堵转向钻缝撤离...'
          );
          scheduleTimeout(() => {
            const latest = latestStateRef.current;
            if (latest.phase !== 'showdown' || latest.players.ai.chips !== 0) return;
            if (hasSkillLoot && clearedNode?.rewardSkillChoices) {
              setPendingSkillClaim({
                title: `击溃 ${clearedNode.opponentName} · 协议技能拆解`,
                subtitle: `${clearedNode.code} ${clearedNode.title} 已突破！挑选 1 项技能（作弊槽上限 ${MAX_CHEAT_SKILLS} · 非作弊辅助槽上限 ${MAX_SUPPORT_SKILLS}，满额可替换）`,
                choices: clearedNode.rewardSkillChoices,
                clearedNodeIndex: clearedIdx,
              });
            } else {
              setEscapeProgress((prev) => markEscapeNodeCleared(prev, clearedIdx));
              setViewMode('escape-map');
            }
          }, 1150);
        }
        return;
      }

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
      if (activeEscapeNodeRef.current !== null) {
        pushToast(
          'error',
          '算力归零 · 当前节点突围受阻',
          '点击右侧「算力归零！重开」或返回逃亡路线图重新挑战'
        );
        return;
      }

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
    const tr = p2pTransportRef.current;
    const role = p2pRoleRef.current;
    if (p2pStatus === 'connected' && tr && role === 'guest') {
      const previewNext = applyAction(latestStateRef.current, action);
      const buffered = chatDraftRef.current.trim();
      const willBundle =
        buffered.length > 0 &&
        (previewNext.currentTurn === 'ai' || previewNext.phase === 'showdown');
      if (willBundle) {
        setChatDraft('');
        enqueueTask({ kind: 'human', text: buffered });
      }
      p2pSeqRef.current += 1;
      tr.send({
        type: 'ACTION_REQ',
        seq: p2pSeqRef.current,
        action,
        bundledSpeech: willBundle ? buffered : undefined,
      });
      return;
    }

    const nextState = applyAction(latestStateRef.current, action);
    setState(nextState);
    if (p2pStatus === 'connected' && tr && role === 'host') {
      pushP2pStateToGuest(nextState);
    }

    const buffered = chatDraftRef.current.trim();
    if (
      buffered.length > 0 &&
      (nextState.currentTurn === 'ai' || nextState.phase === 'showdown')
    ) {
      setChatDraft('');
      if (p2pStatus === 'connected' && tr) {
        enqueueTask({ kind: 'human', text: buffered });
        tr.send({
          type: 'CHAT_MSG',
          id: `p2p-c-${Date.now()}`,
          speaker: localP2pNameRef.current.trim() || '房主',
          text: buffered,
          msgKind: 'speech',
        });
      } else {
        pendingBundledChatRef.current = buffered;
        enqueueTask({ kind: 'human', text: buffered });
      }
    }
  };

  const executeHumanAction = (action: GameAction) => {
    if (sec00GuideActiveRef.current) {
      if (sec00IntroIndexRef.current !== null) return;
      const latest = latestStateRef.current;
      if (!isSec00ActionAllowed(latest, action)) {
        const g = getSec00Guidance(latest, { selectedHandIndex, scanMode, showRaiseTiers });
        pushToast('info', '请按当前 SEC-00 教学步骤操作', g.instruction);
        return;
      }
    }
    if (thoughtSpotlightTimerRef.current !== null) {
      window.clearTimeout(thoughtSpotlightTimerRef.current);
      thoughtSpotlightTimerRef.current = null;
    }
    setThoughtSpotlightActive(false);
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
    lastChargeStepRef.current = 0;
    playSound('charge-tick', { progress: 4 });
    holdIntervalRef.current = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - startMs) / durationMs) * 100));
      setHoldProgress(pct);
      const step = Math.floor(pct / 20);
      if (step > lastChargeStepRef.current && pct < 100) {
        lastChargeStepRef.current = step;
        playSound('charge-tick', { progress: pct });
      }
      if (pct >= 100) {
        if (holdIntervalRef.current !== null) {
          window.clearInterval(holdIntervalRef.current);
          holdIntervalRef.current = null;
        }
        lastChargeStepRef.current = -1;
        setHoldProgress(0);
        executeHumanAction({ type: 'raise', amount: halfAmt, isHalfStack: true });
      }
    }, 24);
  };

  const handleExecuteHack = (skill: HackSkillId) => {
    if (sec00GuideActiveRef.current) {
      if (sec00IntroIndexRef.current !== null) return;
      const latest = latestStateRef.current;
      const caps = getSec00Capabilities(latest);
      if (!caps.allowHack) {
        const g = getSec00Guidance(latest, { selectedHandIndex, scanMode, showRaiseTiers });
        pushToast('info', '黑客技尚未解锁', g.instruction);
        return;
      }
    }
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (getBetDiff(state, 'human') > 0) {
      pushToast('warn', '遭遇加注，请先跟注', '必须先补齐跟注差额，才能使用黑客或扫描技能');
      return;
    }
    if (state.players.human.sealedSkills.includes(skill)) {
      pushToast('error', '该黑客技能已被封印', '本局对抗中无法再次使用该篡改协议');
      return;
    }
    if (state.lockedHumanHackSkill === skill) {
      pushToast('error', '已被「冷频封锁」冻结', '对端审计协议在本手冻结了该基础改牌技能');
      return;
    }
    if (selectedHandIndex === null) {
      pushToast('warn', '请先点击一张己方明牌', '黑客技能仅可对当前手上的公开明牌使用');
      return;
    }
    const action: GameAction = { type: 'hack', handIndex: selectedHandIndex, skill };
    if (sec00GuideActiveRef.current && !isSec00ActionAllowed(state, action)) {
      const g = getSec00Guidance(state, { selectedHandIndex, scanMode, showRaiseTiers });
      pushToast('info', '请按 SEC-00 教学指定动作注入', g.instruction);
      return;
    }
    if (!isActionLegal(state, action)) {
      const hc = state.players.human.hand[selectedHandIndex];
      const cost = getEffectiveHackCost(state, 'human', skill);
      if (state.players.human.chips < cost) {
        pushToast('warn', `算力不足（需预支 ${cost}）`);
      } else if (!hc || hc.visibility !== 'open') {
        pushToast('warn', '仅可对己方公开明牌使用篡改技能');
      } else if (hc.card.isBlank) {
        pushToast('warn', '该牌已被抹除为废牌，无法再次篡改');
      } else {
        pushToast(
          'warn',
          skill === 'plus-one' || skill === 'crown-ace' ? '当前已是最大点数 A' : '当前已是最小点数 2'
        );
      }
      return;
    }
    setState((prev) => applyAction(prev, action));
    pushToast('info', '黑客协议注入成功', '改变结果仅己方可见，且可继续交换或行动');
    if (sec00GuideActiveRef.current) {
      enqueueTask({
        kind: 'opponent',
        speaker: state.players.ai.name,
        msgKind: 'thought',
        text: '（周围都是高算力猎手……只有对面这个无所事事的底层黑客毫不起眼。没时间挑了……只能选择这个人了。）',
      });
    }
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
    if (sec00GuideActiveRef.current) {
      if (sec00IntroIndexRef.current !== null) return;
      const latest = latestStateRef.current;
      if (!getSec00Capabilities(latest).allowScan) return;
    }
    if (!scanMode || state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (getBetDiff(state, 'human') > 0 && state.phase !== 'river') {
      setScanMode(false);
      pushToast('warn', '遭遇加注，请先跟注', '公共牌未全明前必须先补齐跟注差额，才能进行扫描');
      return;
    }
    const action: GameAction = { type: 'scan', targetKind, targetIndex };
    if (sec00GuideActiveRef.current && !isSec00ActionAllowed(state, action)) {
      const g = getSec00Guidance(state, { selectedHandIndex, scanMode, showRaiseTiers });
      pushToast('info', '请扫描指定目标牌', g.instruction);
      return;
    }
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
    if (isP2pConnected) {
      if (isP2pGuest) {
        const nextReady = reduceNextHandReadyState(p2pNextHandReadyRef.current, 'guest', true);
        setP2pNextHandReady(nextReady);
        p2pTransportRef.current?.send({ type: 'READY_NEXT_HAND', ready: true });
        pushToast('info', '已确认准备下一局', '等待房主确认后同步发牌');
        return;
      }
      if (isP2pHost) {
        const nextReady = reduceNextHandReadyState(p2pNextHandReadyRef.current, 'host', true);
        const summary = getNextHandReadySummary(nextReady);
        if (!summary.bothReady) {
          setP2pNextHandReady(nextReady);
          p2pTransportRef.current?.send({
            type: 'NEXT_HAND_READY_SYNC',
            hostReady: nextReady.hostReady,
            guestReady: nextReady.guestReady,
          });
          pushToast('info', '已准备下一局 (1/2)', '等待好友点击准备后同步发牌');
          return;
        }
        const resetReady = createNextHandReadyState();
        setP2pNextHandReady(resetReady);
        setSelectedHandIndex(null);
        setShowRaiseTiers(false);
        setActiveExpression('calm');
        const next = startNextHand(latestStateRef.current);
        setState(next);
        pushP2pStateToGuest(next);
        p2pTransportRef.current?.send({
          type: 'NEXT_HAND_READY_SYNC',
          hostReady: false,
          guestReady: false,
        });
        return;
      }
    }
    setSelectedHandIndex(null);
    setShowRaiseTiers(false);
    setActiveExpression('calm');
    const next = startNextHand(latestStateRef.current);
    setState(next);
  };

  const performFullReset = (
    customConfig?: GameConfig,
    nextCharacter?: ContractCharacter,
    overrideAcquiredSkills?: string[],
    overrideChips?: Record<PlayerId, number>,
    overrideOpponentName?: string
  ) => {
    if (p2pStatus === 'connected' && p2pRoleRef.current === 'guest') {
      p2pTransportRef.current?.send({ type: 'REMATCH_REQ' });
      setActiveModal({ type: 'none' });
      pushToast('info', '已向房主申请重置牌桌');
      return latestStateRef.current;
    }
    if (sec00GuideActiveRef.current && !customConfig && !nextCharacter && !overrideChips) {
      startSec00Tutorial(false);
      return latestStateRef.current;
    }
    const activeEscNode =
      activeEscapeNodeRef.current !== null && !nextCharacter
        ? ESCAPE_ROUTE_NODES[activeEscapeNodeRef.current] ?? null
        : null;
    const targetChar = nextCharacter ?? character;
    const resolvedOpponentName = isP2pConnected
      ? remotePeerRef.current?.name ?? '联机好友'
      : overrideOpponentName ?? activeEscNode?.opponentName ?? targetChar.name;
    const resolvedChips =
      overrideChips ??
      (activeEscNode
        ? { human: state.config.startingChips, ai: activeEscNode.opponentChips }
        : undefined);
    const cfg = customConfig ?? state.config;
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
    queueRef.current = [];
    inFlightTaskRef.current = null;
    resetEpochRef.current += 1;
    isAnimatingRef.current = false;
    escapeClearQueuedForMatchRef.current = false;
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
    setP2pNextHandReady(createNextHandReadyState());
    lastHandledShowdownHandRef.current = 0;
    lastSoundActionIdRef.current = null;
    lastSlashedHandRef.current = null;
    pendingBundledChatRef.current = null;
    const freshState = createInitialState({
      config: cfg,
      chips: resolvedChips,
      opponentName: resolvedOpponentName,
      opponentSignatureSkill: activeEscNode?.signatureSkillId,
      aiSpecialCheatSkill: activeEscNode?.specialCheatSkillId,
      playerCheatSkills: isP2pConnected
        ? DEFAULT_CHEAT_SKILLS
        : activeEscNode
          ? escapeProgressRef.current.equippedCheatSkills
          : (latestCampaignRef.current.acquiredCheatSkills ?? DEFAULT_CHEAT_SKILLS),
      playerAcquiredSkills: isP2pConnected
        ? []
        : overrideAcquiredSkills ??
          (activeEscNode
            ? escapeProgressRef.current.equippedSkills
            : latestCampaignRef.current.acquiredSkills),
    });
    setState(freshState);
    if (isP2pHost) {
      pushP2pStateToGuest(freshState);
      p2pTransportRef.current?.send({
        type: 'NEXT_HAND_READY_SYNC',
        hostReady: false,
        guestReady: false,
      });
    }
    const activeStoryChar = activeEscNode ? getStoryCharacterByEscapeNode(activeEscNode.index) : null;
    if (activeEscNode && activeStoryChar && isMuteGarbledCharacter(activeStoryChar.id)) {
      setMessages([
        {
          id: `reset-${Date.now()}-1`,
          sender: 'opponent',
          speaker: resolvedOpponentName,
          text: formatMuteGarbledText(`已接入 ${activeEscNode.code}，准备猎杀。`),
          msgKind: 'speech',
          crushed: false,
        },
        {
          id: `reset-${Date.now()}-2`,
          sender: 'opponent',
          speaker: resolvedOpponentName,
          text: activeStoryChar.quote,
          msgKind: 'thought',
          crushed: false,
        },
      ]);
    } else {
      setMessages([
        {
          id: `reset-${Date.now()}`,
          sender: 'opponent',
          speaker: resolvedOpponentName,
          text: activeEscNode
            ? activeStoryChar?.quote
              ? `已接入 ${activeEscNode.code} · ${activeEscNode.title}。${activeStoryChar.quote}`
              : `已接入 ${activeEscNode.code} · ${activeEscNode.title}。拦截目标 ${activeEscNode.opponentName} 已就位，击穿其算力即可向下一节点突围。`
            : '黑域连接重构完毕。新的一轮追捕博弈开始了，请亮出你的牌序。',
          crushed: false,
        },
      ]);
    }
    return freshState;
  };

  const startSec00Tutorial = useCallback((showIntro = true) => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
    queueRef.current = [];
    inFlightTaskRef.current = null;
    resetEpochRef.current += 1;
    isAnimatingRef.current = false;
    escapeClearQueuedForMatchRef.current = false;
    setQueuedCount(0);
    setFloatingBubble(null);
    setCrushingActive(false);
    setHistoryOffset(0);
    setSelectedHandIndex(null);
    setDraggedHandIndex(null);
    setShowRaiseTiers(false);
    setScanMode(false);
    setPendingSkillTargetId(null);
    setRoundLossFlicker(false);
    setAiRoundLossFlicker(false);
    setActiveExpression('calm');
    setActiveModal({ type: 'none' });
    setActiveEscapeNodeIndex(0);
    activeEscapeNodeRef.current = 0;
    setSec00GuideActive(true);
    sec00GuideActiveRef.current = true;
    setSec00IntroIndex(showIntro ? 0 : null);
    sec00IntroIndexRef.current = showIntro ? 0 : null;
    if (thoughtSpotlightTimerRef.current !== null) {
      window.clearTimeout(thoughtSpotlightTimerRef.current);
      thoughtSpotlightTimerRef.current = null;
    }
    setThoughtSpotlightActive(false);
    lastHandledShowdownHandRef.current = 0;
    lastSoundActionIdRef.current = null;
    setViewMode('arena');
    setState(createSec00TutorialState());
    setMessages([]);
  }, []);

  const handleEnterEscapeNode = (nodeIndex: number) => {
    const latestEsc = completeEscapeTransition(escapeProgressRef.current);
    if (!canEnterEscapeNode(latestEsc, nodeIndex)) return;
    const node = ESCAPE_ROUTE_NODES[nodeIndex];
    if (!node || node.isExit) return;

    if (isP2pSessionActive) {
      disconnectP2p();
    }
    setEscapeProgress(latestEsc);
    escapeProgressRef.current = latestEsc;
    setActiveEscapeNodeIndex(nodeIndex);
    activeEscapeNodeRef.current = nodeIndex;
    if (nodeIndex === 0 && !latestEsc.clearedIndices.includes(0)) {
      startSec00Tutorial(true);
      return;
    }
    setSec00GuideActive(false);
    sec00GuideActiveRef.current = false;
    setSec00IntroIndex(null);
    setViewMode('arena');
    performFullReset(
      { ...state.config, aiDifficulty: node.difficulty },
      undefined,
      undefined,
      { human: state.config.startingChips, ai: node.opponentChips },
      node.opponentName
    );
    pushToast('info', `进入 ${node.code} · ${node.title}`, `对手：${node.opponentName}（算力 ${node.opponentChips}）`);
  };

  const handleCompleteEscapeTransition = useCallback(() => {
    setEscapeProgress((prev) => completeEscapeTransition(prev));
  }, []);

  const handleRevealEscapeWall = useCallback((nodeIndex: number) => {
    setEscapeProgress((prev) => markEscapeWallRevealed(prev, nodeIndex));
  }, []);

  const handleResetEscapeRoute = () => {
    const fresh = resetEscapeProgress();
    setEscapeProgress(fresh);
    escapeProgressRef.current = fresh;
    startSec00Tutorial(true);
    pushToast('info', '已重置黑域逃亡路线', '重新从 SEC-00 公共暗区野桌单轮教学开始');
  };

  const handleRetreatToEscapeMap = () => {
    if (activeEscapeNodeRef.current !== null && state.players.ai.chips === 0) {
      const idx = activeEscapeNodeRef.current;
      setEscapeProgress((prev) => {
        if (prev.clearedIndices.includes(idx)) return prev;
        return markEscapeNodeCleared(prev, idx);
      });
    }
    setViewMode('escape-map');
  };

  const appendCmdLog = useCallback((tone: DebugCmdLogEntry['tone'], text: string) => {
    setCmdLogs((prev) =>
      [...prev, { id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tone, text }].slice(
        -80
      )
    );
  }, []);

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9' || (e.code === 'Backquote' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        const isTypingElsewhere =
          (tag === 'input' || tag === 'textarea' || target?.isContentEditable) &&
          target?.id !== 'cmd-terminal-input';
        if (isTypingElsewhere) return;
        e.preventDefault();
        setActiveModal((prev) => (prev.type === 'cmd' ? { type: 'none' } : { type: 'cmd' }));
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const handleExecuteDebugCmd = (rawCommand: string) => {
    appendCmdLog('cmd', `> ${rawCommand}`);
    const parsed = parseDebugCommand(rawCommand);
    if (!parsed.ok) {
      appendCmdLog('error', `[ERR] ${parsed.error}`);
      return;
    }

    switch (parsed.cmd) {
      case 'help': {
        for (const item of DEBUG_CHEAT_COMMANDS) {
          appendCmdLog('info', `  ${item.syntax.padEnd(32, ' ')} — ${item.desc}`);
        }
        return;
      }
      case 'clear': {
        setCmdLogs([]);
        return;
      }
      case 'win': {
        if (viewMode === 'escape-map') {
          const base = completeEscapeTransition(escapeProgressRef.current);
          if (base.escapedReality || base.highestUnlockedIndex >= 5) {
            appendCmdLog('info', '[INFO] 当前已通关全部节点并抵达现实出口');
            return;
          }
          const idxToClear = Math.min(4, base.highestUnlockedIndex);
          const nextEsc = markEscapeNodeCleared(base, idxToClear);
          setEscapeProgress(nextEsc);
          setActiveModal({ type: 'none' });
          appendCmdLog('success', `[OK] 直接突破 ${ESCAPE_ROUTE_NODES[idxToClear]?.code}，播放钻缝动画`);
          return;
        }
        const curr = latestStateRef.current;
        if (curr.phase === 'showdown' && curr.players.ai.chips === 0) {
          setActiveModal({ type: 'none' });
          handleRetreatToEscapeMap();
          appendCmdLog('success', '[OK] 已切回逃亡路线图');
          return;
        }
        const wonState = applyDebugWinHand(curr);
        lastHandledShowdownHandRef.current = 0;
        setSec00GuideActive(false);
        sec00GuideActiveRef.current = false;
        setSec00IntroIndex(null);
        setState(wonState);
        setActiveModal({ type: 'none' });
        appendCmdLog('success', '[OK] 已执行 win：对手算力归零，触发过关结算');
        return;
      }
      case 'lose': {
        const lostState = applyDebugLoseHand(latestStateRef.current);
        lastHandledShowdownHandRef.current = 0;
        setState(lostState);
        setActiveModal({ type: 'none' });
        appendCmdLog('success', '[OK] 已执行 lose：己方算力清 0');
        return;
      }
      case 'next': {
        const base = completeEscapeTransition(escapeProgressRef.current);
        if (base.escapedReality) {
          appendCmdLog('info', '[INFO] 已抵达现实出口，可执行 reset 重新开始');
          return;
        }
        const idxToClear = Math.min(4, base.highestUnlockedIndex);
        const cleared = markEscapeNodeCleared(base, idxToClear);
        const completed = completeEscapeTransition(cleared);
        setEscapeProgress(completed);
        escapeProgressRef.current = completed;
        if (completed.escapedReality) {
          setViewMode('escape-map');
          setActiveModal({ type: 'none' });
          appendCmdLog('success', '[OK] 已穿过零号闸门抵达现实出口');
          return;
        }
        const nextIdx = Math.min(4, completed.currentNodeIndex);
        setActiveEscapeNodeIndex(nextIdx);
        activeEscapeNodeRef.current = nextIdx;
        const node = ESCAPE_ROUTE_NODES[nextIdx];
        setViewMode('arena');
        setActiveModal({ type: 'none' });
        performFullReset(
          { ...state.config, aiDifficulty: node.difficulty },
          undefined,
          undefined,
          { human: state.config.startingChips, ai: node.opponentChips },
          node.opponentName
        );
        appendCmdLog('success', `[OK] 已推进并进入 ${node.code} · ${node.title}`);
        return;
      }
      case 'goto': {
        const idx = parsed.nodeIndex;
        const node = ESCAPE_ROUTE_NODES[idx];
        const base = completeEscapeTransition(escapeProgressRef.current);
        const clearedRange = Array.from({ length: idx }, (_, i) => i);
        const jumped: EscapeMapProgress = {
          currentNodeIndex: idx,
          highestUnlockedIndex: Math.max(base.highestUnlockedIndex, idx),
          clearedIndices: Array.from(new Set([...base.clearedIndices, ...clearedRange])).sort(
            (a, b) => a - b
          ),
          revealedWallIndices: base.revealedWallIndices,
          equippedCheatSkills: base.equippedCheatSkills,
          equippedSkills: base.equippedSkills,
          pendingTransition: null,
          escapedReality: false,
        };
        setEscapeProgress(jumped);
        escapeProgressRef.current = jumped;
        setActiveEscapeNodeIndex(idx);
        activeEscapeNodeRef.current = idx;
        setActiveModal({ type: 'none' });
        if (idx === 0) {
          startSec00Tutorial(true);
        } else {
          setSec00GuideActive(false);
          sec00GuideActiveRef.current = false;
          setSec00IntroIndex(null);
          setViewMode('arena');
          performFullReset(
            { ...state.config, aiDifficulty: node.difficulty },
            undefined,
            undefined,
            { human: state.config.startingChips, ai: node.opponentChips },
            node.opponentName
          );
        }
        appendCmdLog('success', `[OK] 已传送至 ${node.code} · ${node.title}`);
        return;
      }
      case 'chips': {
        setState((prev) => applyDebugChipsOverride(prev, parsed.target, parsed.amount));
        appendCmdLog(
          'success',
          `[OK] 已将 ${parsed.target === 'human' ? '己方' : '对手'} 算力设为 ${parsed.amount}`
        );
        return;
      }
      case 'hand': {
        setState((prev) => applyDebugPresetHand(prev, parsed.preset));
        appendCmdLog('success', `[OK] 已发入调试牌型：${parsed.preset}`);
        return;
      }
      case 'reveal': {
        const nextVal = !latestStateRef.current.config.revealOpponentHidden;
        setState((prev) => ({
          ...prev,
          config: { ...prev.config, revealOpponentHidden: nextVal },
        }));
        appendCmdLog('success', `[OK] 透视暗牌模式：${nextVal ? '开启' : '关闭'}`);
        return;
      }
      case 'skill': {
        const sk = getSkillById(parsed.skillId);
        if (!sk) {
          const validIds = SKILL_POOL_REGISTRY.map((s) => s.id).join(', ');
          appendCmdLog('error', `[ERR] 未找到技能 "${parsed.skillId}"。可用 ID: ${validIds}`);
          return;
        }
        const currCheat =
          activeEscapeNodeRef.current !== null
            ? (escapeProgressRef.current.equippedCheatSkills ?? DEFAULT_CHEAT_SKILLS)
            : (latestCampaignRef.current.acquiredCheatSkills ?? DEFAULT_CHEAT_SKILLS);
        const currSupport =
          activeEscapeNodeRef.current !== null
            ? escapeProgressRef.current.equippedSkills
            : latestCampaignRef.current.acquiredSkills;
        const skGroup = getSkillGroup(sk.id);
        const targetPool = skGroup === 'cheat' ? currCheat : currSupport;
        if (targetPool.includes(sk.id)) {
          appendCmdLog('info', `[INFO] 已装备${skGroup === 'cheat' ? '作弊' : '辅助'}技能「${sk.name}」(${sk.id})`);
          return;
        }
        if (needsGroupedSkillReplacement(currCheat, currSupport, sk.id)) {
          const cap = skGroup === 'cheat' ? MAX_CHEAT_SKILLS : MAX_SUPPORT_SKILLS;
          const label = skGroup === 'cheat' ? '作弊技能槽' : '非作弊辅助槽';
          setActiveModal({ type: 'none' });
          setPendingSkillClaim({
            title: `调试装配「${sk.name}」`,
            subtitle: `当前${label}已达 ${cap}/${cap} 上限，请选择被替换的旧槽位`,
            choices: [sk.id],
          });
          appendCmdLog('info', `[OK] ${label}已满 ${cap}/${cap}，已弹出「${sk.name}」替换选择窗`);
          return;
        }
        const grouped = equipGroupedSkill(currCheat, currSupport, sk.id);
        if (activeEscapeNodeRef.current !== null) {
          setEscapeProgress((prev) => claimEscapeNodeSkill(prev, sk.id));
        } else {
          setCampaign((prev) => ({
            ...prev,
            acquiredCheatSkills: grouped.cheat,
            acquiredSkills: grouped.support,
          }));
        }
        setState((prev) => ({
          ...prev,
          playerCheatSkills: grouped.cheat,
          playerAcquiredSkills: grouped.support,
        }));
        appendCmdLog(
          'success',
          `[OK] 已装备${skGroup === 'cheat' ? '作弊' : '辅助'}技能「${sk.name}」（作弊 ${grouped.cheat.length}/3 · 辅助 ${grouped.support.length}/3）`
        );
        return;
      }
      case 'clearskills': {
        setEscapeProgress((prev) => ({
          ...prev,
          equippedCheatSkills: [...DEFAULT_CHEAT_SKILLS],
          equippedSkills: [],
        }));
        setCampaign((prev) => ({
          ...prev,
          acquiredCheatSkills: [...DEFAULT_CHEAT_SKILLS],
          acquiredSkills: [],
        }));
        setState((prev) => ({
          ...prev,
          playerCheatSkills: [...DEFAULT_CHEAT_SKILLS],
          playerAcquiredSkills: [],
        }));
        appendCmdLog('success', '[OK] 已清空辅助技能槽并将作弊技能重置为初始 3 槽（+1 / -1 / 反色）');
        return;
      }
      case 'reset': {
        handleResetEscapeRoute();
        setActiveModal({ type: 'none' });
        appendCmdLog('success', '[OK] 已重置逃亡路线、暗墙显形与牌桌状态');
        return;
      }
      case 'resetprofile': {
        const freshCamp = createInitialCampaign(campaign.playerCodename);
        setCampaign(freshCamp);
        saveCampaignState(freshCamp);
        const freshEsc = resetEscapeProgress();
        setEscapeProgress(freshEsc);
        escapeProgressRef.current = freshEsc;
        startSec00Tutorial(true);
        setActiveModal({ type: 'none' });
        pushToast('success', '玩家档案已彻底重置', '已清空逃亡路线、暗墙记录、实体技能与教程进度，回到 SEC-00 独白教学');
        appendCmdLog('success', '[OK] 已彻底重置玩家全部本地档案（回到初始 SEC-00）');
        return;
      }
    }
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
      setSec00GuideActive(false);
      sec00GuideActiveRef.current = false;
      setSec00IntroIndex(null);
      setActiveEscapeNodeIndex(null);
      setViewMode('arena');
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

    if (isP2pConnected && p2pTransportRef.current) {
      p2pTransportRef.current.send({
        type: 'CHAT_MSG',
        id: `p2p-c-${Date.now()}`,
        speaker: localP2pNameRef.current.trim() || '玩家',
        text: trimmed,
        msgKind: 'speech',
      });
      return;
    }

    const res = await requestOpponentChatReply({
      character: effectiveCharacter,
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
    enqueueOpponentSegments(latestStateRef.current.players.ai.name, res.segments);
  };

  const handleReplayBubble = () => {
    const sample =
      effectiveCharacter.voice?.samples?.[0] ??
      effectiveCharacter.quote ??
      '数据流正常，准备下一手博弈。';
    if (isMuteGarbledCharacter(effectiveCharacter.id)) {
      enqueueTask({ kind: 'opponent', speaker: state.players.ai.name, msgKind: 'speech', text: sample });
      enqueueTask({ kind: 'opponent', speaker: state.players.ai.name, msgKind: 'thought', text: sample });
      return;
    }
    enqueueTask({ kind: 'opponent', speaker: state.players.ai.name, text: sample });
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

  // Damage & Defeat VFX State (Strictly isolated between Opponent and Player!)
  const visibleAiChips = getVisiblePlayerChips(state, 'ai', 'human');
  const isAiBankrupt =
    vfxTestMode === 'ai-bankrupt' || (isShowdown && ai.chips === 0);
  const isHumanBankrupt =
    vfxTestMode === 'human-bankrupt' || (isShowdown && human.chips === 0);
  const isAiLowCompute =
    !isAiBankrupt &&
    (vfxTestMode === 'ai-low' ||
      (visibleAiChips > 0 && visibleAiChips <= state.config.startingChips * 0.3));
  const isHumanLowCompute =
    !isHumanBankrupt &&
    (vfxTestMode === 'human-low' ||
      (human.chips > 0 && human.chips <= state.config.startingChips * 0.3));

  const isSec00Echo0 = activeEscapeNode?.index === 0 && !isP2pConnected;
  const isSec01Boss = activeEscapeNode?.index === 1 && !isP2pConnected;
  const isSec02Boss = activeEscapeNode?.index === 2 && !isP2pConnected;

  // 虚拟空间对战中，追捕者采用魔女化虚拟实体形象（SEC-00 使用 ECHO-0，SEC-01 使用凌翡，SEC-02 使用芙兰）
  const portraitSrc =
    isP2pConnected && remotePeer?.portrait
      ? remotePeer.portrait
      : isSec00Echo0
        ? resolveEcho0Sprite(activeExpression)
        : isSec01Boss
          ? resolveSec01Sprite(activeExpression)
          : isSec02Boss
            ? resolveSec02Sprite(activeExpression)
            : resolveVirtualEntityPortrait(effectiveCharacter, activeExpression);
  const accentColor =
    isP2pConnected && remotePeer?.accentColor
      ? remotePeer.accentColor
      : isSec00Echo0
        ? '#00F0FF'
        : isSec01Boss
          ? '#FFB020'
          : isSec02Boss
            ? '#38BDF8'
            : llmConfig.overloadPersona
              ? '#FF4757'
              : effectiveCharacter.color || '#FF2E88';

  const humanWinIds = new Set(state.result?.humanEval?.bestFive.map((c) => c.id) ?? []);
  const aiWinIds = new Set(state.result?.aiEval?.bestFive.map((c) => c.id) ?? []);
  const boardWinIds = new Set(
    state.result?.winner === 'human'
      ? (state.result.humanEval?.bestFive.map((c) => c.id) ?? [])
      : state.result?.winner === 'ai'
        ? (state.result.aiEval?.bestFive.map((c) => c.id) ?? [])
        : []
  );

  const p2pReadySummary = getNextHandReadySummary(p2pNextHandReady);
  const localP2pReady =
    p2pRole === 'host'
      ? p2pReadySummary.hostReady
      : p2pRole === 'guest'
        ? p2pReadySummary.guestReady
        : false;
  const latestOpponentLine = useMemo(() => {
    if (floatingBubble) {
      return { speaker: floatingBubble.speaker, text: floatingBubble.text, kind: floatingBubble.msgKind };
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender === 'opponent') {
        return { speaker: messages[i].speaker, text: messages[i].text, kind: messages[i].msgKind ?? 'speech' };
      }
    }
    return null;
  }, [floatingBubble, messages]);

  const tutorialCaps = useMemo(
    () =>
      sec00GuideActive
        ? getSec00Capabilities(state)
        : { allowHack: true, allowScan: true, allowRaise: true },
    [sec00GuideActive, state]
  );

  const sec00Guidance = useMemo(
    () =>
      sec00GuideActive
        ? getSec00Guidance(state, { selectedHandIndex, scanMode, showRaiseTiers })
        : null,
    [sec00GuideActive, state, selectedHandIndex, scanMode, showRaiseTiers]
  );

  // Highlight guided tutorial targets cleanly without leaving stale classes
  useEffect(() => {
    const ids =
      sec00GuideActive && sec00IntroIndex === null && sec00Guidance
        ? sec00Guidance.focusIds
        : [];
    const elements: HTMLElement[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('is-tutorial-focus');
        elements.push(el);
      }
    }
    return () => {
      for (const el of elements) {
        el.classList.remove('is-tutorial-focus');
      }
    };
  }, [
    sec00GuideActive,
    sec00IntroIndex,
    sec00Guidance,
    showRaiseTiers,
    scanMode,
    selectedHandIndex,
    state.phase,
    state.currentTurn,
  ]);

  const hasTopGuideBar = sec00GuideActive;

  const spotlightPlan = useMemo(
    () =>
      resolveTutorialSpotlightPlan({
        viewMode,
        hasModalOpen: activeModal.type !== 'none',
        hasPendingSkillClaim: pendingSkillClaim !== null,
        sec00GuideActive,
        sec00IntroIndex,
        sec00Guidance,
        selectedHandIndex,
        scanMode,
        showRaiseTiers,
        thoughtSpotlightActive,
      }),
    [
      viewMode,
      activeModal.type,
      pendingSkillClaim,
      sec00GuideActive,
      sec00IntroIndex,
      sec00Guidance,
      selectedHandIndex,
      scanMode,
      showRaiseTiers,
      thoughtSpotlightActive,
    ]
  );

  return (
    <div
      className={`lc-shell ${hasTopGuideBar ? 'has-tutorial-bar' : ''} ${
        viewMode === 'escape-map' ? 'is-escape-map-view' : ''
      }`}
    >
      <CyberBackdrop
        situation={isHumanBankrupt ? 'breach' : isHumanLowCompute ? 'overclock' : 'recon'}
        pot={state.pot}
        playerLowCompute={isHumanLowCompute}
        playerBankrupt={isHumanBankrupt}
      />

      {viewMode === 'escape-map' ? (
        <Suspense fallback={null}>
          <EscapeRouteMapView
            progress={escapeProgress}
            onEnterNode={handleEnterEscapeNode}
            onCompleteTransition={handleCompleteEscapeTransition}
            onRevealWall={handleRevealEscapeWall}
            onReturnToArena={() => setViewMode('arena')}
            onResetRoute={handleResetEscapeRoute}
            onOpenCmd={() => setActiveModal({ type: 'cmd' })}
          />
        </Suspense>
      ) : (
        <>
          {sec00GuideActive && sec00Guidance && (
            <Sec00TutorialOverlay
              introStepIndex={sec00IntroIndex}
              guidance={sec00Guidance}
              onSkipIntro={() => {
                setSec00IntroIndex(null);
                setMobileChatOpen(false);
              }}
              onOpenMobileChat={() => setMobileChatOpen(true)}
              onRetrySec00={() => startSec00Tutorial(true)}
              onDismissGuide={() => {
                setSec00GuideActive(false);
                sec00GuideActiveRef.current = false;
                setSec00IntroIndex(null);
                pushToast('info', '已关闭 SEC-00 步进引导', '你可自由按常规规则继续完成本局');
              }}
            />
          )}

          {/* Centered & Aligned 3x3 Tactical Stage */}
          <main className="lc-stage-grid" aria-label="牌桌主视区">
        {/* COL 1, ROW 1-2: Vertical Compute Pool Bar */}
        <aside id="lc-pool-slot" className="lc-pool-slot" aria-label="算力池计量栏">
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
            id="hud-btn-escape-map"
            type="button"
            className="lc-stack-btn"
            onClick={() => setViewMode('escape-map')}
            aria-label="切换至黑域逃亡路线关卡图"
          >
            <span className="lc-btn-inline">
              <PixelNodesIcon size={15} />
              路线图
            </span>
            <span className="lc-stack-sub">
              {activeEscapeNode
                ? `${activeEscapeNode.code} · ${escapeProgress.clearedIndices.length}/5`
                : `进度 ${escapeProgress.clearedIndices.length}/5`}
            </span>
          </button>

          <button
            id="hud-btn-switch-char"
            type="button"
            className="lc-stack-btn pink"
            onClick={() => {
              if (isP2pConnected) {
                setActiveModal({ type: 'p2p' });
              } else {
                void handleQuickSwitchOpponent();
              }
            }}
          >
            <span className="lc-btn-inline">
              <PixelSwitchUserIcon size={15} />
              {isP2pConnected ? '联机大厅' : '换人'}
            </span>
            <span className="lc-stack-sub">
              {isP2pConnected ? '管理连接' : '切换对手'}
            </span>
          </button>
        </div>

        {/* COL 2, ROW 1: Enlarged Opponent Window + Layered Vertical Data Streams + Docked 3 Cards */}
        <section
          id="lc-opponent-zone"
          className={`lc-hud-box lc-opponent-zone ${isAiLowCompute ? 'is-low-compute' : ''} ${
            isAiBankrupt ? 'is-bankrupt' : ''
          }`}
          style={{ '--char-accent': activeEscapeNode?.accentColor ?? accentColor } as CSSProperties}
          aria-label="对手状态与手牌区"
        >
          <header className="lc-opp-topbar">
            <div className="lc-opp-name">
              <span className="lc-opp-dot" aria-hidden="true" />
              <span>
                {isP2pConnected && remotePeer
                  ? `${remotePeer.name} · ${remotePeer.title}`
                  : activeEscapeNode
                    ? `${activeEscapeNode.code} · ${activeEscapeNode.title} · ${activeEscapeNode.opponentName}`
                    : `${character.name} · ${dossier.identityTitle}`}
              </span>
            </div>
            <div className="lc-opp-topbar-right">
              <span className="lc-opp-codename">
                {p2pStatus === 'connecting' || p2pStatus === 'gathering'
                  ? 'P2P 重连/握手中...'
                  : isP2pConnected
                    ? `P2P ${p2pRole === 'host' ? '房主' : '客机'} · ${p2pLatency ?? '--'}ms`
                    : activeEscapeNode
                      ? `黑域协议：替壳者 · ${escapeProgress.clearedIndices.length}/5`
                      : isAiThinking
                      ? 'THINKING...'
                      : `${EXPRESSION_META[activeExpression].label} · ${
                          effectiveAiDifficulty === 'master'
                            ? '大师'
                            : effectiveAiDifficulty === 'standard'
                              ? '标准'
                              : '新兵'
                        } · ${PLAY_STYLE_META[effectiveStrategy.playStyle].label}/${
                          CHEAT_PROFILE_META[effectiveStrategy.cheatProfile].label
                        }`}
              </span>
              <button
                id="hud-btn-open-cmd"
                type="button"
                className="lc-cmd-chip-btn"
                onClick={() => setActiveModal({ type: 'cmd' })}
                title="打开调试控制台 (快捷键 ~ 或 F9)"
                aria-label="打开调试控制台 CMD"
              >
                &gt;_ CMD
              </button>
              <button
                id="hud-btn-mobile-chat"
                type="button"
                className="lc-mobile-chat-btn"
                onClick={() => {
                  setMobileChatOpen(true);
                  setUnreadMobileChat(0);
                }}
                aria-label="打开手机端通讯抽屉"
              >
                <PixelChatIcon size={12} />
                通讯
                {unreadMobileChat > 0 && (
                  <span className="lc-mobile-unread-dot">{unreadMobileChat}</span>
                )}
              </button>
            </div>
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

            {/* Layer 2 (z:2): Character Portrait Cutout + V-Sync-Off Horizontal Tear Slices */}
            <img
              src={portraitSrc}
              alt={`${isSec00Echo0 ? '匿名终端 [UNKNOWN_0x00]' : effectiveCharacter.name}半身立绘`}
              className={`lc-opp-portrait-img ${
                isSec00Echo0 && !isShowdown ? 'is-echo0-disguised' : ''
              } ${isSec00Echo0 ? 'is-echo0-framing' : ''} ${
                isSec01Boss ? 'is-sec01-framing' : ''
              } ${isSec02Boss ? 'is-sec02-framing' : ''}`}
              width={550}
              height={420}
            />
            {isAiBankrupt &&
              PORTRAIT_TEAR_SLICES.map((s) => (
                <img
                  key={s.cls}
                  src={portraitSrc}
                  alt=""
                  aria-hidden="true"
                  className={`lc-opp-portrait-img lc-opp-tear-slice ${s.cls} ${
                    isSec00Echo0 ? 'is-echo0-framing' : ''
                  } ${isSec01Boss ? 'is-sec01-framing' : ''} ${
                    isSec02Boss ? 'is-sec02-framing' : ''
                  }`}
                  style={{ clipPath: `inset(${s.top}% 0 ${s.bottom}% 0)` }}
                  width={550}
                  height={420}
                />
              ))}

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

            {/* Damage Effect 1B: Opponent Single-Round Defeat Irregular Mosaic Hit */}
            {aiRoundLossFlicker && (
              <div className="lc-opp-mosaic-hit" aria-hidden="true">
                {MOSAIC_FLICKER_SHARDS.slice(0, 36).map((sh, i) => (
                  <span
                    key={i}
                    className={`lc-mosaic-tile ${sh.tone}`}
                    style={{
                      left: sh.left,
                      top: sh.top,
                      width: sh.width,
                      height: sh.height,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Damage Effect 3 (Opponent Only): Opponent Bankrupt (0 Compute) Irregular Mosaic Engulfment */}
            {isAiBankrupt && (
              <>
                <div className="lc-mosaic-flood-overlay" aria-hidden="true">
                  {MOSAIC_FLOOD_SHARDS.map((sh, i) => (
                    <span
                      key={i}
                      className={`lc-mosaic-flood-cell ${sh.tone}`}
                      style={{
                        left: sh.left,
                        top: sh.top,
                        width: sh.width,
                        height: sh.height,
                        animationDelay: sh.delay,
                      }}
                    />
                  ))}
                </div>
                <div className="lc-bankrupt-banner" aria-hidden="true">
                  TARGET BROKEN // ROOT TAKEOVER
                </div>
              </>
            )}
          </div>

          <div className="lc-opp-cards-dock">
            {latestOpponentLine && (
              <button
                id="hud-btn-mobile-speech-bar"
                type="button"
                className={`lc-mobile-opp-line ${latestOpponentLine.kind === 'thought' ? 'is-thought' : ''}`}
                onClick={() => {
                  setMobileChatOpen(true);
                  setUnreadMobileChat(0);
                }}
                title="点击展开完整聊天栏"
              >
                <span className="lc-mobile-opp-speaker">{latestOpponentLine.speaker}：</span>
                <span className="lc-mobile-opp-text">{latestOpponentLine.text}</span>
              </button>
            )}
            <div className="lc-status-strip">
              <span className="lc-micro-tag pink">
                对端：{opponentSummary.label} · {opponentSummary.detail}
              </span>
              <span className="lc-micro-tag">可用算力 {visibleAiChips}</span>
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

                const aiTamperLabel = revealAllAi
                  ? formatTamperLabel(hc.card, hc.originalCard)
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
                        ? `点击扫描 ${ai.name} 手牌 #${idx + 1}（预支 ${getEffectiveScanCost(
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
        <section id="lc-board-zone" className="lc-hud-box lc-board-zone" aria-label="公共加密节点区">
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
                slot.swappedBy === 'human' || revealAllAi
                  ? formatTamperLabel(slot.card, slot.originalCard)
                  : undefined;

              const isPeeked = isHidden && state.peekedBoardIndices.includes(slot.index);
              const isFrozen = isHidden && state.frozenBoardIndices.includes(slot.index);
              const isConfirmedTrap = isHidden && state.confirmedTrapIndices?.includes(slot.index);
              const nodeBackCode = isConfirmedTrap
                ? 'TRAP!'
                : isPeeked
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
                        ? `${ai.name}胜出`
                        : '平局分池'
                  }`
                : `等待 ${ai.name} 行动...`
              : scanMode
                ? `扫描模式激活：点击上方 ${ai.name} 的牌或换出牌验真（预支 ${state.config.scanCost}，不占回合）`
                : diff > 0
                  ? `遭遇加注：请先点击右侧「跟注 +${paid}」（不消耗行动）`
                  : draggedHandIndex !== null
                    ? `拖拽手牌 #${draggedHandIndex + 1}：松手放到任意暗牌即可互换（门票 ${swapFee}）`
                    : selectedHandIndex !== null
                      ? `已选中明牌 #${selectedHandIndex + 1}：可点击暗牌互换，或点下方黑客技能篡改`
                      : '点暗牌=翻牌 ｜ 拖拽或先点己方明牌=互换/黑客篡改'}
          </div>
        </section>

        {/* COL 2, ROW 3: Player Half-Body Background Portrait + 3 Cards + Hacker & Scan Skill Bar */}
        <section
          id="lc-player-hand-zone"
          className={`lc-hud-box lc-player-hand-zone ${isHumanLowCompute ? 'is-low-compute' : ''}`}
          style={{ '--entity-accent': activeDisguise.accentColor } as CSSProperties}
          aria-label="己方手牌序列区"
        >
          <div className="lc-player-portrait-layer" aria-hidden="true">
            <div className="lc-player-portrait-frame">
              <img
                src={activeDisguise.virtualPortrait}
                alt=""
                className={`lc-player-portrait-img ${activeDisguise.isCore ? '' : 'is-fullbody-crop'}`}
              />
            </div>
            <div className="lc-player-portrait-fade" />
          </div>

          <div className="lc-player-cards-col">
            <div className="lc-status-strip" style={{ width: '100%' }}>
              <span className="lc-micro-tag cyan">
                己方：{humanSummary.label} · {humanSummary.detail}
              </span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button
                  id="player-btn-switch-disguise"
                  type="button"
                  className={`lc-disguise-pill ${activeDisguise.isCore ? 'is-core' : 'is-decoy'}`}
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
                  aria-label={`当前出战虚拟实体：${activeDisguise.name}`}
                >
                  {activeDisguise.isCore ? '核心' : '诱饵'}：{activeDisguise.name}
                </button>
                <span className="lc-micro-tag">可用算力 {human.chips}</span>
              </div>
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
                  const tamperLabel = formatTamperLabel(hc.card, hc.originalCard);

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

              {/* Cheat Skills (3-Slot Cap, Replaceable) + Universal Scan Bar */}
              <div className="lc-hack-bar" role="group" aria-label="作弊与扫描技能栏">
                {(state.playerCheatSkills ?? DEFAULT_CHEAT_SKILLS).slice(0, MAX_CHEAT_SKILLS).map((cheatId) => {
                  const lockedByTutorial = !tutorialCaps.allowHack;
                  if (cheatId === 'parity-spoof') {
                    const sk = getSkillById('parity-spoof');
                    const cost = sk?.costHint ?? 55;
                    const usedHand = state.usedProtocolSkillThisHand;
                    const disabled =
                      lockedByTutorial ||
                      !isHumanTurn ||
                      diff > 0 ||
                      usedHand ||
                      human.chips < cost;
                    return (
                      <button
                        key={cheatId}
                        id="hack-btn-parity-spoof"
                        type="button"
                        className="lc-hack-btn"
                        disabled={disabled}
                        onClick={() => handleUseAcquiredSkill('parity-spoof')}
                        title={sk?.summary ?? '奇偶跃迁'}
                      >
                        <PixelPlusOneIcon size={12} />
                        <span>{usedHand ? '已用' : '奇偶'}</span>
                        {!lockedByTutorial && !usedHand && <span className="lc-hack-cost">{cost}</span>}
                      </button>
                    );
                  }
                  const skill = cheatId as HackSkillId;
                  const meta =
                    skill === 'plus-one'
                      ? { id: 'hack-btn-plus-one', label: '+1', icon: <PixelPlusOneIcon size={12} /> }
                      : skill === 'minus-one'
                        ? { id: 'hack-btn-minus-one', label: '-1', icon: <PixelMinusOneIcon size={12} /> }
                        : skill === 'crown-ace'
                          ? { id: 'hack-btn-crown-ace', label: '钦定A', icon: <PixelPlusOneIcon size={12} /> }
                          : skill === 'null-erase'
                            ? { id: 'hack-btn-null-erase', label: '抹除', icon: <PixelSeverIcon size={12} /> }
                            : { id: 'hack-btn-flip-suit', label: '反色', icon: <PixelFlipSuitIcon size={12} /> };
                  const cost = getEffectiveHackCost(state, 'human', skill);
                  const isSealed = human.sealedSkills.includes(skill);
                  const isColdLocked = state.lockedHumanHackSkill === skill;
                  const usedThisTurn = state.usedHackThisTurn;
                  const disabled =
                    lockedByTutorial ||
                    !isHumanTurn ||
                    diff > 0 ||
                    isSealed ||
                    isColdLocked ||
                    usedThisTurn ||
                    human.chips < cost;
                  return (
                    <button
                      key={skill}
                      id={meta.id}
                      type="button"
                      className={`lc-hack-btn ${isSealed || isColdLocked ? 'is-sealed' : ''} ${
                        isColdLocked ? 'is-cold-cut' : ''
                      } ${isColdLocked && slashBurstKey ? 'is-slash-burst' : ''}`}
                      disabled={disabled}
                      onClick={() => handleExecuteHack(skill)}
                      title={
                        lockedByTutorial
                          ? '当前教学步骤尚未解锁黑客作弊技能（按上方指引推进）'
                          : diff > 0
                            ? '遭遇加注，请先在右侧跟注后再使用技能'
                            : isSealed
                              ? '此作弊技能已被扫描抓获封印'
                              : isColdLocked
                                ? '本手已被「富兰克林之死」挥刃切断'
                                : usedThisTurn
                                  ? '作弊技能每回合限用 1 次（下回合刷新）'
                                  : `作弊技能：先选中己方明牌再点击（预支 ${cost}，每回合限 1 次）`
                      }
                    >
                      {isColdLocked && <span className="lc-skill-slash-fx" aria-hidden="true" />}
                      {meta.icon}
                      <span>
                        {lockedByTutorial
                          ? `${meta.label}`
                          : isSealed
                            ? '封印'
                            : isColdLocked
                              ? '已斩断'
                              : usedThisTurn
                                ? '已用'
                                : meta.label}
                      </span>
                      {!lockedByTutorial && !isSealed && !isColdLocked && !usedThisTurn && (
                        <span className="lc-hack-cost">{cost}</span>
                      )}
                    </button>
                  );
                })}

                <button
                  id="hack-btn-scan-toggle"
                  type="button"
                  className={`lc-hack-btn is-scan ${scanMode ? 'is-active' : ''}`}
                  disabled={
                    !tutorialCaps.allowScan ||
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
                    !tutorialCaps.allowScan
                      ? '当前教学步骤尚未解锁扫描技能（终结步骤开启）'
                      : diff > 0 && state.phase !== 'river'
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

              {state.playerAcquiredSkills.length > 0 && (
                <div className="lc-acquired-skill-bar" role="group" aria-label="非作弊辅助技能槽">
                  <span className="lc-micro-tag cyan">
                    辅助槽 {state.playerAcquiredSkills.filter((sid) => getSkillGroup(sid) === 'support').length}/{MAX_SUPPORT_SKILLS}
                  </span>
                  {state.playerAcquiredSkills.map((sid, sIdx) => {
                    const sk = getSkillById(sid);
                    if (!sk) return null;
                    if (sid === 'crown-ace' || sid === 'null-erase') {
                      const hackId = sid as HackSkillId;
                      const isSealed = human.sealedSkills.includes(hackId);
                      const isColdLocked = state.lockedHumanHackSkill === hackId;
                      const cost = getEffectiveHackCost(state, 'human', hackId);
                      const disabled =
                        !tutorialCaps.allowHack ||
                        !isHumanTurn ||
                        diff > 0 ||
                        isSealed ||
                        isColdLocked ||
                        state.usedHackThisTurn ||
                        human.chips < cost;
                      return (
                        <button
                          key={sid}
                          id={`acquired-skill-btn-${sIdx}`}
                          type="button"
                          className={`lc-acquired-skill-chip ${isSealed || isColdLocked ? 'is-sealed' : ''} ${
                            isColdLocked ? 'is-cold-cut' : ''
                          }`}
                          disabled={disabled}
                          onClick={() => handleExecuteHack(hackId)}
                          title={sk.summary}
                        >
                          {isColdLocked && <span className="lc-skill-slash-fx" aria-hidden="true" />}
                          <span>
                            {isSealed
                              ? '封印'
                              : isColdLocked
                                ? '已斩断'
                                : state.usedHackThisTurn
                                  ? '已用'
                                  : sk.name}
                          </span>
                          {!isSealed && !isColdLocked && !state.usedHackThisTurn && (
                            <span className="lc-hack-cost">{cost}</span>
                          )}
                        </button>
                      );
                    }
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
        </section>

        {mobileChatOpen && (
          <div
            className="lc-mobile-chat-backdrop"
            onClick={() => setMobileChatOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* COL 3, ROW 1-2: Top-Aligned Fixed-Size Chat Panel (Drawer on <=960px) */}
        <aside
          className={`lc-right-upper-col ${mobileChatOpen ? 'is-mobile-open' : ''}`}
          style={{ '--char-accent': accentColor } as CSSProperties}
          aria-label="右侧通讯栏"
        >
          <section
            id="lc-chat-panel"
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
                <button
                  id="chat-btn-mobile-close"
                  type="button"
                  className="lc-chat-replay-btn lc-mobile-only-close"
                  onClick={() => setMobileChatOpen(false)}
                  aria-label="收起通讯抽屉"
                >
                  收起
                </button>
              </div>
            </header>

            {floatingBubble && (
              <div
                id="lc-speech-bubble-active"
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
              className={`lc-chat-feed ${
                sec00GuideActive && sec00IntroIndex !== null ? 'has-monologue' : ''
              }`}
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

                {sec00GuideActive && sec00IntroIndex !== null && (
                  <article
                    id="sec00-monologue-card"
                    className="lc-chat-msg human is-monologue"
                    aria-label="玩家开局自言自语"
                  >
                    {(() => {
                      const step =
                        SEC00_MONOLOGUE_STEPS[sec00IntroIndex] ?? SEC00_MONOLOGUE_STEPS[0];
                      const isFirst = sec00IntroIndex <= 0;
                      const isLast = sec00IntroIndex >= SEC00_MONOLOGUE_STEPS.length - 1;
                      return (
                        <div className="lc-chat-msg-inner">
                          <div className="lc-chat-meta human">
                            <span>潜行黑客（自言自语）</span>
                            <span>{step.tag}</span>
                          </div>
                          <div className="lc-monologue-title">{step.title}</div>
                          <div className="lc-monologue-text">{step.text}</div>
                          <div className="lc-monologue-tip">{step.tip}</div>
                          <div className="lc-monologue-actions">
                            <button
                              id="sec00-intro-skip"
                              type="button"
                              className="lc-tutorial-btn"
                              onClick={() => {
                                setSec00IntroIndex(null);
                                setMobileChatOpen(false);
                              }}
                            >
                              跳过
                            </button>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                id="sec00-intro-prev"
                                type="button"
                                className="lc-tutorial-btn"
                                disabled={isFirst}
                                onClick={() =>
                                  setSec00IntroIndex((prev) =>
                                    prev !== null ? Math.max(0, prev - 1) : 0
                                  )
                                }
                              >
                                上一步
                              </button>
                              <button
                                id="sec00-intro-next"
                                type="button"
                                className="lc-tutorial-btn primary"
                                onClick={() => {
                                  if (isLast) {
                                    setSec00IntroIndex(null);
                                    setMobileChatOpen(false);
                                    enqueueTask({
                                      kind: 'human',
                                      text: '“行了，对面那点算力也就够练手。先动起来吧——”',
                                    });
                                  } else {
                                    setSec00IntroIndex((prev) =>
                                      prev !== null ? prev + 1 : 0
                                    );
                                  }
                                }}
                              >
                                {isLast ? '开始实操' : '下一步'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </article>
                )}
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
                placeholder={`向 ${ai.name} 预输入对话（执行操作后随动作一起发送，回车直发）...`}
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
        <div id="lc-right-actions" className="lc-action-stack" role="group" aria-label="右侧战术指令栏">
          {isShowdown && state.result ? (
            <>
              {human.chips > 0 && ai.chips > 0 ? (
                <button
                  id="action-btn-next-hand"
                  type="button"
                  className="lc-stack-btn"
                  disabled={isP2pConnected && localP2pReady}
                  onClick={handleNextHand}
                >
                  <span className="lc-btn-inline">
                    <PixelSyncIcon size={15} />
                    {isP2pConnected
                      ? localP2pReady
                        ? `已准备 (${p2pReadySummary.count}/2)`
                        : `准备下一局 (${p2pReadySummary.count}/2)`
                      : '下一局协议'}
                  </span>
                  <span className="lc-stack-sub">
                    {isP2pConnected && !localP2pReady && p2pReadySummary.count === 1
                      ? '好友已准备，点击同步开局'
                      : `第 #${state.handNumber + 1} 局`}
                  </span>
                </button>
              ) : activeEscapeNode && human.chips > 0 ? (
                <button
                  id="action-btn-escape-retreat"
                  type="button"
                  className="lc-stack-btn"
                  onClick={handleRetreatToEscapeMap}
                >
                  <span className="lc-btn-inline">
                    <PixelNodesIcon size={15} />
                    突围撤离
                  </span>
                  <span className="lc-stack-sub">切回逃亡路线图</span>
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
                  {state.result.reason === 'scan-caught'
                    ? `${state.result.winner === 'human' ? '我方' : ai.name}抓获篡改`
                    : state.result.reason === 'showdown' &&
                        state.result.humanEval &&
                        state.result.aiEval
                      ? `${state.result.humanEval.categoryName} vs ${state.result.aiEval.categoryName}`
                      : `${otherPlayer(state.result.winner === 'tie' ? 'human' : state.result.winner) === 'human' ? '我方' : ai.name}弃牌`}
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
                <span className="lc-stack-sub">{ai.name} 回合</span>
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
                onContextMenu={(e) => e.preventDefault()}
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
                disabled={!tutorialCaps.allowRaise || !raiseRange.allowed}
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
                  {!tutorialCaps.allowRaise
                    ? '稍后步骤解锁'
                    : raiseRange.allowed
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
        </>
      )}

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

      {/* Damage Effect 1: Single Round Defeat Irregular Mosaic Flicker Overlay */}
      {roundLossFlicker && (
        <div className="lc-mosaic-flicker-overlay" aria-hidden="true">
          {MOSAIC_FLICKER_SHARDS.map((sh, i) => (
            <span
              key={i}
              className={`lc-mosaic-tile ${sh.tone}`}
              style={{
                left: sh.left,
                top: sh.top,
                width: sh.width,
                height: sh.height,
              }}
            />
          ))}
        </div>
      )}

      {/* Damage Effect 3 (Player Only): Massive Non-Uniform Crimson Data-Stream Screen Flood */}
      {isHumanBankrupt && (
        <div className="lc-player-red-flood-overlay" aria-hidden="true">
          <div className="lc-red-flood-streams">
            {FLOOD_DATA_STREAMS.map((s, idx) => (
              <div
                key={idx}
                className="lc-red-flood-col"
                style={{
                  left: s.left,
                  fontSize: s.fontSize,
                  opacity: s.opacity,
                  letterSpacing: s.letterSpacing,
                  animationDuration: s.dur,
                  animationDelay: s.delay,
                }}
              >
                <span>{s.tokens}</span>
                <span>{s.tokens}</span>
                <span>{s.tokens}</span>
              </div>
            ))}
          </div>
          <div className="lc-player-flood-banner">
            COMPUTE DEPLETED // 红色溢出数据流淹没
          </div>
        </div>
      )}

      <TutorialSpotlightOverlay plan={spotlightPlan} mobileChatOpen={mobileChatOpen} />

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
                    if (item.keyName === 'tutorial') startSec00Tutorial(true);
                    else if (item.keyName === 'cmd') setActiveModal({ type: 'cmd' });
                    else if (item.keyName === 'p2p') setActiveModal({ type: 'p2p' });
                    else if (item.keyName === 'contracts') setActiveModal({ type: 'contracts' });
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

            {/* Sound FX Mute & Volume Control Strip */}
            <div className="lc-sound-strip">
              <div className="lc-sound-row">
                <button
                  id="settings-btn-sound-toggle"
                  type="button"
                  className={`lc-vfx-chip ${soundSettings.enabled ? 'active' : ''}`}
                  onClick={() => {
                    const next = { ...soundSettings, enabled: !soundSettings.enabled };
                    setSoundSettings(next);
                    saveSoundSettings(next);
                    if (next.enabled) {
                      unlockAudioContext();
                      playSound('ui-click');
                    }
                  }}
                >
                  {soundSettings.enabled ? '音效：开启' : '音效：已静音'}
                </button>
                <label htmlFor="settings-input-sound-volume" className="lc-sound-label">
                  音量 {Math.round(soundSettings.volume * 100)}%
                </label>
                <input
                  id="settings-input-sound-volume"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="lc-sound-slider"
                  disabled={!soundSettings.enabled}
                  value={Math.round(soundSettings.volume * 100)}
                  onChange={(e) => {
                    const next = { ...soundSettings, volume: Number(e.target.value) / 100 };
                    setSoundSettings(next);
                    saveSoundSettings(next);
                  }}
                />
                <button
                  id="settings-btn-sound-test"
                  type="button"
                  className="lc-vfx-chip"
                  disabled={!soundSettings.enabled}
                  onClick={() => {
                    unlockAudioContext();
                    playSound('skill');
                  }}
                >
                  试听
                </button>
              </div>
            </div>

            {/* Quick VFX Preview Toggles so user can inspect all damage states for both sides independently */}
            <div className="lc-vfx-strip">
              <span className="lc-menu-note">战损与危机特效即时预览（双方独立隔离）</span>
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
                  id="vfx-test-human-low"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'human-low' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'human-low' ? 'auto' : 'human-low'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'human-low' ? '关闭己方红流' : '己方低算力外流'}
                </button>
                <button
                  id="vfx-test-human-bankrupt"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'human-bankrupt' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'human-bankrupt' ? 'auto' : 'human-bankrupt'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'human-bankrupt' ? '关闭己方淹没' : '己方红流淹没'}
                </button>
                <button
                  id="vfx-test-ai-low"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'ai-low' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'ai-low' ? 'auto' : 'ai-low'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'ai-low' ? '关闭对手红流' : '对手低算力红流'}
                </button>
                <button
                  id="vfx-test-ai-bankrupt"
                  type="button"
                  className={`lc-vfx-chip ${vfxTestMode === 'ai-bankrupt' ? 'active' : ''}`}
                  onClick={() => {
                    setVfxTestMode((m) => (m === 'ai-bankrupt' ? 'auto' : 'ai-bankrupt'));
                    setActiveModal({ type: 'none' });
                  }}
                >
                  {vfxTestMode === 'ai-bankrupt' ? '恢复对手立绘' : '对手归零扭曲'}
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
        {pendingSkillClaim && (
          <SkillLootReplaceModal
            title={pendingSkillClaim.title}
            subtitle={pendingSkillClaim.subtitle}
            choices={pendingSkillClaim.choices}
            equippedCheatSkills={
              activeEscapeNodeRef.current !== null
                ? (escapeProgress.equippedCheatSkills ?? DEFAULT_CHEAT_SKILLS)
                : (campaign.acquiredCheatSkills ?? DEFAULT_CHEAT_SKILLS)
            }
            equippedSkills={
              activeEscapeNodeRef.current !== null
                ? escapeProgress.equippedSkills
                : campaign.acquiredSkills
            }
            onConfirm={(chosenSkillId, replaceSlotIndex) => {
              const sk = getSkillById(chosenSkillId);
              if (activeEscapeNodeRef.current !== null) {
                const updatedEsc = claimEscapeNodeSkill(
                  escapeProgressRef.current,
                  chosenSkillId,
                  replaceSlotIndex
                );
                const nextEsc =
                  pendingSkillClaim.clearedNodeIndex !== undefined
                    ? markEscapeNodeCleared(updatedEsc, pendingSkillClaim.clearedNodeIndex)
                    : updatedEsc;
                setEscapeProgress(nextEsc);
                setState((prev) => ({
                  ...prev,
                  playerCheatSkills: nextEsc.equippedCheatSkills,
                  playerAcquiredSkills: nextEsc.equippedSkills,
                }));
                if (pendingSkillClaim.clearedNodeIndex !== undefined) {
                  setViewMode('escape-map');
                }
              } else {
                const grouped = equipGroupedSkill(
                  campaign.acquiredCheatSkills ?? DEFAULT_CHEAT_SKILLS,
                  campaign.acquiredSkills,
                  chosenSkillId,
                  replaceSlotIndex
                );
                setCampaign((prev) => ({
                  ...prev,
                  acquiredCheatSkills: grouped.cheat,
                  acquiredSkills: grouped.support,
                }));
                setState((prev) => ({
                  ...prev,
                  playerCheatSkills: grouped.cheat,
                  playerAcquiredSkills: grouped.support,
                }));
              }
              pushToast(
                'success',
                `已装备${getSkillGroup(chosenSkillId) === 'cheat' ? '作弊' : '辅助'}技能「${sk?.name ?? chosenSkillId}」`,
                replaceSlotIndex !== undefined
                  ? `已替换原槽位 #${replaceSlotIndex + 1}`
                  : undefined
              );
              setPendingSkillClaim(null);
            }}
            onSkip={() => {
              if (
                activeEscapeNodeRef.current !== null &&
                pendingSkillClaim.clearedNodeIndex !== undefined
              ) {
                const clearedIdx = pendingSkillClaim.clearedNodeIndex;
                setEscapeProgress((prev) => markEscapeNodeCleared(prev, clearedIdx));
                setViewMode('escape-map');
              }
              setPendingSkillClaim(null);
            }}
          />
        )}

        {activeModal.type === 'cmd' && (
          <DebugCmdModal
            logs={cmdLogs}
            onExecute={handleExecuteDebugCmd}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'p2p' && (
          <P2pLobbyModal
            status={p2pStatus}
            statusDetail={p2pDetail}
            role={p2pRole}
            latencyMs={p2pLatency}
            remotePeer={remotePeer}
            localPlayerName={localP2pName}
            offerToken={p2pOfferToken}
            answerToken={p2pAnswerToken}
            roomCode={p2pRoomCode}
            onChangeLocalName={setLocalP2pName}
            onHostCreateRoomRelay={(c) => void handleHostCreateRoomRelay(c)}
            onGuestJoinRoomRelay={(c) => void handleGuestJoinRoomRelay(c)}
            onHostCreateManualOffer={() => void handleHostCreateManualOffer()}
            onGuestAcceptManualOffer={(o) => void handleGuestAcceptManualOffer(o)}
            onHostConfirmManualAnswer={(a) => void handleHostConfirmManualAnswer(a)}
            onDisconnect={disconnectP2p}
            onNotify={pushToast}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'contracts' && (
          <ContractArchiveModal
            catalog={catalog}
            catalogSource={catalogSource}
            activeCharacter={effectiveCharacter}
            isLoadingCard={isLoadingCard}
            onSelectCardFile={handleSwitchContractFile}
            onImportJsonText={handleImportJsonCard}
            onClose={() => setActiveModal({ type: 'none' })}
          />
        )}

        {activeModal.type === 'llm' && (
          <LlmTerminalModal
            config={llmConfig}
            character={effectiveCharacter}
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

        {!isP2pConnected &&
          activeEscapeNodeIndex === null &&
          (campaign.status === 'loot-select' ||
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
            onClaimLootSkill={(skillId, replaceSlotIndex) => {
              const nextCamp = claimVictoryLoot(campaign, skillId, replaceSlotIndex);
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
            history={
              revealAllAi
                ? state.actionHistory
                : state.actionHistory.filter(
                    (entry) => !(entry.actor === 'ai' && entry.summary.includes('终端篡改'))
                  )
            }
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
          description={`此操作将终止当前牌局，并将你与「${ai.name}」的算力全部重置为 ${state.config.startingChips}。`}
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
