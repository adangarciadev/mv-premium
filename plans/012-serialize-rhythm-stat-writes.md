# Plan 012: Serialize rhythm stat writes through the background context

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ff93b10..HEAD -- features/stats/logic/time-tracker.ts lib/messaging.ts entrypoints/background/index.ts entrypoints/background/stats-handlers.ts entrypoints/background/stats-handlers.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/011-make-wxt-storage-mock-stateful.md`
- **Category**: bug
- **Planned at**: commit `ff93b10`, 2026-06-16

## Why this matters

The rhythm clock is meant to represent a user's real browsing life on
Mediavida. Today each content script performs a read-modify-write against the
same storage object, so two visible extension contexts can read the same old
value and the later write can erase the earlier chunk. Serializing the rhythm
time delta in the background context gives the clock one authoritative write
lane without changing the visible UI.

## Current state

- `features/stats/logic/time-tracker.ts` increments `unsavedSeconds` in the
  content script and writes both total time and rhythm stats directly.
- `lib/messaging.ts` already defines typed RPC messages via
  `@webext-core/messaging`.
- `entrypoints/background/index.ts` is the central place where background
  handlers are registered.

Relevant excerpts:

```ts
// features/stats/logic/time-tracker.ts:18
let unsavedSeconds = 0
let currentSubforum = ''
```

```ts
// features/stats/logic/time-tracker.ts:242
const currentStats = await timeStatsStorage.getValue()
const previousTotal = currentStats[currentSubforum] || 0

currentStats[currentSubforum] = previousTotal + ms

await timeStatsStorage.setValue(currentStats)
```

```ts
// features/stats/logic/time-tracker.ts:252
const rhythm = await getRhythmStats()
await writeRhythmStats(accumulateRhythm(rhythm, ms, new Date(), currentSubforum))
```

```ts
// features/stats/logic/time-tracker.ts:282
setInterval(() => {
	void saveTime()
}, SYNC_INTERVAL_MS)
```

```ts
// lib/messaging.ts:18
export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
```

```ts
// entrypoints/background/index.ts:116
setupApiHandlers()

// entrypoints/background/index.ts:119
setupAiHandlers()
```

Repo conventions to follow:

- Content/background RPC contracts live in `lib/messaging.ts`.
- Background handler setup lives under `entrypoints/background/*` and is called
  from `entrypoints/background/index.ts`.
- Use `logger` from `@/lib/logger`, not `console.*`.
- Keep browser-extension context separation: content scripts should send typed
  messages when a single background owner is needed.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused handler tests | `npm run test:run -- entrypoints/background/stats-handlers.test.ts` | exit 0; new tests pass |
| Rhythm tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0; no regressions |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `lib/messaging.ts`
- `entrypoints/background/stats-handlers.ts` (create)
- `entrypoints/background/stats-handlers.test.ts` (create)
- `entrypoints/background/index.ts`
- `features/stats/logic/time-tracker.ts`

**Out of scope**:

- `features/stats/storage.ts` activity heatmap storage
- `features/stats/post-tracker.ts`
- Share dialog UI and share availability thresholds
- Any migration of old rhythm data shape beyond preserving the current
  `getRhythmStats()` behavior

## Git workflow

- Branch: `advisor/012-serialize-rhythm-stat-writes`
- Commit message style observed in repo: `fix(stats): serialize rhythm stat writes`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a typed background message for rhythm chunks

In `lib/messaging.ts`, add small exported types near the response/payload
types:

```ts
export interface RhythmTimeChunkPayload {
	subforum: string
	ms: number
	at: number
}

export interface RhythmTimeChunkResult {
	success: boolean
	error?: string
}
```

Then add a `ProtocolMap` entry:

```ts
recordRhythmTimeChunk: (data: RhythmTimeChunkPayload) => RhythmTimeChunkResult
```

Keep the payload JSON-serializable. Do not pass `Date` instances through the
message boundary; use an epoch millisecond number in `at`.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Create a queued background stats handler

Create `entrypoints/background/stats-handlers.ts`.

It should:

- Import `onMessage` and the new payload/result types from `@/lib/messaging`.
- Import `storage` from `#imports`, `STORAGE_KEYS` from `@/constants`,
  `getCompressed` and `setCompressed` from `@/lib/storage/compressed-storage`,
  and `logger` from `@/lib/logger`.
- Reuse the current rhythm helpers from `features/stats/logic/time-tracker.ts`
  for now: `accumulateRhythm`, `createEmptyRhythm`, and `normalizeRhythm`.
  Plan 015 will move those helpers into a pure model module.
- Define the same storage keys currently used in `time-tracker.ts`:

```ts
const TIME_STATS_KEY = `local:${STORAGE_KEYS.TIME_STATS}` as `local:${string}`
const RHYTHM_KEY = `local:${STORAGE_KEYS.RHYTHM_STATS}` as `local:${string}`
```

- Define a `timeStatsStorage` item in the background handler:

```ts
const timeStatsStorage = storage.defineItem<Record<string, number>>(TIME_STATS_KEY, {
	defaultValue: {},
})
```

- Implement a private `persistRhythmTimeChunk(payload)` that:
  - Rejects empty subforums, non-finite `ms`, or `ms <= 0` with
    `{ success: false, error: 'invalid-payload' }`.
  - Reads `timeStatsStorage`, clones it, adds `payload.ms` to
    `payload.subforum`, and writes it back.
  - Reads the rhythm stats through `getCompressed(RHYTHM_KEY)`, normalizes
    with `normalizeRhythm`, applies `accumulateRhythm(stats, payload.ms,
    new Date(payload.at), payload.subforum)`, and writes through
    `setCompressed(RHYTHM_KEY, nextStats)`.
  - Preserves current pruning behavior. If pruning is private in
    `time-tracker.ts`, export a narrowly named helper such as
    `prepareRhythmStatsForStorage` from `time-tracker.ts`, or duplicate only
    the existing pruning call by routing through an exported write helper.
    Do not silently drop pruning.
- Serialize writes with a module-level promise queue. The important property:
  two concurrent `recordRhythmTimeChunk` calls must run their read-modify-write
  sections one after the other.

One acceptable shape:

```ts
let writeQueue: Promise<void> = Promise.resolve()

function enqueueRhythmWrite(payload: RhythmTimeChunkPayload): Promise<RhythmTimeChunkResult> {
	const run = writeQueue.then(() => persistRhythmTimeChunk(payload))
	writeQueue = run.then(
		() => undefined,
		() => undefined
	)
	return run
}
```

- Export `setupStatsHandlers()` and register:

```ts
onMessage('recordRhythmTimeChunk', async ({ data }) => enqueueRhythmWrite(data))
```

- For testability, it is acceptable to export a pure/internal
  `recordRhythmTimeChunkForTest(payload)` wrapper if the project style needs
  direct invocation. Prefer testing through `setupStatsHandlers()` and a mocked
  `onMessage`, matching `entrypoints/background/api-handlers.test.ts`.

**Verify**: `npm run compile` -> exit 0.

### Step 3: Register the background handler

In `entrypoints/background/index.ts`:

- Import `setupStatsHandlers` from `./stats-handlers`.
- Call it in `main()` near the other handler setup calls. Place it before
  API/AI handlers or after them; it is independent. Keep the comment concise:
  `// Stats persistence handlers`.

**Verify**: `npm run compile` -> exit 0.

### Step 4: Route content time saves through the background queue

In `features/stats/logic/time-tracker.ts`:

- Import `sendMessage` from `@/lib/messaging`.
- Keep `getTimeStats`, `getRhythmStats`, `clearRhythmStats`,
  `watchTimeStats`, and `watchRhythmStats` available for dashboard/options
  code.
- In `saveTime()`, stop doing direct read-modify-write storage updates from the
  content script.
- Snapshot and clear the local pending seconds before awaiting, then restore on
  failure:

```ts
const secondsToSave = unsavedSeconds
unsavedSeconds = 0
const ms = secondsToSave * 1000

try {
	// settings gate stays here
	const result = await sendMessage('recordRhythmTimeChunk', {
		subforum: currentSubforum,
		ms,
		at: Date.now(),
	})
	if (!result.success) {
		unsavedSeconds += secondsToSave
	}
} catch (err) {
	unsavedSeconds += secondsToSave
	logger.error('Failed to save time stats:', err)
}
```

- Preserve the existing settings gate:
  - If `enableRhythmTracking` is false, drop the pending seconds just like the
    current code does at `time-tracker.ts:238`.
  - Do not send a background message when tracking is disabled.
- Make sure overlapping calls inside one tab do not double-send the same
  seconds. If needed, add a small local `saveInFlight` queue in
  `time-tracker.ts`; the background queue solves cross-context ordering, but
  the content module should also handle rapid `visibilitychange` plus interval
  calls cleanly.

**Verify**: `npm run compile` -> exit 0.

### Step 5: Add tests for concurrent chunk writes

Create `entrypoints/background/stats-handlers.test.ts`, modeled after
`entrypoints/background/api-handlers.test.ts`.

Test cases:

- `setupStatsHandlers()` registers `recordRhythmTimeChunk`.
- Two concurrent handler calls for the same subforum and hour both persist:
  the resulting time stats total is the sum of both chunks, and the rhythm hour
  bucket is the sum of both chunks.
- Invalid payloads return `{ success: false, error: 'invalid-payload' }` and do
  not write storage.
- A chunk with `at` set to a known date writes the expected hour, weekday, week,
  day, and subforum buckets.

Use the stateful WXT mock from plan 011. Do not mock the storage calls as
no-ops; this test exists to catch lost writes.

**Verify**:
`npm run test:run -- entrypoints/background/stats-handlers.test.ts` -> all tests pass.

### Step 6: Run rhythm regression tests

Run existing rhythm tests to ensure the pure derivation behavior is unchanged.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> all tests pass.

## Test plan

- New tests in `entrypoints/background/stats-handlers.test.ts`.
- Existing rhythm tests must remain green.
- Do not add browser/e2e tests in this plan; this is a storage serialization
  change with unit-level coverage.

## Done criteria

- [ ] Content `saveTime()` no longer directly performs the rhythm
  read-modify-write sequence.
- [ ] Background registers `recordRhythmTimeChunk`.
- [ ] Concurrent chunk test proves two simultaneous writes are accumulated, not
  overwritten.
- [ ] `npm run test:run -- entrypoints/background/stats-handlers.test.ts` exits 0.
- [ ] `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` exits 0.
- [ ] `npm run compile` exits 0.
- [ ] No heatmap activity or post tracker files are modified.
- [ ] `plans/README.md` status row for plan 012 is updated.

## STOP conditions

Stop and report back if:

- Plan 011 has not landed or the WXT storage mock is still no-op.
- The background handler cannot import the current rhythm helpers without
  pulling in DOM-only runtime failures. If that happens, implement plan 015
  first or ask to reorder the plans.
- The fix appears to require changing `features/stats/storage.ts` or
  `features/stats/post-tracker.ts`.
- A failed message would permanently drop unsaved seconds.
- Verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The background queue is the critical review target. Reviewers should check
  that the promise chain continues after both success and failure.
- Plan 015 should later move rhythm types/helpers out of `time-tracker.ts`, so
  the background handler does not import a module that also contains content
  script lifecycle code.
- This plan intentionally does not address activity heatmap/post tracking
  correctness; that is deferred to plan 013.
