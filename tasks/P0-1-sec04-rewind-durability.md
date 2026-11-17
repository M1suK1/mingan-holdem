# P0-1 · SEC-04 回溯按钮耐久度磨损与碎裂失效

- **日期**：2026-11-17
- **来源**：`PLAN.md` P0 · SEC-04 终极 Boss 战多阶段高潮演出（第 1 项）
- **目标**：在 SEC-04 对局中随玩家多次使用「时间回溯」，按钮呈现四阶段状态演进（`100% -> 72% -> 48% -> 按钮碎裂失效`），并在界面给出清晰裂纹与算力通道告警反馈。

---

## 一、设计方案

### 1. 状态与耐久演进（`src/engine/rewindHold.ts`）
- 仅在 **SEC-04 剧情 Boss 战**（`isSec04 = true`）启用耐久度磨损；`SEC-00` ~ `SEC-03` 保持 `100%` 完整无损耗。
- 四阶段耐久度映射（按本场 SEC-04 已触发回溯次数 `sec04RewindUses`）：
  - `uses = 0`：`stage = 'intact'`，`durabilityPct = 100`，`warningLevel = 'none'`
  - `uses = 1`：`stage = 'cracked-1'`，`durabilityPct = 72`，`warningLevel = 'warn'`（轻度裂纹 + 通道损耗告警）
  - `uses = 2`：`stage = 'cracked-2'`，`durabilityPct = 48`，`warningLevel = 'critical'`（深度裂纹 + 临界过载告警）
  - `uses >= 3`：`stage = 'shattered'`，`durabilityPct = 0`，`isShattered = true`，`warningLevel = 'failed'`（按钮碎裂失效）
- 第 3 次发动回溯时：先完成本次时间线回退（确保玩家不会在 0 算力状态被永久锁死），随后按钮耐久立即归零并碎裂失效；此后在本次 SEC-04 对局中禁用点按回溯、长按重开及 CMD `rewind`，等待后续 P0-2 Boss 暴走与 P0-3 摊牌破局衔接；若通过路线图重新进入 SEC-04 节点或执行 `reset`/`resetprofile`，耐久度恢复至 `100%`。

### 2. 界面裂纹与算力通道告警反馈
- **按钮本体（`#hud-btn-rewind`）**：
  - 增加 `data-durability-stage` 与 `data-durability-pct` 状态属性及对应样式类（`is-durability-cracked-1` / `is-durability-cracked-2` / `is-durability-shattered`）。
  - 新增纯像素 SVG 裂纹叠层 `PixelRewindCrackOverlay`（`src/components/CyberIcons.tsx`，严格零 Emoji），随 `cracked-1 -> cracked-2 -> shattered` 逐级加深裂纹与破损像素点。
  - 新增按钮底部像素耐久度进度条 `.lc-rewind-durability-bar` 与主/副标签动态文案（含百分比与告警提示，确保桌面与移动端均清晰可见）。
  - 碎裂后图标切换为 `PixelSeverIcon`，按钮进入 `disabled` 碎裂态。
- **算力通道告警反馈**：
  - 在 `ComputePoolBar`（`#lc-pool-slot`）激活已预留的 `statusLabel` / `statusWarn` 渲染通道告警角标，实时同步显示 `通道 72%` / `过载 48%` / `通道碎裂`。
  - 在每次阶段跌落时触发对应 Toast 告警、ECHO-0 对话槽提示与新增 Web Audio 音效（`rewind-crack` / `rewind-shatter`）。

### 3. 遗留与衔接（为 P0-2 / P0-3 预留）
- 在 `App.tsx` 中维护清晰的 `sec04RewindUses` 与 `sec04RewindDurability` 状态，后续 P0-2 可直接监听 `sec04RewindDurability.isShattered` 触发绯凪·千夜暴走（4/4 全火符 + 高频加注）。

---

## 二、测试先行清单（TDD）
1. `tests/rewindHold.test.ts`：
   - 校验四阶段耐久度数值与状态演进（`100% -> 72% -> 48% -> 0% shattered`）；
   - 校验非 SEC-04 节点始终保持 `100%` 完整；
   - 校验碎裂后 `resolveRewindTapAction` 返回 `'shattered'` / 阻止触发，`getRewindButtonMeta` 返回 `disabled: true`、碎裂文案与通道告警字段；
   - 校验长按判定在碎裂态下不会启动或生效。
2. `tests/soundEngine.test.ts`：
   - 校验新增音效 `rewind-crack` 与 `rewind-shatter` 在无 AudioContext 环境下安全降级。
3. `tests/uiQuality.test.ts`：
   - 保持零 Emoji、无原生弹窗、唯一控件 ID、故事/自由牌桌按钮分离门禁全绿。

---

## 三、执行日志与验收记录
- [2026-11-17 15:26] 创建 `tasks/` 目录与本任务记录文档，完成现状代码核查与方案设计。
- [2026-11-17 15:27] TDD 红灯：在 `tests/rewindHold.test.ts`、`tests/soundEngine.test.ts`、`tests/uiQuality.test.ts` 补齐四阶段耐久演进、碎裂禁用、音效降级与 DOM 属性门禁测试，确认预期失败。
- [2026-11-17 15:30] 实现交付：
  - `src/engine/rewindHold.ts`：新增 `SEC04_REWIND_DURABILITY_STEPS`、`SEC04_MAX_REWIND_USES`、`getSec04RewindDurability`，扩展 `resolveRewindTapAction` 与 `getRewindButtonMeta`（向后兼容非 SEC-04 节点）。
  - `src/engine/soundEngine.ts`：新增 `rewind-crack` 与 `rewind-shatter` 程序化 Web Audio 音效。
  - `src/components/CyberIcons.tsx`：新增纯像素 SVG 裂纹叠层 `PixelRewindCrackOverlay`（无 Emoji）。
  - `src/components/ComputePoolBar.tsx`：激活 `statusLabel` / `statusWarn` 渲染算力通道告警角标 `.lc-pool-status-alert`。
  - `src/App.tsx`：接入 `sec04RewindUses` 状态与 `sec04RewindUsesRef`、三阶段回溯磨损与碎裂锁死逻辑、`rewind` CMD 同步、按钮裂纹/耐久条渲染与通道告警联动。
  - `src/styles/pixelCyberOs.css`：新增第 24 节 SEC-04 回溯按钮裂纹、碎裂虚线边框、耐久进度条及 `lcChannelCriticalPulse` 告警闪烁样式（同步兼容 `prefers-reduced-motion`）。
- [2026-11-17 15:32] 最终验收全部通过：
  - `npm test`：25 个套件 / 113 项测试全部通过（0 失败）。
  - `npx tsc --noEmit`：退出码 0，零类型错误。
  - `npx vite build`：成功构建 `dist/` 分包产物（2.94s）。
