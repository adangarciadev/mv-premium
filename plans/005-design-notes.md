# Plan 005 — Design Notes: AI Thread Summaries in Mobile Lite

> **Reviewer note (2026-06-13):** these decisions were authored by the dispatched
> executor against a `main`-based worktree, then ported to `develop` by the
> advisor. On `develop` the Mobile Lite panel is the refactored thin orchestrator
> + per-domain hooks + `components/tabs/*` (NOT the "monolithic" panel referenced
> in §3 — the conclusion still holds: use a standalone sheet, not a panel view).
> The shipped sheet imports tokens from `components/panel-tokens.ts` (single
> source of truth) rather than re-declaring them.

## Manual browser smoke

**DEFERRED** — no browser in the automated environment. Manual smoke on Firefox
Android is the human's step. Automated gates (`npm run compile`, `npm run lint`,
`npx vitest run features/mobile-lite`) are green on `develop`.

---

## 1. Entry point: standalone module vs. affordance inside `thread-companion.ts`

**Recommendation: new standalone module** — `features/mobile-lite/logic/thread-summary.tsx`.

`thread-companion.ts` is a pure CSS fix (forces `#thread-companion` back into
document flow on narrow viewports) with no React surface or state. Adding a
trigger + loading state + result sheet there would violate its single
responsibility. The registry (`registry.ts`) cleanly supports a separate module
(`{ id, init, teardown, shouldRun }`); `thread-summary` gates on
`context.isThreadPage` exactly like `thread-companion`, and stays independently
tearable.

## 2. API key UX: can a mobile-only user configure the Gemini key today?

**No — not without opening the desktop Options/Dashboard.** But the fix is small
and does NOT require touching `services/ai/**` or the background script:

- `getAIService()` (`services/ai/gemini-service.ts`) reads `settings.geminiApiKey`
  from the Zustand settings store (`local:mvp-settings`) — the same store that
  persists `imgbbApiKey`.
- The ImgBB key IS writable from the panel today (`use-imgbb-api-key.ts` +
  `components/tabs/settings-tab.tsx`). The Gemini key persists the same way.

**Smallest follow-up:** add a Gemini key field to the panel Settings tab,
mirroring the ImgBB pattern (a `use-gemini-api-key` hook over `geminiApiKey` +
a field in `settings-tab.tsx`). NOT built in this spike.

## 3. Result surface: dedicated bottom sheet vs. a view inside the panel

**Recommendation: dedicated bottom sheet** (own React root + own `ShadowWrapper`),
so the trigger can summon a summary without forcing the user through the panel's
tab flow. It re-expresses the panel's sheet language (drag handle,
`rounded-t-[24px]`, token ramp, DESIGN.md §7 bleed strip) as a standalone
component (`components/thread-summary-sheet.tsx`).

## 4. Caching & cost

**Reuse the desktop `summary-cache.ts` directly** (`getCachedSingleSummary` /
`setCachedSingleSummary`, keyed by pathname, 5-min TTL, in-memory). Flow:
1. Before calling, check the cache; if hit, render immediately (no AI call).
2. After a successful result, write it to the cache.
3. Track `isLoading` and disable the trigger while true — the primary guard
   against duplicate calls / quota burn.

## 5. Loading and error states

`summarizeCurrentThread()` never throws — all failures come back as
`summary.error` strings, so the caller always branches on `summary.error`.

| State | Condition | UI |
|---|---|---|
| In flight | `isLoading` | spinner / "Generando resumen…" |
| Rate-limited / 429 | `error` ~ "Límite de velocidad" | error state w/ message |
| No key configured | `error` ~ "IA no configurada…" | error state, hint to Settings |
| Empty thread | `postsAnalyzed === 0` | error state "No se detectaron posts" |
| Server error | `error` ~ "Error temporal" | error state, retry |
| Success | `!error` | topic, key points, participants, status |

---

## Follow-up tasks (out of scope for this spike)

- Panel integration: Gemini key field in the Settings tab (see §2).
- Multi-page summarization via `summarizeMultiplePages`.
- "Cached" age indicator (desktop shows "hace 2 min" via `formatCacheAge`).
- A11y pass against DESIGN.md §8 (aria-labels, roles) + manual Firefox Android smoke.
