# Plan 016: Honor the default enabled state for rhythm tracking

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 422c9d0..HEAD -- features/stats/logic/time-tracker.ts features/stats/logic/time-tracker.test.ts store/settings-store.ts store/settings-defaults.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `422c9d0`, 2026-06-16

## Why this matters

`Tiempo en Mediavida` is intended to be enabled by default. The React settings
store has `enableRhythmTracking: true`, but the content runtime reads settings
through `getSettings()`, which returns only persisted keys. On a fresh install
or a profile with no explicit rhythm preference, the tracker sees
`undefined` and currently treats it as disabled. That can make the clock stay
empty even though the UI says the feature is on.

## Current state

- `store/settings-defaults.ts` defines the intended default.
- `store/settings-store.ts` exposes `getSettings()` for non-React contexts. It
  returns `Partial<Settings>` and falls back to `{}` when no settings are
  persisted.
- `features/stats/logic/time-tracker.ts` incorrectly treats any falsy value as
  disabled.

Relevant excerpts:

```ts
// store/settings-defaults.ts:82
enableActivityTracking: false,
enableRhythmTracking: true,
```

```ts
// store/settings-store.ts:295
export async function getSettings(): Promise<Partial<Settings>> {
```

```ts
// store/settings-store.ts:313
return {}
```

```ts
// features/stats/logic/time-tracker.ts:71
const settings = await getSettings()
if (!settings.enableRhythmTracking) return
```

Repo convention to match:

- Optional persisted settings with a default-enabled feature are checked as
  `settings.someFlag !== false`; for example
  `features/mobile-lite/logic/gallery.tsx` returns
  `settings.galleryButtonEnabled !== false`.
- The legacy heatmap intentionally uses explicit false semantics in
  `features/stats/storage.ts`: `settings.enableActivityTracking === false`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test:run -- features/stats/logic/time-tracker.test.ts` | exit 0; new tests pass |
| Existing rhythm tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0; no regressions |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `features/stats/logic/time-tracker.ts`
- `features/stats/logic/time-tracker.test.ts` (create)

**Read-only context**:

- `store/settings-defaults.ts`
- `store/settings-store.ts`

**Out of scope**:

- Changing `DEFAULT_SETTINGS`
- Changing `getSettings()` globally
- Heatmap/activity tracking semantics
- UI copy in settings or dashboard
- Any storage migration

## Git workflow

- Branch: stay on the operator's current branch unless told otherwise. This
  repo is usually worked on from `develop`.
- Commit message style: conventional commits are used in the existing history,
  for example `fix(stats): serialize rhythm tracking writes`.
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Add an explicit rhythm-enabled helper

In `features/stats/logic/time-tracker.ts`, add a small exported helper near the
module constants:

```ts
export function isRhythmTrackingEnabled(settings: Pick<Partial<Settings>, 'enableRhythmTracking'>): boolean {
	return settings.enableRhythmTracking !== false
}
```

Import the `Settings` type from `@/store` only if it is already exported from
that barrel. If it is not exported cleanly, import `type { Settings }` from
`@/store/settings-types` to avoid changing the store barrel.

Replace the current check inside `saveTime()`:

```ts
if (!settings.enableRhythmTracking) return
```

with:

```ts
if (!isRhythmTrackingEnabled(settings)) return
```

**Verify**:
`rg "!settings\\.enableRhythmTracking|isRhythmTrackingEnabled" features/stats/logic/time-tracker.ts`
-> no `!settings.enableRhythmTracking` match remains, and the helper plus call
site are present.

### Step 2: Add focused helper tests

Create `features/stats/logic/time-tracker.test.ts` if it does not exist.
Follow the simple Vitest style used by
`features/stats/logic/rhythm.test.ts`.

Add tests for `isRhythmTrackingEnabled()`:

- returns `true` for `{}`
- returns `true` for `{ enableRhythmTracking: true }`
- returns `false` for `{ enableRhythmTracking: false }`

Do not attempt full interval/integration tests in this plan. Plan 017 will add
tracker lifecycle coverage once cleanup is available.

**Verify**:
`npm run test:run -- features/stats/logic/time-tracker.test.ts`
-> exit 0 and all new tests pass.

### Step 3: Run rhythm regression checks

Run the existing rhythm tests.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> exit 0.

### Step 4: Typecheck

Run the repo typecheck.

**Verify**:
`npm run compile`
-> exit 0.

## Test plan

- New file: `features/stats/logic/time-tracker.test.ts`
- Cases:
  - missing persisted preference means enabled
  - explicit true means enabled
  - explicit false means disabled
- Existing tests:
  - `features/stats/logic/rhythm.test.ts`
  - `features/stats/logic/rhythm-share-availability.test.ts`

## Done criteria

- [ ] `features/stats/logic/time-tracker.ts` no longer contains
  `!settings.enableRhythmTracking`.
- [ ] `isRhythmTrackingEnabled({})` is covered by a test and returns `true`.
- [ ] `isRhythmTrackingEnabled({ enableRhythmTracking: false })` is covered by
  a test and returns `false`.
- [ ] Focused tests exit 0.
- [ ] `npm run compile` exits 0.
- [ ] No files outside the in-scope list are modified, except
  `plans/README.md` status if the executor is responsible for updating it.

## STOP conditions

Stop and report back if:

- `getSettings()` has changed to return fully merged defaults. In that case the
  root bug may already be fixed differently.
- The `Settings` type cannot be imported without changing store exports.
- Fixing this appears to require changing global settings hydration behavior.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Use explicit false semantics for default-enabled feature toggles in content
runtime code. This is especially important when using `getSettings()` because
it intentionally returns a partial object, not a fully hydrated settings state.
