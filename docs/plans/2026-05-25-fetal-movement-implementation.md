# Fetal Movement Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fetal movement counter using a Surge JavaScript script (logic + storage) triggered by Apple Shortcuts (UI).

**Architecture:** A single JS file (`fetal_movement.js`) runs inside Surge's scripting engine. It receives commands via `$intent.parameter`, reads/writes state to `$persistentStore`, sends notifications via `$notification.post`, and returns results via `$done()`. Two Apple Shortcuts ("记录胎动" and "结束当前胎动周期") serve as thin triggers. The script handles all business logic.

**Tech Stack:** Surge iOS scripting (JavaScriptCore), Apple Shortcuts, `$persistentStore`, `$notification.post`

**Design Doc:** `docs/specs/2026-05-25-surge-fetal-movement-design.md`

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `fetal_movement.js` | All business logic: command routing, state management, notifications. Deployed to Surge config directory on iPhone. |
| `fetal_movement_p0_test.js` | Minimal P0 integration test script. Temporary, deleted after P0 passes. |
| Surge config `[Script]` section | One-line addition to register the script. |
| Shortcut A: 记录胎动 | Primary shortcut. Calls `record`, handles `expired_and_closed` menu. |
| Shortcut B: 结束当前胎动周期 | Utility shortcut. Calls `close_cycle`. |

---

## Task 0: P0 Integration Validation

Before writing any business logic, validate that Surge + Shortcuts + Apple Watch integration works end-to-end.

**Files:**
- Create: `fetal_movement_p0_test.js`

- [ ] **Step 1: Create minimal P0 test script**

Create `fetal_movement_p0_test.js` with the following content:

```javascript
// P0 integration test for Surge + Shortcuts
// Tests: $intent.parameter, $persistentStore, $notification.post, $done()

function getCommand(defaultCommand) {
  if (typeof $intent === "undefined" || !$intent || !$intent.parameter) {
    return defaultCommand;
  }
  return String($intent.parameter).trim() || defaultCommand;
}

const command = getCommand("no_param");

// P0-2: Test $intent.parameter
const paramReceived = command;

// P0-1: Test $persistentStore read/write
$persistentStore.write("p0_test_ok", "fetal_movement_p0");
const readBack = $persistentStore.read("fetal_movement_p0");
const storageOk = readBack === "p0_test_ok";

// Clean up test key
$persistentStore.write("", "fetal_movement_p0");

// P0-1: Test $notification.post
$notification.post(
  "P0 Test",
  "",
  "param: " + paramReceived + "\nstorage: " + (storageOk ? "OK" : "FAIL")
);

// P0-3: Test $done() return value — Shortcut must be able to read this as dictionary
$done({
  status: "p0_ok",
  message: "param=" + paramReceived + ", storage=" + (storageOk ? "ok" : "fail")
});
```

- [ ] **Step 2: Register P0 test script in Surge config**

Add to Surge config `[Script]` section on iPhone:

```ini
[Script]
fetal_movement_p0 = type=generic,script-path=fetal_movement_p0_test.js,timeout=10
```

Deploy `fetal_movement_p0_test.js` to Surge's script directory on iPhone.

- [ ] **Step 3: Create P0 test Shortcut on iPhone**

Create a Shortcut named "P0 Test" with these actions:

```
① 运行 Surge 脚本
     脚本名称: fetal_movement_p0
     参数: hello_p0

② 获取词典值
     获取: status
     从: ①的结果

③ 显示结果: ②的结果
```

- [ ] **Step 4: Run P0 tests on iPhone**

Run the "P0 Test" shortcut. Verify:

```
P0-1: A notification appears with "storage: OK"
P0-2: The notification shows "param: hello_p0"
P0-3: The "显示结果" shows "p0_ok" (meaning Shortcut read the status field from $done)
```

If P0-3 fails (Shortcut cannot extract `status` from `$done()` result), try alternative approaches:
- Check if the result needs `JSON.stringify` before `$done()`
- Check if `$done()` should return a string instead of an object
- Document the working approach for use in the real script

- [ ] **Step 5: Run P0 tests on Apple Watch**

Run the same "P0 Test" shortcut from Apple Watch:

```
P0-4: iPhone unlocked nearby → notification appears, result shows
P0-5: iPhone locked nearby → notification appears, result shows
```

Document results. If P0-4/P0-5 fail, this does not block implementation but must be noted.

- [ ] **Step 6: Clean up P0 artifacts**

After P0 results are documented and iPhone-side P0 (P0-1 through P0-3) passes:
- Delete the "P0 Test" shortcut
- Remove the `fetal_movement_p0` line from Surge config `[Script]`
- Delete `fetal_movement_p0_test.js` from Surge's script directory

Apple Watch P0 failures (P0-4/P0-5) do not block implementation — record them as known limitations and continue.

---

## Task 1: Constants and Utility Functions

**Files:**
- Create: `fetal_movement.js` (first section: constants + utilities)

- [ ] **Step 1: Write constants and formatLocal**

```javascript
const STORAGE_KEY = "fetal_movement_state";
const CYCLE_DURATION_MS = 60 * 60 * 1000;
const EFFECTIVE_WINDOW_MS = 5 * 60 * 1000;

function getCommand(defaultCommand) {
  if (typeof $intent === "undefined" || !$intent || !$intent.parameter) {
    return defaultCommand;
  }
  return String($intent.parameter).trim() || defaultCommand;
}

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function formatLocal(ts) {
  const d = new Date(ts);
  return (
    d.getFullYear() + "-" +
    pad(d.getMonth() + 1) + "-" +
    pad(d.getDate()) + " " +
    pad(d.getHours()) + ":" +
    pad(d.getMinutes()) + ":" +
    pad(d.getSeconds())
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function formatElapsed(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return totalMin + " 分钟";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? h + " 小时 " + m + " 分钟" : h + " 小时";
}
```

- [ ] **Step 2: Write state management functions**

Append to `fetal_movement.js`:

```javascript
function defaultState() {
  return { schema_version: 1, active_cycle: null, completed_cycles: [] };
}

function migrateStateIfNeeded(state) {
  if (!state || state.schema_version !== 1) {
    return defaultState();
  }
  if (!Array.isArray(state.completed_cycles)) {
    state.completed_cycles = [];
  }
  if (!("active_cycle" in state)) {
    state.active_cycle = null;
  }
  if (
    state.active_cycle &&
    !Array.isArray(state.active_cycle.effective_movements)
  ) {
    state.active_cycle.effective_movements = [];
  }
  return state;
}

function readState() {
  const raw = $persistentStore.read(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    return migrateStateIfNeeded(JSON.parse(raw));
  } catch (e) {
    const state = defaultState();
    saveState(state);
    notify("胎动记录数据异常，已重置为空状态。");
    return state;
  }
}

function saveState(state) {
  $persistentStore.write(JSON.stringify(state), STORAGE_KEY);
}
```

- [ ] **Step 3: Write notify and domain helper functions**

Append to `fetal_movement.js`:

```javascript
function notify(body) {
  $notification.post("记录胎动", "", body);
}

function createEffectiveMovement(nowTs) {
  const windowEndTs = nowTs + EFFECTIVE_WINDOW_MS;
  return {
    effective_id: formatLocal(nowTs),
    effective_at: formatLocal(nowTs),
    effective_ts: nowTs,
    window_end_at: formatLocal(windowEndTs),
    window_end_ts: windowEndTs,
    sub_movements: [],
  };
}

function createNewCycle(state, nowTs) {
  const movement = createEffectiveMovement(nowTs);
  const endTs = nowTs + CYCLE_DURATION_MS;
  state.active_cycle = {
    cycle_id: formatLocal(nowTs),
    started_at: formatLocal(nowTs),
    started_ts: nowTs,
    scheduled_end_at: formatLocal(endTs),
    scheduled_end_ts: endTs,
    effective_count: 1,
    total_count: 1,
    effective_movements: [movement],
  };
}

function archiveActiveCycle(state, reason, endedTs = Date.now()) {
  const cycle = state.active_cycle;
  const isExpired = reason === "expired";
  const actualEndedTs = isExpired ? cycle.scheduled_end_ts : endedTs;
  cycle.ended_at = formatLocal(actualEndedTs);
  cycle.ended_ts = actualEndedTs;
  cycle.close_reason = reason;
  cycle.is_valid = isExpired;
  state.completed_cycles.push(cycle);
  state.active_cycle = null;
}
```

- [ ] **Step 4: Deploy and smoke test helpers**

Deploy `fetal_movement.js` to Surge script directory. Temporarily add a test entry point at the bottom:

```javascript
// TEMPORARY: smoke test helpers
const _testState = defaultState();
createNewCycle(_testState, Date.now());
$notification.post(
  "Smoke Test",
  "",
  "active_cycle: " + Boolean(_testState.active_cycle) +
  "\neffective: " + _testState.active_cycle.effective_count +
  "\ntotal: " + _testState.active_cycle.total_count +
  "\nstarted_at: " + _testState.active_cycle.started_at
);
$done({});
```

Register in Surge config:

```ini
[Script]
fetal_movement = type=generic,script-path=fetal_movement.js,timeout=10
```

Run from Surge (long-press script). Verify the notification shows `active_cycle: true`, `effective: 1`, `total: 1`, and a valid `started_at` value. Then **remove the temporary test code** from the bottom of the file.

---

## Task 2: Command Handlers — record

**Files:**
- Modify: `fetal_movement.js`

- [ ] **Step 1: Write handleRecord function**

Append to `fetal_movement.js`, above the entry point:

```javascript
function handleRecord() {
  const state = readState();
  const nowTs = Date.now();

  if (!state.active_cycle) {
    createNewCycle(state, nowTs);
    const msg =
      "已开启新周期，并记录为有效胎动。\n有效：1 次，总：1 次";
    notify(msg);
    saveState(state);
    return { status: "new_cycle", message: msg };
  }

  const cycle = state.active_cycle;

  if (nowTs - cycle.started_ts >= CYCLE_DURATION_MS) {
    const summary =
      "有效：" + cycle.effective_count + " 次，总：" + cycle.total_count + " 次";
    const msg =
      "上一个周期（" +
      formatTime(cycle.started_ts) +
      " ~ " +
      formatTime(cycle.scheduled_end_ts) +
      "）已结束并归档。\n" +
      summary +
      "\n是否用本次点击开启新的 1 小时周期？";
    archiveActiveCycle(state, "expired");
    saveState(state);
    return { status: "expired_and_closed", message: msg };
  }

  const movements = cycle.effective_movements;
  if (!Array.isArray(movements) || movements.length === 0) {
    state.active_cycle = null;
    saveState(state);
    const msg = "当前周期数据异常，已清空。请重新点击「记录胎动」开始新周期。";
    notify(msg);
    return { status: "invalid_cycle_reset", message: msg };
  }
  const lastEffective = movements[movements.length - 1];
  cycle.total_count += 1;

  if (nowTs - lastEffective.effective_ts < EFFECTIVE_WINDOW_MS) {
    lastEffective.sub_movements.push({ at: formatLocal(nowTs), ts: nowTs });
    const msg =
      "已记录为子胎动，不计入有效次数。\n有效：" +
      cycle.effective_count +
      " 次，总：" +
      cycle.total_count +
      " 次";
    notify(msg);
    saveState(state);
    return { status: "sub_movement", message: msg };
  }

  const newMovement = createEffectiveMovement(nowTs);
  cycle.effective_movements.push(newMovement);
  cycle.effective_count += 1;
  const msg =
    "已记录为有效胎动。\n有效：" +
    cycle.effective_count +
    " 次，总：" +
    cycle.total_count +
    " 次";
  notify(msg);
  saveState(state);
  return { status: "effective", message: msg };
}
```

- [ ] **Step 2: Write entry point with record command**

Append to the very end of `fetal_movement.js`:

```javascript
(function main() {
  let result;

  try {
    const command = getCommand("record");

    switch (command) {
      case "record":
        result = handleRecord();
        break;
      default:
        result = handleRecord();
        break;
    }
  } catch (e) {
    const msg = "胎动记录脚本执行失败：" + (e && e.message ? e.message : String(e));
    notify(msg);
    result = { status: "error", message: msg };
  }

  $done(result);
})();
```

- [ ] **Step 3: Deploy and test record on iPhone**

Deploy updated `fetal_movement.js` to Surge. Run from Surge (long-press script) or via a temporary Shortcut with param "record".

Verify:
```
First run: notification "已开启新周期，并记录为有效胎动。有效：1 次，总：1 次"
Immediate second run: notification "已记录为子胎动...有效：1 次，总：2 次"
```

---

## Task 3: Command Handlers — new_cycle, close_cycle

**Files:**
- Modify: `fetal_movement.js`

- [ ] **Step 1: Write handleNewCycle function**

Add above the `main()` entry point:

```javascript
function handleNewCycle() {
  const state = readState();
  const nowTs = Date.now();

  if (state.active_cycle) {
    const msg = "当前已有进行中的周期，无法开启新周期。";
    notify(msg);
    return { status: "active_cycle_exists", message: msg };
  }

  createNewCycle(state, nowTs);
  const msg = "已开启新周期，并记录为有效胎动。\n有效：1 次，总：1 次";
  notify(msg);
  saveState(state);
  return { status: "new_cycle", message: msg };
}
```

- [ ] **Step 2: Write handleCloseCycle function**

Add below `handleNewCycle`:

```javascript
function handleCloseCycle() {
  const state = readState();
  const nowTs = Date.now();

  if (!state.active_cycle) {
    const msg = "当前没有正在进行的胎动周期。";
    notify(msg);
    return { status: "no_active_cycle", message: msg };
  }

  const cycle = state.active_cycle;
  const summary =
    "有效：" + cycle.effective_count + " 次，总：" + cycle.total_count + " 次";
  archiveActiveCycle(state, "manual", nowTs);
  saveState(state);
  const msg =
    "当前胎动周期已结束并标记为无效。\n" +
    summary +
    "\n如需重新开始，请再次点击「记录胎动」。";
  notify(msg);
  return { status: "closed", message: msg };
}
```

- [ ] **Step 3: Update main() switch to include new_cycle and close_cycle**

In the `main()` IIFE's `try` block, replace the `switch` statement to add the new commands:

```javascript
    switch (command) {
      case "record":
        result = handleRecord();
        break;
      case "new_cycle":
        result = handleNewCycle();
        break;
      case "close_cycle":
        result = handleCloseCycle();
        break;
      default:
        result = handleRecord();
        break;
    }
```

- [ ] **Step 4: Deploy and test new_cycle / close_cycle**

Deploy updated script. Test sequence:

```
1. reset state (manually clear $persistentStore or long-press reset later)
2. Run with param "record" → should create new cycle
3. Run with param "new_cycle" → should show "当前已有进行中的周期"
4. Run with param "close_cycle" → should show "已结束并标记为无效"
5. Run with param "record" → should create new cycle (since active_cycle is now null)
```

---

## Task 4: Command Handlers — status, reset, export

**Files:**
- Modify: `fetal_movement.js`

- [ ] **Step 1: Write handleStatus function**

Add above `main()`:

```javascript
function handleStatus() {
  const state = readState();
  const nowTs = Date.now();

  if (!state.active_cycle) {
    const msg = "当前没有活跃的周期。";
    notify(msg);
    return { status: "status", message: msg };
  }

  const cycle = state.active_cycle;
  const elapsed = formatElapsed(nowTs - cycle.started_ts);
  const msg =
    "当前周期：" +
    cycle.started_at +
    " 起\n已持续：" +
    elapsed +
    "\n有效：" +
    cycle.effective_count +
    " 次，总：" +
    cycle.total_count +
    " 次";
  notify(msg);
  return { status: "status", message: msg };
}
```

- [ ] **Step 2: Write handleReset and handleExport functions**

```javascript
function handleReset() {
  const state = defaultState();
  saveState(state);
  const msg = "胎动记录已全部清空。";
  notify(msg);
  return { status: "reset", message: msg };
}

function handleExport() {
  const state = readState();
  const raw = JSON.stringify(state, null, 2);
  return { status: "export", message: raw };
}
```

- [ ] **Step 3: Update main() switch with all commands**

Replace the entire `main()` IIFE with the final version (including all commands and global try/catch):

```javascript
(function main() {
  let result;

  try {
    const command = getCommand("record");

    switch (command) {
      case "record":
        result = handleRecord();
        break;
      case "new_cycle":
        result = handleNewCycle();
        break;
      case "close_cycle":
        result = handleCloseCycle();
        break;
      case "status":
        result = handleStatus();
        break;
      case "reset":
        result = handleReset();
        break;
      case "export":
        result = handleExport();
        break;
      default:
        result = handleRecord();
        break;
    }
  } catch (e) {
    const msg = "胎动记录脚本执行失败：" + (e && e.message ? e.message : String(e));
    notify(msg);
    result = { status: "error", message: msg };
  }

  $done(result);
})();
```

- [ ] **Step 4: Deploy and test status / reset / export**

Deploy updated script. Test:

```
1. Run "record" → creates cycle
2. Run "status" → shows cycle stats
3. Run "export" → returns full JSON (verify no notification sent)
4. Run "reset" → shows "已全部清空"
5. Run "export" → should show default state with active_cycle: null
   (Use a temporary Shortcut: run fetal_movement with param "export", then use "显示结果" to view the returned message.)
```

---

## Task 5: Create Apple Shortcuts

**Files:**
- Create: Shortcut A ("记录胎动") in Shortcuts app
- Create: Shortcut B ("结束当前胎动周期") in Shortcuts app

- [ ] **Step 1: Ensure Surge config has the script registered**

Verify Surge config `[Script]` section contains:

```ini
fetal_movement = type=generic,script-path=fetal_movement.js,timeout=10
```

- [ ] **Step 2: Create Shortcut A — 记录胎动**

In the Shortcuts app, create a new shortcut named "记录胎动" with these actions:

```
动作 1: 运行 Surge 脚本
  脚本名称: fetal_movement
  参数: record

动作 2: 获取词典值
  获取: status
  从: 动作 1 的结果

动作 3: 获取词典值
  获取: message
  从: 动作 1 的结果

动作 4: 如果
  条件: 动作 2 的结果 等于 expired_and_closed

  如果成立:
    动作 5: 从菜单中选取
      提示: 动作 3 的结果（即 message，包含旧周期时间范围和统计）
      选项 1: 开启新周期并记录
        动作 6: 运行 Surge 脚本
          脚本名称: fetal_movement
          参数: new_cycle
      选项 2: 不记录本次
        动作 7: 停止此快捷指令

  否则:
    (什么都不做)
```

> 如果 Apple Watch 上「从菜单中选取」的多行提示显示不佳，可以改为先用「显示提醒」展示 message，再用「从菜单中选取」让用户选择。

If P0-3 showed that `$done()` result cannot be read as dictionary, adapt this step based on the P0 findings (e.g., use text matching instead).

- [ ] **Step 3: Create Shortcut B — 结束当前胎动周期**

In the Shortcuts app, create a new shortcut named "结束当前胎动周期" with one action:

```
动作 1: 运行 Surge 脚本
  脚本名称: fetal_movement
  参数: close_cycle
```

- [ ] **Step 4: Test Shortcut A — normal flow**

Reset state first: run script with param "reset".

```
Test 1: Tap Shortcut A → notification "已开启新周期...有效：1，总：1"
Test 2: Tap Shortcut A within 1 min → notification "子胎动...有效：1，总：2"
Test 3: Tap Shortcut A after 5+ min → notification "有效胎动...有效：2，总：3"
```

- [ ] **Step 5: Test Shortcut A — expired flow**

To test expiry without waiting 1 hour:

1. Run "export" to get current state JSON
2. Manually edit `$persistentStore` on Mac (path: `~/Library/Application Support/com.nssurge.surge-mac/SGJSVMPersistentStore/`) or use Surge HTTP API to modify the state
3. Change **all four** time fields consistently:
   - `started_ts` → set to 70 minutes ago (`Date.now() - 70 * 60 * 1000`)
   - `started_at` → set to the corresponding local time string
   - `scheduled_end_ts` → set to `started_ts + 60 * 60 * 1000` (10 minutes ago)
   - `scheduled_end_at` → set to the corresponding local time string
4. Run Shortcut A

```
Test 4: Shortcut A after expiry → menu appears with message showing old cycle stats
Test 5: Choose "开启新周期并记录" → notification "已开启新周期...有效：1，总：1"
Test 6: Reset, re-test expiry, choose "不记录本次" → silent exit
```

- [ ] **Step 6: Test Shortcut B**

```
Test 7: Run Shortcut A to create a cycle, then run Shortcut B
        → notification "已结束并标记为无效"
Test 8: Run Shortcut A again → new cycle created (confirms active_cycle was null)
Test 9: Run Shortcut B with no active cycle → notification "当前没有正在进行的胎动周期"
```

---

## Task 6: Apple Watch Validation

- [ ] **Step 1: Enable shortcuts on Apple Watch**

On iPhone, go to Watch app → My Watch → Shortcuts. Enable "记录胎动" and "结束当前胎动周期" to appear on Apple Watch.

Optionally add "记录胎动" as a watch face complication.

- [ ] **Step 2: Test with iPhone unlocked nearby**

Run "记录胎动" from Apple Watch with iPhone unlocked and nearby.

```
Test 13: Notification appears on Watch/iPhone. Script executed correctly.
```

- [ ] **Step 3: Test with iPhone locked nearby**

Lock iPhone screen. Run "记录胎动" from Apple Watch.

```
Test 14: Notification appears. Script executed correctly.
```

- [ ] **Step 4: Test cellular-only (if applicable)**

Leave iPhone behind. Run "记录胎动" from Apple Watch via cellular.

```
Test 15: Expected to fail. Document the error behavior.
```

- [ ] **Step 5: Document Apple Watch findings**

Record which scenarios work and which don't. If Watch fails in all scenarios, document this as a known limitation.

---

## Task 7: Final Verification

- [ ] **Step 1: Run full test sequence**

Reset state. Run through the complete test checklist from the design doc:

```
Test 1:  First tap (no state)             → new cycle, effective 1, total 1
Test 2:  Tap within 1 min                 → sub-movement, effective 1, total 2
Test 3:  Tap after 5+ min                 → effective movement, effective 2, total 3
Test 4:  Tap after 60+ min               → auto-archive, menu: start new or skip
Test 5:  Choose "开启新周期并记录"        → new cycle, effective 1, total 1
Test 6:  Choose "不记录本次"              → silent exit, old cycle archived
Test 7:  Shortcut B: close_cycle          → manual close, is_valid: false
Test 8:  After close_cycle, tap 记录胎动  → new cycle created automatically
Test 9:  new_cycle when cycle exists      → rejected notification
Test 10: status command                   → shows current stats
Test 11: export command                   → returns full JSON, no notification
Test 12: reset command                    → writes default JSON, clears state
```

- [ ] **Step 2: Verify export data structure**

Run "export" and verify the JSON matches the design doc schema:

```json
{
  "schema_version": 1,
  "active_cycle": {
    "cycle_id": "...",
    "started_at": "...",
    "started_ts": ...,
    "scheduled_end_at": "...",
    "scheduled_end_ts": ...,
    "effective_count": ...,
    "total_count": ...,
    "effective_movements": [
      {
        "effective_id": "...",
        "effective_at": "...",
        "effective_ts": ...,
        "window_end_at": "...",
        "window_end_ts": ...,
        "sub_movements": [
          { "at": "...", "ts": ... }
        ]
      }
    ]
  },
  "completed_cycles": [
    {
      "...all cycle fields...",
      "ended_at": "...",
      "ended_ts": ...,
      "close_reason": "expired",
      "is_valid": true
    }
  ]
}
```

- [ ] **Step 3: Verify error recovery**

Manually write invalid JSON to `$persistentStore` (via Mac debug path or Surge HTTP API):

```
$persistentStore.write("{invalid json", "fetal_movement_state")
```

Run "record". Verify:
```
Notification 1: "胎动记录数据异常，已重置为空状态。"
Notification 2: "已开启新周期，并记录为有效胎动。有效：1 次，总：1 次"
```

Both notifications may appear close together. After testing, run "export" to verify final state shows a valid `active_cycle`.
