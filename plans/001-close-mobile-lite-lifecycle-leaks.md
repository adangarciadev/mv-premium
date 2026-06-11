# Plan 001: Close Mobile Lite lifecycle leaks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 923045f..HEAD -- features/mobile-lite/logic/panel.tsx features/mobile-lite/logic/panel.test.tsx features/mobile-lite/logic/ignored-users.ts features/mobile-lite/logic/ignored-users.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `923045f`, 2026-06-11

## Why this matters

Mobile Lite registers long-lived DOM roots, document listeners, observers, and
delayed retries from content scripts. Most teardown paths clean observers and
listeners, but the panel root is mounted through the shared React root manager
and never explicitly unmounted. A few delayed `setTimeout` callbacks also remain
untracked, so they can run after teardown and re-inject UI that was just removed.
Closing these lifecycle leaks makes feature disable/reload flows deterministic.

## Current state

- `features/mobile-lite/logic/panel.tsx` mounts the Mobile Lite panel root and
  injects user-menu entries.
- `features/mobile-lite/logic/ignored-users.ts` injects post/user-card controls
  and schedules repeated user-card scans after a click.
- `features/mobile-lite/logic/panel.test.tsx` already mocks React root helpers.
- `features/mobile-lite/logic/ignored-users.test.ts` covers ignored-user DOM
  behavior but not delayed callback cleanup.

Relevant excerpts:

```ts
// features/mobile-lite/logic/panel.tsx:4
import { createContainer, isFeatureMounted, mountFeatureWithBoundary } from '@/lib/content-modules/utils/react-helpers'

// features/mobile-lite/logic/panel.tsx:323
function ensurePanelRoot(): void {
	if (isFeatureMounted(FEATURE_ID)) return
	// ...
	mountFeatureWithBoundary(FEATURE_ID, container, <ShadowWrapper><MobileLitePanel /></ShadowWrapper>, 'Mobile Lite Panel')
}

// features/mobile-lite/logic/panel.tsx:375
export function teardownMobileLitePanel(): void {
	menuObserver?.disconnect()
	// removes listeners and menu items, but does not unmount FEATURE_ID or remove CONTAINER_ID
}

// features/mobile-lite/logic/panel.tsx:48
window.setTimeout(injectPanelMenuItem, 0)
window.setTimeout(injectPanelMenuItem, 150)

// features/mobile-lite/logic/ignored-users.ts:343
function scheduleMobileLiteUserCardInjection(data: UserCustomizationsData): void {
	for (const delay of USER_CARD_INJECTION_DELAYS_MS) {
		window.setTimeout(() => {
			if (!isMobileLiteIgnoredUsersAllowed()) return
			injectVisibleMobileLiteUserCards(data)
		}, delay)
	}
}
```

Existing pattern to match:

```ts
// features/mobile-lite/logic/ignored-users-import.tsx:39
function closeIgnoredUsersImportPanel(): void {
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
}
```

Repo conventions:

- Injected React UI must use `ShadowWrapper` and root-manager helpers from
  `lib/content-modules/utils/react-helpers.ts`.
- Use `logger`, not `console.*`.
- Co-locate Vitest tests with source files.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install` | exit 0 |
| Typecheck | `npm run compile` | exit 0, no TypeScript errors |
| Targeted tests | `npm run test:run -- features/mobile-lite/logic/panel.test.tsx features/mobile-lite/logic/ignored-users.test.ts` | exit 0 |
| Mobile Lite tests | `npm run test:run -- features/mobile-lite` | exit 0 |
| Lint | `npm run lint` | exit 0; existing warnings may remain but no errors |

## Scope

**In scope**:
- `features/mobile-lite/logic/panel.tsx`
- `features/mobile-lite/logic/panel.test.tsx`
- `features/mobile-lite/logic/ignored-users.ts`
- `features/mobile-lite/logic/ignored-users.test.ts`

**Out of scope**:
- Do not change `lib/content-modules/utils/react-helpers.ts`.
- Do not change Mobile Lite visual design or copy.
- Do not change ignore semantics, storage schema, or user-customization data.
- Do not change non-Mobile Lite feature lifecycles.

## Git workflow

- Branch: `advisor/001-mobile-lite-lifecycle-cleanup`
- Commit message style: Conventional Commits, for example
  `fix(mobile-lite): unmount panel root on teardown`.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Unmount and remove the Mobile Lite panel root

In `features/mobile-lite/logic/panel.tsx`, import `unmountFeature` from
`@/lib/content-modules/utils/react-helpers`.

In `teardownMobileLitePanel()`, after removing observers/listeners and before
or after menu cleanup, call:

```ts
unmountFeature(FEATURE_ID)
document.getElementById(CONTAINER_ID)?.remove()
```

Keep this idempotent. Calling teardown when the panel was never mounted must not
throw.

Update `features/mobile-lite/logic/panel.test.tsx` mocks to expose
`unmountFeature`. Add a test that initializes the panel, calls teardown, and
asserts:

- `unmountFeature` was called with `mobile-lite-panel`.
- `#mvp-mobile-lite-panel-root` is removed.
- menu entries are still removed as before.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Track and cancel delayed panel menu injections

In `panel.tsx`, track the two `window.setTimeout(injectPanelMenuItem, ...)`
calls in module state, for example:

```ts
let userMenuInjectionTimeouts: ReturnType<typeof window.setTimeout>[] = []
```

Wrap scheduling in a helper that stores timeout IDs and whose callback first
checks `initialized`. On teardown, clear all pending IDs and reset the array.

Add or update a test in `panel.test.tsx` using fake timers or a controlled
`setTimeout` spy to prove that a user-menu click followed by
`teardownMobileLitePanel()` does not inject menu items after timers run.

**Verify**: `npm run test:run -- features/mobile-lite/logic/panel.test.tsx` -> exit 0.

### Step 3: Track and cancel delayed ignored-user card injections

In `features/mobile-lite/logic/ignored-users.ts`, track timeout IDs scheduled by
`scheduleMobileLiteUserCardInjection()`. The callback should check both
`initialized` and `isMobileLiteIgnoredUsersAllowed()` before injecting.

In `teardownMobileLiteIgnoredUsers()`, clear those pending timeout IDs and reset
the tracking collection.

Add a test in `ignored-users.test.ts` that schedules user-card injection,
tears down the module, advances timers, and asserts no
`data-mvp-mobile-lite-user-card-actions` controls are injected.

**Verify**: `npm run test:run -- features/mobile-lite/logic/ignored-users.test.ts` -> exit 0.

### Step 4: Run Mobile Lite verification

Run the focused Mobile Lite test suite and typecheck.

**Verify**:

- `npm run test:run -- features/mobile-lite/logic/panel.test.tsx features/mobile-lite/logic/ignored-users.test.ts` -> exit 0
- `npm run test:run -- features/mobile-lite` -> exit 0
- `npm run compile` -> exit 0

## Test plan

- Extend `panel.test.tsx` for root unmount/container removal and delayed menu
  injection cancellation.
- Extend `ignored-users.test.ts` for delayed user-card injection cancellation.
- Use existing mock style from `panel.test.tsx` and DOM fixture style from
  `ignored-users.test.ts`.

## Done criteria

- [ ] `teardownMobileLitePanel()` calls `unmountFeature(FEATURE_ID)`.
- [ ] `teardownMobileLitePanel()` removes `#mvp-mobile-lite-panel-root`.
- [ ] Pending panel menu injection timeouts are cleared on teardown.
- [ ] Pending ignored-user card injection timeouts are cleared on teardown.
- [ ] New co-located tests cover these lifecycle paths.
- [ ] `npm run compile` exits 0.
- [ ] `npm run test:run -- features/mobile-lite` exits 0.
- [ ] `npm run lint` exits 0 with no new errors.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `unmountFeature` no longer exists or no longer accepts a feature ID.
- The panel no longer uses `FEATURE_ID = 'mobile-lite-panel'` or
  `CONTAINER_ID = 'mvp-mobile-lite-panel-root'`.
- Tests require changing Mobile Lite behavior beyond teardown/lifecycle cleanup.
- Fixing this requires changing shared React root-manager behavior.

## Maintenance notes

Future Mobile Lite modules that schedule delayed DOM work should keep timeout
IDs and clear them in teardown. Reviewers should check that new content-script
modules have symmetric init/teardown for roots, listeners, observers, and timers.
