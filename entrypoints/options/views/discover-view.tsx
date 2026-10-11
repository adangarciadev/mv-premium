import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Search from 'lucide-react/dist/esm/icons/search'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import PenLine from 'lucide-react/dist/esm/icons/pen-line'
import ListFilter from 'lucide-react/dist/esm/icons/list-filter'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import Palette from 'lucide-react/dist/esm/icons/palette'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
	FEATURE_CATALOG, FEATURE_CATEGORIES, filterFeatureCatalog, getFeatureAction,
	type DiscoverFeature, type FeatureCategory, type FeaturePlatform, type FeaturePlatformFilter,
} from '../lib/feature-catalog'

const CATEGORY_ICONS = {
	reading: BookOpen, writing: PenLine, organization: ListFilter,
	media: Clapperboard, appearance: Palette, tools: LayoutDashboard,
}

const PLATFORM_LABELS = { desktop: 'PC', mobile: 'Móvil', both: 'PC y móvil' }

function PlatformBadge({ platform }: { platform: FeaturePlatform }) {
	return (
		<Badge variant={platform === 'mobile' ? 'default' : platform === 'both' ? 'secondary' : 'outline'} data-platform={platform} className="discover-platform px-2.5 py-1">
			{platform !== 'mobile' ? <Monitor aria-hidden="true" /> : null}
			{platform !== 'desktop' ? <Smartphone aria-hidden="true" /> : null}
			{PLATFORM_LABELS[platform]}
		</Badge>
	)
}

function FeatureCard({ feature, platform }: { feature: DiscoverFeature; platform: FeaturePlatformFilter }) {
	// Mobile Lite has its own settings panel; desktop settings links would send
	// someone reading the mobile guide to a different set of controls.
	const action = platform === 'mobile' ? undefined : getFeatureAction(feature)
	const location = platform === 'mobile' ? feature.mobileLocation ?? feature.location : feature.location
	const external = action?.href.startsWith('https://')
	const descriptionId = `discover-description-${feature.id}`

	return (
		<li className="min-w-0">
			<Dialog modal>
				<Card className="discover-card group relative h-full min-h-44 gap-3 p-5 shadow-none transition-colors">
					<h3 className="font-display text-lg font-semibold leading-snug">
						<DialogTrigger asChild>
							<button
								type="button" aria-describedby={descriptionId}
								className="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
							>
								{feature.title}
								<span className="sr-only">: cómo usarlo</span>
							</button>
						</DialogTrigger>
					</h3>
					<p id={descriptionId} className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
					<div className="mt-auto flex items-center justify-between gap-3 pt-1">
						{platform === 'all' ? <PlatformBadge platform={feature.platform} /> : <span />}
						<span className="flex items-center gap-1 text-sm font-medium" aria-hidden="true">
							Cómo usarlo<ChevronRight className="size-4" />
						</span>
					</div>
				</Card>
				<DialogContent showCloseButton={false} className="discover-guide w-[calc(100%-2rem)] gap-6">
					<DialogHeader>
						<PlatformBadge platform={feature.platform} />
						<DialogTitle className="font-display text-2xl leading-tight">{feature.title}</DialogTitle>
						<DialogDescription className="leading-relaxed">{feature.description}</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 text-sm leading-relaxed">
						<h3 className="font-semibold">Dónde encontrarlo</h3>
						<p>{location}</p>
						{platform === 'all' && feature.mobileLocation ? (
							<p><span className="font-medium">En móvil: </span>{feature.mobileLocation}</p>
						) : null}
						{feature.requirement ? <p className="text-muted-foreground">{feature.requirement}</p> : null}
					</div>
					<DialogFooter className="flex-wrap">
						<DialogClose asChild><Button variant="outline" className="min-h-11">Cerrar</Button></DialogClose>
						{action ? (
							<DialogClose asChild>
								<Button asChild className="min-h-11" aria-label={`${action.label}: ${feature.title}`}>
									{external ? (
										<a href={action.href} target="_blank" rel="noreferrer">{action.label}<ArrowUpRight aria-hidden="true" /></a>
									) : (
										<Link to={action.href}>{action.label}<ArrowUpRight aria-hidden="true" /></Link>
									)}
								</Button>
							</DialogClose>
						) : null}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</li>
	)
}

export function DiscoverView() {
	const [query, setQuery] = useState('')
	const [category, setCategory] = useState<FeatureCategory | 'all'>('all')
	const [platform, setPlatform] = useState<FeaturePlatformFilter>('all')
	const searchRef = useRef<HTMLInputElement>(null)
	const features = filterFeatureCatalog(query, category, platform)
	const hasFilters = Boolean(query || category !== 'all' || platform !== 'all')

	const clearFilters = () => {
		setQuery('')
		setCategory('all')
		setPlatform('all')
		searchRef.current?.focus()
	}

	return (
		<div className="discover-guide flex flex-col gap-7 pb-10 text-foreground">
			<header className="flex flex-col gap-2">
				<h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Descubre MV Premium</h1>
				<p className="max-w-prose text-base leading-relaxed text-muted-foreground">
					Encuentra lo que te interesa y abre su tarjeta para ver cómo usarlo.
				</p>
			</header>

			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-3 lg:flex-row">
					<div className="relative min-w-0 flex-1">
						<Label htmlFor="discover-search" className="sr-only">Buscar funciones</Label>
						<Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
						<Input
							ref={searchRef} id="discover-search" type="search" value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder="Busca: favoritos, cine, imágenes…"
							className="h-11 pl-9"
						/>
					</div>
					<div className="flex flex-wrap gap-3">
						<Label htmlFor="discover-category" className="sr-only">Filtrar por categoría</Label>
						<Select
							value={category}
							onValueChange={value => setCategory(FEATURE_CATEGORIES.find(item => item.id === value)?.id ?? 'all')}
						>
							<SelectTrigger id="discover-category" className="data-[size=default]:h-11"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="all">Todas las categorías</SelectItem>
									{FEATURE_CATEGORIES.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
								</SelectGroup>
							</SelectContent>
						</Select>
						<Label htmlFor="discover-platform" className="sr-only">Filtrar por dispositivo</Label>
						<Select
							value={platform}
							onValueChange={value => setPlatform(value === 'desktop' || value === 'mobile' ? value : 'all')}
						>
							<SelectTrigger id="discover-platform" className="data-[size=default]:h-11"><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="all">Todos los dispositivos</SelectItem>
									<SelectItem value="desktop">Para PC</SelectItem>
									<SelectItem value="mobile">Para móvil</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p role="status" className="text-sm text-muted-foreground">
						{features.length} de {FEATURE_CATALOG.length} funciones
					</p>
					{hasFilters ? <Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button> : null}
				</div>
				<p className="text-sm leading-relaxed text-muted-foreground">
					Las funciones de móvil corresponden a Mobile Lite en Firefox para Android.
				</p>
			</div>

			{features.length === 0 ? (
				<EmptyState
					icon={Search} title="No encontramos funciones con esos filtros"
					description="Prueba con otra palabra o vuelve a mostrar todas las funciones."
					action={<Button onClick={clearFilters}>Ver todas las funciones</Button>}
				/>
			) : FEATURE_CATEGORIES.map(item => {
				const categoryFeatures = features.filter(feature => feature.category === item.id)
				if (categoryFeatures.length === 0) return null
				const Icon = CATEGORY_ICONS[item.id]
				return (
					<section key={item.id} aria-labelledby={`discover-${item.id}`} className="flex flex-col gap-4">
						<header className="flex flex-col gap-1">
							<div className="flex items-center gap-2.5">
								<Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
								<h2 id={`discover-${item.id}`} className="font-display text-xl font-semibold">{item.label}</h2>
								<span className="text-sm tabular-nums text-muted-foreground">{categoryFeatures.length}</span>
							</div>
							<p className="text-sm text-muted-foreground">{item.description}</p>
						</header>
						<ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
							{categoryFeatures.map(feature => <FeatureCard key={feature.id} feature={feature} platform={platform} />)}
						</ul>
					</section>
				)
			})}
		</div>
	)
}
