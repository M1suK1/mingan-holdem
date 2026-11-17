import { createDeck, createInitialState, getBetDiff } from './gameEngine.ts';
import type {
  StoryVnLine,
  StoryVnSpeakerKind,
  StoryVnSpriteMode,
  StoryVnStageEffect,
} from './storyVnTypes.ts';
import type { Card, GameAction, GameState, Rank, Suit } from './types.ts';

export interface Sec00MonologueStep {
  index: number;
  tag: string;
  title: string;
  text: string;
  tip: string;
}

export const SEC00_MONOLOGUE_STEPS: Sec00MonologueStep[] = [
  {
    index: 0,
    tag: 'MONOLOGUE 1/4 // 无名野桌',
    title: '“终于重新买好壳子上线了……”',
    text: '时隔这么久又花钱重新注册了一具虚拟实体，对黑域协议网的规矩也就勉强记得个大概。对面这个叫 [UNKNOWN_0x00] 的匿名终端算力只有 110，正好拿这桌野局重新熟悉一下基本操作。',
    tip: '提示：桌上的算力就是虚拟实体的「结构防线」，先将对手清零即获胜并夺取其虚拟实体。',
  },
  {
    index: 1,
    tag: 'MONOLOGUE 2/4 // 明暗牌与换牌锁定',
    title: '“台面上 3 张明牌，中间 4 张暗牌……”',
    text: '每人手上的 3 张初始牌都是双方可见的「明牌」。中间 4 张是加密「暗牌」：点击暗牌可以免费翻开，或者付换牌门票把一张明牌换进去，换到手里的牌会变成只有自己能看的「私有暗牌」并锁定。',
    tip: '规则：私有暗牌不可再换出，也不可被黑客篡改，换牌或翻牌后结束本轮操作权。',
  },
  {
    index: 2,
    tag: 'MONOLOGUE 3/4 // 双花色与牌型阶梯',
    title: '“记住，这里只有黑与粉两种花色……”',
    text: '黑曜脉冲 26 张、绯霓电弧 26 张，总共 52 张。正因为同花特别好凑，这里的牌型大小重排为「四条 > 同花顺 > 葫芦 > 顺子 > 三条 > 两对 > 同花 > 一对 > 高牌」——千万别用同花硬碰两对。',
    tip: '机制：对手加注时，点「跟注」只补齐差额、不会结束你的回合，你仍可继续翻牌或反加。',
  },
  {
    index: 3,
    tag: 'MONOLOGUE 4/4 // 准备开局',
    title: '“好，对面那点算力应该够用来找回手感。”',
    text: '先看我这手牌：Q粉、9粉、2黑，正好把那张没用的 2黑 换进公共暗区试试水。要是它也敢像当年那样玩阴的，至少得看破防住，别再像第一次那样吃大亏。',
    tip: '实操将在同一手连贯牌局内完成全部教学，直到当场击穿对方 110 算力。',
  },
];

export type Sec00VictoryBeatId =
  | 'defeat-echo0'
  | 'entity-anomaly'
  | 'entity-replaced'
  | 'body-discomfort'
  | 'alarm-triggered'
  | 'pursuers-closing'
  | 'decide-flee';

export type Sec00VnSpeakerKind = StoryVnSpeakerKind;
export type Sec00VnSpriteMode = StoryVnSpriteMode;
export type Sec00VnStageEffect = StoryVnStageEffect;

export interface Sec00VnLine extends StoryVnLine {
  beatId: Sec00VictoryBeatId;
  spriteMode: StoryVnSpriteMode;
}

export const SEC00_VN_SCRIPT: Sec00VnLine[] = [
  {
    index: 0,
    lineNo: '01',
    beatId: 'defeat-echo0',
    chapterLabel: '段落 0/6 · 击败收尾',
    speakerKind: 'opponent',
    speakerName: '匿名终端 [UNKNOWN_0x00]',
    spriteMode: 'opponent',
    expression: 'calm',
    spriteTag: '对方虚拟实体投影 // UNKNOWN_0x00',
    stageEffect: 'none',
    hudAlerts: ['[OPPONENT] COMPUTE = 0 // PROTOCOL SETTLEMENT'],
    tone: 'cyan',
    text: '「算力归零。按黑域协议，这具虚拟实体归你了。……别回头，带上它走。」',
  },
  {
    index: 1,
    lineNo: '02',
    beatId: 'defeat-echo0',
    chapterLabel: '段落 0/6 · 击败收尾',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'dissipating',
    expression: 'calm',
    spriteTag: '数据封包散逸中 // UNKNOWN_0x00',
    stageEffect: 'sync-glow',
    tone: 'cyan',
    text: '对面的匿名终端信号彻底断开。按黑域暗区的规矩，败者的虚拟实体会自动打包成一枚备用诱饵，归入 {codename} 的本地仓库。',
  },
  {
    index: 2,
    lineNo: '03',
    beatId: 'entity-anomaly',
    chapterLabel: '段落 1/6 · 接收异常',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'none',
    stageEffect: 'sync-glow',
    hudAlerts: ['[PORT] 正在同步战利品至备用诱饵槽...'],
    soundCue: 'hack',
    tone: 'cyan',
    text: '「呼……总算顺顺利利赢下一局，没重演当年刚进网就惨败的阴影。按大概记得的规矩，把战利品收进备用诱饵槽就行了吧……」',
  },
  {
    index: 3,
    lineNo: '04',
    beatId: 'entity-anomaly',
    chapterLabel: '段落 1/6 · 接收异常',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'none',
    stageEffect: 'reverse-flux',
    hudAlerts: ['[WARN] NEURAL PORT 0x01 // 检测到逆向数据脉冲倒灌'],
    tone: 'glitch',
    text: '{codename} 伸手确认接收协议。可数据流刚顺着接入线碰上神经端口，触感就彻底不对劲——它没有乖乖沉进隔离槽，反而滚烫且凶狠，像挣脱锁链的活体脉冲，沿着底层信道逆向倒灌进来！',
  },
  {
    index: 4,
    lineNo: '05',
    beatId: 'entity-anomaly',
    chapterLabel: '段落 1/6 · 接收异常',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'none',
    stageEffect: 'error-popups',
    hudAlerts: ['[ERR] ROOT_SECTOR_WRITE_ATTEMPT', '[ERR] ISOLATION_VAULT_BYPASSED'],
    soundCue: 'ui-click',
    tone: 'glitch',
    text: '「……等等、什么情况？！正常封装包不该有这么重的反向写入……喂，别往我的核心扇区里钻啊！」',
  },
  {
    index: 5,
    lineNo: '06',
    beatId: 'entity-replaced',
    chapterLabel: '段落 2/6 · 主壳层遭强制覆写',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'none',
    stageEffect: 'glitch-override',
    hudAlerts: [
      '[OVERRIDE] CORE_ENTITY: {codename} -> PURGED / SUSPENDED',
      '[LOCKED] PRIMARY SHELL INDEX REPLACED',
    ],
    soundCue: 'rewind-crack',
    tone: 'glitch',
    text: '视网膜边缘的终端日志瞬间被猩红报错吞没。{codename} 刚花钱重新注册没多久的原生虚拟实体签名在半秒内被挤碎、挂起、连根覆盖——一条全新的壳层索引，强行卡进了 {codename} 的主实体槽位。',
  },
  {
    index: 6,
    lineNo: '07',
    beatId: 'entity-replaced',
    chapterLabel: '段落 2/6 · 主壳层遭强制覆写',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'surprise',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'mirror-boot',
    hudAlerts: ['[SELF-CHECK] 当前主壳层索引 :: SHELL://ECHO-0'],
    tone: 'glitch',
    text: '全息自检窗自动弹出。映在镜像里的不再是 {codename} 刚买下的原生躯壳，而是一具娇小纤细、银白碎短发梢泛着冰青荧光的拟态电子人形。',
  },
  {
    index: 7,
    lineNo: '08',
    beatId: 'entity-replaced',
    chapterLabel: '段落 2/6 · 主壳层遭强制覆写',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'surprise',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'sway-back',
    tone: 'glitch',
    text: '「开什么玩笑……我原本的虚拟实体呢？！怎么整套外壳被她的 SHELL://ECHO-0 直接顶替了？！」',
  },
  {
    index: 8,
    lineNo: '09',
    beatId: 'body-discomfort',
    chapterLabel: '段落 3/6 · 身体变化的不适',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'sad',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'height-drop',
    hudAlerts: ['[CALIBRATE] 视界高度 -24cm // 步幅与肩宽参数错位'],
    tone: 'amber',
    text: '还没等 {codename} 把覆写原因查清，躯体感知同步切了过来。整片视界高度骤然矮了一截，原本熟悉的肩宽、臂长与步幅瞬间全乱了套。',
  },
  {
    index: 9,
    lineNo: '10',
    beatId: 'body-discomfort',
    chapterLabel: '段落 3/6 · 身体变化的不适',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'shy',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'tremble',
    hudAlerts: ['[SENSOR] 重心失衡 / 赤足悬空状态'],
    tone: 'amber',
    text: '「唔……好别扭……！重心怎么飘得这么怪，脚底下根本踩不着实地……低头一看，手腕和腿都细得跟数据线一样……」',
  },
  {
    index: 10,
    lineNo: '11',
    beatId: 'body-discomfort',
    chapterLabel: '段落 3/6 · 身体变化的不适',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'shy',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'wings-glow',
    hudAlerts: ['[SYNC] 冰青全息蝶翼颤动 // 左耳战术耳麦高频噪响'],
    tone: 'amber',
    text: '低头看去，这具新身体竟赤足悬停在离地半寸的虚空里，纯白机能短衣与透光袖套间流淌着冰青电路脉络，背后一对半透明的全息数据蝶翼不受控制地轻轻颤动，左耳战术耳麦里不断漏出高频杂音。',
  },
  {
    index: 11,
    lineNo: '12',
    beatId: 'body-discomfort',
    chapterLabel: '段落 3/6 · 身体变化的不适',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'sad',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'none',
    tone: 'amber',
    text: '「连背后这两片发光的翅膀都在自己乱晃……算力循环完全是一团乱麻。那女人到底给我留了个什么怪胎壳子……」',
  },
  {
    index: 12,
    lineNo: '13',
    beatId: 'alarm-triggered',
    chapterLabel: '段落 4/6 · 红色警报骤响',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'surprise',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'alarm-flash',
    hudAlerts: ['[ALARM!!] 全区底层频段红色警报爆发'],
    soundCue: 'alarm-siren',
    tone: 'alarm',
    text: '——嘀呜！！嘀呜！！嘀呜！！还没等 {codename} 花上五秒适应这具陌生的躯体，整片公共暗区的底层频段突然爆出撕裂耳膜的红色警报！',
  },
  {
    index: 13,
    lineNo: '14',
    beatId: 'alarm-triggered',
    chapterLabel: '段落 4/6 · 红色警报骤响',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'surprise',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'wanted-banner',
    hudAlerts: ['[ALERT // HIGH-PRIORITY TRACE BEACON ACTIVE]'],
    tone: 'alarm',
    text: '覆写完成的刹那，深埋在 ECHO-0 壳层深处的最高危异常信标被彻底点亮——这是个陷阱！',
  },
  {
    index: 14,
    lineNo: '15',
    beatId: 'alarm-triggered',
    chapterLabel: '段落 4/6 · 红色警报骤响',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'surprise',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'scanline-red',
    tone: 'alarm',
    text: '「糟了……！这声警报不是冲着野桌打的，是顺着我现在披着的这具壳层爆出来的？！」',
  },
  {
    index: 15,
    lineNo: '16',
    beatId: 'pursuers-closing',
    chapterLabel: '段落 5/6 · 循迹围捕逼近',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'radar-ping',
    hudAlerts: ['[RADAR] 局部拓扑雷达监测到密集猩红追踪波束'],
    soundCue: 'wall-hit',
    tone: 'alarm',
    text: '局部拓扑雷达在一瞬间被密密麻麻的猩红追踪波束挤满。刚亮起的异常信标就像黑夜里打上天顶的探照灯——',
  },
  {
    index: 16,
    lineNo: '17',
    beatId: 'pursuers-closing',
    chapterLabel: '段落 5/6 · 循迹围捕逼近',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'pursuer-tags',
    hudAlerts: [
      '追踪信号：SEC-01 排水巷道 // 财黑帮波束锁定',
      '追踪信号：SEC-02 中继网关 // 算力猎手封锁中',
      '追踪信号：SEC-04 离线闸门 // 安全官信号合围',
    ],
    tone: 'alarm',
    text: '边缘拾荒者、沿算力链路嗅过来的财黑帮、中继层的算力猎手、乃至黑河网关的安全官，全部循着 {codename} 留下的信号轨迹从四面八方围捕过来！',
  },
  {
    index: 17,
    lineNo: '18',
    beatId: 'pursuers-closing',
    chapterLabel: '段落 5/6 · 循迹围捕逼近',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'alarm-intense',
    tone: 'alarm',
    text: '「这么多追踪信号……全在朝这条暗巷合拢！主干道出口已经被堵了半边，被他们按在这里拆壳的话，连意识都别想保住！」',
  },
  {
    index: 18,
    lineNo: '19',
    beatId: 'decide-flee',
    chapterLabel: '段落 6/6 · 紧急突围逃跑',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'alert-stance',
    tone: 'alarm',
    text: '局势彻底不妙。眼下没有任何余地再去查明一个完全不认识的路人为何用壳设陷于 {codename}，更来不及慢慢习惯这副赤足悬空的娇小身体。',
  },
  {
    index: 19,
    lineNo: '20',
    beatId: 'decide-flee',
    chapterLabel: '段落 6/6 · 紧急突围逃跑',
    speakerKind: 'player',
    speakerName: '玩家（自言自语）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'escape-cta',
    hudAlerts: ['[ACTION] 扯断野桌接入线 · 剥离残余逃生协议'],
    tone: 'alarm',
    text: '「……管不了这么多了！再待在这里就是等死——先强行扯断野桌连接，顺手捞走她终端里残余的逃生协议，立刻逃跑！」',
  },
  {
    index: 20,
    lineNo: '21',
    beatId: 'decide-flee',
    chapterLabel: '段落 6/6 · 紧急突围逃跑',
    speakerKind: 'narrator',
    speakerName: '旁白（系统观测）',
    spriteMode: 'mirror',
    expression: 'angry',
    spriteTag: '终端镜像投影 // SHELL://ECHO-0',
    stageEffect: 'dash-out',
    tone: 'alarm',
    text: '{codename} 咬牙强压下四肢与蝶翼传来的别扭感，抓起残余协议转身冲向尚未彻底合死的暗区夹缝——',
  },
];

export type Sec00StepId =
  | 'swap-board0'
  | 'call-raise20'
  | 'flip-board1'
  | 'flush-raise40'
  | 'hack-plus-one'
  | 'scan-catch'
  | 'completed';

export interface Sec00Capabilities {
  allowHack: boolean;
  allowScan: boolean;
  allowRaise: boolean;
}

export interface Sec00Guidance {
  stepId: Sec00StepId;
  badge: string;
  title: string;
  instruction: string;
  subNote: string;
  focusIds: string[];
  completed: boolean;
}

function pickCard(deck: Card[], rank: Rank, suit: Suit, copy: 0 | 1 = 0): Card {
  const found = deck.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy);
  if (!found) {
    throw new Error(`Missing card ${rank}${suit}-${copy}`);
  }
  return found;
}

function buildDeterministicDeck(fixedFront: Card[]): Card[] {
  const full = createDeck();
  const used = new Set(fixedFront.map((c) => c.id));
  const rest = full.filter((c) => !used.has(c.id));
  return [...fixedFront, ...rest];
}

export function createSec00TutorialState(): GameState {
  const full = createDeck();
  // Human: Q粉, 9粉, 2黑 (High Card Q) -> weaker than AI One Pair 10s -> Human acts first
  // AI: 10黑, 10粉, 4黑 (One Pair 10s)
  // Board: 5粉, 7粉, A粉, J黑
  const fixedFront = [
    pickCard(full, 12, 'P', 0),
    pickCard(full, 9, 'P', 0),
    pickCard(full, 2, 'B', 0),
    pickCard(full, 10, 'B', 0),
    pickCard(full, 10, 'P', 0),
    pickCard(full, 4, 'B', 0),
    pickCard(full, 5, 'P', 0),
    pickCard(full, 7, 'P', 0),
    pickCard(full, 14, 'P', 0),
    pickCard(full, 11, 'B', 0),
  ];

  return createInitialState({
    chips: { human: 1000, ai: 110 },
    opponentName: '匿名终端 [UNKNOWN_0x00]',
    tieStarter: 'human',
    deckOverride: buildDeterministicDeck(fixedFront),
  });
}

export function getSec00StepId(state: GameState): Sec00StepId {
  if (state.phase === 'showdown') {
    return 'completed';
  }
  if (state.players.human.swapCount === 0 && !state.board[0]?.isOpen) {
    return 'swap-board0';
  }
  const diff = getBetDiff(state, 'human');
  if (diff > 0) {
    return 'call-raise20';
  }
  if (!state.board[1]?.isOpen) {
    return 'flip-board1';
  }
  const aiTampered = Boolean(state.players.ai.hand[0]?.tamperedBy?.includes('plus-one'));
  if (state.board[2]?.isOpen && !aiTampered) {
    return 'flush-raise40';
  }
  if (aiTampered && !state.usedHackThisTurn) {
    return 'hack-plus-one';
  }
  if (aiTampered && state.usedHackThisTurn) {
    return 'scan-catch';
  }
  return 'flush-raise40';
}

export function getSec00Capabilities(state: GameState): Sec00Capabilities {
  const step = getSec00StepId(state);
  return {
    allowRaise: step === 'flush-raise40',
    allowHack: step === 'hack-plus-one',
    allowScan: step === 'scan-catch',
  };
}

export function isSec00ActionAllowed(state: GameState, action: GameAction): boolean {
  if (state.currentTurn !== 'human' || state.phase === 'showdown') return false;
  const step = getSec00StepId(state);
  switch (step) {
    case 'swap-board0':
      return action.type === 'swap' && action.handIndex === 2 && action.boardIndex === 0;
    case 'call-raise20':
      return action.type === 'call';
    case 'flip-board1':
      return action.type === 'flip' && action.boardIndex === 1;
    case 'flush-raise40':
      return action.type === 'raise' && action.amount === 40 && !action.isHalfStack;
    case 'hack-plus-one':
      return action.type === 'hack' && action.handIndex === 0 && action.skill === 'plus-one';
    case 'scan-catch':
      return action.type === 'scan' && action.targetKind === 'hand' && action.targetIndex === 0;
    default:
      return false;
  }
}

export function pickSec00AiAction(state: GameState): GameAction | null {
  if (state.currentTurn !== 'ai' || state.phase === 'showdown') return null;

  // Turn 1: after human swaps board[0], AI raises +20
  if (state.board[0]?.isOpen && !state.board[1]?.isOpen && state.raisesInSubPhase === 0) {
    return { type: 'raise', amount: 20 };
  }

  // Turn 2: after human calls 20 and flips board[1], AI flips board[2] (reveals A粉 -> Flush!)
  if (state.board[1]?.isOpen && !state.board[2]?.isOpen) {
    return { type: 'flip', boardIndex: 2 };
  }

  // Turn 3: human raised +40 -> AI calls 40 -> AI hacks hand[0] +1 -> AI ends turn
  const aiDiff = getBetDiff(state, 'ai');
  if (aiDiff > 0) {
    return { type: 'call' };
  }
  if (
    state.board[2]?.isOpen &&
    state.justCalledThisTurn &&
    !state.usedHackThisTurn &&
    !state.players.ai.hand[0]?.tamperedBy?.length
  ) {
    return { type: 'hack', handIndex: 0, skill: 'plus-one' };
  }
  if (state.justCalledThisTurn && state.usedHackThisTurn) {
    return { type: 'end-turn' };
  }
  return null;
}

export function getSec00Guidance(
  state: GameState,
  ctx: {
    selectedHandIndex: number | null;
    scanMode: boolean;
    showRaiseTiers: boolean;
  }
): Sec00Guidance {
  const step = getSec00StepId(state);

  if (step === 'completed') {
    return {
      stepId: 'completed',
      badge: '教学通关',
      title: 'SEC-00 匿名终端已击穿 · 突发壳层异变',
      instruction:
        '对方虚拟实体反向覆写了你的核心壳层，全区红色警报与追兵轨迹已经锁定！完成撤离剧情并提取残余协议后立即逃亡。',
      subNote:
        '警告：你现在披着的「SHELL://ECHO-0」壳层正在持续广播未知高危信标，四面八方的追捕者正循迹合围。',
      focusIds: ['action-btn-escape-retreat'],
      completed: true,
    };
  }

  if (step === 'swap-board0') {
    return {
      stepId: 'swap-board0',
      badge: '实操 1/5 · 明暗换牌',
      title: '换走废牌 2黑，藏入私有暗牌',
      instruction:
        ctx.selectedHandIndex === 2
          ? '已选中 2黑！现在点击中央第 1 张暗牌「节点01」（或直接拖过去）完成换牌。'
          : '先点击（或拖拽）己方第 3 张手牌「2黑」，与中央第 1 张暗牌「节点01」互换。',
      subNote: '换入的手牌会变成只有你能看到的「私有暗牌」并锁定不可再换；换牌会消耗门票并轮到对手。',
      focusIds: ctx.selectedHandIndex === 2 ? ['board-node-card-0'] : ['human-hand-card-2', 'board-node-card-0'],
      completed: false,
    };
  }

  if (step === 'call-raise20') {
    return {
      stepId: 'call-raise20',
      badge: '实操 2/5 · 跟注不耗回合',
      title: '对手加注 +20！先点跟注补齐差额',
      instruction: '点击右侧「跟注 20」补齐差额——注意跟注后回合依然属于你，不会直接换人！',
      subNote: '必须先把跟注差额补齐为 0，才能继续翻牌、换牌、加注或发动黑客技能。',
      focusIds: ['lc-action-btn-call'],
      completed: false,
    };
  }

  if (step === 'flip-board1') {
    return {
      stepId: 'flip-board1',
      badge: '实操 3/5 · 免费翻牌',
      title: '跟注未结束回合！现在免费翻开 1 张暗牌',
      instruction: '直接点击中央第 2 张暗牌「节点02」免费翻开，并移交回合给对手。',
      subNote: '翻开公共牌 0 算力消耗，且会将当前段内的加注次数上限重置。',
      focusIds: ['board-node-card-1'],
      completed: false,
    };
  }

  if (step === 'flush-raise40') {
    return {
      stepId: 'flush-raise40',
      badge: '实操 4/5 · 同花成牌与加注施压',
      title: '5 张绯霓同花已成！了解阶梯后加注 +40',
      instruction: ctx.showRaiseTiers
        ? '点击第 3 档「+40」向对手施压！（记住：双花色下 两对 > 同花 > 一对）'
        : '你已凑齐 5 张绯霓同花！点击右侧「加注」打开三档定额，准备选择 +40 施压。',
      subNote: '黑/粉双花色各 26 张让同花更好凑，因此规则将两对排在同花之上；当前 5 张同花已稳压对面一对 10。',
      focusIds: ctx.showRaiseTiers ? ['raise-tier-btn-2'] : ['lc-action-btn-open-raise'],
      completed: false,
    };
  }

  if (step === 'hack-plus-one') {
    return {
      stepId: 'hack-plus-one',
      badge: '实操 5/5 · 黑客篡改（不占回合）',
      title: '异常权限溢出！体验一次 +1 改牌',
      instruction:
        ctx.selectedHandIndex === 0
          ? '已选中 Q粉！点击下方「+1」预支 40 算力将其改写为 K粉（不会结束你的回合）。'
          : '对面刚刚似乎往终端注入了异常改牌信号，你的壳层也短暂解锁了篡改权限！先选中「Q粉」，再点「+1」。',
      subNote: '黑客改牌对敌人隐藏且预支算力也会被掩盖，每回合限用 1 次，改完后你还可以立刻继续操作！',
      focusIds: ctx.selectedHandIndex === 0 ? ['hack-btn-plus-one'] : ['human-hand-card-0', 'hack-btn-plus-one'],
      completed: false,
    };
  }

  return {
    stepId: 'scan-catch',
    badge: '终结教学 · 扫描抓包与一击清零',
    title: '抓住对面偷改底牌的破绽！',
    instruction: ctx.scanMode
      ? '扫描激光已开启！点击对手第 1 张手牌（原 10黑）抓获她的 +1 篡改，一击清零过关！'
      : '对面看似还有 40 算力，其实刚偷改了底牌！点击下方「扫描」按钮开启激光抓包。',
    subNote: '扫描抓获篡改会立刻合并所有预支算力直接判胜并永久封印该技能，正好将匿名终端击穿归零！',
    focusIds: ctx.scanMode ? ['opponent-hand-card-0'] : ['hack-btn-scan-toggle'],
    completed: false,
  };
}
