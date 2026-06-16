
import { useState, useCallback, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import { useGameSearch, useGameTemplateDataWithProgress, useIgdbCredentials } from '@/features/games/hooks/use-igdb'
import { generatePlaceholderData } from '../utils/placeholders'
import { isGameTemplateType, type TemplateType, type TemplateDataInput } from '@/types/templates'

interface UseGameSelectionProps {
	mediaType: TemplateType
	onPreviewDataChange: (data: TemplateDataInput | null) => void
}

export function useGameSelection({ mediaType, onPreviewDataChange }: UseGameSelectionProps) {
	// State
	const [gameSearchQuery, setGameSearchQuery] = useState('')
	const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
	const [selectedGameTitle, setSelectedGameTitle] = useState<string | null>(null)
	const [showSearchResults, setShowSearchResults] = useState(false)

	// Hooks
	const { data: igdbHasCredentials } = useIgdbCredentials()
	const igdbEnabled = igdbHasCredentials === true
	
	const [debouncedGameQuery] = useDebounce(gameSearchQuery, 300)
	
	const isGameType = isGameTemplateType(mediaType)

	const { data: gameResults = [], isLoading: isSearchingGames } = useGameSearch(
		debouncedGameQuery,
		isGameType && igdbEnabled
	)

	const {
		data: selectedGameData,
		isLoading: isLoadingGameData,
		loadingStep: gameLoadingStep,
	} = useGameTemplateDataWithProgress(
		selectedGameId ?? 0,
		isGameType && igdbEnabled && selectedGameId !== null
	)

	// Sync preview data when game data loads
	useEffect(() => {
		if (!isGameTemplateType(mediaType)) return
		
		if (selectedGameData) {
			onPreviewDataChange(selectedGameData)
		} else if (selectedGameId === null) {
			// Only reset to placeholder if we explicitly cleared selection (id is null)
			// avoiding flash if we actially have no data yet but id is set
			onPreviewDataChange(generatePlaceholderData(mediaType))
		}
	}, [mediaType, selectedGameData, selectedGameId, onPreviewDataChange])

	// Handlers
	const handleSelectGame = useCallback((id: number, title: string) => {
		setSelectedGameId(id)
		setSelectedGameTitle(title)
		setGameSearchQuery('')
		setShowSearchResults(false)
	}, [])

	const handleClearSelection = useCallback(() => {
		setSelectedGameId(null)
		setSelectedGameTitle(null)
		onPreviewDataChange(generatePlaceholderData(mediaType))
	}, [mediaType, onPreviewDataChange])

	const resetState = useCallback(() => {
		setGameSearchQuery('')
		setSelectedGameId(null)
		setSelectedGameTitle(null)
		setShowSearchResults(false)
	}, [])

	return {
		// State
		gameSearchQuery,
		setGameSearchQuery,
		selectedGameId,
		selectedGameTitle,
		showSearchResults,
		setShowSearchResults,
		
		// Computed
		igdbEnabled,
		debouncedGameQuery,
		gameResults,
		isSearchingGames,
		isLoadingGameData,
		gameLoadingStep,

		// Actions
		handleSelectGame,
		handleClearSelection,
		resetState
	}
}
