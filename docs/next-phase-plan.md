# 《黑域协议：替壳者（Mingan Hold'em）》下一阶段开发规划方案

> **文档定位**：本方案承接既有 [PLAN.md](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/PLAN.md) 的阶段里程碑。当前 **Demo 核心闭环已基本成型**，本文档梳理当前工程基线、尚存测试过渡期缺口，并给出从 **「Demo 封板 -> 正式版第一章终局 -> 第二章主线 -> 无尽肉鸽/联机进阶 -> 商业化发行」** 的可执行路线图（M0–M4）。

---

## 一、当前 Demo 基线盘点与遗留缺口

### 1. 已完成的核心能力（Current Baseline）
- **开局与外围终端流**：
  - `MINGAN-OS 98` 像素风 Windows 桌面（仅新档首次打开出现）：可网格拖拽并持久化图标位置、打开「回收站」两步还原 `黑域协议网.lnk`、粉红「维心」离线占位、可阅读的《仇恨之书.txt》日记记事本、开始菜单系统设置与实时数字时钟。
  - `MINGAN_NET // TTY-01` 终端登录界面：品牌 Hero Logo + `DotGothic16` 重影标题、`/help` 指引、键盘 `Tab` 补全与历史翻阅、快捷指令芯片、`/new` / `/continue` / `/save` 3 槽加密存档 / `/settings` / `/desktop` 全套闭环。
  - 全套自定义 24x24 像素 SVG 鼠标光标（默认箭头、交互手型、文本光标、拖拽抓手、狙击扫描准星、禁用红叉）。
- **第一章主线剧情（`SEC-00` ~ `SEC-04` -> `EXIT-RL`）**：
  - 完整串联 ECHO-0 单轮聚光灯新手教学、`SEC-01`（凌翡）、`SEC-02`（芙兰）、`SEC-03`（粉红软软龙）、`SEC-04`（绯凪·千夜），含全部角色开场/战后视觉小说演出与 2K 表情差分立绘。
  - `SEC-04` 终局实装：回溯按钮四阶段耐久磨损碎裂、Boss 暴走（4/4 全火符 + 连续重注 + 3 次弃牌锁死）、三段式「绝命覆写 // 四条 A」破局演出及 `Sec04VictoryModal` 结算。
- **底层博弈、AI 与扩展框架**：
  - 双花色 52 张牌库（`两对 > 同花`）、隐藏托管池（`hackEscrowPot`）、防窥视/防泄密数据隔离、`3` 项基础作弊技 + `15` 项可获取技能池（全部 `implemented: true`，作弊/辅助双 3 槽上限）。
  - `4x4` 本地 AI 性格与蒙特卡洛决策矩阵、OpenAI / Vertex AI LLM 对话联动、Cloudflare Durable Objects + WebRTC P2P 好友联机、纯 Web Audio 程序化音效引擎及全量移动端适配。

### 2. 当前需要收口的 Demo 尾巴（Observed Gaps）
1. **工程与 Git 收尾**：
   - 自 `b12d33b` 之后的「像素桌面 + 终端登录 + 像素光标」代码目前处于本地未提交状态。
   - [package.json](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/package.json) 的 `npm test` 脚本尚未纳入新建的 `tests/desktopLauncher.test.ts` 与 `tests/terminalLogin.test.ts`（需补充进默认测试命令以防 CI/本地漏跑）。
2. **`EXIT-RL` 终局仍是开发测试期收尾**：
   - [EscapeRouteMapView.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/EscapeRouteMapView.tsx#L664-L671) 中通关后文案仍为开发调试口吻（`ESCAPE COMPLETE // 突围测试闭环完成`），缺少主角逃回现实桌面的正式章节尾声 VN 与第二章悬念钩子。
3. **「维心」与现实桌面后续交互留白**：
   - 当前「维心」仅做静态离线提示占位，尚未承接第一章通关后（林龙心现实联络、黑河 `BLACKBOX` 现实悬赏转移）的叙事转化。
4. **商业化发行阻塞项**：
   - `public/cards/` 仍内置 6 份 `夜糖事务所-契约卡-*.json` 早期验证资源；[index.html](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/index.html#L11-L16) 仍通过 Google Fonts CDN 外链加载像素字体；缺少背景音乐（BGM）与图鉴回放。

---

## 二、下一阶段总览路线图（M0 -> M4）

```text
M0 Demo 封板与工程对齐 (立即执行 · 1-2天)
   │
   ▼
M1 第一章正式收官：EXIT-RL 现实尾声 + 维心/桌面二周目演化 (短期 · 3-5天)
   │
   ├──────────────────────────────────────────┐
   ▼                                          ▼
M2 第二章主线：ECHO-0 共情碎片回收篇        M3 玩法深度拓展：无尽替壳悬赏 + P2P 技能局
(CH2-01~04 + CORE-BB + 共情双线结局)        (肉鸽构筑连战 + 好友带技联机竞技)
   │                                          │
   └──────────────────┬───────────────────────┘
                      ▼
M4 商业化资产独立、动态 BGM/图鉴、双语本地化与 Steam 桌面端发行
```

| 阶段 | 核心目标 | 玩家可感知价值 | 预估工作量 | 依赖 |
|---|---|---|---|---|
| **M0** | 工程收口 & Demo 封板提交 | 测试全覆盖、零开发调试痕迹的稳定可玩 Demo | 小（1–2 天） | 无 |
| **M1** | `EXIT-RL` 正式尾声 VN + 维心轻聊天弹窗 | 打通「逃出黑域 -> 回到现实电脑 -> 收到通缉与龙心讯息」完整首章闭环 | 中（3–5 天） | M0 |
| **M2** | 第二章主线 + 共情同步率机制 + 新 Boss/技能 | 完整续篇战役（4~5 节点）、多结局分支与 ECHO-0 共情剧情回收 | 大（2–3 周） | M1 |
| **M3** | 无尽替壳悬赏模式 + P2P 好友带技对战 | 通关后的高重复游玩肉鸽玩法 + 更富博弈深度的好友 PVP | 中大（1–2 周） | M0（可与 M2 并行） |
| **M4** | 原创契约卡池、离线字体、BGM、图鉴、英文化与桌面包 | 摆脱外部依赖与测试立绘，达到公开上架 / Steam Demo 或抢先体验标准 | 大（2–3 周） | M1–M3 |

---

## 三、分阶段详细实施设计

### Phase M0 · Demo 封板与测试基线对齐（优先完成）

**目标**：让当前仓库成为一个可直接分发、构建和测试零遗漏的「Mingan Hold'em v0.2 Demo」里程碑。

1. **M0-1 · 测试全量纳管与生产构建校验**
   - 修改 [package.json](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/package.json) 的 `scripts.test`，将 `tests/desktopLauncher.test.ts` 与 `tests/terminalLogin.test.ts` 正式加入默认 `npm test` 列表（或使用通配/显式全列齐 17 个套件）。
   - 执行全套发布前检查：`npm test`、`npx tsc --noEmit`、`npx vite build`、`node --check worker/index.mjs`。
2. **M0-2 · Git 里程碑整理**
   - 将当前未提交的「像素桌面启动器 + 终端登录界面 + 像素鼠标光标」改动按功能拆包或整洁提交至 `main` 并打上版本标签（例如 `v0.2.0-demo`），保持 `docs/echo-0/` 等高体积生图目录不污染主干历史。

---

### Phase M1 · 第一章正式终局与「现实电脑」叙事闭环

**目标**：消除通关 `SEC-04` 后的“测试闭环完成”生硬感，用 **`MINGAN-OS 98` 现实桌面 + 维心** 作为连接第一章与第二章的叙事桥梁。

#### 1. `EXIT-RL` 现实断连尾声 VN（新增 `src/engine/exitRlEpilogue.ts`）
- **触发时机**：玩家在 `Sec04VictoryModal` 点击「断开牌桌 · 逃往 EXIT-RL 现实出口」，逃亡路线图完成最后一段钻缝到达 `EXIT-RL` 时自动触发（约 12–14 句）。
- **核心剧情节拍**：
  1. **物理脱出**：算力链路在零号闸门后方强制熔断，主角摘下接入终端在现实房间喘息着醒来，屏幕切回 `MINGAN-OS 98`。
  2. **猎杀榜真相落地**：终端右下角弹出紧急广播——`BLACKBOX // 猎杀榜 NO.1 悬赏载体已由虚拟区迁移至现实物理节点`，正式点题「替壳因果」。
  3. **ECHO-0 的静默代价**：强行发动「四条 A」绝命覆写压制全火符后，ECHO-0 的共情模块近乎枯竭而进入半休眠低功耗态，仅留下一段微弱信号：「……碎片掉在更深层的节点里了。别完全信任黑盒的『最优解』……」
  4. **第二章预告落幕**：引导玩家「返回桌面查看现实讯息」或前往「自由牌桌 / 无尽悬赏」练手整备。
- **同步净化**：将 [EscapeRouteMapView.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/EscapeRouteMapView.tsx#L664-L689) 中「突围测试闭环完成」改为正式文案「`CHAPTER 1 CLEARED // 现实逃脱完成`」，并提供「重看终局尾声 / 返回 MINGAN-OS 桌面 / 进入自由牌桌」按钮。

#### 2. 桌面状态演化 & 「维心」像素聊天窗口升级
- **分阶段桌面感知**（扩展 `src/engine/desktopState.ts` 与 `src/components/WindowsDesktopView.tsx`）：
  - **新档首局（未破 SEC-00）**：保持现有极简探索流，避免信息过载（`维心` 仍为离线无消息、`黑域协议网.lnk` 在回收站）。
  - **第一章通关后（`escapeProgress.escapedReality === true`）再 `/desktop` 回到桌面**：
    - `维心` 图标右上角显示品红未读角标 `[2]`；双击打开像素风 **「维心桌面端 v1.8」双栏聊天小窗**：
      - **会话 1 · 林龙心（同事/NEON-03）**：发送几条带着劫后余生吐槽与暗语的真实聊天记录（例：“今天茶水间都在传黑河内网炸了一条闸门……晚上千万别连陌生公共节点，我有东西要给你看”），含 1–2 个轻量快捷回复选项。
      - **会话 2 · 未知发信人 `0x00_ECHO` / 系统警报**：仅显示一串残缺字节和共情碎片定位坐标，引出第二章主题。
    - 桌面上追加 1 个可阅读新文本文件 `BLACKBOX_通缉摘要.txt`（内容记录第一章 4 位追捕者战后归档与现实猎杀榜 NO.1 状态）。

---

### Phase M2 · 第二章主线「ECHO-0 共情碎片回收篇」

**目标**：围绕 [worldbook.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/worldbook.ts#L80-L88) 埋下的核心伏笔——**「帮 ECHO-0 找回散落共情碎片，对抗 BLACK BOX 完美决策接管」**，打造体量与质感对标第一章的完整续篇战役。

#### 1. 核心新机制：共情同步率（Empathy Sync `0–100`）
将牌桌玩法选择与剧情状态深度绑定，而非单纯“数值堆高”：
- **加减规则（可测试、透明可见）**：
  - 加分项：在保留对手至少一丝算力或触发非斩杀胜出/关键剧情选择站在人性侧/不滥用高破坏性篡改时提升共情同步率。
  - 扣分项：每局频繁连续使用强行篡改或特定冷静绝杀路线时同步率下降，触发类似 `SEC-03` 中 ECHO-0 `err2` 红眼理性接管状态。
- **战术分歧收益**：
  - **高共情路线（共振态）**：ECHO-0 提供「协作纠偏 / 共享兜底」型辅助提示与护盾；
  - **低共情路线（绝对理性 `err2` 态）**：篡改上限与斩杀爆发更极端，但失误代价与扫描风险陡增；
  - 最终在 `CORE-BB` 决定第二章结局分支（**「共生破壁」** vs **「新完美实体诞生」**）。

#### 2. 多章节逃亡路线图（`Chapter 1` <-> `Chapter 2`）
- 重构 [escapeMap.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/escapeMap.ts)：保留 Chapter 1 全部数据结构向后兼容，新增 `chapterId: 1 | 2` 与 `chapter2Progress`：
  - **CH2-01 · 外围观测站（情报回收节点）**：应对「数据审计/假情报诱导」型机制，找回**第一枚共情碎片（记忆碎片·迟疑）**。
  - **CH2-02 · 霓虹心秘密中继（林龙心协同/反制关卡）**：延续 `SEC-03` 悬念，与掌握内幕的同伴演练或协同对抗黑河清理队，找回**第二枚共情碎片（记忆碎片·信赖）**。
  - **CH2-03 · 黑河算力蒸馏塔（高压陷阱深水区）**：面临多轮连续机制转换（如「动态锁槽 + 双倍反扫」），找回**第三枚共情碎片（记忆碎片·悔恨）**。
  - **CH2-04 · 零号镜像大厅（Boss 战：BLACK BOX 主脑代理 / 「完美虚拟实体」原模）**：对手不再单纯依赖固定作弊技，而是根据玩家历史操作倾向进行“决策镜像预测”的最终心智对决。
  - **CORE-BB · 黑盒核心断点**：第二章终局抉择与结局 VN。

#### 3. 第二章新增协议技能规划（预计新增 6 项，继续遵守 3+3 槽位上限）
在 [skillPool.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/skillPool.ts) 既有 15 项技能基础上补充第二章主题技，推动构筑分化：
- **作弊技（Cheat）**：
  1. `suit-resonance`（**频谱共鸣**）：复制自己另一张手牌的花色给目标明牌，构造灵活同花。
  2. `decoy-spoof`（**假证植码**）：伪造一张对端扫描必定报红但实际无害的虚假篡改标记，消耗对手扫描算力并骗取反击窗口。
- **辅助技（Support）**：
  3. `empathy-buffer`（**共情缓冲**，共鸣核心）：本手若陷入劣势跟注或遭反制扣除算力时，按共情同步率减免固定损耗。
  4. `mirror-echo`（**回声复演**）：复制对手本手上一轮刚发动过的一次非被动技能效果。
  5. `clean-reboot`（**无痕清洗**）：支付算力主动洗掉己方某张高危明牌上的篡改/锁定痕迹（归还部分托管费，转攻为守）。
  6. `logic-jam`（**黑盒噪点**）：短暂屏蔽对手 AI 蒙特卡洛对己方潜在两对/同花听牌的评估权重一回合。

---

### Phase M3 · 高可重玩玩法拓展（无尽替壳悬赏 + P2P 技能竞技）

**目标**：把目前已写好底层的 `campaign.ts`「虚拟实体诱饵 + 技能掠夺」体系与 `p2pProtocol.ts` 联机体系打磨成独立、耐玩的长期内容。

#### 1. 「无尽替壳悬赏（Bounty Run）」模式
目前 [campaign.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/campaign.ts) 已有 `capturedEntities`（夺取敌方虚拟实体做防败退诱饵）和 `wantedLevel`，但缺少独立的关卡节奏包装：
- **入口**：在 `TerminalLoginView` 新增 `/mode bounty`（或主流程通关第一章后在路线图/桌面解锁入口）。
- **核心循环（每 3 战为一个悬赏波次）**：
  - **第 1–2 战（常规追捕者）**：从扩充后的契约追捕者池按通缉等级抽选对手 + 1 个环境词缀（如「高税底池」「半盲公共区」「高频加注协议」）。
  - **战间整备驿站**：用富余算力购买「修复核心算力」「新增诱饵护壳」「刷新技能三选一」或「洗去通缉隐患」。
  - **第 3 战（赏金精英 / Boss 变体）**：高压机制战，击败后大幅提升赏金积分并写入本地最高连胜纪录（`mingan_bounty_records_v1`）。
- **真正发挥「伪装诱饵」机制价值**：在无尽模式中明确强化“本体被击穿即结束本轮 Run，佩戴诱饵战败可保命继战但损耗诱饵”的刺激博弈感。

#### 2. P2P 好友联机体验与竞技深度升级
- **战前「轻技能规则」房间大厅**（[P2pLobbyModal.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/P2pLobbyModal.tsx) & [p2pProtocol.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/p2pProtocol.ts)）：
  - 房主创建房间时可选择 **「纯正统双花色局」** 或 **「1+1 轻协议局（双方开局各选 1 作弊 + 1 辅助）」**，由房主权威校验并同步配置，防客机篡改。
- **快捷战术气泡与表情轮盘**：联机对局中提供 6–8 个赛博短句与角色表情一键发送（已存在 `CHAT_MSG` 与 `EXPRESSION_SYNC` 封包基础上做 UI 快捷按钮），提升好友互骗心理战乐趣。
- **WebRTC TURN 配置与断线重连演练**：在联机弹窗中提供更友好的对称 NAT / 校园网中继引导与实时包延迟监控。

---

### Phase M4 · 商业化资产独立、视听打磨与发行准备

**目标**：清除全部原型测试资产与外链强依赖，满足 Web 正式发布与 Steam（Tauri/Electron）上架规范。

1. **原创契约卡池替换外部测试资产**：
   - 将 `public/cards/` 下的 6 份 `夜糖事务所-契约卡-*.json` 替换为 **6–8 位《黑域协议》原创追捕者/黑客角色卡**（保留对玩家本地手动导入 JSON/PNG 角色卡的兼容接口，但不随仓库捆绑第三方版权/测试素材）。
   - 为原有自由牌桌角色补齐匹配 Pixel Cyber OS 画风的多表情立绘。
2. **动态多层程序化 BGM 与音频控制升级**（扩展 [soundEngine.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/soundEngine.ts)）：
   - 保持零大体积 MP3 依赖的 Web Audio 合成优势，编写 **5 组低占空比无缝循环音景**：`desktop-hum`（Win98 主机风扇与硬盘底噪）、`terminal-boot`（冷冽脉冲序列）、`table-calm`（常规低音贝斯赛博律动）、`table-tension`（高危险/Boss 压迫感脉冲）、`vn-echo`（柔和合成器琶音）。
   - 在桌面开始菜单、终端设置和局内配置面板中拆分为 **主音量 / BGM / SFX** 三滑块，并接入 `visibilitychange` 切后台自动静音。
3. **档案图鉴与成就库（`/codex`）**：
   - 支持回顾已解锁角色档案、已通关章节 VN 剧本重播（跳过重打流程）、15+ 项技能词典与收集型成就（如「无作弊击溃凌翡」「SEC-04 零回溯挑战」「四条 A 之夜」等）。
4. **完全离线化与桌面端打包**：
   - 将 [index.html](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/index.html) 依赖的 `DotGothic16` / `Silkscreen` / `VT323` / `JetBrains Mono` / `Noto Sans SC` 裁剪并转为 `public/fonts/*.woff2` 随包静态托管。
   - 抽离 UI 文案表支持 **`zh-CN` / `en-US`** 双语切换（重点保持英语版也能体现“黑域术语 + 双花色简称 + 规则说明”清晰可读）。
   - 评估使用 **Tauri v2** 封装轻量 Windows/macOS 客户端（单包体积小、与 `MINGAN-OS 98` 启动器契合度极高），预留存档导入/导出 JSON 与 Steam 云存档适配层。

---

## 四、实施顺序与工程质量硬性检查点

### 推荐执行节奏（Vertical Slices）
1. **第 1 步（立即）**：执行 **M0** -> 更新 `package.json` 测试集 + 跑通全量检验 + 提交当前桌面/终端/鼠标版本到 Git。
2. **第 2 步（短期优先）**：执行 **M1** -> `EXIT-RL` 正式尾声 VN + 通关后「维心」解锁消息 -> 彻底把第一章体验打磨成可直接公开试玩的精品正式序章/Demo。
3. **第 3 步（双线并行推进）**：
   - 主创剧本/美术推进 **M2**（第二章共情碎片大纲、4 名新节点角色设定与立绘差分）；
   - 系统侧先行落地 **M3-1**（无尽替壳悬赏模式）与 **M4-1/2**（离线字体 + BGM 音景），保证期间始终有可玩新内容产出。
4. **第 4 步（商业化前夜）**：完成 **M2** 终局检验 + **M3-2**（P2P 带技）+ **M4-3/4**（图鉴 + 双语 + Tauri 桌面封包）。

### 每次迭代必守红线（Quality Checkpoints）
- **玩法与防泄密铁律**：`两对 > 同花` 不可动摇；双方算力 + 底池 + `hackEscrowPot` 严格守恒；`sanitizeStateForGuest` 与 LLM 状态摘要绝不泄露暗牌、未翻公共槽、火符下标或未抓获暗改原牌。
- **前端工程铁律**（由 `tests/uiQuality.test.ts` 自动化守护）：
  - `src/` 与 `index.html` 绝对零 Unicode Emoji（所有图标全部通过 `CyberIcons.tsx` 像素 SVG 绘制）；
  - 严禁调用原生 `alert / confirm / prompt`；
  - 所有 `<button>` / `<input>` / `<select>` / `<textarea>` 控件必须携带唯一 `id`（且须排在含 `=>` 的事件属性之前）；
  - 每次合并前必过：`npm test && npx tsc --noEmit && npx vite build`。
