# Plan 010: Isolate Mobile Lite registry module failures

## Executor instructions

Worktree drift check before editing:

```powershell
git diff --stat 80362a9..HEAD -- features/mobile-lite/logic/registry.ts features/mobile-lite/logic/registry.test.ts entrypoints/content/run-injections.ts lib/content-modules/utils/react-helpers.ts
```

If any of those files changed after this plan was written, read the current files first and adapt the steps below. Do not overwrite unrelated user edits.

## Status

- Priority: P1
- Effort: S
- Risk: Low
- Depends on: none
- Category: resilience, lifecycle, observability
- Planned at commit: `80362a9`
- Planned on: 2026-06-13
- Status: DONE
- Completed on: 2026-06-13

## Why

Mobile Lite modules are initialized and torn down sequentially. A throw from one module currently stops later modules from initializing or cleaning up. That makes one faulty feature capable of disabling unrelated Mobile Lite features or leaving mounted UI behind during teardown.

The desktop/content injection side already uses failure isolation (`Promise.allSettled` in `entrypoints/content/run-injections.ts`). Mobile Lite should provide similar per-module isolation inside its registry.

## Current state

Target file:

- `features/mobile-lite/logic/registry.ts`

Relevant behavior:

```ts
export function initMobileLite(context = getMobileLiteContext()): void {
  for (const module of MOBILE_LITE_MODULES) {
    if (module.shouldRun(context)) {
      module.init()
    }
  }
}

export function teardownMobileLite(): void {
  for (const module of MOBILE_LITE_MODULES) {
    module.teardown()
  }
}
```

Existing tests in `features/mobile-lite/logic/registry.test.ts` verify normal init and teardown paths, but not thrown module failures.

## Scope

In scope:

- `features/mobile-lite/logic/registry.ts`
- `features/mobile-lite/logic/registry.test.ts`

Out of scope:

- Changing module order
- Making module init async
- Adding retry behavior
- Reworking root-manager error boundaries
- Changing the content entrypoint injection lifecycle

## Implementation steps

1. Add logger coverage to the registry tests.
   - Mock `@/lib/logger`.
   - Add `logger.error` as a `vi.fn()`.
   - Reset it in the existing `beforeEach`.

2. Add a failing init-isolation test first.
   - Configure one runnable module mock to throw from `init()`.
   - Call `initMobileLite()` with a context where that module and a later module should run.
   - Assert the call does not throw.
   - Assert the later module's `init()` still runs.
   - Assert `logger.error` is called with the failing module id and the original error.

3. Add a failing teardown-isolation test.
   - Configure one module mock to throw from `teardown()`.
   - Call `teardownMobileLite()`.
   - Assert the call does not throw.
   - Assert later module `teardown()` mocks still run.
   - Assert `logger.error` is called with the failing module id and the original error.

4. Implement per-module try/catch in the registry.
   - Import `logger` from `@/lib/logger`.
   - Keep the public `MobileLiteModule`, `MOBILE_LITE_MODULES`, `initMobileLite`, and `teardownMobileLite` API stable.
   - Prefer small local helpers for clarity:

```ts
function initModule(mobileModule: MobileLiteModule, context: MobileLiteContext): void {
  if (!mobileModule.shouldRun(context)) return

  try {
    mobileModule.init()
  } catch (error) {
    logger.error(`Mobile Lite module "${mobileModule.id}" failed to initialize`, error)
  }
}

function teardownModule(mobileModule: MobileLiteModule): void {
  try {
    mobileModule.teardown()
  } catch (error) {
    logger.error(`Mobile Lite module "${mobileModule.id}" failed to tear down`, error)
  }
}
```

5. Keep module ordering unchanged.
   - `initMobileLite()` should still iterate `MOBILE_LITE_MODULES` in the current order.
   - `teardownMobileLite()` should still iterate in the current order unless an existing test or architecture doc says teardown must be reverse-order.

## Test plan

Run the focused registry test:

```powershell
npm run test:run -- features/mobile-lite/logic/registry.test.ts
```

Run the Mobile Lite slice:

```powershell
npm run test:run -- features/mobile-lite
```

Finish with typechecking:

```powershell
npm run compile
```

## Done criteria

- A thrown module `init()` no longer prevents later eligible modules from initializing.
- A thrown module `teardown()` no longer prevents later modules from cleaning up.
- Each caught failure is logged with the module id and original error.
- Existing module order and public exports remain unchanged.
- `npm run test:run -- features/mobile-lite` passes.
- `npm run compile` passes.

## STOP / ask before continuing

Stop and ask if:

- A module relies on fail-fast behavior to prevent later modules from running in a partially initialized page. If so, add an explicit dependency flag or module grouping instead of relying on thrown exceptions.
- Logger imports create a content-script bundle or test-cycle issue. In that case, inspect existing feature logging patterns and follow the nearest local convention.

## Maintenance notes

This is a registry resilience fix. Keep the catch blocks narrow and observable; swallowing errors without logging would make future Mobile Lite failures harder to debug.

## Execution notes

- Added per-module failure isolation around Mobile Lite module initialization and teardown.
- Added logger coverage for init and teardown failures, including module id and original error.
- Verified:
  - `npm run test:run -- features/mobile-lite/logic/registry.test.ts`
  - `npm run test:run -- features/mobile-lite`
  - `npm run compile`
