/**
 * Movie/TV Template Dialog
 *
 * A multi-step wizard for searching movies and TV series on TMDB
 * and generating standardized BBCode templates for Mediavida cine/series threads.
 * Uses shared MediaSearchDialog components for consistent UI.
 */

import { useReducer, useEffect, useRef } from 'react'
import Search from 'lucide-react/dist/esm/icons/search'
import Film from 'lucide-react/dist/esm/icons/film'
import Tv from 'lucide-react/dist/esm/icons/tv'
import Origami from 'lucide-react/dist/esm/icons/origami'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import Layers from 'lucide-react/dist/esm/icons/layers'
import { browser } from 'wxt/browser'
import { generateTemplate, generateTVTemplate, generateSeasonTemplate, getPosterUrl } from '@/services/api/tmdb'
import { generateAnimeTemplate, generateMangaTemplate, titleFromMedia } from '@/services/api/anilist'
import type {
	TMDBMovie,
	TMDBTVShow,
	MovieTemplateData,
	TVShowTemplateData,
	SeasonTemplateData,
} from '@/services/api/tmdb'
import type { AniListMedia, AnimeTemplateData, MangaTemplateData } from '@/services/api/anilist'
import {
	useMovieSearch,
	useMovieTemplateData,
	useTVShowSearch,
	useTVShowTemplateData,
	useSeasonTemplateData,
} from '@/features/cine/hooks/use-tmdb'
import {
	useAnimeSearch,
	useAnimeTemplateData,
	useMangaSearch,
	useMangaTemplateData,
} from '@/features/cine/hooks/use-anilist'
import { useDebounce } from 'use-debounce'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
	MediaDialogShell,
	MediaSearchInput,
	MediaEmptyState,
	MediaSearchError,
	MediaPreviewStep,
	MediaDialogActions,
} from '@/components/media-search-dialog'

interface MovieTemplateDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (template: string) => void
}

type MediaType = 'movie' | 'tv' | 'anime' | 'manga'
type SearchItem = TMDBMovie | TMDBTVShow | AniListMedia
type TemplateData = MovieTemplateData | TVShowTemplateData | SeasonTemplateData | AnimeTemplateData | MangaTemplateData

// =============================================================================
// State management
// =============================================================================

interface DialogState {
	step: 'search' | 'season-select' | 'preview'
	mediaType: MediaType
	searchQuery: string
	selectedId: number | null
	selectedItem: SearchItem | null
	templateData: TemplateData | null
	template: string
	error: string | null
	copied: boolean
	isEditing: boolean
	tvShowData: TVShowTemplateData | null
	selectedSeason: number | null
	loadingSeasonNumber: number | null
}

type DialogAction =
	| { type: 'SELECT_ITEM'; item: SearchItem; id: number }
	| { type: 'MOVIE_DATA_LOADED'; data: MovieTemplateData; template: string }
	| { type: 'TV_DATA_LOADED_PREVIEW'; data: TVShowTemplateData; template: string }
	| { type: 'TV_DATA_LOADED_SEASON_SELECT'; data: TVShowTemplateData }
	| { type: 'ANIME_DATA_LOADED'; data: AnimeTemplateData; template: string }
	| { type: 'MANGA_DATA_LOADED'; data: MangaTemplateData; template: string }
	| { type: 'SELECT_COMPLETE_SERIES'; data: TVShowTemplateData; template: string }
	| { type: 'SELECT_SEASON'; seasonNumber: number }
	| { type: 'SEASON_DATA_LOADED'; data: SeasonTemplateData; template: string }
	| { type: 'CHANGE_MEDIA_TYPE'; mediaType: MediaType }
	| { type: 'SET_SEARCH_QUERY'; query: string }
	| { type: 'SET_ERROR'; error: string | null }
	| { type: 'SET_TEMPLATE'; template: string }
	| { type: 'SET_COPIED'; copied: boolean }
	| { type: 'TOGGLE_EDITING' }
	| { type: 'BACK' }
	| { type: 'RESET' }

const initialState: DialogState = {
	step: 'search',
	mediaType: 'movie',
	searchQuery: '',
	selectedId: null,
	selectedItem: null,
	templateData: null,
	template: '',
	error: null,
	copied: false,
	isEditing: false,
	tvShowData: null,
	selectedSeason: null,
	loadingSeasonNumber: null,
}

const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
	movie: 'película',
	tv: 'serie',
	anime: 'anime',
	manga: 'manga',
}

const MEDIA_TYPE_SOURCES: Record<MediaType, string> = {
	movie: 'TMDB',
	tv: 'TMDB',
	anime: 'AniList',
	manga: 'AniList',
}

function getAniListTitle(item: AniListMedia): string {
	return titleFromMedia(item)
}

function getAniListYear(item: AniListMedia): string {
	return item.startDate.year ? String(item.startDate.year) : '—'
}

function getAniListImage(item: AniListMedia): string | null {
	return item.coverImage.large || item.coverImage.extraLarge || null
}

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
	switch (action.type) {
		case 'SELECT_ITEM':
			return { ...state, selectedItem: action.item, selectedId: action.id, error: null }
		case 'MOVIE_DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
		case 'TV_DATA_LOADED_PREVIEW':
			return { ...state, tvShowData: action.data, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
		case 'TV_DATA_LOADED_SEASON_SELECT':
			return { ...state, tvShowData: action.data, step: 'season-select' }
		case 'ANIME_DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
		case 'MANGA_DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
		case 'SELECT_COMPLETE_SERIES':
			return { ...state, templateData: action.data, template: action.template, step: 'preview' }
		case 'SELECT_SEASON':
			return { ...state, selectedSeason: action.seasonNumber, loadingSeasonNumber: action.seasonNumber }
		case 'SEASON_DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedSeason: null, loadingSeasonNumber: null }
		case 'CHANGE_MEDIA_TYPE':
			return {
				...state,
				mediaType: action.mediaType,
				searchQuery: '',
				selectedId: null,
				selectedItem: null,
				templateData: null,
				template: '',
				tvShowData: null,
				selectedSeason: null,
			}
		case 'SET_SEARCH_QUERY':
			return { ...state, searchQuery: action.query }
		case 'SET_ERROR':
			return { ...state, error: action.error }
		case 'SET_TEMPLATE':
			return { ...state, template: action.template }
		case 'SET_COPIED':
			return { ...state, copied: action.copied }
		case 'TOGGLE_EDITING':
			return { ...state, isEditing: !state.isEditing }
		case 'BACK': {
			if (state.step === 'preview' && state.tvShowData && state.templateData && 'seasonNumber' in state.templateData) {
				// From season preview → back to season selection
				return { ...state, selectedItem: null, templateData: null, template: '', isEditing: false, step: 'season-select' }
			}
			// From preview or season-select → back to search
			return { ...state, selectedItem: null, templateData: null, template: '', isEditing: false, tvShowData: null, selectedSeason: null, step: 'search' }
		}
		case 'RESET':
			return initialState
	}
}

// =============================================================================
// Component
// =============================================================================

export function MovieTemplateDialog({ isOpen, onClose, onInsert }: MovieTemplateDialogProps) {
	const [state, dispatch] = useReducer(dialogReducer, initialState)
	const {
		step, mediaType, searchQuery, selectedId, selectedItem,
		templateData, template, error, copied, isEditing,
		tvShowData, selectedSeason, loadingSeasonNumber,
	} = state

	const searchInputRef = useRef<HTMLInputElement>(null)

	// Debounce search query
	const [debouncedQuery] = useDebounce(searchQuery, 400)
	const normalizedSearchQuery = searchQuery.trim()
	const normalizedDebouncedQuery = debouncedQuery.trim()
	const isSearchReady = normalizedSearchQuery.length >= 2 && normalizedDebouncedQuery === normalizedSearchQuery

	// Movie search hook
	const {
		data: movieSearchData,
		isLoading: isSearchingMovies,
		error: movieSearchError,
	} = useMovieSearch(debouncedQuery, isOpen && mediaType === 'movie' && isSearchReady)
	const movieResults = isSearchReady ? movieSearchData?.results?.slice(0, 8) ?? [] : []

	// TV search hook
	const {
		data: tvSearchData,
		isLoading: isSearchingTV,
		error: tvSearchError,
	} = useTVShowSearch(debouncedQuery, isOpen && mediaType === 'tv' && isSearchReady)
	const tvResults = isSearchReady ? tvSearchData?.results?.slice(0, 8) ?? [] : []

	const {
		data: animeSearchData,
		isLoading: isSearchingAnime,
		error: animeSearchError,
	} = useAnimeSearch(debouncedQuery, isOpen && mediaType === 'anime' && isSearchReady)
	const animeResults = isSearchReady ? animeSearchData?.slice(0, 20) ?? [] : []

	const {
		data: mangaSearchData,
		isLoading: isSearchingManga,
		error: mangaSearchError,
	} = useMangaSearch(debouncedQuery, isOpen && mediaType === 'manga' && isSearchReady)
	const mangaResults = isSearchReady ? mangaSearchData?.slice(0, 20) ?? [] : []

	// Template data hooks
	const { data: fetchedMovieData, isLoading: isLoadingMovieDetails } = useMovieTemplateData(
		mediaType === 'movie' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'movie'
	)
	const { data: fetchedTVData, isLoading: isLoadingTVDetails } = useTVShowTemplateData(
		mediaType === 'tv' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'tv'
	)
	const { data: fetchedAnimeData, isLoading: isLoadingAnimeDetails } = useAnimeTemplateData(
		mediaType === 'anime' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'anime'
	)
	const { data: fetchedMangaData, isLoading: isLoadingMangaDetails } = useMangaTemplateData(
		mediaType === 'manga' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'manga'
	)

	// Season template data hook
	const { data: fetchedSeasonData, isLoading: isLoadingSeasonDetails } = useSeasonTemplateData(
		selectedId ?? 0,
		selectedSeason ?? 0,
		tvShowData,
		selectedSeason !== null && tvShowData !== null
	)

	// Derived state
	const isSearching =
		mediaType === 'movie'
			? isSearchingMovies
			: mediaType === 'tv'
			? isSearchingTV
			: mediaType === 'anime'
			? isSearchingAnime
			: isSearchingManga
	const searchError =
		mediaType === 'movie'
			? movieSearchError
			: mediaType === 'tv'
			? tvSearchError
			: mediaType === 'anime'
			? animeSearchError
			: mangaSearchError
	const searchResults =
		mediaType === 'movie'
			? movieResults
			: mediaType === 'tv'
			? tvResults
			: mediaType === 'anime'
			? animeResults
			: mangaResults
	const isLoadingDetails =
		mediaType === 'movie'
			? isLoadingMovieDetails
			: mediaType === 'tv'
			? isLoadingTVDetails
			: mediaType === 'anime'
			? isLoadingAnimeDetails
			: isLoadingMangaDetails

	// Process movie template data when it loads
	useEffect(() => {
		if (mediaType === 'movie' && fetchedMovieData && selectedId !== null) {
			dispatch({ type: 'MOVIE_DATA_LOADED', data: fetchedMovieData, template: generateTemplate(fetchedMovieData) })
		}
	}, [fetchedMovieData, selectedId, mediaType])

	// Process TV show data - go to season selection if multiple seasons
	useEffect(() => {
		if (mediaType === 'tv' && fetchedTVData && selectedId !== null) {
			if (fetchedTVData.seasons.length <= 1) {
				dispatch({ type: 'TV_DATA_LOADED_PREVIEW', data: fetchedTVData, template: generateTVTemplate(fetchedTVData) })
			} else {
				dispatch({ type: 'TV_DATA_LOADED_SEASON_SELECT', data: fetchedTVData })
			}
		}
	}, [fetchedTVData, selectedId, mediaType])

	useEffect(() => {
		if (mediaType === 'anime' && fetchedAnimeData && selectedId !== null) {
			dispatch({ type: 'ANIME_DATA_LOADED', data: fetchedAnimeData, template: generateAnimeTemplate(fetchedAnimeData) })
		}
	}, [fetchedAnimeData, selectedId, mediaType])

	useEffect(() => {
		if (mediaType === 'manga' && fetchedMangaData && selectedId !== null) {
			dispatch({ type: 'MANGA_DATA_LOADED', data: fetchedMangaData, template: generateMangaTemplate(fetchedMangaData) })
		}
	}, [fetchedMangaData, selectedId, mediaType])

	// Process season template data when it loads
	useEffect(() => {
		if (fetchedSeasonData && selectedSeason !== null) {
			dispatch({ type: 'SEASON_DATA_LOADED', data: fetchedSeasonData, template: generateSeasonTemplate(fetchedSeasonData) })
		}
	}, [fetchedSeasonData, selectedSeason])

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
		if (isOpen) {
			dispatch({ type: 'RESET' })
			setTimeout(() => searchInputRef.current?.focus(), 100)
		}
	}, [isOpen])

	const handleClose = () => {
		dispatch({ type: 'RESET' })
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

	// Helper to get display info from template data
	const getPreviewInfo = () => {
		if (!templateData) return { title: '', subtitle: '', genres: [] as string[] }

		if ('director' in templateData) {
			return {
				title: templateData.title,
				subtitle: `${templateData.year} · ${templateData.director}`,
				genres: templateData.genres,
			}
		} else if ('seasonNumber' in templateData) {
			const epLabel = templateData.episodeCount === 1 ? 'episodio' : 'episodios'
			return {
				title: `${templateData.seriesTitle} - ${templateData.seasonName}`,
				subtitle: `${templateData.year} · ${templateData.episodeCount} ${epLabel}`,
				genres: templateData.seriesGenres,
			}
		} else if ('studios' in templateData) {
			const episodeLabel = templateData.episodes ? `${templateData.episodes} capítulos` : templateData.format || 'Anime'
			return {
				title: templateData.title,
				subtitle: [templateData.year, episodeLabel, templateData.studios[0]].filter(Boolean).join(' · '),
				genres: templateData.genres,
			}
		} else if ('authors' in templateData) {
			const chapterLabel = templateData.chapters ? `${templateData.chapters} capítulos` : templateData.format || 'Manga'
			return {
				title: templateData.title,
				subtitle: [templateData.year, chapterLabel, templateData.authors[0]].filter(Boolean).join(' · '),
				genres: templateData.genres,
			}
		} else {
			const seasonLabel = templateData.numberOfSeasons === 1 ? 'temporada' : 'temporadas'
			return {
				title: templateData.title,
				subtitle: `${templateData.year} · ${templateData.numberOfSeasons} ${seasonLabel}`,
				genres: templateData.genres,
			}
		}
	}

	const previewInfo = getPreviewInfo()

	// Get title for dialog header
	const getDialogTitle = () => {
		if (step === 'search') return `Buscar ${MEDIA_TYPE_LABELS[mediaType]}`
		if (step === 'season-select') return tvShowData?.title || 'Seleccionar temporada'
		return previewInfo.title || 'Vista previa'
	}

	// Get back label for footer
	const getBackLabel = () => {
		if (tvShowData && templateData && 'seasonNumber' in templateData) return '← Cambiar temporada'
		return '← Buscar otra'
	}

	// Determine footer based on current step
	const getFooter = () => {
		if (step === 'season-select') {
			return (
				<MediaDialogActions
					onBack={() => dispatch({ type: 'BACK' })}
					backLabel="← Buscar otra"
					onCopy={handleCopy}
					copied={copied}
					onInsert={handleInsert}
					backOnly
				/>
			)
		}
		if (step === 'preview') {
			return (
				<MediaDialogActions
					onBack={() => dispatch({ type: 'BACK' })}
					backLabel={getBackLabel()}
					onCopy={handleCopy}
					copied={copied}
					onInsert={handleInsert}
				/>
			)
		}
		return undefined
	}

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={handleClose}
			icon={<Clapperboard className="w-4 h-4 text-primary" />}
			title={getDialogTitle()}
			footer={getFooter()}
		>
			{/* Search Step */}
			{step === 'search' && (
				<div className="flex min-h-full flex-col">
					{/* Media Type Toggle */}
					<div className="grid grid-cols-4 p-1 bg-muted/40 rounded-lg mb-4 gap-1 border border-border">
						{([
							{ type: 'movie' as const, label: 'Películas', icon: <Film className="w-4 h-4" /> },
							{ type: 'tv' as const, label: 'Series', icon: <Tv className="w-4 h-4" /> },
							{ type: 'anime' as const, label: 'Anime', icon: <Origami className="w-4 h-4" /> },
							{ type: 'manga' as const, label: 'Manga', icon: <BookOpen className="w-4 h-4" /> },
						]).map(item => (
							<button
								key={item.type}
								onClick={() => dispatch({ type: 'CHANGE_MEDIA_TYPE', mediaType: item.type })}
								className={cn(
									'flex min-w-0 items-center justify-center gap-1.5 h-10 rounded-md px-1.5 text-[11px] font-medium transition-all border-none cursor-pointer',
									mediaType === item.type
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
								)}
							>
								<span className="shrink-0">{item.icon}</span>
								<span className="shrink-0 whitespace-nowrap">{item.label}</span>
								<span className={cn(
									'shrink-0 rounded-sm border px-1 py-0.5 text-[7px] leading-none font-mono uppercase',
									mediaType === item.type
										? 'border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground/80'
										: 'border-border bg-background/70 text-muted-foreground/70'
								)}>
									{MEDIA_TYPE_SOURCES[item.type]}
								</span>
							</button>
						))}
					</div>

					<MediaSearchInput
						ref={searchInputRef}
						value={searchQuery}
						onChange={q => dispatch({ type: 'SET_SEARCH_QUERY', query: q })}
						placeholder={`Buscar ${MEDIA_TYPE_LABELS[mediaType]} por título...`}
						isSearching={isSearching}
					/>

					{error && <MediaSearchError error={error} />}

					{/* Movie Results */}
					{mediaType === 'movie' && movieResults.length > 0 && (
						<div className="mb-4 rounded-lg bg-muted/15 p-1">
							<ScrollArea className="h-[268px] pr-3">
								<div className="py-1 pr-1 space-y-1 overflow-x-hidden">
									{movieResults.map(movie => {
										const isRowLoading = isLoadingDetails && selectedItem != null && 'title' in selectedItem && selectedItem.id === movie.id
										const year = movie.release_date?.split('-')[0] || '—'
										const originalTitle = movie.original_title !== movie.title ? movie.original_title : ''

										return (
											<button
												key={movie.id}
												onClick={() => dispatch({ type: 'SELECT_ITEM', item: movie, id: movie.id })}
												disabled={isLoadingDetails}
												className="group w-full overflow-hidden text-left px-2 py-2.5 rounded-md hover:bg-muted focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted transition-colors disabled:cursor-wait disabled:opacity-70"
											>
												<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
													{movie.poster_path ? (
														<img
															src={getPosterUrl(movie.poster_path, 'w92') ?? ''}
															alt={movie.title}
															className="w-10 h-14 rounded-md object-cover shrink-0 bg-muted"
														/>
													) : (
														<div className="w-10 h-14 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0">
															<Film className="w-4 h-4 text-muted-foreground" />
														</div>
													)}
													<div className="min-w-0 overflow-hidden">
														<div className="block max-w-full text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
															{movie.title}
														</div>
														{isRowLoading ? (
															<div className="text-xs text-muted-foreground mt-0.5 truncate">Cargando...</div>
														) : (
															<div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
																<span className="inline-flex items-center rounded-sm bg-popover border border-border/60 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
																	{year}
																</span>
																{originalTitle && (
																	<span className="inline-flex max-w-full min-w-0 items-center rounded-sm bg-background/85 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate">
																		{originalTitle}
																	</span>
																)}
															</div>
														)}
													</div>
													{isRowLoading && (
														<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
													)}
												</div>
											</button>
										)
									})}
								</div>
							</ScrollArea>
						</div>
					)}

					{/* TV Results */}
					{mediaType === 'tv' && tvResults.length > 0 && (
						<div className="mb-4 rounded-lg bg-muted/15 p-1">
							<ScrollArea className="h-[268px] pr-3">
								<div className="py-1 pr-1 space-y-1 overflow-x-hidden">
									{tvResults.map(show => {
										const isRowLoading = isLoadingDetails && selectedItem != null && 'name' in selectedItem && selectedItem.id === show.id
										const year = show.first_air_date?.split('-')[0] || '—'
										const originalName = show.original_name !== show.name ? show.original_name : ''

										return (
											<button
												key={show.id}
												onClick={() => dispatch({ type: 'SELECT_ITEM', item: show, id: show.id })}
												disabled={isLoadingDetails}
												className="group w-full overflow-hidden text-left px-2 py-2.5 rounded-md hover:bg-muted focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted transition-colors disabled:cursor-wait disabled:opacity-70"
											>
												<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
													{show.poster_path ? (
														<img
															src={getPosterUrl(show.poster_path, 'w92') ?? ''}
															alt={show.name}
															className="w-10 h-14 rounded-md object-cover shrink-0 bg-muted"
														/>
													) : (
														<div className="w-10 h-14 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0">
															<Tv className="w-4 h-4 text-muted-foreground" />
														</div>
													)}
													<div className="min-w-0 overflow-hidden">
														<div className="block max-w-full text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
															{show.name}
														</div>
														{isRowLoading ? (
															<div className="text-xs text-muted-foreground mt-0.5 truncate">Cargando...</div>
														) : (
															<div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
																<span className="inline-flex items-center rounded-sm bg-popover border border-border/60 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
																	{year}
																</span>
																{originalName && (
																	<span className="inline-flex max-w-full min-w-0 items-center rounded-sm bg-background/85 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate">
																		{originalName}
																	</span>
																)}
															</div>
														)}
													</div>
													{isRowLoading && (
														<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
													)}
												</div>
											</button>
										)
									})}
								</div>
							</ScrollArea>
						</div>
					)}

					{/* AniList Results */}
					{(mediaType === 'anime' || mediaType === 'manga') && searchResults.length > 0 && (
						<div className="mb-4 rounded-lg bg-muted/15 p-1">
							<ScrollArea className="h-[268px] pr-3">
								<div className="py-1 pr-1 space-y-1 overflow-x-hidden">
									{(searchResults as AniListMedia[]).map(item => {
										const isRowLoading = isLoadingDetails && selectedItem?.id === item.id
										const title = getAniListTitle(item)
										const year = getAniListYear(item)
										const format = item.format?.replace(/_/g, ' ') || MEDIA_TYPE_LABELS[mediaType]

										return (
											<button
												key={item.id}
												onClick={() => dispatch({ type: 'SELECT_ITEM', item, id: item.id })}
												disabled={isLoadingDetails}
												className="group w-full overflow-hidden text-left px-2 py-2.5 rounded-md hover:bg-muted focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted transition-colors disabled:cursor-wait disabled:opacity-70"
											>
												<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3">
													{getAniListImage(item) ? (
														<img
															src={getAniListImage(item) ?? ''}
															alt={title}
															className="w-10 h-14 rounded-md object-cover shrink-0 bg-muted"
														/>
													) : (
														<div className="w-10 h-14 rounded-md bg-background border border-border/50 flex items-center justify-center shrink-0">
															{mediaType === 'anime'
																? <Origami className="w-4 h-4 text-muted-foreground" />
																: <BookOpen className="w-4 h-4 text-muted-foreground" />
															}
														</div>
													)}
													<div className="min-w-0 overflow-hidden">
														<div className="block max-w-full text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
															{title}
														</div>
														{isRowLoading ? (
															<div className="text-xs text-muted-foreground mt-0.5 truncate">Cargando...</div>
														) : (
															<div className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
																<span className="inline-flex items-center rounded-sm bg-popover border border-border/60 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
																	{year}
																</span>
																<span className="inline-flex max-w-full min-w-0 items-center rounded-sm bg-background/85 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate">
																	{format}
																</span>
															</div>
														)}
													</div>
													{isRowLoading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
												</div>
											</button>
										)
									})}
								</div>
							</ScrollArea>
						</div>
					)}

					{/* Empty state */}
					{isSearchReady && !isSearching && searchResults.length === 0 && !error && (
						<MediaEmptyState
							icon={mediaType === 'movie'
								? <Film className="w-6 h-6 text-muted-foreground" />
								: mediaType === 'tv'
								? <Tv className="w-6 h-6 text-muted-foreground" />
								: mediaType === 'anime'
								? <Origami className="w-6 h-6 text-muted-foreground" />
								: <BookOpen className="w-6 h-6 text-muted-foreground" />
							}
							text={`No se encontró ${MEDIA_TYPE_LABELS[mediaType]}`}
							className="mb-4 min-h-[224px] flex-1"
						/>
					)}

					{/* Initial state */}
					{normalizedSearchQuery.length < 2 && searchResults.length === 0 && (
						<MediaEmptyState
							icon={<Search className="w-6 h-6 text-muted-foreground" />}
							text={`Escribe para buscar ${MEDIA_TYPE_LABELS[mediaType]}`}
							className="mb-4 min-h-[224px] flex-1"
						/>
					)}

					<div className="mt-auto mb-0 border-t border-border/70 pt-4 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
						{mediaType === 'movie' || mediaType === 'tv' ? (
							<>
								<a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="block mb-1">
									<img
										src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
										alt="TMDB"
										className="h-2.5 w-auto"
									/>
								</a>
								<p className="text-[10px] text-center text-muted-foreground m-0 max-w-[280px] leading-tight">
									Este producto utiliza la API de TMDB pero no está avalado ni certificado por TMDB.
								</p>
							</>
						) : (
							<>
								<a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-foreground">
									AniList
								</a>
								<p className="text-[10px] text-center text-muted-foreground m-0 max-w-[280px] leading-tight">
									Datos de AniList; la sinopsis suele venir en inglés. MAL se enlaza si AniList aporta el identificador.
								</p>
							</>
						)}
					</div>
				</div>
			)}

			{/* Season Selection Step */}
			{step === 'season-select' && tvShowData && (
				<div className="flex flex-col gap-3">
					{/* Series info header */}
					<div className="flex items-start gap-3 mb-2 pb-3 border-b border-border">
						{tvShowData.posterUrl && (
							<img
								src={tvShowData.posterUrl}
								alt=""
								className="w-14 h-21 object-cover rounded-lg shrink-0 bg-muted"
							/>
						)}
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-[15px] mb-1 text-foreground">{tvShowData.title}</div>
							<div className="text-xs text-muted-foreground mb-1">
								{tvShowData.year} · {tvShowData.numberOfSeasons} temporadas · {tvShowData.numberOfEpisodes}{' '}
								episodios
							</div>
							<div className="text-xs text-muted-foreground/80">{tvShowData.genres.slice(0, 3).join(', ')}</div>
						</div>
					</div>

					<p className="text-[13px] text-muted-foreground m-0">¿Qué quieres insertar?</p>

					{/* Complete Series Option */}
					<button
						onClick={() => {
							dispatch({ type: 'SELECT_COMPLETE_SERIES', data: tvShowData, template: generateTVTemplate(tvShowData) })
						}}
						className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg cursor-pointer text-left text-foreground transition-all w-full font-inherit hover:bg-muted/60 hover:border-primary/50"
					>
						<div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
							<Layers className="w-5 h-5 text-primary" />
						</div>
						<div className="flex-1">
							<div className="font-medium text-[13px] text-foreground">Serie completa</div>
							<div className="text-xs text-muted-foreground mt-0.5">
								Incluye todas las temporadas y sinopsis general
							</div>
						</div>
					</button>

					{/* Season Options */}
					<div className="flex flex-col gap-1.5 mt-1">
						<p className="text-xs text-muted-foreground m-0 mb-1">O selecciona una temporada específica:</p>
						{tvShowData.seasons.map(season => (
							<button
								key={season.number}
								onClick={() => dispatch({ type: 'SELECT_SEASON', seasonNumber: season.number })}
								disabled={isLoadingSeasonDetails}
								className={cn(
									'flex items-center gap-3 p-2.5 bg-muted/20 border border-border rounded-lg cursor-pointer text-left text-foreground transition-all w-full font-inherit hover:bg-muted/50',
									isLoadingSeasonDetails && loadingSeasonNumber === season.number && 'opacity-70'
								)}
							>
								<div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
									{season.number}
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-[13px] text-foreground">{season.name}</div>
									<div className="text-xs text-muted-foreground mt-0.5">
										{season.airDate ? season.airDate.split('-')[0] : '—'} · {season.episodeCount} episodios
									</div>
								</div>
								{isLoadingSeasonDetails && loadingSeasonNumber === season.number && (
									<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
								)}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Preview Step */}
			{step === 'preview' && template && templateData && (
				<MediaPreviewStep
					coverUrl={
						'posterUrl' in templateData
							? templateData.posterUrl
							: 'coverUrl' in templateData
							? templateData.coverUrl || templateData.bannerUrl
							: undefined
					}
					coverHeight={105}
					previewInfo={
						<>
							<div className="font-semibold text-base mb-1.5 text-foreground truncate">
								{previewInfo.title}
							</div>
							<div className="text-xs text-muted-foreground mb-1 truncate">
								{previewInfo.subtitle}
							</div>
							<div className="text-xs text-muted-foreground/80 truncate">
								{previewInfo.genres.slice(0, 3).join(', ')}
							</div>
						</>
					}
					onCustomize={() => {
						const type =
							templateData && 'seasonNumber' in templateData
								? 'season'
								: templateData && 'director' in templateData
								? 'movie'
								: templateData && 'studios' in templateData
								? 'anime'
								: templateData && 'authors' in templateData
								? 'manga'
								: 'tvshow'
						browser.tabs.create({
							url: browser.runtime.getURL(`/options.html#/templates?tab=media&type=${type}`),
						})
					}}
					template={template}
					onTemplateChange={t => dispatch({ type: 'SET_TEMPLATE', template: t })}
					isEditing={isEditing}
					onToggleEditing={() => dispatch({ type: 'TOGGLE_EDITING' })}
				/>
			)}
		</MediaDialogShell>
	)
}
