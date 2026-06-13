# Plan 005: Spike — AI thread summaries inside Mobile Lite

> **Executor instructions**: This is a DESIGN/SPIKE plan, not a build-everything
> plan. The deliverables are (a) a short design note and (b) a minimal,
> flag-gated working prototype — not a polished, fully-tested feature. Follow
> the steps, run every verification command, and honor the "STOP conditions".
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a42fc7f..HEAD -- features/thread-summarizer features/mobile-lite services/ai`
> If those paths changed since this plan was written, re-read the cited files
> before proceeding; on a major mismatch, treat it as a STOP condition.

## Review verdict (2026-06-13 execute attempt)

**Decisions: APPROVED. Prototype: BLOCKED for develop (built on wrong base).**

The dispatched executor produced an excellent design note (resolved all 5 open
questions with evidence; confirmed NO STOP — `geminiApiKey` lives in the same
`local:mvp-settings` Zustand store as the ImgBB key, so no `services/ai`/background
change is needed) and a clean, well-tested pure view-model
(`thread-summary-view-model.ts` + 4 meaningful tests).

Two landing blockers, both caused by the `execute` worktree basing on **`main`**
rather than the user's **`develop`** branch (verified: develop-tip `a42fc7f` is
NOT an ancestor of the worktree HEAD; merge-base is `81f39d5`):

1. **Verified against stale code.** `npm run compile/lint/vitest` passed, but on a
   base missing the entire develop-only Mobile Lite panel refactor. Green checks
   do NOT certify it works on develop.
2. **Token duplication.** `panel-tokens.ts` does not exist on the `main` base, so
   the executor re-declared `SECONDARY_BUTTON_CLASS`/`GROUP_CLASS`/
   `SECTION_LABEL_CLASS` inline in `thread-summary-sheet.tsx`. On develop these
   MUST be imported from `./panel-tokens` (DESIGN.md single-source-of-truth).
   The design note also describes the panel as "monolithic / many tabs" — that's
   the pre-refactor mental model; on develop it's the thin orchestrator + hooks +
   tabs.

Durable, reusable as-is: this design note's decisions, the view-model + its test,
and the overall module/sheet structure. To land on develop: re-target the
refactored panel, import tokens instead of duplicating, then re-run the gates on
develop. Worktree (throwaway, `main`-based) left at branch
`advisor/005-spike-ai-summary-mobile` for harvesting; nothing merged anywhere.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (new user-facing surface; AI calls cost quota; must not regress the existing panel)
- **Depends on**: none (independent of 004/006)
- **Category**: direction
- **Planned at**: commit `a42fc7f`, 2026-06-13

## Why this matters

Reading long threads on a phone is the single most painful Mediavida-mobile
experience, and Mobile Lite (Firefox Android) is where the project is actively
investing. The extension already has a **complete, tested, AI thread-summary
engine** for desktop — but the Mobile Lite module registry never wires it up.
The logic layer is reusable as-is; what's missing is a mobile trigger and a
mobile result surface. This spike proves the path end-to-end behind the existing
feature flag and writes down the decisions (key handling, entry point, caching)
so a follow-up build plan can finish it cleanly.

## Current state

Reusable engine (do NOT rewrite it — call it):

- `features/thread-summarizer/logic/summarize.ts` — exports
  `summarizeCurrentThread()`. Returns a `ThreadSummary`:
  ```ts
  // features/thread-summarizer/logic/summarize.ts
  export interface ThreadSummary {
    topic: string
    keyPoints: string[]
    participants: { name: string; contribution: string; avatarUrl?: string }[]
    status: string
    title: string
    postsAnalyzed: number
    uniqueAuthors: number
    pageNumber: number
    generationMs?: number
    modelUsed?: string
    error?: string
  }
  ```
  It internally uses `getAIService()` from `@/services/ai/gemini-service`
  (handles the Gemini API key, model selection and 429/back-off retry — see the
  AI memory notes) and scrapes the current page via `./extract-posts`.
- `features/thread-summarizer/index.ts` also exports `summarizeMultiplePages`,
  `SummaryModal`, `MultiPageSummaryModal`. The desktop modals are styled for
  desktop (semantic Tailwind / Shadow DOM) and are **not** reusable on mobile.

Mobile Lite surfaces to integrate with (read these to choose the entry point):

- `features/mobile-lite/logic/registry.ts` — `MOBILE_LITE_MODULES` array; each
  module has `{ id, init, teardown, shouldRun(context) }`. Existing thread-only
  modules gate on `context.isThreadPage` (e.g. `thread-companion`,
  `quote-selection`). A summary trigger belongs to a thread-scoped module.
- `features/mobile-lite/logic/thread-companion.ts` — existing mobile thread
  helper that runs on thread pages; a natural host for a "Resumir" affordance.
- `features/mobile-lite/components/mobile-lite-panel.tsx` + `components/tabs/` +
  `hooks/` — the panel's bottom-sheet design language and the established
  "hook owns state, component is presentational" pattern (post the recent
  refactor). Reuse the sheet/token vocabulary, do not invent a new one.
- `features/mobile-lite/components/panel-tokens.ts` — the app-like token
  constants. Any mobile summary UI MUST use these (see
  `features/mobile-lite/DESIGN.md` — the design contract for all Mobile Lite UI).
- Mounting: use `mountFeature` / `isFeatureMounted` from
  `@/lib/content-modules/utils/react-helpers` and wrap UI in `<ShadowWrapper>`
  (never `ReactDOM.createRoot` directly — see `.claude/CLAUDE.md`).

Conventions to match:
- Lucide icons via direct import only: `import Sparkles from 'lucide-react/dist/esm/icons/sparkles'`.
- Code in English, user-facing text in Spanish.
- Logger from `@/lib/logger`, never `console.*`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run compile` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests (mobile-lite) | `npx vitest run features/mobile-lite` | all pass |
| Dev (Firefox) | `npm run dev:firefox` | dev server starts (manual smoke only) |

## Suggested executor toolkit

- Read `features/mobile-lite/DESIGN.md` before writing any UI.
- If available, the `frontend-design` / `mobile-design` skills for the result
  sheet; the `wxt-browser-extensions` skill for content-script injection.

## Scope

This is a spike. Keep it small and flag-gated.

**In scope** (create/modify):
- `plans/005-design-notes.md` (create) — the written design output (see Step 1).
- A new Mobile Lite module under `features/mobile-lite/logic/` (e.g.
  `thread-summary.tsx`) wired into `registry.ts`, gated on `context.isThreadPage`.
- A new mobile result component under `features/mobile-lite/components/` using
  panel tokens + `<ShadowWrapper>`.
- A co-located test for any **pure** helper you add (mapping `ThreadSummary` →
  view model), following an existing `features/mobile-lite/**/*.test.ts` as the
  pattern.

**Out of scope** (do NOT touch):
- `features/thread-summarizer/**` — reuse via its exports; do not modify the
  engine, its prompts, or its desktop modals.
- `services/ai/**` — call `getAIService()` via `summarizeCurrentThread()`; do
  not change the AI service.
- Multi-page summarization (`summarizeMultiplePages`) — single current page only
  for the spike; note multi-page as a follow-up.
- Desktop summarizer UI.

## Git workflow

- Branch: `advisor/005-spike-ai-summary-mobile`
- Commit per logical unit; conventional commits, e.g.
  `feat(mobile-lite): spike thread summary trigger + result sheet`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the design note (resolve the open questions first)

Create `plans/005-design-notes.md` answering, with evidence from the code you
read:

1. **Entry point**: new standalone module vs. an affordance inside
   `thread-companion.ts`. Recommend one and say why.
2. **API key UX**: `getAIService()` needs a Gemini key. Determine where that key
   is stored and whether a mobile-only user (who never opens the desktop
   options/dashboard) can set it today. If they cannot, specify the smallest fix
   — most likely a Gemini key field in the panel's Settings tab mirroring the
   existing ImgBB key pattern (`features/mobile-lite/hooks/use-imgbb-api-key.ts`
   + `components/tabs/settings-tab.tsx`). Reading those two files is required.
3. **Result surface**: a dedicated bottom sheet (reusing the panel's sheet
   language) vs. a new view inside the existing panel. Recommend one.
4. **Caching & cost**: the engine has a `summary-cache`
   (`features/thread-summarizer/logic/summary-cache.ts`). State whether mobile
   reuses it and how to avoid duplicate AI calls / accidental quota burn (e.g.
   disable the trigger while a request is in flight).
5. **Loading/error states**: list them (in flight, rate-limited/429, no key
   configured, empty thread).

**Verify**: `test -f plans/005-design-notes.md && echo OK` → `OK`, and the file
addresses all five points.

### Step 2: Build the minimal trigger (flag-gated, thread pages only)

Add a Mobile Lite module that, on thread pages, injects a single "Resumir hilo"
affordance (Lucide `Sparkles`/`ScrollText`). Register it in
`MOBILE_LITE_MODULES` with `shouldRun: context => context.isThreadPage`. It must
respect `isMobileLiteAllowed()` (already enforced centrally by
`initMobileLite`), provide a working `teardown`, and never double-inject (use
`isFeatureMounted`). No AI call yet — wire the button to a no-op that logs via
`@/lib/logger`.

**Verify**: `npm run compile` → exit 0; `npm run lint` → exit 0;
`npx vitest run features/mobile-lite` → all pass.

### Step 3: Call the engine and render the result sheet

On trigger: call `summarizeCurrentThread()`, handle the loading/error states
from Step 1, and render the returned `ThreadSummary` (topic, key points,
participants, status) in a mobile result surface built with `panel-tokens` +
`<ShadowWrapper>`. Map `ThreadSummary` to a view model in a **pure, tested**
helper. Disable the trigger while a request is in flight.

**Verify**: `npm run compile` → exit 0; `npx vitest run features/mobile-lite` →
all pass (including the new helper test). Then a manual smoke via
`npm run dev:firefox`: on a thread, the trigger appears, produces a summary, and
the sheet closes cleanly. Record the smoke result in `plans/005-design-notes.md`.

## Test plan

- New pure helper (`ThreadSummary` → view model): co-located `*.test.ts`,
  modeled after an existing `features/mobile-lite/**/*.test.ts`. Cases: normal
  summary, `error` field set, empty `keyPoints`/`participants`.
- Do NOT write brittle DOM/injection integration tests for the spike; the
  registry already has `registry.test.ts` and injection is smoke-tested manually.
- Verification: `npx vitest run features/mobile-lite` → all pass.

## Done criteria

ALL must hold:

- [ ] `plans/005-design-notes.md` exists and answers the five Step-1 questions
- [ ] `npm run compile` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npx vitest run features/mobile-lite` exits 0, including the new helper test
- [ ] The new module is gated on `context.isThreadPage` and has a working `teardown`
- [ ] `features/thread-summarizer/**` and `services/ai/**` are unmodified (`git status`)
- [ ] Manual smoke result recorded in the design note
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `summarizeCurrentThread` is no longer exported from
  `features/thread-summarizer/logic/summarize.ts`, or its return shape differs
  from the "Current state" excerpt (engine drifted).
- Resolving the API-key UX (Step 1.2) would require changing `services/ai/**` or
  the background script — that's a larger decision; document it and stop.
- The mobile result UI cannot be expressed with `panel-tokens` without violating
  `features/mobile-lite/DESIGN.md` — report the conflict rather than inventing
  new tokens.
- Wiring the trigger would require modifying `features/thread-summarizer/**`.

## Maintenance notes

- Follow-up build plan should cover: multi-page summarization
  (`summarizeMultiplePages`), polish, accessibility, and the Gemini-key Settings
  field if Step 1.2 confirmed it's needed.
- A reviewer should scrutinize: teardown/no-double-inject correctness, that AI
  calls can't fire repeatedly (quota), and DESIGN.md token compliance.
- If the panel's hook/component split changes, the result surface should follow
  the same "hook owns state, component presentational" pattern (see
  `mobile-lite-panel-architecture` notes).
