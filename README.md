# Fetal Movement Tracker

A fetal movement counter built with **Surge JavaScript script** + **Apple Shortcuts**.

The Shortcuts serve as thin UI triggers; the Surge script handles all business logic, data persistence, and notifications.

## Project Structure

```
scripts/          Surge JS scripts (deploy to Surge config directory)
tests/            Temporary test scripts (P0 integration tests)
docs/
  specs/          Design specifications
  plans/          Implementation plans
  archive/        Archived documents (pure-Shortcuts approach)
```

## How It Works

1. **Shortcut A "记录胎动"** — calls `record` command, handles expired-cycle prompt
2. **Shortcut B "结束当前胎动周期"** — calls `close_cycle` for manual early termination
3. **Surge script** — receives commands via `$intent.parameter`, manages state in `$persistentStore`

## Surge Configuration

Add the following to your Surge config `[Script]` section:

```ini
[Script]
胎动记录 = type=generic,script-path=fetal_movement.js
```

## Deployment

1. Copy `scripts/fetal_movement.js` to your Surge configuration directory
2. Add the script entry to Surge config
3. Create Apple Shortcuts A and B as described in `docs/specs/`

## Documentation

- [Design Spec](docs/specs/2026-05-25-surge-fetal-movement-design.md)
- [Implementation Plan](docs/plans/2026-05-25-fetal-movement-implementation.md)
