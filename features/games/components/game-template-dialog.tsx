/**
 * Game Template Dialog
 *
 * A dialog for searching games on IGDB and generating BBCode templates.
 * Uses shared MediaSearchDialog components for consistent UI.
 */

import { useReducer, useEffect, useRef } from 'react'
import Search from 'lucide-react/dist/esm/icons/search'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import {
	generateGameTemplate,
	generateMobileStoresMediaTemplate,
	generateSteamMediaTemplate,
	getIGDBImageUrl,
	IGDB_MOBILE_PLATFORM_IDS,
	type GameTemplateType,
} from '@/services/api/igdb'
import { browser } from 'wxt/browser'
import type { IGDBGame } from '@/services/api/igdb'
import type { GameTemplateDataInput } from '@/types/templates'
import { cn } from '@/lib/utils'
import { useGameSearch, useGameTemplateDataWithProgress, useIgdbCredentials } from '../hooks/use-igdb'
import { useDebounce } from 'use-debounce'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
	MediaDialogShell,
	MediaSearchInput,
	MediaEmptyState,
	MediaSearchError,
	MediaPreviewStep,
	MediaDialogActions,
} from '@/components/media-search-dialog'

interface GameTemplateDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (template: string) => void
}

// =============================================================================
// State management
// =============================================================================

interface DialogState {
	step: 'search' | 'preview'
	searchQuery: string
	selectedId: number | null
	selectedGame: IGDBGame | null
	templateData: GameTemplateDataInput | null
	template: string
	templateType: GameTemplateType
	error: string | null
	copied: boolean
	isEditing: boolean
}

type DialogAction =
	| { type: 'SELECT_GAME'; game: IGDBGame }
	| { type: 'DATA_LOADED'; data: GameTemplateDataInput; template: string }
	| { type: 'SET_SEARCH_QUERY'; query: string }
	| { type: 'SET_TEMPLATE_TYPE'; templateType: GameTemplateType }
	| { type: 'SET_ERROR'; error: string | null }
	| { type: 'SET_TEMPLATE'; template: string }
	| { type: 'SET_COPIED'; copied: boolean }
	| { type: 'TOGGLE_EDITING' }
	| { type: 'BACK' }
	| { type: 'RESET'; templateType: GameTemplateType }

const initialState: DialogState = {
	step: 'search',
	searchQuery: '',
	selectedId: null,
	selectedGame: null,
	templateData: null,
	template: '',
	templateType: 'game',
	error: null,
	copied: false,
	isEditing: false,
}

/**
 * Inside the Juegos de móvil subforum the mobile template is the sensible default.
 */
function getDefaultGameTemplateType(): GameTemplateType {
	return window.location.pathname.startsWith('/foro/juegos-movil') ? 'mobile-game' : 'game'
}

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
	switch (action.type) {
		case 'SELECT_GAME':
			return { ...state, selectedGame: action.game, selectedId: action.game.id, error: null }
		case 'DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
		case 'SET_SEARCH_QUERY':
			return { ...state, searchQuery: action.query }
		case 'SET_TEMPLATE_TYPE':
			return { ...state, templateType: action.templateType }
		case 'SET_ERROR':
			return { ...state, error: action.error }
		case 'SET_TEMPLATE':
			return { ...state, template: action.template }
		case 'SET_COPIED':
			return { ...state, copied: action.copied }
		case 'TOGGLE_EDITING':
			return { ...state, isEditing: !state.isEditing }
		case 'BACK':
			return { ...state, selectedGame: null, templateData: null, template: '', isEditing: false, step: 'search' }
		case 'RESET':
			return { ...initialState, templateType: action.templateType }
	}
}

export function GameTemplateDialog({ isOpen, onClose, onInsert }: GameTemplateDialogProps) {
	const [state, dispatch] = useReducer(dialogReducer, initialState)
	const { step, searchQuery, selectedId, selectedGame, templateData, template, templateType, error, copied, isEditing } =
		state

	const searchInputRef = useRef<HTMLInputElement>(null)

	// Debounce search query
	const [debouncedQuery] = useDebounce(searchQuery, 400)

	// Check if credentials are configured
	const { data: hasCredentials, isLoading: isCheckingCredentials } = useIgdbCredentials()

	// Game search hook. In mobile mode only games available on Android/iOS
	// make sense (multi-platform is fine, console/PC-only is not).
	const {
		data: searchResults = [],
		isLoading: isSearching,
		error: searchError,
	} = useGameSearch(
		debouncedQuery,
		isOpen && !!hasCredentials,
		templateType === 'mobile-game' ? IGDB_MOBILE_PLATFORM_IDS : undefined
	)

	// Game template data hook (with step-by-step loading progress)
	const { data: fetchedGameData, isLoading: isLoadingDetails, loadingStep } = useGameTemplateDataWithProgress(
		selectedId ?? 0,
		selectedId !== null
	)

	// Process game data when it loads
	useEffect(() => {
		if (fetchedGameData && selectedId !== null) {
			dispatch({
				type: 'DATA_LOADED',
				data: fetchedGameData,
				template: generateGameTemplate(fetchedGameData, templateType),
			})
		}
	}, [fetchedGameData, selectedId, templateType])

	// Handle search error
	useEffect(() => {
		if (searchError) {
			dispatch({ type: 'SET_ERROR', error: searchError instanceof Error ? searchError.message : 'Error en la búsqueda' })
		} else {
			dispatch({ type: 'SET_ERROR', error: null })
		}
	}, [searchError])

	// Focus search input when dialog opens
	useEffect(() => {
		if (isOpen && hasCredentials) {
			dispatch({ type: 'RESET', templateType: getDefaultGameTemplateType() })
			setTimeout(() => searchInputRef.current?.focus(), 100)
		}
	}, [isOpen, hasCredentials])

	const handleClose = () => {
		dispatch({ type: 'RESET', templateType: getDefaultGameTemplateType() })
		onClose()
	}

	const handleCopy = async () => {
		await navigator.clipboard.writeText(template)
		dispatch({ type: 'SET_COPIED', copied: true })
		setTimeout(() => dispatch({ type: 'SET_COPIED', copied: false }), 2000)
	}

	const handleInsert = () => {
		onInsert(template)
		handleClose()
	}

	const handleInsertStoreMedia = () => {
		if (!templateData) return
		const storeMediaTemplate =
			templateType === 'mobile-game'
				? generateMobileStoresMediaTemplate(templateData)
				: generateSteamMediaTemplate(templateData)
		if (!storeMediaTemplate) return

		onInsert(storeMediaTemplate)
		handleClose()
	}

	const hasStoreMedia =
		templateType === 'mobile-game'
			? Boolean(templateData?.googlePlayUrl || templateData?.appStoreUrl)
			: Boolean(templateData?.steamStoreUrl)

	// Get title for dialog header
	const getDialogTitle = () => {
		if (isCheckingCredentials) return 'Cargando...'
		if (!hasCredentials) return 'Buscar videojuego'
		if (step === 'search') return 'Buscar videojuego'
		return templateData?.name || 'Vista previa'
	}

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={handleClose}
			icon={<Gamepad2 className="h-4 w-4" />}
			title={getDialogTitle()}
			height={!hasCredentials && !isCheckingCredentials ? 'auto' : 620}
			footer={
				step === 'preview' && hasCredentials ? (
					<MediaDialogActions
						onBack={() => dispatch({ type: 'BACK' })}
						backLabel="← Buscar otro"
						onCopy={handleCopy}
						copied={copied}
						secondaryInsertLabel={templateType === 'mobile-game' ? 'Media Stores' : 'Media Steam'}
						onSecondaryInsert={handleInsertStoreMedia}
						secondaryInsertDisabled={!hasStoreMedia}
						secondaryInsertTitle={
							templateType === 'mobile-game'
								? hasStoreMedia
									? 'Insertar [media] con las tarjetas de Google Play / App Store'
									: 'No se han encontrado enlaces de Google Play ni App Store para este juego'
								: hasStoreMedia
									? 'Insertar [media] con la URL de Steam'
									: 'No se ha encontrado enlace de Steam para este juego'
						}
						onInsert={handleInsert}
					/>
				) : undefined
			}
		>
			{/* Loading Credentials State */}
			{isCheckingCredentials ? (
				<div className="flex h-full flex-1 items-center justify-center">
					<Loader2 className="w-6 h-6 animate-spin text-primary" />
				</div>
			) : !hasCredentials ? (
				<div className="flex flex-col items-center text-center gap-4 py-8">
					<div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
						<AlertCircle className="w-6 h-6 text-destructive" />
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-foreground">Servicio no disponible</h3>
						<p className="text-sm text-muted-foreground max-w-[360px]">
							La búsqueda de videojuegos no está disponible en este momento. Inténtalo de nuevo más tarde.
						</p>
					</div>
				</div>
			) : (
				<>
					{/* Search Step */}
					{step === 'search' && (
						<div className="flex min-h-full flex-col">
							{/* Template type toggle (mirrors the movie dialog media-type toggle) */}
							<div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
								{([
									{ type: 'game' as const, label: 'Videojuegos', icon: <Gamepad2 className="h-4 w-4" /> },
									{ type: 'mobile-game' as const, label: 'Juegos de móvil', icon: <Smartphone className="h-4 w-4" /> },
								]).map(item => (
									<button
										key={item.type}
										onClick={() => dispatch({ type: 'SET_TEMPLATE_TYPE', templateType: item.type })}
										className={cn(
											'flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border-none px-1.5 h-10 text-[11px] font-medium transition-all',
											templateType === item.type
												? 'bg-primary text-primary-foreground shadow-sm'
												: 'bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
										)}
									>
										<span className="shrink-0">{item.icon}</span>
										<span className="shrink-0 whitespace-nowrap">{item.label}</span>
										<span
											className={cn(
												'shrink-0 rounded-sm border px-1 py-0.5 font-mono text-[7px] uppercase leading-none',
												templateType === item.type
													? 'border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground/80'
													: 'border-border bg-background/70 text-muted-foreground/70'
											)}
										>
											IGDB
										</span>
									</button>
								))}
							</div>

							<div className="mb-4 rounded-lg border border-border bg-gradient-to-r from-primary/10 via-muted/15 to-background p-4">
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary shadow-sm">
										<Sparkles className="h-4 w-4" />
									</div>
									<div className="min-w-0">
										<p className="text-xs font-semibold uppercase text-primary">Plantillas IGDB</p>
										<p className="truncate text-sm text-muted-foreground">Resultados enriquecidos para insertar fichas listas en el editor</p>
									</div>
								</div>
							</div>

							<MediaSearchInput
								ref={searchInputRef}
								value={searchQuery}
								onChange={q => dispatch({ type: 'SET_SEARCH_QUERY', query: q })}
								placeholder="Buscar videojuego por nombre..."
								isSearching={isSearching}
							/>

							{error && <MediaSearchError error={error} />}

							{searchResults.length > 0 && (
								<div className="mb-4 overflow-hidden rounded-lg border border-border bg-muted/15">
									<div className="flex items-center justify-between border-b border-border bg-background/70 px-3 py-2">
										<span className="text-xs font-semibold uppercase text-muted-foreground">Resultados</span>
										<Badge variant="secondary">{searchResults.length}</Badge>
									</div>
									<ScrollArea className="h-[330px] pr-3">
										<div className="space-y-2 overflow-x-hidden p-2 pr-1">
											{searchResults.map(game => {
												const isRowLoading = isLoadingDetails && selectedGame?.id === game.id
												const year = game.first_release_date
													? new Date(game.first_release_date * 1000).getFullYear().toString()
													: 'TBA'
												const platforms = game.platforms?.map((p: { abbreviation?: string; name: string }) => p.abbreviation || p.name) ?? []
												const visiblePlatforms = platforms.slice(0, 3)
												const extraPlatforms = platforms.length - visiblePlatforms.length

												return (
														<button
															key={game.id}
															onClick={() => dispatch({ type: 'SELECT_GAME', game })}
															disabled={isLoadingDetails}
																className="group w-full overflow-hidden rounded-lg border border-transparent bg-background/60 px-3 py-3 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-70"
															>
															<div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
															{game.cover?.image_id ? (
																<img
																	src={getIGDBImageUrl(game.cover.image_id, 'cover_small')}
																	alt={game.name}
																	referrerPolicy="no-referrer"
																	className="h-[72px] w-[52px] shrink-0 rounded-md border border-border bg-muted object-cover shadow-sm"
																/>
															) : (
																	<div className="flex h-[72px] w-[52px] shrink-0 items-center justify-center rounded-md border border-border bg-muted">
																		<Gamepad2 className="w-4 h-4 text-muted-foreground" />
																	</div>
															)}
																<div className="min-w-0 overflow-hidden">
																	<div className="block max-w-full truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
																		{game.name}
																	</div>
																{isRowLoading ? (
																	<div className="mt-1 truncate text-xs text-muted-foreground">
																		{loadingStep === 'igdb'
																			? 'Obteniendo datos de IGDB...'
																			: loadingStep === 'steam'
																				? 'Enriqueciendo con Steam...'
																				: 'Cargando...'}
																	</div>
																) : (
																		<div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
																					<span className="inline-flex items-center gap-1 rounded-md border border-border bg-popover px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
																						<CalendarDays className="h-3 w-3" />
																						{year}
																					</span>
																					<span className="inline-flex max-w-full min-w-0 items-center truncate rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
																						{visiblePlatforms.length > 0 ? visiblePlatforms.join(', ') : 'Plataforma ?'}
																						{extraPlatforms > 0 ? ` +${extraPlatforms}` : ''}
																					</span>
																	</div>
																)}
															</div>
															{isRowLoading && (
																<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
															)}
															{!isRowLoading && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
														</div>
													</button>
												)
											})}
										</div>
									</ScrollArea>
								</div>
							)}

							{searchQuery && !isSearching && searchResults.length === 0 && !error && (
								<MediaEmptyState
									icon={<Gamepad2 className="w-6 h-6 text-muted-foreground" />}
									text="No se encontraron videojuegos"
									className="mb-4 min-h-[224px] flex-1"
								/>
							)}

							{!searchQuery && searchResults.length === 0 && (
								<MediaEmptyState
									icon={<Search className="w-6 h-6 text-muted-foreground" />}
									text="Escribe para buscar videojuegos"
									className="mb-4 min-h-[224px] flex-1"
								/>
							)}

							{/* IGDB Attribution */}
							<div className="mt-auto mb-0 flex flex-col items-center gap-1.5 border-t border-border/70 pt-4 opacity-60 transition-opacity hover:opacity-100">
								<a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="block mb-1">
									<span className="text-sm font-bold text-foreground">IGDB</span>
								</a>
								<p className="text-[10px] text-center text-muted-foreground m-0 max-w-[280px] leading-tight">
									Datos proporcionados por IGDB.com
								</p>
							</div>
						</div>
					)}

					{/* Preview Step */}
					{step === 'preview' && template && templateData && (
						<MediaPreviewStep
							coverUrl={templateData.coverUrl}
							coverHeight={100}
							previewInfo={
								<>
									<div className="mb-1.5 truncate text-base font-semibold text-foreground">
										{templateData.name}
									</div>
									<div className="mb-1 truncate text-xs text-muted-foreground">
										{templateData.releaseYear || '—'} · {templateData.developers.join(', ') || 'Desarrollador desconocido'}
									</div>
									<div className="truncate text-xs text-muted-foreground/80">
										{templateData.platforms.slice(0, 4).join(', ')}
									</div>
								</>
							}
							onCustomize={() => {
								browser.tabs.create({
									url: browser.runtime.getURL(`/options.html#/templates?tab=media&type=${templateType}`),
								})
							}}
							template={template}
							onTemplateChange={t => dispatch({ type: 'SET_TEMPLATE', template: t })}
							isEditing={isEditing}
							onToggleEditing={() => dispatch({ type: 'TOGGLE_EDITING' })}
							referrerPolicy="no-referrer"
						/>
					)}
				</>
			)}
		</MediaDialogShell>
	)
}
