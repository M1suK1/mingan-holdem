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
  {
    rank: '01',
    name: '四条 (0.17%)',
    desc: '4 张相同点数的牌（2黑+2粉）加 1 张单牌——双色牌组中最稀有的至尊牌型！',
  },
  {
    rank: '02',
    name: '同花顺 (0.43%)',
    desc: '同一花色（全黑或全粉）且点数连续的 5 张不同点数牌',
  },
  {
    rank: '03',
    name: '葫芦 (2.60%)',
    desc: '3 张相同点数加另外 2 张相同点数',
  },
  {
    rank: '04',
    name: '顺子 (4.40%)',
    desc: '5 张点数连续的牌（支持 A-2-3-4-5 最小顺与 10-J-Q-K-A 最大顺）',
  },
  {
    rank: '05',
    name: '三条 (4.89%)',
    desc: '3 张相同点数的牌加 2 张单牌',
  },
  {
    rank: '06',
    name: '两对 (23.84%)',
    desc: '2 组不同点数的对子加 1 张单牌（高于双色同花！）',
  },
  {
    rank: '07',
    name: '同花 (27.68%)',
    desc: '任意 5 张同为黑曜或同为绯霓的牌（双色下 7 张原始达成率 41.89%，已重排至两对与一对之间）',
  },
  {
    rank: '08',
    name: '一对 (25.97%)',
    desc: '2 张相同点数的牌加 3 张单牌（原始 7 张含对率 78.99%）',
  },
  {
    rank: '09',
    name: '高牌 (10.04%)',
    desc: '未组成以上牌型时，按最大单牌依次比大小',
  },
];

export default function ProtocolManualModal({
  initialTab = 'suits',
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
            <span id="protocol-modal-title">黑域协议手册 · 双色精确概率阶梯与审计流水</span>
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
            id="protocol-tab-suits"
            type="button"
            role="tab"
            aria-selected={tab === 'suits'}
            className={`modal-tab-btn ${tab === 'suits' ? 'active' : ''}`}
            onClick={() => setTab('suits')}
          >
            <Layers size={14} aria-hidden="true" />
            双色精确概率与重排阶梯
          </button>
          <button
            id="protocol-tab-rules"
            type="button"
            role="tab"
            aria-selected={tab === 'rules'}
            className={`modal-tab-btn ${tab === 'rules' ? 'active' : ''}`}
            onClick={() => setTab('rules')}
          >
            <BookOpen size={14} aria-hidden="true" />
            直觉点牌与博弈完整规则
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
          {tab === 'suits' && (
            <>
              <div className="cyber-panel-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="cyber-badge" style={{ fontSize: 12.5, padding: '5px 10px' }}>
                    <CyberSuitEmblem suit="B" size={16} />
                    黑曜脉冲 (26张：2~A 各2张)
                  </span>
                  <span className="cyber-badge pink" style={{ fontSize: 12.5, padding: '5px 10px' }}>
                    <CyberSuitEmblem suit="P" size={16} />
                    绯霓电弧 (26张：2~A 各2张)
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  基于 C(52,7) = 133,784,560 种完整七张局面精确穷举：双花色牌组中「同花」原始可达成率升至 41.89%，且「四条」(0.17%) 比双色「同花顺」(0.43%) 稀有 2.54 倍。因此牌型阶梯严格按真实数学稀有度重排如下：
                </p>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 13, color: 'var(--accent-telemetry)' }}>
                  7 选 5 精确概率重排阶梯（括号内为 7 选 5 互斥最优占比）
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {HAND_TIERS.map((t) => (
                    <div
                      key={t.rank}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '38px 146px 1fr',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: '#111930',
                        border: '1px solid #2b3c68',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-pixel)', color: 'var(--accent-telemetry)' }}>
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

          {tab === 'rules' && (
            <>
              <div className="cyber-panel-box">
                <strong style={{ color: 'var(--accent-telemetry)' }}>一、极简直觉点牌与三档加注</strong>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <div>• 免费翻牌：轮到我方且无待补差额时，直接点击中央未翻开暗牌即可 0 消耗翻开。</div>
                  <div>• 明暗互换：先点击下方己方任意一张公开明牌（抬起高亮），再点击中央未翻开暗牌即刻支付门票（{feeDesc}）互换；换回的私有暗牌闪烁提示且锁定不可再换。</div>
                  <div>• 三档加注：点击玩家牌右侧的「加注施压」，直接在小档 / 中档 / 满额三个整数档位中一键点选，算力数据块将飞入左侧算力池驱动柱条增长。</div>
                </div>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ color: 'var(--neon-pink-300)' }}>二、阶梯限注与「跟注不消耗动作」</strong>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  <div>• 前期（剩 3~4 暗牌）上限 {config.earlyRaiseCap}；中期（剩 1~2 暗牌）上限 {config.midRaiseCap}；暗牌未减少前累计最多加注 {config.maxRaisesPerSubPhase} 次，任意翻牌或换牌立即清零计数。</div>
                  <div>• 面对对手加注时：点击「跟注」仅同步算力且不消耗你的回合动作，补齐后可继续直接点牌翻牌/换牌、反加或移交回合。</div>
                  <div>• 第 4 张暗牌揭晓后进入终局河牌圈（由未触发最后一张暗牌的一方先手，上限 {config.riverRaiseCap}，最多互加 {config.maxRiverRaises} 次）；全下平齐则自动翻开剩余全部节点比大小。</div>
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
                      padding: '8px 10px',
                      background: '#10182e',
                      border: '1px solid #28385e',
                      borderLeft: `4px solid ${
                        item.actor === 'human'
                          ? 'var(--accent-telemetry)'
                          : item.actor === 'ai'
                            ? 'var(--accent-primary)'
                            : 'var(--accent-warning)'
                      }`,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{item.summary}</strong>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-subtle)' }}>
                        #{item.handNumber} · {item.phase.toUpperCase()}
                      </span>
                    </div>
                    {item.detail && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
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
