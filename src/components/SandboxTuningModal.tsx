import { useState } from 'react';
import { RotateCcw, Sliders, X } from 'lucide-react';
import {
  DEFAULT_CONFIG,
  type AiCheatProfile,
  type AiDifficulty,
  type AiPlayStyle,
  type AiStyle,
  type BattleSituation,
  type GameConfig,
  type SwapFeeMode,
} from '../engine/types.ts';

interface SandboxTuningModalProps {
  config: GameConfig;
  onApplyLive: (partial: Partial<GameConfig>) => void;
  onApplyAndRestart: (nextConfig: GameConfig) => void;
  onClose: () => void;
}

export default function SandboxTuningModal({
  config,
  onApplyLive,
  onApplyAndRestart,
  onClose,
}: SandboxTuningModalProps) {
  const [draft, setDraft] = useState<GameConfig>({ ...config });

  const updateNum = (key: keyof GameConfig, rawVal: number, min = 0) => {
    const clean = Number.isFinite(rawVal) ? Math.max(min, Math.floor(rawVal)) : min;
    setDraft((prev) => ({ ...prev, [key]: clean }));
  };

  const applyPreset = (preset: 'standard' | 'blitz' | 'deep') => {
    if (preset === 'standard') {
      setDraft({ ...DEFAULT_CONFIG });
    } else if (preset === 'blitz') {
      setDraft({
        ...DEFAULT_CONFIG,
        startingChips: 220,
        ante: 10,
        swapFeeMode: 'fixed',
        fixedSwapFee: 15,
        aiDelayMs: 180,
      });
    } else {
      setDraft({
        ...DEFAULT_CONFIG,
        startingChips: 2500,
        ante: 25,
        earlyRaiseCap: 50,
        midRaiseCap: 100,
        riverRaiseCap: 250,
        minRaise: 25,
        escalatingSwapFees: [40, 80, 120],
      });
    }
  };

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tuning-modal-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <Sliders size={15} color="var(--accent-primary)" aria-hidden="true" />
            <span id="tuning-modal-title">沙盒数值调优与战况环境测试台</span>
          </div>
          <button
            id="tuning-modal-btn-close"
            type="button"
            className="os-nav-btn"
            onClick={onClose}
            aria-label="关闭沙盒调优台"
          >
            <X size={15} aria-hidden="true" />
            关闭
          </button>
        </div>

        <div className="modal-content-scroll">
          {/* Live Instant Toggles */}
          <div className="cyber-panel-box">
            <strong style={{ fontSize: 13, color: 'var(--accent-telemetry)' }}>
              即时调试开关（修改后无需重开立即生效）
            </strong>

            <div className="form-field-row">
              <label htmlFor="tuning-check-reveal-hidden">
                黑客全知透视：直接显示对手暗牌与桌面未翻开加密节点
              </label>
              <input
                id="tuning-check-reveal-hidden"
                type="checkbox"
                checked={draft.revealOpponentHidden}
                onChange={(e) => {
                  const revealOpponentHidden = e.target.checked;
                  setDraft((p) => ({ ...p, revealOpponentHidden }));
                  onApplyLive({ revealOpponentHidden });
                }}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-check-deck-tracker">
                显示右侧黑曜/绯霓未知脉冲概率雷达
              </label>
              <input
                id="tuning-check-deck-tracker"
                type="checkbox"
                checked={draft.showDeckTracker}
                onChange={(e) => {
                  const showDeckTracker = e.target.checked;
                  setDraft((p) => ({ ...p, showDeckTracker }));
                  onApplyLive({ showDeckTracker });
                }}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-situation">赛博战况动态背景预览</label>
              <select
                id="tuning-select-situation"
                className="cyber-select"
                value={draft.situationOverride}
                onChange={(e) => {
                  const situationOverride = e.target.value as BattleSituation | 'auto';
                  setDraft((p) => ({ ...p, situationOverride }));
                  onApplyLive({ situationOverride });
                }}
              >
                <option value="auto">自动随战况实时演化（默认）</option>
                <option value="recon">阶段一：侦察潜伏</option>
                <option value="intrusion">阶段二：协议交锋</option>
                <option value="overclock">阶段三：算力过载</option>
                <option value="breach">阶段四：全下核心熔断</option>
                <option value="victory">结算态：破译接管</option>
                <option value="disconnect">结算态：链路受阻</option>
              </select>
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-aidifficulty">本地 AI 博弈难度</label>
              <select
                id="tuning-select-aidifficulty"
                className="cyber-select"
                value={draft.aiDifficulty ?? 'auto'}
                onChange={(e) => {
                  const aiDifficulty = e.target.value as AiDifficulty;
                  setDraft((p) => ({ ...p, aiDifficulty }));
                  onApplyLive({ aiDifficulty });
                }}
              >
                <option value="auto">自动随追捕威胁度递增（T1新兵 / T2标准 / T3+大师）</option>
                <option value="rookie">T1 · 协议新兵（休闲启发式，较少改牌扫描）</option>
                <option value="standard">T2 · 战术猎手（结合黑粉分布与收益判断）</option>
                <option value="master">T3 · 协议裁决者（蒙特卡洛胜率+精准改牌+嫌疑扫描）</option>
              </select>
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-playstyle">本地 AI 出牌流派</label>
              <select
                id="tuning-select-playstyle"
                className="cyber-select"
                value={draft.aiPlayStyle ?? 'auto'}
                onChange={(e) => {
                  const aiPlayStyle = e.target.value as AiPlayStyle;
                  setDraft((p) => ({ ...p, aiPlayStyle }));
                  onApplyLive({ aiPlayStyle });
                }}
              >
                <option value="auto">自动随追捕者派系与属性匹配</option>
                <option value="pressure">强攻掠夺（高频加注 · 半池压迫 · 敢半诈唬）</option>
                <option value="trap">控池陷阱（早段强牌慢打 · 河牌重注收割）</option>
                <option value="sculptor">换牌重组（重度明暗换牌 · 锁死私有核心）</option>
                <option value="conservative">稳健精算（严守胜率赔率 · 逆风果断弃牌）</option>
              </select>
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-cheatprofile">本地 AI 作弊与扫描倾向</label>
              <select
                id="tuning-select-cheatprofile"
                className="cyber-select"
                value={draft.aiCheatProfile ?? 'auto'}
                onChange={(e) => {
                  const aiCheatProfile = e.target.value as AiCheatProfile;
                  setDraft((p) => ({ ...p, aiCheatProfile }));
                  onApplyLive({ aiCheatProfile });
                }}
              >
                <option value="auto">自动随追捕者派系与特性匹配</option>
                <option value="auditor">守序审计（零改牌作弊 · 极敏高频扫描抓包）</option>
                <option value="phantom-hacker">潜行改牌（高改牌率 · 改后主动换入公共池设陷）</option>
                <option value="opportunist">精准机会（平常隐忍 · 关键质变节点突袭改牌）</option>
                <option value="disruptor">乱序施压（改牌+加注扰频 · 专盯私有暗牌反扫）</option>
              </select>
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-aistyle">基础激进偏置</label>
              <select
                id="tuning-select-aistyle"
                className="cyber-select"
                value={draft.aiStyle}
                onChange={(e) => {
                  const aiStyle = e.target.value as AiStyle;
                  setDraft((p) => ({ ...p, aiStyle }));
                  onApplyLive({ aiStyle });
                }}
              >
                <option value="balanced">均衡测算型</option>
                <option value="aggressive">高压诈唬型</option>
                <option value="cautious">稳健防守型</option>
              </select>
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-aidelay">AI 动作延迟节奏</label>
              <select
                id="tuning-select-aidelay"
                className="cyber-select"
                value={draft.aiDelayMs}
                onChange={(e) => {
                  const aiDelayMs = Number(e.target.value);
                  setDraft((p) => ({ ...p, aiDelayMs }));
                  onApplyLive({ aiDelayMs });
                }}
              >
                <option value={80}>80 ms（极速连测）</option>
                <option value={360}>360 ms（爽快节奏）</option>
                <option value={680}>680 ms（标准演出）</option>
                <option value={1200}>1200 ms（慢速观察动画）</option>
              </select>
            </div>
          </div>

          {/* Presets */}
          <div className="cyber-panel-box">
            <strong style={{ fontSize: 13, color: 'var(--neon-pink-300)' }}>
              数值预设模板（选择后点击底部“应用数值并重开牌局”）
            </strong>
            <div className="cmd-grid">
              <button
                id="tuning-preset-standard"
                type="button"
                className="os-nav-btn"
                style={{ justifyContent: 'center' }}
                onClick={() => applyPreset('standard')}
              >
                标准实战 (1000算力)
              </button>
              <button
                id="tuning-preset-blitz"
                type="button"
                className="os-nav-btn"
                style={{ justifyContent: 'center' }}
                onClick={() => applyPreset('blitz')}
              >
                短码速测 (220算力)
              </button>
              <button
                id="tuning-preset-deep"
                type="button"
                className="os-nav-btn"
                style={{ justifyContent: 'center' }}
                onClick={() => applyPreset('deep')}
              >
                高额深筹 (2500算力)
              </button>
            </div>
          </div>

          {/* Detailed Economy & Cap Parameters */}
          <div className="cyber-panel-box">
            <strong style={{ fontSize: 13, color: '#ffffff' }}>核心经济与阶梯限注参数</strong>

            <div className="form-field-row">
              <label htmlFor="tuning-input-starting-chips">双方初始算力</label>
              <input
                id="tuning-input-starting-chips"
                type="number"
                className="cyber-num-input"
                value={draft.startingChips}
                onChange={(e) => updateNum('startingChips', Number(e.target.value), 20)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-ante">每局强制底注 (Ante)</label>
              <input
                id="tuning-input-ante"
                type="number"
                className="cyber-num-input"
                value={draft.ante}
                onChange={(e) => updateNum('ante', Number(e.target.value), 1)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-select-swapmode">覆写换牌计费模式</label>
              <select
                id="tuning-select-swapmode"
                className="cyber-select"
                value={draft.swapFeeMode}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, swapFeeMode: e.target.value as SwapFeeMode }))
                }
              >
                <option value="escalating">个人累计递增（第1/2/3次）</option>
                <option value="fixed">固定单次收费</option>
              </select>
            </div>

            {draft.swapFeeMode === 'fixed' ? (
              <div className="form-field-row">
                <label htmlFor="tuning-input-fixed-swap">固定换牌门票费用</label>
                <input
                  id="tuning-input-fixed-swap"
                  type="number"
                  className="cyber-num-input"
                  value={draft.fixedSwapFee}
                  onChange={(e) => updateNum('fixedSwapFee', Number(e.target.value), 0)}
                />
              </div>
            ) : (
              <div className="form-field-row">
                <span>递增换牌费用（第1 / 2 / 3次）</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map((idx) => (
                    <input
                      key={idx}
                      id={`tuning-input-esc-fee-${idx}`}
                      type="number"
                      aria-label={`第${idx + 1}次换牌费用`}
                      className="cyber-num-input"
                      style={{ width: 68 }}
                      value={draft.escalatingSwapFees[idx]}
                      onChange={(e) => {
                        const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setDraft((p) => {
                          const nextFees = [...p.escalatingSwapFees] as [number, number, number];
                          nextFees[idx] = val;
                          return { ...p, escalatingSwapFees: nextFees };
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="form-field-row">
              <label htmlFor="tuning-input-early-cap">前期单次加注上限（3~4张暗牌）</label>
              <input
                id="tuning-input-early-cap"
                type="number"
                className="cyber-num-input"
                value={draft.earlyRaiseCap}
                onChange={(e) => updateNum('earlyRaiseCap', Number(e.target.value), 5)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-mid-cap">中期单次加注上限（1~2张暗牌）</label>
              <input
                id="tuning-input-mid-cap"
                type="number"
                className="cyber-num-input"
                value={draft.midRaiseCap}
                onChange={(e) => updateNum('midRaiseCap', Number(e.target.value), 5)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-river-cap">河牌圈单次加注上限（0张暗牌）</label>
              <input
                id="tuning-input-river-cap"
                type="number"
                className="cyber-num-input"
                value={draft.riverRaiseCap}
                onChange={(e) => updateNum('riverRaiseCap', Number(e.target.value), 5)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-min-raise">最小加注步长</label>
              <input
                id="tuning-input-min-raise"
                type="number"
                className="cyber-num-input"
                value={draft.minRaise}
                onChange={(e) => updateNum('minRaise', Number(e.target.value), 1)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-subphase-raises">暗牌未减前累计加注次数封顶</label>
              <input
                id="tuning-input-subphase-raises"
                type="number"
                className="cyber-num-input"
                value={draft.maxRaisesPerSubPhase}
                onChange={(e) => updateNum('maxRaisesPerSubPhase', Number(e.target.value), 1)}
              />
            </div>

            <div className="form-field-row">
              <label htmlFor="tuning-input-river-raises">终局河牌圈加注次数封顶</label>
              <input
                id="tuning-input-river-raises"
                type="number"
                className="cyber-num-input"
                value={draft.maxRiverRaises}
                onChange={(e) => updateNum('maxRiverRaises', Number(e.target.value), 1)}
              />
            </div>
          </div>

          <div className="cmd-grid cols-2">
            <button
              id="tuning-btn-restore-defaults"
              type="button"
              className="cyber-cmd-btn"
              onClick={() => setDraft({ ...DEFAULT_CONFIG })}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={14} aria-hidden="true" /> 恢复标准默认参数
              </span>
            </button>
            <button
              id="tuning-btn-apply-restart"
              type="button"
              className="cyber-cmd-btn primary-pink"
              onClick={() => onApplyAndRestart(draft)}
            >
              应用参数并重开新战局
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
