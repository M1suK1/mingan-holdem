# 游戏开始界面设计方案：黑域协议网终端登录界面（Terminal Login）

> 基于 **UI/UX Pro Max** 规范与《黑域协议：替壳者》**Pixel Cyber OS** 视觉系统制定。

---

## 1. 整体流转定位（Desktop -> Terminal Login -> Arena）

将当前开局与启动链路闭环串联为三段式完整体验：
```text
全新存档首次打开 ─▶ Windows 像素电脑桌面 ('desktop')
                        └─ 回收站还原「黑域协议网.lnk」到桌面 ─▶ 双击图标连接
                                                                        ▼
老存档刷新直接打开 ────────────────────────────────────────▶ 终端登录开始界面 ('terminal-login')
                                                                        ├─ /help    查看指令帮助
                                                                        ├─ /new     新建逃亡档案 (/new confirm 防误删)
                                                                        ├─ /continue 继续当前进度 (SEC-00 ~ EXIT-RL / 路线图)
                                                                        ├─ /save    多槽位加密存档写入 / 读取 / 删除
                                                                        ├─ /settings 打开设置菜单或直达指定配置面板
                                                                        └─ /desktop 断开终端返回 MINGAN-OS 桌面
```
- **开局默认判定**：
  - 全新存档（未通关 `SEC-00`）：先呈现 `desktop`，还原并双击 `黑域协议网.lnk` 后进入 `terminal-login`（游戏开始界面）。
  - 已有进度存档：刷新游戏直接进入 `terminal-login`（游戏开始界面），方便第一时间点击/输入 `/continue` 接续进度或进行多存档切换。

---

## 2. 视觉布局与 UI/UX 规范对齐

### 2.1 界面分层与主视觉 Hero（终端控制台框）
居中的全息终端工作台容器（`width: min(920px, calc(100vw - 28px))`，高占视口安全区，零圆角 `border-radius: 0`，深渊黑底 `#04070e` 叠加像素栅格与细微扫描线）：

1. **顶部栏（TTY Title Bar）**
   - 左侧显示进程标识：`MINGAN_NET // TTY-01 :: AUTH_GATEWAY`
   - 右侧显示当前侦测档案状态标签（如 `ARCHIVE: NEW_SHELL` 或 `ARCHIVE: SEC-02 · 3/5 CLEARED`）及代号徽标。
2. **Hero 身份展示区（Logo + 游戏名）**
   - **黑域协议主 Logo (`MinganProtocolHeroLogo`)**：32x32 精绘像素 SVG，结合品红 (`#FF2E88`) 外框协议印记、荧光青 (`#00F0FF`) 双花色交叉电路与脉冲扫描光泽（尊重 `prefers-reduced-motion`）。
   - **游戏主标题**：采用 `.lc-glitch-title` 与 `--px-ghost-hero` 双色散重影呈现 **「黑域协议：替壳者」**，副标题显示 **`MINGAN PROTOCOL // BLACK_DOMAIN ACCESS TERMINAL`**。
   - **首屏显性指引提示**：紧接标题区下方高亮显示引导横幅：`[SYSTEM] 输入 /help 获取终端指令帮助 · 支持键盘直接输入或点击下方指令芯片`。
3. **中部终端日志回显区（TTY Output Feed）**
   - 初始自动展示简明登录握手信息与 `/help` 指引，不阻塞输入（若用户急着输入指令，随时可打断直接提交）。
   - 支持等宽像素/Monospace 混排，不同消息带语义前导符与颜色（系统 `[SYS]` 青色、成功 `[OK]` 翡翠绿、警告/确认 `[WARN]` 琥珀色、错误 `[ERR]` 危险红、用户输入 `root@mingan:~#` 亮白）。
   - 调用 `/help` 或 `/save` 时，直接在终端日志内以整齐的像素等宽表格输出，同时保留滚动浏览。
4. **底部 CLI 输入区 + 无障碍快捷指令芯片**
   - 命令行输入栏：`id="terminal-login-input"`，前缀固定提示符 `root@mingan:~#`，支持：
     - `Enter` 提交指令
     - `ArrowUp / ArrowDown` 翻阅历史输入指令
     - `Tab` 自动补全常见 `/help`、`/new`、`/continue`、`/save`、`/load`、`/settings` 等指令
   - 执行按钮：`id="terminal-login-submit"`（`执行`）。
   - **快捷引导指令芯片条**（遵循 UI/UX Pro Max 键盘+单点双通路原则，确保手机端或不想打字的玩家零阻碍游玩）：
     - `/help`（查看帮助）
     - `/continue`（继续游戏 — 无可用进度时友好提示可改用 `/new`）
     - `/new`（新游戏）
     - `/save`（存档管理）
     - `/settings`（系统设置）
     - `/desktop`（返回桌面）

---

## 3. 终端指令与存档机制详细设计

### 3.1 核心指令表

| 指令 | 别名 | 作用说明 | 交互与防误操作机制 |
|---|---|---|---|
| `/help` | `help`, `/?` | 打印全部终端指令帮助、快捷键说明（`Tab` 补全 / 上下键历史）与开局建议 | 直接打印在终端日志流中 |
| `/new` | `new` | 开启全新逃亡档案，并切入 `SEC-00` 公共暗区野桌 | 若当前本地已有进度（已过 `SEC-00`），先打印警告提示玩家输入 `/new confirm`（或点击行内确认芯片）防止手滑覆盖进度 |
| `/continue` | `/cont`, `/play`, `/start` | 读取当前进度接入游戏（支持 `/continue map` 直接进逃亡路线图） | 若暂无任何推进记录则自动提示改为开启新游戏（或一键接入 `SEC-00` 新手引导） |
| `/save` | `save` | 查看 3 个加密记忆存档槽（`SLOT-1 ~ SLOT-3`）与自动实时档状态 | 无参数打印存档槽表；输入 `/save <1|2|3> [备注]` 立即将当前实时进度快照存入对应槽位 |
| `/load <1|2|3>` | `load` | 从指定加密存档槽读取快照覆盖当前进度，随后可直接 `/continue` 进入 | 校验槽位是否存在，不存在或损坏给出清晰红字提示与恢复建议 |
| `/delete <1|2|3>` | `/del`, `/rm` | 删除指定手动存档槽（不影响实时自动档），支持 `/delete <n> confirm` 二次确认 | 保护玩家快照防误删 |
| `/settings` | `/set`, `/config` | 打开系统集成设置菜单，或直达子项：`/settings sound`、`/settings llm`、`/settings preset`、`/settings rules`、`/settings tuning`、`/settings p2p`、`/settings cmd` | 直接复用项目现有全套设置弹窗，配置修改实时持久生效 |
| `/clear` | `cls` | 清屏终端历史输出 | 保留开屏品牌头与 `/help` 提示行 |
| `/desktop` | `exit` | 返回 `MINGAN-OS` 像素电脑桌面 | — |

### 3.2 本地多槽位存档数据结构（`src/engine/terminalLogin.ts`）
使用独立存储键 `mingan_terminal_save_slots_v1` 管理 3 个用户手动槽位（与自动保存的 `mingan_escape_map_v1`、`mingan-cyber-holdem:campaign:v1` 解耦又互通）：
```ts
export interface TerminalSaveSlot {
  slotId: 1 | 2 | 3;
  label: string;
  savedAt: string;
  nodeCode: string;        // 例如 "SEC-02" / "EXIT-RL"
  clearedCount: number;    // 0..5
  escapedReality: boolean;
  playerCodename: string;
  escapeProgress: EscapeMapProgress;
  campaign: CampaignState;
}
```
- `/save` 输出示例包含：槽位编号、自定义备注/默认节点名、通关数、保存时间、快捷操作指令提醒（`/save 1` 覆盖、`/load 1` 读取）。

---

## 4. 模块改造清单与测试覆盖

| 文件路径 | 改造内容 |
|---|---|
| `src/engine/terminalLogin.ts` | 纯 TS 终端指令解析器、多槽位存档读写持久化、`TerminalCommandResult` 状态机（零 DOM 依赖，便于单元测试） |
| `src/components/CyberIcons.tsx` | 新增 `MinganProtocolHeroLogo`（32x32 像素精绘主视觉 Logo） |
| `src/components/TerminalLoginView.tsx` | 终端登录界面组件（Hero Logo、系统日志流、支持 `Tab` 补全与历史翻阅的命令行输入框、快捷指令芯片与存档槽交互卡片） |
| `src/engine/tutorialSpotlight.ts` | 将 `viewMode` 联合类型扩展为 `'desktop' \| 'terminal-login' \| 'arena' \| 'escape-map'` |
| `src/App.tsx` | 接入 `'terminal-login'` 阶段（桌面双击 `黑域协议网.lnk` -> 终端登录；老存档默认进终端登录）；桥接 `/new`、`/continue`、`/load`、`/settings` 与设置菜单「返回终端登录」 |
| `src/styles/pixelCyberOs.css` | 终端登录框、发光 Hero 标题、TTY 日志着色、命令行光标闪烁、指令芯片与窄屏适配样式 |
| `tests/terminalLogin.test.ts` + `tests/uiQuality.test.ts` | 验证 `/help`、`/new` 二次确认保护、`/continue`、`/save 1~3` / `/load` / `/delete`、`Tab` 补全、零 Emoji 与唯一 `id` 门禁 |

---

请确认以上设计方案，确认后我随即按此方案开始编码实现。
