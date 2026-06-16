# Plan 011: Make the WXT storage mock stateful

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer tells you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ff93b10..HEAD -- tests/mocks/wxt-imports.ts tests/setup.ts tests/mocks/wxt-imports.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: tests, dx
- **Planned at**: commit `ff93b10`, 2026-06-16

## Why this matters

Stats code uses both `storage.defineItem(...).getValue/setValue` and
`storage.getItem/setItem` via `lib/storage/compressed-storage.ts`. The current
`#imports` mock always returns the default value and makes `setValue` a no-op,
so tests cannot faithfully verify persistence, compressed storage migrations,
or multi-write behavior in the rhythm clock. This plan establishes a realistic
test substrate before fixing higher-risk rhythm storage bugs.

## Current state

- `tests/mocks/wxt-imports.ts` mocks the WXT virtual module used by source files.
- `tests/setup.ts` already has a stateful browser storage mock and resets it
  before each test.
- `lib/storage/compressed-storage.ts` calls `storage.getItem`, `storage.setItem`,
  `storage.removeItem`, and `storage.snapshot`.

Relevant excerpts:

```ts
// tests/mocks/wxt-imports.ts:10
const createStorageItem = (defaultValue?: unknown) => ({
	getValue: vi.fn(() => Promise.resolve(defaultValue ?? null)),
	setValue: vi.fn(() => Promise.resolve()),
	removeValue: vi.fn(() => Promise.resolve()),
	watch: vi.fn(() => vi.fn()),
	defaultValue,
})

// tests/mocks/wxt-imports.ts:19
defineItem: vi.fn((_key: string, options?: { defaultValue?: unknown }) =>
	createStorageItem(options?.defaultValue)
),
getItem: vi.fn((_key: string) => Promise.resolve(null)),
setItem: vi.fn((_key: string, _value: unknown) => Promise.resolve()),
removeItem: vi.fn((_key: string) => Promise.resolve()),
```

```ts
// tests/setup.ts:185
mockBrowser.storage.local._setStore({})
mockBrowser.storage.sync._setStore({})
```

```ts
// lib/storage/compressed-storage.ts:69
const rawValue = await storage.getItem<T | string>(key)

// lib/storage/compressed-storage.ts:109
await storage.setItem(key, compressedValue)
```

Repo conventions to follow:

- Test files use Vitest and are colocated or placed under `tests/` when testing
  shared test infrastructure.
- Use `vi.fn` for mocks and keep reset behavior in `tests/setup.ts`.
- Do not introduce `any`; use `unknown`, narrow values, or small local types.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test:run -- tests/mocks/wxt-imports.test.ts` | exit 0; new mock tests pass |
| Existing rhythm tests | `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` | exit 0; no regressions |
| Typecheck | `npm run compile` | exit 0; no TypeScript errors |

## Scope

**In scope**:

- `tests/mocks/wxt-imports.ts`
- `tests/mocks/wxt-imports.test.ts` (create)
- `tests/setup.ts` only if a reset hook is needed for the new WXT mock state

**Out of scope**:

- Any source file under `features/stats/`
- Any production storage behavior
- Test rewrites outside the focused mock coverage

## Git workflow

- Branch: `advisor/011-stateful-wxt-storage-mock`
- Commit message style observed in repo: `fix(scope): short imperative summary`
  or `test(scope): short imperative summary`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Back the `#imports` storage mock with real state

Update `tests/mocks/wxt-imports.ts` so `defineItem`, `getItem`, `setItem`,
`removeItem`, and `snapshot` all read and write the same backing store.

Implementation guidance:

- Reuse `mockBrowser.storage.local` and `mockBrowser.storage.sync` from
  `tests/setup.ts` instead of creating an unrelated store.
- Treat WXT keys like `local:mv-rhythm-stats` and `sync:...` consistently.
  A simple helper is enough:

```ts
type StorageArea = 'local' | 'sync'

function parseWxtKey(key: string): { area: StorageArea; fullKey: string; rawKey: string } {
	const [areaCandidate, ...rest] = key.split(':')
	const area: StorageArea = areaCandidate === 'sync' ? 'sync' : 'local'
	const rawKey = rest.length > 0 ? rest.join(':') : key
	return { area, fullKey: `${area}:${rawKey}`, rawKey }
}
```

- It is acceptable for the test backing store to store values by the full key
  (`local:foo`) as long as every mock API is internally consistent.
- `defineItem(key, { defaultValue })` should return an object where:
  - `getValue()` resolves the stored value, or a cloned default, or `null`.
  - `setValue(value)` persists the value.
  - `removeValue()` removes the value.
  - `watch(callback)` registers the callback and returns an unsubscribe function.
- `storage.getItem(key)`, `storage.setItem(key, value)`, and
  `storage.removeItem(key)` should share the same stored value as the item
  returned by `defineItem(key, ...)`.
- Add `storage.snapshot(area)` because `getDecompressedSnapshot()` uses it.
  Return a shallow object of values for that area. Prefer raw keys without the
  `local:` prefix if that is easier to match WXT behavior, but document the
  choice in a short test.
- Clone object/array default values before returning them so one test cannot
  mutate another test's default object by reference. `structuredClone` is fine
  in the Vitest/jsdom environment; otherwise use `JSON.parse(JSON.stringify())`
  for JSON-compatible defaults.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Add focused tests for the mock contract

Create `tests/mocks/wxt-imports.test.ts`.

Cover these cases:

- `defineItem('local:test-key', { defaultValue: { count: 0 } })` returns the
  default before anything is written.
- `setValue` persists and `getValue` reads the new value.
- `storage.setItem('local:test-key', value)` is visible through the item from
  `defineItem('local:test-key')`, and `item.setValue(value)` is visible through
  `storage.getItem('local:test-key')`.
- `removeValue` and `storage.removeItem` clear the value.
- `watch` fires on writes and stops firing after unsubscribe.
- `storage.snapshot('local')` includes local values and excludes sync values.

Use `beforeEach` to clear storage if needed, matching the reset style in
`tests/setup.ts`.

**Verify**: `npm run test:run -- tests/mocks/wxt-imports.test.ts` -> all tests pass.

### Step 3: Check existing rhythm tests on the improved mock

Run the rhythm tests that currently import modules using `#imports`.

**Verify**:
`npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts`
-> all tests pass.

## Test plan

- New file: `tests/mocks/wxt-imports.test.ts`.
- Use `features/stats/logic/rhythm.test.ts` as a style reference for simple
  Vitest `describe/it/expect` structure.
- Do not change production tests just to fit the mock; if a production test
  breaks, inspect whether the new mock is exposing a real bug.

## Done criteria

- [ ] `tests/mocks/wxt-imports.ts` has stateful `defineItem`, `getItem`,
  `setItem`, `removeItem`, `watch`, and `snapshot` behavior.
- [ ] `npm run test:run -- tests/mocks/wxt-imports.test.ts` exits 0.
- [ ] `npm run test:run -- features/stats/logic/rhythm.test.ts features/stats/logic/rhythm-share-availability.test.ts` exits 0.
- [ ] `npm run compile` exits 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row for plan 011 is updated.

## STOP conditions

Stop and report back if:

- `#imports` is no longer mocked from `tests/mocks/wxt-imports.ts`.
- WXT's real `storage` API shape in this repo requires behavior beyond
  `defineItem`, `getItem`, `setItem`, `removeItem`, `watch`, and `snapshot`.
- A failing existing test depends on the old no-op behavior and cannot be
  fixed by making the test expectation more realistic.
- Implementing this requires touching production source files.

## Maintenance notes

- This mock becomes the baseline for future storage-heavy stats tests. Reviewers
  should scrutinize whether defaults are cloned and whether local/sync stores
  stay isolated.
- If future code uses additional WXT storage APIs, add them here with focused
  tests before relying on them in feature tests.
