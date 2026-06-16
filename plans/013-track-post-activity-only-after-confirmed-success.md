# Plan 013: Track post activity only after confirmed submission success

> **Executor instructions**: This plan is intentionally deferred. Do not execute
> it unless the operator explicitly says activity heatmap/post tracking is back
> in scope. If executed later, follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ff93b10..HEAD -- features/stats/post-tracker.ts features/stats/post-tracker.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/011-make-wxt-storage-mock-stateful.md`
- **Category**: bug
- **Planned at**: commit `ff93b10`, 2026-06-16

## Why this matters

The activity heatmap currently records some post actions when the user clicks
or submits, not when Mediavida confirms that the operation succeeded. That can
create false activity entries for failed validation, canceled inline edits, or
navigation after a stale pending flag. This matters for data correctness, but
the product focus is currently the rhythm clock, so this plan is preserved for
future execution rather than recommended now.

## Current state

- `features/stats/post-tracker.ts` owns post/create/edit/reply activity
  tracking for the heatmap.
- It stores pending thread/reply/edit data in `sessionStorage` during submit,
  then completion functions run on thread page load.
- Some paths still track immediately or complete without strong success
  validation.

Relevant excerpts:

```ts
// features/stats/post-tracker.ts:216
const saveButton = target.closest('.saveButton')

if (saveButton) {
	const threadInfo = getThreadInfo()

	trackActivity({
		type: 'post',
		action: 'update',
```

```ts
// features/stats/post-tracker.ts:256
const submitHandler = () => {
	const isNewThread = isNewThreadPage()
	const isPostPhpEdit = isPostPhpEditPage()
	const buttonText = button.textContent?.trim().toLowerCase() || ''
```

```ts
// features/stats/post-tracker.ts:391
trackActivity({
	type: 'post',
	action: 'create',
	title: pending.title,
	context: pending.subforum,
	url: threadUrl,
}).catch(() => {})
```

```ts
// features/stats/post-tracker.ts:482
trackActivity({
	type: 'post',
	action: 'publish',
	title: pending.title,
	context: pending.subforum,
	url: pending.url,
}).catch(() => {})
```

Existing tests live in `features/stats/post-tracker.test.ts` and already mock
`trackActivity`:

```ts
// features/stats/post-tracker.test.ts:10
const mockTrackActivity = vi.fn().mockResolvedValue(undefined)
vi.mock('@/features/stats/storage', () => ({
	trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}))
```

Repo conventions to follow:

- Use `sessionStorage` for short-lived cross-navigation pending state.
- Keep user-facing copies Spanish, but this module has little visible copy.
- Keep DOM tests in Vitest/jsdom and build DOM fixtures in the test file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test:run -- features/stats/post-tracker.test.ts` | exit 0; old and new post tracker tests pass |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/post-tracker.ts`
- `features/stats/post-tracker.test.ts`

**Out of scope**:

- Rhythm clock/time tracking
- `features/stats/logic/time-tracker.ts`
- `features/stats/storage.ts` schema changes
- UI redesign of the activity graph
- Changing what the heatmap represents; this plan only reduces false positives

## Git workflow

- Branch: `advisor/013-confirm-post-tracker-success`
- Commit message style observed in repo: `fix(stats): track post activity after confirmed success`
- Do not push or open a PR unless instructed.

## Steps

### Step 0: Confirm this deferred plan is actually in scope

Before editing, confirm with the operator that post activity/heatmap tracking is
being prioritized again. The current owner explicitly deferred heatmap tracker
work to focus on the rhythm clock.

**Verify**: The operator has explicitly approved executing plan 013.

### Step 1: Strengthen pending payloads with validation data

In `features/stats/post-tracker.ts`, update pending payload interfaces so each
completion path can prove it is on the expected result page.

Recommended additions:

- `PendingThreadCreation`:
  - `originPath: string`
  - `expectedSubforumSlug?: string`
- `PendingReply`:
  - `url: string` already exists; treat it as the canonical thread base URL.
  - `originPath: string`
- `PendingPostEdit`:
  - `url: string` already exists; treat it as the canonical thread base URL.
  - `originPath: string`

Set these values inside `submitHandler` when pending state is created.

Do not add long-lived storage. Keep using `sessionStorage`.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Require URL/thread match before completing pending replies

Update `completePendingReply()` so it only tracks when the current page is the
same canonical thread as `pending.url`.

Use `getThreadBaseUrl()` for current URL normalization. Normalize trailing
slashes and pagination consistently on both sides. If the current page does not
match:

- Do not call `trackActivity`.
- Keep the pending entry if it is still fresh, so the correct reload can
  complete it.
- Remove it only when it is stale or malformed.

Add tests:

- Pending reply completes on the same thread.
- Pending reply does not complete on a different thread.
- Stale pending reply is removed.

**Verify**: `npm run test:run -- features/stats/post-tracker.test.ts` -> all tests pass.

### Step 3: Require real thread page context before completing thread creation

Update `completePendingThreadCreation()` so it only tracks when the current URL
looks like a Mediavida thread page under `/foro/<subforum>/<thread-slug>-<id>`.

At minimum:

- Do not complete on `/foro/<subforum>/nuevo-hilo`.
- Do not complete on generic forum list pages.
- Do not complete outside `/foro/`.
- If `expectedSubforumSlug` is available, require the current path to use the
  same subforum slug.

Add tests:

- New thread pending completes on a real thread URL.
- New thread pending does not complete on the new-thread form URL.
- New thread pending does not complete on another subforum.

**Verify**: `npm run test:run -- features/stats/post-tracker.test.ts` -> all tests pass.

### Step 4: Replace immediate inline-edit tracking with confirmed completion

The current inline edit path tracks on `.saveButton` click. Replace that with a
pending inline edit flow that completes only after the UI indicates success.

Use the least fragile signal available in the live Mediavida DOM. Prefer one of
these, in order:

1. A successful inline-edit response/event if Mediavida exposes one.
2. A DOM transition where the edited post exits edit mode and rendered content
   is present again.
3. A bounded MutationObserver around the edited post element that confirms the
   editor disappeared without an error message.

If none of these can be reliably detected in jsdom and manual inspection, stop
and report. Do not keep the current click-immediate behavior under a new name.

Add tests with a minimal DOM fixture for the chosen success signal:

- Click alone does not call `trackActivity`.
- Confirmed inline edit success calls `trackActivity`.
- Error/unchanged edit state does not call `trackActivity`.

**Verify**: `npm run test:run -- features/stats/post-tracker.test.ts` -> all tests pass.

### Step 5: Keep fallback tracking conservative

There are fallback branches when `sessionStorage.setItem` throws. Review these
branches:

```ts
// features/stats/post-tracker.ts:278
trackActivity({
	type: 'post',
	action: 'create',
```

```ts
// features/stats/post-tracker.ts:336
trackActivity({
	type: 'post',
	action: 'publish',
```

For this plan, prefer not tracking over false tracking when persistence fails.
Change fallback behavior to log/debug if needed, but do not immediately create
activity entries for actions that may still fail.

**Verify**: `npm run test:run -- features/stats/post-tracker.test.ts` -> all tests pass.

## Test plan

Add tests to `features/stats/post-tracker.test.ts`, extending the existing DOM
fixture style.

Required new coverage:

- Reply pending does not complete on a different thread.
- Thread creation pending does not complete on form/list pages.
- Inline edit click alone does not track.
- Inline edit success signal tracks exactly once.
- `sessionStorage` failure does not produce a false activity entry.

## Done criteria

- [ ] No `trackActivity` call happens merely because the user clicked an inline
  save button.
- [ ] `completePendingReply()` validates the current thread before tracking.
- [ ] `completePendingThreadCreation()` validates the current URL is a real
  created thread in the expected subforum.
- [ ] Fallback paths prefer missing an activity entry over creating a false one.
- [ ] `npm run test:run -- features/stats/post-tracker.test.ts` exits 0.
- [ ] `npm run compile` exits 0.
- [ ] No rhythm clock/time-tracker files are modified.
- [ ] `plans/README.md` status row for plan 013 is updated.

## STOP conditions

Stop and report back if:

- The operator has not explicitly re-prioritized heatmap/post tracking.
- Mediavida inline edit success cannot be detected reliably.
- The implementation requires changing the activity storage schema.
- Fixing this would require network requests from content scripts.
- Verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan deliberately accepts occasional missed activity entries to avoid
  false positives. For a heatmap, false positives are harder to explain to users
  than missing a failed/canceled post.
- Future work can revisit richer activity tracking, but only after the product
  direction for the heatmap is active again.
