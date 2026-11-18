# 黑域协议：替壳者（Mingan Hold'em）

赛博像素风反黑客心理博弈卡牌游戏前端应用。玩家扮演拥有黑客协议与「时间回溯」锚点能力的潜行替壳者，在双花色简化德州规则的基础上，结合「明暗换牌」「终端改牌（作弊）」「协议扫描」与「心理话术博弈」，突破黑河协议网络防线并向现实出口突围。

---

## 核心玩法与规则速览

### 1. 双花色 52 张赛博牌库与牌型大小
- **花色构成**：全副 52 张牌仅含两种花色——黑曜脉冲（`B`，26 张）与绯霓电弧（`P`，26 张），每种花色 2–A 各 2 张重复副本。
- **牌型大小排序（概率重排）**：
  `四条 (Quads) > 同花顺 (StraightFlush) > 葫芦 (FullHouse) > 顺子 (Straight) > 三条 (Trips) > 两对 (TwoPair) > 同花 (Flush) > 一对 (OnePair) > 高牌 (HighCard)`
  注意：由于只有双花色，5 张牌凑齐同花的概率高于两对，因此本规则中 **两对严格大于同花**。
- **先手规则**：每手开局双方各发 3 张牌（2 张公开明牌 + 1 张私有暗牌），初始 3 张牌型较弱的一方先手；若完全平手则按手数轮流先手。

### 2. 回合行动与博弈机制
- **非消耗性跟注**：当面对对手加注时，玩家可点击跟注补齐差额；在非河牌圈跟注后仍保留当前回合控制权，可继续换牌、翻牌、反加或主动结束回合。
- **明暗换牌（Swap）**：将自己手上 1 张公开明牌与公共区 1 张未翻开的暗牌交换，换入后的手牌变为私有暗牌，原公共槽位变成公开牌并锁定标记归属。
- **终端作弊（Hack）与扫描（Scan）**：
  - 作弊仅作用于己方手中的公开明牌，篡改后的结果在摊牌前对对手完全不可见，篡改费用先进入隐藏托管池（`hackEscrowPot`）。
  - 扫描仅可针对对手桌上的**公开牌**（对手公开手牌或对手换入公共区的牌）。若抓获篡改，作弊方直接判负且该作弊技能在本局对抗中被封印；若扫描失误则自损扫描算力。
  - 若公共/手牌带有反制技能「见切·燕返」，对手一旦扫描该牌将立即触发反杀，施放方直接赢得本小局。
- **加注限制**：前/中/后翻牌圈单阶段加注上限与单次加注封顶依次为 `20 / 40 / 100`，另支持长按半池重注（突破单阶段常规封顶）。

### 3. 双模式牌桌与技能系统
- **现实终端启动流（`MINGAN-OS 98` 桌面 -> `MINGAN_NET // TTY-01` 登录）**：
  - 新档默认进入像素电脑桌面（回收站还原协议网入口、记事本《仇恨之书》、维心与开始菜单「自由对局」快捷入口），接入终端后支持 `/new`、`/continue`、`/save` 三槽存档与快速跳转。
- **剧情突围模式（逃亡路线图 `SEC-00` ~ `SEC-04` -> `EXIT-RL`）**：
  - 左侧控制栏提供「设置 / 路线图」，并在玩家首次算力归零时解锁高光引导「时间回溯」。
  - **时间回溯（ECHO-0）**：己方算力归零时可**点按**回退到上一次行动前（伴随红色算力数据流逆向回流特效，并保留已触发的火符红叉标记）；在任意算力下均可**长按约 0.8 秒**直接重开整场节点对局以解决死局。
  - 通关节点后可获取奖励技能；技能分为**作弊技（Cheat）**与**辅助技（Support）**两组，每组独立上限 3 槽，满槽后支持自主替换。
- **自由牌桌模式**：
  - 左侧控制栏提供「设置 / 快速重开 / 联机 / 换人」。
  - 支持自由切换契约追捕者、自定义 AI 难度/打法/作弊倾向矩阵、注入本地或云端 LLM 对话与决策。

---

## 技术栈与目录结构

- **前端框架**：React 19 + TypeScript 5.9 + Vite 7（目标 `es2022`）
- **测试体系**：Node 24 原生 `--experimental-strip-types --test`（27 套件 / 137 项测试）
- **音效引擎**：纯 Web Audio API 程序化合成（无外部音频文件依赖）
- **联机架构**：WebRTC DataChannel（支持 SDP 压缩与消息分片）+ Cloudflare Workers & SQLite Durable Objects（`/api/p2p-ws`、`/api/p2p-signal`）

```text
mingan-holdem/
├── docs/                      # 剧情剧本、桌面/终端启动器与 M0–M4 规划文档
├── public/assets/story/       # 角色立绘与多表情差分素材 (WebP，含 SEC-00~04 与常服差分)
├── scripts/                   # Vite 本地开发插件 (p2p-signaling / night-sugar-cards)
├── src/
│   ├── App.tsx                # 牌桌主控台、动画队列、剧情与自由模式调度
│   ├── components/            # 像素桌面、终端登录、卡牌牌桌、路线图、VN 对话框与系统弹窗
│   ├── engine/
│   │   ├── gameEngine.ts      # 规则状态机、防泄密可见性过滤、火符/见切结算
│   │   ├── evaluator.ts       # 2 花色 3/5/7 张牌型评估器与蒙特卡洛胜率支撑
│   │   ├── aiAgent.ts         # 本地 AI 策略矩阵与角色专属技能决策
│   │   ├── skillPool.ts       # 15 项注册技能与作弊/辅助双 3 槽装备规则
│   │   ├── escapeMap.ts       # 逃亡路线图 SEC-00~04 + EXIT-RL、暗墙与回溯解锁状态机
│   │   ├── desktopState.ts    # MINGAN-OS 98 桌面图标/回收站/M1 终局引导状态持久化
│   │   ├── terminalLogin.ts   # TTY-01 终端指令解析、Tab 补全与 3 槽加密存档
│   │   ├── storyCharacters.ts # 女主 ECHO-0 与各章节角色档案、常服/黑域立绘与台词库
│   │   ├── sec00Tutorial.ts   # SEC-00 单轮聚光灯连贯剧情教学剧本
│   │   ├── sec04Epilogue.ts   # SEC-04 战后断连尾声 VN 剧本
│   │   ├── rewindHold.ts      # 时间回溯点按归零门槛与长按重开状态判定
│   │   ├── p2pProtocol.ts     # 房主权威校验、防窥视数据清洗与客机镜像视角
│   │   ├── p2pTransport.ts    # WebRTC 与 WebSocket 中继双传输层封装
│   │   ├── llmClient.ts       # OpenAI 兼容 / Vertex AI 对话与决策接入
│   │   ├── soundEngine.ts     # Web Audio 程序化赛博音效合成器
│   │   └── debugCmd.ts        # 内置调试终端作弊码解析与状态改写
│   └── styles/
│       └── pixelCyberOs.css   # 赛博像素 OS 样式系统与响应式布局
├── tests/                     # 覆盖引擎、AI、联机、桌面/终端、剧情、音效与 UI 门禁的测试集
├── worker/index.mjs           # Cloudflare Worker + Durable Object (P2pRoomDO) 联机中继
├── vite.config.ts             # Vite 配置与 manualChunks 分包
└── wrangler.jsonc             # Cloudflare Workers 部署配置
```

---

## 快速开始与常用命令

在 `mingan-holdem/` 目录下执行：

```bash
# 安装依赖
pnpm install

# 启动本地开发服务器 (默认 http://127.0.0.1:5178)
npm run dev

# 运行全量单元测试 (Node 24 原生 TS 执行)
npm test

# TypeScript 类型检查
npx tsc --noEmit

# 生产构建 (输出至 dist/)
npx vite build

# 检查 Cloudflare Worker 语法
node --check worker/index.mjs
```

---

## 内置调试终端（CMD）速查

游戏中按 `~`（反引号）或 `F9` 即可呼出内置调试终端（也可从设置菜单进入）：

| 指令 | 别名 | 说明 |
| --- | --- | --- |
| `win` | `clearnode` / `gg` | 直接赢下当前牌局并击穿对手算力，触发过关动画 |
| `next` | - | 跳过当前过场并解锁进入下一个逃亡节点 |
| `goto <0-4>` | - | 直接传送至指定逃亡节点（`0`=SEC-00 ... `4`=SEC-04） |
| `chips <player\|ai> <数值>` | - | 修改己方或对手当前剩余算力 |
| `hand <quads\|fullhouse\|flush>` | - | 将当前手牌/公共牌改写为四条A、葫芦或同花 |
| `skill <技能ID>` | - | 直接装备指定技能（满 3 槽时自动触发替换弹窗） |
| `clearskills` | - | 清空已装备的额外辅助协议技能槽 |
| `reveal` | - | 开关透视模式（查看对手暗牌与公共暗槽） |
| `lose` | - | 将己方算力清 0（用于测试回溯或战败逻辑） |
| `rewind` | `回溯` / `时间回溯` | 强制触发剧情牌桌的时间回溯按钮 |
| `reset` | - | 重置逃亡路线进度与已显形暗墙 |
| `resetprofile` | `wipe` / `clearprofile` | 彻底重置玩家本地档案（路线/实体/技能/教程） |
| `clear` | `cls` | 清空调试终端日志 |

---

## 工程规范与质量门禁

自动化测试（`tests/uiQuality.test.ts` 与 `tests/p2pProtocol.test.ts`）强制校验以下底线，新增或修改代码时请务必遵守：

1. **零 Emoji**：`src/` 与 `index.html` 中禁止出现任何 Unicode Emoji 或花色图形字符，所有图标均使用 `src/components/CyberIcons.tsx` 中的像素 SVG。
2. **禁止原生弹窗**：禁止调用 `window.alert`、`window.confirm`、`window.prompt`，所有提示与确认一律使用内置 Toast 或 PixelWindow 弹窗。
3. **唯一交互控件 ID**：`src/**/*.tsx` 中所有 `<button>`、`<input>`、`<select>`、`<textarea>` 必须具备唯一的描述性 `id` 属性。
4. **全中文界面与术语统一**：对局资源统一称呼为「算力」（禁止出现「筹码」字样），空牌（`isBlank`）统一显示为 `NULL`。
5. **移动端布局底线**：`@media (max-width: 960px)` 样式中禁止隐藏 `.lc-right-upper-col`，确保移动端聊天抽屉始终可达。
