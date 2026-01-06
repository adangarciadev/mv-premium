import { useState, useEffect, useRef } from 'react'
import Search from 'lucide-react/dist/esm/icons/search'
import Film from 'lucide-react/dist/esm/icons/film'
import Tv from 'lucide-react/dist/esm/icons/tv'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import X from 'lucide-react/dist/esm/icons/x'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Edit3 from 'lucide-react/dist/esm/icons/edit-3'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import Layers from 'lucide-react/dist/esm/icons/layers'
import { generateTemplate, generateTVTemplate, generateSeasonTemplate, getPosterUrl } from '@/services/api/tmdb'
import type {
	TMDBMovie,
	TMDBTVShow,
	MovieTemplateData,
	TVShowTemplateData,
	SeasonTemplateData,
} from '@/services/api/tmdb'
import {
	useMovieSearch,
	useMovieTemplateData,
	useTVShowSearch,
	useTVShowTemplateData,
	useSeasonTemplateData,
} from '@/features/cine/hooks/use-tmdb'
import { useDebounce } from 'use-debounce'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface MovieTemplateDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (template: string) => void
}

const DIALOG_WIDTH = 540
const DIALOG_HEIGHT = 580

type MediaType = 'movie' | 'tv'
type TemplateData = MovieTemplateData | TVShowTemplateData | SeasonTemplateData

/**
 * MediaTemplateDialog component - A multi-step wizard for searching movies and TV series on TMDB
 * and generating standardized BBCode templates for Mediavida cine/series threads.
 */
export function MovieTemplateDialog({ isOpen, onClose, onInsert }: MovieTemplateDialogProps) {
	const [step, setStep] = useState<'search' | 'season-select' | 'preview'>('search')
	// apiKey is now managed via .env/background, no local state needed
	const [mediaType, setMediaType] = useState<MediaType>('movie')
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedId, setSelectedId] = useState<number | null>(null)
	const [selectedItem, setSelectedItem] = useState<TMDBMovie | TMDBTVShow | null>(null)
	const [templateData, setTemplateData] = useState<TemplateData | null>(null)
	const [template, setTemplate] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [isEditing, setIsEditing] = useState(false)

	// Season selection state
	const [tvShowData, setTvShowData] = useState<TVShowTemplateData | null>(null)
	const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
	const [loadingSeasonNumber, setLoadingSeasonNumber] = useState<number | null>(null)

	const searchInputRef = useRef<HTMLInputElement>(null)

	// Debounce search query
	const [debouncedQuery] = useDebounce(searchQuery, 400)

	// Movie search hook
	const {
		data: movieSearchData,
		isLoading: isSearchingMovies,
		error: movieSearchError,
	} = useMovieSearch(debouncedQuery, isOpen && mediaType === 'movie')
	const movieResults = movieSearchData?.results?.slice(0, 8) ?? []

	// TV search hook
	const {
		data: tvSearchData,
		isLoading: isSearchingTV,
		error: tvSearchError,
	} = useTVShowSearch(debouncedQuery, isOpen && mediaType === 'tv')
	const tvResults = tvSearchData?.results?.slice(0, 8) ?? []

	// Template data hooks
	const { data: fetchedMovieData, isLoading: isLoadingMovieDetails } = useMovieTemplateData(
		mediaType === 'movie' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'movie'
	)
	const { data: fetchedTVData, isLoading: isLoadingTVDetails } = useTVShowTemplateData(
		mediaType === 'tv' ? selectedId ?? 0 : 0,
		selectedId !== null && mediaType === 'tv'
	)

	// Season template data hook
	const { data: fetchedSeasonData, isLoading: isLoadingSeasonDetails } = useSeasonTemplateData(
		selectedId ?? 0,
		selectedSeason ?? 0,
		tvShowData,
		selectedSeason !== null && tvShowData !== null
	)

	// Derived state
	const isSearching = mediaType === 'movie' ? isSearchingMovies : isSearchingTV
	const searchError = mediaType === 'movie' ? movieSearchError : tvSearchError
	const searchResults = mediaType === 'movie' ? movieResults : tvResults
	const isLoadingDetails = mediaType === 'movie' ? isLoadingMovieDetails : isLoadingTVDetails

	// Process movie template data when it loads
	useEffect(() => {
		if (mediaType === 'movie' && fetchedMovieData && selectedId !== null) {
			setTemplateData(fetchedMovieData)
			setTemplate(generateTemplate(fetchedMovieData))
			setStep('preview')
			setSelectedId(null)
		}
	}, [fetchedMovieData, selectedId, mediaType])

	// Process TV show data - go to season selection if multiple seasons
	useEffect(() => {
		if (mediaType === 'tv' && fetchedTVData && selectedId !== null) {
			setTvShowData(fetchedTVData)

			// If only 1 season (or no seasons), go directly to preview
			if (fetchedTVData.seasons.length <= 1) {
				setTemplateData(fetchedTVData)
				setTemplate(generateTVTemplate(fetchedTVData))
				setStep('preview')
				setSelectedId(null)
			} else {
				// Multiple seasons - show season selection
				setStep('season-select')
				// Keep selectedId so we can fetch season data
			}
		}
	}, [fetchedTVData, selectedId, mediaType])

	// Process season template data when it loads
	useEffect(() => {
		if (fetchedSeasonData && selectedSeason !== null) {
			setTemplateData(fetchedSeasonData)
			setTemplate(generateSeasonTemplate(fetchedSeasonData))
			setStep('preview')
			setSelectedSeason(null)
			setLoadingSeasonNumber(null)
		}
	}, [fetchedSeasonData, selectedSeason])

	// Handle search error
	useEffect(() => {
		if (searchError) {
			setError(searchError instanceof Error ? searchError.message : 'Error en la búsqueda')
		} else {
			setError(null)
		}
	}, [searchError])

	useEffect(() => {
		if (isOpen) {
			setStep('search')
			setTimeout(() => searchInputRef.current?.focus(), 100)
		}
	}, [isOpen])

	const handleSelectMovie = (movie: TMDBMovie) => {
		setSelectedItem(movie)
		setSelectedId(movie.id)
		setError(null)
	}

	const handleSelectTVShow = (show: TMDBTVShow) => {
		setSelectedItem(show)
		setSelectedId(show.id)
		setError(null)
	}

	const handleSelectCompleteSeries = () => {
		if (tvShowData) {
			setTemplateData(tvShowData)
			setTemplate(generateTVTemplate(tvShowData))
			setStep('preview')
		}
	}

	const handleSelectSeason = (seasonNumber: number) => {
		setSelectedSeason(seasonNumber)
		setLoadingSeasonNumber(seasonNumber)
	}

	const handleInsert = () => {
		onInsert(template)
		handleClose()
	}

	const handleCopy = async () => {
		await navigator.clipboard.writeText(template)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleClose = () => {
		setSearchQuery('')
		setSelectedId(null)
		setSelectedItem(null)
		setTemplateData(null)
		setTemplate('')
		setError(null)
		setIsEditing(false)
		setTvShowData(null)
		setSelectedSeason(null)
		setLoadingSeasonNumber(null)
		setTvShowData(null)
		setSelectedSeason(null)
		setLoadingSeasonNumber(null)
		setStep('search')
		onClose()
	}

	const handleBack = () => {
		if (step === 'preview' && tvShowData && templateData && 'seasonNumber' in templateData) {
			// Coming back from season preview - go back to season selection
			setSelectedItem(null)
			setTemplateData(null)
			setTemplate('')
			setIsEditing(false)
			setStep('season-select')
		} else if (step === 'preview' || step === 'season-select') {
			// Go back to search
			setSelectedItem(null)
			setTemplateData(null)
			setTemplate('')
			setIsEditing(false)
			setTvShowData(null)
			setSelectedSeason(null)
			setStep('search')
		}
	}

	const handleMediaTypeChange = (type: MediaType) => {
		if (type !== mediaType) {
			setMediaType(type)
			setSearchQuery('')
			setSelectedItem(null)
			setTvShowData(null)
		}
	}

	// Helper to get display info from template data
	const getPreviewInfo = () => {
		if (!templateData) return { title: '', subtitle: '', genres: [] as string[] }

		if ('director' in templateData) {
			// Movie
			return {
				title: templateData.title,
				subtitle: `${templateData.year} · ${templateData.director}`,
				genres: templateData.genres,
			}
		} else if ('seasonNumber' in templateData) {
			// Season
			const epLabel = templateData.episodeCount === 1 ? 'episodio' : 'episodios'
			return {
				title: `${templateData.seriesTitle} - ${templateData.seasonName}`,
				subtitle: `${templateData.year} · ${templateData.episodeCount} ${epLabel}`,
				genres: templateData.seriesGenres,
			}
		} else {
			// TV Show
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
		if (step === 'search') return `Buscar ${mediaType === 'movie' ? 'película' : 'serie'}`
		if (step === 'season-select') return tvShowData?.title || 'Seleccionar temporada'
		return previewInfo.title || 'Vista previa'
	}

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
			<DialogContent
				showCloseButton={false}
				className="p-0 gap-0 overflow-hidden flex flex-col bg-background border-border rounded-xl"
				style={{
					width: `${DIALOG_WIDTH}px`,
					height: `${DIALOG_HEIGHT}px`,
					maxWidth: '95vw',
					maxHeight: '85vh',
				}}
			>
				{/* Header */}
				<DialogHeader className="p-4 px-5 border-b border-border flex flex-row items-center justify-between shrink-0">
					<DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
						<div className="p-1.5 rounded-lg bg-primary/15 flex items-center justify-center">
							<Clapperboard className="w-4 h-4 text-primary" />
						</div>
						{getDialogTitle()}
					</DialogTitle>
					<button
						onClick={handleClose}
						className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent text-muted-foreground border-none cursor-pointer transition-colors hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X size={18} />
					</button>
				</DialogHeader>

				{/* Content */}
				<div
					className="flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					onWheel={e => e.stopPropagation()}
				>
					{/* Search Step */}
					{step === 'search' && (
						<>
							{/* Media Type Toggle */}
							<div className="flex p-1 bg-muted/50 rounded-lg mb-4 gap-1 border border-border">
								<button
									onClick={() => handleMediaTypeChange('movie')}
									className={cn(
										'flex-1 flex items-center justify-center gap-2 h-9 rounded-md text-[13px] font-medium transition-all border-none cursor-pointer',
										mediaType === 'movie'
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
									)}
								>
									<Film className="w-4 h-4" />
									Películas
								</button>
								<button
									onClick={() => handleMediaTypeChange('tv')}
									className={cn(
										'flex-1 flex items-center justify-center gap-2 h-9 rounded-md text-[13px] font-medium transition-all border-none cursor-pointer',
										mediaType === 'tv'
											? 'bg-primary text-primary-foreground shadow-sm'
											: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
									)}
								>
									<Tv className="w-4 h-4" />
									Series
								</button>
							</div>

							{/* Search input */}
							<div className="relative mb-4">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
								<input
									ref={searchInputRef}
									type="text"
									value={searchQuery}
									onChange={e => setSearchQuery(e.target.value)}
									onKeyDown={e => e.stopPropagation()}
									placeholder={mediaType === 'movie' ? 'Buscar película por título...' : 'Buscar serie por título...'}
									className="w-full h-10 pl-10 pr-10 bg-black/20 border border-border rounded-lg text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring focus:bg-black/30 transition-colors"
								/>
								{isSearching && (
									<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
								)}
							</div>

							{/* Error */}
							{error && (
								<div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[13px] mb-4">
									<AlertCircle className="w-4 h-4 shrink-0" />
									{error}
								</div>
							)}

							{/* Movie Results */}
							{mediaType === 'movie' && movieResults.length > 0 && (
								<div className="flex flex-col gap-1.5">
									{movieResults.map(movie => (
										<button
											key={movie.id}
											onClick={() => handleSelectMovie(movie)}
											disabled={isLoadingDetails}
											className={cn(
												'flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-lg cursor-pointer text-left text-foreground transition-all w-full font-inherit hover:bg-muted/60 hover:border-border/80',
												isLoadingDetails && 'cursor-wait opacity-70'
											)}
										>
											{movie.poster_path ? (
												<img
													src={getPosterUrl(movie.poster_path, 'w92') || ''}
													alt=""
													className="w-10 h-15 object-cover rounded shrink-0 bg-muted"
												/>
											) : (
												<div className="w-10 h-15 bg-muted rounded flex items-center justify-center shrink-0">
													<Film className="w-4 h-4 text-muted-foreground" />
												</div>
											)}
											<div className="flex-1 min-w-0 overflow-hidden">
												<div className="font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis text-foreground">
													{movie.title}
												</div>
												<div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
													{movie.release_date?.split('-')[0] || '—'}
													{movie.original_title !== movie.title && ` · ${movie.original_title}`}
												</div>
											</div>
											{isLoadingDetails && selectedItem && 'title' in selectedItem && selectedItem.id === movie.id && (
												<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
											)}
										</button>
									))}
								</div>
							)}

							{/* TV Results */}
							{mediaType === 'tv' && tvResults.length > 0 && (
								<div className="flex flex-col gap-1.5">
									{tvResults.map(show => (
										<button
											key={show.id}
											onClick={() => handleSelectTVShow(show)}
											disabled={isLoadingDetails}
											className={cn(
												'flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-lg cursor-pointer text-left text-foreground transition-all w-full font-inherit hover:bg-muted/60 hover:border-border/80',
												isLoadingDetails && 'cursor-wait opacity-70'
											)}
										>
											{show.poster_path ? (
												<img
													src={getPosterUrl(show.poster_path, 'w92') || ''}
													alt=""
													className="w-10 h-15 object-cover rounded shrink-0 bg-muted"
												/>
											) : (
												<div className="w-10 h-15 bg-muted rounded flex items-center justify-center shrink-0">
													<Tv className="w-4 h-4 text-muted-foreground" />
												</div>
											)}
											<div className="flex-1 min-w-0 overflow-hidden">
												<div className="font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis text-foreground">
													{show.name}
												</div>
												<div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
													{show.first_air_date?.split('-')[0] || '—'}
													{show.original_name !== show.name && ` · ${show.original_name}`}
												</div>
											</div>
											{isLoadingDetails && selectedItem && 'name' in selectedItem && selectedItem.id === show.id && (
												<Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
											)}
										</button>
									))}
								</div>
							)}

							{/* Empty state */}
							{searchQuery && !isSearching && searchResults.length === 0 && !error && (
								<div className="text-center py-10 px-5">
									<div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
										{mediaType === 'movie' ? (
											<Film className="w-6 h-6 text-muted-foreground" />
										) : (
											<Tv className="w-6 h-6 text-muted-foreground" />
										)}
									</div>
									<p className="m-0 text-[13px] text-muted-foreground">
										No se encontraron {mediaType === 'movie' ? 'películas' : 'series'}
									</p>
								</div>
							)}

							{/* Initial state - only show when no query AND no results */}
							{!searchQuery && searchResults.length === 0 && (
								<div className="text-center py-10 px-5">
									<div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
										<Search className="w-6 h-6 text-muted-foreground" />
									</div>
									<p className="m-0 text-[13px] text-muted-foreground">
										Escribe para buscar {mediaType === 'movie' ? 'películas' : 'series'}
									</p>
								</div>
							)}

							<div className="mt-8 mb-4 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
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
							</div>
						</>
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
								onClick={handleSelectCompleteSeries}
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
										onClick={() => handleSelectSeason(season.number)}
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
					{step === 'preview' && template && (
						<div className="overflow-hidden">
							{/* Media info header */}
							<div className="flex items-start gap-3 mb-4 pb-4 border-b border-border overflow-hidden">
								{templateData && 'posterUrl' in templateData && templateData.posterUrl && (
									<img
										src={templateData.posterUrl}
										alt=""
										className="w-[70px] h-[105px] object-cover rounded-lg shrink-0 bg-muted"
									/>
								)}
								<div className="flex-1 min-w-0 overflow-hidden">
									<div className="font-semibold text-base mb-1.5 text-foreground truncate">{previewInfo.title}</div>
									<div className="text-xs text-muted-foreground mb-1 truncate">{previewInfo.subtitle}</div>
									<div className="text-xs text-muted-foreground/80 truncate">
										{previewInfo.genres.slice(0, 3).join(', ')}
									</div>
								</div>
								<button
									onClick={() => setIsEditing(!isEditing)}
									className="h-7 px-2 text-xs bg-muted/30 border border-border rounded-md text-muted-foreground flex items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors shrink-0"
								>
									<Edit3 className="w-3 h-3" />
									{isEditing ? 'Ver' : 'Editar'}
								</button>
							</div>

							{/* Template content */}
							{isEditing ? (
								<Textarea
									value={template}
									onChange={e => setTemplate(e.target.value)}
									onKeyDown={e => e.stopPropagation()}
									className="min-h-[180px] text-xs font-mono resize-y leading-relaxed !bg-card"
								/>
							) : (
								<div className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-[180px] overflow-y-auto overflow-x-hidden leading-relaxed text-foreground">
									{template}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				{step === 'season-select' && (
					<DialogFooter className="p-3 px-4 border-t border-border flex gap-2 shrink-0">
						<button
							onClick={handleBack}
							className="h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
						>
							← Buscar otra
						</button>
					</DialogFooter>
				)}

				{step === 'preview' && (
					<DialogFooter className="p-3 px-4 border-t border-border flex gap-2 shrink-0">
						<button
							onClick={handleBack}
							className="h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
						>
							← {tvShowData && templateData && 'seasonNumber' in templateData ? 'Cambiar temporada' : 'Buscar otra'}
						</button>
						<button
							onClick={handleCopy}
							className={cn(
								'h-9 px-3.5 bg-transparent border border-border rounded-md text-[13px] flex items-center justify-center gap-1.5 cursor-pointer hover:bg-muted transition-colors',
								copied ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-muted-foreground'
							)}
						>
							{copied ? <Check size={14} /> : <Copy size={14} />}
							{copied ? 'Copiado' : 'Copiar'}
						</button>
						<button
							onClick={handleInsert}
							className="h-9 px-3.5 flex-1 bg-primary text-primary-foreground font-medium border-none rounded-md text-[13px] cursor-pointer hover:opacity-90 transition-opacity"
						>
							Insertar en editor
						</button>
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	)
}
