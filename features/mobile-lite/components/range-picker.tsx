/**
 * Page-range picker for multi-page AI actions (summary / user analysis). Two
 * editable page fields (type or use −/+), quick presets, and a generate button
 * — or a progress line while the pages are fetched and summarised.
 */

import Loader from 'lucide-react/dist/esm/icons/loader'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Plus from 'lucide-react/dist/esm/icons/plus'
import { PRIMARY_BUTTON_CLASS, SECTION_LABEL_CLASS } from './panel-tokens'

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

function NumberField({
	label,
	value,
	min,
	max,
	disabled,
	onChange,
}: {
	label: string
	value: number
	min: number
	max: number
	disabled: boolean
	onChange: (value: number) => void
}) {
	return (
		<div className="flex flex-col items-center gap-1">
			<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">{label}</span>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					aria-label={`Bajar ${label}`}
					className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2e3543] text-[#eef1f6] transition-colors active:bg-[#3a4254] disabled:opacity-40"
					disabled={disabled || value <= min}
					onClick={() => onChange(clamp(value - 1, min, max))}
				>
					<Minus className="h-4 w-4" aria-hidden="true" />
				</button>
				<input
					type="text"
					inputMode="numeric"
					pattern="[0-9]*"
					aria-label={label}
					value={String(value)}
					disabled={disabled}
					onFocus={event => event.currentTarget.select()}
					onChange={event => {
						const digits = event.target.value.replace(/\D/g, '')
						if (digits === '') return
						onChange(clamp(Number.parseInt(digits, 10), min, max))
					}}
					className="h-11 w-14 rounded-xl bg-[#14171d] text-center text-xl font-bold tabular-nums text-[#eef1f6] outline-none focus:ring-1 focus:ring-[#f0a020] disabled:opacity-50"
				/>
				<button
					type="button"
					aria-label={`Subir ${label}`}
					className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2e3543] text-[#eef1f6] transition-colors active:bg-[#3a4254] disabled:opacity-40"
					disabled={disabled || value >= max}
					onClick={() => onChange(clamp(value + 1, min, max))}
				>
					<Plus className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	)
}

export interface RangePickerProps {
	title: string
	ctaLabel: string
	fromPage: number
	toPage: number
	totalPages: number
	currentPage: number
	maxPages: number
	isGenerating: boolean
	progressLabel: string | null
	onChange: (fromPage: number, toPage: number) => void
	onGenerate: () => void
}

export function RangePicker({
	title,
	ctaLabel,
	fromPage,
	toPage,
	totalPages,
	currentPage,
	maxPages,
	isGenerating,
	progressLabel,
	onChange,
	onGenerate,
}: RangePickerProps) {
	const pageCount = Math.max(1, toPage - fromPage + 1)
	const isValid = fromPage >= 1 && toPage >= fromPage && toPage <= totalPages && pageCount <= maxPages

	// Quick presets — current page (the common case) + "last N" for long histories.
	const presets: { label: string; from: number; to: number }[] = [
		{ label: 'Esta página', from: currentPage, to: currentPage },
	]
	if (totalPages <= maxPages) presets.push({ label: 'Todas', from: 1, to: totalPages })
	for (const n of [10, 5]) {
		if (n < totalPages && n <= maxPages) presets.push({ label: `Últimas ${n}`, from: totalPages - n + 1, to: totalPages })
	}

	return (
		<div className="pb-2">
			<p className={SECTION_LABEL_CLASS}>{title}</p>

			{presets.length > 0 && (
				<div className="mb-3 flex flex-wrap justify-center gap-1.5">
					{presets.map(preset => (
						<button
							key={preset.label}
							type="button"
							className="rounded-full bg-[#2e3543] px-3 py-1.5 text-xs font-semibold text-[#eef1f6] transition-colors active:bg-[#3a4254] disabled:opacity-50"
							disabled={isGenerating}
							onClick={() => onChange(preset.from, preset.to)}
						>
							{preset.label}
						</button>
					))}
				</div>
			)}

			<div className="flex items-center justify-center gap-5">
				<NumberField label="Desde" value={fromPage} min={1} max={totalPages} disabled={isGenerating} onChange={value => onChange(value, toPage)} />
				<span className="mt-5 text-[#707b8e]" aria-hidden="true">→</span>
				<NumberField label="Hasta" value={toPage} min={1} max={totalPages} disabled={isGenerating} onChange={value => onChange(fromPage, value)} />
			</div>
			<p className="mt-3 text-center text-xs text-[#8b95a3]">
				{pageCount} {pageCount === 1 ? 'página' : 'páginas'} · {totalPages} en total{maxPages < totalPages ? ` · máx. ${maxPages}` : ''}
			</p>

			{isGenerating ? (
				<div role="status" className="mt-4 flex flex-col items-center gap-2 py-2 text-center">
					<Loader className="h-6 w-6 animate-spin text-[#f0a020]" aria-hidden="true" />
					<p className="text-xs text-[#8b95a3]">{progressLabel ?? 'Generando…'}</p>
				</div>
			) : (
				<button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-4 w-full`} disabled={!isValid} onClick={onGenerate}>
					{ctaLabel}
				</button>
			)}
		</div>
	)
}
