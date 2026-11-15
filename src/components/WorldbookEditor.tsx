import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Plus, Trash2, Upload } from 'lucide-react';
import {
  createWorldbookEntry,
  exportWorldbookJson,
  importWorldbookJson,
  worldbookContext,
  WORLDBOOK_BUDGET,
  type WorldbookEntry,
} from '../engine/worldbook.ts';

interface WorldbookEditorProps {
  entries: WorldbookEntry[];
  budget: number;
  onChange: (entries: WorldbookEntry[]) => void;
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

export default function WorldbookEditor({
  entries,
  budget,
  onChange,
  onNotify,
}: WorldbookEditorProps) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '');
  const [trigger, setTrigger] = useState('对手刚换了一张牌进来，我怀疑他在扫描我的公共槽');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const active = entries.find((item) => item.id === activeId) ?? entries[0];
  const preview = useMemo(
    () => worldbookContext(trigger, entries, budget),
    [trigger, entries, budget]
  );

  const patch = (id: string, next: Partial<WorldbookEntry>) => {
    onChange(entries.map((item) => (item.id === id ? { ...item, ...next } : item)));
  };

  const move = (id: string, delta: number) => {
    const index = entries.findIndex((item) => item.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= entries.length) return;
    const next = [...entries];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next);
  };

  const add = () => {
    const fresh = createWorldbookEntry(entries);
    onChange([...entries, fresh]);
    setActiveId(fresh.id);
  };

  const remove = (id: string) => {
    if (entries.find((item) => item.id === id)?.generated) {
      onNotify('warn', '该词条由契约卡自动生成', '切换契约卡即可改变内容，不能手动删除');
      return;
    }
    const next = entries.filter((item) => item.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? '');
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = importWorldbookJson(text);
      if (!result.ok || !result.entries) {
        onNotify('error', '世界书导入失败', result.message);
        return;
      }
      const merged = [
        ...entries.filter((item) => item.generated),
        ...result.entries.filter((item) => !item.generated),
      ];
      onChange(merged);
      setActiveId(merged[merged.length - 1]?.id ?? '');
      onNotify('success', '世界书导入完成', result.message);
    } catch (err) {
      onNotify('error', '世界书导入失败', err instanceof Error ? err.message : '文件读取异常');
    }
  };

  return (
    <div className="llm-editor-split">
      <section className="llm-editor-list" aria-label="世界书词条列表">
        <header className="llm-editor-list-head">
          <span>词条 {entries.length}</span>
          <button
            id="llm-wb-add"
            type="button"
            className="os-nav-btn"
            onClick={add}
            aria-label="新增世界书词条"
          >
            <Plus size={13} aria-hidden="true" />
            新增
          </button>
        </header>
        <div className="llm-editor-list-body">
          {entries.map((item) => (
            <div
              key={item.id}
              className={`llm-editor-row ${item.id === active?.id ? 'active' : ''} ${
                item.enabled ? '' : 'is-off'
              }`}
            >
              <button
                id={`llm-wb-select-${item.id}`}
                type="button"
                className="llm-editor-row-main"
                onClick={() => setActiveId(item.id)}
              >
                <span className="llm-editor-row-name">{item.name}</span>
                <span className="llm-editor-row-meta">
                  {item.constant ? '常驻' : item.keys.length ? `${item.keys.length} 关键词` : '未设关键词'}
                  {item.generated ? ' · 自动生成' : ''}
                </span>
              </button>
              <button
                id={`llm-wb-toggle-${item.id}`}
                type="button"
                className={`llm-editor-eye ${item.enabled ? 'on' : ''}`}
                aria-pressed={item.enabled}
                aria-label={item.enabled ? '停用该词条' : '启用该词条'}
                onClick={() => patch(item.id, { enabled: !item.enabled })}
              />
            </div>
          ))}
        </div>
        <footer className="llm-editor-list-foot">
          <button
            id="llm-wb-import"
            type="button"
            className="cyber-cmd-btn"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={13} aria-hidden="true" />
            导入 JSON
          </button>
          <button
            id="llm-wb-export"
            type="button"
            className="cyber-cmd-btn"
            onClick={() => {
              downloadText('blackwell-worldbook.json', exportWorldbookJson(entries));
              onNotify('success', '世界书已导出', '文件名 blackwell-worldbook.json');
            }}
          >
            <Download size={13} aria-hidden="true" />
            导出 JSON
          </button>
          <input
            id="llm-wb-import-file"
            type="file"
            accept=".json,application/json"
            className="llm-hidden-input"
            onChange={(e) => {
              void handleImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </footer>
      </section>

      <section className="llm-editor-detail" aria-label="词条编辑">
        {active ? (
          <>
            <div className="form-field-row">
              <label htmlFor="llm-wb-name">词条名称</label>
              <input
                id="llm-wb-name"
                type="text"
                className="cyber-text-input"
                value={active.name}
                onChange={(e) => patch(active.id, { name: e.target.value })}
              />
            </div>
            <div className="form-field-row">
              <label htmlFor="llm-wb-keys">关键词（英文逗号分隔）</label>
              <input
                id="llm-wb-keys"
                type="text"
                className="cyber-text-input"
                value={active.keys.join(',')}
                placeholder="换牌, 手续费, 篡改"
                onChange={(e) =>
                  patch(active.id, {
                    keys: e.target.value
                      .split(/[,，]/)
                      .map((key) => key.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="llm-editor-inline">
              <label htmlFor="llm-wb-constant">
                <input
                  id="llm-wb-constant"
                  type="checkbox"
                  checked={active.constant}
                  onChange={(e) => patch(active.id, { constant: e.target.checked })}
                />
                常驻注入（不看关键词，每次必发）
              </label>
              <label htmlFor="llm-wb-priority">
                优先级
                <input
                  id="llm-wb-priority"
                  type="number"
                  min={0}
                  max={100}
                  className="cyber-text-input llm-num-input"
                  value={active.priority}
                  onChange={(e) => patch(active.id, { priority: Number(e.target.value) })}
                />
              </label>
            </div>
            <textarea
              id="llm-wb-content"
              className="cyber-text-input llm-textarea"
              rows={9}
              value={active.content}
              readOnly={Boolean(active.generated)}
              placeholder="词条正文；这段文字会直接进入模型的 system prompt。"
              onChange={(e) => patch(active.id, { content: e.target.value })}
            />
            <div className="llm-editor-actions">
              <button
                id="llm-wb-up"
                type="button"
                className="cyber-cmd-btn"
                onClick={() => move(active.id, -1)}
                aria-label="上移词条"
              >
                <ArrowUp size={13} aria-hidden="true" />
                上移
              </button>
              <button
                id="llm-wb-down"
                type="button"
                className="cyber-cmd-btn"
                onClick={() => move(active.id, 1)}
                aria-label="下移词条"
              >
                <ArrowDown size={13} aria-hidden="true" />
                下移
              </button>
              <button
                id="llm-wb-delete"
                type="button"
                className="cyber-cmd-btn danger-red"
                onClick={() => remove(active.id)}
              >
                <Trash2 size={13} aria-hidden="true" />
                删除词条
              </button>
            </div>
          </>
        ) : (
          <p className="llm-empty-hint">还没有任何词条，点击左侧「新增」开始。</p>
        )}
      </section>

      <section className="llm-editor-preview" aria-label="命中预览">
        <div className="form-field-row">
          <label htmlFor="llm-wb-trigger">命中测试</label>
          <input
            id="llm-wb-trigger"
            type="text"
            className="cyber-text-input"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="输入一段情境，看看会命中哪些词条"
          />
        </div>
        <div className="llm-editor-preview-stats">
          <span>命中 {preview.hits.length} 条</span>
          <span>占用 {preview.chars} / {budget} 字符</span>
          <span>超出预算丢弃 {preview.dropped} 条</span>
          <span>预算 {WORLDBOOK_BUDGET} 字符为出厂值</span>
        </div>
        <div className="llm-editor-preview-list">
          {preview.hits.length === 0 && <p className="llm-empty-hint">当前情境没有命中任何词条。</p>}
          {preview.hits.map((hit) => (
            <div key={hit.id} className="llm-editor-preview-row">
              <span className={`llm-reason-tag ${hit.reason}`}>
                {hit.reason === 'constant' ? '常驻' : '关键词'}
              </span>
              <span>{hit.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
