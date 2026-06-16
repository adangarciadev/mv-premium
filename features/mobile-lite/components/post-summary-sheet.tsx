/**
 * Post Summary Result Sheet
 *
 * Mobile bottom sheet that displays an AI-generated single-post summary. Built
 * on the shared MobileSheet shell so it matches the thread-summary sheet exactly.
 */

import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import type { PostSummaryViewModel } from '../logic/post-summary-view-model'
import { GROUP_CLASS } from './panel-tokens'
import { ErrorState, LoadingState, MobileSheet, SheetFooter } from './mobile-sheet'

// =============================================================================
// SUMMARY CONTENT
// =============================================================================

function PostSummaryContent({ vm }: { vm: PostSummaryViewModel }) {
	return (
		<>
			{vm.tone && (
				<div className="flex justify-center pt-3">
					<span className="inline-flex items-center rounded-full bg-[#f0a020]/[0.16] px-3 py-1 text-xs font-bold text-[#f0a020]">
						{vm.tone}
					</span>
				</div>
			)}
			<div className={`mt-3 ${GROUP_CLASS}`}>
				<p className="px-4 py-3 text-[15px] leading-relaxed text-[#eef1f6]">{vm.summary}</p>
			</div>
		</>
	)
}

// =============================================================================
// SHEET
// =============================================================================

export interface PostSummarySheetProps {
	isLoading: boolean
	viewModel: PostSummaryViewModel | null
	/** Pre-built Mediavida BBCode, or null when not copyable (loading/error/short note). */
	bbcode: string | null
	/** "hace X min" when the summary was served from cache, else null. */
	cachedLabel: string | null
	/** Provided only when the error is a missing-key one — opens Settings. */
	onConfigureAi?: () => void
	onClose: () => void
}

export function PostSummarySheet({ isLoading, viewModel, bbcode, cachedLabel, onConfigureAi, onClose }: PostSummarySheetProps) {
	return (
		<MobileSheet
			icon={<Sparkles className="h-5 w-5 shrink-0 text-[#f0a020]" aria-hidden="true" />}
			title="Resumen del post"
			ariaLabel="Resumen del post"
			onClose={onClose}
			footer={isLoading ? undefined : <SheetFooter bbcode={bbcode} onClose={onClose} />}
		>
			{isLoading && <LoadingState subtitle="Analizando el post" />}
			{!isLoading && viewModel?.hasError && (
				<ErrorState message={viewModel.errorMessage} onConfigure={onConfigureAi} />
			)}
			{!isLoading && viewModel && !viewModel.hasError && (
				<>
					{cachedLabel && (
						<p className="pb-1 pt-3 text-center text-[11px] text-[#8b95a3]">Resumen guardado · {cachedLabel}</p>
					)}
					<PostSummaryContent vm={viewModel} />
				</>
			)}
		</MobileSheet>
	)
}
