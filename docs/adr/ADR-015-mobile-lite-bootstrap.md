# ADR-015: Mobile Lite Bootstrap Separation

| Metadata    | Value           |
| ----------- | --------------- |
| **Status**  | ✅ Accepted     |
| **Date**    | June 2026       |
| **Authors** | MV Premium Team |

## Context

Mobile Lite runs only on Firefox Android when `mobileLiteEnabled` is true. The previous content
bootstrap imported desktop-oriented modules before the Android guard, so Android pages still paid
for desktop dependencies before exiting.

Mobile Lite is expected to grow as a limited mobile surface, not as a full desktop port. It needs a
clearer module boundary so future mobile features can be added without expanding one monolithic
injector.

## Decision

- Keep `entrypoints/content/main.ts` as a lightweight platform bootstrap.
- Dynamically import `entrypoints/content/desktop-main.ts` only after the runtime is known not to be
  Firefox Android.
- Route Firefox Android through `features/mobile-lite`, which owns a small registry of Mobile Lite
  modules with `shouldRun`, `init`, and `teardown`.
- Keep Mobile Lite and Desktop in the same extension and project, but identify Mobile Lite changes
  separately in changelog metadata.

## Consequences

- Firefox Android can skip desktop-only imports before deciding whether Mobile Lite should run.
- Mobile Lite modules can be added or disabled by context without changing the content bootstrap.
- Desktop behavior remains centralized in the extracted desktop bootstrap.
- Future changes to platform startup should check both Android and desktop paths explicitly.
