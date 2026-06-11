# Plan 003: Clean up the Mobile Lite image crop dialog lifecycle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 923045f..HEAD -- features/mobile-lite/logic/editor-lite.ts features/mobile-lite/logic/editor-lite.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-close-mobile-lite-lifecycle-leaks.md`
- **Category**: tests
- **Planned at**: commit `923045f`, 2026-06-11

## Why this matters

The Mobile Lite editor upload control opens a custom image crop dialog before
uploading supported images. That dialog locks body scroll and owns an object URL.
Cleanup currently happens only through the dialog's local `finish()` callback.
If Mobile Lite is torn down, a second dialog is opened, or async crop work races
with teardown, the page can remain scroll-locked or leak object URLs. Tests do
not currently exercise the crop dialog lifecycle, so this is fragile to future
editor changes.

## Current state

- `features/mobile-lite/logic/editor-lite.ts` owns paste helpers, upload
  controls, image upload, and the crop dialog.
- `features/mobile-lite/logic/editor-lite.test.ts` has broad editor/upload tests
  but no direct crop-dialog lifecycle coverage.

Relevant excerpts:

```ts
// features/mobile-lite/logic/editor-lite.ts:446
export async function openMobileLiteImageCropDialog(file: File): Promise<CropDialogResult> {
	if (!isMobileLiteCropSupported(file)) return 'original'

	const { image, objectUrl } = await loadImageFromFile(file)
	const existingDialog = document.querySelector(`[${IMAGE_CROP_DIALOG_ATTR}="true"]`)
	existingDialog?.remove()

	return new Promise(resolve => {
		// creates dialog and appends it to document.body
		const previousBodyOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		// ...
		const finish = (result: CropDialogResult) => {
			document.body.style.overflow = previousBodyOverflow
			URL.revokeObjectURL(objectUrl)
			dialog.remove()
			resolve(result)
		}
	})
}

// features/mobile-lite/logic/editor-lite.ts:1293
export function teardownMobileLiteEditorEnhancements(): void {
	// clears observer/listeners/upload controls, but does not close an active crop dialog
}
```

Existing test signals:

```ts
// features/mobile-lite/logic/editor-lite.test.ts:268
const result = await uploadMobileLiteImage(new File(['image'], 'image.png', { type: 'image/png' }), textarea)

// features/mobile-lite/logic/editor-lite.test.ts:277
const result = await uploadMobileLiteImage(new File(['text'], 'notes.txt', { type: 'text/plain' }), textarea)
```

Repo conventions:

- Keep content-script DOM changes idempotent and reversible in teardown.
- Use `logger`, not `console.*`.
- Co-locate Vitest tests with source files.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install` | exit 0 |
| Typecheck | `npm run compile` | exit 0, no TypeScript errors |
| Targeted tests | `npm run test:run -- features/mobile-lite/logic/editor-lite.test.ts` | exit 0 |
| Mobile Lite tests | `npm run test:run -- features/mobile-lite` | exit 0 |
| Lint | `npm run lint` | exit 0; existing warnings may remain but no errors |

## Scope

**In scope**:
- `features/mobile-lite/logic/editor-lite.ts`
- `features/mobile-lite/logic/editor-lite.test.ts`

**Out of scope**:
- Do not change upload provider selection or background upload messaging.
- Do not change crop UI design, labels, mode names, or button layout except
  where required for stable cleanup hooks.
- Do not extract `editor-lite.ts` into multiple files in this plan.
- Do not change paste/media auto-formatting behavior.

## Git workflow

- Branch: `advisor/003-mobile-lite-crop-dialog-cleanup`
- Commit message style: Conventional Commits, for example
  `fix(mobile-lite): clean up image crop dialog on teardown`.
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Introduce an idempotent active crop-dialog cleanup path

In `editor-lite.ts`, add module state for the active crop dialog. The state
should be able to:

- restore the previous `document.body.style.overflow`;
- revoke the active object URL exactly once;
- remove the dialog element;
- resolve the pending crop promise with `null` when closed externally;
- ignore repeated cleanup calls after finishing.

A simple shape is acceptable, for example an `activeCropDialog` object with a
`finish(result)` function. Keep the type local to `editor-lite.ts`.

Replace the current `existingDialog?.remove()` behavior with this cleanup path,
so opening a second dialog closes the first cleanly instead of just removing its
DOM node.

**Verify**: `npm run compile` -> exit 0.

### Step 2: Use the cleanup path from teardown

In `teardownMobileLiteEditorEnhancements()`, call the new cleanup path before or
after removing upload controls. The active crop promise should resolve with
`null`, matching the existing cancel behavior.

Keep teardown idempotent. Calling it without an open crop dialog must not throw.

**Verify**: `npm run compile` -> exit 0.

### Step 3: Make async crop completion race-safe

The crop button calls `createCroppedImageFile(...).then(croppedFile => finish(croppedFile))`.
Make sure this cannot re-run cleanup or resolve the promise twice if teardown
closed the dialog while crop work was pending. Use the same idempotent `finish`
function from step 1.

Do not add cancellation primitives unless needed; idempotent cleanup is enough.

**Verify**: `npm run compile` -> exit 0.

### Step 4: Add crop-dialog lifecycle tests

In `editor-lite.test.ts`, add tests for `openMobileLiteImageCropDialog()`.
Mock the browser pieces jsdom does not implement:

- `URL.createObjectURL` returns a placeholder URL.
- `URL.revokeObjectURL` is a spy.
- `Image` triggers `onload` after `src` is set, with non-zero
  `naturalWidth`/`naturalHeight`.
- If needed, mock `HTMLCanvasElement.prototype.getContext` and `toBlob` only in
  tests that click "Recortar y subir".

Cover at least:

- Cancel/close restores `document.body.style.overflow`, removes the dialog, and
  revokes the object URL.
- `teardownMobileLiteEditorEnhancements()` closes an open dialog, resolves the
  pending promise with `null`, restores overflow, removes DOM, and revokes the
  object URL.
- Opening a second crop dialog cleans up the first one through the same path.

Do not put real image data or API keys in tests.

**Verify**: `npm run test:run -- features/mobile-lite/logic/editor-lite.test.ts` -> exit 0.

### Step 5: Run Mobile Lite verification

**Verify**:

- `npm run test:run -- features/mobile-lite/logic/editor-lite.test.ts` -> exit 0
- `npm run test:run -- features/mobile-lite` -> exit 0
- `npm run compile` -> exit 0

## Test plan

- Extend `editor-lite.test.ts` with direct crop-dialog lifecycle tests.
- Keep existing upload tests passing.
- Prefer small DOM queries against `[data-mvp-mobile-lite-image-crop-dialog="true"]`
  and button text rather than snapshot tests.

## Done criteria

- [ ] Active crop dialogs are closed via an idempotent cleanup path.
- [ ] Opening a second crop dialog cleans up the first dialog fully.
- [ ] `teardownMobileLiteEditorEnhancements()` closes any active crop dialog.
- [ ] Body overflow is restored after cancel, replacement, and teardown.
- [ ] Active object URLs are revoked exactly once per opened dialog.
- [ ] New co-located tests cover cancel, teardown, and second-dialog cleanup.
- [ ] `npm run compile` exits 0.
- [ ] `npm run test:run -- features/mobile-lite` exits 0.
- [ ] `npm run lint` exits 0 with no new errors.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- jsdom cannot support the required crop-dialog tests without broad test
  infrastructure changes.
- Cleaning up the dialog requires changing upload provider behavior or
  background messaging.
- The crop dialog has been moved out of `editor-lite.ts` since this plan was
  written and the current excerpts no longer match.
- The fix requires changing user-visible crop UI design beyond stable cleanup
  attributes.

## Maintenance notes

The crop dialog is a content-script modal that affects global page state. Future
dialogs should follow the same pattern: a module-level, idempotent cleanup path
that teardown can call, plus tests that verify body scroll and object URL cleanup.
