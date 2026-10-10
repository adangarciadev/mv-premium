# Draft and backup persistence

Draft reads and mutations use typed messages handled by
`entrypoints/background/storage-handlers.ts`. The repository is background-only;
content scripts do not import its runtime validation or write snapshots directly.
Draft operations, backup restores and rhythm writes share `enqueueStorageWrite`.

Backups are validated before constructing a write plan. Missing sections remain
untouched. Existing schema-version-1 backups remain supported, including drafts
with missing legacy type, content or timestamps. Invalid supplied sections fail
with their field path; media reviews retain the existing valid-entry salvage policy.
Football-data credentials follow the explicit personal-key export/import choice.

Before applying a restore, `mvp-backup-recovery` records the previous raw values
of affected keys. Failed writes restore those values and remove newly created keys.
A failed rollback retains the journal for retry. An interrupted restore is recovered
before the next queued operation, including after the background restarts. The
journal is excluded from backups and removed when the restore or recovery succeeds.
If the storage quota prevents creating the journal, the restore changes no user data.

## Automated checks

```sh
npm run typecheck
npm run lint
npx vitest run features/drafts entrypoints/options/lib/backup-service.test.ts entrypoints/background/stats-handlers.test.ts features/stats/logic/time-tracker.test.ts
npm run build:chrome
npm run build:firefox
```

The persistence tests import the public APIs and actual background handlers, use
compressed storage, and simulate Chrome's JSON message transport. They cover
concurrent saves, folder mutations, optional-field clearing, reactive updates,
invalid sections, credential choices, rollback and interrupted-restore recovery.
These commands cover the affected modules; the complete suite is a separate check.

## Manual browser checks (pending)

Use a test profile in Chrome and Firefox with the newly built extension loaded.

1. Open the draft manager in two tabs. Save distinct drafts simultaneously and
   confirm both survive a reload. Move and delete folders while editing a draft.
2. Edit a template and clear its trigger, subforum and category. Reload and check
   that the old values do not return.
3. Export a backup containing drafts, templates, themes, settings and stats.
   Restore it and verify the content and regenerated theme CSS.
4. Export with fake personal API keys, with inclusion both disabled and enabled.
   Check football-data follows the selected policy. Import without key inclusion
   and confirm locally configured keys remain intact.
5. Change a backup's drafts section to a string and try importing it. Confirm the
   error identifies the section and previously stored content remains unchanged.

Firefox Android smoke testing is still required. Mobile editor autosave is outside
this change and remains tracked by plan 006.
