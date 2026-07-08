import type { FragranticaAccord, FragranticaFragrance, FragranticaPyramid, FragranticaWear } from '@/services/api/fragrantica'
import { capitalizeNoteLabel } from './format'

const WEAR_COLORS: Record<string, string> = {
	winter: '#88b7d9',
	spring: '#8ecf9d',
	summer: '#e0c45f',
	autumn: '#c78a55',
	day: '#d8b86d',
	night: '#9c8fd0',
}

interface FragranticaDetailsProps {
	fragrance: FragranticaFragrance
}

export function FragranticaDetails({ fragrance }: FragranticaDetailsProps) {
	const hasPyramid = Boolean(fragrance.pyramid.top.length || fragrance.pyramid.middle.length || fragrance.pyramid.base.length)

	return (
		<div className="grid gap-[18px]">
			{fragrance.accords.length > 0 && <Accords accords={fragrance.accords} />}
			{hasPyramid ? (
				<Pyramid pyramid={fragrance.pyramid} />
			) : fragrance.notes.length > 0 ? (
				<FlatNotes notes={fragrance.notes} />
			) : null}
			{fragrance.wear.length > 0 && <Wear wear={fragrance.wear} />}
		</div>
	)
}

function SectionTitle({ children }: { children: string }) {
	return (
		<h4 className="mb-2.5 text-[13px] font-extrabold uppercase leading-none tracking-[.08em] text-[#d4b276]">{children}</h4>
	)
}

function Accords({ accords }: { accords: FragranticaAccord[] }) {
	return (
		<section>
			<SectionTitle>Acordes principales</SectionTitle>
			<div className="flex flex-col gap-[7px]">
				{accords.map((accord, index) => (
					<div key={`${accord.label}-${index}`} className="relative h-6 overflow-hidden rounded-[3px] bg-[rgba(255,255,255,0.08)]">
						<span
							className="absolute inset-y-0 left-0 min-w-[34%] rounded-sm opacity-95"
							style={{
								width: `${Math.max(34, Math.min(100, accord.score || 50))}%`,
								backgroundColor: accord.color || '#8bc6a9',
							}}
						/>
						<span className="absolute inset-0 rounded-sm bg-[linear-gradient(90deg,rgba(8,7,6,.62),rgba(8,7,6,.3)_60%,rgba(8,7,6,.12)_85%)]" />
						<span className="relative z-[1] block overflow-hidden text-ellipsis whitespace-nowrap px-[11px] text-[11px] font-semibold uppercase leading-6 tracking-[.09em] text-[#f7f1e4] [text-shadow:0_1px_2px_rgba(0,0,0,.55)]">
							{accord.label}
						</span>
					</div>
				))}
			</div>
		</section>
	)
}

function Pyramid({ pyramid }: { pyramid: FragranticaPyramid }) {
	const groups: Array<[string, string[]]> = [
		['Salida', pyramid.top],
		['Corazón', pyramid.middle],
		['Base', pyramid.base],
	]

	return (
		<section>
			<SectionTitle>Pirámide del perfume</SectionTitle>
			<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
				{groups.map(([label, notes]) =>
					notes.length ? (
						<div
							key={label}
							className="min-w-0 rounded-md border border-[rgba(255,255,255,0.07)] border-l-2 border-l-[rgba(212,178,118,0.72)] bg-[rgba(255,255,255,0.035)] px-2.5 pb-[11px] pt-2.5"
						>
							<div className="mb-1.5 text-[11px] font-extrabold uppercase text-[#fff3bf]">{label}</div>
							<div className="flex flex-wrap gap-[5px]">
								{notes.map((note, index) => (
									<span
										key={`${note}-${index}`}
										className="max-w-full break-words rounded-full border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.09)] px-[7px] py-[5px] text-[11px] leading-none text-[#efe8dc]"
									>
										{capitalizeNoteLabel(note)}
									</span>
								))}
							</div>
						</div>
					) : null
				)}
			</div>
		</section>
	)
}

function FlatNotes({ notes }: { notes: string[] }) {
	return (
		<section>
			<SectionTitle>Notas de fragancia</SectionTitle>
			<div className="min-w-0 rounded-md border border-[rgba(255,255,255,0.07)] border-l-2 border-l-[rgba(212,178,118,0.72)] bg-[rgba(255,255,255,0.035)] px-2.5 pb-[11px] pt-2.5">
				<div className="flex flex-wrap gap-[5px]">
					{notes.map((note, index) => (
						<span
							key={`${note}-${index}`}
							className="max-w-full break-words rounded-full border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.09)] px-[7px] py-[5px] text-[11px] leading-none text-[#efe8dc]"
						>
							{capitalizeNoteLabel(note)}
						</span>
					))}
				</div>
			</div>
		</section>
	)
}

function Wear({ wear }: { wear: FragranticaWear[] }) {
	return (
		<section>
			<SectionTitle>Cuándo usarlo</SectionTitle>
			<div className="grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2">
				{wear.map(item => (
					<div key={item.key} className="grid gap-[5px]">
						<div className="flex items-center justify-between gap-2">
							<span className="text-[11px] font-extrabold text-[#e5dccd]">{item.label}</span>
							<span className="text-[10px] font-bold text-[#bfb4a2]">{Math.round(item.score)}%</span>
						</div>
						<span className="block h-[9px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.09)]">
							<span
								className="block h-full rounded-full"
								style={{
									width: `${Math.max(6, Math.min(100, item.score))}%`,
									backgroundColor: WEAR_COLORS[item.key] || '#d4b276',
								}}
							/>
						</span>
					</div>
				))}
			</div>
		</section>
	)
}
