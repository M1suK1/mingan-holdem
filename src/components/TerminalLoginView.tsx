import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EscapeMapProgress } from '../engine/escapeMap.ts';
import type { CampaignState } from '../engine/types.ts';
import {
  buildHelpOutputLines,
  buildSaveSlotsSummaryLines,
  completeTerminalInput,
  deleteTerminalSlot,
  hasContinuableProgress,
  loadFromTerminalSlot,
  loadTerminalSaveSlots,
  parseTerminalCommand,
  resolveArchiveNodeCode,
  saveToTerminalSlot,
  type TerminalSaveSlot,
  type TerminalSettingsSubTarget,
} from '../engine/terminalLogin.ts';
import { MinganProtocolHeroLogo, NetrunnerBrandLogo } from './CyberIcons.tsx';

interface TerminalLogLine {
  id: string;
  tone: 'sys' | 'ok' | 'warn' | 'err' | 'cmd';
  text: string;
}

interface TerminalLoginViewProps {
  escapeProgress: EscapeMapProgress;
  campaign: CampaignState;
  onStartNewGame: () => void;
  onContinueGame: (target: 'arena' | 'escape-map') => void;
  onApplyLoadedSlot: (slot: TerminalSaveSlot) => void;
  onOpenSettings: (subTarget: TerminalSettingsSubTarget) => void;
  onReturnToDesktop: () => void;
  onPlayUiClick?: () => void;
}

function makeInitialLogLines(
  escapeProgress: EscapeMapProgress,
  campaign: CampaignState
): TerminalLogLine[] {
  const canContinue = hasContinuableProgress(escapeProgress);
  const nodeCode = resolveArchiveNodeCode(escapeProgress);
  return [
    {
      id: 'tty-init-1',
      tone: 'sys',
      text: '[SYS] HANDSHAKE OK :: BLACK_DOMAIN_NODE :: AUTH=READY',
    },
    {
      id: 'tty-init-2',
      tone: canContinue ? 'ok' : 'sys',
      text: canContinue
        ? `[AUTH] 壳层签名 ${campaign.playerCodename} :: 检测到本地档案 ${nodeCode}（已突破 ${escapeProgress.clearedIndices.length}/5 节点）`
        : `[AUTH] 壳层签名 ${campaign.playerCodename} :: 尚未接入黑域（全新未初始化档案）`,
    },
    {
      id: 'tty-init-3',
      tone: 'warn',
      text: '[GUIDE] 请在下方输入 /help 获取完整指令帮助（或输入 /new · /continue · /save · /settings）。',
    },
  ];
}

export function TerminalLoginView({
  escapeProgress,
  campaign,
  onStartNewGame,
  onContinueGame,
  onApplyLoadedSlot,
  onOpenSettings,
  onReturnToDesktop,
  onPlayUiClick,
}: TerminalLoginViewProps) {
  const [lines, setLines] = useState<TerminalLogLine[]>(() =>
    makeInitialLogLines(escapeProgress, campaign)
  );
  const [inputVal, setInputVal] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [slots, setSlots] = useState<TerminalSaveSlot[]>(() => loadTerminalSaveSlots());
  const [pendingActionConfirm, setPendingActionConfirm] = useState<
    | null
    | { type: 'new' }
    | { type: 'delete'; slotId: 1 | 2 | 3 }
  >(null);

  const feedRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const appendLines = (newLines: Array<{ tone: TerminalLogLine['tone']; text: string }>) => {
    const base = Date.now();
    setLines((prev) =>
      [
        ...prev,
        ...newLines.map((item, idx) => ({
          id: `tty-${base}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          tone: item.tone,
          text: item.text,
        })),
      ].slice(-120)
    );
  };

  const runCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;
    onPlayUiClick?.();

    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 29)]);
    setHistoryCursor(-1);
    setInputVal('');

    const parsed = parseTerminalCommand(trimmed);
    const echo = { tone: 'cmd' as const, text: `root@mingan:~# ${trimmed}` };

    if (parsed.kind === 'empty') return;

    if (parsed.kind === 'help') {
      setPendingActionConfirm(null);
      appendLines([
        echo,
        ...buildHelpOutputLines().map((line) => ({ tone: 'sys' as const, text: line })),
      ]);
      return;
    }

    if (parsed.kind === 'clear') {
      setPendingActionConfirm(null);
      setLines([
        {
          id: `tty-clr-${Date.now()}`,
          tone: 'sys',
          text: '[SYS] 终端屏幕已清空。输入 /help 查看所有可用指令。',
        },
      ]);
      return;
    }

    if (parsed.kind === 'desktop') {
      setPendingActionConfirm(null);
      appendLines([echo, { tone: 'ok', text: '[OK] 正在断开黑域协议终端，切回 MINGAN-OS 桌面...' }]);
      onReturnToDesktop();
      return;
    }

    if (parsed.kind === 'settings') {
      setPendingActionConfirm(null);
      appendLines([
        echo,
        {
          tone: 'ok',
          text: `[OK] 正在打开系统设置模块（${parsed.subTarget}）...`,
        },
      ]);
      onOpenSettings(parsed.subTarget);
      return;
    }

    if (parsed.kind === 'new') {
      const canContinue = hasContinuableProgress(escapeProgress);
      if (canContinue && !parsed.confirm) {
        setPendingActionConfirm({ type: 'new' });
        appendLines([
          echo,
          {
            tone: 'warn',
            text: `[WARN] 检测到当前存在逃亡进度（${resolveArchiveNodeCode(escapeProgress)} · ${escapeProgress.clearedIndices.length}/5 节点）。`,
          },
          {
            tone: 'warn',
            text: '请输入 /new confirm 确认清空当前自动档并开启全新逃亡，或先用 /save 1 备份！',
          },
        ]);
        return;
      }
      setPendingActionConfirm(null);
      appendLines([
        echo,
        { tone: 'ok', text: '[OK] 正在初始化全新黑域壳层，接入 SEC-00 公共暗区野桌...' },
      ]);
      onStartNewGame();
      return;
    }

    if (parsed.kind === 'continue') {
      setPendingActionConfirm(null);
      if (!hasContinuableProgress(escapeProgress) && parsed.target === 'escape-map') {
        appendLines([
          echo,
          {
            tone: 'warn',
            text: '[WARN] 当前尚无已解锁逃亡路线进度，请先输入 /new 开启 SEC-00 新手终端！',
          },
        ]);
        return;
      }
      if (!hasContinuableProgress(escapeProgress)) {
        appendLines([
          echo,
          {
            tone: 'warn',
            text: '[WARN] 本地暂无已通关记录。已为您提示：输入 /new 开始全新游戏，或可先行输入 /load <1|2|3> 读取已有记忆槽。',
          },
        ]);
        return;
      }
      appendLines([
        echo,
        {
          tone: 'ok',
          text: `[OK] 正在恢复节点 ${resolveArchiveNodeCode(escapeProgress)} 连接...`,
        },
      ]);
      onContinueGame(parsed.target);
      return;
    }

    if (parsed.kind === 'save-list') {
      setPendingActionConfirm(null);
      const latestSlots = loadTerminalSaveSlots();
      setSlots(latestSlots);
      appendLines([
        echo,
        ...buildSaveSlotsSummaryLines(latestSlots, escapeProgress, campaign).map((line) => ({
          tone: 'sys' as const,
          text: line,
        })),
      ]);
      return;
    }

    if (parsed.kind === 'save-write') {
      setPendingActionConfirm(null);
      const nextSlots = saveToTerminalSlot(
        parsed.slotId,
        escapeProgress,
        campaign,
        parsed.label
      );
      setSlots(nextSlots);
      const savedEntry = nextSlots.find((s) => s.slotId === parsed.slotId);
      appendLines([
        echo,
        {
          tone: 'ok',
          text: `[OK] 已将当前进度（${savedEntry?.nodeCode ?? 'SEC-00'} · ${savedEntry?.label ?? ''}）加密写入 SLOT-${parsed.slotId}。`,
        },
      ]);
      return;
    }

    if (parsed.kind === 'save-load') {
      setPendingActionConfirm(null);
      const loaded = loadFromTerminalSlot(parsed.slotId);
      if (!loaded) {
        appendLines([
          echo,
          {
            tone: 'err',
            text: `[ERR] SLOT-${parsed.slotId} 为空，请先使用 /save ${parsed.slotId} 创建存档快照。`,
          },
        ]);
        return;
      }
      onApplyLoadedSlot(loaded);
      appendLines([
        echo,
        {
          tone: 'ok',
          text: `[OK] 已读取 SLOT-${parsed.slotId}「${loaded.label}」（${loaded.nodeCode}）。现在可输入 /continue 接入该档案！`,
        },
      ]);
      return;
    }

    if (parsed.kind === 'save-delete') {
      const targetSlot = slots.find((s) => s.slotId === parsed.slotId);
      if (!targetSlot) {
        setPendingActionConfirm(null);
        appendLines([
          echo,
          { tone: 'warn', text: `[WARN] SLOT-${parsed.slotId} 本身为空，无需清除。` },
        ]);
        return;
      }
      if (!parsed.confirm) {
        setPendingActionConfirm({ type: 'delete', slotId: parsed.slotId });
        appendLines([
          echo,
          {
            tone: 'warn',
            text: `[WARN] 即将清除 SLOT-${parsed.slotId}「${targetSlot.label}」，请输入 /delete ${parsed.slotId} confirm 确认。`,
          },
        ]);
        return;
      }
      setPendingActionConfirm(null);
      const nextSlots = deleteTerminalSlot(parsed.slotId);
      setSlots(nextSlots);
      appendLines([
        echo,
        { tone: 'ok', text: `[OK] 已擦除记忆存档槽 SLOT-${parsed.slotId}。` },
      ]);
      return;
    }

    if (parsed.kind === 'invalid-arg') {
      setPendingActionConfirm(null);
      appendLines([echo, { tone: 'err', text: `[ERR] ${parsed.message}` }]);
      return;
    }

    setPendingActionConfirm(null);
    appendLines([
      echo,
      {
        tone: 'err',
        text: `[ERR] 未识别指令 "${parsed.raw}"。请输入 /help 查看可用指令。`,
      },
    ]);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    runCommand(inputVal);
  };

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const completed = completeTerminalInput(inputVal);
      setInputVal(completed);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (cmdHistory.length === 0) return;
      e.preventDefault();
      const nextIdx = Math.min(cmdHistory.length - 1, historyCursor + 1);
      setHistoryCursor(nextIdx);
      setInputVal(cmdHistory[nextIdx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      if (historyCursor < 0) return;
      e.preventDefault();
      const nextIdx = historyCursor - 1;
      setHistoryCursor(nextIdx);
      setInputVal(nextIdx >= 0 ? (cmdHistory[nextIdx] ?? '') : '');
    }
  };

  const canContinue = hasContinuableProgress(escapeProgress);
  const archiveNodeCode = resolveArchiveNodeCode(escapeProgress);

  return (
    <section
      id="terminal-login-screen"
      className="px-tty-shell"
      role="main"
      aria-label="黑域协议网终端登录开始界面"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="px-tty-frame">
        {/* Top Terminal Title Strip */}
        <header className="px-tty-titlebar">
          <div className="px-tty-title-left">
            <NetrunnerBrandLogo size={16} />
            <span>MINGAN_NET // TTY-01 :: AUTH_GATEWAY</span>
          </div>
          <div className="px-tty-title-right">
            <span className="px-tty-status-badge is-live">LINK: ONLINE</span>
            <span className="px-tty-status-badge">
              {canContinue
                ? `ARCHIVE: ${archiveNodeCode} (${escapeProgress.clearedIndices.length}/5)`
                : 'ARCHIVE: NEW_SHELL'}
            </span>
          </div>
        </header>

        {/* Hero Logo + Game Name Banner */}
        <div className="px-tty-hero">
          <div className="px-tty-hero-logo-wrap">
            <MinganProtocolHeroLogo size={74} />
          </div>
          <div className="px-tty-hero-copy">
            <h1 className="lc-glitch-title px-tty-game-title">黑域协议：替壳者</h1>
            <div className="px-tty-game-subtitle">
              MINGAN PROTOCOL // BLACK_DOMAIN ACCESS TERMINAL
            </div>
            <div className="px-tty-help-hint">
              提示：输入 <code>/help</code> 获取指令帮助 · 输入 <code>/new</code>{' '}
              <code>/continue</code> <code>/save</code> <code>/settings</code> 启动或配置终端
            </div>
          </div>
        </div>

        {/* Interactive Terminal Output Log */}
        <div
          ref={feedRef}
          className="px-tty-log"
          role="log"
          aria-live="polite"
          aria-label="终端输出日志"
        >
          {lines.map((line) => (
            <div key={line.id} className={`px-tty-line is-${line.tone}`}>
              {line.text}
            </div>
          ))}
        </div>

        {/* Optional Quick Confirm Strip when awaiting confirmation */}
        {pendingActionConfirm && (
          <div className="px-tty-confirm-bar" role="region" aria-label="指令二次确认">
            <span>
              {pendingActionConfirm.type === 'new'
                ? '确认覆盖现有实时进度并重新开始 SEC-00 吗？'
                : `确认永久擦除存档槽 SLOT-${pendingActionConfirm.slotId} 吗？`}
            </span>
            <button
              id="terminal-btn-confirm-pending"
              type="button"
              className="px-tty-chip is-danger"
              onClick={() => {
                if (pendingActionConfirm.type === 'new') {
                  runCommand('/new confirm');
                } else {
                  runCommand(`/delete ${pendingActionConfirm.slotId} confirm`);
                }
              }}
            >
              {pendingActionConfirm.type === 'new' ? '确认执行 /new confirm' : '确认清除'}
            </button>
            <button
              id="terminal-btn-cancel-pending"
              type="button"
              className="px-tty-chip"
              onClick={() => {
                setPendingActionConfirm(null);
                appendLines([{ tone: 'sys', text: '[SYS] 已取消高危指令操作。' }]);
              }}
            >
              取消
            </button>
          </div>
        )}

        {/* Quick Command Guidance Chips */}
        <div className="px-tty-chips-row" role="group" aria-label="引导指令快捷按钮">
          <button
            id="terminal-chip-help"
            type="button"
            className="px-tty-chip is-cyan"
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/help');
            }}
          >
            /help 指令帮助
          </button>
          <button
            id="terminal-chip-new"
            type="button"
            className="px-tty-chip is-emerald"
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/new');
            }}
          >
            /new 新游戏
          </button>
          <button
            id="terminal-chip-continue"
            type="button"
            className={`px-tty-chip ${canContinue ? 'is-cyan' : 'is-muted'}`}
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/continue');
            }}
          >
            /continue 继续游戏{canContinue ? ` (${archiveNodeCode})` : ''}
          </button>
          <button
            id="terminal-chip-save"
            type="button"
            className="px-tty-chip is-amber"
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/save');
            }}
          >
            /save 存档管理 ({slots.length}/3)
          </button>
          <button
            id="terminal-chip-settings"
            type="button"
            className="px-tty-chip"
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/settings');
            }}
          >
            /settings 系统设置
          </button>
          <button
            id="terminal-chip-desktop"
            type="button"
            className="px-tty-chip"
            onClick={(e) => {
              e.stopPropagation();
              runCommand('/desktop');
            }}
          >
            /desktop 返回桌面
          </button>
        </div>

        {/* Bottom CLI Prompt Input */}
        <form
          className="px-tty-input-form"
          onSubmit={handleFormSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <label htmlFor="terminal-login-input" className="px-tty-prompt">
            root@mingan:~#
          </label>
          <input
            id="terminal-login-input"
            ref={inputRef}
            type="text"
            className="px-tty-input"
            placeholder="输入 /help 查看指令，按 Tab 补全，Enter 执行..."
            value={inputVal}
            maxLength={120}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <button id="terminal-login-submit" type="submit" className="px-tty-submit-btn">
            执行
          </button>
        </form>
      </div>
    </section>
  );
}

export default TerminalLoginView;
