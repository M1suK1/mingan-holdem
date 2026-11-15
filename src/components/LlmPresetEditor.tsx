import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, FileJson, Plus, Trash2, Upload } from 'lucide-react';
import {
  PROMPT_SCOPES,
  SAMPLING_FIELDS,
  activePrompts,
  createPreset,
  duplicatePreset,
  exportPresetJson,
  importPresetJson,
  promptScope,
  samplingValue,
  type ChatPreset,
  type PromptEntry,
  type PromptScope,
} from '../engine/llmPreset.ts';
import { MACRO_SPECS } from '../engine/promptMacros.ts';

interface LlmPresetEditorProps {
  presets: ChatPreset[];
  presetId: string;
  onChange: (presets: ChatPreset[]) => void;
  onSelect: (presetId: string) => void;
  onNotify: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

type ScopeFilter = PromptScope | 'all';

export default function LlmPresetEditor({
  presets,
  presetId,
  onChange,
  onSelect,
  onNotify,
}: LlmPresetEditorProps) {
  const [view, setView] = useState<ScopeFilter>('all');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const preset = presets.find((item) => item.id === presetId) ?? presets[0];

  const entries = useMemo(
    () =>
      preset
        ? view === 'all'
          ? preset.prompts
          : activePrompts(preset, view)
        : [],
    [preset, view]
  );

  if (!preset) {
    return <p className="llm-empty-hint">还没有任何预设。</p>;
  }

  const replace = (next: ChatPreset) => {
    onChange(presets.map((item) => (item.id === next.id ? next : item)));
  };

  const patchEntry = (id: string, next: Partial<PromptEntry>) => {
    replace({ ...preset, prompts: preset.prompts.map((item) => (item.id === id ? { ...item, ...next } : item)) });
  };

  const moveEntry = (id: string, delta: number) => {
    const index = preset.prompts.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= preset.prompts.length) return;
    const next = [...preset.prompts];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    replace({ ...preset, prompts: next });
  };

  const addEntry = () => {
    const fresh: PromptEntry = {
      id: `p-${Date.now().toString(36)}`,
      name: '新词条',
      role: 'system',
      enabled: true,
      scope: view === 'all' ? 'shared' : view,
      content: '',
    };
    replace({ ...preset, prompts: [...preset.prompts, fresh] });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = importPresetJson(text);
      if (!result.ok || !result.preset) {
        onNotify('error', '预设导入失败', result.message);
        return;
      }
      const imported = { ...result.preset, id: `preset-${Date.now().toString(36)}` };
      onChange([...presets, imported]);
      onSelect(imported.id);
      onNotify('success', '预设导入完成', result.message);
    } catch (err) {
      onNotify('error', '预设导入失败', err instanceof Error ? err.message : '文件读取异常');
    }
  };

  return (
    <div className="llm-preset-editor">
      <div className="llm-preset-toolbar">
        <label htmlFor="llm-preset-select">当前预设</label>
        <select
          id="llm-preset-select"
          className="cyber-select"
          value={preset.id}
          onChange={(e) => onSelect(e.target.value)}
        >
          {presets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          id="llm-preset-new"
          type="button"
          className="cyber-cmd-btn"
          onClick={() => {
            const fresh = createPreset(`预设 ${presets.length + 1}`);
            onChange([...presets, fresh]);
            onSelect(fresh.id);
          }}
        >
          <Plus size={13} aria-hidden="true" />
          新建
        </button>
        <button
          id="llm-preset-duplicate"
          type="button"
          className="cyber-cmd-btn"
          onClick={() => {
            const copy = duplicatePreset(preset);
            onChange([...presets, copy]);
            onSelect(copy.id);
          }}
        >
          <Copy size={13} aria-hidden="true" />
          复制
        </button>
        <button
          id="llm-preset-import"
          type="button"
          className="cyber-cmd-btn"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={13} aria-hidden="true" />
          导入
        </button>
        <button
          id="llm-preset-export"
          type="button"
          className="cyber-cmd-btn"
          onClick={() => {
            downloadText(`preset-${preset.name}.json`, exportPresetJson(preset));
            onNotify('success', '预设已导出', '可直接导入 SillyTavern 或本作');
          }}
        >
          <Download size={13} aria-hidden="true" />
          导出
        </button>
        <button
          id="llm-preset-delete"
          type="button"
          className="cyber-cmd-btn danger-red"
          disabled={presets.length <= 1}
          onClick={() => {
            const next = presets.filter((item) => item.id !== preset.id);
            onChange(next);
            onSelect(next[0].id);
          }}
        >
          <Trash2 size={13} aria-hidden="true" />
          删除
        </button>
        <input
          id="llm-preset-import-file"
          type="file"
          accept=".json,application/json"
          className="llm-hidden-input"
          onChange={(e) => {
            void handleImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="llm-sampling-grid">
        {SAMPLING_FIELDS.map((field) => (
          <label key={field.key} htmlFor={`llm-sampling-${field.key}`} className="llm-sampling-field">
            <span className="llm-sampling-head">
              {field.label}
              <em>{samplingValue(preset, field.key)}</em>
            </span>
            <input
              id={`llm-sampling-${field.key}`}
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={samplingValue(preset, field.key)}
              onChange={(e) =>
                replace({
                  ...preset,
                  settings: { ...preset.settings, [field.key]: Number(e.target.value) },
                })
              }
            />
            <span className="llm-sampling-hint">{field.hint}</span>
          </label>
        ))}
      </div>

      <div className="llm-preset-scope-tabs" role="tablist" aria-label="按场景筛选词条">
        {[{ id: 'all' as ScopeFilter, label: '全部' }, ...PROMPT_SCOPES].map((scope) => (
          <button
            key={scope.id}
            id={`llm-preset-scope-${scope.id}`}
            type="button"
            role="tab"
            aria-selected={view === scope.id}
            className={`modal-tab-btn ${view === scope.id ? 'active' : ''}`}
            onClick={() => setView(scope.id as ScopeFilter)}
          >
            {scope.label}
          </button>
        ))}
        <button id="llm-preset-entry-add" type="button" className="cyber-cmd-btn" onClick={addEntry}>
          <Plus size={13} aria-hidden="true" />
          添加词条
        </button>
      </div>

      <div className="llm-preset-entries">
        {entries.length === 0 && <p className="llm-empty-hint">该场景下还没有词条。</p>}
        {entries.map((entry) => (
          <article key={entry.id} className={`llm-preset-entry ${entry.enabled ? '' : 'is-off'}`}>
            <header className="llm-preset-entry-head">
              <button
                id={`llm-preset-entry-enabled-${entry.id}`}
                type="button"
                className={`llm-editor-eye ${entry.enabled ? 'on' : ''}`}
                aria-pressed={entry.enabled}
                aria-label={entry.enabled ? '停用该词条' : '启用该词条'}
                onClick={() => patchEntry(entry.id, { enabled: !entry.enabled })}
              />
              <input
                id={`llm-preset-entry-name-${entry.id}`}
                type="text"
                className="cyber-text-input llm-entry-name"
                value={entry.name}
                aria-label="词条名称"
                onChange={(e) => patchEntry(entry.id, { name: e.target.value })}
              />
              <select
                id={`llm-preset-entry-scope-${entry.id}`}
                className="cyber-select llm-entry-scope"
                value={promptScope(entry)}
                aria-label="词条用途"
                onChange={(e) => patchEntry(entry.id, { scope: e.target.value as PromptScope })}
              >
                {PROMPT_SCOPES.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.label}
                  </option>
                ))}
              </select>
              {entry.contract && <span className="llm-contract-tag">输出契约</span>}
              <button
                id={`llm-preset-entry-up-${entry.id}`}
                type="button"
                className="os-nav-btn"
                aria-label="上移词条"
                onClick={() => moveEntry(entry.id, -1)}
              >
                <ArrowUp size={12} aria-hidden="true" />
              </button>
              <button
                id={`llm-preset-entry-down-${entry.id}`}
                type="button"
                className="os-nav-btn"
                aria-label="下移词条"
                onClick={() => moveEntry(entry.id, 1)}
              >
                <ArrowDown size={12} aria-hidden="true" />
              </button>
              <button
                id={`llm-preset-entry-delete-${entry.id}`}
                type="button"
                className="os-nav-btn danger-red"
                aria-label="删除词条"
                onClick={() =>
                  replace({ ...preset, prompts: preset.prompts.filter((item) => item.id !== entry.id) })
                }
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </header>
            <textarea
              id={`llm-preset-entry-content-${entry.id}`}
              className="cyber-text-input llm-textarea"
              rows={entry.contract ? 5 : 3}
              value={entry.content}
              placeholder="词条内容；支持 {{char}}、{{state}}、{{worldbook}}、{{legal_actions}} 等宏。"
              onChange={(e) => patchEntry(entry.id, { content: e.target.value })}
            />
          </article>
        ))}
      </div>

      <details className="llm-macro-reference">
        <summary>
          <FileJson size={13} aria-hidden="true" />
          可用宏与解析说明
        </summary>
        <div className="llm-macro-grid">
          {MACRO_SPECS.map((macro) => (
            <div key={macro.key} className="llm-macro-row">
              <code>{`{{${macro.key}}}`}</code>
              <span>{macro.label}</span>
              <em>{macro.hint}</em>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
