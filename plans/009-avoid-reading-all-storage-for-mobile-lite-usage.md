# Plan 009: Avoid reading all extension storage for Mobile Lite usage stats

## Executor instructions

Worktree drift check before editing:

```powershell
git diff --stat 80362a9..HEAD -- features/mobile-lite/hooks/use-storage-usage.ts features/mobile-lite/components/tabs/settings-tab.tsx features/mobile-lite/components/mobile-lite-panel.tsx
```

If any of those files changed after this plan was written, read the current files first and adapt the steps below. Do not overwrite unrelated user edits.

## Status

- Priority: P1
- Effort: S
- Risk: Medium
- Depends on: none
- Category: privacy, performance, storage
- Planned at commit: `80362a9`
- Planned on: 2026-06-13
- Status: DONE
- Completed on: 2026-06-13

## Why

The Mobile Lite settings storage card currently reads every value from `browser.storage.local` before attempting to use `getBytesInUse(null)`. That means the content script materializes all stored values, including unrelated settings and potentially sensitive extension data, just to compute usage statistics.

Where the browser exposes storage metadata APIs, the hook should use them first and avoid full-value reads.

## Current state

Target file:

- `features/mobile-lite/hooks/use-storage-usage.ts`

Relevant behavior:

```ts
async function readUsedBytes(items: Record<string, unknown>): Promise<number> {
  const storageArea = browser.storage.local as Browser.storage.StorageArea.Static & {
    getBytesInUse?: (keys?: string | string[] | null) => Promise<number>
  }

  if (typeof storageArea.getBytesInUse === 'function') {
    try {
      return await storageArea.getBytesInUse(null)
    } catch {
      // Fallback to estimation below
    }
  }

  return estimateBytes(items)
}

useEffect(() => {
  async function loadUsage() {
    const items = await browser.storage.local.get(null)
    const used = await readUsedBytes(items)
    const quota = browser.storage.local.QUOTA_BYTES || DEFAULT_QUOTA_BYTES
    const percentage = Math.min(100, Math.round((used / quota) * 100))

    setUsage({ used, quota, items: Object.keys(items).length, percentage })
  }
  ...
}, [])
```

The `get(null)` call happens before the metadata path, so the safer path never avoids reading all values.

There are no direct tests for `use-storage-usage.ts`.

## Scope

In scope:

- `features/mobile-lite/hooks/use-storage-usage.ts`
- New test file `features/mobile-lite/hooks/use-storage-usage.test.ts` or `.test.tsx`

Optional verification scope:

- `features/mobile-lite/logic/panel.test.tsx`

Out of scope:

- Redesigning the storage card UI
- Changing extension-wide storage keys
- Migrating sensitive settings between storage areas
- Removing usage statistics from Mobile Lite settings

## Implementation steps

1. Extract a testable usage reader.
   - Add a named export such as `readMobileLiteStorageUsage()`.
   - Keep `useStorageUsage()` as the public hook used by UI.
   - The hook should call the helper inside the existing effect and keep the current cancellation pattern.

2. Prefer metadata APIs before full-value reads.
   - Type `browser.storage.local` locally with optional APIs:

```ts
type StorageAreaWithUsage = Browser.storage.StorageArea.Static & {
  getBytesInUse?: (keys?: string | string[] | null) => Promise<number>
  getKeys?: () => Promise<string[]>
}
```

   - Algorithm:
     - Read quota from `QUOTA_BYTES` or `DEFAULT_QUOTA_BYTES`.
     - If `getBytesInUse` exists, call `getBytesInUse(null)` first.
     - If that succeeds, calculate item count with `getKeys()` when available.
     - If `getKeys()` is unavailable, fall back to `get(null)` only for counting keys. Do not pass those values into the byte path.
     - If `getBytesInUse` is missing or throws, fall back to the existing `get(null)` plus `estimateBytes(items)` behavior.

3. Keep returned shape stable.
   - Preserve `{ used, quota, items, percentage }`.
   - Keep `percentage` capped at 100.
   - Keep existing error behavior in `useStorageUsage()` so failed reads do not crash the settings UI.

4. Add direct tests for the helper.
   - Mock `wxt/browser`.
   - Test metadata path:
     - `getBytesInUse(null)` returns a number.
     - `getKeys()` returns a key array.
     - Assert `get(null)` is not called.
     - Assert `used`, `items`, `quota`, and `percentage`.
   - Test fallback path:
     - `getBytesInUse` throws or is absent.
     - `get(null)` returns representative values.
     - Assert estimated bytes and item count are used.
   - If project conventions prefer hook tests, wrap the helper in a tiny test component, but keep assertions focused on storage calls.

## Test plan

Run the focused storage test:

```powershell
npm run test:run -- features/mobile-lite/hooks/use-storage-usage.test.ts
```

If the file uses TSX, adjust the command to `.test.tsx`.

Run nearby UI tests:

```powershell
npm run test:run -- features/mobile-lite/logic/panel.test.tsx
```

Then run the Mobile Lite slice and typecheck:

```powershell
npm run test:run -- features/mobile-lite
npm run compile
```

## Done criteria

- When `getBytesInUse` and `getKeys` are available, the hook/helper does not call `browser.storage.local.get(null)`.
- When metadata APIs are missing or fail, existing usage estimation still works.
- The settings tab keeps receiving the same usage object shape.
- `npm run test:run -- features/mobile-lite` passes.
- `npm run compile` passes.

## STOP / ask before continuing

Stop and ask if:

- TypeScript definitions in the current WXT/browser package reject `getKeys()` even as an optional local extension. In that case, keep the optional type local and minimal; do not add global type declarations for this small hook.
- The UI can tolerate dropping the item count. If the product owner agrees, the implementation can avoid the fallback `get(null)` count when only `getBytesInUse` is available.

## Maintenance notes

This plan reduces unnecessary data exposure in content-script memory. Keep the fallback for compatibility, but make the metadata path the default whenever the browser supports it.

## Execution notes

- Added `readMobileLiteStorageUsage()` so the storage usage calculation can be tested directly.
- Prefer `getBytesInUse(null)` plus `getKeys()` when both metadata APIs are available.
- Kept compatibility fallbacks for missing/throwing metadata APIs.
- Verified:
  - `npm run test:run -- features/mobile-lite/hooks/use-storage-usage.test.ts`
  - `npm run test:run -- features/mobile-lite/logic/panel.test.tsx`
  - `npm run test:run -- features/mobile-lite`
  - `npm run compile`
