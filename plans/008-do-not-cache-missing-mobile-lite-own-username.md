# Plan 008: Do not cache missing Mobile Lite own username

## Executor instructions

Worktree drift check before editing:

```powershell
git diff --stat 80362a9..HEAD -- features/mobile-lite/logic/own-username.ts features/mobile-lite/logic/own-username.test.ts features/mobile-lite/logic/post-gestures.ts features/mobile-lite/hooks/use-ignored-users.ts
```

If any of those files changed after this plan was written, read the current files first and adapt the steps below. Do not overwrite unrelated user edits.

## Status

- Priority: P1
- Effort: S
- Risk: Low
- Depends on: none
- Category: bug, lifecycle, ignored users
- Planned at commit: `80362a9`
- Planned on: 2026-06-13
- Status: DONE
- Completed on: 2026-06-13

## Why

Mobile Lite can initialize on forum pages before the user menu is mounted. If `getOwnUsername()` runs during that window, it caches `null`. Later calls keep returning `null` even after the real user menu appears, so self-protection checks in ignored-users and gestures can fail for the rest of the page lifetime.

## Current state

Target file:

- `features/mobile-lite/logic/own-username.ts`

Relevant behavior:

```ts
let cachedOwnUsername: string | null | undefined

export function getOwnUsername(): string | null {
  if (cachedOwnUsername !== undefined) return cachedOwnUsername

  const ownLink = document.querySelector<HTMLAnchorElement>('#usermenu a[href^="/id/"]')
  const match = ownLink?.getAttribute('href')?.match(/^\/id\/([^/]+)/)
  cachedOwnUsername = match?.[1] ? safeDecodeUsername(match[1]).toLowerCase() : null
  return cachedOwnUsername
}
```

Relevant callers:

- `features/mobile-lite/hooks/use-ignored-users.ts`
- `features/mobile-lite/logic/post-gestures.ts`

Relevant registry behavior:

- `features/mobile-lite/logic/registry.ts` intentionally allows the panel to run on forum pages even if the user menu is mounted later.

Current tests:

- `features/mobile-lite/logic/own-username.test.ts` covers lowercasing, missing profile link, non-null cache behavior, reset, and percent-decoding.

## Scope

In scope:

- `features/mobile-lite/logic/own-username.ts`
- `features/mobile-lite/logic/own-username.test.ts`

Optional verification scope:

- `features/mobile-lite/logic/post-gestures.test.ts`
- `features/mobile-lite/logic/panel.test.tsx`

Out of scope:

- Changing ignored-users storage
- Changing registry page gating
- Adding polling or observers for the user menu

## Implementation steps

1. Add a regression test for late user menu availability.
   - Start with no `#usermenu`.
   - Call `getOwnUsername()` and assert it returns `null`.
   - Add a user menu link such as `#usermenu a[href="/id/LateUser"]`.
   - Call `getOwnUsername()` again without `resetOwnUsernameCache()`.
   - Assert it returns `lateuser`.

2. Keep the non-null cache behavior covered.
   - Update or rename the existing cache test so it explicitly verifies detected usernames are cached until reset.
   - Example flow: resolve `firstuser`, remove/replace DOM, call again, still get `firstuser`; then reset and get the new username.

3. Change the cache semantics.
   - Cache only a detected username.
   - Do not cache `null` for a missing menu or malformed link.
   - A minimal shape is:

```ts
let cachedOwnUsername: string | undefined

export function getOwnUsername(): string | null {
  if (cachedOwnUsername !== undefined) return cachedOwnUsername

  const ownLink = document.querySelector<HTMLAnchorElement>('#usermenu a[href^="/id/"]')
  const match = ownLink?.getAttribute('href')?.match(/^\/id\/([^/]+)/)
  if (!match?.[1]) return null

  cachedOwnUsername = safeDecodeUsername(match[1]).toLowerCase()
  return cachedOwnUsername
}
```

4. Keep `resetOwnUsernameCache()` behavior.
   - It should set the cache back to `undefined`.
   - Existing callers and tests should not need import changes.

## Test plan

Run the focused test:

```powershell
npm run test:run -- features/mobile-lite/logic/own-username.test.ts
```

Run nearby behavior tests:

```powershell
npm run test:run -- features/mobile-lite/logic/post-gestures.test.ts features/mobile-lite/logic/panel.test.tsx
```

Then run the Mobile Lite slice and typecheck:

```powershell
npm run test:run -- features/mobile-lite
npm run compile
```

## Done criteria

- A missing user menu result is not cached.
- A username discovered later is returned without requiring `resetOwnUsernameCache()`.
- A discovered username is still cached until reset.
- Existing self-user comparisons in ignored-users and post gestures keep working.
- `npm run test:run -- features/mobile-lite` passes.
- `npm run compile` passes.

## STOP / ask before continuing

Stop and ask if:

- Another recent change introduced an async/current-user source that should replace DOM reading entirely.
- Logged-out behavior depends on caching the missing username for performance. If so, document that tradeoff and add a short-lived retry/cache strategy instead of permanent `null`.

## Maintenance notes

This is a lifecycle correctness fix. Avoid adding observers or broader state machinery unless tests show repeated DOM lookup is measurably problematic.

## Execution notes

- Changed `getOwnUsername()` to cache only detected usernames, not missing menu/profile-link results.
- Added a regression test for a late-mounted `#usermenu` profile link.
- Verified:
  - `npm run test:run -- features/mobile-lite/logic/own-username.test.ts`
  - `npm run test:run -- features/mobile-lite/logic/post-gestures.test.ts features/mobile-lite/logic/panel.test.tsx`
  - `npm run test:run -- features/mobile-lite`
  - `npm run compile`
