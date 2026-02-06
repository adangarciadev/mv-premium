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
import { generateGameTemplate, getIGDBImageUrl } from '@/services/api/igdb'
import { browser } from 'wxt/browser'
import type { IGDBGame } from '@/services/api/igdb'
import type { GameTemplateDataInput } from '@/types/templates'
import { useGameSearch, useGameTemplateDataWithProgress, useIgdbCredentials } from '../hooks/use-igdb'
import { useDebounce } from 'use-debounce'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	MediaDialogShell,
	MediaSearchInput,
	MediaResultItem,
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
	error: string | null
	copied: boolean
	isEditing: boolean
}

type DialogAction =
	| { type: 'SELECT_GAME'; game: IGDBGame }
	| { type: 'DATA_LOADED'; data: GameTemplateDataInput; template: string }
	| { type: 'SET_SEARCH_QUERY'; query: string }
	| { type: 'SET_ERROR'; error: string | null }
	| { type: 'SET_TEMPLATE'; template: string }
	| { type: 'SET_COPIED'; copied: boolean }
	| { type: 'TOGGLE_EDITING' }
	| { type: 'BACK' }
	| { type: 'RESET' }

const initialState: DialogState = {
	step: 'search',
	searchQuery: '',
	selectedId: null,
	selectedGame: null,
	templateData: null,
	template: '',
	error: null,
	copied: false,
	isEditing: false,
}

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
	switch (action.type) {
		case 'SELECT_GAME':
			return { ...state, selectedGame: action.game, selectedId: action.game.id, error: null }
		case 'DATA_LOADED':
			return { ...state, templateData: action.data, template: action.template, step: 'preview', selectedId: null }
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
		case 'BACK':
			return { ...state, selectedGame: null, templateData: null, template: '', isEditing: false, step: 'search' }
		case 'RESET':
			return initialState
	}
}

export function GameTemplateDialog({ isOpen, onClose, onInsert }: GameTemplateDialogProps) {
	const [state, dispatch] = useReducer(dialogReducer, initialState)
	const { step, searchQuery, selectedId, selectedGame, templateData, template, error, copied, isEditing } = state

	const searchInputRef = useRef<HTMLInputElement>(null)

	// Debounce search query
	const [debouncedQuery] = useDebounce(searchQuery, 400)

	// Check if credentials are configured
	const { data: hasCredentials, isLoading: isCheckingCredentials } = useIgdbCredentials()

	// Game search hook
	const {
		data: searchResults = [],
		isLoading: isSearching,
		error: searchError,
	} = useGameSearch(debouncedQuery, isOpen && !!hasCredentials)

	// Game template data hook (with step-by-step loading progress)
	const { data: fetchedGameData, isLoading: isLoadingDetails, loadingStep } = useGameTemplateDataWithProgress(
		selectedId ?? 0,
		selectedId !== null
	)

	// Process game data when it loads
	useEffect(() => {
		if (fetchedGameData && selectedId !== null) {
			dispatch({ type: 'DATA_LOADED', data: fetchedGameData, template: generateGameTemplate(fetchedGameData) })
		}
	}, [fetchedGameData, selectedId])

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
			dispatch({ type: 'RESET' })
			setTimeout(() => searchInputRef.current?.focus(), 100)
		}
	}, [isOpen, hasCredentials])

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
			icon={<Gamepad2 className="w-4 h-4 text-primary" />}
			title={getDialogTitle()}
			height={!hasCredentials && !isCheckingCredentials ? 'auto' : 580}
			footer={
				step === 'preview' && hasCredentials ? (
					<MediaDialogActions
						onBack={() => dispatch({ type: 'BACK' })}
						backLabel="← Buscar otro"
						onCopy={handleCopy}
						copied={copied}
						onInsert={handleInsert}
					/>
				) : undefined
			}
		>
			{/* Loading Credentials State */}
			{isCheckingCredentials ? (
				<div className="flex-1 h-full flex items-center justify-center">
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
						<>
							<MediaSearchInput
								ref={searchInputRef}
								value={searchQuery}
								onChange={q => dispatch({ type: 'SET_SEARCH_QUERY', query: q })}
								placeholder="Buscar videojuego por nombre..."
								isSearching={isSearching}
							/>

							{error && <MediaSearchError error={error} />}

							{searchResults.length > 0 && (
								<ScrollArea className="max-h-[320px]">
									<div className="flex flex-col gap-1.5">
										{searchResults.map(game => (
											<MediaResultItem
												key={game.id}
												imageUrl={game.cover?.image_id ? getIGDBImageUrl(game.cover.image_id, 'cover_small') : null}
												fallbackIcon={<Gamepad2 className="w-4 h-4 text-muted-foreground" />}
												title={game.name}
												subtitle={
													isLoadingDetails && selectedGame?.id === game.id
														? loadingStep === 'igdb'
															? 'Obteniendo datos de IGDB...'
															: loadingStep === 'steam'
																? 'Enriqueciendo con Steam...'
																: 'Cargando...'
														: `${game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : '—'}${game.platforms?.slice(0, 3).map((p: { abbreviation?: string; name: string }) => ` · ${p.abbreviation || p.name}`).join('') ?? ''}`
												}
												onClick={() => dispatch({ type: 'SELECT_GAME', game })}
												disabled={isLoadingDetails}
												isLoading={isLoadingDetails && selectedGame?.id === game.id}
												referrerPolicy="no-referrer"
											/>
										))}
									</div>
								</ScrollArea>
							)}

							{searchQuery && !isSearching && searchResults.length === 0 && !error && (
								<MediaEmptyState
									icon={<Gamepad2 className="w-6 h-6 text-muted-foreground" />}
									text="No se encontraron videojuegos"
								/>
							)}

							{!searchQuery && searchResults.length === 0 && (
								<MediaEmptyState
									icon={<Search className="w-6 h-6 text-muted-foreground" />}
									text="Escribe para buscar videojuegos"
								/>
							)}

							{/* IGDB Attribution */}
							<div className="mt-8 mb-4 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
								<a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" className="block mb-1">
									<span className="text-sm font-bold text-foreground">IGDB</span>
								</a>
								<p className="text-[10px] text-center text-muted-foreground m-0 max-w-[280px] leading-tight">
									Datos proporcionados por IGDB.com
								</p>
							</div>
						</>
					)}

					{/* Preview Step */}
					{step === 'preview' && template && templateData && (
						<MediaPreviewStep
							coverUrl={templateData.coverUrl}
							coverHeight={100}
							previewInfo={
								<>
									<div className="font-semibold text-base mb-1.5 text-foreground truncate">
										{templateData.name}
									</div>
									<div className="text-xs text-muted-foreground mb-1 truncate">
										{templateData.releaseDate ? new Date(templateData.releaseDate).getFullYear() : '—'} ·{' '}
										{templateData.developers.join(', ') || 'Desarrollador desconocido'}
									</div>
									<div className="text-xs text-muted-foreground/80 truncate">
										{templateData.platforms.slice(0, 4).join(', ')}
									</div>
								</>
							}
							onCustomize={() => {
								browser.tabs.create({
									url: browser.runtime.getURL('/options.html#/templates?tab=media&type=game'),
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
