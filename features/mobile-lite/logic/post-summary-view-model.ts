/**
 * Post Summary View Model
 *
 * Pure mapping between the desktop AI engine's post-summary result
 * (`summarizePost` → `{ summary, tone }`) and what the mobile result sheet
 * renders. Kept pure (no DOM) so it is trivially testable.
 */

export interface PostSummaryViewModel {
	summary: string
	tone: string
	hasError: boolean
	errorMessage: string
}

/**
 * Maps a `summarizePost` result (or a thrown-error message) to the view model.
 * `summarizePost` returns `{ summary: 'Error…', tone: 'Error' }` on a parse
 * failure and throws (caught upstream → `error`) when no key is configured;
 * both collapse to an error view model here.
 */
export function toPostSummaryViewModel(
	result: { summary: string; tone: string } | null,
	error?: string
): PostSummaryViewModel {
	if (error) {
		return { summary: '', tone: '', hasError: true, errorMessage: error }
	}
	if (result && result.tone === 'Error') {
		return { summary: '', tone: '', hasError: true, errorMessage: result.summary }
	}
	return {
		summary: result?.summary ?? '',
		tone: result?.tone ?? '',
		hasError: false,
		errorMessage: '',
	}
}

/**
 * Builds Mediavida-ready BBCode for a (successful) post summary. Call only when
 * `!vm.hasError` and the summary is a real AI result (a `tone` is present).
 */
export function toPostSummaryBBCode(vm: PostSummaryViewModel): string {
	return [
		'[quote][b]🤖 Resumen IA del post[/b]',
		'',
		vm.summary,
		'',
		`[i]Tono: ${vm.tone}[/i][/quote]`,
	].join('\n')
}

/** Whether the failure was a missing-key one (vs. a transient/parse error). */
export function postSummaryNeedsAiConfig(vm: PostSummaryViewModel): boolean {
	return vm.hasError && vm.errorMessage.trim().toLowerCase().startsWith('ia no configurada')
}
