# Plan 017: Make the rhythm time tracker idempotent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- features/stats/logic/time-tracker.ts features/stats/logic/time-tracker.test.ts entrypoints/content/desktop-main.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/016-honor-default-rhythm-tracking.md`
- **Category**: bug
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

The tracker owns real user time data. Today every call to `initTimeTracker()`
adds two intervals and two event listeners with no cleanup or idempotency
guard. If the content entrypoint is ever loaded twice in the same document
during extension reloads, HMR, reinjection, or future navigation changes, time
can be counted twice and storage writes can duplicate.

## Current state

- `entrypoints/content/desktop-main.ts` calls `initTimeTracker()` once during
  content bootstrap.
- `features/stats/logic/time-tracker.ts` does not store interval IDs or
  listener references.
- `initTimeTracker()` currently returns `void`, so callers can ignore the
  cleanup without breaking.

Relevant excerpts:

```ts
// entrypoints/content/desktop-main.ts:269
setupPostTracker()
initTimeTracker()
```

```ts
// features/stats/logic/time-tracker.ts:38
let unsavedSeconds = 0
let currentSubforum = ''
let saveQueue: Promise<void> = Promise.resolve()
```

```ts
// features/stats/logic/time-tracker.ts:99
export function initTimeTracker(): void {
```

```ts
// features/stats/logic/time-tracker.ts:109
setInterval(() => {
	if (document.visibilityState === 'visible') {
		unsavedSeconds++
	}
}, TRACK_INTERVAL_MS)
```

```ts
// features/stats/logic/time-tracker.ts:122
document.addEventListener('visibilitychange', () => {
```

```ts
// features/stats/logic/time-tracker.ts:128
window.addEventListener('beforeunload', () => {
```

Repo convention to match:

- Content runtime setup should be safe if an injection/bootstrap path is called
  more than once. Existing content code already guards injection runs in
  `entrypoints/content/desktop-main.ts`.
- Use `logger`, not `console.*`.
- Keep the public `initTimeTracker()` call compatible with existing callers.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tracker tests | `npm run test:run -- features/stats/logic/time-tracker.test.ts` | exit 0; lifecycle tests pass |
| Content compile check | `npm run compile` | exit 0; no TypeScript errors |
| Existing handler tests | `npm run test:run -- entrypoints/background/stats-handlers.test.ts` | exit 0; no regressions |

## Scope

**In scope**:

- `features/stats/logic/time-tracker.ts`
- `features/stats/logic/time-tracker.test.ts`

**Read-only context**:

- `entrypoints/content/desktop-main.ts`

**Out of scope**:

- Changing the content bootstrap sequence
- Changing background messaging contracts
- Changing how subforum slugs are detected
- Heatmap/post tracking
- Share dialog UI

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits, for example
  `fix(stats): make rhythm tracker idempotent`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add tracker lifecycle state

In `features/stats/logic/time-tracker.ts`, add module-level lifecycle state:

```ts
let trackerCleanup: (() => void) | null = null
```

Change `initTimeTracker()` to return `() => void` while preserving existing
callers that ignore the return value:

```ts
export function initTimeTracker(): () => void {
```

At the top of `initTimeTracker()`, after confirming the page has a valid
subforum, return the existing cleanup if the tracker is already active:

```ts
if (trackerCleanup) return trackerCleanup
```

Use `window.setInterval` and store both interval IDs. Store named listener
functions for `visibilitychange` and `beforeunload`, then build a cleanup
function that clears intervals and removes those exact listener references.

The cleanup should set `trackerCleanup = null`. It should not reset persisted
storage and should not clear `unsavedSeconds` unless the tests need a separate
test-only reset helper.

**Verify**:
`rg "trackerCleanup|clearInterval|removeEventListener|export function initTimeTracker" features/stats/logic/time-tracker.ts`
-> all lifecycle pieces are present.

### Step 2: Add a test-only reset helper if needed

If tests need to isolate module state, export a narrowly named helper from
`time-tracker.ts`:

```ts
export function resetTimeTrackerForTest(): void {
	trackerCleanup?.()
	trackerCleanup = null
	unsavedSeconds = 0
	currentSubforum = ''
	saveQueue = Promise.resolve()
}
```

Keep this helper simple and only use it from tests. Do not call it from
production code.

**Verify**:
`rg "resetTimeTrackerForTest" features/stats/logic/time-tracker.ts features/stats/logic/time-tracker.test.ts`
-> if the helper exists, it is used only by the test file.

### Step 3: Add fake-timer lifecycle tests

Extend `features/stats/logic/time-tracker.test.ts`.

Mock these modules before importing `time-tracker.ts`:

- `@/lib/url-helpers`: return a stable thread id and
  `{ slug: 'off-topic' }`.
- `@/store`: `getSettings` resolves to `{}` or
  `{ enableRhythmTracking: true }`.
- `@/lib/messaging`: `sendMessage` resolves to `{ success: true }`.

Use `vi.useFakeTimers()` and reset state in `afterEach`.

Add tests for:

1. Calling `initTimeTracker()` twice creates only one active tracker. Advance
   31 seconds and assert only one 30 second chunk is sent, not two.
2. The cleanup returned by `initTimeTracker()` stops future counting. After
   cleanup, advance another 31 seconds and assert no extra message is sent.
3. The existing explicit false behavior remains: with
   `{ enableRhythmTracking: false }`, no message is sent.

If jsdom's `document.visibilityState` is not writable, define it with
`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })`
inside the test setup.

**Verify**:
`npm run test:run -- features/stats/logic/time-tracker.test.ts`
-> exit 0; lifecycle tests pass.

### Step 4: Check handler regressions and type safety

Run the focused background handler tests and compile.

**Verify**:
`npm run test:run -- entrypoints/background/stats-handlers.test.ts`
-> exit 0.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- Extend `features/stats/logic/time-tracker.test.ts`.
- Cover double initialization, cleanup, and explicit disabled settings.
- Use fake timers rather than real time.
- Keep tests isolated with `resetTimeTrackerForTest()` if needed.

## Done criteria

- [ ] `initTimeTracker()` returns a cleanup function.
- [ ] Repeated `initTimeTracker()` calls do not add duplicate intervals or
  duplicate listeners.
- [ ] Cleanup clears both intervals and removes both event listeners.
- [ ] Focused time-tracker tests exit 0.
- [ ] `npm run compile` exits 0.
- [ ] No files outside the in-scope list are modified, except
  `plans/README.md` status if the executor is responsible for updating it.

## STOP conditions

Stop and report back if:

- `desktop-main.ts` has changed so `initTimeTracker()` is now called per route
  or per subforum inside a single document. That requires a route-aware design,
  not a simple idempotency guard.
- The fake-timer test cannot be isolated without changing global test setup.
- Fixing this requires changing the background messaging API.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

If Mediavida navigation becomes SPA-like later, this tracker may need a
route-aware `restartTimeTrackerForSubforum(slug)` shape. This plan intentionally
does not add that abstraction because the current content entrypoint calls the
tracker as a page-level singleton.
