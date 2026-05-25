// Fetal Movement Tracker — Surge JavaScript Script
// Runs in Surge's JavaScriptCore engine on iOS.
// Receives commands via $intent.parameter, persists state via $persistentStore,
// sends notifications via $notification.post, and returns results via $done().

// ─── Section 1: Constants and Utility Functions ─────────────────────────────

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

// ─── Section 2: State Management Functions ──────────────────────────────────

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

// ─── Section 3: Notification and Domain Helpers ─────────────────────────────

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

// ─── Section 4: handleRecord ────────────────────────────────────────────────

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
    archiveActiveCycle(state, "expired");
    saveState(state);
    const msg =
      "上一个周期（" +
      formatTime(cycle.started_ts) +
      " ~ " +
      formatTime(cycle.scheduled_end_ts) +
      "）已结束并归档。\n" +
      summary +
      "\n再次点击「记录胎动」可开启新周期。";
    notify(msg);
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

// ─── Section 5: handleNewCycle ──────────────────────────────────────────────

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

// ─── Section 6: handleCloseCycle ────────────────────────────────────────────

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

// ─── Section 7: handleStatus ────────────────────────────────────────────────

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

// ─── Section 8: handleReset and handleExport ────────────────────────────────

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

// ─── Section 9: main() Entry Point ─────────────────────────────────────────

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
