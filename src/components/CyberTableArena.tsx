import { useEffect, useState } from 'react';
import {
  ArrowRightCircle,
  Check,
  Flame,
  Grid,
  Hand,
  RotateCcw,
  ShieldOff,
  Swords,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { GameAction, GameState, VisibleHandSummary } from '../engine/types.ts';
import {
  computeThreeRaisePresets,
  getBetDiff,
  getCurrentRaiseCap,
  getHiddenBoardCount,
  getLegalRaiseRange,
  getMaxRaisesAllowed,
  getNextSwapFee,
  otherPlayer,
} from '../engine/gameEngine.ts';
import { PixelWindow } from './PixelWindow.tsx';
import { CyberCard3D } from './CyberCard3D.tsx';

interface CyberTableArenaProps {
  state: GameState;
  selectedHandIndex: number | null;
  humanSummary: VisibleHandSummary;
  onSelectHumanCard: (handIndex: number) => void;
  onSelectBoardSlot: (boardIndex: number) => void;
  onClearSelection: () => void;
  onExecuteAction: (action: GameAction) => void;
  onNextHand: () => void;
  onRequestResetMatch: () => void;
}

/**
 * Middle + Bottom Pixel Windows:
 * - Middle Window (below Opponent Portrait): 4 Community Cards (Direct click hidden card = Free Flip;
 *   if player already clicked own open card = Direct Swap!)
 * - Bottom Row:
 *   - Left/Center Window: Player's 3 Hand Cards (Click open card to arm Swap)
 *   - Right Window: Simplified Tactical Action Buttons (Raise -> 3 fixed amount choices, NO slider!)
 */
export function CyberTableArena({
  state,
  selectedHandIndex,
  humanSummary,
  onSelectHumanCard,
  onSelectBoardSlot,
  onClearSelection,
  onExecuteAction,
  onNextHand,
  onRequestResetMatch,
}: CyberTableArenaProps) {
  const [showRaiseChoices, setShowRaiseChoices] = useState(false);

  useEffect(() => {
    setShowRaiseChoices(false);
  }, [state.handNumber, state.actionHistory.length, state.currentTurn]);

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
  const raiseCap = getCurrentRaiseCap(state);
  const maxRaises = getMaxRaisesAllowed(state);

  const humanWinIds = new Set(state.result?.humanEval?.bestFive.map((c) => c.id) ?? []);
  const boardWinIds = new Set(
    state.result?.winner === 'human'
      ? (state.result.humanEval?.bestFive.map((c) => c.id) ?? [])
      : state.result?.winner === 'ai'
        ? (state.result.aiEval?.bestFive.map((c) => c.id) ?? [])
        : []
  );

  const evt = state.lastAction;

  const fireAction = (action: GameAction) => {
    setShowRaiseChoices(false);
    onExecuteAction(action);
  };

  const boardGuideText = !isHumanTurn
    ? isShowdown
      ? '本轮核验完毕，可查看完整亮牌结果'
      : `等待 ${ai.name} 执行回合动作...`
    : diff > 0
      ? `请先在右下指令窗点击「跟注同步 +${paid}」（不消耗动作），再点击牌面操作`
      : selectedHandIndex !== null
        ? `已选中我方手牌 #${selectedHandIndex + 1}：点击任意加密节点支付 ${swapFee} 互换（再次点击该手牌可取消）`
        : hiddenCount > 0
          ? `直觉操作：直接点击上方暗牌 = 免费翻牌 ｜ 先点下方己方明牌再点暗牌 = 付费换牌（门票 ${swapFee}）`
          : '全部公共节点已破译，请在右下指令窗完成终局河牌决策';

  return (
    <>
      {/* MIDDLE WINDOW (Directly below Opponent Portrait): 4 Community Cards */}
      <PixelWindow
        title={`公共加密节点池 · 剩余暗牌 ${hiddenCount}/4`}
        code="BOARD_4X"
        accentColor="#1e315c"
        icon={<Grid size={13} color="var(--accent-telemetry)" aria-hidden="true" />}
        bodyClassName="community-win-body"
      >
        <div className="board-nodes-row">
          {state.board.map((slot) => {
            const isHidden = !slot.isOpen;
            const clickableHidden = isHumanTurn && isHidden;
            const revealDebug = isHidden && state.config.revealOpponentHidden;
            const showFace = slot.isOpen || revealDebug;

            const hint = !clickableHidden
              ? undefined
              : selectedHandIndex !== null
                ? `点击将手牌 #${selectedHandIndex + 1} 与节点 #${slot.index + 1} 互换（消耗 ${swapFee}）`
                : `点击直接免费翻开节点 #${slot.index + 1}`;

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
                targetable={clickableHidden && diff === 0}
                isWinner={isShowdown && boardWinIds.has(slot.card.id)}
                actionHint={hint}
                onClick={clickableHidden ? () => onSelectBoardSlot(slot.index) : undefined}
              />
            );
          })}
        </div>

        <div className="direct-op-hint">{boardGuideText}</div>
      </PixelWindow>

      {/* BOTTOM DECK: [Player's 3 Cards Window] + [Right-Side Tactical Action Buttons Window] */}
      <div className="player-bottom-deck">
        {/* Left/Center: Player's 3 Cards Window */}
        <PixelWindow
          title="己方手牌序列 · 潜行黑客"
          code="MY_HAND"
          accentColor="#193b4d"
          icon={<Hand size={13} color="var(--accent-telemetry)" aria-hidden="true" />}
          activeGlow={isHumanTurn}
          bodyClassName="player-cards-win-body"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 11.5,
            }}
          >
            <span className="cyber-badge cyan">
              己方牌型：{humanSummary.label} · {humanSummary.detail}
            </span>
            <span className="cyber-badge">可用算力 {human.chips}</span>
          </div>

          <div className="cards-row-flex">
            {human.hand.map((hc, idx) => {
              const isPrivate = hc.visibility === 'private';
              const canClickForSwap =
                isHumanTurn && !isPrivate && !hc.lockedFromSwap && hiddenCount > 0;
              const isSelected = selectedHandIndex === idx;

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
                  selected={isSelected}
                  actionHint={
                    isPrivate
                      ? '私有加密暗牌（已锁定不可再次换出）'
                      : canClickForSwap
                        ? isSelected
                          ? '已选中：点击上方暗牌完成互换，或再次点击取消'
                          : `点击选中手牌 #${idx + 1} 准备与上方暗牌互换（门票 ${swapFee}）`
                        : undefined
                  }
                  isWinner={
                    isShowdown && state.result?.winner === 'human' && humanWinIds.has(hc.card.id)
                  }
                  onClick={canClickForSwap ? () => onSelectHumanCard(idx) : undefined}
                />
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <span>闪烁边框 = 己方私有暗牌</span>
            <span>换牌门票: {swapFee}（已换 {human.swapCount} 次）</span>
          </div>
        </PixelWindow>

        {/* RIGHT OF PLAYER CARDS: Simplified Tactical Command Window (3 Raise Presets, Zero Slider!) */}
        <PixelWindow
          title="战术指令窗口"
          code="CMD.BAT"
          accentColor="#421636"
          icon={<Terminal size={13} color="var(--neon-pink-300)" aria-hidden="true" />}
          activeGlow={isHumanTurn}
          bodyClassName="action-deck-win-body"
        >
          {isShowdown && state.result ? (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--neon-cyan-300)' }}>
                {state.result.winner === 'tie'
                  ? `平局分池 · 各得 ${state.result.payouts.human}`
                  : state.result.winner === 'human'
                    ? `破译大捷！赢取奖池 +${state.result.potWon}`
                    : `${ai.name} 夺取奖池 ${state.result.potWon}`}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {state.result.reason === 'showdown' &&
                  state.result.humanEval &&
                  state.result.aiEval
                    ? `我方 [${state.result.humanEval.categoryName}] vs 对端 [${state.result.aiEval.categoryName}]`
                    : `${
                        otherPlayer(
                          state.result.winner === 'tie' ? 'human' : state.result.winner
                        ) === 'human'
                          ? '我方'
                          : ai.name
                      } 主动断开弃权`}
                </div>
              </div>

              <div className="px-btn-grid cols-2">
                {human.chips > 0 && ai.chips > 0 ? (
                  <button
                    id="console-btn-next-hand"
                    type="button"
                    className="px-cmd-btn cyan"
                    onClick={() => {
                      setShowRaiseChoices(false);
                      onNextHand();
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Swords size={14} aria-hidden="true" /> 下一局协议
                    </span>
                    <span className="cmd-sub-meta">第 #{state.handNumber + 1} 局</span>
                  </button>
                ) : (
                  <button
                    id="console-btn-match-over-restart"
                    type="button"
                    className="px-cmd-btn pink"
                    onClick={onRequestResetMatch}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <RotateCcw size={14} aria-hidden="true" />{' '}
                      {human.chips > 0 ? '完胜！重开' : '算力归零！重开'}
                    </span>
                    <span className="cmd-sub-meta">恢复 {state.config.startingChips}</span>
                  </button>
                )}

                <button
                  id="console-btn-reset-match"
                  type="button"
                  className="px-cmd-btn"
                  onClick={onRequestResetMatch}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <RotateCcw size={14} aria-hidden="true" /> 重置整场
                  </span>
                  <span className="cmd-sub-meta">恢复初始算力</span>
                </button>
              </div>
            </>
          ) : !isHumanTurn ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--neon-pink-300)',
                fontWeight: 800,
              }}
            >
              <Terminal size={15} aria-hidden="true" />
              <span>{ai.name} 正在发送牌桌指令...</span>
            </div>
          ) : showRaiseChoices && raiseRange.allowed ? (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <span>
                  <strong>选择加注档位</strong>
                  {diff > 0 ? `（含同步差额 +${paid}）` : ''}
                </span>
                <span className="cmd-sub-meta">
                  本段 {state.raisesInSubPhase}/{maxRaises} · 上限 {raiseCap}
                </span>
              </div>

              <div className="px-btn-grid">
                {raisePresets.map((amt, idx) => {
                  const tierLabels = ['轻度试探', '中幅施压', '满额上限'];
                  const label =
                    raisePresets.length === 1
                      ? '定额加注'
                      : tierLabels[idx] ?? `档位 ${idx + 1}`;
                  return (
                    <button
                      key={amt}
                      id={`raise-tier-btn-${idx}`}
                      type="button"
                      className="px-cmd-btn pink"
                      onClick={() => fireAction({ type: 'raise', amount: amt })}
                    >
                      <span>+{amt}</span>
                      <span className="cmd-sub-meta">{label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                id="raise-tier-btn-cancel"
                type="button"
                className="os-nav-btn"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowRaiseChoices(false)}
              >
                返回上一级指令
              </button>
            </>
          ) : diff > 0 ? (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <span>
                  遭遇加注 · 差额 <strong style={{ color: 'var(--neon-pink-300)' }}>{paid}</strong>
                </span>
                <span className="cmd-sub-meta">
                  {state.phase === 'river'
                    ? '河牌跟注即摊牌'
                    : willBeAllIn
                      ? '跟注即全下亮牌'
                      : '跟注不消耗动作'}
                </span>
              </div>

              <div className={`px-btn-grid ${raiseRange.allowed && !willBeAllIn ? '' : 'cols-2'}`}>
                <button
                  id="action-btn-call"
                  type="button"
                  className="px-cmd-btn cyan"
                  onClick={() => fireAction({ type: 'call' })}
                >
                  <span>
                    {state.phase === 'river'
                      ? `跟注摊牌 +${paid}`
                      : willBeAllIn
                        ? `全下跟注 +${paid}`
                        : `跟注 +${paid}`}
                  </span>
                  <span className="cmd-sub-meta">
                    {state.phase === 'river' || willBeAllIn ? '亮牌核验' : '保留行动权'}
                  </span>
                </button>

                {raiseRange.allowed && !willBeAllIn && (
                  <button
                    id="action-btn-open-reraise"
                    type="button"
                    className="px-cmd-btn pink"
                    onClick={() => setShowRaiseChoices(true)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={14} aria-hidden="true" /> 反加注
                    </span>
                    <span className="cmd-sub-meta">三档额度可选</span>
                  </button>
                )}

                <button
                  id="action-btn-fold"
                  type="button"
                  className="px-cmd-btn danger"
                  onClick={() => fireAction({ type: 'fold' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldOff size={14} aria-hidden="true" /> 弃牌断连
                  </span>
                  <span className="cmd-sub-meta">放弃奖池</span>
                </button>
              </div>
            </>
          ) : state.phase === 'river' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <span>终局河牌圈（0暗牌）</span>
                <span className="cmd-sub-meta">
                  加注 {state.raisesInSubPhase}/{maxRaises} · 上限 {raiseCap}
                </span>
              </div>

              <div className="px-btn-grid cols-2">
                <button
                  id="action-btn-river-check"
                  type="button"
                  className="px-cmd-btn cyan"
                  onClick={() => fireAction({ type: 'check' })}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Check size={14} aria-hidden="true" /> 静默过牌
                  </span>
                  <span className="cmd-sub-meta">0 算力</span>
                </button>

                <button
                  id="action-btn-river-open-raise"
                  type="button"
                  className="px-cmd-btn pink"
                  disabled={!raiseRange.allowed}
                  onClick={() => setShowRaiseChoices(true)}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Flame size={14} aria-hidden="true" /> 加注施压
                  </span>
                  <span className="cmd-sub-meta">
                    {raiseRange.allowed ? '三档额度选择' : '已达加注封顶'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11.5,
                }}
              >
                <span>
                  {selectedHandIndex !== null
                    ? `换牌待命：请点上方暗牌完成互换`
                    : state.justCalledThisTurn
                      ? '已补齐跟注：可点牌操作、加注或结束回合'
                      : '点暗牌直翻 / 点己方明牌再点暗牌互换'}
                </span>
                <span className="cmd-sub-meta">
                  加注 {state.raisesInSubPhase}/{maxRaises}
                </span>
              </div>

              <div
                className={`px-btn-grid ${
                  selectedHandIndex !== null || state.justCalledThisTurn ? 'cols-2' : 'cols-2'
                }`}
              >
                <button
                  id="action-btn-open-raise"
                  type="button"
                  className="px-cmd-btn pink"
                  disabled={!raiseRange.allowed}
                  onClick={() => {
                    onClearSelection();
                    setShowRaiseChoices(true);
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Flame size={14} aria-hidden="true" /> 加注施压
                  </span>
                  <span className="cmd-sub-meta">
                    {raiseRange.allowed
                      ? `三档可选（最高 +${raiseRange.max}）`
                      : '已达2次封顶（翻/换重置）'}
                  </span>
                </button>

                {selectedHandIndex !== null ? (
                  <button
                    id="action-btn-cancel-selected-card"
                    type="button"
                    className="px-cmd-btn"
                    onClick={onClearSelection}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <XCircle size={14} aria-hidden="true" /> 取消选中明牌
                    </span>
                    <span className="cmd-sub-meta">手牌 #{selectedHandIndex + 1}</span>
                  </button>
                ) : state.justCalledThisTurn ? (
                  <button
                    id="action-btn-end-turn"
                    type="button"
                    className="px-cmd-btn cyan"
                    onClick={() => fireAction({ type: 'end-turn' })}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ArrowRightCircle size={14} aria-hidden="true" /> 移交回合
                    </span>
                    <span className="cmd-sub-meta">仅保留跟注</span>
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '4px 6px',
                      background: '#0a1020',
                      border: '2px dashed #2e416e',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    <strong style={{ color: 'var(--neon-cyan-300)' }}>牌面直觉快捷区</strong>
                    <span>点暗牌=翻 · 点明再点暗=换</span>
                  </div>
                )}
              </div>
            </>
          )}
        </PixelWindow>
      </div>
    </>
  );
}
