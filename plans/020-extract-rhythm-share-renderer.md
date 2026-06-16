# Plan 020: Extract rhythm share summary and PNG rendering from the dialog

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- features/stats/components/rhythm-share-dialog.tsx features/stats/components/rhythm-share-dialog.test.tsx features/stats/logic/rhythm-share-summary.ts features/stats/logic/rhythm-share-summary.test.ts features/stats/logic/rhythm-share-image.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M/L
- **Risk**: MED
- **Depends on**: `plans/019-add-rhythm-ui-characterization-tests.md`
- **Category**: tech-debt
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

The share dialog is both a React dialog and a PNG rendering engine. That makes
every UX change around sharing riskier than it needs to be: scope selection,
copy/download behavior, summary derivation, canvas drawing, and file naming all
live in one large component. Extracting the summary builder and renderer into
small modules lets future share-image polish happen with tests around the data
contract and a thinner dialog.

## Current state

- `features/stats/components/rhythm-share-dialog.tsx` contains:
  - share summary construction
  - canvas drawing helpers
  - PNG blob creation
  - React dialog state and UI
- The file is large and has many internal functions that cannot be imported
  directly by tests.

Relevant excerpts:

```ts
// features/stats/components/rhythm-share-dialog.tsx:304
function buildShareSummary(
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:589
function drawBackground(ctx: CanvasRenderingContext2D): void {
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:916
function drawBars(ctx: CanvasRenderingContext2D, summary: ShareSummary, titleY: number): void {
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:1027
async function createShareImageBlob(summary: ShareSummary): Promise<Blob> {
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:1064
export function RhythmShareDialog({
```

```ts
// features/stats/components/rhythm-share-dialog.tsx:1143
const summary = useMemo(
	() => buildShareSummary(stats, scope, weekKey, weekday, username),
	[stats, scope, weekKey, weekday, username]
)
```

Repo convention to match:

- Pure derivations for rhythm already live in `features/stats/logic`, for
  example `rhythm-insights.ts` and `rhythm-share-availability.ts`.
- UI components stay under `features/stats/components`.
- Tests are colocated beside source.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Share summary tests | `npm run test:run -- features/stats/logic/rhythm-share-summary.test.ts` | exit 0; new pure tests pass |
| Share dialog tests | `npm run test:run -- features/stats/components/rhythm-share-dialog.test.tsx` | exit 0; characterization tests still pass |
| Existing rhythm tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0 |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/components/rhythm-share-dialog.tsx`
- `features/stats/components/rhythm-share-dialog.test.tsx`
- `features/stats/logic/rhythm-share-summary.ts` (create)
- `features/stats/logic/rhythm-share-summary.test.ts` (create)
- `features/stats/logic/rhythm-share-image.ts` (create)

**Out of scope**:

- Changing visual design of the PNG
- Changing share availability thresholds
- Changing dialog copy unless required by moved imports
- Changing `RhythmClock`
- Adding upload/share-to-network behavior

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits, for example
  `refactor(stats): extract rhythm share renderer`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Extract pure summary types and builder

Create `features/stats/logic/rhythm-share-summary.ts`.

Move these items out of `rhythm-share-dialog.tsx`:

- `ShareScope` type, if currently local
- `ShareSummary` type and supporting summary types
- `buildShareSummary`
- pure helper functions used only to build the summary, bars, metrics, forum
  lists, labels, filenames, and formatted values

Keep the exported API small:

```ts
export type ShareScope = 'year' | 'last30' | 'week' | 'weekday'
export interface ShareSummary { ... }
export function buildShareSummary(...): ShareSummary
```

Do not move React imports into this module. It must stay DOM/React-free.

**Verify**:
`rg "function buildShareSummary|export function buildShareSummary|from '../logic/rhythm-share-summary'|from '@/features/stats/logic/rhythm-share-summary'" features/stats`
-> the function is exported from the new logic module and imported by the
dialog.

### Step 2: Add pure summary tests

Create `features/stats/logic/rhythm-share-summary.test.ts`.

Use `createEmptyRhythm()` and explicit data assignments.

Cover:

- year summary chooses current-year days only
- last-30 summary uses recent days only
- week summary uses the selected week
- weekday summary uses the selected weekday
- filename includes the selected scope and username-safe value
- top forums are derived from the relevant scope where possible

Use existing date helpers from rhythm logic when available. If the builder uses
`new Date()`, add a `now` parameter or test with `vi.setSystemTime()`.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm-share-summary.test.ts`
-> exit 0.

### Step 3: Extract the PNG renderer

Create `features/stats/logic/rhythm-share-image.ts`.

Move canvas-only code out of the dialog:

- draw helpers
- canvas constants
- `createShareImageBlob(summary)`

The renderer may depend on DOM canvas types, but it must not import React.

Export:

```ts
export async function createShareImageBlob(summary: ShareSummary): Promise<Blob>
```

Import `ShareSummary` from `rhythm-share-summary.ts`.

**Verify**:
`rg "function drawBackground|function drawBars|createShareImageBlob" features/stats/components/rhythm-share-dialog.tsx features/stats/logic/rhythm-share-image.ts`
-> drawing helpers and blob creation live in `rhythm-share-image.ts`, not in
the dialog.

### Step 4: Thin the dialog

Update `features/stats/components/rhythm-share-dialog.tsx` so it imports:

- `ShareScope` and `buildShareSummary` from
  `features/stats/logic/rhythm-share-summary`
- `createShareImageBlob` from
  `features/stats/logic/rhythm-share-image`

The dialog should keep only:

- React state
- availability calculations
- scope controls
- copy/download actions
- preview state
- JSX

Do not change the visible layout in this plan.

**Verify**:
`rg "function buildShareSummary|function drawBackground|async function createShareImageBlob" features/stats/components/rhythm-share-dialog.tsx`
-> no matches.

### Step 5: Run characterization and regression tests

Run the tests added by plan 019 plus the new summary tests.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-share-dialog.test.tsx features/stats/logic/rhythm-share-summary.test.ts`
-> exit 0.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> exit 0.

### Step 6: Typecheck

Run the repo typecheck.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- New pure tests for `rhythm-share-summary.ts`.
- Existing dialog characterization tests from plan 019 must still pass.
- Existing rhythm model and availability tests must still pass.
- Do not add brittle pixel tests for the PNG in this plan.

## Done criteria

- [ ] `rhythm-share-dialog.tsx` no longer defines `buildShareSummary`.
- [ ] `rhythm-share-dialog.tsx` no longer defines canvas draw helpers.
- [ ] `rhythm-share-dialog.tsx` no longer defines `createShareImageBlob`.
- [ ] `rhythm-share-summary.ts` has pure tests.
- [ ] Share dialog characterization tests still pass.
- [ ] `npm run compile` exits 0.
- [ ] No visual redesign is included.

## STOP conditions

Stop and report back if:

- Moving summary code would require changing share output semantics.
- Canvas code has hidden dependencies on React state or component-local values
  that cannot be cleanly passed through `ShareSummary`.
- The plan 019 characterization tests are missing or failing before this work
  starts.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

After this extraction, future visual changes to the PNG should happen mostly in
`rhythm-share-image.ts`, while scope/metric behavior should be tested in
`rhythm-share-summary.test.ts`. Keep the dialog thin.
