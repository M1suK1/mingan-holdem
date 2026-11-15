import type { ContractCharacter } from './contractCards.ts';
import type { PursuerDossier, SkillPoolEntry } from './types.ts';

/**
 * 黑域协议技能池注册表（预留扩展接口：后续可直接往此数组追加实装技能）。
 */
export const SKILL_POOL_REGISTRY: SkillPoolEntry[] = [
  {
    id: 'ghost-packet',
    name: '幽灵封包',
    category: 'hack',
    summary: '向己方明牌注入伪造校验头，令本手第一次改牌逃避常规帧校验（后续实装槽位）。',
    costHint: 45,
    implemented: false,
    tags: ['隐匿', '篡改', '待填充'],
  },
  {
    id: 'parity-spoof',
    name: '奇偶欺骗',
    category: 'hack',
    summary: '将指定手牌在对手视觉缓冲区偏移至同奇偶邻近点数（后续实装槽位）。',
    costHint: 50,
    implemented: false,
    tags: ['干扰', '点数', '待填充'],
  },
  {
    id: 'ice-firewall',
    name: '冰墙锁帧',
    category: 'protocol',
    summary: '冻结中央节点池一枚已公开牌面，本小局禁止被任何换牌动作替换（后续实装槽位）。',
    costHint: 60,
    implemented: false,
    tags: ['封锁', '公共牌', '待填充'],
  },
  {
    id: 'mirror-checksum',
    name: '镜像校验',
    category: 'recon',
    summary: '对公共牌池执行轻量镜像比对，降低单次扫描预支算力开销（后续实装槽位）。',
    costHint: 30,
    implemented: false,
    tags: ['反制', '扫描', '待填充'],
  },
  {
    id: 'overclock-bluff',
    name: '超频威慑',
    category: 'protocol',
    summary: '在加注同时触发虚像脉冲，向对端释放高威胁度算力压迫信号（后续实装槽位）。',
    costHint: 35,
    implemented: false,
    tags: ['加注', '心理战', '待填充'],
  },
  {
    id: 'trace-scramble',
    name: '追踪扰频',
    category: 'passive',
    summary: '被动降低黑域通缉热度攀升速度，并在被扫描抓获时保留额外容错（后续实装槽位）。',
    implemented: false,
    tags: ['被动', '反追踪', '待填充'],
  },
  {
    id: 'zero-day-peek',
    name: '零日窥视',
    category: 'recon',
    summary: '读取一张中央加密暗牌的低位花色熵值，不惊动对端监控（后续实装槽位）。',
    costHint: 55,
    implemented: false,
    tags: ['侦察', '双花色', '待填充'],
  },
  {
    id: 'entropy-shield',
    name: '熵减护盾',
    category: 'passive',
    summary: '当算力低于警戒阈值时自动吸收部分盲注损耗（后续实装槽位）。',
    implemented: false,
    tags: ['被动', '续航', '待填充'],
  },
  {
    id: 'phantom-swap',
    name: '幻影换槽',
    category: 'hack',
    summary: '以一次虚拟重构替代换牌门票，将已锁定的手牌再次投入暗牌池（后续实装槽位）。',
    costHint: 65,
    implemented: false,
    tags: ['换牌', '机动', '待填充'],
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

  // Rotate skill pool slightly by character insight/magic stats so each pursuer feels distinct
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
