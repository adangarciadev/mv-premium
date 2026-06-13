/**
 * Thread Summary Result Sheet
 *
 * Mobile bottom sheet that displays an AI-generated thread summary. Built on the
 * shared MobileSheet shell so it matches the post-summary sheet exactly.
 */

import ScrollText from 'lucide-react/dist/esm/icons/scroll-text'
import type { ThreadSummaryViewModel } from '../logic/thread-summary-view-model'
import { GROUP_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'
import { ErrorState, LoadingState, MobileSheet, SheetFooter } from './mobile-sheet'

// =============================================================================
// SUMMARY CONTENT
// =============================================================================

function SummaryContent({ vm }: { vm: ThreadSummaryViewModel }) {
	return (
		<>
			{/* Topic */}
			{vm.topic && (
				<>
					<p className={SECTION_LABEL_CLASS}>Tema</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.topic}</p>
					</div>
				</>
			)}

			{/* Key points */}
			{vm.keyPoints.length > 0 && (
				<>
					<p className={SECTION_LABEL_CLASS}>Puntos clave</p>
					<div className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
						{vm.keyPoints.map((point, index) => (
							<div key={index} className="flex items-start gap-3 px-4 py-3">
								<span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-[#f0a020]" aria-hidden="true" />
								<p className="text-[15px] leading-snug text-[#eef1f6]">{point}</p>
							</div>
						))}
					</div>
				</>
			)}

			{/* Participants */}
			{vm.participants.length > 0 && (
				<>
					<p className={SECTION_LABEL_CLASS}>Participantes</p>
					<div className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
						{vm.participants.map((participant, index) => (
							<div key={index} className="flex items-start gap-3 py-2 pl-3 pr-4">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#14171d] text-sm font-bold text-[#9aa5b4]">
									{participant.avatarUrl ? (
										<img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" />
									) : (
										participant.name.slice(0, 1).toUpperCase()
									)}
								</div>
								<div className="min-w-0 flex-1 py-1">
									<p className="truncate text-[15px] font-semibold text-[#eef1f6]">{participant.name}</p>
									<p className="mt-0.5 text-xs leading-snug text-[#9aa5b4]">{participant.contribution}</p>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{/* Status */}
			{vm.status && (
				<>
					<p className={SECTION_LABEL_CLASS}>Estado del debate</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.status}</p>
					</div>
				</>
			)}

			{/* Metadata footer */}
			<p className="pb-2 pt-4 text-center text-[11px] text-[#8b95a3]">
				{vm.postsAnalyzed} posts analizados · Pág. {vm.pageNumber}
			</p>
		</>
	)
}

// =============================================================================
// SHEET
// =============================================================================

export interface ThreadSummarySheetProps {
	isLoading: boolean
	viewModel: ThreadSummaryViewModel | null
	/** Pre-built Mediavida BBCode for the summary, or null when not copyable (loading/error). */
	bbcode: string | null
	/** "hace X min" when the summary was served from cache, else null. */
	cachedLabel: string | null
	/** Provided only when the error is a missing-key one — opens Settings. */
	onConfigureAi?: () => void
	onClose: () => void
}

export function ThreadSummarySheet({ isLoading, viewModel, bbcode, cachedLabel, onConfigureAi, onClose }: ThreadSummarySheetProps) {
	return (
		<MobileSheet
			icon={<ScrollText className="h-5 w-5 shrink-0 text-[#f0a020]" aria-hidden="true" />}
			title={viewModel?.title || 'Resumen del hilo'}
			ariaLabel="Resumen del hilo"
			onClose={onClose}
			footer={isLoading ? undefined : <SheetFooter bbcode={bbcode} onClose={onClose} />}
		>
			{isLoading && <LoadingState subtitle="Analizando los posts de la página" />}
			{!isLoading && viewModel?.hasError && (
				<ErrorState message={viewModel.errorMessage} onConfigure={onConfigureAi} />
			)}
			{!isLoading && viewModel && !viewModel.hasError && (
				<>
					{cachedLabel && (
						<p className="pb-1 pt-3 text-center text-[11px] text-[#8b95a3]">Resumen guardado · {cachedLabel}</p>
					)}
					<SummaryContent vm={viewModel} />
				</>
			)}
		</MobileSheet>
	)
}
