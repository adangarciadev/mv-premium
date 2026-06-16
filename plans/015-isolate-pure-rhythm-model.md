# Plan 015: Isolate the pure rhythm model from tracker runtime

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ff93b10..HEAD -- features/stats/logic/time-tracker.ts features/stats/logic/rhythm-insights.ts features/stats/logic/rhythm-share-availability.ts features/stats/components/rhythm-share-dialog.tsx features/stats/logic/rhythm.test.ts entrypoints/background/stats-handlers.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/012-serialize-rhythm-stat-writes.md`, `plans/014-import-stats-content-runtime-directly.md`
- **Category**: tech-debt
- **Planned at**: commit `ff93b10`, 2026-06-16

## Why this matters

The rhythm clock has genuinely pure model logic: date keys, week keys,
normalization, accumulation, and derived insights. Today some of that pure logic
lives in `time-tracker.ts`, the same module that imports WXT storage, settings,
URL helpers, and content-script lifecycle code. Moving the model into a pure
module makes rhythm tests cheaper, keeps UI/share code away from content
runtime concerns, and gives the clock a cleaner foundation for future work.

## Current state

- `time-tracker.ts` mixes pure rhythm helpers and content/runtime persistence.
- `rhythm-insights.ts` says it is pure, but imports runtime values from
  `time-tracker.ts`.
- `rhythm-share-dialog.tsx` imports date helpers and `RhythmStats` from
  `time-tracker.ts`.
- `rhythm-share-availability.ts` has only a type import today, but should move
  to the new pure type source for consistency.

Relevant excerpts:

```ts
// features/stats/logic/time-tracker.ts:1
import { storage } from '#imports'
```

```ts
// features/stats/logic/time-tracker.ts:30
export interface RhythmStats {
	hours: number[] // length 24 (0-23), milliseconds
	weekdays: number[] // length 7 (0 = Sunday), milliseconds
```

```ts
// features/stats/logic/time-tracker.ts:99
export function getDayKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
```

```ts
// features/stats/logic/time-tracker.ts:187
export function accumulateRhythm(stats: RhythmStats, ms: number, date: Date, subforum?: string): RhythmStats {
	const next = normalizeRhythm(stats)
```

```ts
// features/stats/logic/rhythm-insights.ts:1
/**
 * Pure derivations for the "Tiempo en Mediavida" clock. No DOM / storage here so they can
 * be unit-tested in isolation.
 */
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from './time-tracker'
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:27
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from '../logic/time-tracker'
```

Repo conventions to follow:

- Put pure logic under `features/stats/logic/`.
- Keep user-facing copy Spanish, code identifiers/comments English.
- Use type-only imports when only types are needed.
- Keep public exports backwards-compatible unless all importers are updated.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Import check | `rg -n "from './time-tracker'|from '../logic/time-tracker'" features/stats` | only runtime imports remain; pure insight/share modules no longer import helpers from time-tracker |
| Rhythm tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0; all rhythm tests pass |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/logic/rhythm-model.ts` (create)
- `features/stats/logic/time-tracker.ts`
- `features/stats/logic/rhythm-insights.ts`
- `features/stats/logic/rhythm-share-availability.ts`
- `features/stats/components/rhythm-share-dialog.tsx`
- `features/stats/logic/rhythm.test.ts`
- `features/stats/logic/rhythm-share-availability.test.ts`
- `features/stats/index.ts`
- `entrypoints/background/stats-handlers.ts` if plan 012 has landed

**Out of scope**:

- React UI redesign
- Share availability copy/threshold changes
- Activity heatmap/post tracker behavior
- Storage schema migrations beyond preserving existing rhythm data shape

## Git workflow

- Branch: `advisor/015-isolate-pure-rhythm-model`
- Commit message style observed in repo: `refactor(stats): isolate pure rhythm model`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Create the pure rhythm model module

Create `features/stats/logic/rhythm-model.ts`.

Move or copy these pure exports from `time-tracker.ts`:

- `RhythmStats`
- `createEmptyRhythm`
- `getDayKey`
- `getWeekStart`
- `getWeekKey`
- `normalizeRhythm`
- `accumulateRhythm`

Also move the pruning helpers if plan 012 needed them outside
`time-tracker.ts`:

- `keepTopSubforums`
- `pruneSubforumBuckets`
- `pruneDaySubforums`
- `pruneRhythmStats`

Export only the helpers that callers need. A good public surface is:

```ts
export interface RhythmStats { ... }
export function createEmptyRhythm(): RhythmStats
export function getDayKey(date: Date): string
export function getWeekStart(date: Date): Date
export function getWeekKey(date: Date): string
export function normalizeRhythm(stats: Partial<RhythmStats> | null | undefined): RhythmStats
export function accumulateRhythm(...)
export function prepareRhythmStatsForStorage(stats: RhythmStats): RhythmStats
```

`prepareRhythmStatsForStorage` can wrap the current private
`pruneRhythmStats` behavior. Keep the existing caps:

- `MAX_DAY_SUBFORUM_DAYS = 400`
- `MAX_SUBFORUMS_PER_DAY = 8`
- `MAX_SUBFORUMS_PER_HOUR = 16`
- `MAX_SUBFORUMS_PER_WEEKDAY = 16`

Do not import `#imports`, `logger`, `getSettings`, URL helpers, DOM APIs, or
React from `rhythm-model.ts`.

**Verify**:
`rg -n "#imports|logger|getSettings|getThreadId|getSubforumInfo|document|window|react" features/stats/logic/rhythm-model.ts`
-> no matches.

### Step 2: Update `time-tracker.ts` to consume the pure model

In `features/stats/logic/time-tracker.ts`:

- Remove the local definitions moved to `rhythm-model.ts`.
- Import them from `./rhythm-model`.
- Keep re-export compatibility for current importers:

```ts
export {
	accumulateRhythm,
	createEmptyRhythm,
	getDayKey,
	getWeekKey,
	getWeekStart,
	normalizeRhythm,
	type RhythmStats,
} from './rhythm-model'
```

- Update `writeRhythmStats` to call
  `prepareRhythmStatsForStorage(stats)` from the new module.
- Keep storage functions (`getRhythmStats`, `clearRhythmStats`,
  `watchRhythmStats`) in `time-tracker.ts`.

This step should not change runtime behavior.

**Verify**: `npm run compile` -> exit 0.

### Step 3: Move pure consumers off `time-tracker.ts`

Update pure or UI modules that only need model helpers/types:

- `features/stats/logic/rhythm-insights.ts`:

```ts
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from './rhythm-model'
```

- `features/stats/components/rhythm-share-dialog.tsx`:

```ts
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from '../logic/rhythm-model'
```

- `features/stats/logic/rhythm-share-availability.ts`:

```ts
import type { RhythmStats } from './rhythm-model'
```

- `features/stats/logic/rhythm-share-availability.test.ts`:

```ts
import type { RhythmStats } from './rhythm-model'
```

- `features/stats/logic/rhythm.test.ts`: import model helpers from
  `./rhythm-model`, and keep insight imports from `./rhythm-insights`.

If plan 012 created `entrypoints/background/stats-handlers.ts`, update it to
import rhythm helpers from `@/features/stats/logic/rhythm-model`, not
`time-tracker.ts`.

**Verify**:
`rg -n "from './time-tracker'|from '../logic/time-tracker'|features/stats/logic/time-tracker" features/stats entrypoints/background`
-> only modules that need storage/tracker runtime import `time-tracker.ts`.

### Step 4: Export the pure model from the stats barrel

In `features/stats/index.ts`, add explicit exports for the pure model module:

```ts
export {
	accumulateRhythm,
	createEmptyRhythm,
	getDayKey,
	getWeekKey,
	getWeekStart,
	normalizeRhythm,
	prepareRhythmStatsForStorage,
	type RhythmStats,
} from './logic/rhythm-model'
```

Then review the existing `export * from './logic/time-tracker'`. If keeping it
causes duplicate export ambiguity, replace it with explicit runtime exports:

```ts
export {
	getTimeStats,
	watchTimeStats,
	getRhythmStats,
	clearRhythmStats,
	generateRandomRhythm,
	seedRandomRhythmStats,
	watchRhythmStats,
	initTimeTracker,
	timeStatsStorage,
	type TimeStats,
} from './logic/time-tracker'
```

Prefer explicit exports if TypeScript reports duplicate names. Do not remove a
public export unless it is re-exported from `rhythm-model.ts`.

**Verify**: `npm run compile` -> exit 0.

### Step 5: Run focused rhythm tests

Run the rhythm tests after the import move.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> all tests pass.

## Test plan

- Update `features/stats/logic/rhythm.test.ts` imports so it directly exercises
  `rhythm-model.ts`.
- Existing test cases for `createEmptyRhythm`, `normalizeRhythm`,
  `getWeekStart`, `getWeekKey`, and `accumulateRhythm` should remain unchanged.
- Existing share availability tests should continue to pass with the type import
  moved to the pure model.

## Done criteria

- [ ] `features/stats/logic/rhythm-model.ts` exists and has no runtime/storage,
  DOM, React, or logger imports.
- [ ] `rhythm-insights.ts` no longer imports from `time-tracker.ts`.
- [ ] `rhythm-share-dialog.tsx` no longer imports from `time-tracker.ts`.
- [ ] `rhythm-share-availability.ts` no longer imports from `time-tracker.ts`.
- [ ] Existing public exports remain available either from `rhythm-model.ts` or
  explicit `time-tracker.ts` barrel exports.
- [ ] `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` exits 0.
- [ ] `npm run compile` exits 0.
- [ ] No heatmap/post tracker behavior is modified.
- [ ] `plans/README.md` status row for plan 015 is updated.

## STOP conditions

Stop and report back if:

- Plan 012 has not landed but this plan is being executed as part of the ordered
  batch. Ask whether to execute 012 first or adjust this plan.
- Moving helpers changes any serialized rhythm data shape.
- `rhythm-model.ts` needs to import `#imports`, storage, DOM, React, or logger.
- TypeScript duplicate exports cannot be resolved without removing a public
  export.
- Verification fails twice after a reasonable fix attempt.

## Maintenance notes

- After this lands, new rhythm/reloj logic should default to importing from
  `rhythm-model.ts` or `rhythm-insights.ts`, not `time-tracker.ts`.
- `time-tracker.ts` should become mostly content lifecycle plus persistence
  facade. Resist putting new pure derivations back into it.
