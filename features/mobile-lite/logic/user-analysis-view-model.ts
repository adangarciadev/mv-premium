/**
 * User Analysis View Model
 *
 * Pure mapping between the desktop AI engine's `UserAnalysis` and what the
 * mobile result sheet renders. Kept pure (no DOM) so it is trivially testable.
 */

import type { UserAnalysis } from '@/features/thread-summarizer/logic/analyze-user'
import { buildUserAnalysisBBCode } from '@/features/thread-summarizer/logic/build-copy-bbcode'

export interface UserAnalysisViewModel {
	username: string
	tagline: string
	profile: string
	topics: string[]
	interactions: string[]
	style: string
	highlights: string[]
	verdict: string
	avatarUrl: string | undefined
	hasError: boolean
	errorMessage: string
	/** Pre-formatted metadata line for the footer. */
	metaLabel: string
}

function safeList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function toUserAnalysisViewModel(analysis: UserAnalysis): UserAnalysisViewModel {
	const hasError = Boolean(analysis.error)
	const metaLabel = hasError
		? ''
		: analysis.pageRange
			? `${analysis.postsAnalyzed ?? 0} posts · ${analysis.pagesAnalyzed ?? 0} páginas · Págs. ${analysis.pageRange}`
			: `${analysis.postsAnalyzed ?? 0} posts analizados`

	return {
		username: analysis.username ?? '',
		tagline: hasError ? '' : (analysis.tagline ?? ''),
		profile: hasError ? '' : (analysis.profile ?? ''),
		topics: hasError ? [] : safeList(analysis.topics),
		interactions: hasError ? [] : safeList(analysis.interactions),
		style: hasError ? '' : (analysis.style ?? ''),
		highlights: hasError ? [] : safeList(analysis.highlights),
		verdict: hasError ? '' : (analysis.verdict ?? ''),
		avatarUrl: analysis.avatarUrl,
		hasError,
		errorMessage: analysis.error ?? '',
		metaLabel,
	}
}

/** BBCode for a user analysis (uses the desktop builder; pick the variant). */
export function toUserAnalysisBBCode(analysis: UserAnalysis, variant: 'single' | 'multi'): string {
	return buildUserAnalysisBBCode(analysis, variant)
}

/** Whether the failure was a missing-key one (vs. a transient/parse error). */
export function userAnalysisNeedsAiConfig(vm: UserAnalysisViewModel): boolean {
	return vm.hasError && vm.errorMessage.trim().toLowerCase().startsWith('ia no configurada')
}
