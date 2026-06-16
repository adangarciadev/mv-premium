# Plan 019: Add characterization tests for the rhythm clock and share dialog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- features/stats/components/rhythm-clock.tsx features/stats/components/rhythm-share-dialog.tsx features/stats/components/rhythm-clock.test.tsx features/stats/components/rhythm-share-dialog.test.tsx features/stats/logic/rhythm-model.ts features/stats/logic/rhythm-share-availability.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/016-honor-default-rhythm-tracking.md`, `plans/017-make-time-tracker-idempotent.md`, `plans/018-validate-rhythm-time-chunks.md`
- **Category**: tests
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

The rhythm clock and share dialog are now core product surfaces. They contain
many states: empty, insufficient data, enough data, weekday view, weekly view,
selected day, selected week, share scope availability, copy/download fallback,
and preview rendering. Existing tests cover the pure model and share
availability logic, but there are no component tests guarding the user-visible
behavior. Before extracting the share renderer or polishing UX, add focused
characterization tests so future changes have rails.

## Current state

- `features/stats/components/rhythm-clock.tsx` is a large interactive React
  component.
- `features/stats/components/rhythm-share-dialog.tsx` contains the dialog UI
  and the PNG canvas generation.
- Existing stats tests are only logic/storage tests.
- The repo already uses React Testing Library in nearby components.

Relevant excerpts:

```ts
// features/stats/components/rhythm-clock.tsx:708
const [pinnedHour, setPinnedHour] = useState<number | null>(null)
const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null)
const [shareOpen, setShareOpen] = useState(false)
```

```tsx
// features/stats/components/rhythm-clock.tsx:842
<button
	type="button"
	onClick={() => setShareOpen(true)}
```

```tsx
// features/stats/components/rhythm-clock.tsx:1194
<WeekdayStrip
	stats={stats}
	counts={weekdayCounts}
	selected={selectedWeekday}
	onSelect={selectWeekday}
	showPeak={hasEnoughData}
/>
```

```tsx
// features/stats/components/rhythm-clock.tsx:1214
<RhythmShareDialog
	open={shareOpen}
	onOpenChange={setShareOpen}
	stats={stats}
	username={username}
	selectedWeekKey={selectedWeekKey}
	selectedWeekday={selectedWeekday}
/>
```

```tsx
// features/stats/components/rhythm-share-dialog.tsx:1414
{!canExportSelectedScope ? (
	<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
```

React Testing Library pattern already exists:

```ts
// features/mobile-lite/components/ignored-users-import-panel.test.tsx:1
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Clock tests | `npm run test:run -- features/stats/components/rhythm-clock.test.tsx` | exit 0; new clock tests pass |
| Share dialog tests | `npm run test:run -- features/stats/components/rhythm-share-dialog.test.tsx` | exit 0; new dialog tests pass |
| Existing logic tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0 |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/components/rhythm-clock.test.tsx` (create)
- `features/stats/components/rhythm-share-dialog.test.tsx` (create)
- Minimal testability-only changes in:
  - `features/stats/components/rhythm-clock.tsx`
  - `features/stats/components/rhythm-share-dialog.tsx`

**Out of scope**:

- Visual redesign
- Extracting canvas generation
- Changing share thresholds
- Changing rhythm model math
- Snapshot tests of the full component tree
- Heatmap/activity graph tests

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits, for example
  `test(stats): cover rhythm clock states`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add local rhythm test builders

In the new test files, create small helpers that build `RhythmStats` from
`createEmptyRhythm()`:

- `makeEmptyStats()`
- `makeInsufficientStats()` with less than `MIN_SHARE_RHYTHM_MS`
- `makeShareableStats()` with at least one hour in the current year and enough
  hour/weekday/subforum data to render insights

Prefer explicit assignments over random data. Do not import
`generateRandomRhythm()` because tests should be deterministic.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-clock.test.tsx`
-> the file compiles, even before all cases are added.

### Step 2: Test key `RhythmClock` states

Create `features/stats/components/rhythm-clock.test.tsx`.

Use React Testing Library and follow the style of
`features/mobile-lite/components/ignored-users-import-panel.test.tsx`.

Add tests for:

1. Empty stats render the card title and the empty state text
   `Aun sin datos` or the exact live copy if accents are present.
2. Insufficient stats render `Pocos datos` and do not show mature insight
   values as if they were reliable.
3. Shareable stats render:
   - `Tiempo en Mediavida`
   - the share button
   - `Media diaria general`
   - `Donde` panel content for at least one subforum
4. Clicking a weekday bar with data selects that weekday and shows the selected
   weekday state.

If exact accented strings are hard to match due encoding, use role/name queries
or regexes that match stable words such as `/Tiempo en Mediavida/i` and
`/Compartir/i`.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-clock.test.tsx`
-> exit 0.

### Step 3: Test insufficient-share behavior without canvas mocks

Create `features/stats/components/rhythm-share-dialog.test.tsx`.

Start with tests where the selected scope cannot be exported. This path does
not need a real canvas preview because the component renders `Datos
insuficientes`.

Add tests for:

1. With `open={true}` and empty stats, the dialog shows `Compartir resumen`.
2. Disabled summary options explain why they cannot be shared.
3. `Copiar imagen` and `Descargar PNG` are disabled when no selected scope can
   be exported.
4. The preview area shows `Datos insuficientes`, not `Preparando imagen`, when
   sharing is unavailable.

Avoid testing successful canvas generation in this plan. Plan 020 will extract
the renderer and make that easier to mock/test cleanly.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-share-dialog.test.tsx`
-> exit 0.

### Step 4: Add minimal test IDs only if accessible queries fail

Prefer semantic queries: `getByRole`, `getByText`, `getByLabelText`.

If a state cannot be reached reliably because the current component has no
accessible hook, add a minimal `aria-label` or `data-testid`. Prefer
`aria-label` when it improves accessibility. Keep any production changes tiny
and directly tied to a test.

**Verify**:
`git diff -- features/stats/components/rhythm-clock.tsx features/stats/components/rhythm-share-dialog.tsx`
-> any component changes are small and testability/accessibility related.

### Step 5: Run regression checks

Run logic tests and typecheck.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> exit 0.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- New tests:
  - `features/stats/components/rhythm-clock.test.tsx`
  - `features/stats/components/rhythm-share-dialog.test.tsx`
- Existing tests:
  - `features/stats/logic/rhythm.test.ts`
  - `features/stats/logic/rhythm-share-availability.test.ts`
- Avoid snapshots. Test behavior and visible states.

## Done criteria

- [ ] `RhythmClock` has component tests for empty, insufficient, shareable, and
  weekday-selection states.
- [ ] `RhythmShareDialog` has component tests for unavailable sharing states.
- [ ] Tests do not depend on generated random rhythm data.
- [ ] Tests do not require a real canvas for the unavailable-share path.
- [ ] `npm run compile` exits 0.
- [ ] No unrelated component redesign is included.

## STOP conditions

Stop and report back if:

- Radix Dialog/Popover portals make the component tests unreliable without a
  broader test harness.
- The tests require mocking half the UI library to pass.
- The only way to test a state is to redesign the component.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

These are characterization tests, not exhaustive visual QA. Keep them focused
on user-visible states and accessibility hooks so later plans can refactor the
share renderer and polish the clock with confidence.
