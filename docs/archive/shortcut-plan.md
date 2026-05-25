# Apple Shortcut: 记录胎动 — Complete Build Plan

> Modified version with all review fixes applied.

---

## 0. Initial Setup (Manual)

Create in the **Files** app:

```
iCloud Drive
└── Shortcuts
    └── FetalMovement
        └── fetal_movement_state.json
```

Initial file content:

```json
{
  "schema_version": 1,
  "has_active_cycle": false,
  "active_cycle": {},
  "completed_cycles": []
}
```

---

## 1. Read JSON File

### Module 1: Get File

Action: **Get File**

| Setting              | Value                                              |
| -------------------- | -------------------------------------------------- |
| Service              | iCloud Drive                                       |
| File Path            | Shortcuts/FetalMovement/fetal_movement_state.json   |
| Show Document Picker | OFF                                                |
| Error If Not Found   | ON                                                 |

> If no "Service" option, use path: `FetalMovement/fetal_movement_state.json`
> (defaults to iCloud Drive / Shortcuts)

---

### Module 2: Get Contents of File

Action: **Get Contents of File**

Input: result of Module 1.

---

### Module 3: Get Dictionary from Input

Action: **Get Dictionary from Input**

Input: result of Module 2.

Then:

Action: **Set Variable**

| Name  | Value                          |
| ----- | ------------------------------ |
| State | Get Dictionary from Input result |

---

## 2. Get Current Time

### Module 4: Current Date

Action: **Current Date**

Then: **Set Variable** → `Now`

---

### Module 5: Format Date

Action: **Format Date**

| Setting     | Value                             |
| ----------- | --------------------------------- |
| Input       | Now                               |
| Date Format | ISO 8601                          |

> If no ISO 8601 option, use custom: `yyyy-MM-dd'T'HH:mm:ssZZZZZ`

Then: **Set Variable** → `NowText`

---

## 3. Check has_active_cycle

### Module 6: Get Dictionary Value

Action: **Get Dictionary Value**

| Setting | Value             |
| ------- | ----------------- |
| Get     | has_active_cycle  |
| From    | State             |

Then: **Set Variable** → `HasActiveCycle`

---

### Module 7: If

Action: **If**

| Condition                       |
| ------------------------------- |
| If HasActiveCycle equals false  |

Structure:

```
If HasActiveCycle == false:
    → Branch A: create new cycle
Otherwise:
    → Branch B: get ActiveCycle, check expiry
```

---

# Branch A: No Active Cycle — Create New Cycle

---

## A1. Create First Effective Movement

### Module A1-1: Calculate window_end_at

Action: **Adjust Date**

| Setting | Value    |
| ------- | -------- |
| Date    | Now      |
| Add     | 5 Minutes |

Then: **Format Date** → ISO 8601

Then: **Set Variable** → `WindowEndText`

---

### Module A1-2: Build effective movement dictionary

Action: **Dictionary**

| Key            | Type  | Value         |
| -------------- | ----- | ------------- |
| effective_id   | Text  | NowText       |
| effective_at   | Text  | NowText       |
| window_end_at  | Text  | WindowEndText |
| sub_movements  | Array | (empty array) |

> For `sub_movements`: add a key with type Array, leave it empty.

Then: **Set Variable** → `FirstEffectiveMovement`

---

## A2. Create New Cycle Object

### Module A2-1: Calculate scheduled_end_at

Action: **Adjust Date**

| Setting | Value   |
| ------- | ------- |
| Date    | Now     |
| Add     | 1 Hour  |

Then: **Format Date** → ISO 8601

Then: **Set Variable** → `ScheduledEndText`

---

### Module A2-2: Build effective_movements list

Action: **List**

Items:
- `FirstEffectiveMovement`

Then: **Set Variable** → `EffectiveMovements`

---

### Module A2-3: Build cycle dictionary

Action: **Dictionary**

| Key                 | Type   | Value              |
| ------------------- | ------ | ------------------ |
| cycle_id            | Text   | NowText            |
| started_at          | Text   | NowText            |
| scheduled_end_at    | Text   | ScheduledEndText   |
| effective_count     | Number | 1                  |
| total_count         | Number | 1                  |
| effective_movements | Array  | EffectiveMovements |

Then: **Set Variable** → `NewCycle`

---

## A3. Write to State

Action: **Set Dictionary Value**

| Setting | Value      |
| ------- | ---------- |
| In      | State      |
| Set     | active_cycle |
| To      | NewCycle   |

Then: **Set Variable** → `State`

---

Action: **Set Dictionary Value**

| Setting | Value            |
| ------- | ---------------- |
| In      | State            |
| Set     | has_active_cycle |
| To      | true (Boolean)   |

Then: **Set Variable** → `State`

---

## A4. Save File + Notify + Stop

Action: **Get Text**

Input: `State`

Then: **Set Variable** → `OutputJSON`

---

Action: **Save File**

| Setting           | Value                                            |
| ----------------- | ------------------------------------------------ |
| File              | OutputJSON                                       |
| Destination       | iCloud Drive / Shortcuts / FetalMovement         |
| File Name         | fetal_movement_state.json                        |
| Ask Where to Save | OFF                                              |
| Overwrite         | ON                                               |

---

Action: **Show Notification**

```
已开启新周期，并记录为有效胎动。
有效胎动：1 次
总记录：1 次
```

---

Action: **Stop This Shortcut**

---

# Branch B: Active Cycle Exists — Inside the "Otherwise" of Module 7

---

## B1. Get ActiveCycle

### Module B1-0: Get active_cycle

Action: **Get Dictionary Value**

| Setting | Value        |
| ------- | ------------ |
| Get     | active_cycle |
| From    | State        |

Then: **Set Variable** → `ActiveCycle`

---

### Module B1-1: Get started_at

Action: **Get Dictionary Value**

| Setting | Value      |
| ------- | ---------- |
| Get     | started_at |
| From    | ActiveCycle |

Then: **Set Variable** → `CycleStartedAtText`

---

## B2. Calculate Cycle Age

### Module B2-1: Time Between Dates

Action: **Get Time Between Dates**

| Setting    | Value              |
| ---------- | ------------------ |
| Start Date | CycleStartedAtText |
| End Date   | Now                |
| Unit       | Minutes            |

Then: **Set Variable** → `CycleAgeMinutes`

---

## B3. Check If Cycle Expired

### Module B3-1: If

Action: **If**

| Condition                              |
| -------------------------------------- |
| If CycleAgeMinutes ≥ 60               |

Structure:

```
If CycleAgeMinutes >= 60:
    → Branch B3-A: archive old cycle, ask user
Otherwise:
    → Branch B3-B: continue recording in current cycle
```

---

# Branch B3-A: Cycle Expired (>= 60 min)

---

## B3-A1. Archive Old Cycle

Action: **Get Dictionary Value**

| Setting | Value            |
| ------- | ---------------- |
| Get     | scheduled_end_at |
| From    | ActiveCycle      |

Then: **Set Variable** → `ScheduledEndAtText`

---

Action: **Set Dictionary Value**

| Setting | Value              |
| ------- | ------------------ |
| In      | ActiveCycle        |
| Set     | ended_at           |
| To      | ScheduledEndAtText |

Then: **Set Variable** → `CompletedCycle`

---

Action: **Set Dictionary Value**

| Setting | Value          |
| ------- | -------------- |
| In      | CompletedCycle |
| Set     | close_reason   |
| To      | expired        |

Then: **Set Variable** → `CompletedCycle`

---

## B3-A2. Append to completed_cycles

Action: **Get Dictionary Value**

| Setting | Value            |
| ------- | ---------------- |
| Get     | completed_cycles |
| From    | State            |

Then: **Set Variable** → `CompletedCycles`

---

Action: **Add to Variable**

| Setting | Value                             |
| ------- | --------------------------------- |
| Add     | CompletedCycle                    |
| To      | CompletedCycles                   |

---

## B3-A3. Clear active cycle in State

Action: **Set Dictionary Value**

| Setting | Value            |
| ------- | ---------------- |
| In      | State            |
| Set     | completed_cycles |
| To      | CompletedCycles  |

Then: **Set Variable** → `State`

---

Action: **Set Dictionary Value**

| Setting | Value            |
| ------- | ---------------- |
| In      | State            |
| Set     | has_active_cycle |
| To      | false (Boolean)  |

Then: **Set Variable** → `State`

---

Action: **Set Dictionary Value**

| Setting | Value        |
| ------- | ------------ |
| In      | State        |
| Set     | active_cycle |
| To      | (empty Dict) |

> Create an empty Dictionary action and pass it as the value.

Then: **Set Variable** → `State`

---

## B3-A4. Ask User

Action: **Choose from Menu**

Prompt:

```
上一个胎动周期已结束。
是否用本次点击开启新的 1 小时周期？
```

Menu items:
1. `开启新周期并记录`
2. `不记录，仅结束上个周期`

---

### Menu Item 1: Start New Cycle

> Repeat the same logic as Branch A (A1 → A2 → A3 → A4).

**A1**: Create `WindowEndText`, `FirstEffectiveMovement`

**A2**: Create `ScheduledEndText`, `EffectiveMovements` list, `NewCycle` dict

**A3**: Set `State.active_cycle = NewCycle`, Set `State.has_active_cycle = true`

**A4**: Save file.

Notification:

```
已开启新周期，并记录为有效胎动。
有效胎动：1 次
总记录：1 次
```

Then: **Stop This Shortcut**

---

### Menu Item 2: Don't Record

Save current State (which already has the archived cycle and cleared active_cycle):

Action: **Get Text** → Input: `State`

Action: **Save File** → `fetal_movement_state.json`, Overwrite ON

Action: **Show Notification**

```
上一个周期已结束，本次未记录。
```

Then: **Stop This Shortcut**

---

# Branch B3-B: Cycle Still Active (< 60 min) — Inside "Otherwise" of B3

---

## B3-B1. Get effective_movements

Action: **Get Dictionary Value**

| Setting | Value               |
| ------- | ------------------- |
| Get     | effective_movements |
| From    | ActiveCycle         |

Then: **Set Variable** → `EffectiveMovements`

---

## B3-B2. Get Last Effective Movement

Action: **Get Item from List**

| Setting | Value              |
| ------- | ------------------ |
| List    | EffectiveMovements |
| Get     | Last Item          |

Then: **Set Variable** → `LastEffectiveMovement`

---

## B3-B3. Get Last Effective Time

Action: **Get Dictionary Value**

| Setting | Value                 |
| ------- | --------------------- |
| Get     | effective_at          |
| From    | LastEffectiveMovement |

Then: **Set Variable** → `LastEffectiveAtText`

---

## B3-B4. Calculate Minutes Since Last Effective

Action: **Get Time Between Dates**

| Setting    | Value               |
| ---------- | ------------------- |
| Start Date | LastEffectiveAtText  |
| End Date   | Now                 |
| Unit       | Minutes             |

Then: **Set Variable** → `MinutesSinceLastEffective`

---

## B3-B5. Get Current Counts

Action: **Get Dictionary Value**

| Setting | Value           |
| ------- | --------------- |
| Get     | effective_count |
| From    | ActiveCycle     |

Then: **Set Variable** → `EffectiveCount`

---

Action: **Get Dictionary Value**

| Setting | Value       |
| ------- | ----------- |
| Get     | total_count |
| From    | ActiveCycle |

Then: **Set Variable** → `TotalCount`

---

Action: **Calculate**

| Expression     |
| -------------- |
| TotalCount + 1 |

Then: **Set Variable** → `NewTotalCount`

---

## B3-B6. Check If Sub-Movement

### Module: If

Action: **If**

| Condition                                  |
| ------------------------------------------ |
| If MinutesSinceLastEffective is less than 5 |

Structure:

```
If < 5:
    → Branch C1: record as sub-movement
Otherwise:
    → Branch C2: record as new effective movement
```

---

# Branch C1: Sub-Movement (< 5 min)

---

## C1-1. Get sub_movements (with empty array defense)

Action: **Get Dictionary Value**

| Setting | Value                 |
| ------- | --------------------- |
| Get     | sub_movements         |
| From    | LastEffectiveMovement |

Then: **Set Variable** → `SubMovements`

---

### Empty Array Defense

Action: **If**

| Condition                          |
| ---------------------------------- |
| If SubMovements has no value       |

**If true:**

Action: **List** (create empty list, add nothing)

Then: **Set Variable** → `SubMovements`

**End If**

---

## C1-2. Append current time to sub_movements

Action: **Add to Variable**

| Setting | Value        |
| ------- | ------------ |
| Add     | NowText      |
| To      | SubMovements |

---

## C1-3. Update LastEffectiveMovement

Action: **Set Dictionary Value**

| Setting | Value                 |
| ------- | --------------------- |
| In      | LastEffectiveMovement |
| Set     | sub_movements         |
| To      | SubMovements          |

Then: **Set Variable** → `UpdatedLastEffectiveMovement`

---

## C1-4. Replace Last Item in effective_movements

### Sub-branch: If EffectiveCount equals 1

Action: **If**

| Condition                       |
| ------------------------------- |
| If EffectiveCount equals 1      |

**If true (only 1 effective movement):**

Action: **List**

Items:
- `UpdatedLastEffectiveMovement`

Then: **Set Variable** → `UpdatedEffectiveMovements`

---

**Otherwise (more than 1 effective movement):**

Action: **Get Item from List**

| Setting | Value                          |
| ------- | ------------------------------ |
| List    | EffectiveMovements             |
| Get     | Items in Range                 |
| From    | Item 1                         |
| To      | Second to Last Item            |

Then: **Set Variable** → `UpdatedEffectiveMovements`

---

Action: **Add to Variable**

| Setting | Value                          |
| ------- | ------------------------------ |
| Add     | UpdatedLastEffectiveMovement   |
| To      | UpdatedEffectiveMovements      |

> Note: "Add to Variable" modifies the variable in-place. Do NOT set variable again after this.

**End If**

---

## C1-5. Update ActiveCycle

Action: **Set Dictionary Value**

| Setting | Value                      |
| ------- | -------------------------- |
| In      | ActiveCycle                |
| Set     | effective_movements        |
| To      | UpdatedEffectiveMovements  |

Then: **Set Variable** → `ActiveCycle`

---

Action: **Set Dictionary Value**

| Setting | Value         |
| ------- | ------------- |
| In      | ActiveCycle   |
| Set     | total_count   |
| To      | NewTotalCount |

Then: **Set Variable** → `ActiveCycle`

> effective_count does NOT change for sub-movements.

---

## C1-6. Write Back to State

Action: **Set Dictionary Value**

| Setting | Value        |
| ------- | ------------ |
| In      | State        |
| Set     | active_cycle |
| To      | ActiveCycle  |

Then: **Set Variable** → `State`

---

## C1-7. Save File + Notify + Stop

Action: **Get Text** → Input: `State`

Then: **Set Variable** → `OutputJSON`

---

Action: **Save File**

| Setting           | Value                                    |
| ----------------- | ---------------------------------------- |
| File              | OutputJSON                               |
| Destination       | iCloud Drive / Shortcuts / FetalMovement |
| File Name         | fetal_movement_state.json                |
| Ask Where to Save | OFF                                      |
| Overwrite         | ON                                       |

---

Action: **Show Notification**

```
已记录为子胎动，不计入有效胎动次数。
有效胎动：[EffectiveCount] 次
总记录：[NewTotalCount] 次
```

> Replace `[EffectiveCount]` and `[NewTotalCount]` with magic variables.

---

Action: **Stop This Shortcut**

---

# Branch C2: New Effective Movement (>= 5 min) — Inside "Otherwise" of B3-B6

---

## C2-1. Create New Effective Movement Object

Action: **Adjust Date**

| Setting | Value     |
| ------- | --------- |
| Date    | Now       |
| Add     | 5 Minutes |

Then: **Format Date** → ISO 8601

Then: **Set Variable** → `WindowEndText`

---

Action: **Dictionary**

| Key            | Type  | Value         |
| -------------- | ----- | ------------- |
| effective_id   | Text  | NowText       |
| effective_at   | Text  | NowText       |
| window_end_at  | Text  | WindowEndText |
| sub_movements  | Array | (empty array) |

Then: **Set Variable** → `NewEffectiveMovement`

---

## C2-2. Append to effective_movements

Action: **Add to Variable**

| Setting | Value                |
| ------- | -------------------- |
| Add     | NewEffectiveMovement |
| To      | EffectiveMovements   |

---

## C2-3. Calculate new effective_count

Action: **Calculate**

| Expression         |
| ------------------ |
| EffectiveCount + 1 |

Then: **Set Variable** → `NewEffectiveCount`

---

## C2-4. Update ActiveCycle

Action: **Set Dictionary Value**

| Setting | Value              |
| ------- | ------------------ |
| In      | ActiveCycle        |
| Set     | effective_movements |
| To      | EffectiveMovements |

Then: **Set Variable** → `ActiveCycle`

---

Action: **Set Dictionary Value**

| Setting | Value             |
| ------- | ----------------- |
| In      | ActiveCycle       |
| Set     | effective_count   |
| To      | NewEffectiveCount |

Then: **Set Variable** → `ActiveCycle`

---

Action: **Set Dictionary Value**

| Setting | Value         |
| ------- | ------------- |
| In      | ActiveCycle   |
| Set     | total_count   |
| To      | NewTotalCount |

Then: **Set Variable** → `ActiveCycle`

---

## C2-5. Write Back to State

Action: **Set Dictionary Value**

| Setting | Value        |
| ------- | ------------ |
| In      | State        |
| Set     | active_cycle |
| To      | ActiveCycle  |

Then: **Set Variable** → `State`

---

## C2-6. Save File + Notify + Stop

Action: **Get Text** → Input: `State`

Then: **Set Variable** → `OutputJSON`

---

Action: **Save File**

| Setting           | Value                                    |
| ----------------- | ---------------------------------------- |
| File              | OutputJSON                               |
| Destination       | iCloud Drive / Shortcuts / FetalMovement |
| File Name         | fetal_movement_state.json                |
| Ask Where to Save | OFF                                      |
| Overwrite         | ON                                       |

---

Action: **Show Notification**

```
已记录为有效胎动。
有效胎动：[NewEffectiveCount] 次
总记录：[NewTotalCount] 次
```

---

Action: **Stop This Shortcut**

---

# Complete Structure Overview

```
Get File → Get Contents → Get Dictionary → Set Variable: State
Current Date → Set Variable: Now
Format Date (Now) → Set Variable: NowText

Get State.has_active_cycle → HasActiveCycle

If HasActiveCycle == false
│
│   ── Branch A ──
│   Create WindowEndText, FirstEffectiveMovement
│   Create ScheduledEndText, EffectiveMovements, NewCycle
│   State.active_cycle = NewCycle
│   State.has_active_cycle = true
│   Save → Notify → Stop
│
Otherwise
│
│   Get State.active_cycle → ActiveCycle
│   Get ActiveCycle.started_at → CycleStartedAtText
│   Calculate CycleAgeMinutes
│
│   If CycleAgeMinutes >= 60
│   │
│   │   ── Branch B3-A ──
│   │   Archive old cycle → CompletedCycle
│   │   Append to completed_cycles
│   │   State.has_active_cycle = false
│   │   State.active_cycle = {}
│   │
│   │   Choose from Menu
│   │   ├── "开启新周期并记录"
│   │   │   (same as Branch A)
│   │   │   Save → Notify → Stop
│   │   └── "不记录，仅结束上个周期"
│   │       Save → Notify → Stop
│   │
│   Otherwise (< 60 min)
│   │
│   │   ── Branch B3-B ──
│   │   Get ActiveCycle.effective_movements → EffectiveMovements
│   │   Get Last Item → LastEffectiveMovement
│   │   Get LastEffectiveMovement.effective_at → LastEffectiveAtText
│   │   Calculate MinutesSinceLastEffective
│   │   Get EffectiveCount, TotalCount
│   │   NewTotalCount = TotalCount + 1
│   │
│   │   If MinutesSinceLastEffective < 5
│   │   │
│   │   │   ── Branch C1: Sub-Movement ──
│   │   │   Get sub_movements (with empty array defense)
│   │   │   Append NowText to SubMovements
│   │   │   Update LastEffectiveMovement.sub_movements
│   │   │   Replace last item in EffectiveMovements
│   │   │       (branch on EffectiveCount == 1 vs > 1)
│   │   │   Update ActiveCycle (effective_movements, total_count)
│   │   │   Write to State → Save → Notify → Stop
│   │   │
│   │   Otherwise (>= 5 min)
│   │   │
│   │   │   ── Branch C2: New Effective Movement ──
│   │   │   Create WindowEndText, NewEffectiveMovement
│   │   │   Append to EffectiveMovements
│   │   │   NewEffectiveCount = EffectiveCount + 1
│   │   │   Update ActiveCycle (effective_movements,
│   │   │       effective_count, total_count)
│   │   │   Write to State → Save → Notify → Stop
```

---

# Example JSON After Several Taps

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

# Testing Checklist

Before building, run a 3-step test shortcut to verify ISO 8601 parsing:

```
① Text: 2026-05-25T08:00:00+08:00
② Get Time Between Dates: from ① to Current Date, unit: Minutes
③ Show Result
```

If the result is correct, proceed. If it errors or shows 0, wrap all ISO 8601 strings
with an explicit **Date** action before passing to time calculations.

---

After building, test on iPhone first:

```
Test 1: First tap         → new cycle, effective 1, total 1
Test 2: Tap within 1 min  → sub-movement, effective 1, total 2
Test 3: Tap after 5 min   → new effective, effective 2, total 3
Test 4: Edit started_at to 1 hour ago → tap should prompt menu
Test 5: Choose "开启新周期" → new cycle, effective 1, total 1
Test 6: Choose "不记录"    → cycle archived, notification only
```

Once all tests pass, enable the shortcut on Apple Watch.
