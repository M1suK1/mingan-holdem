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
  variants: { ...ECHO0_EXPRESSION_PATHS },
  expressionCount: 6,
  hasVoice: false,
};

export function resolveEcho0Sprite(expression: ContractExpression = 'calm'): string {
  return ECHO0_EXPRESSION_PATHS[expression] ?? ECHO0_EXPRESSION_PATHS.calm;
}
