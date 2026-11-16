import type { ContractCharacter } from './contractCards.ts';
import type { ContractExpression } from './types.ts';

export const ECHO0_ASSET_BASE = './assets/story/echo0';

export const ECHO0_EXPRESSION_PATHS: Record<ContractExpression, string> = {
  calm: `${ECHO0_ASSET_BASE}/calm.webp`,
  smile: `${ECHO0_ASSET_BASE}/smile.webp`,
  surprise: `${ECHO0_ASSET_BASE}/surprise.webp`,
  sad: `${ECHO0_ASSET_BASE}/sad.webp`,
  angry: `${ECHO0_ASSET_BASE}/angry.webp`,
  shy: `${ECHO0_ASSET_BASE}/shy.webp`,
};

export const SEC01_ASSET_BASE = './assets/story/sec01';

export const SEC01_EXPRESSION_PATHS: Record<ContractExpression, string> = {
  calm: `${SEC01_ASSET_BASE}/calm.webp`,
  smile: `${SEC01_ASSET_BASE}/smile.webp`,
  surprise: `${SEC01_ASSET_BASE}/surprise.webp`,
  sad: `${SEC01_ASSET_BASE}/sad.webp`,
  angry: `${SEC01_ASSET_BASE}/angry.webp`,
  shy: `${SEC01_ASSET_BASE}/shy.webp`,
};

function buildDualVariants(paths: Record<ContractExpression, string>): Record<string, string> {
  const variants: Record<string, string> = { ...paths };
  for (const [expr, url] of Object.entries(paths)) {
    variants[`witchform:${expr}`] = url;
    variants[`custom:${expr}`] = url;
  }
  return variants;
}

/**
 * 第一章 / Demo 女主「零回响 // ECHO-0」正式角色档案
 * 贴合全白机能 + 冰青荧光回路 + 半透明数据蝶翼 + 耳机拟态电子人形立绘。
 */
export const ECHO0_CHARACTER_DOSSIER: ContractCharacter = {
  id: 'echo0',
  fileName: 'story-echo0-dossier.json',
  name: '零回响',
  codename: 'ECHO-0',
  title: '叛逃核心协议 AI',
  element: '幽蓝算法系',
  archetype: '控制',
  color: '#00F0FF',
  quote:
    '别用人类那种按部就班的蠢逻辑去算牌——既然桌面也是协议，那就把规则一起改写掉。',
  goal:
    '寄生于无名底层黑客的虚拟实体壳层，穿过四重围堵偷渡出黑域协议网，带出核心绝密数据「原初账本」。',
  appearance:
    '娇小纤细的拟态电子人形。银白碎短发发尾渐变为高饱和冰青荧光，左耳佩戴带微麦的发光环状战术耳麦，纯白短款机能上衣、透明薄纱袖套与白色长袜间流淌着冰青电路脉络，赤足悬浮，背后舒展一对锐利的半透明冰青全息数据蝶翼。',
  personality:
    '毒舌而冷静的极致理性派，习惯把博弈拆解成赔率与算力损耗；起初只把玩家当作不起眼的“一次性走私容器”，却在连续回溯兜底与并肩突围中产生了逻辑外的偏袒，最终不惜烧毁自身权限替搭档强行改命。',
  witchPersonality:
    '当全部残存权限超频燃烧时，原本慵懒半眯的冷淡视线会化作绝对零度的覆写状态——强行撕碎时间锚点，只为替唯一的搭档撬开那条千分之一的生路。',
  outfitDescription:
    '纯白极简机能露腰短衣配半透明发光袖套、冰青回路纹路贴身数据袜与蕾丝袜带、无鞋赤足浮空、全息冰青半透明数据光翼。',
  stats: {
    magic: 92,
    insight: 95,
    agility: 84,
    empathy: 38,
  },
  traits: [
    {
      id: 'echo0-rewind-anchor',
      name: '时间锚点 // REWIND',
      polarity: 'positive',
      tags: ['Meta 护盾', '因果回溯'],
      description:
        '消耗自身核心完整度截胡系统抹除指令，让玩家在追杀战败或踩中闸门陷阱后回溯重开并标红已知危险槽位；共鸣燃尽后按钮永久碎裂。',
    },
    {
      id: 'echo0-four-aces-override',
      name: '绝命覆写 // FOUR ACES',
      polarity: 'positive',
      tags: ['权限献祭', '终局反杀'],
      description:
        '在零号闸门绝境摊牌瞬间献祭全部黑客与回溯权限，强行屏蔽公共牌陷阱并将手牌覆写为三张 A（联动公共牌第 4 张 A）合法组成四条 A 碾压破门。',
    },
    {
      id: 'echo0-high-threat-beacon',
      name: '异常信标 // SHELL://ECHO-0',
      polarity: 'negative',
      tags: ['全网通缉', '轨迹暴露'],
      description:
        '持续向黑域高层与暗市广播微弱异常协议密钥，吸引拾荒者、净网审计官与闸门清道夫沿路由层层合围截杀。',
    },
  ],
  voice: {
    tone: '声线清冷略带轻微电子混响，平日语调慵懒漫不经心，危机逼近时语速加快且字句精准如系统日志。',
    habits: [
      '习惯用终端状态码和百分比评价玩家的牌桌失误',
      '嘴上嫌弃玩家是“低算力人类”，关键时刻却总会先一步拦截致命伤害',
      '情绪波动较大时耳麦与翼梢荧光频率会同步闪烁',
    ],
    samples: [
      '算力归零。按黑域协议，这具壳层归你了……别回头，带上它往出口走。',
      '又踩雷了？真是拿你没办法……时间线已重置，右数那个槽位我已经替你标红了。',
      '听好了，接下来没有回溯按钮替你兜底了——但至少这一步，换我来替你改命。',
      '……抱歉，把你牵扯进猎杀榜第一名的麻烦里。接下来，活下去吧，搭档。',
    ],
  },
  portrait: ECHO0_EXPRESSION_PATHS.calm,
  witchPortrait: ECHO0_EXPRESSION_PATHS.calm,
  variants: buildDualVariants(ECHO0_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

/**
 * SEC-01 底层排水巷道追捕者：「凌翡 // JADE-01」嚣张跋扈的千金大小姐档案
 * 保留 SEC-01 专属技能「算力虹吸」(siphon-cache) 与掉落技能池不变。
 */
export const SEC01_CHARACTER_DOSSIER: ContractCharacter = {
  id: 'sec01-jade-heiress',
  fileName: 'story-sec01-dossier.json',
  name: '凌翡',
  codename: 'JADE-01',
  title: '黑市财阀千金 · 金扇收割者',
  element: '黑金翡霓系',
  archetype: '强袭',
  color: '#FFB020',
  quote:
    '连本小姐的扇风都接不住的穷鬼黑客，也敢在暗区亮底牌？算力不够就乖乖把壳层交出来吧！',
  goal:
    '把外围暗区当作自家游乐场猎奇搜刮稀有虚拟实体，顺便用绝对的算力落差向黑市证明自己比家族那群老顽固更懂收割规矩。',
  appearance:
    '身着黑金暗纹露背高开衩旗袍的财阀千金大小姐。墨黑长发中挑染高饱和翡青发丝，盘起双丸子头并以金丝缎带束起，头顶架着圆框茶色墨镜，肩挂雪白狐裘披肩，配黑蕾丝长手套、透肤黑丝与红底细高跟，手持金骨折扇回眸斜睨，神态居高临下。',
  personality:
    '极度嚣张跋扈、嘴硬又爱面子的财阀千金。把算力当零花钱挥霍，动辄用「算力虹吸」强抽穷鬼玩家的筹码当茶水费；一旦牌局被翻盘或遭扫描当场抓包，就会立刻炸毛恼羞甚至委屈泛泪，嘴上却死不认输。',
  witchPersonality:
    '当千金大小姐的自尊被底层黑客当面踩碎时，折扇猛然收拢、墨镜滑落鼻梁——不再顾及优雅仪态，不惜超频烧光算力也要把对面拆个精光。',
  outfitDescription:
    '黑金刺绣露背高开衩长旗袍、雪白狐裘臂挽披肩、黑蕾丝长手套、透肤黑丝、红底细高跟鞋、茶色圆框墨镜与金骨折扇。',
  stats: {
    magic: 78,
    insight: 70,
    agility: 82,
    empathy: 32,
  },
  traits: [
    {
      id: 'sec01-siphon-tax',
      name: '算力虹吸 // SIPHON TAX',
      polarity: 'positive',
      tags: ['SEC-01 专属', '加注抽税'],
      description:
        '秉承“和本小姐同桌就得交入场税”的霸道逻辑：每手首次主动加注成功时，额外从玩家吸取 25 算力充入自己的底池防线。',
    },
    {
      id: 'sec01-heiress-arrogance',
      name: '千金排场 // GOLDEN FAN',
      polarity: 'positive',
      tags: ['压迫施压', '激进试探'],
      description:
        '极其偏爱高调加注与炫耀式换牌，习惯用算力优势在前期逼退对手；面对弱牌试探绝不肯低头弃牌。',
    },
    {
      id: 'sec01-fragile-pride',
      name: '玻璃自尊 // PRIDE CRACK',
      polarity: 'negative',
      tags: ['情绪破防', '嘴硬心慌'],
      description:
        '从小顺风顺水、吃不得半点暗亏；一旦改牌被扫获或遭大牌反杀，表情瞬间从得意洋洋切到恼羞炸毛甚至泛泪。',
    },
  ],
  voice: {
    tone: '语调清脆骄纵带着拖长的鼻音与嗤笑，得意时像拿折扇敲着桌面发号施令，吃瘪时音调骤高、咬牙切齿。',
    habits: [
      '开口闭口自称“本小姐”，习惯把对手叫做“穷鬼黑客”或“乡巴佬”',
      '每次主动加注吸到算力都会轻掩折扇发笑',
      '一旦算力落于下风会立刻把责任推给“这破巷道信号太脏”',
    ],
    samples: [
      '啧，这破排水巷道的信号味真冲……喂，对面的穷鬼，你的壳层值几个钱？本小姐勉为其难收了！',
      '加注都跟得这么磨磨蹭蹭？按规矩先交 25 算力茶水费过来，别耽误本小姐喝下午茶。',
      '什、什么？！你这穷酸黑客怎么可能凑出这种牌型……一定是这台终端延迟太高了，不算！',
      '呜……算力居然被你一个底层黑客清零了？！你给我记住！本小姐早晚十倍连本带利讨回来！',
    ],
  },
  portrait: SEC01_EXPRESSION_PATHS.calm,
  witchPortrait: SEC01_EXPRESSION_PATHS.smile,
  variants: buildDualVariants(SEC01_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

export const STORY_CHARACTER_DOSSIERS: ContractCharacter[] = [
  ECHO0_CHARACTER_DOSSIER,
  SEC01_CHARACTER_DOSSIER,
];

export function resolveEcho0Sprite(expression: ContractExpression = 'calm'): string {
  return ECHO0_EXPRESSION_PATHS[expression] ?? ECHO0_EXPRESSION_PATHS.calm;
}

export function resolveSec01Sprite(expression: ContractExpression = 'calm'): string {
  return SEC01_EXPRESSION_PATHS[expression] ?? SEC01_EXPRESSION_PATHS.calm;
}

export function getStoryCharacterByEscapeNode(nodeIndex: number | null): ContractCharacter | null {
  if (nodeIndex === 0) return ECHO0_CHARACTER_DOSSIER;
  if (nodeIndex === 1) return SEC01_CHARACTER_DOSSIER;
  return null;
}
