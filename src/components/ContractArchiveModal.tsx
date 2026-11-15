import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, FileUp, Search, Sparkles, UserCheck, Users, X } from 'lucide-react';
import type { ContractExpression } from '../engine/types.ts';
import {
  CONTRACT_EXPRESSIONS,
  EXPRESSION_META,
  resolveCharacterPortrait,
  type ContractCardSummary,
  type ContractCharacter,
} from '../engine/contractCards.ts';

interface ContractArchiveModalProps {
  catalog: ContractCardSummary[];
  catalogSource: 'api' | 'static' | 'fallback';
  activeCharacter: ContractCharacter;
  isLoadingCard: boolean;
  onSelectCardFile: (fileName: string) => void;
  onImportJsonText: (rawJson: string, fileName: string) => void;
  onClose: () => void;
}

export default function ContractArchiveModal({
  catalog,
  catalogSource,
  activeCharacter,
  isLoadingCard,
  onSelectCardFile,
  onImportJsonText,
  onClose,
}: ContractArchiveModalProps) {
  const [tab, setTab] = useState<'roster' | 'dossier'>('roster');
  const [query, setQuery] = useState('');
  const [previewExpr, setPreviewExpr] = useState<ContractExpression>('calm');
  const [previewOverload, setPreviewOverload] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.codename.toLowerCase().includes(q) ||
        c.element.toLowerCase().includes(q)
    );
  }, [catalog, query]);

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contracts-modal-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <Users size={15} color="var(--accent-primary)" aria-hidden="true" />
            <span id="contracts-modal-title">
              夜糖事务所 · 契约档案接入库（共 {catalog.length} 名特工）
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cyber-badge cyan">
              {catalogSource === 'api'
                ? '直连 night-sugar-office 全量库'
                : catalogSource === 'static'
                  ? '内置精选契约包'
                  : '离线应急档案'}
            </span>
            <button
              id="contracts-modal-btn-close"
              type="button"
              className="os-nav-btn"
              onClick={onClose}
              aria-label="关闭契约档案库"
            >
              <X size={15} aria-hidden="true" />
              关闭
            </button>
          </div>
        </div>

        <div className="modal-tab-strip" role="tablist">
          <button
            id="contracts-tab-roster"
            type="button"
            role="tab"
            aria-selected={tab === 'roster'}
            className={`modal-tab-btn ${tab === 'roster' ? 'active' : ''}`}
            onClick={() => setTab('roster')}
          >
            <Users size={14} aria-hidden="true" />
            契约对手名册 ({catalog.length})
          </button>
          <button
            id="contracts-tab-dossier"
            type="button"
            role="tab"
            aria-selected={tab === 'dossier'}
            className={`modal-tab-btn ${tab === 'dossier' ? 'active' : ''}`}
            onClick={() => setTab('dossier')}
          >
            <UserCheck size={14} aria-hidden="true" />
            当前对手深度档案 · {activeCharacter.name}
          </button>
        </div>

        <div className="modal-content-scroll">
          {tab === 'roster' ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search
                    size={14}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: 10, top: 11 }}
                    aria-hidden="true"
                  />
                  <input
                    id="contracts-input-search"
                    type="search"
                    className="cyber-text-input"
                    style={{ width: '100%', paddingLeft: 32 }}
                    placeholder="检索角色姓名、代号、称号或属性系别..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="搜索契约角色"
                  />
                </div>

                <input
                  ref={fileInputRef}
                  id="contracts-input-import-file"
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    onImportJsonText(text, file.name);
                    e.target.value = '';
                  }}
                />
                <button
                  id="contracts-btn-import-json"
                  type="button"
                  className="os-nav-btn highlight"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp size={14} aria-hidden="true" />
                  导入契约卡 (.json)
                </button>
              </div>

              {isLoadingCard && (
                <div className="cyber-panel-box" style={{ borderColor: 'var(--accent-telemetry)' }}>
                  正在从契约库解码高分辨率立绘与六态表情差分数据，请稍候...
                </div>
              )}

              <div className="contract-roster-grid">
                {filtered.map((item, idx) => {
                  const isCurrent = item.fileName === activeCharacter.fileName;
                  return (
                    <button
                      key={item.fileName}
                      id={`roster-select-card-${idx}`}
                      type="button"
                      className={`roster-card-btn ${isCurrent ? 'selected' : ''}`}
                      disabled={isLoadingCard}
                      onClick={() => onSelectCardFile(item.fileName)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 15, color: '#ffffff' }}>{item.name}</strong>
                        {isCurrent ? (
                          <span className="cyber-badge pink">
                            <Check size={11} aria-hidden="true" /> 对战中
                          </span>
                        ) : (
                          <span className="cyber-badge">{item.element}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--neon-pink-300)' }}>
                        {item.title} · {item.codename}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--text-muted)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: 34,
                        }}
                      >
                        {item.quote || '暂无公开宣言'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: 4,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                          color: 'var(--accent-telemetry)',
                        }}
                      >
                        <span>洞察 {item.stats.insight} / 魔力 {item.stats.magic}</span>
                        <span>表情差分 x{item.expressionCount}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="dossier-split-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  className="px-portrait-stage"
                  style={
                    {
                      height: 300,
                      '--win-accent': previewOverload
                        ? '#FF4757'
                        : activeCharacter.color || '#FF2E88',
                    } as CSSProperties
                  }
                >
                  <div className="px-portrait-dither" />
                  <img
                    src={resolveCharacterPortrait(activeCharacter, previewExpr, previewOverload)}
                    alt={`${activeCharacter.name}档案预览`}
                    className="px-portrait-halfbody"
                    style={{ maxHeight: 296 }}
                  />
                </div>
                <div className="expression-strip">
                  {CONTRACT_EXPRESSIONS.map((expr) => (
                    <button
                      key={expr}
                      id={`dossier-preview-expr-${expr}`}
                      type="button"
                      className={`expr-chip-btn ${previewExpr === expr ? 'active' : ''}`}
                      onClick={() => setPreviewExpr(expr)}
                    >
                      {EXPRESSION_META[expr].label}
                    </button>
                  ))}
                </div>
                {(activeCharacter.witchPersonality || activeCharacter.witchPortrait || Object.keys(activeCharacter.variants).some((k) => k.startsWith('witchform:'))) && (
                  <button
                    id="dossier-btn-toggle-overload-preview"
                    type="button"
                    className={`os-nav-btn ${previewOverload ? 'highlight' : ''}`}
                    style={{ justifyContent: 'center' }}
                    onClick={() => setPreviewOverload((p) => !p)}
                  >
                    {previewOverload ? '当前：虚拟实体形象（魔女化）' : '当前：现实形象（契约礼装）'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="cyber-panel-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18 }}>
                        {activeCharacter.name} · {activeCharacter.title}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--accent-telemetry)' }}>
                        代号：{activeCharacter.codename} ｜ 定位：{activeCharacter.archetype} ｜ 系别：
                        {activeCharacter.element}
                      </div>
                    </div>
                  </div>
                  <div className="char-quote-box">「{activeCharacter.quote}」</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>行动目标：</strong>
                    {activeCharacter.goal}
                  </div>
                </div>

                <div className="cyber-panel-box">
                  <strong style={{ fontSize: 13, color: 'var(--neon-pink-300)' }}>
                    {previewOverload && activeCharacter.witchPersonality
                      ? '深层过载态心理侧写'
                      : '常态性格与外貌特征'}
                  </strong>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {previewOverload && activeCharacter.witchPersonality
                      ? activeCharacter.witchPersonality
                      : activeCharacter.personality}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.55 }}>
                    外貌礼装：{activeCharacter.appearance}
                  </p>
                </div>

                {activeCharacter.traits.length > 0 && (
                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--accent-telemetry)' }}>固有契约特性</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeCharacter.traits.map((t) => (
                        <div key={t.id} style={{ fontSize: 12.5 }}>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>
                            <Sparkles size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} aria-hidden="true" />
                            {t.name}：
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{t.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeCharacter.voice && activeCharacter.voice.samples.length > 0 && (
                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--accent-success)' }}>角色原声语料样本</strong>
                    {activeCharacter.voice.samples.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        • 「{s}」
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
