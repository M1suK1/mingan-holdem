import { useEffect, useState } from 'react';
import {
  DEFAULT_CHEAT_SKILLS,
  MAX_CHEAT_SKILLS,
  MAX_SUPPORT_SKILLS,
  getSkillById,
  getSkillGroup,
  needsGroupedSkillReplacement,
} from '../engine/skillPool.ts';
import { PixelCheckIcon, PixelSurgeIcon } from './CyberIcons.tsx';

interface SkillLootReplaceModalProps {
  title: string;
  subtitle: string;
  choices: string[];
  equippedCheatSkills?: string[];
  equippedSkills: string[];
  onConfirm: (chosenSkillId: string, replaceSlotIndex?: number) => void;
  onSkip: () => void;
}

export default function SkillLootReplaceModal({
  title,
  subtitle,
  choices,
  equippedCheatSkills = DEFAULT_CHEAT_SKILLS,
  equippedSkills,
  onConfirm,
  onSkip,
}: SkillLootReplaceModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>(choices[0] ?? '');
  const [replaceSlotIndex, setReplaceSlotIndex] = useState<number>(0);

  useEffect(() => {
    setSelectedSkillId(choices[0] ?? '');
    setReplaceSlotIndex(0);
  }, [choices]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  const activeSkill = getSkillById(selectedSkillId) ?? getSkillById(choices[0] ?? '');
  const activeGroup = activeSkill ? getSkillGroup(activeSkill.id) : 'support';
  const groupSlots = activeGroup === 'cheat' ? equippedCheatSkills : equippedSkills;
  const groupCap = activeGroup === 'cheat' ? MAX_CHEAT_SKILLS : MAX_SUPPORT_SKILLS;
  const groupLabel = activeGroup === 'cheat' ? '作弊技能槽' : '非作弊辅助槽';
  const mustReplace = activeSkill
    ? needsGroupedSkillReplacement(equippedCheatSkills, equippedSkills, activeSkill.id)
    : false;
  const alreadyOwned = activeSkill ? groupSlots.includes(activeSkill.id) : false;

  return (
    <div
      className="lc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-loot-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div className="lc-hud-box lc-skill-loot-modal">
        <header className="lc-skill-modal-head">
          <div>
            <div className="lc-escape-brief-tag">
              PROTOCOL EXTRACTION // 作弊槽 {equippedCheatSkills.length}/{MAX_CHEAT_SKILLS} · 辅助槽 {equippedSkills.length}/{MAX_SUPPORT_SKILLS}
            </div>
            <h2 id="skill-loot-modal-title" className="lc-cmd-title">
              {title}
            </h2>
            <p className="lc-cmd-subtitle">{subtitle}</p>
          </div>
          <span className={`lc-slot-cap-badge ${groupSlots.length >= groupCap ? 'is-full' : ''}`}>
            {groupLabel} {groupSlots.length} / {groupCap}
          </span>
        </header>

        <section className="lc-skill-modal-sec" aria-label="可选协议技能">
          <div className="lc-skill-sec-label">
            {choices.length > 1 ? '1. 选择要提取的协议技能' : '1. 即将装备的新协议技能'}
          </div>
          <div className="lc-skill-choice-grid">
            {choices.map((sid, idx) => {
              const sk = getSkillById(sid);
              if (!sk) return null;
              const skGroup = getSkillGroup(sid);
              const picked = activeSkill?.id === sid;
              const owned =
                skGroup === 'cheat'
                  ? equippedCheatSkills.includes(sid)
                  : equippedSkills.includes(sid);
              return (
                <button
                  key={sid}
                  id={`skill-loot-choice-${idx}`}
                  type="button"
                  className={`lc-skill-choice-card ${picked ? 'is-picked' : ''}`}
                  onClick={() => setSelectedSkillId(sid)}
                >
                  <div className="lc-skill-choice-top">
                    <strong>{sk.name}</strong>
                    <span className="lc-skill-choice-badge">
                      {skGroup === 'cheat' ? '作弊技能' : '非作弊辅助'} · {owned ? '已装备' : sk.costHint ? `费用 ${sk.costHint}` : '被动'}
                    </span>
                  </div>
                  <p className="lc-skill-choice-desc">{sk.summary}</p>
                  <div className="lc-skill-choice-tags">{sk.tags.join(' · ')}</div>
                </button>
              );
            })}
          </div>
        </section>

        {mustReplace && activeSkill && (
          <section className="lc-skill-modal-sec is-replace-zone" aria-label="槽位已满需替换">
            <div className="lc-skill-sec-label danger">
              2. {groupLabel}已达上限 ({groupCap}/{groupCap}) — 请选择 1 个现有槽位替换为「{activeSkill.name}」
            </div>
            <div className="lc-skill-replace-grid">
              {groupSlots.slice(0, groupCap).map((oldId, slotIdx) => {
                const oldSk = getSkillById(oldId);
                const selected = replaceSlotIndex === slotIdx;
                return (
                  <button
                    key={`${oldId}-${slotIdx}`}
                    id={`skill-replace-slot-${slotIdx}`}
                    type="button"
                    className={`lc-skill-replace-card ${selected ? 'is-target' : ''}`}
                    onClick={() => setReplaceSlotIndex(slotIdx)}
                  >
                    <div className="lc-skill-choice-top">
                      <span>{groupLabel} #{slotIdx + 1}</span>
                      <span className="lc-skill-replace-tag">
                        {selected ? '将被替换' : '点击选中'}
                      </span>
                    </div>
                    <strong>{oldSk?.name ?? oldId}</strong>
                    <p className="lc-skill-choice-desc">{oldSk?.summary ?? ''}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <footer className="lc-skill-modal-foot">
          <button
            id="skill-loot-skip"
            type="button"
            className="lc-escape-btn"
            onClick={onSkip}
          >
            {mustReplace ? '放弃新技能（保留现有 3 槽）' : '暂不提取并继续'}
          </button>
          <button
            id="skill-loot-confirm"
            type="button"
            className="lc-escape-cta primary"
            disabled={!activeSkill}
            onClick={() => {
              if (!activeSkill) return;
              onConfirm(activeSkill.id, mustReplace ? replaceSlotIndex : undefined);
            }}
          >
            <span className="lc-btn-inline">
              {mustReplace ? <PixelSurgeIcon size={14} /> : <PixelCheckIcon size={14} />}
              {alreadyOwned
                ? '已掌握该技能 · 继续'
                : mustReplace
                  ? `替换槽位 #${replaceSlotIndex + 1} 并装备「${activeSkill?.name ?? ''}」`
                  : `装备「${activeSkill?.name ?? ''}」`}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}
