import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CopyPlus,
  Download,
  FilePlus2,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CampaignState, PursuerDossier } from '../engine/types.ts';
import type { ContractCharacter } from '../engine/contractCards.ts';
import {
  CONTRACT_PROMPTS,
  PROMPT_MACRO_HINTS,
  PROMPT_SCOPES,
  builtinPresets,
  duplicatePreset,
  exportPresetJson,
  importPresetJson,
  type ChatPreset,
  type PromptEntry,
  type PromptRole,
  type PromptScope,
} from '../engine/presets.ts';
import {
  WORLDBOOK_BUDGET,
  builtinWorldbook,
  exportWorldbookJson,
  importWorldbookJson,
  syncDynamicWorldbookEntries,
  worldbookContext,
  type WorldbookEntry,
} from '../engine/worldbook.ts';

interface PresetWorldbookModalProps {
  initialSection?: 'preset' | 'worldbook';
  presets: ChatPreset[];
  activePresetId: string;
  worldbook: WorldbookEntry[];
  campaign: CampaignState;
  character: ContractCharacter;
  dossier: PursuerDossier;
  onUpdatePresets: (next: ChatPreset[], activeId?: string) => void;
  onUpdateWorldbook: (next: WorldbookEntry[]) => void;
  onNotify: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onClose: () => void;
}

export default function PresetWorldbookModal({
  initialSection = 'preset',
  presets,
  activePresetId,
  worldbook,
  campaign,
  character,
  dossier,
  onUpdatePresets,
  onUpdateWorldbook,
  onNotify,
  onClose,
}: PresetWorldbookModalProps) {
  const [section, setSection] = useState<'preset' | 'worldbook'>(initialSection);
  const [scopeFilter, setScopeFilter] = useState<PromptScope | 'all'>('all');
  const [activeEntryId, setActiveEntryId] = useState<string>('');
  const [wbActiveId, setWbActiveId] = useState<string>(worldbook[0]?.id ?? '');
  const [wbTrigger, setWbTrigger] = useState<string>('虚拟实体 诱饵 技能池 黑客改牌 扫描');
  const presetFileRef = useRef<HTMLInputElement | null>(null);
  const wbFileRef = useRef<HTMLInputElement | null>(null);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) ?? presets[0],
    [presets, activePresetId]
  );
  const isEditable = Boolean(activePreset && !activePreset.builtin);

  const syncedWorldbook = useMemo(
    () => syncDynamicWorldbookEntries(worldbook, campaign, character, dossier),
    [worldbook, campaign, character, dossier]
  );
  const activeWb = useMemo(
    () => syncedWorldbook.find((e) => e.id === wbActiveId) ?? syncedWorldbook[0],
    [syncedWorldbook, wbActiveId]
  );

  const wbBaseContext = useMemo(
    () => worldbookContext('', syncedWorldbook, activePreset?.settings.worldbookBudget ?? WORLDBOOK_BUDGET),
    [syncedWorldbook, activePreset]
  );
  const wbPreviewContext = useMemo(
    () => worldbookContext(wbTrigger, syncedWorldbook, activePreset?.settings.worldbookBudget ?? WORLDBOOK_BUDGET),
    [wbTrigger, syncedWorldbook, activePreset]
  );

  const visibleEntries = useMemo(() => {
    if (!activePreset) return [];
    return activePreset.prompts
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => scopeFilter === 'all' || entry.scope === scopeFilter);
  }, [activePreset, scopeFilter]);

  const replacePreset = (next: ChatPreset) => {
    onUpdatePresets(
      presets.map((p) => (p.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : p)),
      next.id
    );
  };

  const patchPromptEntry = (entryId: string, patch: Partial<PromptEntry>) => {
    if (!activePreset || !isEditable) return;
    replacePreset({
      ...activePreset,
      prompts: activePreset.prompts.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    });
  };

  const movePromptEntry = (idx: number, delta: number) => {
    if (!activePreset || !isEditable) return;
    const target = idx + delta;
    if (target < 0 || target >= activePreset.prompts.length) return;
    const next = [...activePreset.prompts];
    [next[idx], next[target]] = [next[target], next[idx]];
    replacePreset({ ...activePreset, prompts: next });
  };

  const addPromptEntry = () => {
    if (!activePreset || !isEditable) return;
    const newId = `custom-entry-${Date.now().toString(36)}`;
    const scope: PromptScope = scopeFilter === 'all' ? 'shared' : scopeFilter;
    const nextEntry: PromptEntry = {
      id: newId,
      name: '新增指令词条',
      scope,
      role: 'system',
      enabled: true,
      content: '在此编写自定义扮演约束或战术提示，可插入 {{char}} / {{worldbook}} 等宏变量。',
    };
    replacePreset({ ...activePreset, prompts: [...activePreset.prompts, nextEntry] });
    setActiveEntryId(newId);
  };

  const insertMacroIntoActive = (macroKey: string) => {
    if (!activePreset || !isEditable) return;
    const target =
      activePreset.prompts.find((e) => e.id === activeEntryId) ??
      visibleEntries.find((v) => !v.entry.contract && v.entry.enabled)?.entry;
    if (!target) {
      onNotify('warn', '请先在下方选中一条可编辑的提示词词条');
      return;
    }
    const suffix = target.content.endsWith('\n') || !target.content ? '' : '\n';
    patchPromptEntry(target.id, { content: `${target.content}${suffix}{{${macroKey}}}` });
  };

  const handleDuplicatePreset = () => {
    if (!activePreset) return;
    const copy = duplicatePreset(activePreset);
    onUpdatePresets([...presets, copy], copy.id);
    onNotify('success', `已复制预设「${copy.name}」`, '副本支持完全自由编辑');
  };

  const handleDeletePreset = () => {
    if (!activePreset || activePreset.builtin || presets.length <= 1) return;
    const remaining = presets.filter((p) => p.id !== activePreset.id);
    onUpdatePresets(remaining, remaining[0].id);
    onNotify('info', `已删除预设「${activePreset.name}」`);
  };

  const handleResetBuiltinPreset = () => {
    if (!activePreset || !isEditable) return;
    const factory = builtinPresets()[0];
    replacePreset({
      ...activePreset,
      settings: { ...factory.settings },
      prompts: factory.prompts.map((e) => ({ ...e })),
    });
    onNotify('success', '已恢复当前预设为出厂黑域协议默认词条');
  };

  const handleImportPreset = async (file: File) => {
    const text = await file.text();
    const res = importPresetJson(text);
    if (!res.ok || !res.preset) {
      onNotify('error', '预设导入失败', res.message);
      return;
    }
    onUpdatePresets([...presets, res.preset], res.preset.id);
    onNotify('success', res.message);
  };

  const handleExportPreset = () => {
    if (!activePreset) return;
    const blob = new Blob([exportPresetJson(activePreset)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `黑域协议-预设-${activePreset.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', '预设已导出为 SillyTavern 兼容 JSON');
  };

  const patchWbEntry = (id: string, patch: Partial<WorldbookEntry>) => {
    const next = syncedWorldbook
      .filter((e) => !e.generated)
      .map((e) => (e.id === id ? { ...e, ...patch } : e));
    onUpdateWorldbook(next);
  };

  const addWbEntry = () => {
    const id = `wb-user-${Date.now().toString(36)}`;
    const nextEntry: WorldbookEntry = {
      id,
      name: '新世界观词条',
      keys: ['关键词'],
      content: '在此输入触发该关键词后注入 LLM 的黑域背景设定。',
      enabled: true,
      constant: false,
      priority: 65,
      order: syncedWorldbook.length + 1,
    };
    onUpdateWorldbook([...syncedWorldbook.filter((e) => !e.generated), nextEntry]);
    setWbActiveId(id);
  };

  const deleteWbEntry = (id: string) => {
    const next = syncedWorldbook.filter((e) => !e.generated && e.id !== id);
    onUpdateWorldbook(next);
    setWbActiveId(next[0]?.id ?? '');
  };

  const handleImportWb = async (file: File) => {
    const text = await file.text();
    const res = importWorldbookJson(text);
    if (!res.ok || !res.entries) {
      onNotify('error', '世界书导入失败', res.message);
      return;
    }
    onUpdateWorldbook(res.entries.filter((e) => !e.generated));
    setWbActiveId(res.entries[0]?.id ?? '');
    onNotify('success', res.message);
  };

  const handleExportWb = () => {
    const blob = new Blob([exportWorldbookJson(syncedWorldbook)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '黑域协议-世界书.json';
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', '世界书已导出为 SillyTavern 兼容 JSON');
  };

  const totalPresetTokens = useMemo(() => {
    if (!activePreset) return 0;
    return activePreset.prompts
      .filter((p) => p.enabled && !p.marker)
      .reduce((sum, p) => sum + Math.ceil(p.content.length / 2), 0);
  }, [activePreset]);

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwb-modal-title"
    >
      <div className="cyber-modal-window lc-pwb-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <BookOpen size={15} color="var(--neon-cyan)" aria-hidden="true" />
            <span id="pwb-modal-title">
              黑域叙事内核 // 可编辑预设与世界书注入（SillyTavern 兼容）
            </span>
          </div>
          <button
            id="pwb-btn-close"
            type="button"
            className="os-nav-btn"
            onClick={onClose}
            aria-label="关闭预设与世界书窗口"
          >
            <X size={15} aria-hidden="true" />
            关闭
          </button>
        </div>

        <div className="modal-tab-strip" role="tablist">
          <button
            id="pwb-tab-preset"
            type="button"
            role="tab"
            aria-selected={section === 'preset'}
            className={`modal-tab-btn ${section === 'preset' ? 'active' : ''}`}
            onClick={() => setSection('preset')}
          >
            <Sliders size={14} aria-hidden="true" />
            对话与决策预设 ({activePreset?.prompts.length ?? 0} 词条)
          </button>
          <button
            id="pwb-tab-worldbook"
            type="button"
            role="tab"
            aria-selected={section === 'worldbook'}
            className={`modal-tab-btn ${section === 'worldbook' ? 'active' : ''}`}
            onClick={() => setSection('worldbook')}
          >
            <BookOpen size={14} aria-hidden="true" />
            世界书注入库 ({syncedWorldbook.length} 词条 · 常驻 {wbBaseContext.hits.length})
          </button>
        </div>

        <div className="modal-content-scroll">
          {section === 'preset' && activePreset && (
            <>
              <div className="cyber-panel-box">
                <div className="lc-pwb-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    <label htmlFor="pwb-select-preset" style={{ fontSize: 12, fontWeight: 700 }}>
                      当前激活预设：
                    </label>
                    <select
                      id="pwb-select-preset"
                      className="cyber-select"
                      value={activePreset.id}
                      onChange={(e) => onUpdatePresets(presets, e.target.value)}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.builtin ? '[只读底稿]' : '[可编辑]'}
                        </option>
                      ))}
                    </select>
                    <span className="cyber-badge cyan">约 {totalPresetTokens} Tokens</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      id="pwb-btn-dup-preset"
                      type="button"
                      className="os-nav-btn"
                      onClick={handleDuplicatePreset}
                    >
                      <CopyPlus size={13} aria-hidden="true" />
                      复制为可改
                    </button>
                    {isEditable && (
                      <button
                        id="pwb-btn-reset-preset"
                        type="button"
                        className="os-nav-btn"
                        onClick={handleResetBuiltinPreset}
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        恢复默认
                      </button>
                    )}
                    {isEditable && presets.length > 1 && (
                      <button
                        id="pwb-btn-delete-preset"
                        type="button"
                        className="os-nav-btn"
                        onClick={handleDeletePreset}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        删除
                      </button>
                    )}
                    <input
                      ref={presetFileRef}
                      id="pwb-input-import-preset"
                      type="file"
                      accept=".json,application/json"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportPreset(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      id="pwb-btn-import-preset"
                      type="button"
                      className="os-nav-btn"
                      onClick={() => presetFileRef.current?.click()}
                    >
                      <Upload size={13} aria-hidden="true" />
                      导入 ST 预设
                    </button>
                    <button
                      id="pwb-btn-export-preset"
                      type="button"
                      className="os-nav-btn"
                      onClick={handleExportPreset}
                    >
                      <Download size={13} aria-hidden="true" />
                      导出
                    </button>
                  </div>
                </div>

                {!isEditable && (
                  <div className="lc-pwb-readonly-note">
                    当前选中为出厂只读底稿。请切换到「可编辑」预设或点击右上角「复制为可改」以自由修改。
                  </div>
                )}

                <div className="lc-pwb-sampling-grid">
                  <label className="lc-pwb-param">
                    <span>预设名称</span>
                    <input
                      id="pwb-input-preset-name"
                      type="text"
                      className="cyber-text-input"
                      disabled={!isEditable}
                      value={activePreset.name}
                      onChange={(e) => replacePreset({ ...activePreset, name: e.target.value })}
                    />
                  </label>
                  <label className="lc-pwb-param">
                    <span>发散温度 ({activePreset.settings.temperature.toFixed(2)})</span>
                    <input
                      id="pwb-input-temp"
                      type="range"
                      min={0}
                      max={1.6}
                      step={0.05}
                      disabled={!isEditable}
                      value={activePreset.settings.temperature}
                      onChange={(e) =>
                        replacePreset({
                          ...activePreset,
                          settings: { ...activePreset.settings, temperature: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="lc-pwb-param">
                    <span>Top-P ({activePreset.settings.topP.toFixed(2)})</span>
                    <input
                      id="pwb-input-topp"
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.02}
                      disabled={!isEditable}
                      value={activePreset.settings.topP}
                      onChange={(e) =>
                        replacePreset({
                          ...activePreset,
                          settings: { ...activePreset.settings, topP: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="lc-pwb-param">
                    <span>最大输出 Tokens</span>
                    <input
                      id="pwb-input-max-tokens"
                      type="number"
                      min={128}
                      max={16384}
                      step={64}
                      className="cyber-text-input"
                      disabled={!isEditable}
                      value={activePreset.settings.maxTokens}
                      onChange={(e) =>
                        replacePreset({
                          ...activePreset,
                          settings: {
                            ...activePreset.settings,
                            maxTokens: Math.max(128, Number(e.target.value) || 1024),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="lc-pwb-param">
                    <span>世界书预算字数</span>
                    <input
                      id="pwb-input-wb-budget"
                      type="number"
                      min={400}
                      max={8000}
                      step={100}
                      className="cyber-text-input"
                      disabled={!isEditable}
                      value={activePreset.settings.worldbookBudget ?? WORLDBOOK_BUDGET}
                      onChange={(e) =>
                        replacePreset({
                          ...activePreset,
                          settings: {
                            ...activePreset.settings,
                            worldbookBudget: Math.max(400, Number(e.target.value) || WORLDBOOK_BUDGET),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="lc-pwb-param inline">
                    <input
                      id="pwb-check-thinking"
                      type="checkbox"
                      disabled={!isEditable}
                      checked={activePreset.settings.thinking}
                      onChange={(e) =>
                        replacePreset({
                          ...activePreset,
                          settings: { ...activePreset.settings, thinking: e.target.checked },
                        })
                      }
                    />
                    <span>启用 Vertex 思维链回传</span>
                  </label>
                </div>
              </div>

              <div className="cyber-panel-box">
                <div className="lc-pwb-toolbar">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      id="pwb-scope-all"
                      type="button"
                      className={`expr-chip-btn ${scopeFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setScopeFilter('all')}
                    >
                      全部用途 ({activePreset.prompts.length})
                    </button>
                    {PROMPT_SCOPES.map((sc) => (
                      <button
                        key={sc.id}
                        id={`pwb-scope-${sc.id}`}
                        type="button"
                        className={`expr-chip-btn ${scopeFilter === sc.id ? 'active' : ''}`}
                        onClick={() => setScopeFilter(sc.id)}
                        title={sc.hint}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                  {isEditable && (
                    <button
                      id="pwb-btn-add-entry"
                      type="button"
                      className="os-nav-btn highlight"
                      onClick={addPromptEntry}
                    >
                      <FilePlus2 size={13} aria-hidden="true" />
                      新增词条
                    </button>
                  )}
                </div>

                <div className="lc-pwb-macro-strip">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>点击插入宏变量：</span>
                  {PROMPT_MACRO_HINTS.map((m) => (
                    <button
                      key={m.key}
                      id={`pwb-macro-btn-${m.key}`}
                      type="button"
                      className="lc-macro-chip"
                      disabled={!isEditable}
                      onClick={() => insertMacroIntoActive(m.key)}
                      title={m.hint}
                    >
                      {`{{${m.key}}}`} · {m.label}
                    </button>
                  ))}
                </div>

                <div className="lc-pwb-entries-list">
                  {visibleEntries.map(({ entry, idx }) => (
                    <div
                      key={entry.id}
                      className={`lc-pwb-entry-card ${entry.contract ? 'is-contract' : ''} ${
                        activeEntryId === entry.id ? 'is-focused' : ''
                      }`}
                    >
                      <div className="lc-pwb-entry-head">
                        <input
                          id={`pwb-entry-enable-${idx}`}
                          type="checkbox"
                          disabled={!isEditable}
                          checked={entry.enabled}
                          onChange={(e) => patchPromptEntry(entry.id, { enabled: e.target.checked })}
                          aria-label={`启用词条 ${entry.name}`}
                        />
                        <input
                          id={`pwb-entry-name-${idx}`}
                          type="text"
                          className="cyber-text-input"
                          style={{ flex: 1, minWidth: 130 }}
                          disabled={!isEditable}
                          value={entry.name}
                          onChange={(e) => patchPromptEntry(entry.id, { name: e.target.value })}
                          aria-label="词条名称"
                        />
                        <select
                          id={`pwb-entry-role-${idx}`}
                          className="cyber-select"
                          disabled={!isEditable || Boolean(entry.contract)}
                          value={entry.role}
                          onChange={(e) =>
                            patchPromptEntry(entry.id, { role: e.target.value as PromptRole })
                          }
                          aria-label="词条角色"
                        >
                          <option value="system">SYSTEM</option>
                          <option value="user">USER</option>
                          <option value="assistant">ASSISTANT</option>
                        </select>
                        <select
                          id={`pwb-entry-scope-${idx}`}
                          className="cyber-select"
                          disabled={!isEditable || Boolean(entry.contract)}
                          value={entry.scope}
                          onChange={(e) =>
                            patchPromptEntry(entry.id, { scope: e.target.value as PromptScope })
                          }
                          aria-label="词条用途"
                        >
                          {PROMPT_SCOPES.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.label}
                            </option>
                          ))}
                        </select>
                        {entry.contract && (
                          <span className="cyber-badge pink">结构契约 · 末尾注入</span>
                        )}
                        {isEditable && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              id={`pwb-entry-up-${idx}`}
                              type="button"
                              className="os-nav-btn"
                              disabled={idx === 0}
                              onClick={() => movePromptEntry(idx, -1)}
                              aria-label="上移词条"
                            >
                              <ArrowUp size={12} aria-hidden="true" />
                            </button>
                            <button
                              id={`pwb-entry-down-${idx}`}
                              type="button"
                              className="os-nav-btn"
                              disabled={idx === activePreset.prompts.length - 1}
                              onClick={() => movePromptEntry(idx, 1)}
                              aria-label="下移词条"
                            >
                              <ArrowDown size={12} aria-hidden="true" />
                            </button>
                            {!entry.contract && (
                              <button
                                id={`pwb-entry-del-${idx}`}
                                type="button"
                                className="os-nav-btn"
                                onClick={() =>
                                  replacePreset({
                                    ...activePreset,
                                    prompts: activePreset.prompts.filter((p) => p.id !== entry.id),
                                  })
                                }
                                aria-label="删除词条"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <textarea
                        id={`pwb-entry-content-${idx}`}
                        rows={entry.contract ? 2 : 3}
                        className="cyber-text-input"
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}
                        disabled={!isEditable}
                        value={entry.content}
                        onFocus={() => setActiveEntryId(entry.id)}
                        onChange={(e) => patchPromptEntry(entry.id, { content: e.target.value })}
                        aria-label={`编辑词条内容 ${entry.name}`}
                      />
                      {entry.contract && CONTRACT_PROMPTS.some((c) => c.id === entry.id) && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>
                          注：契约词条锁定排在最后一段发送，以保障程序能稳定解析 JSON 动作与台词。
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'worldbook' && (
            <div className="lc-wb-grid">
              <div className="cyber-panel-box">
                <div className="lc-pwb-toolbar">
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    常驻注入：{wbBaseContext.tokens} / {activePreset?.settings.worldbookBudget ?? WORLDBOOK_BUDGET} 字符
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      id="wb-btn-new-entry"
                      type="button"
                      className="os-nav-btn highlight"
                      onClick={addWbEntry}
                    >
                      <FilePlus2 size={12} aria-hidden="true" />
                      新建
                    </button>
                    <button
                      id="wb-btn-reset-builtin"
                      type="button"
                      className="os-nav-btn"
                      onClick={() => {
                        const builtins = builtinWorldbook();
                        onUpdateWorldbook(builtins);
                        setWbActiveId(builtins[0].id);
                        onNotify('info', '已恢复内置黑域世界书词条');
                      }}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      恢复
                    </button>
                  </div>
                </div>

                <div className="lc-wb-list">
                  {syncedWorldbook.map((item, idx) => (
                    <button
                      key={item.id}
                      id={`wb-list-item-${idx}`}
                      type="button"
                      className={`lc-wb-item-btn ${item.id === activeWb?.id ? 'active' : ''} ${
                        !item.enabled ? 'is-off' : ''
                      }`}
                      onClick={() => setWbActiveId(item.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <strong>{item.name}</strong>
                        <span className={`cyber-badge ${item.constant ? 'cyan' : 'pink'}`}>
                          {item.generated ? '动态同步' : item.constant ? '常驻' : `${item.keys.length} 词`}
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-subtle)' }}>
                        P{item.priority} · {item.enabled ? '已启用' : '已停用'}
                      </small>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    ref={wbFileRef}
                    id="wb-input-import-file"
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportWb(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    id="wb-btn-import"
                    type="button"
                    className="os-nav-btn"
                    onClick={() => wbFileRef.current?.click()}
                  >
                    <Upload size={12} aria-hidden="true" />
                    导入 ST 世界书
                  </button>
                  <button
                    id="wb-btn-export"
                    type="button"
                    className="os-nav-btn"
                    onClick={handleExportWb}
                  >
                    <Download size={12} aria-hidden="true" />
                    导出世界书
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeWb && (
                  <div className="cyber-panel-box">
                    {activeWb.generated ? (
                      <div className="lc-pwb-readonly-note">
                        <Sparkles size={13} aria-hidden="true" /> 此条目由当前通缉黑客档案与追捕者身份实时同步生成，对战时自动更新并常驻注入。
                      </div>
                    ) : null}

                    <div className="lc-pwb-toolbar">
                      <input
                        id="wb-editor-name"
                        type="text"
                        className="cyber-text-input"
                        style={{ flex: 1 }}
                        disabled={Boolean(activeWb.generated)}
                        value={activeWb.name}
                        onChange={(e) => patchWbEntry(activeWb.id, { name: e.target.value })}
                        aria-label="世界书词条名称"
                      />
                      <label className="lc-pwb-param inline">
                        <input
                          id="wb-editor-enabled"
                          type="checkbox"
                          disabled={Boolean(activeWb.generated)}
                          checked={activeWb.enabled}
                          onChange={(e) => patchWbEntry(activeWb.id, { enabled: e.target.checked })}
                        />
                        <span>启用</span>
                      </label>
                      <label className="lc-pwb-param inline">
                        <input
                          id="wb-editor-constant"
                          type="checkbox"
                          disabled={Boolean(activeWb.generated)}
                          checked={activeWb.constant}
                          onChange={(e) => patchWbEntry(activeWb.id, { constant: e.target.checked })}
                        />
                        <span>常驻</span>
                      </label>
                      {!activeWb.generated && (
                        <button
                          id="wb-editor-delete"
                          type="button"
                          className="os-nav-btn"
                          onClick={() => deleteWbEntry(activeWb.id)}
                          aria-label="删除此世界书词条"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <label className="lc-pwb-param">
                      <span>触发关键词（中英文逗号分隔，对话或局势命中即注入）</span>
                      <input
                        id="wb-editor-keys"
                        type="text"
                        className="cyber-text-input"
                        disabled={Boolean(activeWb.generated)}
                        value={activeWb.keys.join('，')}
                        onChange={(e) =>
                          patchWbEntry(activeWb.id, {
                            keys: e.target.value
                              .split(/[，,]/)
                              .map((k) => k.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>

                    <div className="cmd-grid cols-2">
                      <label className="lc-pwb-param">
                        <span>注入优先级 (0-100，高者优先装入预算)</span>
                        <input
                          id="wb-editor-priority"
                          type="number"
                          className="cyber-text-input"
                          disabled={Boolean(activeWb.generated)}
                          value={activeWb.priority}
                          onChange={(e) =>
                            patchWbEntry(activeWb.id, { priority: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                      <label className="lc-pwb-param">
                        <span>同级排序权重 (order)</span>
                        <input
                          id="wb-editor-order"
                          type="number"
                          className="cyber-text-input"
                          disabled={Boolean(activeWb.generated)}
                          value={activeWb.order}
                          onChange={(e) =>
                            patchWbEntry(activeWb.id, { order: Number(e.target.value) || 0 })
                          }
                        />
                      </label>
                    </div>

                    <label className="lc-pwb-param">
                      <span>世界书正文内容</span>
                      <textarea
                        id="wb-editor-content"
                        rows={7}
                        className="cyber-text-input"
                        style={{ width: '100%', resize: 'vertical', lineHeight: 1.55 }}
                        readOnly={Boolean(activeWb.generated)}
                        value={activeWb.content}
                        onChange={(e) => patchWbEntry(activeWb.id, { content: e.target.value })}
                      />
                    </label>
                  </div>
                )}

                <div className="cyber-panel-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                    <Search size={13} aria-hidden="true" />
                    关键词命中预览沙盒
                  </div>
                  <input
                    id="wb-preview-trigger-input"
                    type="text"
                    className="cyber-text-input"
                    placeholder="输入一段测试对话或牌桌情境，查看实际注入的世界书词条..."
                    value={wbTrigger}
                    onChange={(e) => setWbTrigger(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {wbPreviewContext.hits.map((h) => (
                      <span key={h.id} className={`cyber-badge ${h.reason === 'constant' ? 'cyan' : 'pink'}`}>
                        {h.name} · {h.reason === 'constant' ? '常驻' : '关键词'}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    本次命中 {wbPreviewContext.hits.length} 条，约 {wbPreviewContext.tokens} Tokens
                    {wbPreviewContext.dropped > 0 ? `（因超出预算跳过 ${wbPreviewContext.dropped} 条）` : ''}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
