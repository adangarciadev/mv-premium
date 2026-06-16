# Plan 004: CLAUDE.md reflects the real feature surface and has no dead doc links

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a42fc7f..HEAD -- .claude/CLAUDE.md`
> If `.claude/CLAUDE.md` changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `a42fc7f`, 2026-06-13

## ❌ REJECTED — already resolved on disk (2026-06-13)

Verification during the execute attempt showed this finding was an artifact of a
**stale `.claude/CLAUDE.md` snapshot** loaded into the advisor's session context
at startup. The live file on disk already:

- contains **46 feature rows** — one per actually-implemented feature (every
  tracked `features/*` directory), and
- has **no `TECH_DEBT.md` reference** (`grep -c "TECH_DEBT" .claude/CLAUDE.md` → 0).

The "53 vs 46" gap is not missing documentation: the 7 untracked directories
(`game-news`, `game-prices`, `game-wishlist`, `mediavida-notifications`,
`sports-fixtures`, `streamable-expand`, `tag-filter`) are **empty scaffold
folders** (zero source files — only empty `components/`/`logic/`/`hooks/`
subdirs). They are future-feature placeholders and correctly excluded from the
list. Adding them would document vaporware.

No edit is needed or desirable. Status: REJECTED. The constraint note below
remains accurate (the file IS gitignored) and is kept for the record in case a
real CLAUDE.md change is ever planned.

## ⚠️ Execution constraint (still true, kept for the record)

This plan **cannot be run by a worktree-isolated executor**. Two reasons,
both verified:

1. **`.claude/CLAUDE.md` is gitignored** (`git check-ignore .claude/CLAUDE.md`
   → exit 0). An isolated worktree can neither commit nor surface the edit, so
   the change never reaches the user's working tree. **Run this against the
   MAIN working tree, not an isolated worktree.** No git branch/commit is
   possible or needed for this file.
2. **7 feature dirs are untracked** in git, so a checkout of HEAD (what a
   worktree sees) is missing them. The working tree has **53** dirs; only **46**
   are tracked. The untracked 7, which MUST appear in the table, are:
   `game-news`, `game-prices`, `game-wishlist`, `mediavida-notifications`,
   `sports-fixtures`, `streamable-expand`, `tag-filter`. Their descriptions in
   the draft table below are unverified-against-index for the same reason a
   worktree can't see them — verify by reading `features/<name>/index.*` in the
   main tree.

The first execute attempt (isolated worktree) produced a correct **46-row**
table but it was stranded in the worktree and omitted the 7 untracked features.
The corrected target is **53 rows**.

## Why this matters

`.claude/CLAUDE.md` is the instruction file loaded into every AI agent session
working on this repo. Its "Complete Feature List" documents **27 features**, but
`features/` actually contains **53 feature directories**. Agents therefore plan
against a map that is missing roughly half the codebase (games, notifications,
price tools, work-mode, content-rules, etc.), which produces wrong assumptions
and duplicated work. Separately, CLAUDE.md links to `TECH_DEBT.md`, a file that
**does not exist** in the repo — a dead reference that misleads readers. Fixing
both makes the agent-facing documentation trustworthy, which compounds across
every future task.

## Current state

- `.claude/CLAUDE.md` — project instructions. Two problems:
  1. The section `## Complete Feature List` → `### Content Features` contains a
     markdown table with 27 rows (Bookmarks, Cine, Command Menu, … Users). It is
     missing ~26 feature directories that exist under `features/`.
  2. It references a non-existent `TECH_DEBT.md`. Confirm every occurrence with:
     `grep -n "TECH_DEBT" .claude/CLAUDE.md` (expected: one or more lines, e.g.
     in the "Migration Notes" section `The project recently completed a
     refactoring audit (see [TECH_DEBT.md](TECH_DEBT.md))`). Confirm the file is
     absent: `test -f TECH_DEBT.md && echo EXISTS || echo MISSING` → `MISSING`.

- The authoritative current feature directory list (from `ls features/`, 53
  entries) is below. The existing table already documents many of these
  correctly; your job is to make the table list **all** of them. For each
  directory, the one-line description below is a **draft you must verify** by
  reading that feature's entry file (`features/<name>/index.ts` or `index.tsx`,
  whichever exists — open it and read the top doc comment / main exports) and
  correcting the description if the draft is wrong:

  | Directory | Draft description (verify against index) |
  |---|---|
  | bookmarks | Save/unsave individual posts with keyboard shortcuts |
  | centered-posts | Centered/focused post reading layout |
  | cine | TMDB hover cards & movie info in the cine forum |
  | command-menu | Ctrl+K quick navigation palette |
  | content-rules | User-defined content filtering/visibility rules |
  | dashboard | Settings UI, changelog, feature toggles |
  | drafts | Auto-save drafts, templates, slash commands |
  | editor | Enhanced BBCode toolbar, image upload, code highlighting |
  | favorite-subforums | Quick access to favorite subforums |
  | favorites | Manage favorite threads |
  | gallery | Image gallery mode for threads |
  | game-news | Video-game news integration |
  | game-prices | Game price information |
  | game-wishlist | Game wishlist tracking |
  | games | Game post templates / store cards |
  | hidden-subforums | Hide subforums from listings |
  | hidden-threads | Hide threads from listings |
  | hide-header | Hide the site header |
  | icons | Custom user/subforum icons |
  | ignored-users-mobile-sync | Sync ignored users for Mobile Lite |
  | infinite-scroll | Auto-load next pages in threads |
  | itad-search | IsThereAnyDeal price search |
  | live-thread | Real-time thread updates with polling |
  | media-hover-cards | Preview YouTube/Twitch/Steam links on hover |
  | mediavida-notifications | Surface Mediavida notifications |
  | mobile-lite | App-like panel for Firefox Android (see features/mobile-lite/DESIGN.md) |
  | movie-release-calendar | Movie release calendar |
  | muted-words | Hide posts containing specific words |
  | mv-theme | Mediavida theme integration |
  | native-live-delay | Adjust the native live-refresh delay |
  | nav-menu | Enhanced navigation sidebar |
  | new-homepage | Custom homepage |
  | new-thread | Floating new-thread button |
  | pinned-posts | Pin important posts in threads |
  | post-summary | AI-powered per-post summarization |
  | postit-toggle | Toggle post-it / sticky notes |
  | release-calendar | Game release calendar |
  | saved-threads | Bookmark entire threads |
  | shortcuts | Global keyboard shortcuts |
  | sports-fixtures | Sports fixtures / results |
  | stats | Activity statistics and heatmaps |
  | streamable-expand | Expand Streamable embeds inline |
  | table-editor | Visual BBCode table creation |
  | tag-filter | Filter threads by tag |
  | templates | Reusable post templates |
  | theme-editor | Custom CSS theme editor |
  | thread-clipper | Clip/save thread excerpts |
  | thread-preview | Preview threads on hover |
  | thread-summarizer | AI summary of entire threads |
  | ultrawide | Ultrawide monitor layout support |
  | user-customizations | Per-user CSS/notes |
  | users | User profile enhancements |
  | work-mode | Hide/blur content for a SFW "work mode" |

  Note: the existing table uses descriptions and a `Location` column
  (`features/<name>/`). Match that existing format exactly.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| List feature dirs | `ls features/` | 53 directory names |
| Find dead ref | `grep -n "TECH_DEBT" .claude/CLAUDE.md` | line number(s) |
| Confirm file absent | `test -f TECH_DEBT.md && echo EXISTS \|\| echo MISSING` | `MISSING` |
| Verify a feature | `sed -n '1,30p' features/<name>/index.ts` (or `index.tsx`) | top of file |
| Typecheck (sanity) | `npm run compile` | exit 0 |

This plan touches only Markdown, so `npm run compile` is just a sanity check
that nothing else changed.

## Scope

**In scope** (the only file you should modify):
- `.claude/CLAUDE.md`

**Out of scope** (do NOT touch):
- Any file under `features/` — you only read these to verify descriptions.
- Do NOT create `TECH_DEBT.md`. The refactoring audit it described is already
  complete; the goal is to remove the dead link, not resurrect the file.
- Do NOT change any other section of CLAUDE.md (architecture, ADRs, conventions).

## Git workflow

- Branch: `advisor/004-refresh-claude-md-feature-map`
- One commit. Message style: conventional commits (repo uses them, e.g.
  `docs(claude): refresh feature list and remove dead TECH_DEBT link`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reconcile the feature table

In `.claude/CLAUDE.md`, under `### Content Features`, update the table so it has
**one row per directory** returned by `ls features/` (53 rows). Keep the
existing column shape (`Feature | Description | Location`). For directories
already present, leave good rows as-is. For each missing directory, add a row
using the verified description (read `features/<name>/index.*` and correct the
draft from "Current state" if needed). Keep rows alphabetically or grouped as
the existing table does — match what's already there.

**Verify**: every directory name from `ls features/` appears in the table:
`for d in $(ls features/); do grep -q "$d" .claude/CLAUDE.md || echo "MISSING: $d"; done`
→ prints nothing.

### Step 2: Remove the dead TECH_DEBT.md reference

For each line found by `grep -n "TECH_DEBT" .claude/CLAUDE.md`, rewrite it so it
no longer links to the missing file. Preferred: keep the sentence's meaning but
drop the link, e.g. change
`The project recently completed a refactoring audit (see [TECH_DEBT.md](TECH_DEBT.md)):`
to `The project recently completed a refactoring audit:`.

**Verify**: `grep -c "TECH_DEBT" .claude/CLAUDE.md` → `0`.

### Step 3: Sanity check

**Verify**: `npm run compile` → exit 0 (confirms you only edited Markdown and
broke nothing else).

## Done criteria

ALL must hold:

- [ ] `for d in $(ls features/); do grep -q "$d" .claude/CLAUDE.md || echo "MISSING: $d"; done` prints nothing
- [ ] `grep -c "TECH_DEBT" .claude/CLAUDE.md` returns `0`
- [ ] `test -f TECH_DEBT.md && echo EXISTS || echo MISSING` returns `MISSING` (you did NOT create it)
- [ ] `npm run compile` exits 0
- [ ] `git status` shows only `.claude/CLAUDE.md` modified
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -n "TECH_DEBT" .claude/CLAUDE.md` returns zero lines AND the table is
  already complete — the work is already done; report that and mark the plan
  REJECTED (superseded).
- A feature directory's `index.*` reveals a purpose that contradicts ALL of the
  draft descriptions in a way you can't summarize confidently — list those
  directories and ask rather than guessing.
- `ls features/` returns a count wildly different from 53 (the codebase drifted
  significantly since this plan) — re-derive the list and report the delta.

## Maintenance notes

- This table drifts whenever a feature directory is added or removed. Consider a
  follow-up (not in this plan) to generate it from `ls features/` in CI, so it
  can't go stale again.
- A reviewer should spot-check 3–4 of the newly added descriptions against their
  `features/<name>/index.*` to confirm they're accurate, not just plausible.
