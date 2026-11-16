import { useState } from 'react';
import { AlertTriangle, Check, ShieldAlert, Skull, Sparkles, UserCheck, Zap } from 'lucide-react';
import type { CampaignState } from '../engine/types.ts';
import { getActiveDisguiseEntity } from '../engine/campaign.ts';
import { MAX_EXTRA_SKILLS, getSkillById, needsSkillReplacement } from '../engine/skillPool.ts';

interface CampaignOutcomeModalProps {
  campaign: CampaignState;
  onSelectDisguise: (entityId: string) => void;
  onClaimLootSkill: (skillId?: string, replaceSlotIndex?: number) => void;
  onContinueAfterEscape: () => void;
  onRestartCampaign: () => void;
  onCloseOptional?: () => void;
}

export default function CampaignOutcomeModal({
  campaign,
  onSelectDisguise,
  onClaimLootSkill,
  onContinueAfterEscape,
  onRestartCampaign,
  onCloseOptional,
}: CampaignOutcomeModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    campaign.pendingLoot?.skillChoices[0] ?? ''
  );
  const [replaceSlotIndex, setReplaceSlotIndex] = useState<number>(0);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    campaign.capturedEntities[0]?.id ?? campaign.activeDisguiseId ?? campaign.coreEntity.id
  );

  const activeEntity = getActiveDisguiseEntity(campaign);

  if (campaign.status === 'loot-select' && campaign.pendingLoot) {
    const loot = campaign.pendingLoot;
    const effectivePickedSkill = selectedSkillId || loot.skillChoices[0] || '';
    const mustReplaceSkill = needsSkillReplacement(campaign.acquiredSkills, effectivePickedSkill);
    return (
      <div
        className="cyber-modal-scrim"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-loot-title"
      >
        <div className="cyber-modal-window">
          <div className="window-titlebar">
            <div className="window-title-left">
              <Sparkles size={15} color="var(--neon-emerald)" aria-hidden="true" />
              <span id="campaign-loot-title">
                黑域协议裁决 // 击溃追捕者「{loot.pursuerName}」· 剥离虚拟实体与技能
              </span>
            </div>
            <span className="cyber-badge cyan">通缉等级即将提升至 LV.{campaign.wantedLevel + 1}</span>
          </div>

          <div className="modal-content-scroll">
            <div className="cyber-panel-box">
              <strong style={{ fontSize: 13, color: 'var(--neon-cyan-soft)' }}>
                1. 已夺取敌方虚拟实体（可作下局伪装诱饵抵消一次失败）
              </strong>
              <div className="lc-entity-capture-row">
                <img
                  src={loot.seizedEntity.virtualPortrait}
                  alt={loot.seizedEntity.name}
                  className="lc-entity-thumb"
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: 15, color: '#ffffff' }}>{loot.seizedEntity.name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--neon-pink-soft)' }}>
                    原身份：{loot.pursuerIdentity}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    魔女化虚拟实体已归入你的黑域诱饵库。后续每局开战前均可切换佩戴，战败时自动牺牲该诱饵掩护本体撤离。
                  </span>
                </div>
              </div>
            </div>

            <div className="cyber-panel-box">
              <strong style={{ fontSize: 13, color: 'var(--neon-pink-soft)' }}>
                2. 从追捕者技能池挑选 1 项协议技能（额外技能上限 {campaign.acquiredSkills.length}/{MAX_EXTRA_SKILLS}）
              </strong>
              {loot.skillChoices.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  你已掌握该追捕者技能池内的全部已知协议。
                </div>
              ) : (
                <div className="lc-skill-loot-grid">
                  {loot.skillChoices.map((sid, idx) => {
                    const sk = getSkillById(sid);
                    if (!sk) return null;
                    const isPicked = selectedSkillId === sid;
                    return (
                      <button
                        key={sid}
                        id={`campaign-loot-skill-${idx}`}
                        type="button"
                        className={`lc-skill-loot-card ${isPicked ? 'selected' : ''}`}
                        onClick={() => setSelectedSkillId(sid)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{sk.name}</strong>
                          <span className={`cyber-badge ${sk.implemented ? 'cyan' : 'pink'}`}>
                            {sk.implemented ? '已实装' : '技能槽位'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                          {sk.summary}
                        </p>
                        <div style={{ fontSize: 10.5, color: 'var(--accent-telemetry)' }}>
                          {sk.tags.join(' · ')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {mustReplaceSkill && (
              <div className="cyber-panel-box">
                <strong style={{ fontSize: 13, color: 'var(--neon-amber)' }}>
                  3. 额外技能槽位已满 (3/3) — 选择要被替换的旧技能
                </strong>
                <div className="lc-skill-loot-grid">
                  {campaign.acquiredSkills.slice(0, MAX_EXTRA_SKILLS).map((oldId, rIdx) => {
                    const oldSk = getSkillById(oldId);
                    const isTarget = replaceSlotIndex === rIdx;
                    return (
                      <button
                        key={`${oldId}-${rIdx}`}
                        id={`campaign-replace-slot-${rIdx}`}
                        type="button"
                        className={`lc-skill-loot-card ${isTarget ? 'selected' : ''}`}
                        onClick={() => setReplaceSlotIndex(rIdx)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{oldSk?.name ?? oldId}</strong>
                          <span className={`cyber-badge ${isTarget ? 'pink' : 'cyan'}`}>
                            {isTarget ? '将被替换' : `槽位 #${rIdx + 1}`}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {oldSk?.summary ?? ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              id="campaign-btn-confirm-loot"
              type="button"
              className="cyber-cmd-btn primary-cyan"
              onClick={() =>
                onClaimLootSkill(
                  effectivePickedSkill || undefined,
                  mustReplaceSkill ? replaceSlotIndex : undefined
                )
              }
            >
              <Check size={15} aria-hidden="true" />
              {mustReplaceSkill
                ? `确认收缴实体并替换槽位 #${replaceSlotIndex + 1}`
                : '确认收缴虚拟实体与所选技能，准备下一轮反追捕'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (campaign.status === 'escaped' && campaign.lastEscapeLog) {
    const esc = campaign.lastEscapeLog;
    return (
      <div
        className="cyber-modal-scrim"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-escape-title"
      >
        <div className="cyber-modal-window narrow">
          <div className="window-titlebar">
            <div className="window-title-left">
              <ShieldAlert size={15} color="var(--neon-amber)" aria-hidden="true" />
              <span id="campaign-escape-title">诱饵断后 // 紧急脱离追捕</span>
            </div>
          </div>

          <div className="modal-content-scroll">
            <div className="cyber-panel-box" style={{ borderColor: 'var(--neon-amber)' }}>
              <strong style={{ color: 'var(--neon-amber)', fontSize: 14 }}>
                伪装虚拟实体已被摧毁，本体安全撤离！
              </strong>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-main)', lineHeight: 1.6 }}>
                第 #{esc.roundIndex} 轮追捕中，追捕者「{esc.pursuerName}」击穿了你的算力防线。由于你提前佩戴了伪装诱饵「
                {esc.sacrificedEntityName}」，该诱饵实体已按黑域协议现场牺牲并被对方夺走，你的本体虚拟实体与已掠夺技能（{campaign.acquiredSkills.length} 项）全部保全。
              </p>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                剩余可用诱饵实体：{campaign.capturedEntities.length} 个
              </div>
            </div>

            <button
              id="campaign-btn-continue-after-escape"
              type="button"
              className="cyber-cmd-btn primary-cyan"
              onClick={onContinueAfterEscape}
            >
              重构接入通道，迎接下一位追捕者
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (campaign.status === 'failed-ending' && campaign.failureEnding) {
    const fail = campaign.failureEnding;
    return (
      <div
        className="cyber-modal-scrim"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-fail-title"
      >
        <div className="cyber-modal-window">
          <div className="window-titlebar" style={{ borderBottomColor: 'var(--neon-danger)' }}>
            <div className="window-title-left">
              <Skull size={16} color="var(--neon-danger)" aria-hidden="true" />
              <span id="campaign-fail-title">失败结局 // 本体虚拟实体已被剥离</span>
            </div>
            <span className="cyber-badge pink">PROTOCOL TERMINATED</span>
          </div>

          <div className="modal-content-scroll">
            <div className="cyber-panel-box" style={{ borderColor: 'var(--neon-danger)', background: 'rgba(255, 36, 56, 0.08)' }}>
              <strong style={{ fontSize: 15, color: '#ff8ea1' }}>
                通缉黑客 {campaign.playerCodename} 的本体虚拟实体已被「{fail.takenByName}」正式夺走
              </strong>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-main)', lineHeight: 1.65 }}>
                你以本体虚拟实体直面追捕却耗尽了全部算力防线。根据黑域协议，{fail.takenByIdentity} 强行接管了你的本体签名，你在黑域协议空间的所有节点连接已被永久封存。
              </p>
            </div>

            <div className="cmd-grid cols-2">
              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--neon-cyan-soft)' }}>潜行逃亡战绩结算</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <div>存活追捕轮次：第 {fail.roundsSurvived} 轮</div>
                  <div>最终通缉等级：LV.{fail.finalWantedLevel}</div>
                  <div>击溃追捕者数：{fail.defeatedCount} 名</div>
                  <div>累计掠夺技能：{fail.acquiredSkillsCount} 项</div>
                </div>
              </div>

              <div className="cyber-panel-box">
                <strong style={{ fontSize: 12.5, color: 'var(--neon-pink-soft)' }}>曾击溃追捕者记录</strong>
                {campaign.defeatedPursuers.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>尚未击溃任何追捕者便遭收网。</div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', maxHeight: 100, overflowY: 'auto' }}>
                    {campaign.defeatedPursuers.map((d, i) => (
                      <div key={i}>
                        R{d.roundIndex} · {d.name}（{d.entityName}）
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              id="campaign-btn-restart-new-run"
              type="button"
              className="cyber-cmd-btn primary-pink"
              onClick={onRestartCampaign}
            >
              重新构建本体虚拟实体，再次潜入黑域协议空间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // disguise-select (match start / manual switch)
  const allOptions = [campaign.coreEntity, ...campaign.capturedEntities];
  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-disguise-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <UserCheck size={15} color="var(--neon-cyan)" aria-hidden="true" />
            <span id="campaign-disguise-title">
              第 #{campaign.roundIndex} 轮接入 // 选择本局出战虚拟实体伪装
            </span>
          </div>
          {onCloseOptional && (
            <button
              id="campaign-btn-disguise-close"
              type="button"
              className="os-nav-btn"
              onClick={onCloseOptional}
            >
              保持当前 ({activeEntity.name})
            </button>
          )}
        </div>

        <div className="modal-content-scroll">
          <div className="cyber-panel-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--neon-amber)' }}>
              <AlertTriangle size={14} aria-hidden="true" />
              <strong>黑域规则提示：佩戴俘获虚拟实体作为伪装时，战败将直接消耗该伪装实体逃生；若以本体出战并战败，将触发失败结局。</strong>
            </div>
          </div>

          <div className="lc-disguise-grid">
            {allOptions.map((ent, idx) => {
              const isSelected = selectedEntityId === ent.id;
              return (
                <button
                  key={ent.id}
                  id={`campaign-disguise-option-${idx}`}
                  type="button"
                  className={`lc-disguise-card ${isSelected ? 'selected' : ''} ${ent.isCore ? 'is-core' : ''}`}
                  onClick={() => setSelectedEntityId(ent.id)}
                >
                  <img src={ent.virtualPortrait} alt={ent.name} className="lc-entity-thumb" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                      <strong style={{ fontSize: 13.5, color: '#ffffff' }}>{ent.name}</strong>
                      <span className={`cyber-badge ${ent.isCore ? 'pink' : 'cyan'}`}>
                        {ent.isCore ? '本体核心' : '诱饵伪装'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {ent.pursuerRole ?? '黑客原生投影'}
                    </span>
                    <span style={{ fontSize: 11, color: ent.isCore ? '#ff8ea1' : 'var(--neon-emerald)' }}>
                      {ent.isCore ? '警告：以本体败北将直接进入失败结局' : '安全：可作为诱饵抵消一次败局'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {campaign.acquiredSkills.length > 0 && (
            <div className="cyber-panel-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                <Zap size={13} color="var(--neon-cyan)" aria-hidden="true" />
                当前已掠夺技能库 ({campaign.acquiredSkills.length})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {campaign.acquiredSkills.map((sid) => {
                  const sk = getSkillById(sid);
                  return (
                    <span key={sid} className="cyber-badge cyan" title={sk?.summary}>
                      {sk?.name ?? sid} {sk && !sk.implemented ? '(预留槽位)' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <button
            id="campaign-btn-confirm-disguise"
            type="button"
            className="cyber-cmd-btn primary-cyan"
            onClick={() => onSelectDisguise(selectedEntityId)}
          >
            确认以此虚拟实体形象接入本局对决
          </button>
        </div>
      </div>
    </div>
  );
}
