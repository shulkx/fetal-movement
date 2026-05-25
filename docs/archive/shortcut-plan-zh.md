# Apple 快捷指令：记录胎动 — 完整搭建计划

> 已合并所有 Review 修改的最终版本。

---

## 0. 前期准备（手动操作）

在 iPhone「文件」App 中创建：

```
iCloud 云盘
└── Shortcuts
    └── FetalMovement
        └── fetal_movement_state.json
```

文件初始内容：

```json
{
  "schema_version": 1,
  "has_active_cycle": false,
  "active_cycle": {},
  "completed_cycles": []
}
```

---

## 1. 读取 JSON 文件

### 模块 1：获取文件

动作：**获取文件**

| 设置         | 值                                                |
| ------------ | ------------------------------------------------- |
| 服务         | iCloud 云盘                                        |
| 文件路径     | Shortcuts/FetalMovement/fetal_movement_state.json  |
| 显示文稿选取器 | 关闭                                             |
| 如果未找到则出错 | 开启                                           |

> 如果没有"服务"选项，直接填路径：`FetalMovement/fetal_movement_state.json`
> （默认从 iCloud 云盘 / Shortcuts 文件夹下查找）

---

### 模块 2：获取文件的内容

动作：**获取文件的内容**

输入：模块 1 的结果。

---

### 模块 3：从输入中获取词典

动作：**从输入中获取词典**

输入：模块 2 的结果。

接着：

动作：**设定变量**

| 名称  | 值                           |
| ----- | ---------------------------- |
| State | 从输入中获取词典的结果          |

---

## 2. 获取当前时间

### 模块 4：当前日期

动作：**当前日期**

接着：**设定变量** → `Now`

---

### 模块 5：格式化日期

动作：**格式化日期**

| 设置     | 值        |
| -------- | --------- |
| 输入     | Now       |
| 日期格式 | ISO 8601  |

> 如果没有 ISO 8601 选项，使用自定格式：`yyyy-MM-dd'T'HH:mm:ssZZZZZ`

接着：**设定变量** → `NowText`

---

## 3. 检查 has_active_cycle

### 模块 6：获取词典值

动作：**获取词典值**

| 设置 | 值               |
| ---- | ---------------- |
| 获取 | has_active_cycle |
| 从   | State            |

接着：**设定变量** → `HasActiveCycle`

---

### 模块 7：如果

动作：**如果**

| 条件                          |
| ----------------------------- |
| 如果 HasActiveCycle 等于 false |

结构：

```
如果 HasActiveCycle == false：
    → 分支 A：创建新周期
否则：
    → 分支 B：获取 ActiveCycle，检查是否过期
```

---

# 分支 A：没有活跃周期 — 创建新周期

---

## A1. 创建第一个有效胎动对象

### 模块 A1-1：计算 window_end_at

动作：**调整日期**

| 设置     | 值      |
| -------- | ------- |
| 日期     | Now     |
| 添加     | 5 分钟  |

接着：**格式化日期** → ISO 8601

接着：**设定变量** → `WindowEndText`

---

### 模块 A1-2：创建有效胎动词典

动作：**词典**

| 键             | 类型 | 值            |
| -------------- | ---- | ------------- |
| effective_id   | 文本 | NowText       |
| effective_at   | 文本 | NowText       |
| window_end_at  | 文本 | WindowEndText |
| sub_movements  | 数组 | （空数组）     |

> `sub_movements`：添加一个类型为"数组"的键，里面不放任何内容。

接着：**设定变量** → `FirstEffectiveMovement`

---

## A2. 创建新周期对象

### 模块 A2-1：计算 scheduled_end_at

动作：**调整日期**

| 设置 | 值      |
| ---- | ------- |
| 日期 | Now     |
| 添加 | 1 小时  |

接着：**格式化日期** → ISO 8601

接着：**设定变量** → `ScheduledEndText`

---

### 模块 A2-2：创建 effective_movements 列表

动作：**列表**

列表项：
- `FirstEffectiveMovement`

接着：**设定变量** → `EffectiveMovements`

---

### 模块 A2-3：创建周期词典

动作：**词典**

| 键                  | 类型 | 值                 |
| ------------------- | ---- | ------------------ |
| cycle_id            | 文本 | NowText            |
| started_at          | 文本 | NowText            |
| scheduled_end_at    | 文本 | ScheduledEndText   |
| effective_count     | 数字 | 1                  |
| total_count         | 数字 | 1                  |
| effective_movements | 数组 | EffectiveMovements |

接着：**设定变量** → `NewCycle`

---

## A3. 写入 State

动作：**设定词典值**

| 设置 | 值           |
| ---- | ------------ |
| 在   | State        |
| 将   | active_cycle |
| 设为 | NewCycle     |

接着：**设定变量** → `State`

---

动作：**设定词典值**

| 设置 | 值                 |
| ---- | ------------------ |
| 在   | State              |
| 将   | has_active_cycle   |
| 设为 | true（布尔值）      |

接着：**设定变量** → `State`

---

## A4. 保存文件 + 通知 + 停止

动作：**文本**

> 搜索「文本」，在内容区域放入魔法变量 `State`。
> Shortcuts 会自动将词典序列化为 JSON 文本。

接着：**设定变量** → `OutputJSON`

---

动作：**存储文件**

| 设置         | 值                                           |
| ------------ | -------------------------------------------- |
| 文件         | OutputJSON                                   |
| 位置         | iCloud 云盘 / Shortcuts / FetalMovement       |
| 文件名       | fetal_movement_state.json                    |
| 询问存储位置 | 关闭                                          |
| 覆盖已有文件 | 开启                                          |

---

动作：**显示通知**

```
已开启新周期，并记录为有效胎动。
有效胎动：1 次
总记录：1 次
```

---

动作：**停止此快捷指令**

---

# 分支 B：有活跃周期 — 模块 7 的「否则」内部

---

## B1. 获取 ActiveCycle

### 模块 B1-0：获取 active_cycle

动作：**获取词典值**

| 设置 | 值           |
| ---- | ------------ |
| 获取 | active_cycle |
| 从   | State        |

接着：**设定变量** → `ActiveCycle`

---

### 模块 B1-1：获取 started_at

动作：**获取词典值**

| 设置 | 值          |
| ---- | ----------- |
| 获取 | started_at  |
| 从   | ActiveCycle |

接着：**设定变量** → `CycleStartedAtText`

---

## B2. 计算周期已持续时间

### 模块 B2-1：获取日期间的时间

动作：**获取日期间的时间**

| 设置     | 值                 |
| -------- | ------------------ |
| 开始日期 | CycleStartedAtText |
| 结束日期 | Now                |
| 单位     | 分钟               |

接着：**设定变量** → `CycleAgeMinutes`

---

## B3. 判断周期是否过期

### 模块 B3-1：如果

动作：**如果**

| 条件                               |
| ---------------------------------- |
| 如果 CycleAgeMinutes 大于或等于 60  |

结构：

```
如果 CycleAgeMinutes >= 60：
    → 分支 B3-A：归档旧周期，询问用户
否则：
    → 分支 B3-B：继续记录到当前周期
```

---

# 分支 B3-A：周期已过期（>= 60 分钟）

---

## B3-A1. 归档旧周期

动作：**获取词典值**

| 设置 | 值               |
| ---- | ---------------- |
| 获取 | scheduled_end_at |
| 从   | ActiveCycle      |

接着：**设定变量** → `ScheduledEndAtText`

---

动作：**设定词典值**

| 设置 | 值                 |
| ---- | ------------------ |
| 在   | ActiveCycle        |
| 将   | ended_at           |
| 设为 | ScheduledEndAtText |

接着：**设定变量** → `CompletedCycle`

---

动作：**设定词典值**

| 设置 | 值             |
| ---- | -------------- |
| 在   | CompletedCycle |
| 将   | close_reason   |
| 设为 | expired        |

接着：**设定变量** → `CompletedCycle`

---

## B3-A2. 追加到 completed_cycles

动作：**获取词典值**

| 设置 | 值               |
| ---- | ---------------- |
| 获取 | completed_cycles |
| 从   | State            |

接着：**设定变量** → `CompletedCycles`

---

动作：**添加到变量**

| 设置   | 值             |
| ------ | -------------- |
| 将     | CompletedCycle |
| 添加到 | CompletedCycles |

---

## B3-A3. 清空 State 中的活跃周期

动作：**设定词典值**

| 设置 | 值               |
| ---- | ---------------- |
| 在   | State            |
| 将   | completed_cycles |
| 设为 | CompletedCycles  |

接着：**设定变量** → `State`

---

动作：**设定词典值**

| 设置 | 值                 |
| ---- | ------------------ |
| 在   | State              |
| 将   | has_active_cycle   |
| 设为 | false（布尔值）     |

接着：**设定变量** → `State`

---

动作：**设定词典值**

| 设置 | 值           |
| ---- | ------------ |
| 在   | State        |
| 将   | active_cycle |
| 设为 | （空词典）    |

> 创建一个空的「词典」动作，将其作为值传入。

接着：**设定变量** → `State`

---

## B3-A4. 询问用户

动作：**从菜单中选取**

提示文字：

```
上一个胎动周期已结束。
是否用本次点击开启新的 1 小时周期？
```

菜单项：
1. `开启新周期并记录`
2. `不记录，仅结束上个周期`

---

### 菜单项 1：开启新周期并记录

> 重复分支 A 的全部逻辑（A1 → A2 → A3 → A4）。

**A1**：创建 `WindowEndText`、`FirstEffectiveMovement`

**A2**：创建 `ScheduledEndText`、`EffectiveMovements` 列表、`NewCycle` 词典

**A3**：设定 `State.active_cycle = NewCycle`，设定 `State.has_active_cycle = true`

**A4**：保存文件。

通知：

```
已开启新周期，并记录为有效胎动。
有效胎动：1 次
总记录：1 次
```

接着：**停止此快捷指令**

---

### 菜单项 2：不记录，仅结束上个周期

保存当前 State（其中旧周期已归档、活跃周期已清空）：

动作：**文本** → 内容区域放入魔法变量 `State`

动作：**存储文件** → `fetal_movement_state.json`，覆盖已有文件

动作：**显示通知**

```
上一个周期已结束，本次未记录。
```

接着：**停止此快捷指令**

---

# 分支 B3-B：周期未过期（< 60 分钟）— B3 的「否则」内部

---

## B3-B1. 获取 effective_movements

动作：**获取词典值**

| 设置 | 值                  |
| ---- | ------------------- |
| 获取 | effective_movements |
| 从   | ActiveCycle         |

接着：**设定变量** → `EffectiveMovements`

---

## B3-B2. 获取最后一个有效胎动

动作：**从列表中获取项目**

| 设置 | 值                 |
| ---- | ------------------ |
| 列表 | EffectiveMovements |
| 获取 | 最后一个项目        |

接着：**设定变量** → `LastEffectiveMovement`

---

## B3-B3. 获取最后有效胎动时间

动作：**获取词典值**

| 设置 | 值                    |
| ---- | --------------------- |
| 获取 | effective_at          |
| 从   | LastEffectiveMovement |

接着：**设定变量** → `LastEffectiveAtText`

---

## B3-B4. 计算距最后一次有效胎动的分钟数

动作：**获取日期间的时间**

| 设置     | 值                  |
| -------- | ------------------- |
| 开始日期 | LastEffectiveAtText |
| 结束日期 | Now                 |
| 单位     | 分钟                |

接着：**设定变量** → `MinutesSinceLastEffective`

---

## B3-B5. 获取当前计数

动作：**获取词典值**

| 设置 | 值              |
| ---- | --------------- |
| 获取 | effective_count |
| 从   | ActiveCycle     |

接着：**设定变量** → `EffectiveCount`

---

动作：**获取词典值**

| 设置 | 值          |
| ---- | ----------- |
| 获取 | total_count |
| 从   | ActiveCycle |

接着：**设定变量** → `TotalCount`

---

动作：**计算**

| 表达式         |
| -------------- |
| TotalCount + 1 |

接着：**设定变量** → `NewTotalCount`

---

## B3-B6. 判断是否为子胎动

### 模块：如果

动作：**如果**

| 条件                                      |
| ----------------------------------------- |
| 如果 MinutesSinceLastEffective 小于 5      |

结构：

```
如果 < 5：
    → 分支 C1：记录为子胎动
否则：
    → 分支 C2：记录为新的有效胎动
```

---

# 分支 C1：子胎动（< 5 分钟）

---

## C1-1. 获取 sub_movements（含空数组防御）

动作：**获取词典值**

| 设置 | 值                    |
| ---- | --------------------- |
| 获取 | sub_movements         |
| 从   | LastEffectiveMovement |

接着：**设定变量** → `SubMovements`

---

### 空数组防御

动作：**如果**

| 条件                            |
| ------------------------------- |
| 如果 SubMovements 没有任何值     |

**如果成立：**

动作：**列表**（创建空列表，不放任何内容）

接着：**设定变量** → `SubMovements`

**结束如果**

---

## C1-2. 追加当前时间到 sub_movements

动作：**添加到变量**

| 设置   | 值           |
| ------ | ------------ |
| 将     | NowText      |
| 添加到 | SubMovements |

---

## C1-3. 更新 LastEffectiveMovement

动作：**设定词典值**

| 设置 | 值                    |
| ---- | --------------------- |
| 在   | LastEffectiveMovement |
| 将   | sub_movements         |
| 设为 | SubMovements          |

接着：**设定变量** → `UpdatedLastEffectiveMovement`

---

## C1-4. 替换 effective_movements 中的最后一个项目

### 子分支：如果 EffectiveCount 等于 1

动作：**如果**

| 条件                          |
| ----------------------------- |
| 如果 EffectiveCount 等于 1     |

**如果成立（只有 1 个有效胎动）：**

动作：**列表**

列表项：
- `UpdatedLastEffectiveMovement`

接着：**设定变量** → `UpdatedEffectiveMovements`

---

**否则（有多个有效胎动）：**

动作：**从列表中获取项目**

| 设置 | 值                 |
| ---- | ------------------ |
| 列表 | EffectiveMovements |
| 获取 | 范围内的项目        |
| 从   | 第 1 个项目        |
| 到   | 倒数第 2 个项目     |

接着：**设定变量** → `UpdatedEffectiveMovements`

---

动作：**添加到变量**

| 设置   | 值                           |
| ------ | ---------------------------- |
| 将     | UpdatedLastEffectiveMovement |
| 添加到 | UpdatedEffectiveMovements    |

> 注意：「添加到变量」会原地修改变量，之后**不需要**再「设定变量」。

**结束如果**

---

## C1-5. 更新 ActiveCycle

动作：**设定词典值**

| 设置 | 值                        |
| ---- | ------------------------- |
| 在   | ActiveCycle               |
| 将   | effective_movements       |
| 设为 | UpdatedEffectiveMovements |

接着：**设定变量** → `ActiveCycle`

---

动作：**设定词典值**

| 设置 | 值            |
| ---- | ------------- |
| 在   | ActiveCycle   |
| 将   | total_count   |
| 设为 | NewTotalCount |

接着：**设定变量** → `ActiveCycle`

> 子胎动**不改变** effective_count。

---

## C1-6. 写回 State

动作：**设定词典值**

| 设置 | 值          |
| ---- | ----------- |
| 在   | State       |
| 将   | active_cycle |
| 设为 | ActiveCycle |

接着：**设定变量** → `State`

---

## C1-7. 保存文件 + 通知 + 停止

动作：**文本** → 内容区域放入魔法变量 `State`

接着：**设定变量** → `OutputJSON`

---

动作：**存储文件**

| 设置         | 值                                          |
| ------------ | ------------------------------------------- |
| 文件         | OutputJSON                                  |
| 位置         | iCloud 云盘 / Shortcuts / FetalMovement      |
| 文件名       | fetal_movement_state.json                   |
| 询问存储位置 | 关闭                                         |
| 覆盖已有文件 | 开启                                         |

---

动作：**显示通知**

```
已记录为子胎动，不计入有效胎动次数。
有效胎动：[EffectiveCount] 次
总记录：[NewTotalCount] 次
```

> 将 `[EffectiveCount]` 和 `[NewTotalCount]` 替换为魔法变量。

---

动作：**停止此快捷指令**

---

# 分支 C2：新的有效胎动（>= 5 分钟）— B3-B6 的「否则」内部

---

## C2-1. 创建新的有效胎动对象

动作：**调整日期**

| 设置 | 值      |
| ---- | ------- |
| 日期 | Now     |
| 添加 | 5 分钟  |

接着：**格式化日期** → ISO 8601

接着：**设定变量** → `WindowEndText`

---

动作：**词典**

| 键             | 类型 | 值            |
| -------------- | ---- | ------------- |
| effective_id   | 文本 | NowText       |
| effective_at   | 文本 | NowText       |
| window_end_at  | 文本 | WindowEndText |
| sub_movements  | 数组 | （空数组）     |

接着：**设定变量** → `NewEffectiveMovement`

---

## C2-2. 追加到 effective_movements

动作：**添加到变量**

| 设置   | 值                   |
| ------ | -------------------- |
| 将     | NewEffectiveMovement |
| 添加到 | EffectiveMovements   |

---

## C2-3. 计算新的 effective_count

动作：**计算**

| 表达式             |
| ------------------ |
| EffectiveCount + 1 |

接着：**设定变量** → `NewEffectiveCount`

---

## C2-4. 更新 ActiveCycle

动作：**设定词典值**

| 设置 | 值                  |
| ---- | ------------------- |
| 在   | ActiveCycle         |
| 将   | effective_movements |
| 设为 | EffectiveMovements  |

接着：**设定变量** → `ActiveCycle`

---

动作：**设定词典值**

| 设置 | 值                |
| ---- | ----------------- |
| 在   | ActiveCycle       |
| 将   | effective_count   |
| 设为 | NewEffectiveCount |

接着：**设定变量** → `ActiveCycle`

---

动作：**设定词典值**

| 设置 | 值            |
| ---- | ------------- |
| 在   | ActiveCycle   |
| 将   | total_count   |
| 设为 | NewTotalCount |

接着：**设定变量** → `ActiveCycle`

---

## C2-5. 写回 State

动作：**设定词典值**

| 设置 | 值          |
| ---- | ----------- |
| 在   | State       |
| 将   | active_cycle |
| 设为 | ActiveCycle |

接着：**设定变量** → `State`

---

## C2-6. 保存文件 + 通知 + 停止

动作：**文本** → 内容区域放入魔法变量 `State`

接着：**设定变量** → `OutputJSON`

---

动作：**存储文件**

| 设置         | 值                                          |
| ------------ | ------------------------------------------- |
| 文件         | OutputJSON                                  |
| 位置         | iCloud 云盘 / Shortcuts / FetalMovement      |
| 文件名       | fetal_movement_state.json                   |
| 询问存储位置 | 关闭                                         |
| 覆盖已有文件 | 开启                                         |

---

动作：**显示通知**

```
已记录为有效胎动。
有效胎动：[NewEffectiveCount] 次
总记录：[NewTotalCount] 次
```

---

动作：**停止此快捷指令**

---

# 完整结构总览

```
获取文件 → 获取文件内容 → 从输入中获取词典 → 设定变量：State
当前日期 → 设定变量：Now
格式化日期（Now）→ 设定变量：NowText

获取 State.has_active_cycle → HasActiveCycle

如果 HasActiveCycle == false
│
│   ── 分支 A ──
│   创建 WindowEndText、FirstEffectiveMovement
│   创建 ScheduledEndText、EffectiveMovements、NewCycle
│   State.active_cycle = NewCycle
│   State.has_active_cycle = true
│   保存 → 通知 → 停止
│
否则
│
│   获取 State.active_cycle → ActiveCycle
│   获取 ActiveCycle.started_at → CycleStartedAtText
│   计算 CycleAgeMinutes
│
│   如果 CycleAgeMinutes >= 60
│   │
│   │   ── 分支 B3-A ──
│   │   归档旧周期 → CompletedCycle
│   │   追加到 completed_cycles
│   │   State.has_active_cycle = false
│   │   State.active_cycle = {}
│   │
│   │   从菜单中选取
│   │   ├── "开启新周期并记录"
│   │   │   （与分支 A 相同）
│   │   │   保存 → 通知 → 停止
│   │   └── "不记录，仅结束上个周期"
│   │       保存 → 通知 → 停止
│   │
│   否则（< 60 分钟）
│   │
│   │   ── 分支 B3-B ──
│   │   获取 ActiveCycle.effective_movements → EffectiveMovements
│   │   获取最后一个项目 → LastEffectiveMovement
│   │   获取 LastEffectiveMovement.effective_at → LastEffectiveAtText
│   │   计算 MinutesSinceLastEffective
│   │   获取 EffectiveCount、TotalCount
│   │   NewTotalCount = TotalCount + 1
│   │
│   │   如果 MinutesSinceLastEffective < 5
│   │   │
│   │   │   ── 分支 C1：子胎动 ──
│   │   │   获取 sub_movements（含空数组防御）
│   │   │   追加 NowText 到 SubMovements
│   │   │   更新 LastEffectiveMovement.sub_movements
│   │   │   替换 EffectiveMovements 最后一项
│   │   │       （按 EffectiveCount == 1 与 > 1 分支处理）
│   │   │   更新 ActiveCycle（effective_movements、total_count）
│   │   │   写回 State → 保存 → 通知 → 停止
│   │   │
│   │   否则（>= 5 分钟）
│   │   │
│   │   │   ── 分支 C2：新的有效胎动 ──
│   │   │   创建 WindowEndText、NewEffectiveMovement
│   │   │   追加到 EffectiveMovements
│   │   │   NewEffectiveCount = EffectiveCount + 1
│   │   │   更新 ActiveCycle（effective_movements、
│   │   │       effective_count、total_count）
│   │   │   写回 State → 保存 → 通知 → 停止
```

---

# JSON 示例（连续点击几次后）

```json
{
  "schema_version": 1,
  "has_active_cycle": true,
  "active_cycle": {
    "cycle_id": "2026-05-25T08:00:00+08:00",
    "started_at": "2026-05-25T08:00:00+08:00",
    "scheduled_end_at": "2026-05-25T09:00:00+08:00",
    "effective_count": 2,
    "total_count": 5,
    "effective_movements": [
      {
        "effective_id": "2026-05-25T08:02:10+08:00",
        "effective_at": "2026-05-25T08:02:10+08:00",
        "window_end_at": "2026-05-25T08:07:10+08:00",
        "sub_movements": [
          "2026-05-25T08:03:05+08:00",
          "2026-05-25T08:05:40+08:00"
        ]
      },
      {
        "effective_id": "2026-05-25T08:13:30+08:00",
        "effective_at": "2026-05-25T08:13:30+08:00",
        "window_end_at": "2026-05-25T08:18:30+08:00",
        "sub_movements": [
          "2026-05-25T08:15:00+08:00"
        ]
      }
    ]
  },
  "completed_cycles": []
}
```

---

# 测试清单

在 iPhone 上按以下顺序测试：

```
测试 1：首次点击           → 新周期，有效胎动 1，总记录 1
测试 2：1 分钟内再点       → 子胎动，有效胎动 1，总记录 2
测试 3：5 分钟后再点       → 新有效胎动，有效胎动 2，总记录 3
测试 4：手动改 started_at 为 1 小时前 → 再次点击应弹出菜单
测试 5：选择"开启新周期"  → 新周期，有效胎动 1，总记录 1
测试 6：选择"不记录"      → 旧周期已归档，仅显示通知
```

全部测试通过后，再将快捷指令加入 Apple Watch。
