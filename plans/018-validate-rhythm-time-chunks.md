# Plan 018: Validate and bound rhythm time chunks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- entrypoints/background/stats-handlers.ts entrypoints/background/stats-handlers.test.ts features/stats/logic/time-tracker.ts features/stats/logic/time-tracker.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/017-make-time-tracker-idempotent.md`
- **Category**: bug
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

The background handler is now the authoritative write lane for time and rhythm
stats. It validates that a chunk is positive and finite, but it does not bound
the amount of time or sanity-check the timestamp. A future content bug could
send a huge chunk or a far future timestamp and permanently skew the rhythm
clock, top subforums, and shareable PNGs.

## Current state

- `features/stats/logic/time-tracker.ts` sends one message containing all
  currently unsaved seconds.
- `entrypoints/background/stats-handlers.ts` accepts any finite positive `ms`
  and any finite `at`.
- Existing tests cover an empty subforum rejection and normal persistence.

Relevant excerpts:

```ts
// features/stats/logic/time-tracker.ts:74
const result = await sendMessage('recordRhythmTimeChunk', {
	subforum: currentSubforum,
	ms: secondsToSave * 1000,
	at: Date.now(),
})
```

```ts
// entrypoints/background/stats-handlers.ts:30
function isValidChunk(payload: RhythmTimeChunkPayload): boolean {
	return (
		typeof payload.subforum === 'string' &&
		payload.subforum.trim().length > 0 &&
		Number.isFinite(payload.ms) &&
		payload.ms > 0 &&
		Number.isFinite(payload.at)
	)
}
```

```ts
// entrypoints/background/stats-handlers.test.ts:67
it('rejects invalid payloads without writing storage', async () => {
```

Repo convention to match:

- Background handlers return typed `{ success: false, error: string }` results
  instead of throwing for expected bad input.
- Use `logger` for unexpected persistence errors, not `console.*`.
- Keep the public messaging shape unchanged.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Handler tests | `npm run test:run -- entrypoints/background/stats-handlers.test.ts` | exit 0; new validation tests pass |
| Tracker tests | `npm run test:run -- features/stats/logic/time-tracker.test.ts` | exit 0; chunk-splitting tests pass |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `entrypoints/background/stats-handlers.ts`
- `entrypoints/background/stats-handlers.test.ts`
- `features/stats/logic/time-tracker.ts`
- `features/stats/logic/time-tracker.test.ts`

**Out of scope**:

- Changing `lib/messaging.ts` message names or payload shape
- Changing rhythm aggregation math in `rhythm-model.ts`
- Migrating existing stored rhythm data
- Heatmap/post tracking
- Share availability thresholds

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits, for example
  `fix(stats): bound rhythm time chunks`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Define conservative chunk limits

In `entrypoints/background/stats-handlers.ts`, add local constants near the
storage keys:

```ts
const MAX_RHYTHM_CHUNK_MS = 10 * 60_000
const MAX_FUTURE_CHUNK_SKEW_MS = 5 * 60_000
const MAX_PAST_CHUNK_AGE_MS = 24 * 60 * 60_000
```

Rationale:

- The content tracker syncs every 30 seconds.
- 10 minutes is generous enough for delayed retries but small enough to reject
  obviously corrupt single messages.
- The content tracker uses `Date.now()` at save time, so future timestamps and
  day-old timestamps should not be normal.

Export `MAX_RHYTHM_CHUNK_MS` only if `time-tracker.ts` needs to import it for
chunk splitting. Prefer duplicating the literal only if importing from
background code would create an undesirable extension-context dependency.

**Verify**:
`rg "MAX_RHYTHM_CHUNK_MS|MAX_FUTURE_CHUNK_SKEW_MS|MAX_PAST_CHUNK_AGE_MS" entrypoints/background/stats-handlers.ts`
-> all constants are present.

### Step 2: Strengthen background validation

Update `isValidChunk()` so it rejects:

- blank subforum
- non-finite `ms`
- `ms <= 0`
- `ms > MAX_RHYTHM_CHUNK_MS`
- non-finite `at`
- `at` more than `MAX_FUTURE_CHUNK_SKEW_MS` in the future
- `at` more than `MAX_PAST_CHUNK_AGE_MS` in the past

Use `Date.now()` inside validation. If test determinism becomes awkward,
extract a small helper:

```ts
function isValidChunk(payload: RhythmTimeChunkPayload, now = Date.now()): boolean
```

Keep `recordRhythmTimeChunkForTest(payload)` API unchanged unless tests truly
need the injectable `now`; if they do, prefer testing with `vi.setSystemTime()`.

**Verify**:
`npm run test:run -- entrypoints/background/stats-handlers.test.ts`
-> existing tests still pass after adding validation, before adding new cases.

### Step 3: Split large unsaved time in the content tracker

To avoid trapping legitimate delayed unsaved time behind the new max, update
`features/stats/logic/time-tracker.ts` so `saveTime()` sends multiple bounded
chunks when `secondsToSave` exceeds the max.

The behavior should be:

- Convert unsaved seconds to milliseconds.
- Send chunks of at most `MAX_RHYTHM_CHUNK_MS`.
- Preserve the existing retry behavior: if any chunk fails or throws, restore
  the unsent amount back into `unsavedSeconds`.
- Do not send zero or negative chunks.
- Use the current subforum for every chunk.

Avoid importing `entrypoints/background/stats-handlers.ts` into content code.
If sharing the constant is desired, move the constant to a neutral module such
as `features/stats/logic/rhythm-time-constants.ts` and import it from both
places. If you create that module, include it in tests and scope.

**Verify**:
`rg "MAX_RHYTHM_CHUNK_MS|recordRhythmTimeChunk" features/stats/logic/time-tracker.ts entrypoints/background/stats-handlers.ts`
-> both sides use the same max value or the same neutral constant.

### Step 4: Add validation tests

Extend `entrypoints/background/stats-handlers.test.ts`.

Add tests that assert rejected payloads do not write storage for:

- `ms` greater than the max
- future `at` beyond skew
- stale `at` beyond the past-age limit

Add one acceptance edge test:

- `ms` exactly equal to the max with a current timestamp persists correctly.

Use `vi.useFakeTimers()` and `vi.setSystemTime(new Date(2026, 0, 7, 12, 0))`
where needed.

**Verify**:
`npm run test:run -- entrypoints/background/stats-handlers.test.ts`
-> exit 0; new tests pass.

### Step 5: Add chunk-splitting tests

Extend `features/stats/logic/time-tracker.test.ts`.

Add a fake-timer test that simulates enough visible time to exceed the max
chunk and verifies `sendMessage` receives multiple bounded chunks rather than
one oversized chunk. If simulating 10 minutes is slow in fake timers, set the
constant through the neutral module and mock it only if TypeScript/Vitest can do
so cleanly; otherwise keep the test at the real constant with fake timers.

**Verify**:
`npm run test:run -- features/stats/logic/time-tracker.test.ts`
-> exit 0.

### Step 6: Typecheck

Run the repo typecheck.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- `entrypoints/background/stats-handlers.test.ts`:
  - rejects oversized chunks
  - rejects future timestamps
  - rejects stale timestamps
  - accepts exactly max-sized chunks
- `features/stats/logic/time-tracker.test.ts`:
  - splits large unsaved time into bounded chunks
  - preserves existing disabled-setting behavior from plan 017

## Done criteria

- [ ] Background validation rejects impossible chunk sizes and timestamps.
- [ ] Content tracker never sends a chunk larger than the agreed max.
- [ ] Existing messaging payload shape is unchanged.
- [ ] Handler tests exit 0.
- [ ] Tracker tests exit 0.
- [ ] `npm run compile` exits 0.
- [ ] No files outside the in-scope list, optional neutral constant module, and
  `plans/README.md` are modified.

## STOP conditions

Stop and report back if:

- Bounding chunks would require changing `lib/messaging.ts` payload shape.
- The content tracker cannot split retries without losing unsaved seconds.
- Tests reveal legitimate current behavior sends chunks older than 24 hours.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

If the sync interval changes in the future, revisit `MAX_RHYTHM_CHUNK_MS`. The
max should remain comfortably above the normal interval but low enough to catch
corrupt single-message writes.
