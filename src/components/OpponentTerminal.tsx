import { Cpu, Flame, FolderOpen, Layers, UserCheck } from 'lucide-react';
import type {
  ContractExpression,
  GameState,
  VisibleHandSummary,
} from '../engine/types.ts';
import {
  CONTRACT_EXPRESSIONS,
  EXPRESSION_META,
  resolveCharacterPortrait,
  type ContractCharacter,
} from '../engine/contractCards.ts';
import { PixelWindow } from './PixelWindow.tsx';
import { CyberCard3D } from './CyberCard3D.tsx';

interface OpponentTerminalProps {
  state: GameState;
  character: ContractCharacter;
  opponentSummary: VisibleHandSummary;
  activeExpression: ContractExpression;
  overloadMode: boolean;
  isAiTurn: boolean;
  isAiThinking: boolean;
  llmEnabled: boolean;
  onSelectExpression: (expr: ContractExpression) => void;
  onToggleOverload: () => void;
  onOpenArchive: () => void;
}

/**
 * Top-Center Dual-Window Block:
 * 1) Left Window: Opponent's 3 Hand Cards + Live Hand Rank + Remaining Credits
 * 2) Center Window: Opponent Half-Body Portrait wrapped in a Pixel Windows Frame tinted with character.color!
 */
export function OpponentTerminal({
  state,
  character,
  opponentSummary,
  activeExpression,
  overloadMode,
  isAiTurn,
  isAiThinking,
  llmEnabled,
  onSelectExpression,
  onToggleOverload,
  onOpenArchive,
}: OpponentTerminalProps) {
  const ai = state.players.ai;
  const isShowdown = state.phase === 'showdown';
  const revealAll = isShowdown || state.config.revealOpponentHidden;
  const aiWinIds = new Set(state.result?.aiEval?.bestFive.map((c) => c.id) ?? []);
  const evt = state.lastAction;

  const portraitSrc = resolveCharacterPortrait(character, activeExpression, overloadMode);
  const exprMeta = EXPRESSION_META[activeExpression];
  const signatureColor = overloadMode ? '#FF4757' : character.color || '#FF2E88';

  return (
    <div className="opponent-top-deck" role="region" aria-label="对端手牌与角色立绘区">
      {/* LEFT OF PORTRAIT: Opponent's 3 Cards Window */}
      <PixelWindow
        title={`对端序列 · ${ai.name}`}
        code="OPP_DECK"
        accentColor="#26365e"
        icon={<Layers size={13} color="var(--neon-pink-300)" aria-hidden="true" />}
        activeGlow={isAiTurn}
        bodyClassName="opp-cards-win-body"
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11.5,
          }}
        >
          <span className="cyber-badge pink">
            牌型：{opponentSummary.label} · {opponentSummary.detail}
          </span>
          <span className="cyber-badge cyan">算力 {ai.chips}</span>
        </div>

        <div className="cards-row-flex">
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

        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>{ai.roundBet > 0 ? `本轮已注: ${ai.roundBet}` : '本轮待注'}</span>
          <span>已换牌: {ai.swapCount} 次</span>
        </div>
      </PixelWindow>

      {/* CENTER: Half-Body Opponent Portrait in Signature-Color Pixel Windows Frame */}
      <PixelWindow
        title={`${character.name} [${character.title}]`}
        code={character.codename}
        accentColor={signatureColor}
        icon={<UserCheck size={13} color="#ffffff" aria-hidden="true" />}
        activeGlow={isAiTurn}
        bodyClassName="opp-portrait-win-body"
      >
        <div className="px-portrait-stage">
          <div className="px-portrait-dither" />
          <img
            src={portraitSrc}
            alt={`${character.name}半身立绘（${exprMeta.label}表情）`}
            className="px-portrait-halfbody"
            width={380}
            height={190}
          />
          <div className="px-portrait-hud">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span className="cyber-badge pink">
                {isAiThinking ? '指令推演中...' : `${exprMeta.label} · ${exprMeta.cyberCode}`}
              </span>
              <span className={`cyber-badge ${llmEnabled ? 'cyan' : ''}`}>
                <Cpu size={11} aria-hidden="true" />
                {llmEnabled ? 'LLM在线' : '本地核'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
              <span
                style={{
                  background: 'rgba(5, 8, 17, 0.85)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  padding: '2px 6px',
                  fontSize: 11,
                  color: 'var(--frost-100)',
                  maxWidth: '72%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                「{character.quote}」
              </span>
              <span className="cyber-badge">{character.element}</span>
            </div>
          </div>
        </div>

        <div className="px-expr-bar">
          <div className="expression-strip" style={{ flex: 1 }} role="group" aria-label="切换角色表情差分">
            {CONTRACT_EXPRESSIONS.map((expr) => (
              <button
                key={expr}
                id={`opponent-expr-btn-${expr}`}
                type="button"
                className={`expr-chip-btn ${activeExpression === expr ? 'active' : ''}`}
                onClick={() => onSelectExpression(expr)}
                aria-pressed={activeExpression === expr}
              >
                {EXPRESSION_META[expr].label}
              </button>
            ))}
          </div>

          <button
            id="opponent-btn-toggle-overload"
            type="button"
            className={`os-nav-btn ${overloadMode ? 'highlight' : ''}`}
            style={{ minHeight: 24, padding: '2px 7px', fontSize: 11 }}
            onClick={onToggleOverload}
            aria-pressed={overloadMode}
            title="切换深层过载人格与差分"
          >
            <Flame size={12} aria-hidden="true" />
            过载
          </button>

          <button
            id="opponent-btn-open-contracts"
            type="button"
            className="os-nav-btn"
            style={{ minHeight: 24, padding: '2px 7px', fontSize: 11 }}
            onClick={onOpenArchive}
            title="从夜糖契约档案库切换对手"
          >
            <FolderOpen size={12} aria-hidden="true" />
            换人
          </button>
        </div>
      </PixelWindow>
    </div>
  );
}
