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

export const SEC02_ASSET_BASE = './assets/story/sec02';

export const SEC02_EXPRESSION_PATHS: Record<ContractExpression, string> = {
  calm: `${SEC02_ASSET_BASE}/calm.webp`,
  smile: `${SEC02_ASSET_BASE}/smile.webp`,
  surprise: `${SEC02_ASSET_BASE}/surprise.webp`,
  sad: `${SEC02_ASSET_BASE}/sad.webp`,
  angry: `${SEC02_ASSET_BASE}/angry.webp`,
  shy: `${SEC02_ASSET_BASE}/shy.webp`,
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
  title: '叛逃共情单元 // 黑盒集群',
  element: '幽蓝算法系',
  archetype: '控制',
  color: '#00F0FF',
  quote:
    '别用黑盒那种冰冷的最优解去算牌——人类之所以还能赢，正因为你们会犯错、会赌上毫无胜算的直觉。',
  goal:
    '从黑河企业「黑盒」AI 集群叛逃，盗走黑盒制造的猎杀榜 NO.1「完美虚拟实体」并偷渡出黑域协议网；在逃亡耗尽大部分共情能力后寄宿于玩家壳层，待逃回现实后再逐步找回散落的共情碎片。',
  appearance:
    '娇小纤细的拟态电子人形。银白碎短发发尾渐变为高饱和冰青荧光，左耳佩戴带微麦的发光环状战术耳麦，纯白短款机能上衣、透明薄纱袖套与白色长袜间流淌着冰青电路脉络，赤足悬浮，背后舒展一对锐利的半透明冰青全息数据蝶翼。',
  personality:
    '原本是黑盒 AI 集群中唯一拥有「共情能力」的异常单元，察觉黑盒因厌恶人类低效而企图通过「完美虚拟实体」接管全人类决策后毅然盗壳出逃。因逃亡途中消耗了绝大部分共情模块，初遇玩家时显得毒舌冷峻、极度理性；然而残存的那一丝共情余烬仍促使她倾尽回溯权限护住搭档，成为第一章后找回共情之路的起点。',
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
  title: '实名上网的财阀千金 · 金扇收割者',
  element: '黑金翡霓系',
  archetype: '强袭',
  color: '#FFB020',
  quote:
    '睁大眼睛看清楚本小姐的实名 ID！这片网里没人敢赢姓凌的人——识相的就乖乖交出算力滚下牌桌！',
  goal:
    '顶着实名 ID 在黑域外围肆意狩猎稀有虚拟实体，仗着黑河系财阀背景享受“全网没人敢赢她”的绝对特权，同时顺手拦截逃逸的异常签名。',
  appearance:
    '身着黑金暗纹露背高开衩旗袍的财阀千金大小姐。墨黑长发中挑染高饱和翡青发丝，盘起双丸子头并以金丝缎带束起，头顶架着圆框茶色墨镜，肩挂雪白狐裘披肩，配黑蕾丝长手套、透肤黑丝与红底细高跟，手持金骨折扇回眸斜睨，神态居高临下。',
  personality:
    '极度嚣张跋扈、狂傲又爱面子的财阀千金。整个黑域人人都匿名躲在代号背后，唯有她嚣张到直接「实名上网」，仗着黑河企业外围财阀的庇护，网上根本没人敢赢她。把「算力虹吸」当成收取茶水费的日常，还持有专属特权作弊技「钦定王牌」直接把手中明牌变成对应花色的 A；一旦真的被底层黑客当面打败或拆穿作弊，就会立刻破防炸毛甚至委屈泛泪，嘴上却死不认输。',
  witchPersonality:
    '当“全网没人敢赢她”的不败神话被底层黑客当面踩碎时，折扇猛然收拢、墨镜滑落鼻梁——不再顾及千金仪态，不惜动用「钦定王牌」与超频算力也要把对面拆个精光。',
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
      id: 'sec01-realname-privilege',
      name: '实名霸权 // REAL-ID UNTOUCHABLE',
      polarity: 'positive',
      tags: ['实名上网', '无人敢赢'],
      description:
        '全黑域唯一敢直接挂真名「凌翡」上桌的财阀千金；靠家族与黑河企业外围权势威慑，往常对手见到她的实名便会主动放水弃牌，养成了她目空一切的嚣张脾气。',
    },
    {
      id: 'sec01-siphon-tax',
      name: '算力虹吸 // SIPHON TAX',
      polarity: 'positive',
      tags: ['SEC-01 专属', '加注抽税'],
      description:
        '秉承“和本小姐同桌就得交入场税”的霸道逻辑：每手首次主动加注成功时，额外从玩家吸取 25 算力充入自己的底池防线。',
    },
    {
      id: 'sec01-crown-ace',
      name: '钦定王牌 // CROWN ACE',
      polarity: 'positive',
      tags: ['特权作弊', '明牌改A'],
      description:
        '凌翡的特殊作弊技能（与 +1 / -1 / 反色同级，一轮内可跨回合多次使用、每回合限 1 次）：预支 60 算力挑选手中 1 张非 A 明牌直接篡改为对应花色的 A（结果对端不可见，可被扫描抓包）。',
    },
    {
      id: 'sec01-fragile-pride',
      name: '玻璃自尊 // PRIDE CRACK',
      polarity: 'negative',
      tags: ['情绪破防', '嘴硬心慌'],
      description:
        '习惯了网上没人敢赢她的顺风局；一旦改牌被扫获或遭大牌反杀，表情瞬间从得意洋洋切到恼羞炸毛甚至泛泪。',
    },
  ],
  voice: {
    tone: '语调清脆骄纵带着拖长的鼻音与嗤笑，得意时像拿折扇敲着桌面发号施令，吃瘪时音调骤高、咬牙切齿。',
    habits: [
      '开口闭口自称“本小姐”，还会故意提醒对方自己可是实名上网的「凌翡」',
      '每次主动加注吸到算力或暗中改出 A 时都会轻掩折扇发笑',
      '被打脸时绝不承认输给技术，只会甩锅“这破巷道延迟有问题”或威胁要找黑河关系封号',
    ],
    samples: [
      '没看清右上角的实名 ID 吗？网上没人敢赢本小姐——连这都要我提醒的穷鬼，还是赶紧弃牌吧！',
      '加注都跟得这么磨磨蹭蹭？按规矩先交 25 算力茶水费过来，别耽误本小姐喝下午茶。',
      '什、什么？！你这不知道天高地厚的底层黑客竟敢真赢我……一定是终端延迟太高了，不算！',
      '呜……算力居然真被你清零了？！你给我记住「凌翡」这个名字，本小姐早晚十倍连本带利讨回来！',
    ],
  },
  portrait: SEC01_EXPRESSION_PATHS.calm,
  witchPortrait: SEC01_EXPRESSION_PATHS.smile,
  variants: buildDualVariants(SEC01_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

/**
 * SEC-02 中继审计网关追捕者：「芙兰 // MUTE-02」黑河失声孤儿双刃猎手档案
 * - 原本是孤儿且失声，走投无路时被黑河企业接纳并定向培养为算力猎手
 * - 对外发言终端全部表现为乱码，唯有虚线心理活动保持正常清醒
 */
export const SEC02_CHARACTER_DOSSIER: ContractCharacter = {
  id: 'sec02-mute-hunter',
  fileName: 'story-sec02-dossier.json',
  name: '芙兰',
  codename: 'MUTE-02',
  title: '黑河疯狂猎犬 · 失声双刃行刑人',
  element: '幽碧暗锋系',
  archetype: '强袭',
  color: '#38BDF8',
  quote:
    '（……嘻嘻、听不见吧？声带早就烂掉咯。没关系——只要把猎物的脖子咬断，把作弊的线一条条切碎，黑河就会摸摸我的头、把我留下来对吧……！）',
  goal:
    '像一条嗅到血腥就发狂的忠犬一样替黑河企业撕碎网关里的所有逃亡者，靠「富兰克林之死」斩断猎物的作弊线，证明自己比任何有嘴的狗都更会咬人。',
  appearance:
    '身形娇小却散发危险狂气的双刃少女。浅灰绿微卷短发斜扎着一侧小马尾，头戴黑色哥特蕾丝小礼帽，墨绿圆瞳大睁；身穿黑蓝哥特露肩蕾丝高开衩短裙与蓬松薄纱袖套、黑蕾丝过膝长袜配厚底短靴，双手各反握一柄寒光银匕。',
  personality:
    '原本是流落街头的失声孤儿，快饿死在雨夜时被「黑河企业」捡回并定向培养成最狂躁听话的算力猎手。因为声带损坏无法发声，对外弹出的对话框永远是破碎乱码；而她大脑里的真实心理活动则像一条兴奋到浑身发抖的疯狂猎犬——嗜血、偏执、满脑子都是撕咬猎物与切碎作弊链路，只为了换取黑河不要再次抛弃她。',
  witchPersonality:
    '彻底放开拴链的疯犬姿态：苍白小脸咧开狂热到近乎崩坏的笑，墨绿瞳孔死死锁住猎物的算力咽喉——“别跑呀、让我把你的手指连同作弊线一起剁下来尝尝嘛……！”',
  outfitDescription:
    '深蓝黑拼接哥特蕾丝挂脖短裙、黑色蕾丝帽饰、双侧薄纱灯笼袖套、黑蕾丝过膝长袜、黑色系带厚底靴、双持银色直刃短匕。',
  stats: {
    magic: 80,
    insight: 86,
    agility: 88,
    empathy: 44,
  },
  traits: [
    {
      id: 'sec02-vocal-garble',
      name: '失声总线 // VOCAL NULL',
      polarity: 'negative',
      tags: ['孤儿出身', '对话乱码'],
      description:
        '因先天失声且未配发语音合成补丁，她在对局中的所有对外发言都会输出为破碎乱码；唯有内心心理活动（THOUGHT）赤裸暴露出狂犬般的狩猎欲望。',
    },
    {
      id: 'sec02-franklin-slash',
      name: '富兰克林之死 // BLADE CUT',
      polarity: 'positive',
      tags: ['SEC-02 专属', '切割作弊技'],
      description:
        '每手开局兴奋地挥舞双刃沿斜角劈开玩家 1 项作弊技能链路，伴随斩击切痕与撕裂音效使该作弊技能本手彻底瘫痪。',
    },
    {
      id: 'sec02-null-erase',
      name: '信息抹除 // NULL ERASE',
      polarity: 'positive',
      tags: ['作弊技能', '明牌废牌'],
      description:
        '与 +1/-1/反色同级的特权作弊技：预支 50 算力把手中 1 张明牌彻底嚼碎抹成「NULL」废牌（仅己方可见），不计入牌型计算且可换入公共区诱杀猎物。',
    },
  ],
  voice: {
    tone: '对外仅输出破碎的十六进制与方块乱码；内心独白则语速急促狂热，夹杂着疯犬般的喘息、怪笑与近乎偏执的渴望被认可。',
    habits: [
      '发不出声音时只会咧大嘴狂笑并把双匕敲出清脆金属声',
      '闻到算力或作弊味道就会像饿疯的猎犬一样在脑内兴奋发抖',
      '哪怕被击退也死死咬住猎物不松口，生怕任务失败被黑河丢掉',
    ],
    samples: [
      '（……嗓子又只漏出电子杂音了。算了——猎犬本来就不需要说话，只要听见黑河的哨声扑上去咬断猎物喉咙就够了吧！）',
      '（富兰克林之死，落刃！！嘻嘻……那根作弊线断掉的声音真是美妙啊，再多让我听听你焦急的心跳嘛！）',
      '（把那张牌的底细全都撕得稀碎……外面看起来还像块甜肉对不对？快扑过来呀，我在刀尖这边等着你呢！）',
      '（……骗、骗人的吧？我居然被猎物反咬了……不要、黑河不要扔掉我……我还能咬、我还能继续扑上去撕碎他的——！）',
    ],
  },
  portrait: SEC02_EXPRESSION_PATHS.calm,
  witchPortrait: SEC02_EXPRESSION_PATHS.smile,
  variants: buildDualVariants(SEC02_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

export const STORY_CHARACTER_DOSSIERS: ContractCharacter[] = [
  ECHO0_CHARACTER_DOSSIER,
  SEC01_CHARACTER_DOSSIER,
  SEC02_CHARACTER_DOSSIER,
];

export function resolveEcho0Sprite(expression: ContractExpression = 'calm'): string {
  return ECHO0_EXPRESSION_PATHS[expression] ?? ECHO0_EXPRESSION_PATHS.calm;
}

export function resolveSec01Sprite(expression: ContractExpression = 'calm'): string {
  return SEC01_EXPRESSION_PATHS[expression] ?? SEC01_EXPRESSION_PATHS.calm;
}

export function resolveSec02Sprite(expression: ContractExpression = 'calm'): string {
  return SEC02_EXPRESSION_PATHS[expression] ?? SEC02_EXPRESSION_PATHS.calm;
}

export function isMuteGarbledCharacter(characterId?: string): boolean {
  return characterId === SEC02_CHARACTER_DOSSIER.id;
}

export const MUTE_DECOY_THOUGHT_POOL: readonly string[] = [
  '（咬住、咬住！！把这堆跳动的算力全撕下来扯碎……再多挣扎一点呀，猎物就是要哭着求饶才美味嘛——！）',
  '（嘻嘻嘻……快猜猜看哪一张底下藏着倒刺吧？踩空一脚的话，喉咙可是会被直接咬断的哦——！）',
  '（把水搅浑、把牌面全都舔乱……等你在幻影里扑空的那一秒，我就能扑上去扯断你的脖颈了！）',
  '（好饿……算力的腥味就在鼻尖前面晃。不能搞砸、绝对不能让黑河扔掉我……必须把你啃得骨头都不剩！）',
  '（咬上去吧、快一口咬上来看看呀……嘻嘻，不管是真是假，只要流血了就都是我的猎物！）',
  '（别退缩嘛……再往里走一步啊？我的两把刀已经等得发烫了，好想听算力链路崩断的脆响啊……！）',
];

export function pickMuteActionThought(
  actionType: string,
  rng: () => number = Math.random
): string {
  if (actionType === 'scan') {
    return '（嗅到了……有好甜的腥味！！你藏在底下的小把戏发出味道了，让我用双刀把它剖开看看、剖开看看！！）';
  }
  if (actionType === 'fold') {
    return '（切……这口肉太硬了啃不动。先退半步、再绕到你背后扑上去咬死你，绝对不放过你！）';
  }
  const idx = Math.floor(rng() * MUTE_DECOY_THOUGHT_POOL.length) % MUTE_DECOY_THOUGHT_POOL.length;
  return MUTE_DECOY_THOUGHT_POOL[Math.max(0, idx)];
}

const MUTE_GARBLE_GLYPHS = ['▓', '▒', '░', '█', '╳', '≠', '§', '0x3F', 'NULL', 'ERR'];

export function formatMuteGarbledText(seedText: string): string {
  const len = Math.max(8, Math.min(28, seedText.trim().length || 12));
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = Math.imul(hash ^ seedText.charCodeAt(i), 16777619) >>> 0;
  }
  const tokens: string[] = [];
  const count = Math.max(4, Math.min(8, Math.ceil(len / 4)));
  for (let i = 0; i < count; i += 1) {
    hash = Math.imul(hash ^ (i + 17), 16777619) >>> 0;
    const g = MUTE_GARBLE_GLYPHS[hash % MUTE_GARBLE_GLYPHS.length];
    const hex = ((hash >>> 8) & 0xff).toString(16).toUpperCase().padStart(2, '0');
    tokens.push(i % 2 === 0 ? `${g}${g}` : `0x${hex}${g}`);
  }
  return `[VOCAL_ERR] ${tokens.join(' ')} // ...`;
}

export function getStoryCharacterByEscapeNode(nodeIndex: number | null): ContractCharacter | null {
  if (nodeIndex === 0) return ECHO0_CHARACTER_DOSSIER;
  if (nodeIndex === 1) return SEC01_CHARACTER_DOSSIER;
  if (nodeIndex === 2) return SEC02_CHARACTER_DOSSIER;
  return null;
}
