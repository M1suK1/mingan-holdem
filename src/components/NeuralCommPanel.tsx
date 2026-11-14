import { useEffect, useRef, useState } from 'react';
import { Activity, Bot, MessageSquareCode, Radar, Send, Settings2 } from 'lucide-react';
import type { SuitStats } from '../engine/types.ts';
import type { ChatMessage } from '../engine/llmClient.ts';
import { CyberSuitEmblem } from './CyberIcons.tsx';

interface NeuralCommPanelProps {
  suitStats: SuitStats;
  showDeckTracker: boolean;
  messages: ChatMessage[];
  isSendingChat: boolean;
  llmEnabled: boolean;
  opponentName: string;
  onSendMessage: (text: string) => void;
  onOpenLlmModal: () => void;
}

const QUICK_PROBES = [
  { id: 'probe-hand', label: '试探底牌', text: '你刚才换进去的那张私有暗牌，该不会凑齐同花了吧？' },
  { id: 'probe-bluff', label: '心理施压', text: '底池已经在升温了，现在认输断开连接还来得及。' },
  { id: 'probe-lore', label: '询问来历', text: '报上你在夜糖事务所的契约代号和拿手绝活吧。' },
  { id: 'probe-taunt', label: '挑衅节奏', text: '你的下注频率已经被我逆向看穿了，下一手准备接招。' },
];

export function NeuralCommPanel({
  suitStats,
  showDeckTracker,
  messages,
  isSendingChat,
  llmEnabled,
  opponentName,
  onSendMessage,
  onOpenLlmModal,
}: NeuralCommPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isSendingChat]);

  const submitChat = () => {
    const trimmed = draft.trim();
    if (!trimmed || isSendingChat) return;
    setDraft('');
    onSendMessage(trimmed);
  };

  return (
    <aside className="right-comm-column" aria-label="脉冲概率雷达与神经通讯面板">
      {/* Dual-Suit (Black / Pink) Probability Telemetry */}
      {showDeckTracker && (
        <div className="cyber-window suit-radar-card" role="region" aria-label="双花色同花概率测算仪">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
              <Radar size={14} color="var(--accent-telemetry)" aria-hidden="true" />
              黑/粉未知脉冲分布（共 {suitStats.totalUnknown} 张未见）
            </span>
            <span className="win-pid">FLUSH_BOOST</span>
          </div>

          <div className="suit-meter-track" aria-hidden="true">
            <div className="suit-meter-black" style={{ width: `${suitStats.blackPct}%` }} />
            <div className="suit-meter-pink" style={{ width: `${suitStats.pinkPct}%` }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)' }}>
              <CyberSuitEmblem suit="B" size={13} />
              黑曜剩余 {suitStats.blackLeft} ({suitStats.blackPct}%)
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--neon-pink-300)',
              }}
            >
              <CyberSuitEmblem suit="P" size={13} />
              绯霓剩余 {suitStats.pinkLeft} ({suitStats.pinkPct}%)
            </span>
          </div>
        </div>
      )}

      {/* Live Neural Comm & LLM Psychological Chat Window */}
      <div className="cyber-window comm-chat-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <MessageSquareCode size={14} color="var(--accent-telemetry)" aria-hidden="true" />
            <span>神经通讯频道 · {opponentName}</span>
          </div>
          <button
            id="comm-btn-open-llm-settings"
            type="button"
            className={`cyber-badge ${llmEnabled ? 'cyan' : 'pink'}`}
            onClick={onOpenLlmModal}
            title="配置 LLM 模型网关与角色提示词"
          >
            <Settings2 size={11} aria-hidden="true" />
            {llmEnabled ? 'LLM实时驱动' : '接入LLM配置'}
          </button>
        </div>

        <div ref={scrollRef} className="chat-messages-scroll" role="log" aria-live="polite">
          {messages.map((m) => (
            <article key={m.id} className={`chat-bubble ${m.sender}`}>
              {m.sender !== 'system' && (
                <div className="chat-speaker-meta">
                  <span
                    style={{
                      color:
                        m.sender === 'human' ? 'var(--neon-cyan-300)' : 'var(--neon-pink-300)',
                    }}
                  >
                    {m.speakerName}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-subtle)' }}>
                    {m.fromLlm ? 'LLM' : m.tag === 'action' ? 'TACTIC' : 'SYNC'}
                  </span>
                </div>
              )}
              <div>{m.text}</div>
            </article>
          ))}

          {isSendingChat && (
            <div className="chat-bubble system" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} color="var(--accent-primary)" aria-hidden="true" />
              <span>{opponentName} 正在编解码神经信号...</span>
            </div>
          )}
        </div>

        {/* Tactical Quick Probes */}
        <div className="quick-probe-row" role="group" aria-label="快捷心理战话术">
          {QUICK_PROBES.map((p) => (
            <button
              key={p.id}
              id={`chat-quick-${p.id}`}
              type="button"
              className="probe-tag-btn"
              disabled={isSendingChat}
              onClick={() => onSendMessage(p.text)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chat Input Form */}
        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            submitChat();
          }}
        >
          <label htmlFor="chat-input-message" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            向对手发送心理战对话
          </label>
          <input
            id="chat-input-message"
            type="text"
            className="cyber-text-input"
            placeholder={`向 ${opponentName} 发送通讯或试探话术...`}
            value={draft}
            maxLength={160}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitChat();
              }
            }}
          />
          <button
            id="chat-btn-send"
            type="submit"
            className="os-nav-btn highlight"
            disabled={!draft.trim() || isSendingChat}
            aria-label="发送对话消息"
          >
            {llmEnabled ? <Bot size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            发送
          </button>
        </form>
      </div>
    </aside>
  );
}
