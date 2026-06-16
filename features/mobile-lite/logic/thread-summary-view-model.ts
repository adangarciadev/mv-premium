/**
 * Thread Summary View Model
 *
 * Pure mapping layer between the AI engine's ThreadSummary and
 * what the mobile result sheet needs to render. Keeping this pure
 * (no DOM, no imports from browser APIs) makes it trivially testable.
 */

import type { ThreadSummary } from '@/features/thread-summarizer/logic/summarize'
import type { MultiPageSummary } from '@/features/thread-summarizer/logic/summarize-multi-page'
import { buildMultiSummaryBBCode, buildSingleSummaryBBCode } from '@/features/thread-summarizer/logic/build-copy-bbcode'

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadSummaryParticipantVM {
	name: string
	contribution: string
	avatarUrl: string | undefined
}

export interface ThreadSummaryViewModel {
	/** Thread title */
	title: string
	/** Main topic sentence */
	topic: string
	/** Bullet-point key observations (may be empty list on error) */
	keyPoints: string[]
	/** Notable participants (may be empty list on error) */
	participants: ThreadSummaryParticipantVM[]
	/** One-line debate status */
	status: string
	/** Whether the summary failed */
	hasError: boolean
	/** Human-readable error (empty string when !hasError) */
	errorMessage: string
	/** Number of posts that were analyzed */
	postsAnalyzed: number
	/** Page number this summary covers */
	pageNumber: number
	/** Pre-formatted metadata line for the footer (single vs multi-page differ). */
	metaLabel: string
}

// =============================================================================
// MAPPER
// =============================================================================

/**
 * Maps a `ThreadSummary` from the AI engine to the mobile view model.
 * Never throws — all edge cases produce a valid (possibly error) view model.
 */
export function toThreadSummaryViewModel(summary: ThreadSummary): ThreadSummaryViewModel {
	const hasError = Boolean(summary.error)

	return {
		title: summary.title ?? '',
		topic: hasError ? '' : (summary.topic ?? ''),
		keyPoints: hasError ? [] : (Array.isArray(summary.keyPoints) ? summary.keyPoints : []),
		participants: hasError
			? []
			: (Array.isArray(summary.participants)
					? summary.participants.map(p => ({
							name: p.name ?? '',
							contribution: p.contribution ?? '',
							avatarUrl: p.avatarUrl,
					  }))
					: []),
		status: hasError ? '' : (summary.status ?? ''),
		hasError,
		errorMessage: summary.error ?? '',
		postsAnalyzed: summary.postsAnalyzed ?? 0,
		pageNumber: summary.pageNumber ?? 1,
		metaLabel: hasError ? '' : `${summary.postsAnalyzed ?? 0} posts analizados · Pág. ${summary.pageNumber ?? 1}`,
	}
}

/**
 * Maps a multi-page `MultiPageSummary` to the same view model shape (it shares
 * topic/keyPoints/participants/status) with a multi-page metadata line.
 */
export function toMultiSummaryViewModel(summary: MultiPageSummary): ThreadSummaryViewModel {
	const hasError = Boolean(summary.error)

	return {
		title: summary.title ?? '',
		topic: hasError ? '' : (summary.topic ?? ''),
		keyPoints: hasError ? [] : (Array.isArray(summary.keyPoints) ? summary.keyPoints : []),
		participants: hasError
			? []
			: (Array.isArray(summary.participants)
					? summary.participants.map(p => ({
							name: p.name ?? '',
							contribution: p.contribution ?? '',
							avatarUrl: p.avatarUrl,
					  }))
					: []),
		status: hasError ? '' : (summary.status ?? ''),
		hasError,
		errorMessage: summary.error ?? '',
		postsAnalyzed: summary.totalPostsAnalyzed ?? 0,
		pageNumber: 1,
		metaLabel: hasError
			? ''
			: `${summary.totalPostsAnalyzed ?? 0} posts · ${summary.pagesAnalyzed ?? 0} páginas · Págs. ${summary.pageRange}`,
	}
}

/** BBCode for a multi-page summary (uses the desktop multi-page builder). */
export function toMultiSummaryBBCode(summary: MultiPageSummary): string {
	return buildMultiSummaryBBCode({
		topic: summary.topic,
		keyPoints: summary.keyPoints,
		participants: summary.participants.map(p => ({ name: p.name, contribution: p.contribution })),
		status: summary.status,
		pageRange: summary.pageRange,
		totalPostsAnalyzed: summary.totalPostsAnalyzed,
		pagesAnalyzed: summary.pagesAnalyzed,
		totalUniqueAuthors: summary.totalUniqueAuthors,
	})
}

/**
 * Builds the Mediavida-ready BBCode for a (successful) summary view model,
 * reusing the desktop summarizer's single source of truth so the copied text
 * matches what the desktop "Copiar" produces ([center]/[bar]/[list]/[quote]).
 * Call only when `!vm.hasError`.
 */
export function toThreadSummaryBBCode(vm: ThreadSummaryViewModel): string {
	return buildSingleSummaryBBCode({
		topic: vm.topic,
		keyPoints: vm.keyPoints,
		participants: vm.participants.map(p => ({ name: p.name, contribution: p.contribution })),
		status: vm.status,
		pageNumber: vm.pageNumber,
	})
}

/**
 * Whether the summary failed because no AI key is configured (vs. a transient
 * error like a 429). The engine returns the literal "IA no configurada…" for
 * the missing-key case; matched leniently so a non-match just hides the
 * "Configurar IA" shortcut rather than breaking.
 */
export function summaryNeedsAiConfig(vm: ThreadSummaryViewModel): boolean {
	return vm.hasError && vm.errorMessage.trim().toLowerCase().startsWith('ia no configurada')
}
