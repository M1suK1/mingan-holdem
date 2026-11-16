import { useEffect, useRef, useState } from 'react';
import { DEBUG_CHEAT_COMMANDS } from '../engine/debugCmd.ts';

export interface DebugCmdLogEntry {
  id: string;
  tone: 'info' | 'success' | 'error' | 'cmd';
  text: string;
}

interface DebugCmdModalProps {
  logs: DebugCmdLogEntry[];
  onExecute: (rawCommand: string) => void;
  onClose: () => void;
}

export default function DebugCmdModal({ logs, onExecute, onClose }: DebugCmdModalProps) {
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const submitCommand = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setCmdHistory((prev) => [trimmed, ...prev].slice(0, 30));
    setHistoryCursor(-1);
    setInput('');
    onExecute(trimmed);
  };

  return (
    <div
      className="lc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmd-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lc-hud-box lc-cmd-modal">
        <header className="lc-cmd-header">
          <div className="lc-cmd-title-group">
            <span className="lc-cmd-prompt-badge" aria-hidden="true">
              &gt;_
            </span>
            <div>
              <h2 id="cmd-modal-title" className="lc-cmd-title">
                黑域调试控制台 // DEBUG CMD
              </h2>
              <p className="lc-cmd-subtitle">
                输入作弊码或点击下方快捷指令（按 ~ / Esc 开关）
              </p>
            </div>
          </div>
          <button
            id="cmd-btn-close"
            type="button"
            className="lc-escape-btn"
            onClick={onClose}
            aria-label="关闭调试控制台"
          >
            关闭 [ESC]
          </button>
        </header>

        <div className="lc-cmd-quick-bar" role="group" aria-label="快捷作弊码">
          {DEBUG_CHEAT_COMMANDS.map((item, idx) => (
            <button
              key={item.quickCmd}
              id={`cmd-quick-btn-${idx}`}
              type="button"
              className={`lc-cmd-quick-chip ${item.quickCmd === 'win' ? 'is-primary' : ''}`}
              title={item.desc}
              onClick={() => submitCommand(item.quickCmd)}
            >
              {item.quickCmd}
            </button>
          ))}
        </div>

        <div
          ref={logBoxRef}
          className="lc-cmd-log-box"
          role="log"
          aria-live="polite"
          aria-label="控制台输出日志"
        >
          {logs.map((entry) => (
            <div key={entry.id} className={`lc-cmd-log-line tone-${entry.tone}`}>
              {entry.text}
            </div>
          ))}
        </div>

        <form
          className="lc-cmd-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            submitCommand(input);
          }}
        >
          <label htmlFor="cmd-terminal-input" className="lc-cmd-input-prefix">
            ROOT@BLACK-DOMAIN:~#
          </label>
          <input
            ref={inputRef}
            id="cmd-terminal-input"
            type="text"
            className="lc-cmd-input"
            placeholder="输入 win 直接过关，或输入 help 查看全部作弊码..."
            value={input}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
              }
              if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
                e.preventDefault();
                const nextIdx = Math.min(cmdHistory.length - 1, historyCursor + 1);
                setHistoryCursor(nextIdx);
                setInput(cmdHistory[nextIdx] ?? '');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyCursor <= 0) {
                  setHistoryCursor(-1);
                  setInput('');
                } else {
                  const nextIdx = historyCursor - 1;
                  setHistoryCursor(nextIdx);
                  setInput(cmdHistory[nextIdx] ?? '');
                }
              }
            }}
          />
          <button id="cmd-btn-execute" type="submit" className="lc-cmd-exec-btn">
            执行
          </button>
        </form>
      </div>
    </div>
  );
}
