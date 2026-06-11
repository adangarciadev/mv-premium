# Plan 002: Roll back Mobile Lite ignore changes when saving fails

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 923045f..HEAD -- features/mobile-lite/logic/ignored-users.ts features/mobile-lite/logic/ignored-users.test.ts features/mobile-lite/components/mobile-lite-panel.tsx features/mobile-lite/logic/panel.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-close-mobile-lite-lifecycle-leaks.md`
- **Category**: bug
- **Planned at**: commit `923045f`, 2026-06-11

## Why this matters

Mobile Lite lets users hide or mute authors from swipe gestures and user-card
buttons. That path updates the DOM and shows a success toast before persistence
has succeeded. If extension storage fails, the user sees a saved-looking state
that can be reverted later by storage watchers or page reloads. The panel's
React path already has a safer rollback/error pattern; the non-React quick-action
path should match it.

## Current state

- `features/mobile-lite/logic/ignored-users.ts` owns swipe/user-card ignore
  actions for content-injected UI.
- `features/mobile-lite/components/mobile-lite-panel.tsx` contains a rollback
  pattern for the panel list UI.
- `features/mobile-lite/logic/ignored-users.test.ts` tests successful ignore,
  undo, stale storage snapshots, and note preservation, but not save failure.
- `features/mobile-lite/logic/panel.test.tsx` already verifies visible errors
  when panel saves fail.

Relevant excerpts:

```ts
// features/mobile-lite/logic/ignored-users.ts:488
export async function setMobileLiteUserIgnore(
	username: string,
	ignoreType: MobileLiteIgnoreType | null,
	avatarUrl?: string
): Promise<void> {
	if (!isMobileLiteIgnoredUsersAllowed()) return

	const data = await getUserCustomizations()
	const { storageKey } = setUserIgnoreInData(data, username, ignoreType)
	// ...
	markMobileLiteIgnoredUsersManualChange(storageKey, ignoreType)
	syncMobileLiteIgnoredUsers(data)
	dismissVisibleMobileLiteUserCards()
	showUserIgnoreToast(username, ignoreType)
	await saveUserCustomizations(data)
}

// features/mobile-lite/components/mobile-lite-panel.tsx:608
const removeUserFilter = async (username: string) => {
	const previousData = data
	// ...
	setData(optimisticData)
	try {
		const nextData = await updateUserIgnore(username, null)
		setData(nextData)
	} catch {
		setData(previousData)
		setErrorMessage('No se pudo guardar el filtro. Intentalo de nuevo.')
	}
}
```

Repo conventions:

- Use `logger` from `@/lib/logger`, not `console.*`.
- Keep Spanish user-facing copy consistent with nearby Mobile Lite messages.
- Tests are co-located and use Vitest/jsdom.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install` | exit 0 |
| Typecheck | `npm run compile` | exit 0, no TypeScript errors |
| Targeted tests | `npm run test:run -- features/mobile-lite/logic/ignored-users.test.ts features/mobile-lite/logic/panel.test.tsx` | exit 0 |
| Mobile Lite tests | `npm run test:run -- features/mobile-lite` | exit 0 |
| Lint | `npm run lint` | exit 0; existing warnings may remain but no errors |

## Scope

**In scope**:
- `features/mobile-lite/logic/ignored-users.ts`
- `features/mobile-lite/logic/ignored-users.test.ts`
- `features/mobile-lite/components/mobile-lite-panel.tsx` only if needed to reuse
  or align error copy
- `features/mobile-lite/logic/panel.test.tsx` only if existing panel expectations
  need minor copy alignment

**Out of scope**:
- Do not change the user-customizations storage schema.
- Do not change ignore types (`mute`, `hide`, `null`) or their semantics.
- Do not change post gesture thresholds or animation behavior.
- Do not change the panel's existing successful save behavior.

## Git workflow

- Branch: `advisor/002-mobile-lite-ignore-save-rollback`
- Commit message style: Conventional Commits, for example
  `fix(mobile-lite): roll back ignore state when save fails`.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add a rollback path for failed quick-action saves

In `features/mobile-lite/logic/ignored-users.ts`, change
`setMobileLiteUserIgnore()` so it has both previous and next data available.
Use a cloned next-data object before calling `setUserIgnoreInData()` so the
previous snapshot remains usable for rollback.

Keep optimistic UI if desired, but only show the success toast after
`saveUserCustomizations(nextData)` succeeds. If save fails:

- restore the previous data via `syncMobileLiteIgnoredUsers(previousData)`;
- clear or neutralize any recent manual-change suppression for the failed
  change so stale optimistic state does not win later;
- show a visible error toast or status using existing Mobile Lite toast
  patterns;
- log with `logger.error('Error saving Mobile Lite ignore:', error)` or a
  similarly specific message;
- reject the promise after rollback so callers that already catch failures keep
  working.

Do not include storage data or user secrets in logs.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Avoid unhandled promise rejections from user-card buttons

Still in `ignored-users.ts`, inspect `createUserCardActionButton()`. It currently
calls `void onClick()`. If `setMobileLiteUserIgnore()` can reject after rollback,
wrap promise-returning handlers with `.catch(...)` and log via `logger.error`.

Keep button labels, active classes, and click propagation behavior unchanged.

**Verify**: `npm run compile` -> exit 0.

### Step 3: Add save-failure regression tests

In `features/mobile-lite/logic/ignored-users.test.ts`, add tests for failed
`saveUserCustomizations`:

- Starting from a visible post, make `saveUserCustomizations` reject once, call
  `setMobileLiteUserIgnore('SomeUser', 'mute')`, and assert the promise rejects
  after rollback.
- Assert the post is not left with muted/ignored classes or placeholders.
- Assert a success toast like "ha sido silenciado" is not left visible after the
  failed save.
- Assert a visible error toast/status exists, or if the implementation chooses
  only logging, assert the DOM was rolled back and the rejection is observable.
- Add the same core check for a user-card button click if step 2 changed the
  click wrapper.

Follow the existing fixture style in `ignored-users.test.ts`.

**Verify**: `npm run test:run -- features/mobile-lite/logic/ignored-users.test.ts` -> exit 0.

### Step 4: Check panel expectations still hold

Run the panel tests because the panel uses the same storage helpers and error
copy. If the implementation changed shared copy, update only brittle copy
expectations that refer to the same message.

**Verify**: `npm run test:run -- features/mobile-lite/logic/panel.test.tsx` -> exit 0.

### Step 5: Run Mobile Lite verification

**Verify**:

- `npm run test:run -- features/mobile-lite/logic/ignored-users.test.ts features/mobile-lite/logic/panel.test.tsx` -> exit 0
- `npm run test:run -- features/mobile-lite` -> exit 0
- `npm run compile` -> exit 0

## Test plan

- Add failed-save regression tests in `ignored-users.test.ts`.
- Reuse existing test helpers such as `userCustomizations(...)` and existing DOM
  fixtures for posts/user cards.
- Keep the successful ignore, undo, and stale-storage tests passing.

## Done criteria

- [ ] A failed `saveUserCustomizations` no longer leaves ignored/muted DOM state
  applied.
- [ ] Success toast is shown only for persisted quick-action changes.
- [ ] Failed quick-action saves produce a visible error path or rejected promise
  after rollback.
- [ ] User-card button clicks do not create unhandled promise rejections.
- [ ] New co-located tests cover save failure.
- [ ] `npm run compile` exits 0.
- [ ] `npm run test:run -- features/mobile-lite` exits 0.
- [ ] `npm run lint` exits 0 with no new errors.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `setUserIgnoreInData()` no longer mutates and returns data in the current
  shape assumed by existing tests.
- Fixing rollback requires changing the user-customizations storage schema.
- The desired behavior conflicts with an existing test that explicitly requires
  success UI before persistence.
- A reasonable fix requires touching post-gesture thresholds, panel layout, or
  non-Mobile Lite storage code.

## Maintenance notes

Reviewers should focus on the ordering of optimistic UI, persistence, rollback,
and toast display. Future Mobile Lite quick actions should either persist before
success UI or have an explicit rollback path with tests.
