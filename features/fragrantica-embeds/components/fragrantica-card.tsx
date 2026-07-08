import { useEffect, useState } from 'react'
import Star from 'lucide-react/dist/esm/icons/star'
import { sendMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import type { FragranticaFragrance, FragranticaRating } from '@/services/api/fragrantica'
import { FragranticaDetails } from './fragrantica-card-details'
import { capitalizeNoteLabel } from './format'

interface FragranticaCardProps {
	url: string
}

type CardState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; data: FragranticaFragrance }

const CARD_BASE =
	'mt-3 mb-4 max-w-[760px] overflow-hidden rounded-lg border border-[rgba(232,226,214,0.18)] bg-[#171a1d] p-3 text-[#f5efe6] [line-height:1.35] shadow-[0_10px_24px_rgba(0,0,0,.22)] sm:p-3.5'
const STATUS_BASE = `${CARD_BASE} flex min-h-[52px] items-center text-[12px] text-[#d9d0c0]`

export function FragranticaCard({ url }: FragranticaCardProps) {
	const [state, setState] = useState<CardState>({ status: 'loading' })
	const [expanded, setExpanded] = useState(false)

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })

		sendMessage('fetchFragranticaFragrance', { url })
			.then(result => {
				if (cancelled) return
				if (!result?.success || !result.data) {
					setState({ status: 'error', message: result?.error || 'No se pudo crear la ficha.' })
					return
				}
				setState({ status: 'ready', data: result.data })
			})
			.catch(error => {
				if (cancelled) return
				logger.warn('Fragrantica embed fetch failed', error)
				setState({ status: 'error', message: 'No se pudo cargar Fragrantica.' })
			})

		return () => {
			cancelled = true
		}
	}, [url])

	if (state.status === 'loading') {
		return (
			<aside className={STATUS_BASE}>
				<a href={url} target="_blank" rel="noopener noreferrer" className="text-[#fff3bf]">
					Cargando ficha de Fragrantica...
				</a>
			</aside>
		)
	}

	if (state.status === 'error') {
		return (
			<aside className={`${STATUS_BASE} flex-col items-center gap-1`}>
				<a href={url} target="_blank" rel="noopener noreferrer" className="text-[#fff3bf]">
					Ver en Fragrantica
				</a>
				<span>{state.message}</span>
			</aside>
		)
	}

	const { data: fragrance } = state
	const detailsId = `mvp-fragrantica-details-${fragrance.id || url}`

	return (
		<aside className={CARD_BASE}>
			<div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3.5 sm:grid-cols-[92px_minmax(0,1fr)]">
				<SummaryImage fragrance={fragrance} />

				<div className="grid min-w-0 gap-2.5">
					<div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<div className="min-w-0">
							<a
								href={fragrance.url}
								target="_blank"
								rel="noopener noreferrer"
								className="block [overflow-wrap:anywhere] text-[16px] font-extrabold leading-[1.18] text-[#fffaf0] no-underline hover:underline sm:text-[18px]"
							>
								{fragrance.title || 'Ficha de Fragrantica'}
							</a>
							{(fragrance.brand || fragrance.audience) && (
								<div className="text-[12px] font-medium uppercase tracking-[.07em] text-[#a89e8c]">
									{[fragrance.brand, fragrance.audience].filter(Boolean).join(' · ')}
								</div>
							)}
						</div>
						{fragrance.rating?.value ? <RatingBox rating={fragrance.rating} /> : null}
					</div>

					<Highlights fragrance={fragrance} />

					<div className="mt-1 flex flex-wrap items-center gap-3 border-t border-[rgba(232,226,214,0.08)] pt-2.5">
						<button
							type="button"
							aria-expanded={expanded}
							aria-controls={detailsId}
							onClick={() => setExpanded(value => !value)}
							className="rounded-md border border-[rgba(255,243,191,0.35)] bg-[rgba(255,243,191,0.12)] px-2.5 py-2 text-[12px] font-black leading-none text-[#fff3bf] transition-colors hover:border-[rgba(255,243,191,0.55)] hover:bg-[rgba(255,243,191,0.2)]"
						>
							{expanded ? 'Ocultar ficha' : 'Ver ficha'}
						</button>
						<a
							href={fragrance.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-[12px] font-extrabold text-[#c9bfae] no-underline hover:text-[#fff3bf] hover:underline"
						>
							Abrir en Fragrantica
						</a>
					</div>
				</div>
			</div>

			<div
				id={detailsId}
				aria-hidden={!expanded}
				className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
					expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
				}`}
			>
				<div className="overflow-hidden">
					<div className="mt-3.5 border-t border-[rgba(232,226,214,0.12)] pt-3.5">
						<FragranticaDetails fragrance={fragrance} />
					</div>
				</div>
			</div>
		</aside>
	)
}

function SummaryImage({ fragrance }: { fragrance: FragranticaFragrance }) {
	const [src, setSrc] = useState(fragrance.image)

	return (
		<a
			href={fragrance.url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex min-h-[92px] items-center justify-center self-stretch overflow-hidden rounded-md bg-[#f4f0e8] p-2 sm:min-h-[112px]"
		>
			{src && (
				<img
					src={src}
					alt=""
					loading="lazy"
					decoding="async"
					onError={() => {
						if (fragrance.fallbackImage && src !== fragrance.fallbackImage) setSrc(fragrance.fallbackImage)
					}}
					className="block h-20 max-w-[60px] object-contain sm:h-24 sm:max-w-[76px]"
				/>
			)}
		</a>
	)
}

function RatingBox({ rating }: { rating: FragranticaRating }) {
	const value = rating.value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')
	const votes = rating.count ? new Intl.NumberFormat('es-ES').format(rating.count) : null

	return (
		<div className="flex min-w-[88px] flex-col items-center gap-1.5 rounded-xl border border-[rgba(255,243,191,0.24)] bg-[linear-gradient(180deg,rgba(255,243,191,.14),rgba(255,243,191,.03)),rgba(255,255,255,.03)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
			<div className="flex items-center gap-1">
				<Star className="h-3 w-3 fill-[#fff3bf] text-[#fff3bf]" />
				<span className="text-[22px] font-black leading-none tracking-tight text-[#fff3bf] [font-variant-numeric:tabular-nums]">
					{value}
				</span>
				<span className="self-end text-[10px] font-semibold text-[#d8cfad]">/5</span>
			</div>
			<div className="h-px w-6 bg-[rgba(255,243,191,0.25)]" />
			<div className="text-center text-[9px] font-semibold uppercase tracking-[.08em] text-[#c9bfae]">
				{votes ? `${votes} votos` : 'Sin votos'}
			</div>
		</div>
	)
}

function Highlights({ fragrance }: { fragrance: FragranticaFragrance }) {
	const accordLabels = fragrance.accords.slice(0, 4).map(accord => accord.label)
	const pyramidLabels = [
		...fragrance.pyramid.top.slice(0, 2),
		...fragrance.pyramid.middle.slice(0, 1),
		...fragrance.pyramid.base.slice(0, 1),
	].filter(Boolean)
	const noteLabels = pyramidLabels.length ? pyramidLabels : fragrance.notes.slice(0, 4)

	if (!accordLabels.length && !noteLabels.length) return null

	return (
		<div className="grid gap-2">
			{accordLabels.length > 0 && <HighlightGroup label="Acordes" values={accordLabels} />}
			{noteLabels.length > 0 && <HighlightGroup label="Notas" values={noteLabels} />}
		</div>
	)
}

function HighlightGroup({ label, values }: { label: string; values: string[] }) {
	return (
		<div className="grid min-w-0 grid-cols-1 items-start gap-[5px] sm:grid-cols-[58px_minmax(0,1fr)] sm:items-center sm:gap-2.5">
			<span className="text-[10px] font-black uppercase tracking-[.08em] text-[#c2ab7c]">{label}</span>
			<span className="flex min-w-0 flex-wrap gap-1.5">
				{values.map((value, index) => (
					<span
						key={`${value}-${index}`}
						className="max-w-full break-words rounded-[7px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.075))] px-2 py-[5px] text-[11px] font-bold leading-none text-[#f3eadb] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
					>
						{capitalizeNoteLabel(value)}
					</span>
				))}
			</span>
		</div>
	)
}
