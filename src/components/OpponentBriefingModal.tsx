import type { CSSProperties } from 'react';
import { ShieldAlert, Sparkles, UserCheck, X } from 'lucide-react';
import type { PreMatchOpponentBriefing } from '../engine/storyCharacters.ts';

interface OpponentBriefingModalProps {
  briefing: PreMatchOpponentBriefing;
  isMidMatch?: boolean;
  onStartMatch: () => void;
}

export default function OpponentBriefingModal({
  briefing,
  isMidMatch = false,
  onStartMatch,
}: OpponentBriefingModalProps) {
  return (
    <div
      className="cyber-modal-scrim lc-briefing-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
    >
      <div
        className="cyber-modal-window lc-briefing-window"
        style={{ '--win-accent': briefing.accentColor } as CSSProperties}
      >
        <div className="window-titlebar">
          <div className="window-title-left">
            <UserCheck size={15} color={briefing.accentColor} aria-hidden="true" />
            <span id="briefing-modal-title">
              目标终端档案识别 // {briefing.nodeCode} {briefing.name}（{briefing.codename}）
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cyber-badge pink">战前简报</span>
            <button
              id="briefing-btn-close"
              type="button"
              className="os-nav-btn"
              onClick={onStartMatch}
              aria-label="关闭档案并接入牌桌"
            >
              <X size={15} aria-hidden="true" />
              关闭
            </button>
          </div>
        </div>

        <div className="modal-content-scroll lc-briefing-body">
          <div className="lc-briefing-grid">
            <div className="lc-briefing-portrait-col">
              <div
                className="px-portrait-stage lc-briefing-stage"
                style={{ '--win-accent': briefing.accentColor } as CSSProperties}
              >
                <div className="px-portrait-dither" />
                <img
                  src={briefing.portraitSrc}
                  alt={`${briefing.name} 立绘`}
                  className="px-portrait-halfbody lc-briefing-img"
                />
              </div>
              <div className="lc-briefing-identity-card">
                <div className="lc-briefing-name-row">
                  <strong className="lc-briefing-name">{briefing.name}</strong>
                  <span className="lc-briefing-code">{briefing.codename}</span>
                </div>
                <div className="lc-briefing-domain-title">{briefing.domainTitle}</div>
                <div className="char-quote-box lc-briefing-quote">「{briefing.quote}」</div>
              </div>
            </div>

            <div className="lc-briefing-info-col">
              <div className="cyber-panel-box lc-briefing-panel">
                <div className="lc-briefing-sec-head">外貌特征 // APPEARANCE</div>
                <p className="lc-briefing-desc">{briefing.appearance}</p>
              </div>

              <div className="cyber-panel-box lc-briefing-panel">
                <div className="lc-briefing-sec-head">性格侧写 // PERSONALITY</div>
                <p className="lc-briefing-desc">{briefing.personality}</p>
              </div>

              <div className="cyber-panel-box lc-briefing-panel">
                <div className="lc-briefing-sec-head is-skill-head">
                  <ShieldAlert size={13} aria-hidden="true" />
                  <span>侦测到的特殊技能与协议机制（{briefing.skills.length} 项）</span>
                </div>
                <div className="lc-briefing-skills-list">
                  {briefing.skills.map((skill) => (
                    <div key={skill.id} className="lc-briefing-skill-card">
                      <div className="lc-briefing-skill-top">
                        <span className="lc-briefing-skill-name">
                          <Sparkles size={12} aria-hidden="true" />
                          {skill.name}
                        </span>
                        <span className="lc-briefing-skill-cat">{skill.category}</span>
                      </div>
                      <div className="lc-briefing-skill-trigger">
                        触发与代价：{skill.triggerOrCost}
                      </div>
                      <div className="lc-briefing-skill-summary">{skill.summary}</div>
                      <div className="lc-briefing-skill-tip">应对建议：{skill.counterTip}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lc-briefing-footer">
          <span className="lc-briefing-footer-note">
            提示：对局过程中可随时点击顶部「对手档案」再次查阅技能细节
          </span>
          <button
            id="briefing-btn-start-match"
            type="button"
            className="os-nav-btn highlight lc-briefing-cta"
            onClick={onStartMatch}
          >
            {isMidMatch ? '确认并返回牌桌' : `接入牌桌 · 迎战 ${briefing.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
