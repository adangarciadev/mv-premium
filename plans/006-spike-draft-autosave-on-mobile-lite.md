# Plan 006: Spike — draft autosave for the Mobile Lite editor

> **Executor instructions**: This is a DESIGN/SPIKE plan. Deliverables are (a) a
> short design note and (b) a minimal, flag-gated prototype that prevents text
> loss in the mobile editor — not a full drafts manager. Follow the steps, run
> every verification command, honor "STOP conditions". When done, update this
> plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a42fc7f..HEAD -- features/mobile-lite/logic/editor-lite.ts features/drafts`
> If those paths changed, re-read the cited files before proceeding; on a major
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the live mobile editor textarea; must not interfere with posting)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `a42fc7f`, 2026-06-13

## Why this matters

On a phone, writing a forum reply and then losing it — app switch, tab eviction,
accidental back — is the worst Mobile Lite experience, and it has no safety net
today. The desktop extension has a full `drafts` feature with persistent
storage, but the Mobile Lite editor module has **no autosave at all** (confirmed:
`grep -i "draft\|autosave\|localStorage" features/mobile-lite/logic/editor-lite.ts`
returns nothing). This spike proves a minimal "never lose your text" autosave
behind the existing feature flag and decides whether to reuse the existing
drafts storage or a lighter dedicated buffer.

## Current state

- `features/mobile-lite/logic/editor-lite.ts` — the Mobile Lite editor
  enhancements module (registry id `editor-lite`, runs when
  `context.hasEditor || context.isForumRelated`). It currently has **no**
  draft/autosave logic. The editor textarea selector used across Mobile Lite is:
  `textarea#cuerpo, textarea[name="cuerpo"], .editor-body textarea`
  (see `features/mobile-lite/logic/registry.ts` `EDITOR_SELECTOR`).
- `features/mobile-lite/logic/registry.ts` — module registry; `editor-lite` is
  already registered. The autosave can live inside that module (no new registry
  entry needed) or as a sibling — decide in Step 1.
- Desktop drafts as reference (read, don't necessarily reuse wholesale):
  - `features/drafts/storage/index.ts` — persistent drafts API over
    `@wxt-dev/storage`. Relevant exports:
    ```ts
    export interface Draft { /* id, content, title, type, createdAt, updatedAt, ... */ }
    export async function getDrafts(): Promise<Draft[]>
    export async function getDraft(id: string): Promise<Draft | null>
    export async function createDraft(d: Omit<Draft,'id'|'createdAt'|'updatedAt'>): Promise<Draft>
    export async function updateDraft(id: string, patch: Partial<Draft>): Promise<...>
    export function onDraftsChanged(cb: (data: DraftsData) => void): () => void
    ```
  - `features/drafts/logic/beforeunload-manager.ts` — desktop's unsaved-work
    guard; reference for *when* to persist.
  - `features/drafts/logic/save-draft-button-inject.ts` — how desktop attaches
    save behavior to the editor.

Conventions to match (from `.claude/CLAUDE.md`):
- Storage exclusively via `@wxt-dev/storage` (`storage.defineItem`), never raw
  `browser.storage` and never `localStorage`. Storage-key constants live in
  `constants/storage-keys.ts`.
- Code English, UI text Spanish. Logger from `@/lib/logger`. Debounce timing
  constants belong in `constants/timing.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run compile` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests (mobile-lite) | `npx vitest run features/mobile-lite` | all pass |
| Confirm gap | `grep -i "draft\|autosave\|localStorage" features/mobile-lite/logic/editor-lite.ts` | no matches (baseline) |
| Dev (Firefox) | `npm run dev:firefox` | starts (manual smoke) |

## Scope

This is a spike: minimal, flag-gated, no full drafts UI.

**In scope** (create/modify):
- `plans/006-design-notes.md` (create) — design output (Step 1).
- A small autosave helper module under `features/mobile-lite/logic/` (pure
  functions + a thin DOM/storage wrapper), wired into the existing `editor-lite`
  module lifecycle (init/teardown).
- New storage-key constant in `constants/storage-keys.ts` if a dedicated buffer
  is chosen.
- Co-located tests for the **pure** parts (key derivation, restore/clear logic).

**Out of scope** (do NOT touch):
- `features/drafts/**` — read for reference; reuse only via its public storage
  exports if Step 1 chooses that path. Do not modify the desktop drafts feature.
- Building a drafts list/manager UI in the mobile panel — that's a follow-up.
- Slash commands / templates.

## Git workflow

- Branch: `advisor/006-spike-draft-autosave-mobile`
- Commit per logical unit; conventional commits, e.g.
  `feat(mobile-lite): spike editor draft autosave`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the design note (decide the storage model)

Create `plans/006-design-notes.md` answering, with evidence:

1. **Storage model**: reuse `features/drafts/storage` (`createDraft`/
   `updateDraft`) vs. a dedicated single "in-progress buffer" keyed by editor
   context. Recommend one. (A lightweight per-context buffer is usually the
   right spike choice; justify whichever you pick.) Reading
   `features/drafts/storage/index.ts` is required.
2. **Key derivation**: how to identify "this editor on this thread / new-thread"
   so restore targets the right textarea (e.g. thread id from URL, or a
   new-thread marker). Define the pure function and its inputs.
3. **Save trigger & cadence**: debounced `input` (state the ms; put the constant
   in `constants/timing.ts`) plus `visibilitychange`/`pagehide` (mobile-safe
   equivalents of desktop's beforeunload — note `beforeunload` is unreliable on
   mobile). Cite `features/drafts/logic/beforeunload-manager.ts` as the desktop
   reference.
4. **Restore**: when and how to repopulate the textarea on load without
   clobbering text the user already started typing.
5. **Clear**: when to discard the buffer (successful submit). Describe how you
   detect submission for the Mobile Lite editor.

**Verify**: `test -f plans/006-design-notes.md && echo OK` → `OK`; all five
points addressed.

### Step 2: Implement the pure core (tested)

Implement and unit-test the pure pieces from Step 1: context-key derivation, and
the restore decision (given saved text + current textarea value, decide
restore/skip). No DOM side effects in these functions.

**Verify**: `npm run compile` → 0; `npx vitest run features/mobile-lite` → all
pass including the new tests.

### Step 3: Wire autosave into the editor-lite lifecycle (flag-gated)

Inside the existing `editor-lite` module's `init`/`teardown`, attach: a debounced
input listener that persists via `@wxt-dev/storage`, a `visibilitychange`/
`pagehide` flush, a restore-on-init pass, and a clear-on-submit. All listeners
must be removed in `teardown` (no leaks). Gate everything through the existing
`initMobileLite` flag path (do not add a separate enable check unless Step 1
justifies a user toggle).

**Verify**: `npm run compile` → 0; `npm run lint` → 0;
`npx vitest run features/mobile-lite` → all pass. Then manual smoke via
`npm run dev:firefox`: type in a thread reply, reload the page → text is
restored; submit → buffer is cleared (typing again on a fresh thread shows
nothing stale). Record the smoke result in `plans/006-design-notes.md`.

## Test plan

- Co-located `*.test.ts` for the pure core, modeled on an existing
  `features/mobile-lite/**/*.test.ts`. Cases: key derivation for thread vs.
  new-thread; restore when textarea empty (restore), restore when user already
  typed (skip); clear after submit.
- Listener attach/detach is verified by manual smoke + existing registry
  teardown tests, not new brittle integration tests.
- Verification: `npx vitest run features/mobile-lite` → all pass.

## Done criteria

ALL must hold:

- [ ] `plans/006-design-notes.md` exists and answers the five Step-1 questions
- [ ] `npm run compile` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npx vitest run features/mobile-lite` exits 0, including new pure-core tests
- [ ] Autosave persists via `@wxt-dev/storage` (no `localStorage`, no raw `browser.storage`): `grep -rn "localStorage" features/mobile-lite/logic` returns no new matches
- [ ] All added listeners are removed in `editor-lite` teardown
- [ ] `features/drafts/**` is unmodified (`git status`)
- [ ] Manual smoke (restore + clear-on-submit) recorded in the design note
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Mobile Lite editor textarea selector no longer matches
  `textarea#cuerpo, textarea[name="cuerpo"], .editor-body textarea` (DOM drift).
- Detecting successful submission (Step 1.5) requires intercepting the post
  request or touching the background script — document the options and stop.
- Reusing `features/drafts/storage` would require changing its public API.
- Autosave appears to interfere with normal posting in the smoke test — back out
  and report rather than shipping a risky editor change.

## Maintenance notes

- Follow-up build plan could surface saved drafts in the panel (a "borradores"
  entry) and unify with the desktop `drafts` storage if Step 1 chose the
  dedicated-buffer path.
- A reviewer must scrutinize: teardown removes every listener; autosave never
  overwrites text the user is actively typing; the buffer is cleared on submit
  (no stale text leaking into a different thread).
- Watch interaction with other `editor-lite` behaviors (image crop/upload) and
  with `quote-selection`, which also manipulates the editor.
