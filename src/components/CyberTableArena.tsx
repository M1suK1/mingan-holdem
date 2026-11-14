import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRightCircle,
  Check,
  Eye,
  Flame,
  RotateCcw,
  ShieldOff,
  Swords,
  Terminal,
} from 'lucide-react';
import type { GameAction, GameState, VisibleHandSummary } from '../engine/types.ts';
import {
  getBetDiff,
  getCurrentRaiseCap,
  getHiddenBoardCount,
  getLegalRaiseRange,
  getMaxRaisesAllowed,
  getNextSwapFee,
  otherPlayer,
} from '../engine/gameEngine.ts';
import { CyberCard3D } from './CyberCard3D.tsx';
import { ChipPushAnim, CyberChips } from './CyberChips.tsx';

export type ConsoleMode =
  | 'idle'
  | 'pick-swap-hand'
  | 'pick-swap-board'
  | 'pick-flip'
  | 'pick-raise';

interface CyberTableArenaProps {
  state: GameState;
  mode: ConsoleMode;
  selectedHandIndex: number | null;
  humanSummary: VisibleHandSummary;
  opponentSummary: VisibleHandSummary;
  onModeChange: (mode: ConsoleMode) => void;
  onSelectHumanCard: (handIndex: number) => void;
  onSelectBoardSlot: (boardIndex: number) => void;
  onClearSelection: () => void;
  onExecuteAction: (action: GameAction) => void;
  onNextHand: () => void;
  onRequestResetMatch: () => void;
}

export function CyberTableArena({
  state,
  mode,
  selectedHandIndex,
  humanSummary,
  opponentSummary,
  onModeChange,
  onSelectHumanCard,
  onSelectBoardSlot,
  onClearSelection,
  onExecuteAction,
  onNextHand,
  onRequestResetMatch,
}: CyberTableArenaProps) {
  const human = state.players.human;
  const ai = state.players.ai;
  const isShowdown = state.phase === 'showdown';
  const isHumanTurn = state.currentTurn === 'human' && !isShowdown;
  const isAiTurn = state.currentTurn === 'ai' && !isShowdown;
  const revealAll = isShowdown || state.config.revealOpponentHidden;

  const diff = getBetDiff(state, 'human');
  const paid = Math.min(diff, human.chips);
  const willBeAllIn = human.chips - paid === 0 || ai.allIn;
  const hiddenCount = getHiddenBoardCount(state);
  const swapFee = getNextSwapFee(state, 'human');
  const hasSwappableHand = human.hand.some((h) => h.visibility === 'open' && !h.lockedFromSwap);
  const canSwap = diff === 0 && hiddenCount > 0 && hasSwappableHand && human.chips >= swapFee;
  const canFlip = diff === 0 && hiddenCount > 0;
  const raiseRange = getLegalRaiseRange(state, 'human', diff > 0 ? paid : 0);
  const raiseCap = getCurrentRaiseCap(state);
  const maxRaises = getMaxRaisesAllowed(state);

  const [raiseAmt, setRaiseAmt] = useState<number>(raiseRange.min || 10);

  useEffect(() => {
    if (raiseRange.allowed) {
      setRaiseAmt((prev) =>
        Math.max(raiseRange.min, Math.min(raiseRange.max, prev || raiseRange.min))
      );
    }
  }, [raiseRange.allowed, raiseRange.min, raiseRange.max]);

  const aiWinIds = new Set(state.result?.aiEval?.bestFive.map((c) => c.id) ?? []);
  const humanWinIds = new Set(state.result?.humanEval?.bestFive.map((c) => c.id) ?? []);
  const boardWinIds = new Set(
    state.result?.winner === 'human'
      ? (state.result.humanEval?.bestFive.map((c) => c.id) ?? [])
      : state.result?.winner === 'ai'
        ? (state.result.aiEval?.bestFive.map((c) => c.id) ?? [])
        : []
  );

  const evt = state.lastAction;
  const showChipPush =
    evt &&
    (evt.type === 'raise' || evt.type === 'call' || evt.type === 'swap') &&
    (evt.amount ?? 0) > 0;

  const canPickHumanCard = mode === 'pick-swap-hand' || mode === 'pick-swap-board';

  let tableStatus = '对手运算中';
  let statusWarn = false;
  if (isShowdown && state.result) {
    tableStatus =
      state.result.winner === 'tie'
        ? '序列平分奖池'
        : state.result.winner === 'human'
          ? '我方破译获胜'
          : `${ai.name}夺取奖池`;
  } else if (mode === 'pick-flip') {
    tableStatus = '点选加密节点破译';
  } else if (mode === 'pick-swap-board') {
    tableStatus = '点选加密节点置换';
  } else if (isHumanTurn) {
    if (diff > 0) {
      tableStatus = `需同步差额 ${diff}`;
      statusWarn = true;
    } else if (state.justCalledThisTurn) {
      tableStatus = '已跟注 · 请继续行动';
    } else {
      tableStatus = '我方回合控制权';
    }
  }

  return (
    <section className="center-battle-column" aria-label="赛博黑客攻防主战桌">
      {/* Opponent Real-Time Rank & Credits Strip */}
      <div className={`combatant-hud-strip ${isAiTurn ? 'is-ai-turn' : ''}`}>
        <div className="combatant-id-group">
          {isAiTurn && <span className="pulse-led pink" aria-hidden="true" />}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{ai.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>对端黑客节点</div>
          </div>
        </div>

        <div className="live-rank-readout" aria-live="polite">
          <span className="live-rank-title">对方牌型：{opponentSummary.label}</span>
          <span className="live-rank-sub">{opponentSummary.detail}</span>
        </div>

        <div className="credits-readout">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>剩余算力</span>
          <span className="credits-amount" style={{ color: 'var(--neon-pink-300)' }}>
            {ai.chips}
          </span>
        </div>
      </div>

      {/* 3D Holographic Cyber Table */}
      <div className="cyber-table-stage">
        <div className="cyber-table-surface">
          {/* Far side: Opponent's 3 3D Cards + Bet Stack */}
          <div className="table-row-opponent">
            <div className="table-cards-trio">
              {ai.hand.map((hc, idx) => {
                const isPrivate = hc.visibility === 'private';
                const showFace = !isPrivate || revealAll;
                return (
                  <CyberCard3D
                    key={`ai-hand-${idx}`}
                    id={`opponent-hand-card-${idx}`}
                    card={showFace ? hc.card : undefined}
                    faceDown={!showFace}
                    size="sm"
                    backCode="暗码"
                    justActed={Boolean(
                      evt && evt.actor === 'ai' && evt.type === 'swap' && evt.handIndex === idx
                    )}
                    isWinner={
                      isShowdown && state.result?.winner === 'ai' && aiWinIds.has(hc.card.id)
                    }
                  />
                );
              })}
            </div>

            {ai.roundBet > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CyberChips amount={ai.roundBet} compact />
                <span className="bet-chip-pill">对端注码 {ai.roundBet}</span>
              </div>
            )}
          </div>

          {/* Center: 4 Encrypted Community Nodes + 3D Core Pot */}
          <div className="table-row-center">
            <div className="board-nodes-grid">
              {state.board.map((slot) => {
                const canClickHidden =
                  !slot.isOpen && (mode === 'pick-flip' || mode === 'pick-swap-board');
                const revealDebug = !slot.isOpen && state.config.revealOpponentHidden;
                const showFace = slot.isOpen || revealDebug;

                return (
                  <CyberCard3D
                    key={`board-slot-${slot.index}`}
                    id={`board-node-card-${slot.index}`}
                    card={showFace ? slot.card : undefined}
                    faceDown={!showFace}
                    size="md"
                    backCode={`节点0${slot.index + 1}`}
                    justActed={Boolean(
                      evt &&
                        (evt.type === 'flip' || evt.type === 'swap') &&
                        evt.boardIndex === slot.index
                    )}
                    targetable={canClickHidden}
                    isWinner={isShowdown && boardWinIds.has(slot.card.id)}
                    onClick={canClickHidden ? () => onSelectBoardSlot(slot.index) : undefined}
                  />
                );
              })}
            </div>

            <div className="core-pot-hub">
              <CyberChips amount={state.pot} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' }}>
                  奖池算力
                </span>
                <span className="pot-num-big">{state.pot}</span>
              </div>
              <span className={`pot-turn-tag ${statusWarn ? 'warn' : ''}`}>{tableStatus}</span>
            </div>
          </div>

          {/* Near side: Your 3 3D Cards + Your Bet Stack */}
          <div className="table-row-human">
            <div className="table-cards-trio">
              {human.hand.map((hc, idx) => {
                const isPrivate = hc.visibility === 'private';
                const selectableForSwap = canPickHumanCard && !isPrivate && !hc.lockedFromSwap;
                return (
                  <CyberCard3D
                    key={`human-hand-${idx}`}
                    id={`human-hand-card-${idx}`}
                    card={hc.card}
                    faceDown={false}
                    size="lg"
                    isOwnPrivate={isPrivate}
                    justActed={Boolean(
                      evt && evt.actor === 'human' && evt.type === 'swap' && evt.handIndex === idx
                    )}
                    selected={selectedHandIndex === idx}
                    targetable={selectableForSwap && selectedHandIndex === null}
                    isWinner={
                      isShowdown && state.result?.winner === 'human' && humanWinIds.has(hc.card.id)
                    }
                    onClick={selectableForSwap ? () => onSelectHumanCard(idx) : undefined}
                  />
                );
              })}
            </div>

            {human.roundBet > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CyberChips amount={human.roundBet} compact />
                <span className="bet-chip-pill">我方注码 {human.roundBet}</span>
              </div>
            )}
          </div>

          {showChipPush && evt && (
            <ChipPushAnim eventId={evt.id} actor={evt.actor} amount={evt.amount!} />
          )}
        </div>
      </div>

      {/* Player Real-Time Rank & Credits Strip */}
      <div className={`combatant-hud-strip ${isHumanTurn ? 'is-turn' : ''}`}>
        <div className="combatant-id-group">
          {isHumanTurn && <span className="pulse-led" aria-hidden="true" />}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>我方终端 · 潜行黑客</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              闪烁边框代表己方私有暗牌（锁定不可再换）
            </div>
          </div>
        </div>

        <div
          className="live-rank-readout"
          style={{
            background: 'rgba(0, 240, 255, 0.1)',
            borderColor: 'rgba(0, 240, 255, 0.42)',
          }}
          aria-live="polite"
        >
          <span className="live-rank-title">己方牌型：{humanSummary.label}</span>
          <span className="live-rank-sub" style={{ color: 'var(--neon-cyan-300)' }}>
            {humanSummary.detail}
          </span>
        </div>

        <div className="credits-readout">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>可用算力</span>
          <span className="credits-amount">{human.chips}</span>
        </div>
      </div>

      {/* Tactical Intrusion Action Console */}
      <div className="command-console" role="region" aria-label="战术指令控制台">
        {isShowdown && state.result ? (
          <>
            <div className="console-header-line">
              <strong style={{ color: 'var(--accent-telemetry)' }}>
                {state.result.winner === 'tie'
                  ? `平局分池 · 双方各回收 ${state.result.payouts.human}`
                  : state.result.winner === 'human'
                    ? `破译大捷 · 我方赢取总奖池 +${state.result.potWon}`
                    : `${ai.name} 赢下本轮奖池 ${state.result.potWon}`}
              </strong>
              <span className="cmd-sub-meta">
                {state.result.reason === 'showdown' &&
                state.result.humanEval &&
                state.result.aiEval
                  ? `我方 [${state.result.humanEval.categoryName}] vs ${ai.name} [${state.result.aiEval.categoryName}]`
                  : `${
                      otherPlayer(state.result.winner === 'tie' ? 'human' : state.result.winner) ===
                      'human'
                        ? '我方'
                        : ai.name
                    } 主动断开连接`}
              </span>
            </div>
            <div className="cmd-grid cols-2">
              {human.chips > 0 && ai.chips > 0 ? (
                <button
                  id="console-btn-next-hand"
                  type="button"
                  className="cyber-cmd-btn primary-cyan"
                  onClick={onNextHand}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Swords size={15} aria-hidden="true" /> 载入下一局协议
                  </span>
                  <span className="cmd-sub-meta">进入第 {state.handNumber + 1} 局</span>
                </button>
              ) : (
                <button
                  id="console-btn-match-over-restart"
                  type="button"
                  className="cyber-cmd-btn primary-pink"
                  onClick={onRequestResetMatch}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RotateCcw size={15} aria-hidden="true" />{' '}
                    {human.chips > 0 ? '整场完胜！重置战场' : '算力耗尽！重新接入'}
                  </span>
                  <span className="cmd-sub-meta">恢复初始算力 {state.config.startingChips}</span>
                </button>
              )}
              <button
                id="console-btn-reset-match"
                type="button"
                className="cyber-cmd-btn"
                onClick={onRequestResetMatch}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={15} aria-hidden="true" /> 重置整场对局
                </span>
                <span className="cmd-sub-meta">清空局数并恢复初始筹码</span>
              </button>
            </div>
          </>
        ) : !isHumanTurn ? (
          <div className="console-header-line" style={{ justifyContent: 'center', padding: '10px 0' }}>
            <Terminal size={15} color="var(--accent-primary)" aria-hidden="true" />
            <strong style={{ color: 'var(--neon-pink-300)' }}>
              {ai.name} 正在解析牌桌数据流并构造指令...
            </strong>
          </div>
        ) : mode === 'pick-swap-hand' ? (
          <div className="console-header-line">
            <span>
              <strong>覆写换牌 [步骤 1/2]</strong>：请点击桌面上方你的任意一张{' '}
              <strong style={{ color: 'var(--accent-telemetry)' }}>公开手牌</strong>
            </span>
            <button
              id="console-btn-cancel-swap-1"
              type="button"
              className="os-nav-btn"
              onClick={() => {
                onClearSelection();
                onModeChange('idle');
              }}
            >
              取消换牌
            </button>
          </div>
        ) : mode === 'pick-swap-board' ? (
          <div className="console-header-line">
            <span>
              <strong>覆写换牌 [步骤 2/2]</strong>：已选手牌 #{(selectedHandIndex ?? 0) + 1}，请点击中央任意{' '}
              <strong style={{ color: 'var(--neon-pink-300)' }}>未破译节点</strong>（消耗 {swapFee}）
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                id="console-btn-repick-hand"
                type="button"
                className="os-nav-btn"
                onClick={() => {
                  onClearSelection();
                  onModeChange('pick-swap-hand');
                }}
              >
                重选手牌
              </button>
              <button
                id="console-btn-cancel-swap-2"
                type="button"
                className="os-nav-btn"
                onClick={() => {
                  onClearSelection();
                  onModeChange('idle');
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : mode === 'pick-flip' ? (
          <div className="console-header-line">
            <span>
              <strong>免费节点破译</strong>：请点击中央桌面任意一张{' '}
              <strong style={{ color: 'var(--accent-telemetry)' }}>加密节点卡牌</strong>
            </span>
            <button
              id="console-btn-cancel-flip"
              type="button"
              className="os-nav-btn"
              onClick={() => onModeChange('idle')}
            >
              取消破译
            </button>
          </div>
        ) : mode === 'pick-raise' ? (
          <>
            <div className="raise-slider-bar">
              <div className="console-header-line">
                <span>
                  {diff > 0 ? `同步差额 ${paid} 后反加` : '注入算力加注'}（阶段上限 {raiseCap} · 已加注{' '}
                  {state.raisesInSubPhase}/{maxRaises}）
                </span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-pink-300)', fontSize: 16 }}>
                  +{raiseAmt}
                </strong>
              </div>
              <div className="preset-step-row">
                {Array.from(
                  new Set([
                    raiseRange.min,
                    Math.max(
                      raiseRange.min,
                      Math.min(
                        raiseRange.max,
                        Math.round((raiseRange.min + raiseRange.max) / 2 / 5) * 5
                      )
                    ),
                    raiseRange.max,
                  ])
                )
                  .sort((a, b) => a - b)
                  .map((val) => (
                    <button
                      key={val}
                      id={`raise-preset-btn-${val}`}
                      type="button"
                      className={`preset-chip-btn ${raiseAmt === val ? 'active' : ''}`}
                      onClick={() => setRaiseAmt(val)}
                    >
                      +{val}
                    </button>
                  ))}
              </div>
              {raiseRange.max > raiseRange.min && (
                <input
                  id="raise-amount-slider"
                  type="range"
                  min={raiseRange.min}
                  max={raiseRange.max}
                  step={raiseRange.max - raiseRange.min <= 20 ? 1 : 5}
                  value={raiseAmt}
                  onChange={(e) => setRaiseAmt(Number(e.target.value))}
                  aria-label="调整加注算力额度"
                />
              )}
            </div>
            <div className="cmd-grid cols-2">
              <button
                id="console-btn-cancel-raise"
                type="button"
                className="cyber-cmd-btn"
                onClick={() => onModeChange('idle')}
              >
                返回指令面板
              </button>
              <button
                id="console-btn-confirm-raise"
                type="button"
                className="cyber-cmd-btn primary-pink"
                onClick={() => onExecuteAction({ type: 'raise', amount: raiseAmt })}
              >
                确认推入筹码 {diff > 0 ? `+${paid + raiseAmt}` : `+${raiseAmt}`}
              </button>
            </div>
          </>
        ) : state.phase === 'river' ? (
          diff === 0 ? (
            <>
              <div className="console-header-line">
                <span>终局河牌圈（全部节点已公开）</span>
                <span className="cmd-sub-meta">
                  本圈加注 {state.raisesInSubPhase}/{maxRaises} · 单次上限 {raiseCap}
                </span>
              </div>
              <div className="cmd-grid cols-2">
                <button
                  id="action-btn-river-check"
                  type="button"
                  className="cyber-cmd-btn primary-cyan"
                  onClick={() => onExecuteAction({ type: 'check' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Check size={15} aria-hidden="true" /> 静默过牌
                  </span>
                  <span className="cmd-sub-meta">0 算力消耗</span>
                </button>
                <button
                  id="action-btn-river-bet"
                  type="button"
                  className="cyber-cmd-btn primary-pink"
                  disabled={!raiseRange.allowed}
                  onClick={() => onModeChange('pick-raise')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Flame size={15} aria-hidden="true" /> 终局加注施压
                  </span>
                  <span className="cmd-sub-meta">
                    {raiseRange.allowed ? `额度 ${raiseRange.min}~${raiseRange.max}` : '已达加注上限'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="console-header-line">
                <span>
                  终局遭遇压制 · 需补齐 <strong style={{ color: 'var(--neon-pink-300)' }}>{paid}</strong>
                </span>
                <span className="cmd-sub-meta">
                  本圈加注 {state.raisesInSubPhase}/{maxRaises}
                </span>
              </div>
              <div className={`cmd-grid ${raiseRange.allowed && !willBeAllIn ? '' : 'cols-2'}`}>
                <button
                  id="action-btn-river-fold"
                  type="button"
                  className="cyber-cmd-btn danger-red"
                  onClick={() => onExecuteAction({ type: 'fold' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ShieldOff size={15} aria-hidden="true" /> 断开弃权
                  </span>
                  <span className="cmd-sub-meta">放弃当前奖池</span>
                </button>
                <button
                  id="action-btn-river-call"
                  type="button"
                  className="cyber-cmd-btn primary-cyan"
                  onClick={() => onExecuteAction({ type: 'call' })}
                >
                  <span>{willBeAllIn ? '全下跟注验牌' : '跟注启动摊牌'}</span>
                  <span className="cmd-sub-meta">推入 +{paid}</span>
                </button>
                {raiseRange.allowed && !willBeAllIn && (
                  <button
                    id="action-btn-river-reraise"
                    type="button"
                    className="cyber-cmd-btn primary-pink"
                    onClick={() => onModeChange('pick-raise')}
                  >
                    <span>同步并反加</span>
                    <span className="cmd-sub-meta">+{paid} 后继续施压</span>
                  </button>
                )}
              </div>
            </>
          )
        ) : diff > 0 ? (
          <>
            <div className="console-header-line">
              <span>
                警报：对手加注施压 · 需同步差额{' '}
                <strong style={{ color: 'var(--neon-pink-300)' }}>{paid}</strong>
              </span>
              <span className="cmd-sub-meta">
                {willBeAllIn ? '跟注即触发全下熔断亮牌' : '跟注仅补齐筹码，不消耗你的回合动作'}
              </span>
            </div>
            <div className={`cmd-grid ${raiseRange.allowed && !willBeAllIn ? '' : 'cols-2'}`}>
              <button
                id="action-btn-fold"
                type="button"
                className="cyber-cmd-btn danger-red"
                onClick={() => onExecuteAction({ type: 'fold' })}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ShieldOff size={15} aria-hidden="true" /> 断开弃权
                </span>
                <span className="cmd-sub-meta">让出底池</span>
              </button>
              <button
                id="action-btn-call"
                type="button"
                className="cyber-cmd-btn primary-cyan"
                onClick={() => onExecuteAction({ type: 'call' })}
              >
                <span>{willBeAllIn ? '全下跟注亮牌' : `跟注同步 +${paid}`}</span>
                <span className="cmd-sub-meta">
                  {willBeAllIn ? '立即翻开全部节点' : '不消耗行动权 · 可继续换牌/翻牌'}
                </span>
              </button>
              {raiseRange.allowed && !willBeAllIn && (
                <button
                  id="action-btn-direct-reraise"
                  type="button"
                  className="cyber-cmd-btn primary-pink"
                  onClick={() => onModeChange('pick-raise')}
                >
                  <span>直接反加</span>
                  <span className="cmd-sub-meta">同步后再反压</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="console-header-line">
              <span>
                {state.justCalledThisTurn
                  ? '已补齐跟注：请继续执行本回合战术动作，或移交回合'
                  : '平注指令态：三项核心入侵动作必选其一（不可空过）'}
              </span>
              <span className="cmd-sub-meta">
                本段加注 {state.raisesInSubPhase}/{maxRaises} · 上限 {raiseCap}
              </span>
            </div>
            <div className={`cmd-grid ${state.justCalledThisTurn ? 'cols-4' : ''}`}>
              <button
                id="action-btn-swap"
                type="button"
                className="cyber-cmd-btn"
                disabled={!canSwap}
                onClick={() => onModeChange('pick-swap-hand')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ArrowLeftRight size={14} aria-hidden="true" /> 覆写换牌
                </span>
                <span className="cmd-sub-meta">
                  {canSwap ? `门票 ${swapFee}（第${human.swapCount + 1}次）` : '当前不可换'}
                </span>
              </button>

              <button
                id="action-btn-flip"
                type="button"
                className="cyber-cmd-btn primary-cyan"
                disabled={!canFlip}
                onClick={() => onModeChange('pick-flip')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Eye size={14} aria-hidden="true" /> 免费破译翻牌
                </span>
                <span className="cmd-sub-meta">0 消耗 · 重置加注计数</span>
              </button>

              <button
                id="action-btn-raise"
                type="button"
                className="cyber-cmd-btn primary-pink"
                disabled={!raiseRange.allowed}
                onClick={() => onModeChange('pick-raise')}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Flame size={14} aria-hidden="true" /> 加注施压
                </span>
                <span className="cmd-sub-meta">
                  {raiseRange.allowed ? `额度 ${raiseRange.min}~${raiseRange.max}` : '已达2次封顶'}
                </span>
              </button>

              {state.justCalledThisTurn && (
                <button
                  id="action-btn-end-turn"
                  type="button"
                  className="cyber-cmd-btn"
                  onClick={() => onExecuteAction({ type: 'end-turn' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ArrowRightCircle size={14} aria-hidden="true" /> 移交回合
                  </span>
                  <span className="cmd-sub-meta">仅保留跟注</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
