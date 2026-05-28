/**
 * Settings View - Vertical Tabs Layout
 * Sidebar navigation with content panel
 */
import { useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'

// Local imports
import {
	SETTINGS_CATEGORIES,
	SETTINGS_SEARCH_INDEX,
	type CategoryId,
	type SettingSearchItem,
	type SettingsContentFilter,
	type SettingsQuickFilter,
	getSettingById,
	getSettingDomId,
	getSettingFromUrl,
	getTabFromUrl,
	getVisibleSettingIds,
	isValidCategory,
	normalizeSettingsQuery,
	settingMatchesQuery,
	settingMatchesQuickFilter,
	updateUrlParam,
} from './constants'
import { IntegrationsContent } from './integrations-content'
import { FeaturesContent } from './features-content'
import { ContentTabContent } from './content-tab-content'
import { AdvancedContent } from './advanced-content'

// External imports for tabs that are not split
import { SettingsNavigation } from '../../components/settings'
import { ShortcutsContent } from '../shortcuts-view'

const QUICK_FILTERS: Array<{ id: SettingsQuickFilter; label: string; tooltip: string }> = [
	{ id: 'all', label: 'Todos', tooltip: 'Muestra todos los ajustes disponibles.' },
	{ id: 'enabled', label: 'Activos', tooltip: 'Muestra solo los ajustes que están activados ahora.' },
	{ id: 'disabled', label: 'Inactivos', tooltip: 'Muestra solo los ajustes que están desactivados ahora.' },
	{ id: 'reload', label: 'Recarga', tooltip: 'Muestra ajustes que necesitan recargar Mediavida para aplicarse.' },
	{ id: 'needs-setup', label: 'Configurar', tooltip: 'Muestra funciones activas que todavía necesitan una clave o servicio.' },
]

function settingNeedsSetup(setting: SettingSearchItem, settings: ReturnType<typeof useSettingsStore.getState>) {
	return setting.isEnabled?.(settings) === true && Boolean(setting.setupKey && !settings[setting.setupKey])
}

function quickFilterCountClass(isActive: boolean) {
	return cn(
		'h-5 shrink-0 rounded-md border px-1.5 text-[10px]',
		isActive
			? 'border-primary/40 bg-primary text-primary-foreground shadow-sm'
			: 'border-border/70 bg-muted/60 text-muted-foreground'
	)
}

export function SettingsView() {
	const settingsStore = useSettingsStore()
	const { settingsActiveTab, setSettingsActiveTab } = settingsStore
	const [searchQuery, setSearchQuery] = useState('')
	const [quickFilter, setQuickFilter] = useState<SettingsQuickFilter>('all')
	const [selectedSettingId, setSelectedSettingId] = useState(() => getSettingFromUrl())

	const visibleSettingIds = useMemo(
		() => getVisibleSettingIds(settingsStore, searchQuery, quickFilter),
		[settingsStore, searchQuery, quickFilter]
	)
	const selectedSetting = getSettingById(selectedSettingId)
	const highlightedSettingId =
		selectedSetting && (!visibleSettingIds || visibleSettingIds.has(selectedSetting.id)) ? selectedSetting.id : null
	const settingFilter = useMemo<SettingsContentFilter>(
		() => ({ visibleSettingIds, highlightedSettingId }),
		[visibleSettingIds, highlightedSettingId]
	)
	const hasActiveFinder = visibleSettingIds !== null
	const matchingSettings = useMemo(
		() => (visibleSettingIds ? SETTINGS_SEARCH_INDEX.filter(setting => visibleSettingIds.has(setting.id)) : []),
		[visibleSettingIds]
	)

	// Determine active tab: selected setting > URL > store. When filtering, jump to the first section with matches.
	const urlTab = getTabFromUrl()
	const requestedTab = (highlightedSettingId
		? selectedSetting?.category
		: urlTab ?? (isValidCategory(settingsActiveTab) ? settingsActiveTab : 'integrations')) as CategoryId
	const firstMatchingCategory = matchingSettings[0]?.category
	const activeTab = (hasActiveFinder &&
		matchingSettings.length > 0 &&
		!matchingSettings.some(setting => setting.category === requestedTab)
		? firstMatchingCategory
		: requestedTab) as CategoryId
	const activeTabHasMatches = !hasActiveFinder || matchingSettings.some(setting => setting.category === activeTab)
	const categoryMatchCounts = useMemo(() => {
		const counts = new Map<CategoryId, number>()
		for (const setting of matchingSettings) {
			counts.set(setting.category, (counts.get(setting.category) ?? 0) + 1)
		}
		return counts
	}, [matchingSettings])

	// Sync URL on mount if store has a value but URL doesn't
	useEffect(() => {
		if (!urlTab && !selectedSetting && isValidCategory(settingsActiveTab)) {
			updateUrlParam(settingsActiveTab as CategoryId)
		}
	}, [])

	useEffect(() => {
		if (!highlightedSettingId) return

		const timeout = window.setTimeout(() => {
			document.getElementById(getSettingDomId(highlightedSettingId))?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			})
		}, 80)

		return () => window.clearTimeout(timeout)
	}, [activeTab, highlightedSettingId])

	// Handle tab change
	const handleTabChange = (tabId: CategoryId) => {
		setSettingsActiveTab(tabId)
		setSelectedSettingId(null)
		updateUrlParam(tabId)
	}

	const handleNavigateToSetting = (settingId: string) => {
		const setting = getSettingById(settingId)
		if (!setting) return
		setSelectedSettingId(setting.id)
		updateUrlParam(setting.category, setting.id)
	}

	const clearFinder = () => {
		setSearchQuery('')
		setQuickFilter('all')
	}

	const queryForCount = normalizeSettingsQuery(searchQuery)
	const quickFilterCount = (filter: SettingsQuickFilter) =>
		SETTINGS_SEARCH_INDEX.filter(setting => settingMatchesQuickFilter(setting, filter, settingsStore)).filter(setting =>
			settingMatchesQuery(setting, queryForCount)
		).length

	return (
		<div className="space-y-6 pb-20">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
				<p className="text-muted-foreground mt-1">Configura todas las opciones de la extensión MVP.</p>
			</div>

			{/* Main Layout: Sidebar + Content */}
			<div className="flex flex-col gap-8 lg:flex-row">
				{/* Sidebar Navigation */}
				<nav className="w-full shrink-0 lg:w-64">
					<div className="sticky top-4 space-y-4">
						<div className="space-y-3 border-b border-border/70 pb-4">
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={searchQuery}
									onChange={event => {
										setSearchQuery(event.target.value)
										setSelectedSettingId(null)
									}}
									placeholder="Buscar ajustes..."
									className="h-9 pl-9 pr-9"
								/>
								{searchQuery && (
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="absolute right-0.5 top-1/2 -translate-y-1/2"
										onClick={() => setSearchQuery('')}
										aria-label="Limpiar búsqueda"
									>
										<X className="h-4 w-4" />
									</Button>
								)}
							</div>

							<div className="grid grid-cols-2 gap-1.5">
								{QUICK_FILTERS.map(filter => {
									const count = quickFilterCount(filter.id)
									const isActiveFilter = quickFilter === filter.id
									return (
										<Tooltip key={filter.id}>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant={isActiveFilter ? 'secondary' : 'outline'}
													size="sm"
													className="h-8 justify-between gap-2 border px-2"
													onClick={() => {
														setQuickFilter(filter.id)
														setSelectedSettingId(null)
													}}
												>
													<span className="truncate">{filter.label}</span>
													<Badge variant="secondary" className={quickFilterCountClass(isActiveFilter)}>
														{count}
													</Badge>
												</Button>
											</TooltipTrigger>
											<TooltipContent side="top" sideOffset={6} className="max-w-56 text-pretty">
												{filter.tooltip}
											</TooltipContent>
										</Tooltip>
									)
								})}
							</div>

							{hasActiveFinder && (
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-2">
										<p className="text-xs font-semibold text-muted-foreground">
											{matchingSettings.length === 1
												? '1 ajuste'
												: `${matchingSettings.length} ajustes`}
										</p>
										<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFinder}>
											Limpiar
										</Button>
									</div>

									{matchingSettings.length > 0 ? (
										<div className="max-h-[260px] space-y-1 overflow-y-auto px-1 py-0.5">
											{matchingSettings.slice(0, 10).map(setting => (
												<SettingSearchResult
													key={setting.id}
													setting={setting}
													isSelected={highlightedSettingId === setting.id}
													needsSetup={settingNeedsSetup(setting, settingsStore)}
													onSelect={() => handleNavigateToSetting(setting.id)}
												/>
											))}
										</div>
									) : (
										<p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
											Sin coincidencias
										</p>
									)}
								</div>
							)}
						</div>

						<div className="space-y-1">
							{SETTINGS_CATEGORIES.map(category => {
								const matchCount = categoryMatchCounts.get(category.id) ?? 0
								const disabledByFilter = hasActiveFinder && matchCount === 0
								return (
									<Button
										key={category.id}
										variant={activeTab === category.id ? 'secondary' : 'ghost'}
										disabled={disabledByFilter}
										className={cn(
											'w-full justify-start gap-2 font-normal',
											activeTab === category.id
												? 'rounded-l-none border-l-4 !border-l-primary font-medium bg-accent text-accent-foreground'
												: 'hover:bg-accent/50',
											disabledByFilter && 'opacity-40'
										)}
										onClick={() => handleTabChange(category.id)}
									>
										<category.icon className="h-4 w-4" />
										<span className="min-w-0 flex-1 truncate text-left">{category.label}</span>
										{hasActiveFinder && (
											<Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">
												{matchCount}
											</Badge>
										)}
									</Button>
								)
							})}
						</div>
					</div>
				</nav>

				{/* Content Panel */}
				<main className="min-w-0 flex-1">
					<Card className="p-6">
						<div key={activeTab} className="animate-in fade-in duration-200">
							{activeTabHasMatches ? (
								<SettingsContent
									activeTab={activeTab}
									settingFilter={settingFilter}
									hasActiveFinder={hasActiveFinder}
								/>
							) : (
								<div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-center">
									<p className="text-sm font-semibold">No hay ajustes visibles en esta sección</p>
									<p className="mt-1 max-w-sm text-sm text-muted-foreground">
										Cambia de sección desde la izquierda o limpia los filtros para volver a ver todos los ajustes.
									</p>
								</div>
							)}
						</div>
					</Card>
				</main>
			</div>

			{/* Footer */}
			<div className="flex items-center justify-center pt-4 border-t">
				<div className="text-sm text-muted-foreground">
					<Badge variant="secondary" className="mr-2">
						v{browser.runtime.getManifest().version}
					</Badge>
					MVP Extension
				</div>
			</div>
		</div>
	)
}

function SettingSearchResult({
	setting,
	isSelected,
	needsSetup,
	onSelect,
}: {
	setting: SettingSearchItem
	isSelected: boolean
	needsSetup: boolean
	onSelect: () => void
}) {
	const category = SETTINGS_CATEGORIES.find(item => item.id === setting.category)

	return (
		<button
			type="button"
			aria-pressed={isSelected}
			className={cn(
				'w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:border-border/70 hover:bg-accent/50',
				isSelected ? 'border-primary/70 bg-primary/10 text-primary shadow-sm' : 'border-transparent'
			)}
			onClick={onSelect}
		>
			<div className="flex min-w-0 items-center gap-2">
				{category && <category.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
				<span className="min-w-0 flex-1 truncate text-xs font-semibold">{setting.label}</span>
				{needsSetup && (
					<Badge variant="destructive" className="h-4 shrink-0 rounded px-1 text-[9px]">
						Config.
					</Badge>
				)}
				{setting.requiresReload && (
					<Badge variant="outline" className="h-4 shrink-0 rounded px-1 text-[9px]">
						Rec.
					</Badge>
				)}
			</div>
			<div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
				<span className="truncate">{category?.label}</span>
				{setting.section && (
					<>
						<span>/</span>
						<span className="truncate">{setting.section}</span>
					</>
				)}
			</div>
		</button>
	)
}

// Content Router
function SettingsContent({
	activeTab,
	settingFilter,
	hasActiveFinder,
}: {
	activeTab: CategoryId
	settingFilter: SettingsContentFilter
	hasActiveFinder: boolean
}) {
	switch (activeTab) {
		case 'integrations':
			return <IntegrationsContent settingFilter={settingFilter} />
		case 'features':
			return <FeaturesContent settingFilter={settingFilter} />
		case 'navigation':
			return <SettingsNavigation settingFilter={settingFilter} />
		case 'content':
			return <ContentTabContent settingFilter={settingFilter} />
		case 'shortcuts':
			return <ShortcutsContent />
		case 'advanced':
			return <AdvancedContent settingFilter={settingFilter} hasActiveFinder={hasActiveFinder} />
		default:
			return null
	}
}
