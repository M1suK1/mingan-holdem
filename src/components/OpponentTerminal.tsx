import { Cpu, Flame, FolderOpen, Sparkles, UserCheck } from 'lucide-react';
import type { ContractExpression } from '../engine/types.ts';
import {
  CONTRACT_EXPRESSIONS,
  EXPRESSION_META,
  resolveCharacterPortrait,
  type ContractCharacter,
} from '../engine/contractCards.ts';

interface OpponentTerminalProps {
  character: ContractCharacter;
  activeExpression: ContractExpression;
  overloadMode: boolean;
  isAiTurn: boolean;
  isAiThinking: boolean;
  llmEnabled: boolean;
  onSelectExpression: (expr: ContractExpression) => void;
  onToggleOverload: () => void;
  onOpenArchive: () => void;
}

export function OpponentTerminal({
  character,
  activeExpression,
  overloadMode,
  isAiTurn,
  isAiThinking,
  llmEnabled,
  onSelectExpression,
  onToggleOverload,
  onOpenArchive,
}: OpponentTerminalProps) {
  const portraitSrc = resolveCharacterPortrait(character, activeExpression, overloadMode);
  const exprMeta = EXPRESSION_META[activeExpression];

  return (
    <aside
      className={`cyber-window ${isAiTurn ? 'active-turn-window' : ''}`}
      aria-label="契约对手监控窗口"
    >
      <div className="window-titlebar">
        <div className="window-title-left">
          <span className="win-dots" aria-hidden="true">
            <span className="win-dot pink" />
            <span className="win-dot cyan" />
          </span>
          <UserCheck size={14} color="var(--accent-primary)" aria-hidden="true" />
          <span>契约对手显像</span>
        </div>
        <span className="win-pid">WIN://OPPONENT_LINK</span>
      </div>

      <div className="opponent-window-body">
        <div className={`portrait-viewport ${overloadMode ? 'overload' : ''}`}>
          <img
            src={portraitSrc}
            alt={`${character.name}（${exprMeta.label}表情）`}
            className="opponent-portrait-img"
            width={268}
            height={256}
          />
          <div className="portrait-hud-overlay">
            <div className="portrait-top-tags">
              <span className="cyber-badge pink">
                {isAiThinking ? '指令推演中...' : `${exprMeta.label} // ${exprMeta.cyberCode}`}
              </span>
              <span className={`cyber-badge ${llmEnabled ? 'cyan' : ''}`}>
                <Cpu size={11} aria-hidden="true" />
                {llmEnabled ? 'LLM在线' : '本地核'}
              </span>
            </div>

            <div className="portrait-bottom-name">
              <div className="char-name-title">
                <h2>{character.name}</h2>
                <p>
                  {character.title} · {character.codename}
                </p>
              </div>
              <span className="cyber-badge">{character.element}</span>
            </div>
          </div>
        </div>

        {/* 6-Expression Live Switcher / Inspector */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <span>表情差分实时显像（随战况切换）</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {exprMeta.desc.slice(0, 12)}
            </span>
          </div>
          <div className="expression-strip" role="group" aria-label="对手表情差分切换">
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
        </div>

        {/* 4D Stats from Night-Sugar-Office Contract Card */}
        <div className="char-stat-mini-grid" aria-label="契约角色四维能力">
          <div className="stat-mini-cell">
            <span>魔力负荷</span>
            <span className="stat-mini-val">{character.stats.magic}</span>
          </div>
          <div className="stat-mini-cell">
            <span>数据洞察</span>
            <span className="stat-mini-val">{character.stats.insight}</span>
          </div>
          <div className="stat-mini-cell">
            <span>响应敏捷</span>
            <span className="stat-mini-val">{character.stats.agility}</span>
          </div>
          <div className="stat-mini-cell">
            <span>心防共感</span>
            <span className="stat-mini-val">{character.stats.empathy}</span>
          </div>
        </div>

        {/* Quote & Primary Trait */}
        <div className="char-quote-box">「{character.quote}」</div>

        {character.traits.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {character.traits.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className={`cyber-badge ${t.polarity === 'positive' ? 'cyan' : 'pink'}`}
                title={t.description}
              >
                <Sparkles size={11} aria-hidden="true" />
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Controls: Overload Persona & Switch Contract Card */}
        <div className="cmd-grid cols-2" style={{ marginTop: 'auto' }}>
          <button
            id="opponent-btn-toggle-overload"
            type="button"
            className={`os-nav-btn ${overloadMode ? 'highlight' : ''}`}
            style={{ justifyContent: 'center' }}
            onClick={onToggleOverload}
            aria-pressed={overloadMode}
          >
            <Flame size={14} aria-hidden="true" />
            {overloadMode ? '过载态已激活' : '切换过载人格'}
          </button>

          <button
            id="opponent-btn-open-contracts"
            type="button"
            className="os-nav-btn"
            style={{ justifyContent: 'center' }}
            onClick={onOpenArchive}
          >
            <FolderOpen size={14} aria-hidden="true" />
            更换契约对手
          </button>
        </div>
      </div>
    </aside>
  );
}
