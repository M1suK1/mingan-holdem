import { useState } from 'react';
import { BookOpen, History, Layers, X } from 'lucide-react';
import type { ActionLogEntry, GameConfig } from '../engine/types.ts';
import { CyberSuitEmblem } from './CyberIcons.tsx';

interface ProtocolManualModalProps {
  initialTab?: 'suits' | 'rules' | 'audit';
  config: GameConfig;
  history: ActionLogEntry[];
  onClose: () => void;
}

const HAND_TIERS = [
  { rank: '01', name: '同花顺', desc: '同一花色（全黑或全粉）且点数连续的 5 张不同点数牌' },
  { rank: '02', name: '四条', desc: '4 张相同点数的牌（2张黑曜 + 2张绯霓）加 1 张踢脚牌' },
  { rank: '03', name: '葫芦', desc: '3 张相同点数加另外 2 张相同点数' },
  { rank: '04', name: '同花（概率大幅提升）', desc: '任意 5 张同为黑曜或同为绯霓的牌（允许含同色对子）' },
  { rank: '05', name: '顺子', desc: '5 张点数连续的牌（支持 A-2-3-4-5 最小顺与 10-J-Q-K-A 最大顺）' },
  { rank: '06', name: '三条', desc: '3 张相同点数的牌加 2 张单牌' },
  { rank: '07', name: '两对', desc: '2 组不同点数的对子加 1 张单牌' },
  { rank: '08', name: '一对', desc: '2 张相同点数的牌加 3 张单牌' },
  { rank: '09', name: '高牌', desc: '未组成以上牌型时，按最大单牌依次比大小' },
];

export default function ProtocolManualModal({
  initialTab = 'rules',
  config,
  history,
  onClose,
}: ProtocolManualModalProps) {
  const [tab, setTab] = useState<'suits' | 'rules' | 'audit'>(initialTab);
  const [actorFilter, setActorFilter] = useState<'all' | 'human' | 'ai' | 'system'>('all');

  const feeDesc =
    config.swapFeeMode === 'fixed'
      ? `固定每次 ${config.fixedSwapFee}`
      : `递增收费 ${config.escalatingSwapFees.join(' / ')}`;

  const filteredLogs = [...history]
    .reverse()
    .filter((item) => actorFilter === 'all' || item.actor === actorFilter);

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protocol-modal-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <BookOpen size={15} color="var(--accent-telemetry)" aria-hidden="true" />
            <span id="protocol-modal-title">黑域协议手册 · 双色牌组矩阵与入侵审计流水</span>
          </div>
          <button
            id="protocol-modal-btn-close"
            type="button"
            className="os-nav-btn"
            onClick={onClose}
            aria-label="关闭协议手册"
          >
            <X size={15} aria-hidden="true" />
            关闭
          </button>
        </div>

        <div className="modal-tab-strip" role="tablist">
          <button
            id="protocol-tab-rules"
            type="button"
            role="tab"
            aria-selected={tab === 'rules'}
            className={`modal-tab-btn ${tab === 'rules' ? 'active' : ''}`}
            onClick={() => setTab('rules')}
          >
            <BookOpen size={14} aria-hidden="true" />
            明暗博弈完整规则
          </button>
          <button
            id="protocol-tab-suits"
            type="button"
            role="tab"
            aria-selected={tab === 'suits'}
            className={`modal-tab-btn ${tab === 'suits' ? 'active' : ''}`}
            onClick={() => setTab('suits')}
          >
            <Layers size={14} aria-hidden="true" />
            黑/粉双色牌组与牌型阶梯
          </button>
          <button
            id="protocol-tab-audit"
            type="button"
            role="tab"
            aria-selected={tab === 'audit'}
            className={`modal-tab-btn ${tab === 'audit' ? 'active' : ''}`}
            onClick={() => setTab('audit')}
          >
            <History size={14} aria-hidden="true" />
            对局审计流水 ({history.length})
          </button>
        </div>

        <div className="modal-content-scroll">
          {tab === 'rules' && (
            <>
              <div className="cyber-panel-box">
                <strong style={{ color: 'var(--accent-telemetry)' }}>一、连接建立与弱牌先手</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <div>• 双方初始算力筹码各 {config.startingChips}，每局强制注入底注 {config.ante}（初始奖池 {config.ante * 2}）。</div>
                  <div>• 每位黑客发 3 张公开明牌（双方均可见），中央桌面部署 4 张未破译加密暗牌。</div>
                  <div>• 首轮由初始 3 张明牌牌力较弱的一方先手行动（三条 &gt; 一对 &gt; 高牌；完全同分则轮流先手）。</div>
                </div>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ color: 'var(--neon-pink-300)' }}>二、防速推阶梯限注与计数重置</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <div>• 前期（桌面剩 3~4 张暗牌）：单次加注上限 {config.earlyRaiseCap}，暗牌未减少前双方累计最多加注 {config.maxRaisesPerSubPhase} 次。</div>
                  <div>• 中期（桌面剩 1~2 张暗牌）：单次加注上限 {config.midRaiseCap}，暗牌未减少前双方累计最多加注 {config.maxRaisesPerSubPhase} 次。</div>
                  <div>• 终局河牌圈（0 张暗牌）：单次加注上限 {config.riverRaiseCap}，双方最多互相加注 {config.maxRiverRaises} 次。</div>
                  <div>• 只要任一方执行【覆写换牌】或【免费破译翻牌】使桌面暗牌减少 1 张，加注次数计数立即清零重置！</div>
                </div>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ color: 'var(--accent-success)' }}>三、回合动作与「跟注不消耗动作」机制</strong>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <div>• 平注状态必选其一（不可空过）：① 覆写换牌（{feeDesc}，直接进奖池不计下注差；用1张公开手牌置换1张桌面暗牌，换回的私有暗牌闪烁提示且不可再次换出）；② 免费破译翻牌（0消耗翻开1张桌面暗牌）；③ 加注施压。</div>
                  <div>• 面对加注状态：可选择【断开弃权】，或点击【跟注同步】补齐筹码——跟注不消耗你的本回合动作，补齐后你依然可以继续换牌、翻牌、反加或移交回合！</div>
                  <div>• 当第 4 张桌面暗牌被翻开或换走后进入终局河牌圈，由未触发最后一张暗牌的一方先手；若任一方全下且跟注平齐，自动翻开剩余所有节点直接 7 选 5 摊牌比大小。</div>
                </div>
              </div>
            </>
          )}

          {tab === 'suits' && (
            <>
              <div className="cyber-panel-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span className="cyber-badge" style={{ fontSize: 13, padding: '6px 12px' }}>
                    <CyberSuitEmblem suit="B" size={18} />
                    黑曜脉冲 (26张：2~A 各2张)
                  </span>
                  <span className="cyber-badge pink" style={{ fontSize: 13, padding: '6px 12px' }}>
                    <CyberSuitEmblem suit="P" size={18} />
                    绯霓电弧 (26张：2~A 各2张)
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  本协议将传统四花色重构为黑曜与绯霓双色脉冲（总牌数保持 52 张不变）。单张抽中目标花色的基准概率由 25% 翻倍至 50%，使「换牌追同花」与「封锁对手同花色明牌」成为核心高张力战术！
                </p>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 13, color: 'var(--accent-telemetry)' }}>
                  7 选 5 牌型大小阶梯（由高到低）
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {HAND_TIERS.map((t) => (
                    <div
                      key={t.rank}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '42px 150px 1fr',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'rgba(12, 17, 32, 0.75)',
                        fontSize: 12.5,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-telemetry)' }}>
                        #{t.rank}
                      </span>
                      <strong style={{ color: '#ffffff' }}>{t.name}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'audit' && (
            <>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(
                  [
                    ['all', '全部记录'],
                    ['human', '仅看我方'],
                    ['ai', '仅看对手'],
                    ['system', '系统事件'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    id={`audit-filter-btn-${k}`}
                    type="button"
                    className={`os-nav-btn ${actorFilter === k ? 'highlight' : ''}`}
                    onClick={() => setActorFilter(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredLogs.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'rgba(14, 20, 38, 0.85)',
                      borderLeft: `3px solid ${
                        item.actor === 'human'
                          ? 'var(--accent-telemetry)'
                          : item.actor === 'ai'
                            ? 'var(--accent-primary)'
                            : 'var(--accent-warning)'
                      }`,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{item.summary}</strong>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>
                        #{item.handNumber} · {item.phase.toUpperCase()}
                      </span>
                    </div>
                    {item.detail && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.detail}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
