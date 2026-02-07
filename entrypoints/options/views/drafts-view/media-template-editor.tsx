/**
 * MediaTemplateEditor - Full Page Editor for Media Templates
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import Save from 'lucide-react/dist/esm/icons/save'

import Check from 'lucide-react/dist/esm/icons/check'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import FileDown from 'lucide-react/dist/esm/icons/file-down'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Ellipsis from 'lucide-react/dist/esm/icons/ellipsis'
import PanelRight from 'lucide-react/dist/esm/icons/panel-right'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'

import { VariablesSidebar } from './components/variables-sidebar'
import { useSettingsStore } from '@/store/settings-store'
import { useTheme } from '@/providers/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { SharedEditorToolbar } from '@/components/editor'
import { cn } from '@/lib/utils'
import { getIGDBImageUrl } from '@/services/api/igdb'
import type { TMDBMovie, TMDBTVShow } from '@/services/api/tmdb'
import { getPosterUrl } from '@/services/api/tmdb'

import {
	getFieldsForType,
	TVSHOW_FIELDS,
	SEASON_FIELDS,
	type TemplateType,
	type MediaTemplate,
	type TemplateDataInput,
} from '@/types/templates'
import { createEmptyTemplate, createRawBlock, renderTemplate, defaultTemplateToRawBBCode } from '@/lib/template-engine'
import { getDefaultTemplate } from '@/features/templates'

import { PreviewPanel } from '../draft-editor/preview-panel'
import { EditorFooter } from '../draft-editor/editor-footer'

// Dialogs
import { UrlDialog } from '@/features/editor/components/url-dialog'
import { PollCreatorDialog } from '@/features/editor/components/poll-creator-dialog'
import { TableEditorDialog } from '@/features/table-editor/components/table-editor-dialog'
import { IndexCreatorDialog } from '@/features/editor/components/index-creator-dialog'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Refactored Hooks & Utils
import { useGameSelection } from './hooks/use-game-selection'
import { useTmdbSelection } from './hooks/use-tmdb-selection'
import { generatePlaceholderData } from './utils/placeholders'
import { useFullPageEditor } from '@/hooks/use-full-page-editor'
import { FullPageEditorLayout } from '@/components/layouts/full-page-editor-layout'
import { SharedEditorStack } from '@/components/editor/shared-editor-stack'
import { DEFAULT_TOOLBAR_BUTTONS } from '@/types/editor'

const MEDIA_TYPES: { value: TemplateType; label: string; tooltip: string }[] = [
	{ value: 'movie', label: 'Películas', tooltip: 'Plantilla para fichas de películas (busca en TMDB)' },
	{
		value: 'tvshow',
		label: 'Series completas',
		tooltip: 'Plantilla para fichas de series completas con todas sus temporadas (busca en TMDB)',
	},
	{
		value: 'season',
		label: 'Temporadas',
		tooltip: 'Plantilla para fichas de una temporada específica de una serie (busca en TMDB)',
	},
	{ value: 'game', label: 'Videojuegos', tooltip: 'Plantilla para fichas de videojuegos (busca en IGDB)' },
]

export function MediaTemplateEditor() {
	const navigate = useNavigate()
	const [searchParams, setSearchParams] = useSearchParams()
	const { theme } = useTheme()

	// Current media type from URL
	const currentType = (searchParams.get('type') as TemplateType) || 'movie'
	const validTypes: TemplateType[] = ['movie', 'tvshow', 'season', 'game']
	const mediaType = validTypes.includes(currentType) ? currentType : 'movie'

	// Settings
	const { mediaTemplates, setSetting, boldColor } = useSettingsStore()

	// Content state
	const [content, setContent] = useState('')
	const [previewData, setPreviewData] = useState<TemplateDataInput | null>(() => generatePlaceholderData(mediaType))
	const [isDirty, setIsDirty] = useState(false)
	const [showPreview, setShowPreview] = useState(true)

	// Refactored Hooks
	const gameSelection = useGameSelection({
		mediaType,
		onPreviewDataChange: setPreviewData,
	})

	const tmdbSelection = useTmdbSelection({
		mediaType,
		onPreviewDataChange: setPreviewData,
	})

	// Refactored Editor Hook
	const { editor, handlers, upload, dialogs, refs, state, actions } = useFullPageEditor({
		value: content,
		onChange: newContent => {
			setContent(newContent)
			setIsDirty(true)
		},
	})

	// UI state
	const [isVariablesOpen, setIsVariablesOpen] = useState(false)
	const hasLoadedRef = useRef(false)
	const searchContainerRef = useRef<HTMLDivElement>(null)
	const prevMediaTypeRef = useRef(mediaType)

	// Whether current type has a saved custom template
	const hasCustomTemplate = !!(mediaTemplates && mediaTemplates[mediaType])

	// Close search dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
				gameSelection.setShowSearchResults(false)
				tmdbSelection.setShowSearchResults(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [gameSelection, tmdbSelection])

	// Load template content and handle Media Type changes
	useEffect(() => {
		// Detect media type change
		if (prevMediaTypeRef.current !== mediaType) {
			hasLoadedRef.current = false
			prevMediaTypeRef.current = mediaType

			// Reset search states via hooks
			tmdbSelection.resetState()
			gameSelection.resetState()

			setPreviewData(generatePlaceholderData(mediaType))
			setIsDirty(false)
		}

		// Don't overwrite if we've already loaded (e.g. after a save)
		if (hasLoadedRef.current) return

		// If settings are not loaded yet, wait
		if (!mediaTemplates) return

		const template = mediaTemplates[mediaType]

		let newContent: string
		if (template && template.blocks.length > 0) {
			// Custom template saved — load the raw BBCode
			const rawBlock = template.blocks.find(b => b.type === 'raw')
			if (rawBlock && rawBlock.type === 'raw') {
				newContent = rawBlock.rawText
			} else {
				// Saved template has non-raw blocks — convert default to raw BBCode
				newContent = defaultTemplateToRawBBCode(template)
			}
		} else {
			// No custom template — load the default as editable raw BBCode
			const defaultTemplate = getDefaultTemplate(mediaType)
			newContent = defaultTemplateToRawBBCode(defaultTemplate)
		}

		setContent(newContent)
		// No need to sync refs manually anymore, hook handles it via value prop

		// Set placeholder preview data on first load (no real media selected yet)
		setPreviewData(generatePlaceholderData(mediaType))

		hasLoadedRef.current = true
	}, [mediaType, mediaTemplates, tmdbSelection, gameSelection])

	// Handle tab change
	const handleTabChange = (val: string) => {
		setSearchParams(prev => {
			prev.set('type', val)
			return prev
		})
	}

	// Insert variable placeholder (unique to this editor)
	const insertVariable = useCallback(
		(key: string) => {
			const placeholder = `{{${key}}}`
			editor.insertAtCursor(placeholder)
			setIsDirty(true)
		},
		[editor]
	)

	// Handle save
	const handleSave = useCallback(() => {
		const newTemplate: MediaTemplate = createEmptyTemplate(mediaType, `Plantilla Personalizada (${mediaType})`)
		newTemplate.blocks = [createRawBlock(content)]

		const currentTemplates = mediaTemplates || { movie: null, tvshow: null, season: null, game: null }
		const updatedTemplates = {
			...currentTemplates,
			[mediaType]: newTemplate,
		}

		setSetting('mediaTemplates', updatedTemplates)
		setIsDirty(false)
		toast.success(`Plantilla de ${getTypeName(mediaType)} guardada`)
	}, [content, mediaType, mediaTemplates, setSetting])

	// Handle reset — removes custom template, restores default
	const handleReset = () => {
		if (hasCustomTemplate) {
			dialogs.open('clear')
		}
	}

	// Handle clear confirm — removes custom template from store and loads default
	const handleClearConfirm = () => {
		// Remove the custom template from settings
		const currentTemplates = mediaTemplates || { movie: null, tvshow: null, season: null, game: null }
		const updatedTemplates = {
			...currentTemplates,
			[mediaType]: null,
		}
		setSetting('mediaTemplates', updatedTemplates)

		// Load the default template as raw BBCode
		const defaultTemplate = getDefaultTemplate(mediaType)
		const rawBBCode = defaultTemplateToRawBBCode(defaultTemplate)
		setContent(rawBBCode)
		// Hook handles ref syncing via useEffect on value change

		setIsDirty(false)
		dialogs.close()
		toast.success(`Plantilla de ${getTypeName(mediaType)} restablecida a la versión por defecto`)
	}

	// Handle load default template as base
	const handleLoadDefault = useCallback(() => {
		const defaultTemplate = getDefaultTemplate(mediaType)
		const rawBBCode = defaultTemplateToRawBBCode(defaultTemplate)
		setContent(rawBBCode)
		// Hook handles ref syncing

		setIsDirty(true)
		toast.success('Plantilla por defecto cargada como base')
	}, [mediaType])

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault()
				if (content.trim()) {
					handleSave()
				}
			}

			if (e.key === 'Escape') {
				if (dialogs.isOpen('dropzone') && upload.isUploading) {
					return
				}
				if (dialogs.activeDialog) {
					dialogs.close()
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [content, dialogs, upload.isUploading, handleSave])

	// Get fields for current type
	const fields = getFieldsForType(mediaType)
	const variableGroups = useMemo(() => {
		if (mediaType !== 'tvshow' && mediaType !== 'season') return null
		const tvKeys = new Set(TVSHOW_FIELDS.map(field => field.key))
		const seasonKeys = new Set(SEASON_FIELDS.map(field => field.key))
		const commonKeys = new Set([...tvKeys].filter(key => seasonKeys.has(key)))
		const commonFields = fields.filter(field => commonKeys.has(field.key))
		const exclusiveFields = fields.filter(field => !commonKeys.has(field.key))

		if (mediaType === 'tvshow') {
			return [
				{ id: 'tv-common', label: 'Comunes', fields: commonFields },
				{ id: 'tv-only', label: 'Solo Series', fields: exclusiveFields },
			]
		}

		return [
			{ id: 'season-common', label: 'Comunes', fields: commonFields },
			{ id: 'season-only', label: 'Solo Temporadas', fields: exclusiveFields },
		]
	}, [mediaType, fields])

	// Render preview with current data (real media or placeholder with {{variables}})
	const renderedPreview = previewData
		? renderTemplate(
				{
					id: 'preview',
					type: mediaType,
					name: 'Preview',
					blocks: [{ id: '1', type: 'raw', rawText: content }],
				},
				previewData
		  )
		: content

	const previewContent = renderedPreview.trim().length > 0 ? renderedPreview : content

	return (
		<>
			<FullPageEditorLayout
				showPreview={showPreview}
				header={
					<div className="flex flex-wrap items-center gap-3 w-full">
						{/* Back button */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={() => navigate('/templates')} className="shrink-0 h-8 w-8">
									<ChevronLeft className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">Volver a plantillas</TooltipContent>
						</Tooltip>

						{/* Media type tabs */}
						<Tabs value={mediaType} onValueChange={handleTabChange}>
							<TabsList className="bg-transparent h-9 p-0 gap-1.5">
								{MEDIA_TYPES.map(type => {
									const isCustom = !!(mediaTemplates && mediaTemplates[type.value])
									return (
										<Tooltip key={type.value}>
											<TooltipTrigger asChild>
												<div className="relative">
													<TabsTrigger
														value={type.value}
														className="relative px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border/50 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:border-primary/20"
													>
														{type.label}
														{isCustom && (
															<span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 z-10">
																<span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
															</span>
														)}
													</TabsTrigger>
												</div>
											</TooltipTrigger>
											<TooltipContent side="bottom" sideOffset={10}>
												<div className="flex flex-col gap-1">
													<p className="font-medium text-sm">{type.label}</p>
													<p className="text-xs text-muted-foreground leading-tight max-w-[200px]">
														{type.tooltip}
														{isCustom && (
															<span className="block mt-1 text-primary font-medium">
																· Plantilla personalizada guardada
															</span>
														)}
													</p>
												</div>
											</TooltipContent>
										</Tooltip>
									)
								})}
							</TabsList>
						</Tabs>

						<div className="w-px h-6 bg-border shrink-0" />

						{/* Search Bar */}
						{mediaType !== 'game' ? (
							<div ref={searchContainerRef} className="relative flex-1 min-w-[240px] max-w-sm group">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
								<Input
									placeholder={mediaType === 'movie' ? 'Buscar película...' : 'Buscar serie...'}
									value={tmdbSelection.tmdbSearchQuery}
									onChange={e => {
										tmdbSelection.setTmdbSearchQuery(e.target.value)
										tmdbSelection.setShowSearchResults(true)
									}}
									onFocus={() => tmdbSelection.setShowSearchResults(true)}
									className="pl-9 pr-9 h-8 text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
								/>
								{tmdbSelection.tmdbSearchQuery && (
									<button
										type="button"
										onClick={() => {
											tmdbSelection.setTmdbSearchQuery('')
											tmdbSelection.setShowSearchResults(false)
										}}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								)}
								{(tmdbSelection.isSearchingMovies || tmdbSelection.isSearchingTV) &&
									tmdbSelection.debouncedTmdbQuery.trim().length >= 2 && (
										<div className="absolute right-9 top-1/2 -translate-y-1/2">
											<div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
										</div>
									)}

								{/* Movie search results */}
								{tmdbSelection.showSearchResults &&
									mediaType === 'movie' &&
									tmdbSelection.debouncedTmdbQuery.trim().length >= 2 && (
										<div className="absolute left-0 right-0 top-full mt-2 border border-border/60 rounded-lg bg-popover/95 backdrop-blur-md shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
											{tmdbSelection.isSearchingMovies ? (
												<div className="px-3 py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
													<Loader2 className="h-3 w-3 animate-spin" /> Buscando...
												</div>
											) : tmdbSelection.movieResults.length === 0 ? (
												<div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
													Sin resultados para «{tmdbSelection.debouncedTmdbQuery}»
												</div>
											) : (
												<div className="max-h-80 overflow-y-auto py-1 custom-scrollbar">
													{tmdbSelection.movieResults.map((movie: TMDBMovie) => (
														<button
															key={movie.id}
															type="button"
															onClick={() => tmdbSelection.handleSelectMovie(movie.id, movie.title)}
															className="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors border-b border-border/20 last:border-0"
														>
															<div className="flex items-center gap-3">
																{movie.poster_path ? (
																	<img
																		src={getPosterUrl(movie.poster_path, 'w92') ?? ''}
																		alt={movie.title}
																		className="w-10 h-14 rounded-md object-cover shrink-0 shadow-sm border border-border/10"
																	/>
																) : (
																	<div className="w-10 h-14 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/10">
																		<Search className="h-4 w-4 text-muted-foreground/40" />
																	</div>
																)}
																<div className="min-w-0 flex-1">
																	<span
																		className="text-sm font-semibold text-foreground block truncate"
																		title={movie.title}
																	>
																		{movie.title}
																	</span>
																	<div className="flex items-center gap-1.5 mt-0.5">
																		<span className="text-[10px] font-mono px-1.5 py-0 bg-muted text-muted-foreground rounded-sm tracking-tighter">
																			{movie.release_date?.split('-')[0] || 'TBA'}
																		</span>
																		{movie.vote_average > 0 && (
																			<span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
																				<div className="w-1 h-1 rounded-full bg-primary/40" />
																				{movie.vote_average.toFixed(1)}
																			</span>
																		)}
																		{movie.original_title !== movie.title && (
																			<span className="text-[10px] text-muted-foreground truncate opacity-70">
																				• {movie.original_title}
																			</span>
																		)}
																	</div>
																</div>
															</div>
														</button>
													))}
												</div>
											)}
										</div>
									)}

								{/* TV show search results */}
								{tmdbSelection.showSearchResults &&
									(mediaType === 'tvshow' || mediaType === 'season') &&
									tmdbSelection.debouncedTmdbQuery.trim().length >= 2 && (
										<div className="absolute left-0 right-0 top-full mt-2 border border-border/60 rounded-lg bg-popover/95 backdrop-blur-md shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
											{tmdbSelection.isSearchingTV ? (
												<div className="px-3 py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
													<Loader2 className="h-3 w-3 animate-spin" /> Buscando...
												</div>
											) : tmdbSelection.tvResults.length === 0 ? (
												<div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
													Sin resultados para «{tmdbSelection.debouncedTmdbQuery}»
												</div>
											) : (
												<div className="max-h-80 overflow-y-auto py-1 custom-scrollbar">
													{tmdbSelection.tvResults.map((show: TMDBTVShow) => (
														<button
															key={show.id}
															type="button"
															onClick={() => tmdbSelection.handleSelectTV(show.id, show.name)}
															className="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors border-b border-border/20 last:border-0"
														>
															<div className="flex items-center gap-3">
																{show.poster_path ? (
																	<img
																		src={getPosterUrl(show.poster_path, 'w92') ?? ''}
																		alt={show.name}
																		className="w-10 h-14 rounded-md object-cover shrink-0 shadow-sm border border-border/10"
																	/>
																) : (
																	<div className="w-10 h-14 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/10">
																		<Search className="h-4 w-4 text-muted-foreground/40" />
																	</div>
																)}
																<div className="min-w-0 flex-1">
																	<span
																		className="text-sm font-semibold text-foreground block truncate"
																		title={show.name}
																	>
																		{show.name}
																	</span>
																	<div className="flex items-center gap-1.5 mt-0.5">
																		<span className="text-[10px] font-mono px-1.5 py-0 bg-muted text-muted-foreground rounded-sm tracking-tighter">
																			{show.first_air_date?.split('-')[0] || 'TBA'}
																		</span>
																		{show.vote_average > 0 && (
																			<span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
																				<div className="w-1 h-1 rounded-full bg-primary/40" />
																				{show.vote_average.toFixed(1)}
																			</span>
																		)}
																		{show.original_name !== show.name && (
																			<span className="text-[10px] text-muted-foreground truncate opacity-70">
																				• {show.original_name}
																			</span>
																		)}
																	</div>
																</div>
															</div>
														</button>
													))}
												</div>
											)}
										</div>
									)}

								{/* Season picker */}
								{mediaType === 'season' &&
									tmdbSelection.tvDataForSeason &&
									tmdbSelection.tvDataForSeason.seasons.length > 0 &&
									!tmdbSelection.showSearchResults &&
									tmdbSelection.selectedSeasonNumber === null && (
										<div className="absolute left-0 right-0 top-full mt-2 border border-border/60 rounded-lg bg-popover/95 backdrop-blur-md shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
											<div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b border-border/20 bg-muted/30">
												Selecciona temporada de «{tmdbSelection.tvDataForSeason.title}»
											</div>
											<div className="max-h-56 overflow-y-auto py-1 custom-scrollbar">
												{tmdbSelection.tvDataForSeason.seasons.map(season => (
													<button
														key={season.number}
														type="button"
														onClick={() => tmdbSelection.setSelectedSeasonNumber(season.number)}
														className={cn(
															'w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors border-b border-border/10 last:border-0 flex items-center justify-between',
															tmdbSelection.selectedSeasonNumber === season.number && 'bg-primary/10'
														)}
													>
														<span className="text-sm font-medium text-foreground">{season.name}</span>
														<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
															<span>{season.episodeCount} ep.</span>
															{season.airDate && <span className="h-3 w-px bg-border/40" />}
															{season.airDate && <span>{season.airDate.split('-')[0]}</span>}
														</div>
													</button>
												))}
											</div>
										</div>
									)}
							</div>
						) : (
							<div ref={searchContainerRef} className="relative flex-1 min-w-[240px] max-w-sm group">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
								<Input
									placeholder={gameSelection.igdbEnabled ? 'Buscar juego...' : 'IGDB no disponible'}
									value={gameSelection.gameSearchQuery}
									onChange={e => {
										gameSelection.setGameSearchQuery(e.target.value)
										gameSelection.setShowSearchResults(true)
									}}
									onFocus={() => gameSelection.setShowSearchResults(true)}
									disabled={!gameSelection.igdbEnabled}
									className="pl-9 pr-9 h-8 text-sm focus-visible:ring-1 focus-visible:ring-primary/40"
								/>
								{gameSelection.gameSearchQuery && (
									<button
										type="button"
										onClick={() => {
											gameSelection.setGameSearchQuery('')
											gameSelection.setShowSearchResults(false)
										}}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
									>
										<X className="h-3 w-3" />
									</button>
								)}

								{gameSelection.showSearchResults &&
									gameSelection.igdbEnabled &&
									gameSelection.debouncedGameQuery.trim().length >= 2 && (
										<div className="absolute left-0 right-0 top-full mt-2 border border-border/60 rounded-lg bg-popover/95 backdrop-blur-md shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
											{gameSelection.isSearchingGames ? (
												<div className="px-3 py-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
													<Loader2 className="h-3 w-3 animate-spin" /> Buscando...
												</div>
											) : gameSelection.gameResults.length === 0 ? (
												<div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
													Sin resultados para «{gameSelection.debouncedGameQuery}»
												</div>
											) : (
												<div className="max-h-80 overflow-y-auto py-1 custom-scrollbar">
													{gameSelection.gameResults.map(game => (
														<button
															key={game.id}
															type="button"
															onClick={() => gameSelection.handleSelectGame(game.id, game.name)}
															className="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors border-b border-border/20 last:border-0"
														>
															<div className="flex items-center gap-3">
																{game.cover?.image_id ? (
																	<img
																		src={getIGDBImageUrl(game.cover.image_id, 'cover_small')}
																		alt={game.name}
																		referrerPolicy="no-referrer"
																		className="w-10 h-14 rounded-md object-cover shrink-0 shadow-sm border border-border/10"
																	/>
																) : (
																	<div className="w-10 h-14 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/10">
																		<Gamepad2 className="h-4 w-4 text-muted-foreground/40" />
																	</div>
																)}
																<div className="min-w-0 flex-1">
																	<span
																		className="text-sm font-semibold text-foreground block truncate"
																		title={game.name}
																	>
																		{game.name}
																	</span>
																	<div className="flex flex-wrap items-center gap-1.5 mt-0.5">
																		<span className="text-[10px] font-mono px-1.5 py-0 bg-muted text-muted-foreground rounded-sm tracking-tighter">
																			{game.first_release_date
																				? new Date(game.first_release_date * 1000).getFullYear()
																				: 'TBA'}
																		</span>
																		{game.platforms && game.platforms.length > 0 && (
																			<span className="text-[10px] text-muted-foreground/60 flex flex-wrap gap-1">
																				•{' '}
																				{game.platforms
																					.slice(0, 3)
																					.map(p => p.abbreviation || p.name)
																					.join(', ')}
																				{game.platforms.length > 3 && ` +${game.platforms.length - 3}`}
																			</span>
																		)}
																	</div>
																</div>
															</div>
														</button>
													))}
												</div>
											)}
										</div>
									)}
							</div>
						)}

						{/* Selected media badge */}
						{mediaType === 'movie' && tmdbSelection.selectedMovieTitle && (
							<Badge
								variant="secondary"
								className="shrink-0 gap-1.5 max-w-[180px] bg-muted/40 hover:bg-muted/60 border-border/50 text-foreground transition-all animate-in fade-in slide-in-from-left-2 duration-300"
							>
								{tmdbSelection.isLoadingMovieData ? (
									<Loader2 className="h-3 w-3 animate-spin shrink-0 opacity-70" />
								) : (
									<Search className="h-3 w-3 shrink-0 opacity-70" />
								)}
								<span className="truncate text-xs font-medium">{tmdbSelection.selectedMovieTitle}</span>
								<button
									type="button"
									onClick={tmdbSelection.handleClearMovie}
									className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors shrink-0"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</Badge>
						)}
						{(mediaType === 'tvshow' || mediaType === 'season') && tmdbSelection.selectedTVTitle && (
							<Badge
								variant="secondary"
								className="shrink-0 gap-1.5 max-w-[180px] bg-muted/40 hover:bg-muted/60 border-border/50 text-foreground transition-all animate-in fade-in slide-in-from-left-2 duration-300"
							>
								{tmdbSelection.isLoadingTVData || tmdbSelection.isLoadingSeasonData ? (
									<Loader2 className="h-3 w-3 animate-spin shrink-0 opacity-70" />
								) : (
									<Search className="h-3 w-3 shrink-0 opacity-70" />
								)}
								<span className="truncate text-xs font-medium">
									{tmdbSelection.selectedTVTitle}
									{mediaType === 'season' &&
										tmdbSelection.selectedSeasonNumber !== null &&
										` — T${tmdbSelection.selectedSeasonNumber}`}
								</span>
								<button
									type="button"
									onClick={tmdbSelection.handleClearTV}
									className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors shrink-0"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</Badge>
						)}
						{mediaType === 'game' && gameSelection.selectedGameTitle && (
							<Badge
								variant="secondary"
								className="shrink-0 gap-1.5 max-w-[220px] bg-muted/40 hover:bg-muted/60 border-border/50 text-foreground transition-all animate-in fade-in slide-in-from-left-2 duration-300"
							>
								{gameSelection.isLoadingGameData ? (
									<Loader2 className="h-3 w-3 animate-spin shrink-0 opacity-70" />
								) : (
									<Gamepad2 className="h-3 w-3 shrink-0 opacity-70" />
								)}
								<span className="truncate text-xs font-medium">
									{gameSelection.isLoadingGameData && gameSelection.gameLoadingStep
										? gameSelection.gameLoadingStep === 'igdb'
											? 'Cargando IGDB...'
											: gameSelection.gameLoadingStep === 'steam'
											? 'Cargando Steam...'
											: gameSelection.selectedGameTitle
										: gameSelection.selectedGameTitle}
								</span>
								{!gameSelection.isLoadingGameData && (
									<button
										type="button"
										onClick={gameSelection.handleClearSelection}
										className="ml-0.5 p-0.5 rounded-full hover:bg-foreground/10 transition-colors shrink-0"
									>
										<X className="h-2.5 w-2.5" />
									</button>
								)}
							</Badge>
						)}

						{/* Spacer */}
						<div className="flex-1" />

						<Button
							variant="ghost"
							size="icon"
							onClick={() => setShowPreview(!showPreview)}
							className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
							title={showPreview ? 'Ocultar vista previa (Modo Zen)' : 'Mostrar vista previa'}
						>
							{showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						</Button>

						{/* Toggle Variables (Small screens only) */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setIsVariablesOpen(true)}
									className="shrink-0 h-8 w-8 2xl:hidden"
								>
									<PanelRight className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">Variables</TooltipContent>
						</Tooltip>

						{/* Overflow menu: load default + reset */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
									<Ellipsis className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleLoadDefault}>
									<FileDown className="h-4 w-4 mr-2" />
									Restablecer plantilla por defecto
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Save (primary action) */}
						<Button onClick={handleSave} disabled={!content.trim()} size="sm" className="h-8 gap-2">
							<Save className="h-3.5 w-3.5" />
							Guardar
						</Button>
					</div>
				}
				sidebar={
					<>
						{/* Variables Sidebar — Desktop (Column) */}
						<VariablesSidebar
							fields={fields}
							customGroups={variableGroups || undefined}
							onInsertVariable={insertVariable}
							isOpen={false}
							onOpenChange={() => {}}
							isSheetMode={false}
						/>

						{/* Variables Sidebar — Mobile/Laptop (Sheet) */}
						<VariablesSidebar
							fields={fields}
							customGroups={variableGroups || undefined}
							onInsertVariable={key => {
								insertVariable(key)
								// Sheet stays open on insert
							}}
							isOpen={isVariablesOpen}
							onOpenChange={setIsVariablesOpen}
							isSheetMode={true}
						/>
					</>
				}
				editorStack={
					<SharedEditorStack
						toolbar={
							<SharedEditorToolbar
								onAction={(buttonId: string) => handlers.handleToolbarAction(buttonId, state.activeFormats)}
								onDialog={(dialogId: string) => {
									const tableData = handlers.handleDialog(dialogId)
									if (dialogId === 'table') {
										state.setTableEditData(tableData)
									}
								}}
								onInsertSnippet={handlers.handleInsertSnippet}
								onWrapSelection={handlers.handleWrapSelection}
								onInsertList={handlers.handleInsertList}
								buttons={DEFAULT_TOOLBAR_BUTTONS}
								snippets={[]}
								showHistory={true}
								canUndo={editor.canUndo}
								canRedo={editor.canRedo}
								className="sticky top-0 z-40 rounded-none"
								isTableAtCursor={state.isTableAtCursor}
								onInsertEmoji={handlers.handleInsertEmoji}
								onInsertGif={handlers.handleInsertGif}
								activeFormats={state.activeFormats}
								onReplaceText={editor.replaceSelection}
								onGetSelection={() => editor.getSelection().text}
								onGetFullContent={() => content}
								onReplaceAll={(text: string) => {
									setContent(text)
									setIsDirty(true)
								}}
								hideMediaTemplateButtons
							/>
						}
						textareaRef={refs.textarea}
						containerRef={refs.container}
						footer={
							<EditorFooter
								content={content}
								lastSavedAt={null}
								isDirty={isDirty}
								onClear={() => {
									setContent('')
									// Sync logic is handled by hook
									// but we can manually trigger isDirty
									setIsDirty(true)
								}}
							/>
						}
						value={content}
						onInput={val => {
							setContent(val)
							setIsDirty(true)
						}}
						placeholder="Escribe tu plantilla aquí..."
						onPaste={actions.handlePaste}
						onCopy={actions.handleCopy}
						onCursorChange={actions.updateCursorState}
						onDragEnter={upload.handleDragEnter}
						onDragLeave={actions.handleDragLeave}
						onDragOver={upload.handleDragOver}
						onDrop={upload.handleDrop}
						isCopied={state.copied}
						isUploading={upload.isUploading}
						isDraggingOver={upload.isDraggingOver}
						uploadProgress={upload.uploadProgress}
						showDropzone={dialogs.isOpen('dropzone')}
						onDropzoneClose={() => {
							if (!upload.isUploading) {
								dialogs.close()
							}
						}}
						onFilesSelect={upload.handleFilesSelect}
					/>
				}
				previewPanel={
					<>
						<PreviewPanel
							content={previewContent}
							boldColor={boldColor}
							theme={theme === 'system' ? undefined : theme}
							showPreview={true} // Always "true" here because parent layout handles hiding/showing this div
							previewRef={refs.preview}
							badgeText={
								tmdbSelection.selectedMovieTitle
									? tmdbSelection.selectedMovieTitle
									: tmdbSelection.selectedTVTitle
									? tmdbSelection.selectedTVTitle +
									  (tmdbSelection.selectedSeasonNumber !== null ? ` — T${tmdbSelection.selectedSeasonNumber}` : '')
									: gameSelection.selectedGameTitle
									? gameSelection.selectedGameTitle
									: 'Plantilla'
							}
						/>
						{/* Loading overlay — game (with step detail) */}
						{mediaType === 'game' && gameSelection.isLoadingGameData && (
							<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-[1px] rounded-r-lg">
								<Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
								<span className="text-xs text-muted-foreground">
									{gameSelection.gameLoadingStep === 'igdb' && 'Obteniendo datos de IGDB...'}
									{gameSelection.gameLoadingStep === 'steam' && 'Obteniendo datos de Steam...'}
									{!gameSelection.gameLoadingStep && 'Cargando...'}
								</span>
							</div>
						)}
						{/* Loading overlay — movie/TV (generic) */}
						{mediaType !== 'game' &&
							(tmdbSelection.isLoadingMovieData ||
								tmdbSelection.isLoadingTVData ||
								tmdbSelection.isLoadingSeasonData) && (
								<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-[1px] rounded-r-lg">
									<Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
									<span className="text-xs text-muted-foreground">Cargando datos...</span>
								</div>
							)}
					</>
				}
			/>

			{/* Dialogs */}
			<UrlDialog
				open={dialogs.isOpen('url')}
				onOpenChange={open => (open ? dialogs.open('url') : dialogs.close())}
				onInsert={handlers.handleInsertUrl}
				initialDisplayText={(dialogs.dialogData.urlSelection as string) || ''}
			/>

			<PollCreatorDialog isOpen={dialogs.isOpen('poll')} onClose={dialogs.close} onInsert={handlers.handleInsertPoll} />

			<IndexCreatorDialog
				isOpen={dialogs.isOpen('index')}
				onClose={dialogs.close}
				onInsert={handlers.handleInsertIndex}
			/>

			<TableEditorDialog
				isOpen={dialogs.isOpen('table')}
				onClose={() => {
					dialogs.close()
					state.setTableEditData(null)
				}}
				onInsert={markdown => {
					handlers.handleInsertTable(markdown, state.tableEditData)
					state.setTableEditData(null)
				}}
				initialData={state.tableEditData?.initialData}
			/>

			<AlertDialog
				open={dialogs.isOpen('clear')}
				onOpenChange={open => (open ? dialogs.open('clear') : dialogs.close())}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Restablecer plantilla por defecto?</AlertDialogTitle>
						<AlertDialogDescription>
							Se eliminará tu plantilla personalizada de {getTypeName(mediaType).toLowerCase()} y se cargará la
							plantilla por defecto. Esta acción no se puede deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleClearConfirm}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Restablecer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

// =============================================================================
// Helpers
// =============================================================================

function getTypeName(type: TemplateType): string {
	switch (type) {
		case 'movie':
			return 'Peliculas'
		case 'tvshow':
			return 'Series'
		case 'season':
			return 'Temporadas'
		case 'game':
			return 'Videojuegos'
		default:
			return 'Media'
	}
}
