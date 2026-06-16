# Plan 021: Polish rhythm clock share readiness and accessibility

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- features/stats/components/rhythm-clock.tsx features/stats/components/rhythm-clock.test.tsx features/stats/logic/rhythm-share-availability.ts features/stats/logic/rhythm-share-availability.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/019-add-rhythm-ui-characterization-tests.md`
- **Category**: direction
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

The rhythm clock is the primary stats experience. It already has useful data
and a share dialog, but the path from "I have some data" to "I can share a
meaningful PNG" is not visible until the user opens the dialog. Also, the clock
hour wedges are mouse-friendly but not keyboard-friendly. This plan adds clear
share readiness feedback and makes hour exploration more accessible without
changing the core visual identity.

## Current state

- The clock always shows a `Compartir` button that opens the dialog.
- Share availability requires 1 hour in at least one relevant scope.
- The clock considers 1 minute enough for basic insights.
- SVG hour wedges have mouse enter and click handlers, but no role,
  `tabIndex`, keyboard activation, or `aria-pressed`.

Relevant excerpts:

```tsx
// features/stats/components/rhythm-clock.tsx:842
<button
	type="button"
	onClick={() => setShareOpen(true)}
	className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/45 hover:bg-primary/15"
	aria-label="Compartir resumen"
	title="Compartir resumen"
>
```

```ts
// features/stats/logic/rhythm-insights.ts:22
export function hasEnoughRhythmData(stats: RhythmStats, minMs = 60_000): boolean {
```

```ts
// features/stats/logic/rhythm-share-availability.ts:5
export const MIN_SHARE_RHYTHM_MS = 60 * 60_000
```

```tsx
// features/stats/components/rhythm-clock.tsx:941
style={{ cursor: 'pointer' }}
onMouseEnter={() => setHoverHour(hour)}
onClick={() => setPinnedHour(prev => (prev === hour ? null : hour))}
```

Repo convention to match:

- Use direct lucide imports if adding icons.
- Prefer familiar controls and accessible labels for interactive UI.
- Do not add visible instructions explaining keyboard shortcuts. Use labels,
  titles, popovers, and state chips where helpful.
- Cards should stay restrained and consistent with the existing dashboard.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Availability tests | `npm run test:run -- features/stats/logic/rhythm-share-availability.test.ts` | exit 0; new readiness tests pass |
| Clock tests | `npm run test:run -- features/stats/components/rhythm-clock.test.tsx` | exit 0; UX/accessibility tests pass |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/components/rhythm-clock.tsx`
- `features/stats/components/rhythm-clock.test.tsx`
- `features/stats/logic/rhythm-share-availability.ts`
- `features/stats/logic/rhythm-share-availability.test.ts`

**Out of scope**:

- Changing the 1 hour share threshold
- Changing the 1 minute insight threshold
- Redesigning the PNG
- Extracting the share renderer
- Heatmap/activity graph
- New dashboard sections or landing-style UI

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits, for example
  `feat(stats): show rhythm share readiness`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add a share readiness helper

In `features/stats/logic/rhythm-share-availability.ts`, add a helper that
summarizes the best current share progress without changing existing APIs:

```ts
export interface RhythmShareReadiness {
	canShare: boolean
	currentMs: number
	minMs: number
	remainingMs: number
	bestScope: RhythmShareScope
}

export function getRhythmShareReadiness(
	stats: RhythmStats,
	now = new Date(),
	minMs = MIN_SHARE_RHYTHM_MS
): RhythmShareReadiness
```

The helper should inspect the same four buckets as
`hasAnyShareableRhythmScope()`:

- current year
- last 30 days
- best week
- best weekday

It should return the scope with the highest current progress toward `minMs`.
If any scope is shareable, `canShare` is true and `remainingMs` is 0.

Do not remove or change `getRhythmShareAvailability()` or
`hasAnyShareableRhythmScope()`.

**Verify**:
`rg "RhythmShareReadiness|getRhythmShareReadiness" features/stats/logic/rhythm-share-availability.ts`
-> helper is present.

### Step 2: Test share readiness

Extend `features/stats/logic/rhythm-share-availability.test.ts`.

Add tests for:

- empty stats: `canShare === false`, `remainingMs === MIN_SHARE_RHYTHM_MS`
- partial stats: chooses the most progressed scope and reports the remaining
  time
- shareable stats: `canShare === true`, `remainingMs === 0`

Use explicit dates and `now` parameters; avoid relying on the real current
date.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm-share-availability.test.ts`
-> exit 0.

### Step 3: Show readiness beside the share action

In `features/stats/components/rhythm-clock.tsx`, import
`getRhythmShareReadiness`.

Compute readiness with `useMemo`.

Near the `Compartir` button, add a compact chip:

- If `canShare`, show copy like `Listo para compartir`.
- If not shareable but there is some rhythm data, show copy like
  `Faltan 23m para compartir`.
- If no rhythm data, do not add noisy extra copy beyond the existing empty
  state.

Use existing formatting helpers in the component where possible. Keep the chip
small, subdued, and non-blocking. The share button may still open the dialog so
the user can see detailed reasons; do not disable it in this plan.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-clock.test.tsx`
-> existing tests still pass before adding new assertions.

### Step 4: Make hour wedges keyboard-accessible

Update the hour `<path>` elements in `RhythmClock` so they expose button-like
semantics:

- `role="button"`
- `tabIndex={0}`
- `aria-label` with the hour range and time
- `aria-pressed={!inDay && pinnedHour === hour}`
- `onFocus={() => setHoverHour(hour)}`
- `onBlur={() => setHoverHour(null)}`
- `onKeyDown` that toggles the pinned hour for `Enter` and space

Keep mouse behavior unchanged. If `inDay` mode should not visually pin hours,
make keyboard behavior match the current click behavior or explicitly ignore
pinning in day mode; do not create a new behavior only for keyboard users.

**Verify**:
`rg "role=\"button\"|aria-pressed|onKeyDown|tabIndex" features/stats/components/rhythm-clock.tsx`
-> the SVG hour controls have accessible interactive attributes.

### Step 5: Extend clock tests

Extend `features/stats/components/rhythm-clock.test.tsx`.

Add tests for:

- partial data shows the share readiness chip with remaining time
- shareable data shows the ready chip
- an hour wedge can be focused and activated with keyboard

Use role/name queries for the hour wedge if possible:

```ts
screen.getByRole('button', { name: /00:00/i })
```

If SVG roles are unreliable in jsdom, query by `aria-label` as a fallback.

**Verify**:
`npm run test:run -- features/stats/components/rhythm-clock.test.tsx`
-> exit 0.

### Step 6: Typecheck

Run the repo typecheck.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- Add helper tests in `rhythm-share-availability.test.ts`.
- Extend `rhythm-clock.test.tsx` from plan 019.
- Verify keyboard activation and share readiness copy.
- Do not add screenshot tests in this plan.

## Done criteria

- [ ] The clock communicates whether sharing is ready or how much time remains.
- [ ] The share button still opens the dialog.
- [ ] The 1 hour sharing threshold is unchanged.
- [ ] SVG hour wedges are keyboard-focusable and keyboard-activatable.
- [ ] Availability tests exit 0.
- [ ] Clock component tests exit 0.
- [ ] `npm run compile` exits 0.

## STOP conditions

Stop and report back if:

- Adding keyboard semantics to SVG paths is unreliable in the target browsers
  and would require a larger control redesign.
- The readiness helper duplicates too much private logic from
  `rhythm-share-availability.ts`; refactor shared helpers instead of copying
  divergent formulas.
- Product direction changes and the share threshold is no longer 1 hour.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

This plan intentionally keeps the share dialog available even when no scope can
be exported, because the dialog contains the detailed explanation. The chip is
just the lightweight dashboard-level signal.
