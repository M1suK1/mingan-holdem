# 角色打牌动作与立绘表情对应总览（已同步最新规范）

> **整理依据**：直接汇总并同步自代码实现（`src/engine/aiAgent.ts`、`src/App.tsx`、`src/engine/llmClient.ts`、`src/engine/contractCards.ts`、`src/engine/presets.ts`）。  
> **核心约束**：**`angry` 仅用于「遭到玩家加注挑衅后反加注（re-raise）」以及「单轮结算损失大量算力（净损失 `>= 300`）」这两种被激怒场景**；日常主动加注、扫描与常规跟注均改用 `smile` 或 `calm`。

---

## 一、全角色通用的 6 套表情差分键名

| 表情标识 | 界面标签（`EXPRESSION_META`） | 提示词语义（`presets.ts`） |
| :--- | :--- | :--- |
| `calm` | 平静（`SYNC_STABLE`） | 心率平稳、冷静审视桌面数据流 |
| `smile` | 微笑（`CONFIDENCE_UP`） | 自信得意、握有强牌、主动加注/扫描或诱导设陷 |
| `surprise` | 惊讶（`SIGNAL_SPIKE`） | 遭遇意外加注、All-in 或平局/异变 |
| `sad` | 低落（`LINK_DRAIN`） | 算力常规受损、败局弃牌或小额输池 |
| `angry` | 激怒（`ICE_ALERT`） | **仅在遭到反加注挑衅或单轮损失大量算力（`>= 300`）时露出怒色** |
| `shy` | 动摇（`FLUCTUATION`） | 被迫退让、偷鸡被看穿或节奏被打乱 |

---

## 二、通用打牌动作 → 表情映射表（`LocalAiAgent.decide` · 未开 LLM 或本地回退时）

| 打牌动作 | 触发分支条件 | 当前对应表情 | 内部 `mood` | 代码位置 |
| :--- | :--- | :---: | :---: | :--- |
| **换牌（`swap`）** | 把「NULL 抹除空牌」换入公共暗牌槽 | **`smile`** | `thinking` | `aiAgent.ts:709-719` |
| **换牌（`swap`）** | `phantom-hacker` / `null-erase` 主动隐藏改过的牌 | **`smile`** | `thinking` | `aiAgent.ts:737-747` |
| **换牌（`swap`）** | 常规换弱牌入暗牌槽 | **`smile`** | `thinking` | `aiAgent.ts:1103-1112` |
| **翻牌（`flip`）** | 免费翻开 1 张未公开公共牌 | **`calm`** | `idle` | `aiAgent.ts:1158-1167` |
| **加注（`raise`）** | 河牌阶段大师半池超频加注（主动施压） | **`smile`** | `confident` | `aiAgent.ts:874-884` |
| **加注（`raise`）** | 河牌阶段常规价值加注 / 诈唬加注（主动） | **`smile`** | `confident` | `aiAgent.ts:908-918` |
| **反加注（`raise`）** | 河牌面对玩家加注（`diff > 0`）直接反加 | **`angry`** | `tense` | `aiAgent.ts:957-966` |
| **反加注（`raise`）** | 前/中段面对玩家加注（`diff > 0`）高胜率反加 | **`angry`** | `tense` | `aiAgent.ts:1016-1047` |
| **加注（`raise`）** | 前/中段常规主动加注（`diff === 0`） | **`smile`** | `confident` | `aiAgent.ts:1145-1154` |
| **过牌（`check`）** | 河牌阶段无差额过牌 | **`calm`** | `idle` | `aiAgent.ts:919-928` |
| **结束回合（`end-turn`）** | 跟注后暂不改牌直接让过 | **`calm`** | `idle` | `aiAgent.ts:1079-1088` |
| **跟注（`call`）** | 河牌面对加注跟注，且估算胜率 `> 0.62` | **`smile`** | `confident` | `aiAgent.ts:969-978` |
| **跟注（`call`）** | 河牌面对加注跟注，且估算胜率 `<= 0.62` | **`calm`** | `thinking` | `aiAgent.ts:969-978` |
| **跟注（`call`）** | 前/中段跟注将导致自身或对手 All-in | **`surprise`** | `tense` | `aiAgent.ts:1002-1012` |
| **跟注（`call`）** | 前/中段普通跟注，且估算胜率 `> 0.65` | **`smile`** | `confident` | `aiAgent.ts:1049-1058` |
| **跟注（`call`）** | 前/中段普通跟注，且估算胜率 `<= 0.65` | **`calm`** | `thinking` | `aiAgent.ts:1049-1058` |
| **弃牌（`fold`）** | 河牌阶段赔率不足弃牌 | **`sad`** | `defeat` | `aiAgent.ts:941-951` |
| **弃牌（`fold`）** | 前/中段受压弃牌 | **`shy`** | `surprised` | `aiAgent.ts:989-999` |
| **扫描（`scan`）** | 主动消耗算力扫描验证玩家手牌/换入公共牌 | **`smile`** | `confident` | `aiAgent.ts:818-828` |
| **通用黑客改牌（`hack`）** | 使用 `+1` / `-1` / `反色` | **`calm`** | `idle` | `aiAgent.ts:851-860` |

---

## 三、小局结算 & 自由/系统事件表情切换（`App.tsx` + `llmClient.ts` + `contractCards.ts`）

| 触发时机 | 条件 | 当前对应表情 | 代码位置 |
| :--- | :--- | :---: | :--- |
| **小局结算（摊牌/弃牌/抓包）** | `AI` 赢下本小局底池（`winner === 'ai'`） | **`smile`** | `contractCards.ts:320-332` |
| **小局结算（摊牌/弃牌/抓包）** | 玩家赢下本小局，且 AI 本轮净损失 `< 300` 算力 | **`sad`** | `contractCards.ts:320-332` |
| **小局结算（摊牌/弃牌/抓包）** | 玩家赢下本小局，且 **AI 本轮净损失 `>= 300` 算力** | **`angry`** | `contractCards.ts:320-332` |
| **小局结算（摊牌）** | 双方完全平局分池 | **`surprise`** | `contractCards.ts:320-332` |
| **重开整局 / 退出回默认态** | 开局初始化或重置牌桌 | **`calm`** | `App.tsx:524, 2627, 2704, 2821` |
| **自由模式切换角色卡 / 导入卡片** | 刚切到新对手出场打招呼 | **`smile`** | `App.tsx:3651, 3700` |
| **本地聊天关键字回复** | 聊及「诱饵/追捕」或「投降/加注」未开 LLM 时 | **`calm` / `smile`** | `llmClient.ts:436-459` |
| **LLM 回退事件：追捕者降临** | `pursuer-arrive`（未开 LLM） | **`calm`** | `llmClient.ts:857-861` |
| **LLM 回退事件：追捕者败北** | `pursuer-defeated`（未开 LLM） | **`sad`** | `llmClient.ts:862-865` |
| **LLM 回退事件：玩家诱饵脱逃** | `decoy-escape`（未开 LLM） | **`surprise`** | `llmClient.ts:866-870` |
| **LLM 回退事件：剥离玩家本体** | `core-seized`（未开 LLM） | **`smile`** | `llmClient.ts:871-874` |

> **注（LLM 模式启用时）**：`presets.ts` 中的 `EXPRESSION_GUIDE` 已同步约束模型仅在「被迫反加注」或「单轮损失大量算力 `>= 300`」时输出 `angry`。

---

## 四、分角色现状明细（含专属技能 & 剧情节点表情）

### 1. `SEC-00` 匿名终端 // `ECHO-0`（教学对手）
- **教学专属动作**（`App.tsx:1636-1665`）：
  - **开局默认**：`calm`
  - **执行 `hack`（故意漏出 `+1` 破绽）**：**`smile`**
  - **执行 `flip` / `raise`**：沿用上一帧表情
- **小局/教学末被玩家扫描清零**：切换为 **`surprise`**

### 2. `SEC-01` 凌翡 // `JADE-01`（实名财阀千金）
- **开场视觉小说播完切入牌桌**：**`calm`**（`App.tsx:3198`）
- **专属作弊技 `crown-ace`（钦定王牌）**：**`smile`**
- **整场算力归零（`clearedIdx === 1`）**：切换为 **`surprise`**
- **普通打牌动作**：主动加注与扫描切 **`smile`**、跟注切 **`smile` / `calm` / `surprise`**、弃牌 **`shy` / `sad`**；唯有**被玩家加注激怒反加注**或**单局亏损 `>= 300` 算力**时切 **`angry`**。

### 3. `SEC-02` 芙兰 // `MUTE-02`（失声双刃算力猎手）
- **开场视觉小说播完切入牌桌**：**`angry`**（`App.tsx:3208`）
- **专属作弊技 `null-erase`（信息抹除）**：**`calm`**；把 `NULL` 空牌换入公共区：**`smile`**
- **整场算力归零（`clearedIdx === 2`）**：切换为 **`sad`**
- **普通打牌动作**：主动 `raise` 与 `scan` 为 **`smile`**，唯有**反加注**或**单局亏损 `>= 300`** 时切 **`angry`**。

### 4. `SEC-03` 粉红软软龙 // `NEON-03`（霓虹心脸盲同事）
- **开场视觉小说播完切入牌桌**：**`smile`**（`App.tsx:3218`）
- **专属作弊技 `pink-double`（双粉映象）**：**`smile`**
- **整场算力归零（`clearedIdx === 3`）**：按小局结算规则（常规 `sad`，单轮亏损 `>= 300` 为 `angry`）
- **普通打牌动作**：
  - `raise`（主动加注）/ `scan` / `swap`：**`smile`**
  - 反加注（被玩家加注逼出反加时）：**`angry`**
  - `flip` / `check` / `end-turn` / 普通 `hack`：**`calm`**
  - `call`：视胜率/All-in 显示 **`smile` / `calm` / `surprise`**
  - `fold`：前中段 **`shy`**，河牌 **`sad`**

### 5. `SEC-04` 绯凪·千夜 // `KIRI-04`（黑河反黑客安全官）
- **专属作弊技 `mikiri-counter`（见切·燕返）**：**`calm`**
- **普通打牌动作**：主动 `raise` / `scan` / `swap` 为 **`smile`**，`flip` / `check` / `call`(弱) 为 **`calm`**，唯有**反加注**与**单局亏损 `>= 300` 算力**切 **`angry`**。

### 6. 玩家左下角头像立绘（`storyPlayerEntity`）
- 仅按剩余算力阈值变化：`chips === 0` 为 **`sad`**，`0 < chips <= 160` 为 **`surprise`**，`chips > 160` 为 **`calm`**。
