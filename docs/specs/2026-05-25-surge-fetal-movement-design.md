# Fetal Movement Tracker — Surge Script + Apple Shortcut Design

> Replaces the pure-Shortcuts approach (archived in `shortcut-plan.md` / `shortcut-plan-zh.md`).

## Overview

A fetal movement counter built with an Apple Shortcut (trigger) + Surge JavaScript script (logic). The Shortcut is a thin trigger with minimal actions; the Surge script handles all business logic, data storage, and notifications.

## Architecture

```
┌──────────────────────────────────────────────┐
│  Apple Shortcut A: 记录胎动                    │
│                                              │
│  ① Run Surge Script (param: "record")        │
│  ② Get Dictionary Value: status              │
│  ③ If status == "expired_and_closed":        │
│       Choose from Menu:                      │
│         - 开启新周期并记录 → run "new_cycle"  │
│         - 不记录本次       → End              │
│  ④ End                                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Apple Shortcut B: 结束当前胎动周期             │
│                                              │
│  ① Run Surge Script (param: "close_cycle")   │
│  ② End                                       │
└──────────────────────────────────────────────┘

              │
              ▼
┌──────────────────────────────────────────────┐
│  Surge Script: fetal_movement.js             │
│                                              │
│  Input:  $intent.parameter                   │
│  Storage: $persistentStore                   │
│  Notify: $notification.post                  │
│  Output: $done({ status, message })          │
└──────────────────────────────────────────────┘
```

### Why This Architecture

- **Pure Shortcuts was too complex**: 50+ actions with fragile dictionary/array manipulation, null-handling workarounds, and serialization edge cases.
- **Surge script (JavaScript)**: native JSON parsing, date arithmetic, array operations — all trivial in JS.
- **Apple Watch support**: Expected to be Watch-compatible, but must be validated on the actual device. Third-party Shortcuts actions may behave differently on Watch.

## Data Storage

### Storage Engine

`$persistentStore` with key `"fetal_movement_state"`. Value is a JSON string.

On Mac, debug data at: `~/Library/Application Support/com.nssurge.surge-mac/SGJSVMPersistentStore/`

### Data Model

```json
{
  "schema_version": 1,
  "active_cycle": null,
  "completed_cycles": []
}
```

State check: `if (!state.active_cycle)` — no separate boolean flag needed.

### Time Field Convention

All time-related fields use a dual format:

| Suffix | Purpose | Example |
| ------ | ------- | ------- |
| `*_at` | Human-readable local time string for display | `"2026-05-25 08:00:00"` |
| `*_ts` | Millisecond timestamp for calculation | `1779667200000` |

All calculations use `*_ts` fields (integer comparison). All display uses `*_at` fields.

#### Cycle Object

```json
{
  "cycle_id": "2026-05-25 08:00:00",
  "started_at": "2026-05-25 08:00:00",
  "started_ts": 1779667200000,
  "scheduled_end_at": "2026-05-25 09:00:00",
  "scheduled_end_ts": 1779670800000,
  "effective_count": 2,
  "total_count": 5,
  "effective_movements": [ ... ]
}
```

Completed cycles additionally have:

```json
{
  "ended_at": "2026-05-25 09:00:00",
  "ended_ts": 1779670800000,
  "close_reason": "expired | manual",
  "is_valid": true
}
```

- `expired`: cycle reached 1-hour limit. `is_valid: true`. `ended_at/ts` = `scheduled_end_at/ts`.
- `manual`: user manually ended the cycle early. `is_valid: false`. `ended_at/ts` = current time when `close_cycle` was called.

#### Effective Movement Object

```json
{
  "effective_id": "2026-05-25 08:02:10",
  "effective_at": "2026-05-25 08:02:10",
  "effective_ts": 1779667330000,
  "window_end_at": "2026-05-25 08:07:10",
  "window_end_ts": 1779667630000,
  "sub_movements": [
    { "at": "2026-05-25 08:03:05", "ts": 1779667385000 },
    { "at": "2026-05-25 08:05:40", "ts": 1779667540000 }
  ]
}
```

## Business Rules

1. **Cycle duration**: 1 hour from first tap.
2. **Effective movement**: A tap that occurs >= 5 minutes after the last effective movement's `effective_ts`.
3. **Sub-movement**: A tap that occurs < 5 minutes after the last effective movement's `effective_ts`. Counted in `total_count` but not `effective_count`.
4. **Cycle expiry**: When `record` is triggered and `now_ts - active_cycle.started_ts >= 60 * 60 * 1000`, the script automatically archives the expired cycle and clears `active_cycle`. The Shortcut then asks whether the current tap should start a new cycle.

## Surge Script Design

### File

`fetal_movement.js` — placed in Surge's script directory.

### Surge Configuration

```ini
[Script]
fetal_movement = type=generic,script-path=fetal_movement.js,timeout=10
```

### Commands

| Command       | Purpose                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `record`      | Normal tap. Auto-archives expired cycle. Records movement or returns expired status. |
| `new_cycle`   | Create new cycle and record first movement. Only works when no active cycle exists.  |
| `close_cycle` | Manually end current cycle early. Marks as invalid. Does not restart.                |
| `status`      | Return current cycle stats, no modification.                                         |
| `reset`       | Reset to default state. For testing only.                                            |
| `export`      | Return full JSON state for backup. No notification.                                  |

Default (empty/null parameter): treated as `record`.

### Output

`$done(result)` returns an object:

```json
{
  "status": "new_cycle | effective | sub_movement | expired_and_closed | closed | active_cycle_exists | no_active_cycle | invalid_cycle_reset | status | reset | export | error",
  "message": "Human-readable text"
}
```

- For `expired_and_closed`: script archives old cycle and saves state, but does NOT send notification. Shortcut shows menu instead.
- For `export`: script returns data but does NOT send notification.
- For all other statuses (including error/guard statuses like `active_cycle_exists` and `no_active_cycle`): script sends notification via `$notification.post` and returns the result.

### Logic Flow

#### Command: `record`

```
state = readState()
nowTs = Date.now()

if (!state.active_cycle):
    createNewCycle(state, nowTs)
    notify("已开启新周期，并记录为有效胎动。\n有效：1 次，总：1 次")
    saveState(state)
    return { status: "new_cycle", message: "..." }

cycle = state.active_cycle

if (nowTs - cycle.started_ts >= 60 * 60 * 1000):
    // Cycle expired. Auto-archive and save, but do NOT notify.
    archiveActiveCycle(state, "expired")
    saveState(state)
    return { status: "expired_and_closed",
             message: "上一个周期（{started_at} ~ {scheduled_end_at}）已结束并归档。\n" +
                      "有效：{effective_count} 次，总：{total_count} 次\n" +
                      "是否用本次点击开启新的 1 小时周期？" }

// Cycle is active
lastEffective = cycle.effective_movements[last]
cycle.total_count += 1

if (nowTs - lastEffective.effective_ts < 5 * 60 * 1000):
    lastEffective.sub_movements.push({ at: formatLocal(nowTs), ts: nowTs })
    notify("已记录为子胎动，不计入有效次数。\n有效：{effective_count} 次，总：{total_count} 次")
    saveState(state)
    return { status: "sub_movement", message: "..." }

else:
    newMovement = createEffectiveMovement(nowTs)
    cycle.effective_movements.push(newMovement)
    cycle.effective_count += 1
    notify("已记录为有效胎动。\n有效：{effective_count} 次，总：{total_count} 次")
    saveState(state)
    return { status: "effective", message: "..." }
```

#### Command: `new_cycle`

```
state = readState()
nowTs = Date.now()

// Guard: do not create a new cycle if one is already active
if (state.active_cycle):
    notify("当前已有进行中的周期，无法开启新周期。")
    return { status: "active_cycle_exists",
             message: "当前已有进行中的周期，无法开启新周期。" }

createNewCycle(state, nowTs)
notify("已开启新周期，并记录为有效胎动。\n有效：1 次，总：1 次")
saveState(state)
return { status: "new_cycle", message: "..." }
```

#### Command: `close_cycle`

```
state = readState()
nowTs = Date.now()

if (!state.active_cycle):
    notify("当前没有正在进行的胎动周期。")
    return { status: "no_active_cycle",
             message: "当前没有正在进行的胎动周期。" }

cycle = state.active_cycle
archiveActiveCycle(state, "manual", nowTs)
saveState(state)
notify("当前胎动周期已结束并标记为无效。\n" +
       "有效：{cycle.effective_count} 次，总：{cycle.total_count} 次\n" +
       "如需重新开始，请再次点击「记录胎动」。")
return { status: "closed", message: "..." }
```

#### Command: `status`

```
state = readState()
nowTs = Date.now()

if (!state.active_cycle):
    notify("当前没有活跃的周期。")
    return { status: "status", message: "当前没有活跃的周期。" }

cycle = state.active_cycle
elapsed = formatElapsed(nowTs - cycle.started_ts)
msg = "当前周期：{started_at} 起\n" +
      "已持续：{elapsed}\n" +
      "有效：{effective_count} 次，总：{total_count} 次"
notify(msg)
return { status: "status", message: msg }
```

#### Command: `reset`

```
state = defaultState()
saveState(state)
notify("胎动记录已全部清空。")
return { status: "reset", message: "已清空。" }
```

#### Command: `export`

```
state = readState()
raw = JSON.stringify(state, null, 2)
// No notification for export — return data only.
return { status: "export", message: raw }
```

### Helper Functions

```
defaultState():
    return { schema_version: 1, active_cycle: null, completed_cycles: [] }

readState():
    raw = $persistentStore.read("fetal_movement_state")
    if (!raw) return defaultState()
    try:
        state = JSON.parse(raw)
        return migrateStateIfNeeded(state)
    catch (e):
        corrupted = defaultState()
        saveState(corrupted)
        notify("胎动记录数据异常，已重置为空状态。")
        return corrupted

migrateStateIfNeeded(state):
    // Guard against incomplete or unknown schema
    if (!state || state.schema_version !== 1):
        return defaultState()
    if (!Array.isArray(state.completed_cycles)):
        state.completed_cycles = []
    if (!("active_cycle" in state)):
        state.active_cycle = null
    return state

saveState(state):
    $persistentStore.write(JSON.stringify(state), "fetal_movement_state")

createNewCycle(state, nowTs):
    movement = createEffectiveMovement(nowTs)
    endTs = nowTs + 60 * 60 * 1000
    cycle = {
        cycle_id:            formatLocal(nowTs),
        started_at:          formatLocal(nowTs),
        started_ts:          nowTs,
        scheduled_end_at:    formatLocal(endTs),
        scheduled_end_ts:    endTs,
        effective_count:     1,
        total_count:         1,
        effective_movements: [movement]
    }
    state.active_cycle = cycle

createEffectiveMovement(nowTs):
    windowEndTs = nowTs + 5 * 60 * 1000
    return {
        effective_id:   formatLocal(nowTs),
        effective_at:   formatLocal(nowTs),
        effective_ts:   nowTs,
        window_end_at:  formatLocal(windowEndTs),
        window_end_ts:  windowEndTs,
        sub_movements:  []
    }

archiveActiveCycle(state, reason, endedTs):
    cycle = state.active_cycle
    isExpired = (reason === "expired")
    actualEndedTs = isExpired ? cycle.scheduled_end_ts : endedTs
    cycle.ended_at = formatLocal(actualEndedTs)
    cycle.ended_ts = actualEndedTs
    cycle.close_reason = reason
    cycle.is_valid = isExpired
    state.completed_cycles.push(cycle)
    state.active_cycle = null

notify(body):
    $notification.post("记录胎动", "", body)

formatLocal(ts):
    // Format timestamp to local time string "YYYY-MM-DD HH:mm:ss"
    // using Date getFullYear/getMonth/getDate/getHours/getMinutes/getSeconds

formatTime(ts):
    // Format timestamp to "HH:mm" for short display in notifications

formatElapsed(ms):
    // Format milliseconds to "X 分钟" or "X 小时 Y 分钟"
```

## Apple Shortcut Design

### Shortcut A: 记录胎动 (Primary)

The main shortcut. Used for every tap.

```
① 运行 Surge 脚本
     脚本名称: fetal_movement
     参数: record

② 获取词典值
     获取: status
     从: ①的结果

③ 如果 status 等于 "expired_and_closed"
     ├── 是:
     │    从菜单中选取
     │      标题: 周期已结束
     │      选项 1: 开启新周期并记录
     │        → 运行 Surge 脚本（参数: new_cycle）
     │      选项 2: 不记录本次
     │        → 停止此快捷指令
     │
     └── 否: (脚本已通过 $notification.post 发了通知，无需额外操作)
```

### Shortcut B: 结束当前胎动周期 (Utility)

For the "forgot to count, want to restart" scenario. Single action, no menu.
After closing, user taps Shortcut A ("记录胎动") to start fresh.

```
① 运行 Surge 脚本
     脚本名称: fetal_movement
     参数: close_cycle
```

### Apple Watch

- Add both shortcuts to Apple Watch via iPhone Shortcuts app settings.
- Primary shortcut ("记录胎动") can be placed on watch face as a complication.
- Requires: iPhone nearby, Surge running.

**Watch compatibility is expected but must be validated on the actual device.** Third-party Shortcuts actions may behave differently on Watch.

## Notification Summary

| Scenario                      | Who Sends    | Content                                                                  |
| ----------------------------- | ------------ | ------------------------------------------------------------------------ |
| No active cycle (first tap)   | Surge script | 已开启新周期，并记录为有效胎动。有效：1 次，总：1 次                          |
| Effective movement (>= 5 min) | Surge script | 已记录为有效胎动。有效：X 次，总：Y 次                                      |
| Sub-movement (< 5 min)        | Surge script | 已记录为子胎动，不计入有效次数。有效：X 次，总：Y 次                          |
| Cycle expired                 | Shortcut     | 从菜单中选取：开启新周期并记录 / 不记录本次                                   |
| Confirmed new cycle           | Surge script | 已开启新周期，并记录为有效胎动。有效：1 次，总：1 次                          |
| Manual close (Shortcut B)     | Surge script | 当前胎动周期已结束并标记为无效。有效：X 次，总：Y 次。如需重新开始，请再次点击「记录胎动」。 |
| Status check                  | Surge script | 当前周期统计信息                                                           |
| Reset                         | Surge script | 胎动记录已全部清空。                                                       |
| Export                        | (none)       | Data returned via $done(), no notification.                              |

## Testing Checklist

### P0: Integration Validation (Run First)

```
P0-1: iPhone Shortcut can run Surge generic script
P0-2: $intent.parameter receives "record" / "new_cycle" / "close_cycle"
P0-3: $done({ status, message }) can be read by Shortcut as dictionary (get status field)
P0-4: Apple Watch + iPhone unlocked nearby → triggers successfully
P0-5: Apple Watch + iPhone locked nearby → triggers successfully
```

### Functional Tests

```
Test 1:  First tap (no state)             → new cycle, effective 1, total 1
Test 2:  Tap within 1 min                 → sub-movement, effective 1, total 2
Test 3:  Tap after 5+ min                 → effective movement, effective 2, total 3
Test 4:  Tap after 60+ min               → auto-archive, menu: start new or skip
Test 5:  Choose "开启新周期并记录"        → new cycle, effective 1, total 1
Test 6:  Choose "不记录本次"              → silent exit, old cycle archived, no active cycle
Test 7:  Shortcut B: close_cycle          → manual close, is_valid: false
Test 8:  After close_cycle, tap 记录胎动  → new cycle created automatically
Test 9:  new_cycle when cycle exists      → rejected: "当前已有进行中的周期"
Test 10: status command                   → shows current stats
Test 11: export command                   → returns full JSON, no notification
Test 12: reset command                    → writes default JSON, clears state
```

### Apple Watch Tests

```
Test 13: Apple Watch — iPhone unlocked nearby    → expected to work
Test 14: Apple Watch — iPhone locked nearby      → expected to work
Test 15: Apple Watch — cellular only, no iPhone  → expected to fail
```

## File Locations

| File                   | Location                             |
| ---------------------- | ------------------------------------ |
| Surge script           | Surge config dir / fetal_movement.js |
| Surge config addition  | `[Script]` section                   |
| Shortcut A             | Shortcuts app: 记录胎动               |
| Shortcut B             | Shortcuts app: 结束当前胎动周期        |
| Data                   | Surge $persistentStore               |
| Archived plans         | shortcut-plan.md, shortcut-plan-zh.md |
| This design doc        | docs/specs/2026-05-25-surge-fetal-movement-design.md |
