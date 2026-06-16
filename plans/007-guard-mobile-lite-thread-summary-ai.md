# Plan 007: Guard Mobile Lite thread summaries against duplicate AI calls

## Executor instructions

Worktree drift check before editing:

```powershell
git diff --stat 80362a9..HEAD -- features/mobile-lite/logic/thread-summary.tsx features/mobile-lite/logic/post-summary.tsx features/mobile-lite/logic/thread-summary-view-model.test.ts
```

If any of those files changed after this plan was written, read the current files first and adapt the steps below. Do not overwrite unrelated user edits.

## Status

- Priority: P1
- Effort: S
- Risk: Low
- Depends on: none
- Category: bug, AI quota, UX
- Planned at commit: `80362a9`
- Planned on: 2026-06-13
- Status: DONE
- Completed on: 2026-06-13

## Why

Mobile Lite thread summaries can issue duplicate AI requests when the user taps the summary trigger repeatedly before the first request finishes. This wastes AI quota and can make the UI race between multiple summaries/errors.

The post summary implementation already has the safer pattern: it uses a ref as an in-flight guard instead of reading React state from an event handler registered by a mount-only effect.

## Current state

Target file:

- `features/mobile-lite/logic/thread-summary.tsx`

Relevant behavior:

```tsx
const [isLoading, setIsLoading] = useState(false)

useEffect(() => {
  const handleSummaryRequest = async () => {
    // Ignore if a request is already in flight
    if (isLoading) return
    ...
    setIsLoading(true)
    try {
      const freshResult = await summarizeCurrentThread()
      ...
    } finally {
      setIsLoading(false)
    }
  }

  document.addEventListener(THREAD_SUMMARY_TRIGGER_EVENT, handleSummaryRequest)
  ...
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Because the effect has an empty dependency array, `handleSummaryRequest` closes over the initial `isLoading` value (`false`). The guard does not block a second event dispatched while the first request is still in flight.

Nearby safe example:

- `features/mobile-lite/logic/post-summary.tsx` uses `busyRef.current` to guard an async summary action.

There is currently no direct `thread-summary.test.tsx` coverage for this event-handler behavior.

## Scope

In scope:

- `features/mobile-lite/logic/thread-summary.tsx`
- New regression test in `features/mobile-lite/logic/thread-summary.test.tsx`

Out of scope:

- Prompt changes
- Background AI handler changes
- Thread summary view model behavior unrelated to duplicate requests
- Any source outside Mobile Lite thread summary code

## Implementation steps

1. Add a focused regression test for duplicate trigger events.
   - Create `features/mobile-lite/logic/thread-summary.test.tsx`.
   - Mock `summarizeCurrentThread` so the first call returns a deferred promise.
   - Mount the feature through `initMobileLiteThreadSummary()` and a mocked/root-test-friendly `mountFeatureWithBoundary`.
   - Dispatch `THREAD_SUMMARY_TRIGGER_EVENT` twice before resolving the deferred promise.
   - Assert `summarizeCurrentThread` was called exactly once while the first request is pending.
   - Resolve the promise and assert the loading state eventually clears.

2. Add an in-flight ref guard.
   - Import `useRef`.
   - Add `const busyRef = useRef(false)` inside `ThreadSummaryReactRoot`.
   - Replace `if (isLoading) return` with `if (busyRef.current) return`.
   - Set `busyRef.current = true` immediately before the fresh AI request path starts loading.
   - Reset it in the `finally` block.
   - Keep `isLoading` as UI state only.

3. Preserve the cached-summary fast path.
   - If a cached summary is found, open the sheet with cached data without setting `busyRef.current`.
   - If the fresh request throws, keep the existing error behavior and reset the ref in `finally`.

4. Remove the stale state-closure smell.
   - Remove the comment that describes `isLoading` as the in-flight guard.
   - Remove the `react-hooks/exhaustive-deps` disable if it is no longer needed.
   - If the listener still intentionally mounts once, leave a short comment only if the test needs it for clarity.

## Test plan

Run the focused tests first:

```powershell
npm run test:run -- features/mobile-lite/logic/thread-summary.test.tsx features/mobile-lite/logic/thread-summary-view-model.test.ts
```

Then run the Mobile Lite slice:

```powershell
npm run test:run -- features/mobile-lite
```

Finish with typechecking:

```powershell
npm run compile
```

## Done criteria

- Two rapid `THREAD_SUMMARY_TRIGGER_EVENT` dispatches only call `summarizeCurrentThread()` once while the first request is pending.
- A later trigger after completion still works normally.
- Cached summaries still open without a new AI request.
- Thread summary UI still shows loading and error states correctly.
- `npm run test:run -- features/mobile-lite` passes.
- `npm run compile` passes.

## STOP / ask before continuing

Stop and ask if:

- Testing `ThreadSummaryReactRoot` requires exporting it publicly only for tests. Prefer mounting through `initMobileLiteThreadSummary()` or a local test helper before changing the public API.
- The feature now has a newer shared async action guard helper. Use that established helper instead of adding a local ref.

## Maintenance notes

Keep this fix surgical. The goal is to make the existing event handler concurrency-safe, not to redesign the thread summary flow.

## Execution notes

- Added `busyRef` to guard the fresh AI request path.
- Added `features/mobile-lite/logic/thread-summary.test.tsx` for pending duplicate triggers and cached summaries.
- Verified:
  - `npm run test:run -- features/mobile-lite/logic/thread-summary.test.tsx features/mobile-lite/logic/thread-summary-view-model.test.ts`
  - `npm run test:run -- features/mobile-lite`
  - `npm run compile`
