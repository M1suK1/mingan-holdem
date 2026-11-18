# M1 实施设计方案：SEC-04 逃脱至现实电脑、仇恨之书续写与双弹窗事件流

> \*\*需求范围\*\*：本方案聚焦 \*\*Phase M1 核心主线收官闭环\*\*——从击破 `SEC-04` 抵达 `EXIT-RL` 现实出口自动退回 `MINGAN-OS 98` 桌面开始，依次完成 \*\*「引导查看仇恨之书 -> 新增逃生感想条目 -> 右下黑域协议网弹窗 -> 关闭后弹出维心（林龙心）消息弹窗」\*\* 的完整演出链路。

\---

## 一、端到端状态流转总览

```text
\[Sec04VictoryModal] 点击「断开牌桌 · 逃往 EXIT-RL 现实出口」
   │  (保留 SEC-04 -> EXIT-RL 的路线图突围钻缝动画，不跳过过渡)
   ▼
\[EscapeRouteMapView] 玩家信标穿过最后封锁墙抵达 EXIT-RL
   │  触发一次性「物理链路熔断 · 终端自动关闭」过场 (\~1.5s，支持点击快进)
   ▼
自动关闭黑域终端 ─▶ 切回 Windows 像素桌面 (viewMode = 'desktop')
   │  设置 m1EndingStage = 'guide-hatred'
   ▼
\[桌面引导阶段] 高亮引导玩家点击「仇恨之书.txt」
   │  图标脉冲光圈 + 气泡标签提示 + 底部快速打开按钮（兼容单/双击）
   ▼
\[仇恨之书.txt - 记事本] 打开窗口，底部显示【新增条目】按钮
   │  点击 #hatred-btn-add-entry ─▶ 追加并滚动展示第 4 段第一人称逃生感想（再三强调别碰黑域协议网）
   │  状态切至 'entry-written'，约 1.3s 后（或提前关闭记事本时立即）触发下一阶段
   ▼
\[右下弹窗 1：黑域协议网] #desktop-popup-blackdomain 从右下角任务栏上方弹出
   │  内容：黑域协议网官方通缉通知 // 猎杀榜 NO.1 绑定公告（就算断连逃回现实也已被全网追捕）
   │  点击关闭 (X / 关闭通知)
   ▼
\[右下弹窗 2：维心 · 林龙心] #desktop-popup-wexin-longxin 紧接弹出
   │  头像：林龙心常服立绘与差分 (resolveLinLongxinCasualSprite / longxin-casual/\*.webp) + 维心粉红框体
   │  内容：刚听说黑河闸门炸了，提醒玩家别再单独硬扛、埋下后续联络与再会线索
   │  点击关闭 ─▶ 进入 'completed'（后续点击桌面「维心」可随时重看该条最新消息）
```

\---

## 二、分步详细设计

### 步骤 1：SEC-04 抵达出口 -> 路线图突围 -> 终端自动关闭回到桌面

1. **恢复终段路线图突围动画（**[**src/App.tsx**](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/App.tsx#L6785-L6794)**）**

   * 目前点击 `Sec04VictoryModal` 的 `onConfirmEscape` 时直接套用了 `completeEscapeTransition(markEscapeNodeCleared(prev, 4))`，导致 `SEC-04 -> EXIT-RL` 的钻缝路线图动画被瞬间跳过。
   * **调整方案**：改为仅调用 `markEscapeNodeCleared(prev, 4)`，并置标 `sec04ExitPendingDisconnectRef = true`（或通过比较 `completeEscapeTransition` 前后 `prev.pendingTransition?.toIndex === 5` 识别首次抵达出口）。
   * 切到 `escape-map` 后，玩家会亲眼看到信标从 `SEC-04` 撞破最后一道红色封锁墙钻缝抵达绿色 **`EXIT-RL`** 节点。
2. **到达 `EXIT-RL` 触发终端自动关闭演出（**[**src/components/EscapeRouteMapView.tsx**](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/EscapeRouteMapView.tsx) **+** [**src/App.tsx**](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/App.tsx)**）**

   * 当 `fromIndex: 4 -> toIndex: 5` 过渡完成（或通过 `CMD next` 首次将 `SEC-04` 推至 `escapedReality: true`）时：

     * 将 `EscapeRouteMapView` 底部调试口吻文案 `ESCAPE COMPLETE // 突围测试闭环完成` 同步替换为正式文案：`CHAPTER 1 CLEARED // 现实逃脱完成`。
     * 触发全屏轻量 **「黑域终端强行断连 / SHUTTING DOWN」** 过场遮罩（约 `1450ms`，`prefers-reduced-motion` 下缩至 `200ms`，同时允许点击跳过按钮立刻返回）：

       * 展示状态：`EXIT-RL LINK SEVERED // 正在强制关闭黑域协议网终端并切回本地宿主系统 MINGAN-OS 98...`
       * 播放提示音效（`wall-hit` / `skill` 或 `ui-click`）。
     * 计时结束自动执行：

       * 将桌面持久化状态中的 `m1EndingStage` 置为 `'guide-hatred'`（**注意**：保留玩家之前拖放好的图标网格坐标与 `minganRestored` 状态，绝不重置桌面排版！）。
       * 将 `viewMode` 切换为 `'desktop'`，黑域终端自动关闭，玩家自然回到 `MINGAN-OS 98` 电脑桌面。
   * **防死锁保证**：自动跳转仅在**首次完成 `SEC-04 -> EXIT-RL` 到达瞬间**触发一次；之后玩家若手动通过 `黑域协议网.lnk` -> `/continue map` 重看路线图，仍可正常浏览已通关的路线图界面并选择「重看 / 重置 / 自由牌桌」。

\---

### 步骤 2：桌面引导点击《仇恨之书》

1. **引导表现（**[**src/components/WindowsDesktopView.tsx**](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/WindowsDesktopView.tsx) **+** [**src/styles/pixelCyberOs.css**](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/styles/pixelCyberOs.css)**）**

   * 当桌面检测到 `m1EndingStage === 'guide-hatred'` 时：

     * 自动选中 `#desktop-decor-hatred-book`（`仇恨之书.txt`），并对其挂载高亮类名 `.is-m1-guided-target`（品红/青双色脉冲像素框 + 图标旁浮动微型指示牌 `\[!] 点击打开记事本`）。
     * 桌面底部状态栏自动显示醒目引导条（与既有 `.px-desktop-status-pill` 一致）：
`已安全拔线退回现实桌面 · 请打开「仇恨之书.txt」记录这次劫后余生` + 快捷直达按钮 `#desktop-btn-quick-open-hatred`（`打开仇恨之书`），保证无论双击桌面图标还是单击快捷按钮都能顺滑打开。
   * 玩家打开 `#desktop-window-hatred-book` 后，窗口聚焦到最前，引导光圈自动收起。

\---

### 步骤 3：《仇恨之书》新增“新增条目”按钮与第一人称逃生感想日记

1. **记事本窗口交互扩展（`#desktop-window-hatred-book`）**

   * 原有 3 篇日记保留不动（维心损友安利 -> 十二分钟惨案 -> 退游立誓）。
   * 当 `escapedReality === true` 且尚未追加逃后条目（`!hatredBookEscapeEntryAdded`）时：

     * 记事本底部工具栏新增高对比度主按钮（`id="hatred-btn-add-entry"` 置于最前属性位，符合 `uiQuality.test.ts` 规范）：
**`+ 新增条目`**（在刚刚抵达桌面引导状态下可附带柔和脉冲边框提示点击）。
     * 记事本状态标签同步提示：`可追加新日记`。
2. **点击「新增条目」生成的第 4 篇第一人称日记文案（示例草稿，可供审阅微调）**

   * 时间戳：`此刻 // 从零号闸门拔线逃回现实`
   * 正文（第一人称口吻，衔接前 3 篇与 SEC-00 \~ SEC-04 实感经历）：

> 「我现在坐在电脑桌前，手心全是冷汗，指尖还在发抖。原本只是不服气被人十二分钟清零算力，才咬牙从回收站里把黑域协议网重新点开想讨个说法……结果谁能想到这一脚直接踩进了黑河企业的底层猎杀网里！一路上应付完那些把算力当命抽的疯子，最后在零号闸门对着四张烧红的火符和对面压死人的黑曜同花顺，脑子都快停机了。如果不是壳里那道奇怪的声音在最后半秒强行帮我重写成四条 A 抢回一条生路，今天我早就交代在网线那头了。能把终端狠狠切断逃回自己的 Windows 桌面，简直跟重新活了一回一样——这次我是真认栽了，也是真长记性了：\*\*别碰黑域协议网！不管谁再吹得天花乱坠，这辈子也绝对、永远、再也别碰黑域协议网！\*\*」

* 点击按钮后：

  * 播放清脆打字/落笔确认音效（`playSound` 回调或 `onPlayUiClick`）；
  * 状态立即持久化：`hatredBookEscapeEntryAdded = true`（以后再打开 `仇恨之书.txt` 第 4 篇会一直存在）；
  * 记事本内容区自动平滑滚动到底部展示新生成的条目，按钮切换为已记录状态（隐藏或显示 `已归档最新逃生记录`）；
  * 置标 `m1EndingStage = 'blackdomain-pending'`，在约 **`1300ms`** 后（留给玩家扫读最后两句“再也别碰黑域协议网”的反差伏笔时间；若玩家在 `1.3s` 内主动关闭记事本，也立即清定时器弹出黑域弹窗，不漏触发）自动弹出右下角 **黑域协议网弹窗**！

\---

### 步骤 4：右下角「黑域协议网」弹窗 -> 关闭后弹出「维心 · 林龙心」消息弹窗

两个弹窗统一定位于桌面 **右下角任务栏正上方**（`right: 16px; bottom: 54px`，桌面端宽约 `380px`，移动端 `<=768px` 全宽自适应贴底安全区），采用 Win98 双层硬朗像素斜边窗体，不遮挡中左侧桌面视图，且各自仅通过专属关闭按钮关闭，保证严格顺序演出：

#### 弹窗 A：右下「黑域协议网」官方通知弹窗（`#desktop-popup-blackdomain`）

* **视觉特征**：暗红/品红警戒边线 + 标题栏 `\[NetrunnerBrandLogo] 黑域协议网 // 官方协议通知`，配关闭按钮 `#desktop-popup-blackdomain-close`（`X`），弹出时触发 `popup-alert` 系统通知音效。
* **弹窗内容**（表明玩家已成功脱离追捕进入日常，同时代号已取代原猎杀榜第一位置）：

  * **标签**：`MINGAN-NET OFFICIAL NOTICE // 榜单变更通告`
  * **标题**：`【官方通知】猎杀榜 NO.1 席位更替`
  * **正文**：

    * 零号离线闸门（SEC-04）突围记录已归档，当前节点追捕序列已解除并进入现实静默状态。
    * 经 **黑域协议网官方榜单仲裁** 核验：终端 **`{codename}`** 已正式取代原榜首，登顶全网 **「猎杀榜 NO.1」**。本次排名变更已在全区公开公告栏同步刷新。
  * **底部操作**：`关闭通知`（`#desktop-popup-blackdomain-dismiss`）。

#### 弹窗 B：右下「维心 · 林龙心」消息弹窗（`#desktop-popup-wexin-longxin`）

* **触发时机**：当且仅当玩家点击关闭弹窗 A（`X` 或 `#desktop-popup-blackdomain-dismiss`）后 **立即弹出**，同步触发 `wexin-ping` 聊天消息铃声。
* **视觉特征**：`维心` 专属赛博粉红高光窗体（`#FF2E88 / #FF8DC0`），标题栏 `\[PixelWexinIcon] 维心 // 收到 1 条新消息`，内嵌 **林龙心常服惊讶差分头像**（`./assets/story/longxin-casual/surprise.webp`）。
* **消息正文**（完全没搞明白现状的好友日常约见）：

  * **发信人**：`林龙心` · `刚刚 · 维心桌面端`
  * **气泡消息**：

    * 「等等等等……是我熬夜看错眼了吗？！我几个小时前明明刚在暗道里跟传闻中的『榜一』零小姐打了一场还输了个精光——」
    * 「怎么我刚摘下头显刷新一下公开榜单，原先那个榜一名字没了，热乎乎挂在『猎杀榜 NO.1』顶上的……变成你的代号『`{codename}`』了啊？！！你前几天不是还骂骂咧咧说再也不碰黑域了吗？！」
    * 「我现在脑子全打结了，下班别急着跑！老地方奶茶店或者街角拉面馆随便你挑，今晚出来见一面给我好好交代清楚到底发生了什么呀！」
  * **底部按钮**：`收下消息`（`#desktop-popup-wexin-close`）。
* **关闭收尾**：

  * 将 `m1EndingStage` 置为 `'completed'` 并持久化；
  * 此后桌面上的 `维心` 图标状态升级：若再次双击桌面 `维心` 图标，不再提示“暂无可用对话”，而是可以重新唤醒查看林龙心的这条最新维心消息卡片（为后续 M2 正式聊天交互铺路）。

\---

## 三、持久化数据与文件改动清单

### 1\. 持久化状态扩展（[src/engine/desktopState.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/desktopState.ts)）

扩展 `DesktopPersistedState`（保持向后兼容，旧存档缺省自动补默认）：

```ts
export type M1EndingStage =
  | 'none'
  | 'guide-hatred'
  | 'entry-written'
  | 'blackdomain-popup'
  | 'wexin-popup'
  | 'completed';

export interface DesktopPersistedState {
  minganRestored: boolean;
  iconCells: Record<string, GridCell>;
  hatredBookEscapeEntryAdded?: boolean;
  m1EndingStage?: M1EndingStage;
}
```

* **重置策略**：

  * 仅在用户主动触发 **「重置本地存档进度」**（Start Menu / `/new confirm`）时连同 `resetDesktopPersistedState` 一并清零；
  * 若用户在通关后的逃亡路线图点击「从 SEC-00 重新体验逃亡循环」，只重置 `m1EndingStage: 'none'`（保留图标拖拽与正常开启状态），方便二周目重打到 SEC-04 时完整再体验一次 M1 流程。

### 2\. 涉及文件清单

1. [src/engine/desktopState.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/engine/desktopState.ts)：持久化字段 `hatredBookEscapeEntryAdded` 与 `m1EndingStage` 解析/保存，提供辅助函数 `triggerM1PostEscapeDesktopState()`。
2. [src/components/EscapeRouteMapView.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/EscapeRouteMapView.tsx)：`EXIT-RL` 文案脱敏为第一章正式通关文案，新增终端自动断开全屏提示条及自动切回桌面触发逻辑。
3. [src/App.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/App.tsx)：

   * `Sec04VictoryModal` 的 `onConfirmEscape` 保留 `4 -> 5` 动画；
   * `handleCompleteEscapeTransition` / `CMD next` 首次到达 `EXIT-RL` 时写入桌面 M1 引导状态并在短过场后自动切回 `viewMode = 'desktop'`；
   * 将 `escapedReality` 与 `playerCodename` 等必要上下文传入 `WindowsDesktopView`。
4. [src/components/WindowsDesktopView.tsx](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/components/WindowsDesktopView.tsx)：

   * 桌面引导高亮 `仇恨之书.txt`；
   * 记事本追加 `#hatred-btn-add-entry`（「新增条目」）按钮及第 4 段逃生感想日记渲染/滚动；
   * 新增 `#desktop-popup-blackdomain`（黑域协议网右下警告弹窗）与 `#desktop-popup-wexin-longxin`（维心·林龙心右下消息弹窗）严格串联；
   * 通关后点击桌面粉红「维心」可重温林龙心消息。
5. [src/styles/pixelCyberOs.css](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/src/styles/pixelCyberOs.css)：引导脉冲框、记事本新增按钮与高亮新条目样式、右下角双弹窗 Win98 样式与移动端适配、自定义像素光标覆盖。
6. [tests/desktopLauncher.test.ts](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/tests/desktopLauncher.test.ts) \& [package.json](file:///G:/DS/DSH/Project-DSH/ST/mingan-holdem/package.json)：补全 M1 持久化与状态转换单测，并将新测试文件正式纳入 `npm test`。

\---

## 四、质量门禁与验证标准

* **UI 质量红线**：零 Emoji、零 `window.alert/confirm`、所有新增按钮 `id` 排在最前（`#hatred-btn-add-entry`、`#desktop-btn-quick-open-hatred`、`#desktop-popup-blackdomain-close`、`#desktop-popup-blackdomain-dismiss`、`#desktop-popup-wexin-close`）。
* **手工走查流程**（配合 `CMD win / next` 快速通至 `SEC-04` 后）：

  1. `SEC-04` 绝命覆写「四条 A」胜出 -> 点击「逃往 EXIT-RL 现实出口」 -> 观看信标钻缝到达 `EXIT-RL`；
  2. 触发短暂断连过场后自动关闭终端切回电脑桌面（且此前拖动的桌面图标位置及已还原的快捷方式不丢失）；
  3. 确认 `仇恨之书.txt` 有引导高亮与提示条 -> 打开记事本可见「新增条目」按钮；
  4. 点击「新增条目」生成第 4 段第一人称逃生日记并强调别碰黑域协议网；
  5. 右下弹出黑域协议网官方通知弹窗 -> 关闭该弹窗后紧接着在右下弹出林龙心（含常服差分头像）的维心消息弹窗。
* **自动化检查**：`npm test`、`node --test --experimental-strip-types tests/\*.test.ts`、`npx tsc --noEmit`、`npx vite build` 全部通过。

