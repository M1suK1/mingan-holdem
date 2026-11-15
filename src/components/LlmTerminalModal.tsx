import { useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronUp,
  Code2,
  Eye,
  EyeOff,
  KeyRound,
  PlugZap,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CampaignState, GameState, PursuerDossier } from '../engine/types.ts';
import type { ContractCharacter } from '../engine/contractCards.ts';
import {
  composePresetPrompt,
  type ChatPreset,
} from '../engine/presets.ts';
import {
  syncDynamicWorldbookEntries,
  type WorldbookEntry,
} from '../engine/worldbook.ts';
import {
  describeVertexCredential,
  normalizeServiceAccountText,
} from '../engine/vertexClient.ts';
import {
  dispatchModelCall,
  serializeStateForLlm,
  type LlmAuthMode,
  type LlmCallLog,
  type LlmConfig,
  type LlmProvider,
} from '../engine/llmClient.ts';

interface LlmTerminalModalProps {
  config: LlmConfig;
  character: ContractCharacter;
  dossier: PursuerDossier;
  campaign: CampaignState;
  state: GameState;
  activePreset: ChatPreset;
  worldbook: WorldbookEntry[];
  logs: LlmCallLog[];
  onSaveConfig: (next: LlmConfig) => void;
  onAppendLog: (entry: LlmCallLog) => void;
  onClearLogs: () => void;
  onOpenPresetWorldbook: (section: 'preset' | 'worldbook') => void;
  onNotify: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onClose: () => void;
}

const VERTEX_LOCATIONS = [
  'us-central1',
  'global',
  'asia-east1',
  'asia-northeast1',
  'europe-west4',
  'us-east4',
];

export default function LlmTerminalModal({
  config,
  character,
  dossier,
  campaign,
  state,
  activePreset,
  worldbook,
  logs,
  onSaveConfig,
  onAppendLog,
  onClearLogs,
  onOpenPresetWorldbook,
  onNotify,
  onClose,
}: LlmTerminalModalProps) {
  const [tab, setTab] = useState<'gateway' | 'prompt' | 'logs'>('gateway');
  const [draft, setDraft] = useState<LlmConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const saFileRef = useRef<HTMLInputElement | null>(null);

  const vertexDesc = describeVertexCredential(draft.vertexSecret ?? '');
  const syncedWb = syncDynamicWorldbookEntries(worldbook, campaign, character, dossier);
  const composedPreview = composePresetPrompt({
    preset: activePreset,
    scope: 'chat',
    worldbook: syncedWb,
    character,
    dossier,
    campaign,
    triggerText: '黑域协议 虚拟实体 诱饵 技能池',
    tableSummary: serializeStateForLlm(state),
    taskContext: draft.customSystemPrompt.trim()
      ? `（测试预览）附加指令：${draft.customSystemPrompt.trim()}`
      : '（测试预览）追捕者准备回应通缉黑客的通讯试探',
    overloadPersona: draft.overloadPersona,
  });

  const handleImportVertexSa = async (file: File) => {
    try {
      const text = normalizeServiceAccountText(await file.text());
      const desc = describeVertexCredential(text);
      if (desc.kind !== 'service-account') {
        onNotify('error', 'Vertex 服务账号 JSON 校验失败', desc.message);
        return;
      }
      setDraft((p) => ({ ...p, provider: 'vertex', vertexSecret: text }));
      onNotify('success', `已载入服务账号 (${desc.projectId})`, '私钥已保存在本地，仅用于签发 OAuth2 令牌');
    } catch {
      onNotify('error', '读取 JSON 文件失败');
    }
  };

  const handlePing = async () => {
    setIsTesting(true);
    try {
      const res = await dispatchModelCall({
        config: draft,
        preset: activePreset,
        messages: [
          {
            role: 'system',
            content: `你正在黑域协议空间扮演追捕者${character.name}，用一句25字以内的中文回应神经链路握手成功，禁止使用Emoji。`,
          },
          { role: 'user', content: '黑域神经链路握手测试' },
        ],
      });
      onAppendLog({
        id: `ping-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'ping',
        ok: true,
        provider: res.provider,
        model: res.model,
        durationMs: res.durationMs,
        summary: `握手成功 (${res.provider.toUpperCase()} · ${res.durationMs}ms)`,
        presetName: activePreset.name,
        rawPreview: res.content,
        reasoning: res.reasoning,
      });
      onNotify(
        'success',
        `LLM 握手成功 (${res.provider.toUpperCase()} · ${res.durationMs}ms)`,
        `${character.name}：「${res.content.slice(0, 60)}」`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      onAppendLog({
        id: `ping-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'ping',
        ok: false,
        provider: draft.provider,
        model: draft.model,
        durationMs: 0,
        summary: `握手失败: ${msg}`,
      });
      onNotify('error', 'LLM 接口连接未通过', msg);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="llm-modal-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <Bot size={15} color="var(--accent-telemetry)" aria-hidden="true" />
            <span id="llm-modal-title">神经链路网关 · OpenAI / Google Vertex AI 接入</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              id="llm-btn-open-pwb"
              type="button"
              className="os-nav-btn highlight"
              onClick={() => onOpenPresetWorldbook('preset')}
            >
              <BookOpen size={13} aria-hidden="true" />
              预设与世界书
            </button>
            <button
              id="llm-modal-btn-close"
              type="button"
              className="os-nav-btn"
              onClick={onClose}
              aria-label="关闭 LLM 配置窗口"
            >
              <X size={15} aria-hidden="true" />
              关闭
            </button>
          </div>
        </div>

        <div className="modal-tab-strip" role="tablist">
          <button
            id="llm-tab-gateway"
            type="button"
            role="tab"
            aria-selected={tab === 'gateway'}
            className={`modal-tab-btn ${tab === 'gateway' ? 'active' : ''}`}
            onClick={() => setTab('gateway')}
          >
            <PlugZap size={14} aria-hidden="true" />
            模型网关配置
          </button>
          <button
            id="llm-tab-prompt"
            type="button"
            role="tab"
            aria-selected={tab === 'prompt'}
            className={`modal-tab-btn ${tab === 'prompt' ? 'active' : ''}`}
            onClick={() => setTab('prompt')}
          >
            <Code2 size={14} aria-hidden="true" />
            预设+世界书合成预览
          </button>
          <button
            id="llm-tab-logs"
            type="button"
            role="tab"
            aria-selected={tab === 'logs'}
            className={`modal-tab-btn ${tab === 'logs' ? 'active' : ''}`}
            onClick={() => setTab('logs')}
          >
            <Activity size={14} aria-hidden="true" />
            链路审计快照 ({logs.length})
          </button>
        </div>

        <div className="modal-content-scroll">
          {tab === 'gateway' && (
            <>
              <div className="cyber-panel-box">
                <div className="form-field-row">
                  <div>
                    <label htmlFor="llm-switch-enabled" style={{ fontWeight: 700 }}>
                      启用实时在线 LLM 驱动追捕者对话与演出
                    </label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      关闭时使用本地契约原声语料；开启后通过可编辑预设 + 世界书调用在线模型
                    </div>
                  </div>
                  <input
                    id="llm-switch-enabled"
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDraft((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                </div>

                <div className="form-field-row">
                  <div>
                    <label htmlFor="llm-switch-drive-poker" style={{ fontWeight: 700 }}>
                      允许 LLM 直接接管追捕者出牌/改牌/扫描决策
                    </label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      开启后由大模型根据可见牌面与追捕人格自主出招（超时或非法动作自动平滑回退本地 AI）
                    </div>
                  </div>
                  <input
                    id="llm-switch-drive-poker"
                    type="checkbox"
                    checked={draft.drivePokerActions}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, drivePokerActions: e.target.checked }))
                    }
                  />
                </div>
              </div>

              <div className="cyber-panel-box">
                <div className="form-field-row">
                  <label htmlFor="llm-select-provider" style={{ fontWeight: 700 }}>
                    模型接口协议 (Provider)
                  </label>
                  <select
                    id="llm-select-provider"
                    className="cyber-select"
                    value={draft.provider}
                    onChange={(e) => {
                      const nextProvider = e.target.value as LlmProvider;
                      setDraft((p) => ({
                        ...p,
                        provider: nextProvider,
                        model:
                          nextProvider === 'vertex' && !p.model.includes('gemini')
                            ? 'gemini-2.5-flash'
                            : nextProvider === 'openai' && p.model.includes('gemini')
                              ? 'deepseek-chat'
                              : p.model,
                      }));
                    }}
                  >
                    <option value="openai">OpenAI 兼容协议 (DeepSeek / OpenAI / Ollama / 反代)</option>
                    <option value="vertex">Google Vertex AI (服务账号 JSON 或 Express 密钥)</option>
                  </select>
                </div>

                {draft.provider === 'openai' ? (
                  <>
                    <div className="form-field-row">
                      <label htmlFor="llm-input-endpoint">接口地址 (Base URL)</label>
                      <input
                        id="llm-input-endpoint"
                        type="url"
                        className="cyber-text-input"
                        style={{ maxWidth: 380, flex: 1 }}
                        value={draft.endpoint}
                        placeholder="https://api.openai.com/v1 或 http://127.0.0.1:11434/v1"
                        onChange={(e) => setDraft((p) => ({ ...p, endpoint: e.target.value }))}
                      />
                    </div>

                    <div className="form-field-row">
                      <label htmlFor="llm-select-authmode">鉴权模式</label>
                      <select
                        id="llm-select-authmode"
                        className="cyber-select"
                        value={draft.authMode}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, authMode: e.target.value as LlmAuthMode }))
                        }
                      >
                        <option value="bearer">Bearer 令牌鉴权</option>
                        <option value="x-api-key">x-api-key 请求头</option>
                        <option value="header">自定义 Header 鉴权</option>
                        <option value="none">免密直连（本地 Ollama 等）</option>
                      </select>
                    </div>

                    {draft.authMode === 'header' && (
                      <div className="form-field-row">
                        <label htmlFor="llm-input-header-name">自定义 Header 名</label>
                        <input
                          id="llm-input-header-name"
                          type="text"
                          className="cyber-text-input"
                          style={{ maxWidth: 260 }}
                          value={draft.headerName ?? 'X-API-Key'}
                          onChange={(e) => setDraft((p) => ({ ...p, headerName: e.target.value }))}
                        />
                      </div>
                    )}

                    {draft.authMode !== 'none' && (
                      <div className="form-field-row">
                        <label htmlFor="llm-input-apikey">API 密钥 (仅保存在本地浏览器)</label>
                        <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 380 }}>
                          <input
                            id="llm-input-apikey"
                            type={showKey ? 'text' : 'password'}
                            autoComplete="off"
                            className="cyber-text-input"
                            style={{ flex: 1 }}
                            placeholder="输入接口密钥..."
                            value={draft.apiKey}
                            onChange={(e) => setDraft((p) => ({ ...p, apiKey: e.target.value }))}
                          />
                          <button
                            id="llm-btn-toggle-key-visibility"
                            type="button"
                            className="os-nav-btn"
                            onClick={() => setShowKey((s) => !s)}
                            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
                          >
                            {showKey ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="form-field-row">
                      <label htmlFor="llm-select-vertex-location">Vertex 区域 (Location)</label>
                      <select
                        id="llm-select-vertex-location"
                        className="cyber-select"
                        value={draft.vertexLocation ?? 'us-central1'}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, vertexLocation: e.target.value }))
                        }
                      >
                        {VERTEX_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-row" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <label htmlFor="llm-input-vertex-secret">
                          Vertex 凭证（服务账号 JSON 或 Express AIza 密钥）
                        </label>
                        <div style={{ fontSize: 11, color: 'var(--accent-telemetry)', marginTop: 3 }}>
                          <KeyRound size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} aria-hidden="true" />
                          {vertexDesc.message}
                          {vertexDesc.clientEmail ? ` (${vertexDesc.clientEmail})` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          ref={saFileRef}
                          id="llm-input-vertex-file"
                          type="file"
                          accept=".json,application/json"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleImportVertexSa(f);
                            e.target.value = '';
                          }}
                        />
                        <button
                          id="llm-btn-import-vertex-sa"
                          type="button"
                          className="os-nav-btn highlight"
                          onClick={() => saFileRef.current?.click()}
                        >
                          <Upload size={13} aria-hidden="true" />
                          导入服务账号 JSON
                        </button>
                      </div>
                    </div>

                    <textarea
                      id="llm-textarea-vertex-secret"
                      rows={3}
                      className="cyber-text-input"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      placeholder="可直接粘贴服务账号 JSON 内容，或填写 AIza 开头的 Express 模式 API Key..."
                      value={draft.vertexSecret ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, vertexSecret: e.target.value }))}
                    />
                  </>
                )}

                <div className="form-field-row">
                  <label htmlFor="llm-input-model">模型标识 (Model ID)</label>
                  <input
                    id="llm-input-model"
                    type="text"
                    className="cyber-text-input"
                    style={{ maxWidth: 280 }}
                    value={draft.model}
                    placeholder={draft.provider === 'vertex' ? 'gemini-2.5-flash' : 'deepseek-chat'}
                    onChange={(e) => setDraft((p) => ({ ...p, model: e.target.value }))}
                  />
                </div>
              </div>

              <div className="cmd-grid cols-2">
                <button
                  id="llm-btn-ping-test"
                  type="button"
                  className="cyber-cmd-btn"
                  disabled={isTesting}
                  onClick={handlePing}
                >
                  {isTesting ? '正在发起神经握手...' : '发送连通性握手测试'}
                </button>
                <button
                  id="llm-btn-save-config"
                  type="button"
                  className="cyber-cmd-btn primary-cyan"
                  onClick={() => {
                    onSaveConfig(draft);
                    onNotify(
                      'success',
                      'LLM 神经链路配置已保存',
                      draft.enabled
                        ? `当前通道：${draft.provider.toUpperCase()} / ${draft.model}`
                        : '当前运行于本地契约人格模式'
                    );
                    onClose();
                  }}
                >
                  保存并应用配置
                </button>
              </div>
            </>
          )}

          {tab === 'prompt' && (
            <>
              <div className="cyber-panel-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="llm-textarea-custom-prompt" style={{ fontWeight: 700, fontSize: 13 }}>
                    附加导演/扮演指令（实时注入当前激活预设：{activePreset.name}）
                  </label>
                  <button
                    id="llm-btn-edit-worldbook-inline"
                    type="button"
                    className="os-nav-btn"
                    onClick={() => onOpenPresetWorldbook('worldbook')}
                  >
                    <BookOpen size={13} aria-hidden="true" />
                    编辑世界书
                  </button>
                </div>
                <textarea
                  id="llm-textarea-custom-prompt"
                  rows={2}
                  className="cyber-text-input"
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="例如：说话时强调追捕者身份与悬赏动机..."
                  value={draft.customSystemPrompt}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, customSystemPrompt: e.target.value }))
                  }
                />
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--neon-cyan-soft)' }}>
                  命中世界书词条 ({composedPreview.worldbookHits.length} 条 · 约 {composedPreview.worldbookTokens} Tokens)
                </strong>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {composedPreview.worldbookHits.map((h) => (
                    <span key={h.id} className={`cyber-badge ${h.reason === 'constant' ? 'cyan' : 'pink'}`}>
                      {h.name} · {h.reason === 'constant' ? '常驻' : '关键词'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--neon-pink-300)' }}>
                  最终注入报文预览（Preset + Worldbook + 脱敏牌桌）
                </strong>
                <pre
                  style={{
                    margin: 0,
                    padding: 10,
                    borderRadius: 6,
                    background: 'rgba(6, 9, 18, 0.9)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11.5,
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-muted)',
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}
                >
                  {composedPreview.system}
                </pre>
              </div>

              <button
                id="llm-btn-save-prompt-tab"
                type="button"
                className="cyber-cmd-btn primary-cyan"
                onClick={() => {
                  onSaveConfig(draft);
                  onNotify('success', '附加指令与网关设置已保存');
                  onClose();
                }}
              >
                保存当前设置
              </button>
            </>
          )}

          {tab === 'logs' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  点击任意一条日志可展开完整预设分段、命中世界书与模型思维链快照
                </span>
                <button
                  id="llm-btn-clear-logs"
                  type="button"
                  className="os-nav-btn"
                  disabled={logs.length === 0}
                  onClick={onClearLogs}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  清空日志
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="cyber-panel-box" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  暂无在线请求记录。启用在线 LLM 后发送对话或进行握手测试即可在此查看报文。
                </div>
              ) : (
                logs.map((item, idx) => {
                  const isExpanded = expandedLogId === item.id;
                  return (
                    <div key={item.id} className="cyber-panel-box">
                      <button
                        id={`llm-log-toggle-${idx}`}
                        type="button"
                        className="lc-log-head-btn"
                        onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                      >
                        <strong style={{ color: item.ok ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                          [{item.kind.toUpperCase()}] {item.summary}
                        </strong>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {(item.provider ?? 'openai').toUpperCase()} · {item.model} · {item.durationMs}ms
                          {isExpanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="lc-log-detail-body">
                          {item.presetName && (
                            <div style={{ fontSize: 11.5, color: 'var(--neon-cyan-soft)' }}>
                              使用预设：{item.presetName}
                            </div>
                          )}
                          {item.worldbookHits && item.worldbookHits.length > 0 && (
                            <div style={{ fontSize: 11.5, color: 'var(--neon-pink-soft)' }}>
                              命中世界书：{item.worldbookHits.join(' / ')}
                            </div>
                          )}
                          {item.reasoning && (
                            <pre className="lc-log-pre">
                              {`[思维链]\n${item.reasoning}`}
                            </pre>
                          )}
                          {item.rawPreview && (
                            <pre className="lc-log-pre">
                              {`[模型返回]\n${item.rawPreview}`}
                            </pre>
                          )}
                          {item.requestSections && item.requestSections.length > 0 && (
                            <pre className="lc-log-pre">
                              {item.requestSections.map((s) => `── ${s.label} ──\n${s.text}`).join('\n\n')}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
