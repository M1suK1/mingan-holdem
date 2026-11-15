/**
 * 世界书：与 SillyTavern / night-sugar-office 的 World Info 同构的词条集合。
 *
 * 常驻词条（constant）每次请求都会注入；其余词条按关键词命中当前触发文本后注入。
 * 总预算默认 1600 字，按 priority 降序、order 升序装填，超预算的条目被丢弃并在预览里列出。
 */
import type { ContractCharacter } from './contractCards.ts';

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
  /** 由契约卡自动生成、在 UI 里只读的词条 */
  generated?: boolean;
}

export const WORLDBOOK_STORAGE_KEY = 'mingan-cyber-holdem:worldbook:v1';
export const WORLDBOOK_BUDGET = 1600;
export const WORLDBOOK_PLACEHOLDER = '{{worldbook}}';
export const GENERATED_ROLE_ENTRY_ID = 'wb-role-profile';

function makeEntry(
  id: string,
  name: string,
  content: string,
  options: { keys?: string[]; constant?: boolean; priority?: number; order?: number } = {}
): WorldbookEntry {
  return {
    id,
    name,
    content: content.trim(),
    keys: options.keys ?? [],
    enabled: true,
    constant: options.constant ?? false,
    priority: options.priority ?? 50,
    order: options.order ?? 0,
    builtin: true,
  };
}

/** 契约角色档案：每次读取都用当前角色重算，不落副本 */
export function roleWorldbookEntry(character?: ContractCharacter | null): WorldbookEntry {
  const name = character?.name ?? '未知契约者';
  const traits = character?.traits?.length
    ? character.traits.map((t) => `${t.name}（${t.description}）`).join('；')
    : '暂无公开特性';
  const voice = character?.voice
    ? [
        character.voice.tone ? `语气：${character.voice.tone}` : '',
        character.voice.habits.length ? `习惯：${character.voice.habits.join('；')}` : '',
      ]
        .filter(Boolean)
        .join('，')
    : '语气：冷静、带技术口癖';
  return {
    id: GENERATED_ROLE_ENTRY_ID,
    name: `契约角色 · ${name}`,
    keys: [name, character?.codename ?? '', character?.title ?? ''].filter(Boolean),
    content: [
      `【身份】${name}，称号「${character?.title ?? '无'}」，代号 ${character?.codename ?? '未登记'}。`,
      `【人格】${character?.personality ?? '冷静、谨慎、话不多。'}`,
      character?.witchPersonality ? `【过载态】${character.witchPersonality}` : '',
      `【特性】${traits}`,
      `【说话方式】${voice}`,
      character?.quote ? `【代表台词】「${character.quote}」` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    enabled: true,
    constant: true,
    priority: 94,
    order: 1,
    builtin: true,
    generated: true,
    comment: '由当前契约卡自动生成；要改内容请切换契约卡或编辑预设词条',
  };
}

export function builtinWorldbook(character?: ContractCharacter | null): WorldbookEntry[] {
  return [
    roleWorldbookEntry(character),
    makeEntry(
      'wb-protocol',
      '黑域协议',
      '黑域是一片没有物理边界的赛博空间。牌桌就是一台被双方共同持有的节点：算力即筹码，牌面即数据包，下注就是把算力写进公共奖池。这里没有荷官，只有协议。两位契约者在同一张桌上单挑，赢的人拿走奖池，输的人看着自己的算力被清空。',
      { constant: true, priority: 96, order: 0 }
    ),
    makeEntry(
      'wb-deck',
      '双花色牌组',
      '整副牌 52 张，只有两种花色：黑曜脉冲（黑）与绯霓电弧（粉），各 26 张，2 到 A 每个点数各有 2 份。因为只有两条花色通道，同花的成牌概率远高于常规扑克，「同花」在这个牌组里反而不是强牌。',
      { constant: true, keys: ['牌组', '花色', '52', '黑曜', '绯霓'], priority: 92, order: 2 }
    ),
    makeEntry(
      'wb-hierarchy',
      '牌型大小重排',
      '按真实成牌概率重排后的牌型顺序：四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌。注意「两对」压过「同花」——这是双花色牌组的必然结果，不要按常规德州经验判断。',
      { constant: true, keys: ['牌型', '大小', '同花', '两对'], priority: 95, order: 3 }
    ),
    makeEntry(
      'wb-board',
      '公共节点池',
      '四个公共槽先以加密暗牌存在，任何一方翻开后即成公开信息。未被翻开的槽位可以被换入新的手牌，换入的牌会标记来源方：己方换入的牌只有自己能看见其真实牌面，对手看到的是原牌。',
      { constant: true, keys: ['公共', '节点', '暗牌', '翻开'], priority: 88, order: 4 }
    ),
    makeEntry(
      'wb-swap',
      '换牌协议',
      '把一张己方明牌和一张公共暗牌互换，需要支付手续费，费用随换牌次数递增。换进来的暗牌成为私有手牌，之后不能再换出去。拖拽手牌到公共槽即可发起换牌。',
      { keys: ['换牌', '手续费', '拖拽', '互换'], priority: 72, order: 5 }
    ),
    makeEntry(
      'wb-raise',
      '加注与半池',
      '加注分三档预设，受阶段上限与每段次数限制。长按加注键可以一次性推进自身一半的算力（半池重注），它绕过常规档位上限。一旦有人加注，另一方必须先跟注补齐差额才能继续翻牌换牌，扫描与黑客技能同样要等差额补齐。',
      { constant: true, keys: ['加注', '跟注', '半池', '重注', '差额'], priority: 86, order: 6 }
    ),
    makeEntry(
      'wb-hack',
      '黑客技能三式',
      '三式篡改协议：点数 +1、点数 -1、反转花色。只能作用于自己的明牌，改动结果只有自己可见——对手看到的仍是原牌。使用需要预支算力，但不占用换牌与翻牌的行动次数，每回合只能使用一次。被对手扫描抓获时本人直接判负，且相应技能被封印。',
      { constant: true, priority: 90, order: 7 }
    ),
    makeEntry(
      'wb-scan',
      '扫描协议',
      '扫描可以核验一个对手目标是否被篡改过：可扫对手的手牌，也可扫对手换入的公共槽。抓到篡改，对方本轮直接判负，其黑客技能全部封印，奖池归扫描方。扫描每回合只能使用一次，且需要预支算力。',
      { constant: true, priority: 90, order: 8 }
    ),
    makeEntry(
      'wb-escrow',
      '预支托管',
      '黑客技能与扫描的预支算力不进入公开奖池，而是进入托管区。对局中任何人都看不到托管区的数额，只有在比牌、弃牌或抓获结算时才并入奖池一并发放。',
      { constant: true, priority: 82, order: 9 }
    ),
    makeEntry(
      'wb-settle',
      '结算与封印',
      '一手的结束方式有三种：一方弃牌、双方比牌、扫描抓获。比牌用真实牌面判定——即使牌被篡改过，结算只看最终的真实牌型。被封印的技能在后续手牌里持续失效，直到对局重开。',
      { constant: true, keys: ['结算', '比牌', '摊牌', '封印'], priority: 84, order: 10 }
    ),
    makeEntry(
      'wb-tone',
      '台词守则',
      '说话要像一个真实坐在牌桌对面的人：短句、有停顿、有态度，可以挑衅、可以示弱、可以岔开话题，但绝不复述规则条文。严禁透露自己是否使用了黑客技能，严禁说出被篡改的具体牌面，严禁输出任何 Emoji。单句控制在 80 字以内。',
      { constant: true, priority: 93, order: 11 }
    ),
  ];
}

export function sanitizeWorldbookEntry(raw: unknown, index: number): WorldbookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const content = typeof value.content === 'string' ? value.content.slice(0, 4000) : '';
  if (!content.trim()) return null;
  const rawKeys = Array.isArray(value.keys) ? value.keys : Array.isArray(value.key) ? value.key : [];
  const keys = rawKeys
    .filter((key): key is string => typeof key === 'string' && Boolean(key.trim()))
    .map((key) => key.trim().slice(0, 24))
    .slice(0, 12);
  const name =
    typeof value.name === 'string' && value.name.trim()
      ? value.name.trim().slice(0, 40)
      : typeof value.comment === 'string' && value.comment.trim()
        ? value.comment.trim().slice(0, 40)
        : `词条 ${index + 1}`;
  return {
    id:
      typeof value.uid === 'string'
        ? value.uid
        : typeof value.id === 'string' && value.id
          ? value.id
          : typeof value.uid === 'number'
            ? `wb-${value.uid}`
            : `wb-${index}-${Date.now().toString(36)}`,
    name,
    keys,
    content,
    enabled: value.disable === true ? false : value.enabled !== false,
    constant: value.constant === true,
    priority:
      typeof value.priority === 'number' ? Math.min(100, Math.max(0, Math.round(value.priority))) : 50,
    order: typeof value.order === 'number' ? Math.min(999, Math.max(-999, Math.round(value.order))) : index + 1,
    comment: typeof value.comment === 'string' ? value.comment.slice(0, 80) : undefined,
    builtin: Boolean(value.builtin),
    generated: value.generated === true,
  };
}

function readRawList(raw: string): unknown[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      const entries = (parsed as { entries?: unknown }).entries;
      if (Array.isArray(entries)) return entries;
      if (entries && typeof entries === 'object') return Object.values(entries as Record<string, unknown>);
    }
    return null;
  } catch {
    return null;
  }
}

export function loadWorldbook(character?: ContractCharacter | null): WorldbookEntry[] {
  const builtins = builtinWorldbook(character);
  if (typeof window === 'undefined' || !window.localStorage) return builtins;
  try {
    const raw = window.localStorage.getItem(WORLDBOOK_STORAGE_KEY);
    if (!raw) return builtins;
    const list = readRawList(raw);
    if (!list) return builtins;
    const custom = list
      .map((item, index) => sanitizeWorldbookEntry(item, index))
      .filter((item): item is WorldbookEntry => Boolean(item));
    if (!custom.length) return builtins;
    // 生成条目始终用当前契约卡重算，不信任存档里的旧副本
    const withoutGenerated = custom.filter((item) => item.id !== GENERATED_ROLE_ENTRY_ID);
    return [roleWorldbookEntry(character), ...withoutGenerated];
  } catch {
    return builtins;
  }
}

export function saveWorldbook(entries: WorldbookEntry[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(WORLDBOOK_STORAGE_KEY, JSON.stringify(entries.slice(0, 80)));
    return true;
  } catch {
    return false;
  }
}

export function createWorldbookEntry(existing: WorldbookEntry[]): WorldbookEntry {
  return {
    id: `wb-custom-${Date.now().toString(36)}-${existing.length}`,
    name: '新词条',
    keys: [],
    content: '',
    enabled: true,
    constant: false,
    priority: 50,
    order: existing.length,
  };
}

export interface WorldbookContext {
  text: string;
  hits: { id: string; name: string; reason: 'constant' | 'key' }[];
  chars: number;
  dropped: number;
}

/** 常驻 + 关键词命中的词条，按 priority 降序、order 升序装入预算 */
export function worldbookContext(
  trigger: string,
  entries: WorldbookEntry[],
  budget = WORLDBOOK_BUDGET
): WorldbookContext {
  const haystack = trigger.toLowerCase();
  const scored = entries
    .filter((item) => item.enabled)
    .map((item) => {
      const keyHit = item.keys.find((key) => key && haystack.includes(key.toLowerCase()));
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
  return { text: parts.join('\n\n'), hits, chars: used, dropped };
}

export interface WorldbookImportResult {
  ok: boolean;
  message: string;
  entries?: WorldbookEntry[];
}

export function importWorldbookJson(source: string): WorldbookImportResult {
  const list = readRawList(source);
  if (!list) return { ok: false, message: '没有找到 entries，请选择世界书导出的 JSON。' };
  const entries = list
    .map((item, index) => sanitizeWorldbookEntry(item, index))
    .filter((item): item is WorldbookEntry => Boolean(item));
  if (!entries.length) return { ok: false, message: '词条都为空或缺少 content。' };
  return { ok: true, message: `已导入 ${entries.length} 条词条。`, entries };
}

export function exportWorldbookJson(entries: WorldbookEntry[]): string {
  const map: Record<string, unknown> = {};
  entries.forEach((item, index) => {
    map[String(index)] = {
      uid: index,
      key: item.keys,
      comment: item.name,
      content: item.content,
      constant: item.constant,
      disable: !item.enabled,
      order: item.order,
      priority: item.priority,
    };
  });
  return JSON.stringify({ entries: map, name: '黑域协议 · 世界书' }, null, 2);
}
