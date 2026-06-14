/**
 * Thread AI Result Sheet
 *
 * Mobile bottom sheet for the thread-companion AI actions: page summaries
 * (single & multi-page) and user analysis (single & multi-page), plus the
 * in-sheet page-range picker. Built on the shared MobileSheet shell.
 */

import { type ReactNode } from 'react'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import type { ThreadSummaryViewModel } from '../logic/thread-summary-view-model'
import type { UserAnalysisViewModel } from '../logic/user-analysis-view-model'
import { GROUP_CLASS, SECONDARY_BUTTON_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'
import { ErrorState, LoadingState, MobileSheet, SheetFooter } from './mobile-sheet'
import { RangePicker, type RangePickerProps } from './range-picker'

// =============================================================================
// SUMMARY CONTENT (single & multi-page)
// =============================================================================

function SummaryContent({ vm }: { vm: ThreadSummaryViewModel }) {
	return (
		<>
			{vm.topic && (
				<>
					<p className={SECTION_LABEL_CLASS}>Tema</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.topic}</p>
					</div>
				</>
			)}

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

			{vm.status && (
				<>
					<p className={SECTION_LABEL_CLASS}>Estado del debate</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.status}</p>
					</div>
				</>
			)}
		</>
	)
}

// =============================================================================
// USER ANALYSIS CONTENT (single & multi-page)
// =============================================================================

function AnalysisList({ label, items }: { label: string; items: string[] }) {
	if (items.length === 0) return null
	return (
		<>
			<p className={SECTION_LABEL_CLASS}>{label}</p>
			<div className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
				{items.map((item, index) => (
					<div key={index} className="flex items-start gap-3 px-4 py-3">
						<span className="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-[#f0a020]" aria-hidden="true" />
						<p className="text-[15px] leading-snug text-[#eef1f6]">{item}</p>
					</div>
				))}
			</div>
		</>
	)
}

function UserAnalysisContent({ vm }: { vm: UserAnalysisViewModel }) {
	return (
		<>
			<div className={`mt-3 ${GROUP_CLASS}`}>
				<div className="flex items-center gap-3 p-4">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#14171d] text-base font-bold text-[#9aa5b4]">
						{vm.avatarUrl ? (
							<img src={vm.avatarUrl} alt="" className="h-full w-full object-cover" />
						) : (
							vm.username.slice(0, 1).toUpperCase()
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-[15px] font-bold text-[#eef1f6]">{vm.username}</p>
						{vm.tagline && <p className="mt-0.5 text-xs italic leading-snug text-[#9aa5b4]">“{vm.tagline}”</p>}
					</div>
				</div>
			</div>

			{vm.profile && (
				<>
					<p className={SECTION_LABEL_CLASS}>Perfil</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.profile}</p>
					</div>
				</>
			)}

			<AnalysisList label="Temas recurrentes" items={vm.topics} />
			<AnalysisList label="Interacciones" items={vm.interactions} />

			{vm.style && (
				<>
					<p className={SECTION_LABEL_CLASS}>Estilo</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] leading-snug text-[#eef1f6]">{vm.style}</p>
					</div>
				</>
			)}

			<AnalysisList label="Momentos destacados" items={vm.highlights} />

			{vm.verdict && (
				<>
					<p className={SECTION_LABEL_CLASS}>Veredicto</p>
					<div className={GROUP_CLASS}>
						<p className="px-4 py-3 text-[15px] italic leading-snug text-[#eef1f6]">“{vm.verdict}”</p>
					</div>
				</>
			)}
		</>
	)
}

// =============================================================================
// EXPANDER ("Resumir / Analizar varias páginas →")
// =============================================================================

function MultiPageExpander({ label, onExpand }: { label: string; onExpand: () => void }) {
	return (
		<button
			type="button"
			className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#3a4254] py-2.5 text-sm font-semibold text-[#f0a020] transition-colors active:bg-[#242a36]"
			onClick={onExpand}
		>
			{label}
			<ChevronRight className="h-4 w-4" aria-hidden="true" />
		</button>
	)
}

// =============================================================================
// SHEET
// =============================================================================

export interface ThreadSummarySheetProps {
	icon: ReactNode
	title: string
	ariaLabel: string
	loadingSubtitle: string
	isLoading: boolean
	/** Result models — exactly one is set on success, depending on the mode. */
	summaryVm: ThreadSummaryViewModel | null
	analysisVm: UserAnalysisViewModel | null
	/** "hace X min" when served from cache, else null. */
	cachedLabel: string | null
	/** Pre-built BBCode, or null when not copyable (loading/error). */
	bbcode: string | null
	/** Provided only when the error is a missing-key one — opens Settings. */
	onConfigureAi?: () => void
	/** Shown under a successful result when multi-page is available (null hides it). */
	expandLabel: string | null
	onExpand: () => void
	/** When set, the sheet shows the page-range picker instead of the result. */
	rangePicker: RangePickerProps | null
	onClose: () => void
}

export function ThreadSummarySheet({
	icon,
	title,
	ariaLabel,
	loadingSubtitle,
	isLoading,
	summaryVm,
	analysisVm,
	cachedLabel,
	bbcode,
	onConfigureAi,
	expandLabel,
	onExpand,
	rangePicker,
	onClose,
}: ThreadSummarySheetProps) {
	const errorVm = summaryVm?.hasError ? summaryVm : analysisVm?.hasError ? analysisVm : null
	const hasResult = (summaryVm && !summaryVm.hasError) || (analysisVm && !analysisVm.hasError)

	const footer = rangePicker ? (
		<div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
			<button type="button" className={`w-full ${SECONDARY_BUTTON_CLASS}`} onClick={onClose}>
				Cerrar
			</button>
		</div>
	) : isLoading ? undefined : (
		<SheetFooter bbcode={bbcode} onClose={onClose} />
	)

	return (
		<MobileSheet icon={icon} title={title} ariaLabel={ariaLabel} onClose={onClose} footer={footer}>
			{rangePicker ? (
				<RangePicker {...rangePicker} />
			) : (
				<>
					{isLoading && <LoadingState subtitle={loadingSubtitle} />}
					{!isLoading && errorVm && <ErrorState message={errorVm.errorMessage} onConfigure={onConfigureAi} />}
					{!isLoading && hasResult && (
						<>
							{cachedLabel && (
								<p className="pb-1 pt-3 text-center text-[11px] text-[#8b95a3]">Resumen guardado · {cachedLabel}</p>
							)}
							{summaryVm && !summaryVm.hasError && <SummaryContent vm={summaryVm} />}
							{analysisVm && !analysisVm.hasError && <UserAnalysisContent vm={analysisVm} />}
							{(summaryVm?.metaLabel || analysisVm?.metaLabel) && (
								<p className="pb-2 pt-4 text-center text-[11px] text-[#8b95a3]">
									{summaryVm?.metaLabel || analysisVm?.metaLabel}
								</p>
							)}
							{expandLabel && <MultiPageExpander label={expandLabel} onExpand={onExpand} />}
						</>
					)}
				</>
			)}
		</MobileSheet>
	)
}
