# 黑域协议：替壳者（Mingan Hold'em）开发进度与后续规划（PLAN）

本文档用于向后续接手的开发 Agent 同步项目现状、已落地的系统架构、待开发任务清单以及不可破坏的规则铁律。

---

## 一、项目当前基线与协作约定

- **仓库位置**：`mingan-holdem/`（独立 Git 仓库，主干分支 `main`）
- **当前基线状态**：
  - 单元测试：`npm test`（25 个测试套件 / 111 条用例全部通过）
  - 类型与构建：`npx tsc --noEmit` 零报错，`npx vite build` 正常产出分包产物
- **推荐工作流**：
  1. 从 `main` 切出独立功能分支（`superpowers/<slug>`）；
  2. 先补全单测（红灯）再写实现代码（绿灯），重点逻辑需同步更新 `tests/`；
  3. 合并前完成 `npm test && npx tsc --noEmit && npx vite build` 验证；
  4. 使用 `git merge --no-ff` 合并回 `main` 后再推送，保留完整特性分支脉络。

---

## 二、已完成事项（Done）

### 1. 核心牌局引擎与状态防泄密隔离
- [x] **双花色 52 张牌库与评估器**（`src/engine/evaluator.ts`, `src/engine/gameEngine.ts`）：黑/粉双花色各 26 张，实现 **两对 > 同花** 的概率重排；支持 3 张初始牌弱势先手与平手交替判定。
- [x] **核心动作流与经济闭环**：翻牌（Flip）、明暗换牌（Swap + 递增覆写费 + 锁定标记）、非消耗性跟注、分阶段加注上限（20 / 40 / 100）+ 长按半池重注、全下（All-In）自动摊牌、弃牌结算；总算力严格守恒。
- [x] **暗改隔离与托管池**：所有作弊篡改（`+1` / `-1` / `flip-suit` / `crown-ace` / `null-erase` / `pink-double` / `mikiri-counter`）仅对己方公开，费用先扣入隐藏托管池 `hackEscrowPot`，摊牌前对手视角及 LLM 序列化均无法窥探原始篡改痕迹。
- [x] **扫描规则收紧**：扫描仅允许针对对手桌上的公开牌（`visibility === 'open'` 或对手换入公共区的牌），禁止扫描不可能作弊的私有暗牌；且每局首轮若 AI 先手在玩家尚未操作前不触发无效扫描。

### 2. 剧情模式与逃亡路线（第一章：`SEC-00` ~ `SEC-04` -> `EXIT-RL`）
- [x] **剧情/自由双牌桌功能拆分**（`src/App.tsx`, `tests/uiQuality.test.ts`）：
  - 剧情牌桌左侧固定提供「设置 / 路线图 / 时间回溯」；
  - 自由牌桌左侧固定提供「设置 / 快速重开 / 联机 / 换人」。
- [x] **逃亡路线图与暗墙钻缝**（`src/engine/escapeMap.ts`, `src/components/EscapeRouteMapView.tsx`）：折线路径插值移动、封锁墙缺口显形、通关解锁及自由牌桌直达入口。
- [x] **女主「零回响 // ECHO-0」与 SEC-00 聚光灯教学**（`src/engine/sec00Tutorial.ts`, `src/engine/tutorialSpotlight.ts`）：4 段开场自言自语 + 6 步单轮连贯引导 + 心理独白高亮聚光灯。
- [x] **SEC-01「凌翡 // JADE-01」**：实名上网财阀千金档案、专属立绘（6 表情）、技能「算力虹吸（`siphon-cache`）」+ 特权改牌技「钦定王牌（`crown-ace`）」。
- [x] **SEC-02「芙兰 // MUTE-02」**：失声双刃猎手档案、立绘与乱码语音/清醒狂气干扰项独白；主动技「富兰克林之死（`cold-freq-lock`）」+ 刀光切割音效与作弊技「信息抹除（`null-erase` -> `NULL` 牌且带有 `MOD` 标识 + AI 自动将 `NULL` 牌换出）」。
- [x] **SEC-03「粉红软软龙 // NEON-03」**：霓虹心心理评估同事档案与立绘；被动「粉曜迷彩（`pink-mirage`）」全明牌粉雾伪装（换入飞行过程同样保持粉色显示）+ 作弊技「双粉映象（`pink-double`）」单牌计作两张粉牌。
- [x] **SEC-04「绯凪·千夜 // KIRI-04」**：黑河反黑客组织武士大姐姐档案与立绘；公共牌区燃烧特效与「灼心·火符（`gate-minefield`）」（剧情模式 3 处潜伏且触符算力瞬间归零；自由牌桌正常难度 1 处潜伏扣减 100 算力）+ 作弊技「见切·燕返（`mikiri-counter`）」（不可叠加、换入公共区依然生效、被对手扫描立即反杀赢得本小局）。
- [x] **时间回溯增强与死局解法**（`src/engine/rewindHold.ts`, `src/engine/debugCmd.ts`）：
  - 触符算力归零后点按「时间回溯」回退行动并保留火符牌背赤红 `TRAP!` + 大红叉标记（进入下一轮时自动重置标记）；
  - 短按回溯限定算力归零才可发动，同时提供 CMD `rewind`（`回溯` / `时间回溯`）调试指令；
  - 任意算力下长按「时间回溯」约 0.78 秒可充能重开整场对局，彻底解决退一步仍无法脱困的死局问题。

### 3. 技能池、AI 矩阵、LLM 与联机系统
- [x] **技能双分组上限控制**（`src/engine/skillPool.ts`）：作弊技能与辅助技能分别维持 3 槽上限与独立替换弹窗；共计 15 项已注册技能。
- [x] **AI 难度与性格矩阵**（`src/engine/aiAgent.ts`）：`rookie` / `standard` / `master`（含 120 次蒙特卡洛胜率模拟）搭配 `pressure` / `trap` / `sculptor` / `conservative` 与 4 种作弊倾向，并完整支持 AI 主动触发各节点专属作弊技。
- [x] **LLM & 世界书集成**（`src/engine/llmClient.ts`, `src/engine/vertexClient.ts`, `src/engine/worldbook.ts`, `src/engine/presets.ts`）：支持 OpenAI 兼容端点与 Google Vertex AI、SillyTavern 兼容预设/世界书、多段心理独白+发言解析及预输入随动作合并发送。
- [x] **P2P 好友联机**（`src/engine/p2pProtocol.ts`, `src/engine/p2pTransport.ts`, `worker/index.mjs`）：支持手动紧凑 SDP 邀请码与 6 位房间号云端 WebSocket 中继（Cloudflare Durable Objects），具备自动重连、长消息分片与房主权威防作弊清洗。
- [x] **Web Audio 程序化音效与像素 UI**（`src/engine/soundEngine.ts`, `src/styles/pixelCyberOs.css`）：含 `blade-slash` 斩击、`fire-burn` 灼烧、`charge-tick` 长按充能等全部音效；全移动端竖屏自适应。

---

## 三、待办与后续规划（Roadmap / TODO）

### P0 · SEC-04 终极 Boss 战多阶段高潮演出（未实现）
- [ ] **回溯按钮耐久度磨损**：在 SEC-04 对局中随玩家多次使用「时间回溯」，按钮呈现四阶段状态演进（`100% -> 72% -> 48% -> 按钮碎裂失效`），并在界面给出清晰裂纹与算力通道告警反馈。
- [ ] **Boss 暴走阶段切换**：回溯按钮彻底碎裂后，绯凪·千夜进入暴走状态——公共区变为 `4/4` 全火符覆盖，且行动倾向锁定强制高频加注压迫。
- [ ] **女主摊牌破局与结局弹窗**：在绝境摊牌时刻触发 ECHO-0 共鸣改写演出（强行将玩家牌面改写为四条 A 完成破局），随后弹出「猎杀榜 NO.1」通关尾声结算弹窗并衔接现实出口剧情。

### P1 · 第二章主线：ECHO-0 共情碎片找回篇（已延后至下一步主线）
- [ ] **新章节路线与节点设计**：在 `EXIT-RL` 物理逃脱之后开启第二章地图，围绕「找回 ECHO-0 遗失的共情碎片」展开新关卡节点、新对手档案与专属机制。
- [ ] **世界观伏笔回收**：完善黑河组织、BLACK BOX 与「完美虚拟实体」后续剧情事件与世界书动态条目联动。

### P1 · 商业化美术与离线字体资产补齐
- [ ] **替换早期夜糖测试立绘**：目前自由牌桌/默认契约库中仍捆绑 6 份用于早期验证的外部立绘资源，商业发布前需全部替换为独立原创立绘及表情差分。
- [ ] **本地化像素字体打包**：将外部引用字体转为随包分发的本地 `WOFF2` 子集文件，保证离线桌面端与弱网环境像素字形完全一致。

### P2 · P2P 穿透增强与 Steam 桌面端发行准备
- [ ] **服务端 TURN 中继支持**：在现有 WebSocket 中继之外为 P2P 音视频/数据直连补充可控 TURN 服务器配置下发能力，覆盖严格对称 NAT 与移动网络。
- [ ] **桌面端封装与本地化**：使用 Tauri 或 Electron 打包 Windows/macOS 客户端，接入 Steamworks 成就/云存档 API，并整理完整英文（EN）本地化语言包（当前核心架构与文案为全中文单语种）。

---

## 四、后续 Agent 接手必读守则

1. **规则不变量**：
   - `evaluator.ts` 中始终保持 **两对 > 同花**。
   - 任何技能、虹吸、灼烧、托管池扣费结算后，对局内双方当前算力 + 底池 + 隐藏托管池总和必须严格守恒（或按预期转入对手）。
   - `startNextHand` 开启新一小局时，必须清理上轮临时标记（如 `confirmedTrapIndices`、`lockedHumanHackSkill`、`sealedSkills` 按规则范围重置）。
   - 严禁在 `p2pProtocol.ts` 的 `sanitizeStateForGuest` 或 `llmClient.ts` 的牌桌摘要中泄露对手私有暗牌、未翻公共暗槽、火符陷阱下标或尚未揭穿的暗改原牌信息。
2. **UI 与测试红线**：
   - 任何修改提交前必须确保 `npm test`、`npx tsc --noEmit`、`npx vite build` 全部通过。
   - 严禁在 `src/` 与 `index.html` 中写入任何 Emoji 或图形字符；严禁使用原生 `alert/confirm/prompt`；所有新交互控件必须带唯一 `id`。
   - 当前外部参考库 `night-sugar-office/` 位于工作区上一级目录，不属于本仓库提交内容，切勿将大体积外部测试资产直接提交到 `mingan-holdem` 仓库。
