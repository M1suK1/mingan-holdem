import type { ContractCharacter } from './contractCards.ts';
import type {
  AiCheatProfile,
  AiPlayStyle,
  PursuerDossier,
  SkillPoolEntry,
} from './types.ts';

export type EffectivePlayStyle = Exclude<AiPlayStyle, 'auto'>;
export type EffectiveCheatProfile = Exclude<AiCheatProfile, 'auto'>;

export const PLAY_STYLE_META: Record<EffectivePlayStyle, { label: string; desc: string }> = {
  pressure: { label: '强攻掠夺', desc: '高频主动加注、敢半诈唬与半池超频压迫' },
  trap: { label: '控池陷阱', desc: '早中段拿强牌故意示弱慢打，河牌圈突然重注收割' },
  sculptor: { label: '换牌重组', desc: '重度依赖明暗换牌重构协同牌型，抢占私有暗槽' },
  conservative: { label: '稳健精算', desc: '严守蒙特卡洛胜率与底池赔率，极少诈唬，逆风果断止损' },
};

export const CHEAT_PROFILE_META: Record<EffectiveCheatProfile, { label: string; desc: string }> = {
  auditor: { label: '守序审计', desc: '绝不主动改牌，省下算力高频扫描抓捕玩家作弊' },
  'phantom-hacker': { label: '潜行改牌', desc: '善用改牌并将篡改牌换入公共池误导对手判断' },
  opportunist: { label: '精准机会', desc: '平常隐忍不动，仅在关键成牌跃迁节点突袭改牌' },
  disruptor: { label: '乱序施压', desc: '改牌与加注同步扰频，并专盯玩家私有暗牌反扫' },
};

export function resolvePursuerStrategyProfile(
  playSetting: AiPlayStyle | undefined,
  cheatSetting: AiCheatProfile | undefined,
  character: ContractCharacter,
  dossier: PursuerDossier
): { playStyle: EffectivePlayStyle; cheatProfile: EffectiveCheatProfile } {
  let playStyle: EffectivePlayStyle;
  if (playSetting && playSetting !== 'auto') {
    playStyle = playSetting;
  } else if (dossier.faction === '星穹财团安全部' || character.stats.magic >= 76) {
    playStyle = 'pressure';
  } else if (dossier.faction === '黑域仲裁局' || character.stats.insight >= 82) {
    playStyle = 'trap';
  } else if (dossier.faction === '零号暗巷' || dossier.faction === '自由猎网' || character.stats.agility >= 75) {
    playStyle = 'sculptor';
  } else {
    playStyle = 'conservative';
  }

  let cheatProfile: EffectiveCheatProfile;
  if (cheatSetting && cheatSetting !== 'auto') {
    cheatProfile = cheatSetting;
  } else if (dossier.faction === '深网审计署' || dossier.faction === '黑域仲裁局' || character.stats.empathy >= 75) {
    cheatProfile = 'auditor';
  } else if (dossier.faction === '零号暗巷' || character.archetype.includes('控制') || character.traits.some((t) => t.tags.includes('骇客'))) {
    cheatProfile = 'phantom-hacker';
  } else if (character.archetype.includes('强袭') || character.stats.magic >= 80) {
    cheatProfile = 'disruptor';
  } else {
    cheatProfile = 'opportunist';
  }

  return { playStyle, cheatProfile };
}

/**
 * 黑域协议技能池（已实装 9 项可掠夺协议技能：6 项主动每局限1次 + 3 项永久被动，后续仍可继续扩展）。
 */
export const SKILL_POOL_REGISTRY: SkillPoolEntry[] = [
  {
    id: 'ghost-packet',
    name: '幽灵封包',
    category: 'hack',
    summary: '预支 40 算力注入一次性的底层掩护护盾，可抵消对手下一次「扫描」抓获判负与技能封印。',
    costHint: 40,
    targetMode: 'instant',
    implemented: true,
    tags: ['主动·每局限1次', '反扫描护盾'],
  },
  {
    id: 'parity-spoof',
    name: '奇偶跃迁',
    category: 'hack',
    summary: '预支 55 算力使选中的己方明牌点数沿同奇偶跳变（<=Q 时 +2，否则 -2），结果仅己方可见。',
    costHint: 55,
    targetMode: 'human-open-hand',
    implemented: true,
    tags: ['主动·每局限1次', '跨阶改牌'],
  },
  {
    id: 'phantom-swap',
    name: '幻影解绑',
    category: 'hack',
    summary: '预支 45 算力解除已锁定的己方私有暗牌换牌封锁，使其可再次与公共暗牌互换。',
    costHint: 45,
    targetMode: 'human-locked-hand',
    implemented: true,
    tags: ['主动·每局限1次', '机动重换'],
  },
  {
    id: 'zero-day-peek',
    name: '零日窥视',
    category: 'recon',
    summary: '预支 50 算力在不公开公共暗牌的情况下，直接窥视中央节点池 1 张暗牌的真实点数与花色。',
    costHint: 50,
    targetMode: 'hidden-board',
    implemented: true,
    tags: ['主动·每局限1次', '暗槽透视'],
  },
  {
    id: 'ice-firewall',
    name: '冰墙锁槽',
    category: 'protocol',
    summary: '预支 45 算力冻结中央节点池 1 张未公开暗槽，本局内对端禁止向该槽位换入暗牌。',
    costHint: 45,
    targetMode: 'hidden-board',
    implemented: true,
    tags: ['主动·每局限1次', '公共牌封锁'],
  },
  {
    id: 'overclock-bluff',
    name: '超频脉压',
    category: 'protocol',
    summary: '向底池强行推入 35 算力计入本轮下注并移交回应权（可无视普通段内加注次数上限逼注）。',
    costHint: 35,
    targetMode: 'instant',
    implemented: true,
    tags: ['主动·每局限1次', '破限压迫'],
  },
  {
    id: 'mirror-checksum',
    name: '镜像降耗',
    category: 'passive',
    summary: '永久被动：你的通用「扫描」技能预支算力永久降低 15 点（最低 15）。',
    targetMode: 'passive',
    implemented: true,
    tags: ['永久被动', '扫描减费'],
  },
  {
    id: 'entropy-shield',
    name: '熵减缓冲',
    category: 'passive',
    summary: '永久被动：你的每次明暗「换牌门票」费用永久降低 10 点（最低 10）。',
    targetMode: 'passive',
    implemented: true,
    tags: ['永久被动', '换牌减费'],
  },
  {
    id: 'trace-scramble',
    name: '追踪扰频',
    category: 'passive',
    summary: '永久被动：你的黑客改牌技能（+1 / -1 / 反色）预支费用永久降低 15 点（最低 15）。',
    targetMode: 'passive',
    implemented: true,
    tags: ['永久被动', '改牌减费'],
  },
];

const PURSUER_ROLES: Array<{
  identityTitle: string;
  faction: string;
  motive: string;
  pool: string[];
}> = [
  {
    identityTitle: '黑域仲裁庭 · 协议裁决官',
    faction: '黑域仲裁局',
    motive: '奉命在黑域协议空间截停通缉黑客，强行剥离其本体虚拟实体并封存违规密钥。',
    pool: ['ghost-packet', 'ice-firewall', 'mirror-checksum'],
  },
  {
    identityTitle: '星穹财团 · 反入侵猎犬',
    faction: '星穹财团安全部',
    motive: '追回被盗取的核心算法日志，并将你的虚拟实体作为高算力样本回收拍卖。',
    pool: ['overclock-bluff', 'zero-day-peek', 'parity-spoof'],
  },
  {
    identityTitle: '地下赏金网 · 独行清道夫',
    faction: '自由猎网',
    motive: '盯上了黑市针对你的高额通缉悬赏，企图用一场彻底的算力清零带走你的实体。',
    pool: ['phantom-swap', 'trace-scramble', 'ghost-packet'],
  },
  {
    identityTitle: '深网审计署 · 异常清算员',
    faction: '深网审计署',
    motive: '排查协议空间中的非法篡改链路，试图以合规扫描将你的终端彻底抹除。',
    pool: ['mirror-checksum', 'entropy-shield', 'ice-firewall'],
  },
  {
    identityTitle: '零号暗巷 · 记忆掠夺者',
    faction: '零号暗巷',
    motive: '收集各类高阶虚拟实体作为收藏，对强力黑客的本体结构抱有极强执念。',
    pool: ['zero-day-peek', 'phantom-swap', 'overclock-bluff'],
  },
];

export function getSkillById(id: string): SkillPoolEntry | undefined {
  return SKILL_POOL_REGISTRY.find((s) => s.id === id);
}

export function buildPursuerDossier(
  character: ContractCharacter,
  roundIndex: number
): PursuerDossier {
  let hash = Math.max(1, roundIndex);
  for (let i = 0; i < character.name.length; i += 1) {
    hash = (hash * 31 + character.name.charCodeAt(i)) >>> 0;
  }
  const template = PURSUER_ROLES[hash % PURSUER_ROLES.length];
  const threatLevel = Math.min(5, Math.max(1, 1 + Math.floor((roundIndex - 1) / 2)));

  const extraIds = SKILL_POOL_REGISTRY.map((s) => s.id).filter(
    (id) => !template.pool.includes(id)
  );
  const pool = [...template.pool];
  if (extraIds.length > 0) {
    pool.push(extraIds[hash % extraIds.length]);
  }

  return {
    identityTitle: `${template.identityTitle} · ${character.title}`,
    faction: template.faction,
    motive: template.motive,
    virtualEntityName: `幻影实体 // ${character.name} [${character.codename}]`,
    threatLevel,
    skillPoolIds: pool.slice(0, 4),
  };
}

export function pickLootSkillChoices(
  poolIds: string[],
  alreadyOwned: string[],
  count = 3
): string[] {
  const ownedSet = new Set(alreadyOwned);
  const unowned = poolIds.filter((id) => !ownedSet.has(id) && getSkillById(id));
  const fallbackPool = SKILL_POOL_REGISTRY.map((s) => s.id).filter(
    (id) => !ownedSet.has(id)
  );

  const selected: string[] = [];
  for (const id of [...unowned, ...fallbackPool, ...poolIds]) {
    if (!getSkillById(id)) continue;
    if (!selected.includes(id)) {
      selected.push(id);
    }
    if (selected.length >= count) break;
  }
  return selected;
}
