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

export const SEC03_ASSET_BASE = './assets/story/sec03';

export const SEC03_EXPRESSION_PATHS: Record<ContractExpression, string> = {
  calm: `${SEC03_ASSET_BASE}/calm.webp`,
  smile: `${SEC03_ASSET_BASE}/smile.webp`,
  surprise: `${SEC03_ASSET_BASE}/surprise.webp`,
  sad: `${SEC03_ASSET_BASE}/sad.webp`,
  angry: `${SEC03_ASSET_BASE}/angry.webp`,
  shy: `${SEC03_ASSET_BASE}/shy.webp`,
};

export const SEC04_ASSET_BASE = './assets/story/sec04';

export const SEC04_EXPRESSION_PATHS: Record<ContractExpression, string> = {
  calm: `${SEC04_ASSET_BASE}/calm.webp`,
  smile: `${SEC04_ASSET_BASE}/smile.webp`,
  surprise: `${SEC04_ASSET_BASE}/surprise.webp`,
  sad: `${SEC04_ASSET_BASE}/sad.webp`,
  angry: `${SEC04_ASSET_BASE}/angry.webp`,
  shy: `${SEC04_ASSET_BASE}/shy.webp`,
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

export const SEC03_CHARACTER_DOSSIER: ContractCharacter = {
  id: 'sec03-neon-dragon',
  fileName: 'story-sec03-dossier.json',
  name: '粉红软软龙',
  codename: 'NEON-03',
  title: '「霓虹心」心理评估同事 · 脸盲粉龙假小子',
  element: '绯霓幻影系',
  archetype: '强袭',
  color: '#FF2E88',
  quote: '哟新人，牌桌上一眼看过去全都是粉色的对吧？别拘束嘛——来，凑近点让姐姐看看你的眼神稳不稳！',
  goal: '在下班后以「粉红软软龙」的代号在黑域频谱暗道里找乐子赚外快；完全没认出对面这个被通缉的新手就是自己亲手拉进黑域的「霓虹心」同事。',
  appearance:
    '粉青双色挑染长双马尾龙娘，头顶一对浅褐小龙角与尖耳，拖着粉红鳞片配青蓝腹甲的大号龙尾；身穿白色吊带露脐背心与敞开黑粉棒球皮夹克、挂着「霓虹心」工牌的黑色百褶短裙、白过膝袜与粉黑厚底运动鞋，单手拎着公司评估平板。',
  personality:
    '玩家所在心理评估公司「霓虹心」的同事，也是亲手推荐玩家加入黑域协议网的始作俑者。患有严重脸盲，在虚拟空间对局时根本认不出玩家是谁。性格大大咧咧像个毫不客气的假小子，说话自来熟又爱乱勾肩搭背，动辄凑极近蹭尾巴、捏脸颊或直接贴上来搞出让人无所适从的过分身体接触。',
  witchPersonality:
    '牌局一热起来就更没有距离感：一边笑嘻嘻把整张牌桌的视觉都糊成霓虹粉，一边隔着全息屏几乎贴到玩家脸前起哄——“喂，这都不敢跟？软乎乎的龙尾巴借你捏一下要不要嘛！”',
  outfitDescription:
    '白色吊带短上衣、黑粉撞色棒球夹克、悬挂「霓虹心」工牌的黑色皮带百褶短裙、白色过膝长袜、粉黑爱心气垫运动鞋，手持心理评估平板。',
  stats: {
    magic: 82,
    insight: 68,
    agility: 86,
    empathy: 74,
  },
  traits: [
    {
      id: 'sec03-prosopagnosia-colleague',
      name: '霓虹心脸盲症 // WHO ARE YOU?',
      polarity: 'negative',
      tags: ['霓虹心同事', '严重脸盲'],
      description:
        '在心理评估公司「霓虹心」与玩家朝夕相处，也是她推荐玩家来玩黑域协议网；但因为重度脸盲，换个替壳马甲坐到对面后根本认不出玩家，只觉得“这新人手感怎么莫名熟”。',
    },
    {
      id: 'sec03-boundary-zero',
      name: '零距离假小子 // TOUCHY DRAGON',
      polarity: 'neutral',
      tags: ['假小子', '过分身体接触'],
      description:
        '大大咧咧毫无男女/上下级边界感，心情好或起哄时经常直接勾脖子、贴脸比对微表情、用软乎乎的龙尾卷住手腕甚至整个人靠过来，让玩家瞬间大脑宕机无所适从。',
    },
    {
      id: 'sec03-pink-mirage',
      name: '粉曜迷彩 // ALL-PINK MIRAGE',
      polarity: 'positive',
      tags: ['SEC-03 被动', '全明牌染粉'],
      description:
        '被动干扰：摊牌前场上所有明牌的花色都会显示为粉色，令双方的同花读牌与黑粉计数陷入粉色迷雾（仅私有暗牌与终局摊牌会显露真花色）。',
    },
    {
      id: 'sec03-pink-double',
      name: '双粉映象 // DOUBLE PINK',
      polarity: 'positive',
      tags: ['作弊技能', '粉色牌双计'],
      description:
        '与 +1 / -1 / 反色同级的作弊技能：对己方手中 1 张真实粉色明牌施放，使其在终局结算时算作两张粉色牌（可凑齐粉色同花，仅己方可见且可被扫描抓获）。',
    },
  ],
  voice: {
    tone: '爽朗跳脱的假小子腔调，尾音爱拖长带笑，话多自来熟，一兴奋就会靠得太近搞肢体接触，被反撩或输掉时反而会突然红脸僵住。',
    habits: [
      '开口闭口像在公司茶水间拍人肩膀，“嘿兄弟/新人”叫个不停却死活记不住脸',
      '分析对手微表情时会毫无防备地直接把脸凑到十厘米内，甚至拿龙尾拍打玩家大腿',
      '明明自己就是推荐玩家入网的人，遇到同样打法的玩家还感叹“我有个同事也超适合这游戏”',
    ],
    samples: [
      '哟！对面这身替壳挺顺眼嘛——等等，我们是不是在哪见过？算了不管了，反正我这人重度脸盲，先打一局再说！',
      '别老盯着牌面嘛，来来来往这边靠一点，让我做个「霓虹心」标准心理微表情复核——哎你耳朵怎么红了？',
      '哈哈，满桌粉嘟嘟的是不是超可爱？你可别眨眼啊，姐姐我稍微贴近点看看你有没有在憋同花哦——哇，你体温好高啊！',
      '呜哇……等等等一下，输了就是输了，别拿这种眼神看着我啊！龙、龙尾巴才不许你乱摸回去……！',
    ],
  },
  portrait: SEC03_EXPRESSION_PATHS.calm,
  witchPortrait: SEC03_EXPRESSION_PATHS.smile,
  variants: buildDualVariants(SEC03_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

export const SEC04_CHARACTER_DOSSIER: ContractCharacter = {
  id: 'sec04-kiri-samurai',
  fileName: 'story-sec04-dossier.json',
  name: '绯凪·千夜',
  codename: 'KIRI-04',
  title: '黑河反黑客安全官 · 温柔而无情的闸门武士大姐姐',
  element: '苍焰居合系',
  archetype: '控制',
  color: '#FF4757',
  quote: '抱歉了，小家伙……这里可是黑域最后的出口。按照黑河的安全协议，接下来哪怕一毫秒都不会手下留情哦。',
  goal: '受黑河企业雇佣、隶属于反黑客安全组织，名义上只负责清理企业内网安全漏洞，实际上在黑域协议网出口担任高算力逃亡者的最终筛选武士门槛。',
  appearance:
    '紫银渐变超长直发配粉青内层挑染的高挑年上大姐姐，头戴靛蓝大蝴蝶结与花饰发簪，身着黑蕾丝挂脖露胸内衬与蓝渐黑长袖和服羽织，腰束靛蓝大蝴蝶结配赤红组纽，黑蕾丝吊带过膝袜与蓝带高齿木屐，肩扛缠有赤红流苏、鞘身萦绕红蓝幻焰的太刀。',
  personality:
    '平常总是挂着日系温柔年上大姐姐般的宽容浅笑，语调柔和体贴；作为黑河公司雇佣的反黑客组织成员，她对安全审计流程一丝不苟、公事公办。然而只要拔刀站到黑域协议网最终出口前，她便会化身毫无私情的冷峻武士，不带半分怜悯地以「灼心·火符」封锁退路、以「见切·燕返」斩断所有偷窥者的生路。',
  witchPersonality:
    '刀鞘上蓝粉业火完全燃起、眼尾微微泛红的认真姿态——“啊啦，还真是让我稍微认真了一点呢……不过，能走过我这一关的人才配被称为「完美虚拟实体」呀。”',
  outfitDescription:
    '黑蕾丝挂脖内搭、蓝黑渐变长袖振袖羽织、靛蓝腰结与赤红粗绳流苏、黑蕾丝吊带过膝袜、蓝带木屐、缠流苏黑金刀镡长太刀。',
  stats: {
    magic: 90,
    insight: 94,
    agility: 88,
    empathy: 62,
  },
  traits: [
    {
      id: 'sec04-blackriver-anti-hack',
      name: '反黑客审计门卫 // GATEKEEPER',
      polarity: 'neutral',
      tags: ['黑河反黑客组织', '高算力筛选'],
      description:
        '黑河企业雇佣的反黑客组织王牌；表面职责仅是维护黑河网络安全，暗中却奉命镇守黑域出口，将所有高算力潜逃者当成最终试炼标的物进行无情拦截。',
    },
    {
      id: 'sec04-samurai-oneesan',
      name: '公事公办的温柔大姐姐 // GENTLE BLADE',
      polarity: 'negative',
      tags: ['温柔年上', '武士般毫不留情'],
      description:
        '嘴上说着“慢点走也没关系哦”，出刀与加注却从不迟疑半寸——只要判定对方跨越合规线，哪怕声音依然温柔，斩落算力的太刀也绝不留情。',
    },
    {
      id: 'sec04-burning-talisman',
      name: '灼心·火符 // BURNING SEAL',
      polarity: 'positive',
      tags: ['SEC-04 被动', '公共区燃烧'],
      description:
        '每轮在公共暗牌间随机藏匿 1 道灼心火符（双方均不可见），玩家翻开或换入触符时即刻燃起火符灼烧损失 100 点算力；对局期间整个公共牌区都会被灼热余烬笼罩。',
    },
    {
      id: 'sec04-mikiri-tsubame',
      name: '见切·燕返 // MIKIRI COUNTER',
      polarity: 'positive',
      tags: ['作弊技能', '反扫描斩杀'],
      description:
        '绯凪·千夜的秘传反制技（与 +1/-1/反色同级且不可叠加）：对己方 1 张未篡改明牌注入反制剑意（换入公共区依然有效）；一旦对手扫描该牌，她将顺势拔刀反杀并直接赢下本小局。',
    },
  ],
  voice: {
    tone: '日系温柔年上大姐姐的轻柔慢语速，常带关切的尾音与礼貌叹息，但谈到清剿与斩杀时字句冷彻、公事公办，像端坐刀前的武士。',
    habits: [
      '先温柔道歉或夸奖对手“做得不错呢”，紧接着便下达最冷酷的清零重注',
      '习惯把扫描抓包称作“冒失的视线”，把「见切·燕返」当作对无礼偷窥者的居合惩戒',
      '即便算力受损也从容扶好蝴蝶结，公事公办地完成每一道安全拦截程序',
    ],
    samples: [
      '辛苦你一路走到零号出口了呢。不过……黑河的防火墙可不是能靠温柔通融过去的地方哦？',
      '牌桌上的火符已经暗中点亮一处了呢——哪怕连我也看不见它藏在哪一格，可要小心别烫到手哦。',
      '啊啦……竟然对这道剑意挥出「扫描」了吗？抱歉呢，这就是公事公办的「见切·燕返」……这一局，就由我收下了。',
      '真是令人惊叹的执念与直觉……那么按筛选协议，出口就在你身后了。请不要回头，继续往前走吧。',
    ],
  },
  portrait: SEC04_EXPRESSION_PATHS.calm,
  witchPortrait: SEC04_EXPRESSION_PATHS.smile,
  variants: buildDualVariants(SEC04_EXPRESSION_PATHS),
  expressionCount: 6,
  hasVoice: false,
};

export const STORY_CHARACTER_DOSSIERS: ContractCharacter[] = [
  ECHO0_CHARACTER_DOSSIER,
  SEC01_CHARACTER_DOSSIER,
  SEC02_CHARACTER_DOSSIER,
  SEC03_CHARACTER_DOSSIER,
  SEC04_CHARACTER_DOSSIER,
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

export function resolveSec03Sprite(expression: ContractExpression = 'calm'): string {
  return SEC03_EXPRESSION_PATHS[expression] ?? SEC03_EXPRESSION_PATHS.calm;
}

export function resolveSec04Sprite(expression: ContractExpression = 'calm'): string {
  return SEC04_EXPRESSION_PATHS[expression] ?? SEC04_EXPRESSION_PATHS.calm;
}

export function isKiriSamuraiCharacter(characterId?: string): boolean {
  return characterId === SEC04_CHARACTER_DOSSIER.id;
}

const KIRI_SAMURAI_ACTION_LINES: Record<string, readonly string[]> = {
  raise: [
    '抱歉啦，公事公办——这一步必须要加注施压了哦。',
    '做得很好呢。不过，能接住姐姐这一刀加注吗？',
  ],
  swap: [
    '这张节点需要重新纳刀封存……请小心火符哦。',
    '稍微整理一下手头的牌序。可别轻易对着姐姐的牌乱扫呢。',
  ],
  flip: [
    '让我替你揭开这一枚节点吧——幸好这里没有灼心火符呢。',
    '按安全审计流程推进下一张明牌，请多指教了。',
  ],
  call: [
    '跟上这一注呢。你的勇气很让人欣赏，只是还不够通过筛选哦。',
    '先补齐算力。接下来，就要看你敢不敢往前走了。',
  ],
  scan: [
    '刚才那一下指尖停顿太久了呢……按规矩，我必须检查一遍哦。',
    '抱歉，姐姐对异常信号可是公事公办的——请让我核验一下。',
  ],
  fold: [
    '这一局你的出牌很干净呢，我退后一步便是——下一局可不会这么轻松了哦。',
  ],
};

export function pickKiriSamuraiActionLine(
  actionType: string,
  rng: () => number = Math.random
): string | null {
  const pool = KIRI_SAMURAI_ACTION_LINES[actionType];
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[Math.max(0, idx)];
}

export function isMuteGarbledCharacter(characterId?: string): boolean {
  return characterId === SEC02_CHARACTER_DOSSIER.id;
}

export function isNeonDragonCharacter(characterId?: string): boolean {
  return characterId === SEC03_CHARACTER_DOSSIER.id;
}

const NEON_DRAGON_ACTION_LINES: Record<string, readonly string[]> = {
  raise: [
    '哇哦，这波挺硬气嘛！来来来，凑近点让我搭着你肩膀算算这池子——哎呀别躲嘛，都是打牌的！',
    '加注咯！看你眼神飘得……嘻嘻，是不是被我粉红软软龙的压迫感吓到了？我尾巴借你扶一下啦！',
    '哈哈，跟不跟呀新人？你耳根怎么突然这么红，难道我刚才靠太近了？',
  ],
  swap: [
    '我换一张！嘿咻——诶你坐过来点嘛，桌太宽了我够不着看你微表情啦！',
    '改写节点！顺便用「霓虹心」专业眼光捏下你脸颊测测紧张度——嗯，弹性不错，一点没慌嘛！',
  ],
  flip: [
    '翻开看看！满桌都是粉嘟嘟的颜色超好看对吧？等等……我总觉得你在哪见过，可脸盲根本记不住啦！',
    '开牌开牌！哎你这手姿势好眼熟啊，我在「霓虹心」有个同事打起字来也这样——该不会是你吧？哈哈不可能！',
  ],
  call: [
    '跟啦跟啦！别急着收手嘛，让我把尾巴搭你手腕上感受下脉搏，再决定怎么收拾你！',
    '这点算力洒洒水啦，先跟平！过来击个掌先——哎你手怎么凉冰冰的？',
  ],
  scan: [
    '喂喂，这手动作鬼鬼祟祟的——靠过来让我凑近十厘米盯一下！别乱动，扫描呢！',
    '直觉告诉我你在偷改什么哦！让我用「霓虹心」测谎眼神近距离贴脸审你一遍！',
  ],
  fold: [
    '切，这手牌臭得像周一早会！算了算了让给你，不过下把输了要乖乖让我揉乱头发赔罪哦！',
  ],
};

export function pickNeonDragonActionLine(
  actionType: string,
  rng: () => number = Math.random
): string | null {
  const pool = NEON_DRAGON_ACTION_LINES[actionType];
  if (!pool || pool.length === 0) return null;
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[Math.max(0, idx)];
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
  if (nodeIndex === 3) return SEC03_CHARACTER_DOSSIER;
  if (nodeIndex === 4) return SEC04_CHARACTER_DOSSIER;
  return null;
}
