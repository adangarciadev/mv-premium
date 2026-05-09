import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Search from 'lucide-react/dist/esm/icons/search'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	hasItadApiKey,
	searchItadGamesWithPrices,
	type ItadDealSummary,
	type ItadGamePriceOverview,
	type ItadGameSearchResult,
	type ItadPrice,
} from '@/services/api/itad'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface SearchState {
	games: ItadGameSearchResult[]
	prices: Record<string, ItadGamePriceOverview>
	loading: boolean
	error: string | null
	hasCredentials: boolean | null
	hasSearched: boolean
}

function formatPrice(price?: ItadPrice | null): string {
	if (!price || !Number.isFinite(price.amount)) return 'N/D'

	try {
		return new Intl.NumberFormat('es-ES', {
			style: 'currency',
			currency: price.currency || 'EUR',
		}).format(price.amount)
	} catch {
		return `${price.amount.toFixed(2)} ${price.currency || ''}`.trim()
	}
}

function getBestImage(game: ItadGameSearchResult): string | null {
	return game.assets?.banner145 || game.assets?.boxart || game.assets?.banner300 || null
}

function getItadUrl(game: ItadGameSearchResult, overview?: ItadGamePriceOverview): string {
	if (overview?.urls?.game) return overview.urls.game
	if (game.slug) return `https://isthereanydeal.com/game/${game.slug}/info/`
	return `https://isthereanydeal.com/search/?q=${encodeURIComponent(game.title)}`
}

function DealPill({ deal, label }: { deal?: ItadDealSummary | null; label: string }) {
	if (!deal?.price) return null

	return (
		<div className="flex min-w-0 flex-col rounded-md border border-border bg-background/80 px-3 py-2 shadow-sm">
			<span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
			<span className="truncate text-base font-semibold text-foreground">{formatPrice(deal.price)}</span>
			<span className="truncate text-xs text-muted-foreground">{deal.shop?.name || 'Tienda desconocida'}</span>
		</div>
	)
}

function GameResult({
	game,
	overview,
}: {
	game: ItadGameSearchResult
	overview?: ItadGamePriceOverview
}) {
	const current = overview?.current
	const lowest = overview?.lowest
	const image = getBestImage(game)
	const url = getItadUrl(game, overview)
	const isHistoricalLow =
		current?.price?.amount !== undefined &&
		lowest?.price?.amount !== undefined &&
		current.price.amount <= lowest.price.amount

	return (
		<article className="grid gap-3 rounded-lg border border-border bg-background/70 p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-background sm:grid-cols-[112px_1fr]">
			<div className="h-16 overflow-hidden rounded-md border border-border bg-muted sm:h-[64px]">
				{image ? (
					<img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<Gamepad2 className="h-5 w-5" />
					</div>
				)}
			</div>

			<div className="min-w-0 space-y-2">
				<div className="flex min-w-0 items-start justify-between gap-2">
					<div className="min-w-0">
						<h3 className="truncate text-sm font-semibold text-foreground">{game.title}</h3>
						<p className="truncate text-xs text-muted-foreground">
							{current?.shop?.name ? `Mejor oferta en ${current.shop.name}` : 'Sin precio actual disponible'}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{isHistoricalLow ? <Badge className="bg-emerald-600 text-white">mínimo</Badge> : null}
						<Button asChild size="icon-sm" variant="ghost" title="Ver en IsThereAnyDeal">
							<a href={url} target="_blank" rel="noreferrer">
								<ExternalLink />
							</a>
						</Button>
					</div>
				</div>

				<div className="grid gap-2 sm:grid-cols-2">
					<DealPill deal={current} label="Ahora" />
					<DealPill deal={lowest} label="Histórico" />
					{!current?.price && !lowest?.price ? (
						<p className="text-xs text-muted-foreground">ITAD no devuelve ofertas para este resultado.</p>
					) : null}
				</div>
			</div>
		</article>
	)
}

export function ItadSubforumSearch() {
	const [query, setQuery] = useState('')
	const [state, setState] = useState<SearchState>({
		games: [],
		prices: {},
		loading: false,
		error: null,
		hasCredentials: null,
		hasSearched: false,
	})
	const requestId = useRef(0)

	useEffect(() => {
		let active = true
		hasItadApiKey()
			.then(hasCredentials => {
				if (active) setState(prev => ({ ...prev, hasCredentials }))
			})
			.catch(error => {
				logger.error('ITAD credentials check failed', error)
				if (active) setState(prev => ({ ...prev, hasCredentials: false }))
			})

		return () => {
			active = false
		}
	}, [])

	const trimmedQuery = useMemo(() => query.trim(), [query])

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (trimmedQuery.length < 2 || state.loading) return

		const currentRequest = ++requestId.current
		setState(prev => ({ ...prev, loading: true, error: null }))

		try {
			const result = await searchItadGamesWithPrices(trimmedQuery, { country: 'ES', results: 8 })
			if (requestId.current !== currentRequest) return
			setState(prev => ({
				...prev,
				games: result.games,
				prices: result.prices,
				loading: false,
				error: null,
				hasSearched: true,
			}))
		} catch (error) {
			logger.error('ITAD subforum search failed', error)
			if (requestId.current !== currentRequest) return
			setState(prev => ({
				...prev,
				loading: false,
				error: 'No se han podido cargar las ofertas de IsThereAnyDeal.',
				hasSearched: true,
			}))
		}
	}

	const canSearch = state.hasCredentials === true && trimmedQuery.length >= 2 && !state.loading

	return (
		<section className="mb-3 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
			<div className="border-b border-border bg-gradient-to-r from-background via-muted/20 to-background px-4 py-3">
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/15 text-primary">
						<TrendingDown className="h-4 w-4" />
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-sm font-semibold text-foreground">Ofertas de juegos</h2>
						<p className="truncate text-xs text-muted-foreground">Busca precios actuales y mínimos históricos en IsThereAnyDeal</p>
					</div>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="flex gap-2 p-3">
				<div className="relative min-w-0 flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
					<Input
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder="Buscar ofertas de juegos..."
						className="h-10 rounded-lg bg-background pl-9 shadow-sm"
						disabled={state.hasCredentials === false}
					/>
				</div>
				<Button type="submit" disabled={!canSearch} className="h-10 rounded-lg px-4">
					{state.loading ? <Loader2 className="animate-spin" /> : <Search />}
					<span className="hidden sm:inline">Buscar</span>
				</Button>
			</form>

			{state.hasCredentials === false ? (
				<p className="mx-3 mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					Configura VITE_ITAD_API_KEY para activar las ofertas.
				</p>
			) : null}
			{state.error ? <p className="mx-3 mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.error}</p> : null}

			<div className={cn('grid gap-2 px-3 pb-3', !state.hasSearched && !state.loading ? 'hidden' : '')}>
				{state.games.map(game => (
					<GameResult key={game.id} game={game} overview={state.prices[game.id]} />
				))}
				{state.hasSearched && !state.loading && state.games.length === 0 && !state.error ? (
					<p className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-4 text-center text-sm text-muted-foreground">
						No se han encontrado juegos con ese nombre.
					</p>
				) : null}
			</div>
		</section>
	)
}
