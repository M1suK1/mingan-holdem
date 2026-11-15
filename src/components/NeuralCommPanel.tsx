import { useEffect, useRef, useState } from 'react';
import { Activity, Bot, MessageSquareCode, Radar, Send, Settings2 } from 'lucide-react';
import type { SuitStats } from '../engine/types.ts';
import type { ChatMessage } from '../engine/llmClient.ts';
import { CyberSuitEmblem } from './CyberIcons.tsx';
import { PixelWindow } from './PixelWindow.tsx';

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
  { id: 'probe-hand', label: '试探底牌', text: '你刚才换进去的那张私有暗牌，该不会凑齐两对以上了吧？' },
  { id: 'probe-bluff', label: '心理施压', text: '算力池已经在持续充能了，现在断连认输还来得及。' },
  { id: 'probe-lore', label: '询问档案', text: '报上你在夜糖事务所的契约代号和拿手绝活吧。' },
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
    <aside className="right-comm-column" aria-label="脉冲雷达与神经通讯窗口组">
      {showDeckTracker && (
        <PixelWindow
          title={`双色脉冲雷达 (${suitStats.totalUnknown}未见)`}
          code="RADAR.SYS"
          accentColor="#19384a"
          icon={<Radar size={13} color="var(--accent-telemetry)" aria-hidden="true" />}
        >
          <div className="suit-meter-track" aria-hidden="true">
            <div className="suit-meter-black" style={{ width: `${suitStats.blackPct}%` }} />
            <div className="suit-meter-pink" style={{ width: `${suitStats.pinkPct}%` }} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CyberSuitEmblem suit="B" size={13} />
              黑曜 {suitStats.blackLeft} ({suitStats.blackPct}%)
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--neon-pink-300)',
              }}
            >
              <CyberSuitEmblem suit="P" size={13} />
              绯霓 {suitStats.pinkLeft} ({suitStats.pinkPct}%)
            </span>
          </div>
        </PixelWindow>
      )}

      <PixelWindow
        title={`神经通讯 · ${opponentName}`}
        accentColor="#2d1d4c"
        icon={<MessageSquareCode size={13} color="var(--accent-telemetry)" aria-hidden="true" />}
        className="comm-chat-window"
        headerRight={
          <button
            id="comm-btn-open-llm-settings"
            type="button"
            className={`cyber-badge ${llmEnabled ? 'cyan' : 'pink'}`}
            style={{ padding: '1px 6px', fontSize: 10 }}
            onClick={onOpenLlmModal}
          >
            <Settings2 size={10} aria-hidden="true" />
            {llmEnabled ? 'LLM在线' : 'LLM设置'}
          </button>
        }
      >
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
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9.5, color: 'var(--text-subtle)' }}>
                    {m.fromLlm ? 'LLM' : m.tag === 'action' ? 'ACT' : 'MSG'}
                  </span>
                </div>
              )}
              <div>{m.text}</div>
            </article>
          ))}

          {isSendingChat && (
            <div className="chat-bubble system" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} color="var(--accent-primary)" aria-hidden="true" />
              <span>{opponentName} 正在编解码通讯回复...</span>
            </div>
          )}
        </div>

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

        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            submitChat();
          }}
        >
          <label
            htmlFor="chat-input-message"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
            }}
          >
            向对手发送心理战对话
          </label>
          <input
            id="chat-input-message"
            type="text"
            className="cyber-text-input"
            placeholder={`向 ${opponentName} 发送指令或话术...`}
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
            {llmEnabled ? <Bot size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            发送
          </button>
        </form>
      </PixelWindow>
    </aside>
  );
}
