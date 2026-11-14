import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, History, Shield, Sliders, Users } from 'lucide-react';
import {
  DEFAULT_CONFIG,
  type ContractExpression,
  type GameAction,
  type GameConfig,
  type GameState,
} from './engine/types.ts';
import {
  applyAction,
  computeBattleSituation,
  createInitialState,
  getCurrentRaiseCap,
  getHiddenBoardCount,
  getMaxRaisesAllowed,
  getRemainingSuitStats,
  startNextHand,
} from './engine/gameEngine.ts';
import { evaluateVisibleHandSummary } from './engine/evaluator.ts';
import {
  FALLBACK_CONTRACT_CHARACTER,
  deriveAiStyleFromCharacter,
  type ContractCardSummary,
  type ContractCharacter,
} from './engine/contractCards.ts';
import {
  fetchContractCatalog,
  loadContractCharacterByFile,
  registerImportedContractCard,
} from './engine/cardRepository.ts';
import {
  loadSavedLlmConfig,
  requestLlmPokerDecision,
  requestOpponentChatReply,
  saveLlmConfigToStorage,
  type ChatMessage,
  type LlmCallLog,
  type LlmConfig,
} from './engine/llmClient.ts';
import { LocalAiAgent } from './engine/aiAgent.ts';
import { CyberBackdrop, SITUATION_META } from './components/CyberBackdrop.tsx';
import { NetrunnerBrandLogo } from './components/CyberIcons.tsx';
import { OpponentTerminal } from './components/OpponentTerminal.tsx';
import { CyberTableArena, type ConsoleMode } from './components/CyberTableArena.tsx';
import { NeuralCommPanel } from './components/NeuralCommPanel.tsx';
import { CyberVfxOverlay } from './components/CyberChips.tsx';
import {
  ConfirmCyberModal,
  CyberToastHub,
  type CyberToast,
} from './components/CyberToastHub.tsx';

const ContractArchiveModal = lazy(() => import('./components/ContractArchiveModal.tsx'));
const LlmTerminalModal = lazy(() => import('./components/LlmTerminalModal.tsx'));
const ProtocolManualModal = lazy(() => import('./components/ProtocolManualModal.tsx'));
const SandboxTuningModal = lazy(() => import('./components/SandboxTuningModal.tsx'));

const PHASE_LABELS: Record<GameState['phase'], string> = {
  early: '前期 · 3~4暗牌',
  mid: '中期 · 1~2暗牌',
  river: '终局 · 河牌圈',
  showdown: '终局核验',
};

type ActiveModal =
  | { type: 'none' }
  | { type: 'contracts' }
  | { type: 'llm' }
  | { type: 'protocol'; tab: 'rules' | 'suits' | 'audit' }
  | { type: 'tuning' }
  | { type: 'confirm-reset' };

export function App() {
  const [character, setCharacter] = useState<ContractCharacter>(FALLBACK_CONTRACT_CHARACTER);
  const [catalog, setCatalog] = useState<ContractCardSummary[]>([FALLBACK_CONTRACT_CHARACTER]);
  const [catalogSource, setCatalogSource] = useState<'api' | 'static' | 'fallback'>('fallback');
  const [isLoadingCard, setIsLoadingCard] = useState(false);

  const [state, setState] = useState<GameState>(() =>
    createInitialState({
      config: DEFAULT_CONFIG,
      opponentName: FALLBACK_CONTRACT_CHARACTER.name,
    })
  );
  const [activeExpression, setActiveExpression] = useState<ContractExpression>('calm');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [consoleMode, setConsoleMode] = useState<ConsoleMode>('idle');
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>({ type: 'none' });

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadSavedLlmConfig());
  const [llmLogs, setLlmLogs] = useState<LlmCallLog[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-sys',
      sender: 'system',
      speakerName: '系统内核',
      text: '黑域博弈链路已连通。当前使用黑曜/绯霓双色52张牌组，同花成牌率翻倍。',
      timestamp: Date.now(),
      tag: 'system',
    },
    {
      id: 'welcome-char',
      sender: 'opponent',
      speakerName: `${FALLBACK_CONTRACT_CHARACTER.name} // ${FALLBACK_CONTRACT_CHARACTER.codename}`,
      text: FALLBACK_CONTRACT_CHARACTER.quote,
      expression: 'smile',
      timestamp: Date.now(),
      tag: 'chat',
    },
  ]);

  const [toasts, setToasts] = useState<CyberToast[]>([]);

  const pushToast = useCallback(
    (tone: CyberToast['tone'], title: string, detail?: string) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const agentRef = useRef(
    new LocalAiAgent('ai', DEFAULT_CONFIG.aiStyle, FALLBACK_CONTRACT_CHARACTER)
  );
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const latestLlmRef = useRef(llmConfig);
  latestLlmRef.current = llmConfig;
  const latestCharRef = useRef(character);
  latestCharRef.current = character;

  // Keep Local AI synchronized with style & active contract character
  useEffect(() => {
    agentRef.current.setStyle(state.config.aiStyle);
    agentRef.current.setCharacter(character);
  }, [state.config.aiStyle, character]);

  // Load Night-Sugar-Office Contract Catalog & Default Silver Wolf Card on mount
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

  // Global Escape handler for modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal.type !== 'none') {
        setActiveModal({ type: 'none' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal.type]);

  // Step-by-step AI Turn Scheduler (supports optional LLM Poker Decision + Local AI fallback)
  useEffect(() => {
    if (state.phase === 'showdown' || state.currentTurn !== 'ai') {
      return;
    }

    let cancelled = false;
    setIsAiThinking(true);

    const timer = window.setTimeout(async () => {
      try {
        const snapshot = latestStateRef.current;
        if (snapshot.phase === 'showdown' || snapshot.currentTurn !== 'ai') return;

        const cfg = latestLlmRef.current;
        const char = latestCharRef.current;

        const llmDecision = await requestLlmPokerDecision({
          character: char,
          state: snapshot,
          llmConfig: cfg,
        });

        if (cancelled) return;

        if (llmDecision) {
          setLlmLogs((prev) => [llmDecision.logEntry, ...prev].slice(0, 40));
          setActiveExpression(llmDecision.expression);
          setChatMessages((prev) => [
            ...prev.slice(-38),
            {
              id: `ai-act-${Date.now()}`,
              sender: 'opponent',
              speakerName: `${char.name} // ${char.codename}`,
              text: llmDecision.reply,
              expression: llmDecision.expression,
              timestamp: Date.now(),
              tag: 'action',
              fromLlm: true,
            },
          ]);
          setState((prev) => {
            if (prev.phase === 'showdown' || prev.currentTurn !== 'ai') return prev;
            return applyAction(prev, llmDecision.action);
          });
          return;
        }

        const decision = await agentRef.current.decide(snapshot);
        if (cancelled) return;
        setActiveExpression(decision.dialogue.expression);
        setChatMessages((prev) => [
          ...prev.slice(-38),
          {
            id: `ai-act-${Date.now()}`,
            sender: 'opponent',
            speakerName: decision.dialogue.speaker,
            text: decision.dialogue.text,
            expression: decision.dialogue.expression,
            timestamp: Date.now(),
            tag: 'action',
            fromLlm: false,
          },
        ]);
        setState((prev) => {
          if (prev.phase === 'showdown' || prev.currentTurn !== 'ai') return prev;
          return applyAction(prev, decision.action);
        });
      } finally {
        if (!cancelled) {
          setIsAiThinking(false);
        }
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
  ]);

  // Showdown reaction expression & message
  useEffect(() => {
    if (state.phase !== 'showdown' || !state.result) return;
    const res = state.result;
    const expr: ContractExpression =
      res.winner === 'ai' ? 'smile' : res.winner === 'human' ? 'sad' : 'surprise';
    setActiveExpression(expr);
    setChatMessages((prev) => [
      ...prev.slice(-38),
      {
        id: `showdown-msg-${state.handNumber}`,
        sender: 'opponent',
        speakerName: `${character.name} // ${character.codename}`,
        text:
          res.winner === 'ai'
            ? `奖池 ${res.potWon} 算力已归入我的端口。还要继续挑战我的防火墙吗？`
            : res.winner === 'human'
              ? `这手牌被你算准了……拿走 ${res.potWon} 算力吧，下一局我会改写策略。`
              : `完全同分平局？一人一半回收奖池，下一局见真章。`,
        expression: expr,
        timestamp: Date.now(),
        tag: 'action',
      },
    ]);
  }, [state.phase, state.result, state.handNumber, character.name, character.codename]);

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
      setChatMessages((prev) => [
        ...prev.slice(-38),
        {
          id: `switch-${Date.now()}`,
          sender: 'opponent',
          speakerName: `${nextChar.name} // ${nextChar.codename}`,
          text: nextChar.quote || `契约接入完成，我是${nextChar.name}，来过两招吧。`,
          expression: 'smile',
          timestamp: Date.now(),
          tag: 'chat',
        },
      ]);
      pushToast(
        'success',
        `已切换对手为「${nextChar.name}」`,
        `${nextChar.title} · 自动匹配战术倾向：${suggestedStyle}`
      );
      setActiveModal({ type: 'none' });
    } catch (err) {
      pushToast('error', '读取契约卡失败', err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoadingCard(false);
    }
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
      pushToast('success', `契约卡导入成功：${imported.name}`, `包含 ${imported.expressionCount} 张表情差分`);
    } catch (err) {
      pushToast(
        'error',
        '契约卡格式校验未通过',
        err instanceof Error ? err.message : '请上传有效的 night-sugar/girl-card JSON 文件'
      );
    }
  };

  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'human',
      speakerName: '潜行黑客',
      text,
      timestamp: Date.now(),
      tag: 'chat',
    };
    setChatMessages((prev) => [...prev.slice(-38), userMsg]);
    setIsSendingChat(true);

    try {
      const res = await requestOpponentChatReply({
        character,
        state,
        llmConfig,
        chatHistory: [...chatMessages, userMsg],
        userText: text,
      });

      if (res.logEntry) {
        setLlmLogs((prev) => [res.logEntry!, ...prev].slice(0, 40));
      }
      if (res.errorMsg) {
        pushToast('warn', '在线 LLM 响应异常，已平滑回退本地人格', res.errorMsg);
      }

      setActiveExpression(res.expression);
      setChatMessages((prev) => [
        ...prev.slice(-38),
        {
          id: `r-${Date.now()}`,
          sender: 'opponent',
          speakerName: `${character.name} // ${character.codename}`,
          text: res.reply,
          expression: res.expression,
          timestamp: Date.now(),
          tag: 'chat',
          fromLlm: res.fromLlm,
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const executeHumanAction = (action: GameAction) => {
    setConsoleMode('idle');
    setSelectedHandIndex(null);
    setState((prev) => applyAction(prev, action));
  };

  const handleSelectHumanCard = (handIndex: number) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    if (consoleMode !== 'pick-swap-hand' && consoleMode !== 'pick-swap-board') return;
    const card = state.players.human.hand[handIndex];
    if (!card || card.visibility !== 'open' || card.lockedFromSwap) return;
    setSelectedHandIndex(handIndex);
    setConsoleMode('pick-swap-board');
  };

  const handleSelectBoardSlot = (boardIndex: number) => {
    if (state.currentTurn !== 'human' || state.phase === 'showdown') return;
    const slot = state.board[boardIndex];
    if (!slot || slot.isOpen) return;

    if (consoleMode === 'pick-flip') {
      executeHumanAction({ type: 'flip', boardIndex });
      return;
    }

    if (consoleMode === 'pick-swap-board' && selectedHandIndex !== null) {
      executeHumanAction({
        type: 'swap',
        handIndex: selectedHandIndex,
        boardIndex,
      });
    }
  };

  const handleNextHand = () => {
    setConsoleMode('idle');
    setSelectedHandIndex(null);
    setActiveExpression('calm');
    setState((prev) => startNextHand(prev));
  };

  const performFullReset = (customConfig?: GameConfig) => {
    const cfg = customConfig ?? state.config;
    setConsoleMode('idle');
    setSelectedHandIndex(null);
    setActiveExpression('calm');
    setActiveModal({ type: 'none' });
    setState(
      createInitialState({
        config: cfg,
        opponentName: character.name,
      })
    );
    pushToast('info', '黑域牌桌已重置', `双方算力恢复为 ${cfg.startingChips}`);
  };

  const situation = useMemo(() => computeBattleSituation(state), [state]);
  const sitMeta = SITUATION_META[situation];
  const suitStats = useMemo(() => getRemainingSuitStats(state, 'human'), [state]);

  const openBoardCards = useMemo(
    () =>
      state.board
        .filter((b) => b.isOpen || state.config.revealOpponentHidden)
        .map((b) => b.card),
    [state.board, state.config.revealOpponentHidden]
  );

  const humanSummary = useMemo(() => {
    const known = [...state.players.human.hand.map((h) => h.card), ...openBoardCards];
    return evaluateVisibleHandSummary(known, 0);
  }, [state.players.human.hand, openBoardCards]);

  const opponentSummary = useMemo(() => {
    const revealAll = state.phase === 'showdown' || state.config.revealOpponentHidden;
    const knownAi = state.players.ai.hand
      .filter((h) => revealAll || h.visibility === 'open')
      .map((h) => h.card);
    const hiddenAiCount = state.players.ai.hand.length - knownAi.length;
    return evaluateVisibleHandSummary([...knownAi, ...openBoardCards], hiddenAiCount);
  }, [state.players.ai.hand, openBoardCards, state.phase, state.config.revealOpponentHidden]);

  const hiddenBoardCount = getHiddenBoardCount(state);

  return (
    <div className="cyber-app-shell">
      <CyberBackdrop situation={situation} pot={state.pot} />

      {/* Top Cyber-OS Taskbar */}
      <header className="cyber-topbar">
        <div className="topbar-left">
          <div className="brand-cluster">
            <NetrunnerBrandLogo size={28} />
            <div>
              <h1 className="brand-title-main">黑域协议 · 明暗博弈德州</h1>
              <div className="brand-sub-code">{sitMeta.code}</div>
            </div>
          </div>

          <div className="telemetry-pills" aria-label="实时战况遥测">
            <span className="cyber-badge cyan">
              第 #{state.handNumber} 局 · {PHASE_LABELS[state.phase]}
            </span>
            <span
              className={`cyber-badge ${
                situation === 'breach'
                  ? 'danger'
                  : situation === 'overclock'
                    ? 'warn'
                    : 'pink'
              }`}
            >
              <Shield size={12} aria-hidden="true" />
              战况：{sitMeta.label}（防火墙 {sitMeta.firewallPct}%）
            </span>
            <span className="cyber-badge">
              加密节点 {hiddenBoardCount}/4 · 限注 {getCurrentRaiseCap(state)} · 加注{' '}
              {state.raisesInSubPhase}/{getMaxRaisesAllowed(state)}
            </span>
          </div>
        </div>

        <nav className="topbar-nav" aria-label="系统功能模块导航">
          <button
            id="nav-btn-contracts"
            type="button"
            className={`os-nav-btn ${activeModal.type === 'contracts' ? 'active' : ''}`}
            onClick={() => setActiveModal({ type: 'contracts' })}
          >
            <Users size={15} aria-hidden="true" />
            契约档案 ({catalog.length})
          </button>

          <button
            id="nav-btn-llm"
            type="button"
            className={`os-nav-btn ${
              activeModal.type === 'llm' || llmConfig.enabled ? 'highlight' : ''
            }`}
            onClick={() => setActiveModal({ type: 'llm' })}
          >
            <Bot size={15} aria-hidden="true" />
            LLM神经链路
          </button>

          <button
            id="nav-btn-rules"
            type="button"
            className={`os-nav-btn ${
              activeModal.type === 'protocol' && activeModal.tab !== 'audit' ? 'active' : ''
            }`}
            onClick={() => setActiveModal({ type: 'protocol', tab: 'rules' })}
          >
            <BookOpen size={15} aria-hidden="true" />
            协议规则
          </button>

          <button
            id="nav-btn-audit"
            type="button"
            className={`os-nav-btn ${
              activeModal.type === 'protocol' && activeModal.tab === 'audit' ? 'active' : ''
            }`}
            onClick={() => setActiveModal({ type: 'protocol', tab: 'audit' })}
          >
            <History size={15} aria-hidden="true" />
            审计日志
          </button>

          <button
            id="nav-btn-tuning"
            type="button"
            className={`os-nav-btn ${
              activeModal.type === 'tuning' || state.config.revealOpponentHidden ? 'active' : ''
            }`}
            onClick={() => setActiveModal({ type: 'tuning' })}
          >
            <Sliders size={15} aria-hidden="true" />
            数值调优
          </button>
        </nav>
      </header>

      {/* Main 3-Column Cyber-OS Battle Workspace */}
      <main className="cyber-workspace">
        <OpponentTerminal
          character={character}
          activeExpression={activeExpression}
          overloadMode={llmConfig.overloadPersona}
          isAiTurn={state.currentTurn === 'ai' && state.phase !== 'showdown'}
          isAiThinking={isAiThinking}
          llmEnabled={llmConfig.enabled}
          onSelectExpression={(expr) => setActiveExpression(expr)}
          onToggleOverload={() => {
            const next = { ...llmConfig, overloadPersona: !llmConfig.overloadPersona };
            setLlmConfig(next);
            saveLlmConfigToStorage(next);
            pushToast(
              next.overloadPersona ? 'warn' : 'info',
              next.overloadPersona
                ? `${character.name}：深层过载人格已激活`
                : `${character.name}：已恢复常态契约人格`,
              next.overloadPersona ? '立绘与对话语料已同步切换至高压侵蚀频段' : undefined
            );
          }}
          onOpenArchive={() => setActiveModal({ type: 'contracts' })}
        />

        <CyberTableArena
          state={state}
          mode={consoleMode}
          selectedHandIndex={selectedHandIndex}
          humanSummary={humanSummary}
          opponentSummary={opponentSummary}
          onModeChange={(m) => setConsoleMode(m)}
          onSelectHumanCard={handleSelectHumanCard}
          onSelectBoardSlot={handleSelectBoardSlot}
          onClearSelection={() => setSelectedHandIndex(null)}
          onExecuteAction={executeHumanAction}
          onNextHand={handleNextHand}
          onRequestResetMatch={() => setActiveModal({ type: 'confirm-reset' })}
        />

        <NeuralCommPanel
          suitStats={suitStats}
          showDeckTracker={state.config.showDeckTracker}
          messages={chatMessages}
          isSendingChat={isSendingChat}
          llmEnabled={llmConfig.enabled}
          opponentName={character.name}
          onSendMessage={handleSendChatMessage}
          onOpenLlmModal={() => setActiveModal({ type: 'llm' })}
        />
      </main>

      <CyberVfxOverlay event={state.lastAction} />
      <CyberToastHub toasts={toasts} onDismiss={dismissToast} />

      {/* Lazy-Loaded Feature Modals */}
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
            state={state}
            logs={llmLogs}
            onSaveConfig={(next) => {
              setLlmConfig(next);
              saveLlmConfigToStorage(next);
            }}
            onAppendLog={(entry) => setLlmLogs((prev) => [entry, ...prev].slice(0, 40))}
            onClearLogs={() => setLlmLogs([])}
            onNotify={pushToast}
            onClose={() => setActiveModal({ type: 'none' })}
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
          title="确认重置整场黑域赌局？"
          description={`此操作将终止当前进行中的牌局，并将你与「${character.name}」的算力筹码全部重置为 ${state.config.startingChips}。`}
          confirmLabel="确认重置战场"
          onConfirm={() => performFullReset()}
          onCancel={() => setActiveModal({ type: 'none' })}
        />
      )}
    </div>
  );
}

export default App;
