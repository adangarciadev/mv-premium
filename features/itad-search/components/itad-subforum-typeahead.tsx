import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Search from 'lucide-react/dist/esm/icons/search'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import Store from 'lucide-react/dist/esm/icons/store'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down'
import X from 'lucide-react/dist/esm/icons/x'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
	hasItadApiKey,
	getItadGamePrices,
	searchItadGamesWithPrices,
	type ItadDealSummary,
	type ItadGamePriceOverview,
	type ItadGamePrices,
	type ItadGameSearchResult,
	type ItadPrice,
} from '@/services/api/itad'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 2

interface SearchState {
	games: ItadGameSearchResult[]
	prices: Record<string, ItadGamePriceOverview>
	loading: boolean
	error: string | null
	hasCredentials: boolean | null
	hasSearched: boolean
}

interface SelectedGame {
	game: ItadGameSearchResult
	overview?: ItadGamePriceOverview
}

interface GameDetailsState {
	prices?: ItadGamePrices
	loading: boolean
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

function formatDate(value?: string | null): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date)
}

function getBestImage(game: ItadGameSearchResult): string | null {
	return game.assets?.banner300 || game.assets?.banner145 || game.assets?.boxart || null
}

function getHeroImage(game: ItadGameSearchResult): string | null {
	return game.assets?.banner600 || game.assets?.banner400 || getBestImage(game)
}

function getItadUrl(game: ItadGameSearchResult, overview?: ItadGamePriceOverview): string {
	if (overview?.urls?.game) return overview.urls.game
	if (game.slug) return `https://isthereanydeal.com/game/${game.slug}/info/`
	return `https://isthereanydeal.com/search/?q=${encodeURIComponent(game.title)}`
}

function ResultDealMeta({ deal }: { deal?: ItadDealSummary | null }) {
	if (!deal?.price) {
		return <p className="mt-1 truncate text-xs text-muted-foreground">Sin precio activo ahora mismo</p>
	}

	return (
		<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
			<span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
				{formatPrice(deal.price)}
			</span>
			<span className="min-w-0 truncate text-muted-foreground">
				Mejor precio en {deal.shop?.name || 'tienda desconocida'}
			</span>
			{typeof deal.cut === 'number' && deal.cut > 0 ? (
				<span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-500">
					-{deal.cut}%
				</span>
			) : null}
		</div>
	)
}

function getPriceDelta(current?: ItadDealSummary | null, lowest?: ItadDealSummary | null): string | null {
	if (!current?.price || !lowest?.price) return null
	const delta = current.price.amount - lowest.price.amount
	if (!Number.isFinite(delta)) return null
	if (Math.abs(delta) < 0.01) return 'Está igualando su mínimo histórico'
	if (delta > 0) return `Ha estado ${formatPrice({ ...current.price, amount: delta })} más barato`
	return `Está ${formatPrice({ ...current.price, amount: Math.abs(delta) })} por debajo del mínimo registrado`
}

function getRegularSavings(deal?: ItadDealSummary | null): string | null {
	if (!deal?.price || !deal.regular) return null
	const savings = deal.regular.amount - deal.price.amount
	if (!Number.isFinite(savings) || savings <= 0) return null
	return `Ahorras ${formatPrice({ ...deal.price, amount: savings })}`
}

function PriceBox({
	label,
	deal,
	meta,
	emphasis = false,
}: {
	label: string
	deal?: ItadDealSummary | null
	meta?: string | null
	emphasis?: boolean
}) {
	const savings = getRegularSavings(deal)

	return (
		<div
			className={cn(
				'overflow-hidden rounded-lg border bg-background shadow-sm',
				emphasis ? 'border-primary/40 shadow-primary/10' : 'border-border'
			)}
		>
			<div
				className={cn(
					'flex items-start justify-between gap-3 border-b border-border p-4',
					emphasis ? 'bg-primary/10' : 'bg-muted/20'
				)}
			>
				<div className="min-w-0">
					<div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
					<div className="mt-1 text-3xl font-semibold tracking-normal text-primary">{formatPrice(deal?.price)}</div>
					{meta ? <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{meta}</div> : null}
				</div>
				{typeof deal?.cut === 'number' && deal.cut > 0 ? (
					<Badge className="border-emerald-400/30 bg-emerald-500/15 font-bold text-emerald-400">-{deal.cut}%</Badge>
				) : null}
			</div>
			<div className="space-y-1.5 p-4 pt-3">
				<p className="truncate text-xs font-medium text-muted-foreground">{deal?.shop?.name || 'Sin tienda'}</p>
				{savings ? <p className="text-xs font-medium text-emerald-400">{savings}</p> : null}
			</div>
		</div>
	)
}

function DetailChip({
	icon,
	label,
	value,
}: {
	icon: ReactNode
	label: string
	value?: string | null
}) {
	if (!value) return null

	return (
		<div className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-xs shadow-sm">
			<span className="shrink-0 text-primary [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
			<span className="shrink-0 font-semibold uppercase text-muted-foreground">{label}</span>
			<span className="min-w-0 truncate font-semibold text-foreground">{value}</span>
		</div>
	)
}

function WindowsLogo() {
	return (
		<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
			<path fill="currentColor" d="M3 4.6 10.7 3.5v7.4H3V4.6Zm8.6-1.2L21 2v8.9h-9.4V3.4ZM3 12h7.7v7.5L3 18.4V12Zm8.6 0H21v10l-9.4-1.3V12Z" />
		</svg>
	)
}

function AppleLogo() {
	return (
		<svg viewBox="-2 0 28 24" className="block h-4 w-4 translate-y-[1px]" aria-hidden="true">
			<path
				fill="currentColor"
				d="M16.4 2.1c.1 1.1-.4 2.2-1.1 3-.8.9-2 1.5-3.1 1.4-.1-1.1.4-2.2 1.1-3 .8-.9 2-1.5 3.1-1.4Zm3.4 16.7c-.7 1.1-1 1.6-1.9 2.6-1.2 1.3-2.8 2.8-4.8 2.8-1.8 0-2.2-.9-4.6-.9s-2.9.9-4.6.9c-2 0-3.5-1.4-4.7-2.8-3.2-3.8-3.6-8.3-1.6-10.7 1.4-1.7 3.6-2.7 5.6-2.7 2.1 0 3.4.9 5.1.9 1.6 0 2.6-.9 5-.9 1.8 0 3.7 1 5 2.7-4.4 2.4-3.7 8.7.5 10.1Z"
			/>
		</svg>
	)
}

function LinuxLogo() {
	return (
		<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
			<path
				fill="currentColor"
				d="M12 2c-2.1 0-3.6 1.7-3.6 4.1 0 1.2.2 2.2-.5 3.4-.6 1-1.8 2.8-2.5 4.3-.9 1.9-1.2 3.7-.3 5 .7 1 1.8 1.2 3 .9.9 1.4 2.3 2.3 3.9 2.3s3-.9 3.9-2.3c1.2.3 2.3.1 3-.9.9-1.3.6-3.1-.3-5-.7-1.5-1.9-3.3-2.5-4.3-.7-1.2-.5-2.2-.5-3.4C15.6 3.7 14.1 2 12 2Zm-1.3 4.7c-.4 0-.8-.4-.8-.9s.4-.9.8-.9.8.4.8.9-.4.9-.8.9Zm2.6 0c-.4 0-.8-.4-.8-.9s.4-.9.8-.9.8.4.8.9-.4.9-.8.9Zm-1.3 2c.8 0 1.4.4 1.4.9s-.6.9-1.4.9-1.4-.4-1.4-.9.6-.9 1.4-.9Z"
			/>
		</svg>
	)
}

function getShopDomain(shopName: string): string | null {
	const normalized = shopName.toLowerCase()
	if (normalized.includes('steam')) return 'store.steampowered.com'
	if (normalized.includes('gog')) return 'gog.com'
	if (normalized.includes('humble')) return 'humblebundle.com'
	if (normalized.includes('fanatical')) return 'fanatical.com'
	if (normalized.includes('green man')) return 'greenmangaming.com'
	if (normalized.includes('epic')) return 'epicgames.com'
	if (normalized.includes('2game')) return '2game.com'
	if (normalized.includes('gamesplanet')) return 'gamesplanet.com'
	if (normalized.includes('indiegala')) return 'indiegala.com'
	return null
}

function StoreLogo({ shopName }: { shopName: string }) {
	const domain = getShopDomain(shopName)
	const fallback = shopName.slice(0, 2).toUpperCase()

	return (
		<span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background text-[10px] font-bold text-muted-foreground">
			{domain ? (
				<img
					src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
					alt=""
					className="h-5 w-5"
					loading="lazy"
					referrerPolicy="no-referrer"
				/>
			) : (
				fallback
			)}
		</span>
	)
}

function PlatformBadges({ items }: { items?: Array<{ id: number; name: string }> }) {
	if (!items || items.length === 0) return <span className="text-muted-foreground">-</span>

	const platforms = items.map(item => {
		const normalized = item.name.toLowerCase()
		if (normalized.includes('windows')) return { label: 'Windows', icon: <WindowsLogo /> }
		if (normalized.includes('mac')) return { label: 'Mac', icon: <AppleLogo /> }
		if (normalized.includes('linux')) return { label: 'Linux', icon: <LinuxLogo /> }
		return { label: item.name, icon: <Gamepad2 className="h-4 w-4" /> }
	})

	return (
		<div className="flex flex-wrap gap-1">
			{platforms.map(platform => (
				<span
					key={platform.label}
					title={platform.label}
					aria-label={platform.label}
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm [&>svg]:shrink-0"
				>
					{platform.icon}
				</span>
			))}
		</div>
	)
}

function DealsTable({ deals }: { deals: ItadDealSummary[] }) {
	if (deals.length === 0) {
		return <p className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-5 text-center text-sm text-muted-foreground">No hay precios activos para este juego.</p>
	}

	return (
		<div className="overflow-x-auto rounded-lg border border-border bg-background shadow-sm">
			<div className="grid min-w-[620px] grid-cols-[1.25fr_0.65fr_0.85fr_0.8fr] border-b border-border bg-muted/30 px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">
				<span>Tienda</span>
				<span>Plataformas</span>
				<span>Mín. tienda</span>
				<span className="text-right">Actual</span>
			</div>
			<div className="max-h-64 overflow-y-auto">
				{deals.map((deal, index) => (
					<a
						key={`${deal.shop.id}-${deal.url || deal.price.amount}`}
						href={deal.url || '#'}
						target="_blank"
						rel="noreferrer"
						className={cn(
							'grid min-w-[620px] grid-cols-[1.25fr_0.65fr_0.85fr_0.8fr] items-center gap-2 border-t border-border px-4 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
							index === 0 && 'border-l-4 border-l-primary bg-primary/10'
						)}
					>
						<div className="flex min-w-0 items-center gap-2">
							<StoreLogo shopName={deal.shop.name} />
							<div className="min-w-0">
								<div className="flex min-w-0 items-center gap-2">
									<span className="truncate font-semibold">{deal.shop.name}</span>
									{index === 0 ? <Badge className="bg-primary text-primary-foreground">MEJOR</Badge> : null}
								</div>
								<div className="truncate text-xs text-muted-foreground">
									{deal.drm?.map(item => item.name).join(', ') || 'DRM no indicado'}
								</div>
							</div>
						</div>
						<PlatformBadges items={deal.platforms} />
						<div className="text-xs">
							<div className="font-medium">{formatPrice(deal.storeLow)}</div>
							{deal.storeLow && deal.price.amount > deal.storeLow.amount ? (
								<div className="text-[11px] text-amber-400">
									+{formatPrice({ ...deal.price, amount: deal.price.amount - deal.storeLow.amount })}
								</div>
							) : null}
						</div>
						<div className="text-right">
							<div className="text-base font-semibold text-primary">{formatPrice(deal.price)}</div>
							<div className="text-xs text-muted-foreground">{formatPrice(deal.regular)}</div>
							{typeof deal.cut === 'number' && deal.cut > 0 ? (
								<Badge className="mt-1 bg-emerald-600 text-white">-{deal.cut}%</Badge>
							) : null}
						</div>
					</a>
				))}
			</div>
		</div>
	)
}

function ResultRow({
	game,
	overview,
	onSelect,
}: {
	game: ItadGameSearchResult
	overview?: ItadGamePriceOverview
	onSelect: () => void
}) {
	const image = getBestImage(game)
	const current = overview?.current
	const lowest = overview?.lowest
	const isHistoricalLow =
		current?.price?.amount !== undefined &&
		lowest?.price?.amount !== undefined &&
		current.price.amount <= lowest.price.amount

	return (
		<button
			type="button"
			onClick={onSelect}
			className="group grid w-full grid-cols-[88px_1fr_auto] items-center gap-3 rounded-lg border border-transparent p-2 text-left transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
		>
			<div className="h-12 overflow-hidden rounded-md border border-border bg-muted">
				{image ? (
					<img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<Gamepad2 className="h-4 w-4" />
					</div>
				)}
			</div>
			<div className="min-w-0">
				<div className="flex min-w-0 items-center gap-2">
					<span className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{game.title}</span>
					{isHistoricalLow ? (
						<Badge className="border-emerald-400/30 bg-emerald-500/15 text-[10px] font-bold uppercase tracking-normal text-emerald-400">
							MÍNIMO HIST.
						</Badge>
					) : null}
				</div>
				<ResultDealMeta deal={current} />
			</div>
			<ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
		</button>
	)
}

function GameDetailsModal({
	selected,
	details,
	open,
	onOpenChange,
}: {
	selected: SelectedGame | null
	details?: GameDetailsState
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	if (!selected) return null

	const { game, overview } = selected
	const current = overview?.current
	const lowest = overview?.lowest
	const hero = getHeroImage(game)
	const url = getItadUrl(game, overview)
	const currentDate = formatDate(current?.timestamp)
	const lowestDate = formatDate(lowest?.timestamp)
	const expiryDate = formatDate(current?.expiry)
	const platforms = current?.platforms?.map(platform => platform.name).filter(Boolean).join(', ')
	const drm = current?.drm?.map(item => item.name).filter(Boolean).join(', ')
	const priceDelta = getPriceDelta(current, lowest)
	const isHistoricalLow =
		current?.price?.amount !== undefined &&
		lowest?.price?.amount !== undefined &&
		current.price.amount <= lowest.price.amount
	const deals = details?.prices?.deals || (current ? [current] : [])
	const ctaUrl = current?.url || url
	const ctaLabel = current?.price
		? `Comprar en ${current.shop?.name || 'tienda'} por ${formatPrice(current.price)}`
		: 'Ver en IsThereAnyDeal'

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden border-border bg-background p-0 shadow-2xl">
				<div className="max-h-[90vh] overflow-y-auto">
					<DialogHeader className="border-b border-border bg-muted/10 p-5">
						<div className={cn('grid gap-5 pr-7', hero ? 'sm:grid-cols-[240px_1fr_auto]' : 'sm:grid-cols-[1fr_auto]')}>
							{hero ? (
								<div className="aspect-[16/9] overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
									<img src={hero} alt="" className="h-full w-full object-cover" />
								</div>
							) : null}
							<div className="min-w-0">
								<div className="mb-2 flex flex-wrap items-center gap-2">
									<span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
										<TrendingDown className="h-3.5 w-3.5" />
										IsThereAnyDeal
									</span>
								</div>
								<DialogTitle className="line-clamp-2 text-2xl font-semibold tracking-normal sm:text-3xl">{game.title}</DialogTitle>
								<DialogDescription className="mt-2 text-sm font-semibold text-primary">
									{priceDelta || `${game.type === 'dlc' ? 'DLC' : 'Juego'} en IsThereAnyDeal`}
								</DialogDescription>
								<div className="mt-3 flex flex-wrap gap-2">
									<Badge variant="outline" className="uppercase">{game.type === 'dlc' ? 'DLC' : 'Juego'}</Badge>
									{isHistoricalLow ? (
										<Badge className="border-emerald-400/30 bg-emerald-500/15 font-bold uppercase text-emerald-400">
											Mínimo histórico
										</Badge>
									) : null}
									{typeof overview?.bundled === 'number' && overview.bundled > 0 ? (
										<Badge variant="secondary">{overview.bundled} bundle{overview.bundled === 1 ? '' : 's'}</Badge>
									) : null}
								</div>
							</div>
							<Button
								asChild
								size="icon-sm"
								variant="outline"
								title="Abrir en IsThereAnyDeal"
								className="h-9 w-9 justify-self-start rounded-md sm:justify-self-end"
							>
								<a href={url} target="_blank" rel="noreferrer">
									<ExternalLink />
								</a>
							</Button>
						</div>
					</DialogHeader>

					<div className="grid gap-5 p-5">
						<div className="grid gap-3 sm:grid-cols-2">
							<PriceBox label="Comprar ahora" deal={current} meta={currentDate} emphasis />
							<PriceBox label="Mínimo histórico" deal={lowest} meta={lowestDate} />
						</div>

						<Separator />

						<div className="grid gap-3">
							<div className="flex items-center justify-between gap-3">
								<h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
									<Store className="h-4 w-4 text-primary" />
									Precios por tienda
								</h3>
								{details?.loading ? (
									<span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
										<Loader2 className="h-3 w-3 animate-spin" />
										Cargando tiendas
									</span>
								) : null}
							</div>
							<DealsTable deals={deals} />
						</div>

						<div className="flex flex-wrap gap-2">
							<DetailChip icon={<CalendarDays />} label="Detectada" value={currentDate} />
							<DetailChip icon={<CalendarDays />} label="Caduca" value={expiryDate} />
							<DetailChip icon={<TrendingDown />} label="Mínimo" value={lowestDate} />
							<DetailChip icon={<Gamepad2 />} label="Plataformas" value={platforms} />
							<DetailChip icon={<ShieldCheck />} label="DRM" value={drm} />
						</div>

						{ctaUrl ? (
							<Button asChild className="h-11 rounded-lg text-sm font-semibold">
								<a href={ctaUrl} target="_blank" rel="noreferrer">
									<ExternalLink />
									{ctaLabel}
								</a>
							</Button>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function SearchLoadingRows() {
	return (
		<div className="space-y-1 p-1">
			{[0, 1, 2].map(index => (
				<div
					key={index}
					className="grid grid-cols-[88px_1fr_auto] items-center gap-3 rounded-lg border border-border/70 p-2"
				>
					<div className="h-12 animate-pulse rounded-md bg-muted" />
					<div className="min-w-0 space-y-2">
						<div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
						<div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
					</div>
					<div className="h-6 w-12 animate-pulse rounded-md bg-muted" />
				</div>
			))}
		</div>
	)
}

export function ItadSubforumTypeahead() {
	const containerRef = useRef<HTMLElement | null>(null)
	const [query, setQuery] = useState('')
	const [selected, setSelected] = useState<SelectedGame | null>(null)
	const [detailsByGameId, setDetailsByGameId] = useState<Record<string, GameDetailsState>>({})
	const [modalOpen, setModalOpen] = useState(false)
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [state, setState] = useState<SearchState>({
		games: [],
		prices: {},
		loading: false,
		error: null,
		hasCredentials: null,
		hasSearched: false,
	})
	const requestId = useRef(0)
	const trimmedQuery = useMemo(() => query.trim(), [query])

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const container = containerRef.current
			if (!container) return
			const path = event.composedPath()
			const root = container.getRootNode()
			const shadowHost = root instanceof ShadowRoot ? root.host : null
			if (path.includes(container) || (shadowHost && path.includes(shadowHost))) return
			setDropdownOpen(false)
		}

		document.addEventListener('pointerdown', handlePointerDown, true)
		return () => document.removeEventListener('pointerdown', handlePointerDown, true)
	}, [])

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

	useEffect(() => {
		if (state.hasCredentials !== true) return

		if (trimmedQuery.length < MIN_QUERY_LENGTH) {
			requestId.current += 1
			setDropdownOpen(false)
			setState(prev => ({ ...prev, games: [], prices: {}, loading: false, error: null, hasSearched: false }))
			return
		}

		const currentRequest = ++requestId.current
		setDropdownOpen(true)
		setState(prev => ({
			...prev,
			games: [],
			prices: {},
			loading: true,
			error: null,
			hasSearched: false,
		}))

		const timer = window.setTimeout(() => {
			searchItadGamesWithPrices(trimmedQuery, { country: 'ES', results: 8 })
				.then(result => {
					if (requestId.current !== currentRequest) return
					setState(prev => ({
						...prev,
						games: result.games,
						prices: result.prices,
						loading: false,
						error: null,
						hasSearched: true,
					}))
				})
				.catch(error => {
					logger.error('ITAD subforum search failed', error)
					if (requestId.current !== currentRequest) return
					setState(prev => ({
						...prev,
						games: [],
						prices: {},
						loading: false,
						error: 'No se han podido cargar las ofertas de IsThereAnyDeal.',
						hasSearched: true,
					}))
				})
		}, SEARCH_DEBOUNCE_MS)

		return () => window.clearTimeout(timer)
	}, [state.hasCredentials, trimmedQuery])

	function openGame(game: ItadGameSearchResult) {
		setSelected({ game, overview: state.prices[game.id] })
		setModalOpen(true)
		setDropdownOpen(false)

		if (!detailsByGameId[game.id]?.prices && !detailsByGameId[game.id]?.loading) {
			setDetailsByGameId(prev => ({
				...prev,
				[game.id]: { loading: true },
			}))
			getItadGamePrices([game.id], { country: 'ES', capacity: 8 })
				.then(result => {
					setDetailsByGameId(prev => ({
						...prev,
						[game.id]: { loading: false, prices: result[game.id] },
					}))
				})
				.catch(error => {
					logger.error('ITAD game prices failed', error)
					setDetailsByGameId(prev => ({
						...prev,
						[game.id]: { loading: false },
					}))
				})
		}
	}

	function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			setDropdownOpen(false)
		}
	}

	function clearSearch() {
		requestId.current += 1
		setQuery('')
		setDropdownOpen(false)
		setState(prev => ({
			...prev,
			games: [],
			prices: {},
			loading: false,
			error: null,
			hasSearched: false,
		}))
	}

	const showResults = dropdownOpen && (state.loading || state.hasSearched || !!state.error)
	const showClearButton = query.length > 0 && state.hasCredentials !== false

	return (
		<section ref={containerRef} className="relative mb-3 overflow-visible rounded-lg border border-border bg-card text-card-foreground shadow-sm">
			<div className="border-b border-border bg-gradient-to-r from-background via-muted/20 to-background px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary shadow-sm">
						<Gamepad2 className="h-5 w-5" />
					</div>
					<div className="min-w-0">
						<h2 className="truncate text-sm font-semibold text-foreground">Radar de ofertas</h2>
						<p className="truncate text-xs text-muted-foreground">Caza descuentos, tiendas fiables y mínimos históricos al vuelo</p>
					</div>
				</div>
			</div>
			<div className="relative p-3">
				<div className="pointer-events-none absolute left-6 inset-y-3 flex items-center">
					<Search className="h-4 w-4 text-primary" />
				</div>
				<Input
					value={query}
					onChange={event => setQuery(event.target.value)}
					onFocus={() => {
						if (trimmedQuery.length >= MIN_QUERY_LENGTH && (state.games.length > 0 || state.hasSearched || state.loading)) {
							setDropdownOpen(true)
						}
					}}
					onKeyDown={handleInputKeyDown}
					placeholder="Buscar ofertas de juegos..."
					className="h-10 rounded-lg bg-background pl-9 pr-16 shadow-sm"
					disabled={state.hasCredentials === false}
				/>
				<div className="absolute right-5 inset-y-3 flex items-center gap-1">
					{state.loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
					{showClearButton ? (
						<button
							type="button"
							onClick={clearSearch}
							className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
							title="Limpiar búsqueda"
							aria-label="Limpiar búsqueda"
						>
							<X className="h-4 w-4" />
						</button>
					) : null}
				</div>
			</div>

			{state.hasCredentials === false ? (
				<p className="mx-3 mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					Configura VITE_ITAD_API_KEY para activar las ofertas.
				</p>
			) : null}

			<div
				className={cn(
					'absolute left-3 right-3 top-[118px] z-50 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl',
					!showResults && 'hidden'
				)}
			>
				<div className="max-h-[342px] overflow-y-auto p-1">
					{state.error ? <p className="px-3 py-3 text-sm text-destructive">{state.error}</p> : null}
					{state.loading && state.games.length === 0 && !state.error ? <SearchLoadingRows /> : null}
					{state.games.map(game => (
						<ResultRow
							key={game.id}
							game={game}
							overview={state.prices[game.id]}
							onSelect={() => openGame(game)}
						/>
					))}
					{state.hasSearched && !state.loading && state.games.length === 0 && !state.error ? (
						<div className="px-3 py-4 text-sm">
							<p className="font-medium text-foreground">No se han encontrado juegos con ese nombre.</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Prueba con el título original, sin subtítulos o con menos palabras.
							</p>
						</div>
					) : null}
				</div>
			</div>

			<GameDetailsModal
				selected={selected}
				details={selected ? detailsByGameId[selected.game.id] : undefined}
				open={modalOpen}
				onOpenChange={setModalOpen}
			/>
		</section>
	)
}
