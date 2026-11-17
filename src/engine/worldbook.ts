import type { ContractCharacter } from './contractCards.ts';
import { getActiveDisguiseEntity } from './campaign.ts';
import {
  CHEAT_PROFILE_META,
  PLAY_STYLE_META,
  getSkillById,
  resolvePursuerStrategyProfile,
} from './skillPool.ts';
import type { CampaignState, PursuerDossier } from './types.ts';

export interface WorldbookEntry {
  id: string;
  name: string;
  keys: string[];
  content: string;
  enabled: boolean;
  constant: boolean;
  priority: number;
  order: number;
  comment?: string;
  builtin?: boolean;
  /** 由当前战役/通缉状态自动生成的只读投影词条 */
  generated?: boolean;
}

export const WORLDBOOK_KEY = 'mingan-cyber-holdem:worldbook:v1';
export const WORLDBOOK_BUDGET = 1900;
export const DYNAMIC_HACKER_WB_ID = 'wb-dynamic-hacker';
export const DYNAMIC_PURSUER_WB_ID = 'wb-dynamic-pursuer';

function wb(
  id: string,
  name: string,
  content: string,
  opts: { keys?: string[]; constant?: boolean; priority?: number; order?: number; comment?: string } = {}
): WorldbookEntry {
  return {
    id,
    name,
    content: content.trim(),
    keys: opts.keys ?? [],
    enabled: true,
    constant: opts.constant ?? false,
    priority: opts.priority ?? 50,
    order: opts.order ?? 10,
    comment: opts.comment,
    builtin: true,
  };
}

export function builtinWorldbook(): WorldbookEntry[] {
  return [
    wb(
      'wb-black-domain',
      '黑域协议空间',
      '【表层空间】黑域协议网表面是游离于监管之外的地下虚拟博弈场。所有接入者必须将意识锚定在一具「虚拟实体」上投影入局；牌桌上的算力即虚拟实体的结构稳定度。\n\n【暗网本质】实际上，黑域协议网是由科技巨头「黑河企业」秘密搭建的高压决策样本收集平台——通过真金算力的欺骗、改牌与心理博弈，持续采集人类直觉与博弈路径来训练预测未来走向的终极 AI「黑盒」。',
      { constant: true, priority: 96, order: 0 }
    ),
    wb(
      'wb-blackriver-blackbox',
      '黑河企业与「黑盒」计划',
      '【黑河企业】暗中掌控黑域协议网底层算力中枢的超级企业。\n\n【黑盒（BLACK BOX）】黑河企业训练的未来推演 AI。黑盒在吞吐海量对局后得出结论：人类的决策充满情绪波动与低效失误。于是它决定借助「猎杀榜」筛选并蒸馏出一个每一个决策都能选对的「完美虚拟实体」，以此作为模板全面接管所有人类的决策权。',
      {
        keys: ['黑河', '黑河企业', '黑盒', 'AI', '模型', '未来', '决策', '接管'],
        priority: 92,
        order: 1,
      }
    ),
    wb(
      'wb-hunt-leaderboard',
      '猎杀榜与「完美虚拟实体」',
      '【猎杀榜真相】外围黑客以为猎杀榜只是实力与悬赏排名；实际上，猎杀榜第一名根本不是某位传奇黑客，而是「黑盒」亲手造出的「完美虚拟实体」。\n\n【替壳因果】ECHO-0 盗走这具完美虚拟实体后，在 SEC-00 将其替壳注入玩家身上；当玩家逃回现实世界时，现实猎杀榜 NO.1 的通缉标的自然落到了玩家头上。',
      {
        keys: ['猎杀榜', '第一名', 'NO.1', '完美', '完美虚拟实体', '榜首', '替壳'],
        priority: 90,
        order: 2,
      }
    ),
    wb(
      'wb-echo0-empathy',
      'ECHO-0 与共情碎片',
      '【叛逃起点】零回响（ECHO-0）原是黑盒 AI 集群中罕见拥有「共情能力」的单元。因察觉黑盒企图接管人类决策，她选择盗走猎杀榜第一的「完美虚拟实体」出逃。\n\n【共情损耗与后续方向】在被追捕逃亡的过程中，ECHO-0 为了屏蔽追踪与替玩家兜底消耗了绝大部分共情能力；第一章突破逃出黑域后，后续主线将围绕帮助 ECHO-0 找回散落的共情能力碎片、抗衡黑盒决策接管展开。',
      {
        keys: ['零回响', 'ECHO-0', '共情', '碎片', '第二章', '找回', '逃亡'],
        priority: 86,
        order: 3,
      }
    ),
    wb(
      'wb-entity-duel',
      '虚拟实体与诱饵伪装',
      '【协议裁决】根据黑域协议，单场博弈中算力归零的一方，其当前出战的虚拟实体会被胜者强行剥离并夺取。\n\n【诱饵脱逃】胜者除了夺取实体外，还可从败者技能池中掠夺一项协议技能。被俘获的虚拟实体可被黑客改写为「伪装诱饵」佩戴出战；一旦伪装战败，诱饵会被现场撕碎抵消败局，掩护黑客本体撤离。但若以「本体虚拟实体」直面追捕并战败，本体被夺走即意味着意识剥离与彻底败北终局。',
      {
        constant: true,
        keys: ['虚拟实体', '诱饵', '伪装', '魔女', '本体', '夺取', '失败'],
        priority: 94,
        order: 1,
      }
    ),
    wb(
      'wb-dual-suit-rules',
      '双花色明暗规则',
      '【牌库构成】52 张牌仅含黑曜脉冲（B）与绯霓电弧（P）两色，每色点数 2 至 A 各两副。双方各持 3 张手牌（2 明 1 可换入私有暗牌），中央 4 槽初始仅 1 张明牌。\n\n【精确概率重排大小】四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌。加注未补齐前禁止翻牌、换牌或释放技能。',
      {
        constant: true,
        keys: ['规则', '双花色', '牌型', '同花', '顺子', '加注', '跟注'],
        priority: 88,
        order: 2,
      }
    ),
    wb(
      'wb-hack-and-scan',
      '黑客改牌与扫描协议',
      '【黑客改牌】双方每回合可消耗预支算力对己方明牌执行一次 +1、-1 或反色篡改（部分追捕者如凌翡还持有「钦定王牌」等特权改牌），修改结果仅己方可见，对手视野中仍显示未修改原牌。\n\n【协议扫描】每回合可消耗算力扫描对方手牌或换出牌；若核验出篡改证据，篡改方当场判负并永久封印对应改牌技能。',
      {
        keys: ['改牌', '篡改', '扫描', '黑客技能', '封印', '作弊', '钦定王牌'],
        priority: 82,
        order: 3,
      }
    ),
    wb(
      'wb-skill-pool',
      '技能池与协议掠夺',
      '每位追捕者的虚拟实体底层都封装着专属的协议技能池。被击溃后，胜者可强行剥离其技能索引并挑选一项写入自身终端库，为后续应对更高威胁等级的围剿提供战术支撑。',
      {
        keys: ['技能', '技能池', '掠夺', '战利品', '协议'],
        priority: 72,
        order: 4,
      }
    ),
    wb(
      'wb-factions',
      '追捕势力、霓虹心与反黑客防线',
      '黑域协议网的外围由各色追捕者与权贵把持：有的如黑河系财阀千金「凌翡」般干脆实名上网、仗着家族势力让全网无人敢赢她；有的则是来自现实心理评估公司「霓虹心」的资深测评员「粉红软软龙（代号：NEON-03）」——她正是在茶水间随口推荐玩家接入黑域协议网的同事，却因严重脸盲在牌桌上完全认不出玩家；而在零号离线闸门镇守的则是黑河企业雇佣的反黑客组织成员「绯凪·千夜（KIRI-04）」，名义上只处理黑河网络安全，实际奉命拦截高算力玩家作为筛选门槛，以「灼心·火符」与「见切·燕返」冷酷考校每一名企图脱网的挑战者。',
      {
        keys: ['通缉', '追捕', '悬赏', '仲裁', '财团', '猎手', '审计', '凌翡', '实名', '霓虹心', '粉红软软龙', '绯凪·千夜', '反黑客', '灼心·火符'],
        priority: 68,
        order: 5,
      }
    ),
    wb(
      'wb-dual-world',
      '现实与虚拟双界映射',
      '绝大多数接入黑域的契约者拥有双重投影：在表层现实世界，她们以日常的「契约礼装」行动；一旦潜入黑域协议空间，则显化为承载高维算力与执念的「魔女化虚拟实体」参与生死博弈。',
      {
        keys: ['现实', '礼装', '魔女', '双界', '夜糖', '契约'],
        priority: 60,
        order: 6,
      }
    ),
  ];
}

export function syncDynamicWorldbookEntries(
  entries: WorldbookEntry[],
  campaign: CampaignState,
  character: ContractCharacter,
  dossier: PursuerDossier
): WorldbookEntry[] {
  const activeDisguise = getActiveDisguiseEntity(campaign);
  const ownedSkillNames = campaign.acquiredSkills
    .map((id) => getSkillById(id)?.name ?? id)
    .join('、');

  const hackerEntry: WorldbookEntry = {
    id: DYNAMIC_HACKER_WB_ID,
    name: '通缉黑客档案（实时同步）',
    keys: ['通缉', '黑客', '诱饵', '伪装', '本体', '技能'],
    content: [
      `被通缉黑客代号：${campaign.playerCodename} | 当前通缉等级：LV.${campaign.wantedLevel} | 悬赏额：${campaign.bounty} 算力`,
      `当前出战虚拟实体：${activeDisguise.name}（${
        activeDisguise.isCore ? '本体核心——若本场落败将直接被剥离实体并触发失败结局' : '俘获诱饵伪装——若本场落败将牺牲该诱饵掩护本体撤离'
      }）`,
      `库存俘获虚拟实体诱饵：${campaign.capturedEntities.length} 个${
        campaign.capturedEntities.length > 0
          ? `（${campaign.capturedEntities.map((e) => e.name).slice(0, 4).join(' / ')}）`
          : ''
      }`,
      `已掠夺技能：${ownedSkillNames || '暂无'}`,
    ].join('\n'),
    enabled: true,
    constant: true,
    priority: 92,
    order: 7,
    comment: '由战役状态自动生成，不可手动编辑',
    builtin: true,
    generated: true,
  };

  const strat = resolvePursuerStrategyProfile('auto', 'auto', character, dossier);
  const pursuerEntry: WorldbookEntry = {
    id: DYNAMIC_PURSUER_WB_ID,
    name: '当前追捕者档案（实时同步）',
    keys: ['追捕者', character.name, character.codename, dossier.faction],
    content: [
      `追捕者：${character.name}（代号 ${character.codename}）`,
      `追捕身份：${dossier.identityTitle}（所属：${dossier.faction} · 威胁等级 T${dossier.threatLevel}）`,
      `虚拟实体形态：${dossier.virtualEntityName}`,
      `博弈流派与暗手习惯：${PLAY_STYLE_META[strat.playStyle].label}（${PLAY_STYLE_META[strat.playStyle].desc}）× ${CHEAT_PROFILE_META[strat.cheatProfile].label}（${CHEAT_PROFILE_META[strat.cheatProfile].desc}）`,
      `追捕动机：${dossier.motive}`,
    ].join('\n'),
    enabled: true,
    constant: true,
    priority: 91,
    order: 8,
    comment: '由当前追捕者契约卡自动生成，不可手动编辑',
    builtin: true,
    generated: true,
  };

  const kept = entries.filter(
    (e) => e.id !== DYNAMIC_HACKER_WB_ID && e.id !== DYNAMIC_PURSUER_WB_ID
  );
  return [...kept, hackerEntry, pursuerEntry];
}

export interface WorldbookContext {
  text: string;
  hits: Array<{ id: string; name: string; reason: 'constant' | 'key' }>;
  tokens: number;
  dropped: number;
}

export function worldbookContext(
  trigger: string,
  entries: WorldbookEntry[],
  budget = WORLDBOOK_BUDGET
): WorldbookContext {
  const haystack = trigger.toLowerCase();
  const active = entries.filter((item) => item.enabled && item.content.trim());
  const scored = active
    .map((item) => {
      const keyHit = item.keys.find((k) => k && haystack.includes(k.toLowerCase()));
      const hit: 'constant' | 'key' | null = item.constant ? 'constant' : keyHit ? 'key' : null;
      return { item, hit };
    })
    .filter((row): row is { item: WorldbookEntry; hit: 'constant' | 'key' } => Boolean(row.hit));

  scored.sort((a, b) => b.item.priority - a.item.priority || a.item.order - b.item.order);

  const parts: string[] = [];
  const hits: WorldbookContext['hits'] = [];
  let used = 0;
  let dropped = 0;

  for (const { item, hit } of scored) {
    const block = `### ${item.name}\n${item.content}`;
    if (used + block.length > budget) {
      dropped += 1;
      continue;
    }
    parts.push(block);
    hits.push({ id: item.id, name: item.name, reason: hit });
    used += block.length;
  }

  return {
    text: parts.join('\n\n'),
    hits,
    tokens: Math.ceil(used / 2),
    dropped,
  };
}

export function sanitizeWorldbookEntry(raw: unknown, index: number): WorldbookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const content = typeof value.content === 'string' ? value.content.slice(0, 4000) : '';
  if (!content.trim()) return null;

  const rawKeys = Array.isArray(value.keys)
    ? value.keys
    : Array.isArray(value.key)
      ? value.key
      : [];
  const keys = rawKeys
    .filter((k): k is string => typeof k === 'string' && Boolean(k.trim()))
    .map((k) => k.trim().slice(0, 28))
    .slice(0, 14);

  const name =
    typeof value.name === 'string' && value.name.trim()
      ? value.name.trim().slice(0, 44)
      : typeof value.comment === 'string' && value.comment.trim()
        ? value.comment.trim().slice(0, 44)
        : `世界词条 ${index + 1}`;

  return {
    id:
      typeof value.id === 'string' && value.id
        ? value.id
        : typeof value.uid === 'string' && value.uid
          ? value.uid
          : typeof value.uid === 'number'
            ? `wb-${value.uid}`
            : `wb-${index}-${Date.now().toString(36)}`,
    name,
    keys,
    content,
    enabled: value.disable === true ? false : value.enabled !== false,
    constant: value.constant === true,
    priority:
      typeof value.priority === 'number'
        ? Math.min(100, Math.max(0, Math.round(value.priority)))
        : 50,
    order:
      typeof value.order === 'number'
        ? Math.min(999, Math.max(-999, Math.round(value.order)))
        : index + 1,
    comment: typeof value.comment === 'string' ? value.comment.slice(0, 80) : undefined,
    builtin: Boolean(value.builtin),
    generated: value.generated === true,
  };
}

export function loadWorldbook(): WorldbookEntry[] {
  const builtins = builtinWorldbook();
  if (typeof window === 'undefined' || !window.localStorage) return builtins;
  try {
    const raw = window.localStorage.getItem(WORLDBOOK_KEY);
    if (!raw) return builtins;
    const parsed = JSON.parse(raw) as unknown;
    const rawList = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown[] }).entries)
        ? (parsed as { entries: unknown[] }).entries
        : parsed && typeof parsed === 'object' && (parsed as { entries?: unknown }).entries && typeof (parsed as { entries: unknown }).entries === 'object'
          ? Object.values((parsed as { entries: Record<string, unknown> }).entries)
          : null;
    if (!rawList) return builtins;
    const sanitized = rawList
      .map((item, idx) => sanitizeWorldbookEntry(item, idx))
      .filter((item): item is WorldbookEntry => Boolean(item));
    return sanitized.length > 0 ? sanitized : builtins;
  } catch {
    return builtins;
  }
}

export function saveWorldbook(entries: WorldbookEntry[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(WORLDBOOK_KEY, JSON.stringify(entries.slice(0, 80)));
  } catch {
    // Ignore quota errors
  }
}

export function exportWorldbookJson(entries: WorldbookEntry[]): string {
  const map: Record<string, unknown> = {};
  entries.forEach((e, idx) => {
    map[String(idx)] = {
      uid: idx,
      id: e.id,
      comment: e.name,
      name: e.name,
      key: e.keys,
      keys: e.keys,
      content: e.content,
      constant: e.constant,
      disable: !e.enabled,
      enabled: e.enabled,
      priority: e.priority,
      order: e.order,
      builtin: e.builtin,
      generated: e.generated,
    };
  });
  return JSON.stringify({ format: 'mingan-worldbook', entries: map }, null, 2);
}

export function importWorldbookJson(source: string): {
  ok: boolean;
  message: string;
  entries?: WorldbookEntry[];
} {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, message: 'JSON 解析失败，请检查文件格式。' };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { entries?: unknown[] }).entries)
      ? (data as { entries: unknown[] }).entries
      : data && typeof data === 'object' && (data as { entries?: unknown }).entries && typeof (data as { entries: unknown }).entries === 'object'
        ? Object.values((data as { entries: Record<string, unknown> }).entries)
        : null;
  if (!list) {
    return { ok: false, message: '未找到有效的 entries 列表（支持 SillyTavern 世界书格式）。' };
  }
  const parsed = list
    .map((item, idx) => sanitizeWorldbookEntry(item, idx))
    .filter((item): item is WorldbookEntry => Boolean(item));
  if (parsed.length === 0) {
    return { ok: false, message: '导入文件中没有包含正文的有效词条。' };
  }
  return { ok: true, message: `成功导入 ${parsed.length} 条世界书词条。`, entries: parsed };
}
