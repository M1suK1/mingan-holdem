import { useState } from 'react';
import { Activity, Bot, Code2, Eye, EyeOff, PlugZap, Trash2, X } from 'lucide-react';
import type { GameState } from '../engine/types.ts';
import type { ContractCharacter } from '../engine/contractCards.ts';
import {
  buildCharacterSystemPrompt,
  callOpenAiCompatible,
  serializeStateForLlm,
  type LlmCallLog,
  type LlmConfig,
} from '../engine/llmClient.ts';

interface LlmTerminalModalProps {
  config: LlmConfig;
  character: ContractCharacter;
  state: GameState;
  logs: LlmCallLog[];
  onSaveConfig: (next: LlmConfig) => void;
  onAppendLog: (entry: LlmCallLog) => void;
  onClearLogs: () => void;
  onNotify: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onClose: () => void;
}

export default function LlmTerminalModal({
  config,
  character,
  state,
  logs,
  onSaveConfig,
  onAppendLog,
  onClearLogs,
  onNotify,
  onClose,
}: LlmTerminalModalProps) {
  const [tab, setTab] = useState<'gateway' | 'prompt' | 'logs'>('gateway');
  const [draft, setDraft] = useState<LlmConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handlePing = async () => {
    setIsTesting(true);
    try {
      const { content, durationMs } = await callOpenAiCompatible(draft, [
        { role: 'system', content: `请扮演${character.name}，用一句20字以内的中文回应连接成功，不要使用Emoji。` },
        { role: 'user', content: '神经链路握手测试' },
      ]);
      onAppendLog({
        id: `ping-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'ping',
        ok: true,
        model: draft.model,
        durationMs,
        summary: `握手成功 (${durationMs}ms)`,
        rawPreview: content,
      });
      onNotify('success', `LLM 链路握手成功 (${durationMs}ms)`, `${character.name}：「${content.slice(0, 60)}」`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '连接失败';
      onAppendLog({
        id: `ping-${Date.now()}`,
        timestamp: Date.now(),
        kind: 'ping',
        ok: false,
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
            <span id="llm-modal-title">神经链路网关 · LLM 角色对话与决策引擎</span>
          </div>
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
            契约人格与牌桌报文预览
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
            链路审计日志 ({logs.length})
          </button>
        </div>

        <div className="modal-content-scroll">
          {tab === 'gateway' && (
            <>
              <div className="cyber-panel-box">
                <div className="form-field-row">
                  <div>
                    <label htmlFor="llm-switch-enabled" style={{ fontWeight: 700 }}>
                      启用实时在线 LLM 驱动角色交互
                    </label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      关闭时使用内置契约卡原声语料与本地策略核；开启后调用兼容 OpenAI 协议的模型接口
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
                      允许 LLM 直接接管对手出牌/加注决策
                    </label>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      开启后由大模型根据牌面与赔率自主决策出招（若返回超时或非法动作自动平滑回退本地 AI）
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
                  <label htmlFor="llm-input-endpoint">接口地址 (Base URL)</label>
                  <input
                    id="llm-input-endpoint"
                    type="url"
                    className="cyber-text-input"
                    style={{ maxWidth: 380 }}
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
                      setDraft((p) => ({
                        ...p,
                        authMode: e.target.value as 'bearer' | 'none',
                      }))
                    }
                  >
                    <option value="bearer">Bearer 令牌鉴权（标准云端 API）</option>
                    <option value="none">免密直连（本地 Ollama / 反向代理）</option>
                  </select>
                </div>

                {draft.authMode === 'bearer' && (
                  <div className="form-field-row">
                    <label htmlFor="llm-input-apikey">本地接口凭证 (仅保存在浏览器本地)</label>
                    <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 380 }}>
                      <input
                        id="llm-input-apikey"
                        type={showKey ? 'text' : 'password'}
                        autoComplete="off"
                        className="cyber-text-input"
                        placeholder="在本地客户端输入接口密钥..."
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

                <div className="form-field-row">
                  <label htmlFor="llm-input-model">模型标识 (Model ID)</label>
                  <input
                    id="llm-input-model"
                    type="text"
                    className="cyber-text-input"
                    style={{ maxWidth: 260 }}
                    value={draft.model}
                    onChange={(e) => setDraft((p) => ({ ...p, model: e.target.value }))}
                  />
                </div>

                <div className="form-field-row">
                  <label htmlFor="llm-input-temp">发散温度 ({draft.temperature.toFixed(2)})</label>
                  <input
                    id="llm-input-temp"
                    type="range"
                    min={0.1}
                    max={1.3}
                    step={0.05}
                    value={draft.temperature}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, temperature: Number(e.target.value) }))
                    }
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
                      draft.enabled ? `当前激活模型：${draft.model}` : '当前运行于本地契约人格模式'
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
                <label htmlFor="llm-textarea-custom-prompt" style={{ fontWeight: 700, fontSize: 13 }}>
                  附加导演/扮演指令（可选，实时注入 System Prompt）
                </label>
                <textarea
                  id="llm-textarea-custom-prompt"
                  rows={3}
                  className="cyber-text-input"
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="例如：说话时多带一点黑客行话，在底池超过100时表现出强烈的胜负欲..."
                  value={draft.customSystemPrompt}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, customSystemPrompt: e.target.value }))
                  }
                />
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--neon-pink-300)' }}>
                  契约卡合成角色提示词预览（System Prompt）
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
                  }}
                >
                  {buildCharacterSystemPrompt(character, draft)}
                </pre>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--accent-telemetry)' }}>
                  实时牌局状态序列化数据包（serializeStateForLlm）
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
                    color: 'var(--neon-cyan-300)',
                  }}
                >
                  {serializeStateForLlm(state)}
                </pre>
              </div>

              <button
                id="llm-btn-save-prompt-tab"
                type="button"
                className="cyber-cmd-btn primary-cyan"
                onClick={() => {
                  onSaveConfig(draft);
                  onNotify('success', '附加导演指令与网关配置已保存');
                  onClose();
                }}
              >
                保存当前提示词与网关设置
              </button>
            </>
          )}

          {tab === 'logs' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  记录当前会话内每一次模型对话与决策请求耗时与响应快照
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
                logs.map((item) => (
                  <div key={item.id} className="cyber-panel-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <strong style={{ color: item.ok ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        [{item.kind.toUpperCase()}] {item.summary}
                      </strong>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>
                        {item.model} · {item.durationMs}ms
                      </span>
                    </div>
                    {item.rawPreview && (
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {item.rawPreview}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
