# Plan 014: Import stats content runtime directly

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ff93b10..HEAD -- entrypoints/content/run-injections.ts features/stats/index.ts entrypoints/content/desktop-main.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `ff93b10`, 2026-06-16

## Why this matters

The content injection path imports `@/features/stats` only to run pending post
completion functions. That barrel also exports dashboard components and time
tracker APIs, so a thread page can become coupled to options/dashboard code it
does not need. Importing the content runtime module directly keeps extension
contexts cleaner and reduces accidental bundle coupling.

## Current state

- `entrypoints/content/desktop-main.ts` already imports content stats modules
  directly.
- `entrypoints/content/run-injections.ts` dynamically imports the full stats
  barrel on thread pages.
- `features/stats/index.ts` exports both components and content utilities.

Relevant excerpts:

```ts
// entrypoints/content/desktop-main.ts:35
import { setupPostTracker } from '@/features/stats/post-tracker'
import { initTimeTracker } from '@/features/stats/logic/time-tracker'
```

```ts
// entrypoints/content/run-injections.ts:394
import('@/features/stats').then(
	({ completePendingThreadCreation, completePendingPostEdit, completePendingReply }) => {
		completePendingThreadCreation()
		completePendingPostEdit()
		completePendingReply()
	}
)
```

```ts
// features/stats/index.ts:22
export { ActivityGraph, ActivityGraphSkeleton } from './components/activity-graph'
export { RhythmClock } from './components/rhythm-clock'

// features/stats/index.ts:27
export { setupPostTracker, completePendingThreadCreation, completePendingPostEdit, completePendingReply } from './post-tracker'
```

Repo conventions to follow:

- Heavy features in `run-injections.ts` are dynamically imported by exact
  runtime module when possible.
- Keep content-script injections separated from options/dashboard UI.
- Do not remove public barrel exports unless all importers are checked.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Import check | `rg -n "import\\('@/features/stats'\\)" entrypoints/content` | no matches |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `entrypoints/content/run-injections.ts`
- `features/stats/index.ts` only if you choose to add an explanatory comment or
  remove now-unused content exports after checking all importers

**Out of scope**:

- `features/stats/post-tracker.ts` behavior
- `features/stats/logic/time-tracker.ts`
- Dashboard/options imports of `@/features/stats`
- Bundle analyzer setup

## Git workflow

- Branch: `advisor/014-direct-stats-content-import`
- Commit message style observed in repo: `fix(stats): import post tracker runtime directly`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Replace the thread-page dynamic import

In `entrypoints/content/run-injections.ts`, change the dynamic import from the
stats barrel to the post tracker module:

```ts
import('@/features/stats/post-tracker').then(
	({ completePendingThreadCreation, completePendingPostEdit, completePendingReply }) => {
		completePendingThreadCreation()
		completePendingPostEdit()
		completePendingReply()
	}
)
```

Keep the existing behavior and call order.

**Verify**:
`rg -n "import\\('@/features/stats'\\)" entrypoints/content`
-> no matches.

### Step 2: Decide whether to keep barrel exports

Check all imports of `@/features/stats`:

```powershell
rg -n "@/features/stats" .
```

If options/dashboard code still imports the barrel for components or shared
helpers, keep `features/stats/index.ts` exports as-is. The goal is only to stop
content runtime code from using the broad barrel.

Only remove the post-tracker exports from `features/stats/index.ts` if the
search proves no external importer uses them. If in doubt, keep the exports;
the direct content import is the meaningful fix.

**Verify**: `npm run compile` -> exit 0.

### Step 3: Check that desktop content still uses direct imports

Confirm `entrypoints/content/desktop-main.ts` still imports:

```ts
import { setupPostTracker } from '@/features/stats/post-tracker'
import { initTimeTracker } from '@/features/stats/logic/time-tracker'
```

No code change should be needed in this file.

**Verify**: `npm run compile` -> exit 0.

## Test plan

This is an import-boundary change. No new unit test is required unless an
existing test covers `runInjections` import paths.

Verification commands are sufficient:

- `rg -n "import\\('@/features/stats'\\)" entrypoints/content`
- `npm run compile`

## Done criteria

- [ ] `entrypoints/content/run-injections.ts` imports
  `@/features/stats/post-tracker` for pending completion functions.
- [ ] No content entrypoint dynamically imports `@/features/stats`.
- [ ] `npm run compile` exits 0.
- [ ] No post tracker behavior is changed.
- [ ] `plans/README.md` status row for plan 014 is updated.

## STOP conditions

Stop and report back if:

- `@/features/stats/post-tracker` cannot be imported directly from
  `run-injections.ts`.
- Removing any barrel export would affect an options/dashboard importer.
- The change unexpectedly requires modifying component code.

## Maintenance notes

- This keeps content runtime code away from dashboard UI exports. Future content
  imports should follow the same direct-module pattern.
- Plan 015 will further reduce unwanted coupling by moving pure rhythm helpers
  out of `time-tracker.ts`.
