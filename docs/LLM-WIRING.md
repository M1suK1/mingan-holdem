# LLM 接入方案：操作（决策）与对话（台词）

本文件记录「接入 LLM 操作与对话」这一阶段的分层设计、约束与验收口径。

## 1. 三层目标

| 层 | 能力 | 落点 |
| --- | --- | --- |
| 观察层 | 让模型「看得见」牌桌，且只看得见它该看见的东西 | `src/engine/llmActionSpace.ts` |
| 动作层 | 让模型「动得了」：合法动作空间由引擎谓词推导，而非提示词猜测 | `src/engine/llmActionSpace.ts` + `llmClient.ts` |
| 对话层 | 让模型「说得出」：玩家问话回应 + 关键事件主动挑衅 | `src/engine/llmClient.ts` + `App.tsx` |

## 2. 观察层：不泄密是硬约束

`serializeStateForLlm` 只允许经由 `getVisibleBoardCard` / `getVisibleHandCard` 取牌面，禁止直接读 `slot.card` / `hc.card`。

新增「技能遥测块」，内容仅限模型自身可感知的信息：

- 本轮是否已用黑客技能、是否已用扫描（`usedHackThisTurn` / `usedScanThisTurn`）
- 自身被封印的技能列表（`sealedSkills`）
- **预支托管池只暴露「存在」不暴露「数额」**：`hackEscrowPot` 不进入提示词，仅提示「存在未公开的预支托管算力，不计入公开奖池」。原因：托管池里同时含对手预支，暴露数额等同于泄露对手是否用了技能。
- 扫描目标只给索引与「公开/私有」标签，绝不附带私有牌面。

## 3. 动作层：合法空间即白名单

`enumerateLlmActionSpace(state)` 逐个用 `isActionLegal` 过滤候选，因此：

- 差额未补齐时（`diff > 0`）只给 `call` / `fold` / `raise`，并附注「必须先补齐差额才能使用扫描与黑客技能」——对应此前确立的博弈性规则。
- 差额为 0 时才展开 `hack`（自身明牌为目标，受点数上下界、封印、算力、每回合一次限制）与 `scan`（对手手牌索引目标 / 对手换入的已翻开公共牌槽位，受每回合一次与已扫描去重限制）。
- `raise` 以 `computeThreeRaisePresets` 压缩成 3 个数值，避免把整段区间丢给模型做算术。

模型返回的动作必须再过一遍 `isActionLegal`；不合法 → 带纠正信息重试；重试耗尽 → 回退本地策略核，并写入审计日志（`ok: false`），绝不静默。

## 4. 对话层：同一通道、同一物理动画

- 玩家问话：走 `requestOpponentChatReply`，携带最近 8 条聊天记忆。
- 主动台词：`ChatTrigger` 描述事件（摊牌胜负 / 被扫描抓获 / 抓到对手篡改 / 技能被封印 / 对手大额加注），由 `requestOpponentChatReply` 的 `trigger` 分支生成用户消息。
- 所有台词一律经由 App 既有的 FIFO 语音队列 `enqueueTask` 入队，保证跌落、压缩、堆叠动画与本地台词完全一致。
- 主动台词有冷却（同一手牌内同类事件只触发一次），避免刷屏。
- 反诈约束：黑客技能成功后的台词必须模糊，不得描述具体改动；扫描结果台词不得泄露被扫目标的牌面细节。

## 5. 预设与世界书（对齐 night-sugar-office）

### 5.1 补全预设 `src/engine/llmPreset.ts`

沿用 SillyTavern 的 ChatPreset 结构，落地本作需要的子集：

| 能力 | 说明 |
| --- | --- |
| 词条（PromptEntry） | 名称、角色、正文、启停、用途（共用 / 出牌决策 / 对话回应 / 主动台词）、顺序 |
| 输出契约 | `contract: true` 的词条永远是 system 的最后一段，避免模型把 JSON 契约埋在世界观里 |
| 采样参数 | temperature / top_p / max_tokens / presence_penalty / frequency_penalty，按预设独立保存 |
| 预设管理 | 新建、复制、删除、导入 JSON、导出 JSON（导出格式可被 SillyTavern 直接读取） |
| 出厂预设 | 默认 · 黑域牌桌 / 低延迟 · 简洁 / 戏剧化 · 高发散 |

编辑器位于 LLM 终端的「补全预设」页签，改动实时写入 localStorage 并立即生效。

### 5.2 世界书 `src/engine/worldbook.ts`

与 SillyTavern 的 World Info 同构：

- 常驻词条（`constant`）每次必发；其余按关键词命中当前触发文本后注入。
- 注入顺序：`priority` 降序、`order` 升序，预算默认 1600 字符（可在网关页调整），超预算条目被丢弃并在预览中列出。
- 出厂词条覆盖：黑域协议、双花色牌组、牌型重排、公共节点池、换牌协议、加注与半池、黑客技能三式、扫描协议、预支托管、结算与封印、台词守则。
- `wb-role-profile` 由当前契约卡实时生成，只读；切换契约卡即自动更新。
- 支持导入 / 导出 SillyTavern 世界书 JSON。

### 5.3 宏 `src/engine/promptMacros.ts`

`{{char}}`、`{{state}}`、`{{pot}}`、`{{diff}}`、`{{board}}`、`{{hand}}`、`{{skill_state}}`、`{{legal_actions}}`、`{{trigger}}`、`{{worldbook}}` 等 22 个宏；未识别的宏原样保留并计入 `missing`，不会让整条提示词失效。

### 5.4 编排 `src/engine/llmPrompt.ts`

`composeOpponentPrompt()` 固定分层：正文词条（按预设顺序）→ 世界书兜底 → 输出契约（永远最后），并返回命中的世界书条目、宏使用情况与采样参数，供 UI 预览与审计。


## 6. 降级策略

任一链路失败（禁用 / 超时 / HTTP 错误 / 非法 JSON / 非法动作）都在本地完成两件事：

1. 决策：交回 `LocalAiAgent.decide`。
2. 对话：交回 `generateLocalPersonaReply` 或事件对应的本地语料模板。

降级不会抛出、不会阻塞回合推进，且必定在 LLM 审计日志中留痕。

## 7. 验收

- `npx tsc --noEmit` 零错误。
- 新增 `tests/llmWire.test.ts`（19 项）覆盖：动作空间包含 hack/scan、封印与每回合一次限制、扫描目标过滤、观察块不泄露私有牌面与托管数额、预设按场景裁剪、契约永远垫底、世界书常驻/命中/预算丢弃、预设与世界书导入导出往返、非法动作重试与回退、配置规范化。
- 既有测试全绿（≥ 23 项），`npx vite build` 成功。
