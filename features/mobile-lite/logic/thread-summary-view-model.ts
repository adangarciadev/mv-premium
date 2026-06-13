/**
 * Thread Summary View Model
 *
 * Pure mapping layer between the AI engine's ThreadSummary and
 * what the mobile result sheet needs to render. Keeping this pure
 * (no DOM, no imports from browser APIs) makes it trivially testable.
 */

import type { ThreadSummary } from '@/features/thread-summarizer/logic/summarize'
import { buildSingleSummaryBBCode } from '@/features/thread-summarizer/logic/build-copy-bbcode'

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
	}
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
