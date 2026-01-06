/**
 * Types Index - Central export for all types
 */

// API Types
export type {
	TMDBMovie,
	TMDBMovieDetails,
	TMDBCredits,
	TMDBVideos,
	TMDBReleaseDates,
	TMDBSearchResult,
	TMDBPerson,
	TMDBPersonDetails,
	TMDBTVShow,
	TMDBTVShowDetails,
	TMDBSeasonDetails,
	ImgBBUploadResponse,
} from './api'

// Storage Types
export type { MutedWord, PinnedPost, ThreadPins, ExtensionSettings, StorageKey } from './storage'

export { STORAGE_KEYS } from './storage'

// Editor Types
export type {
	ToolbarActionType,
	WrapAction,
	InsertAction,
	DialogAction,
	CustomAction,
	ToolbarAction,
	ToolbarButtonGroup,
	ToolbarButtonConfig,
	SnippetConfig,
	KeyboardShortcut,
	HistoryEntry,
} from './editor'

export { DEFAULT_TOOLBAR_BUTTONS, DEFAULT_SNIPPETS, DEFAULT_SHORTCUTS } from './editor'

// Profile Types
export type {
	ProfileViewMode,
	SidebarPosition,
	ProfileTabId,
	ProfileTab,
	ProfileState,
	ProfileActions,
	ProfileStore,
	ProfileStats,
	PinnedThread,
	DraftItem,
} from './profile-types'

// Theme Types
export type { ThemeColors, ThemePreset, CustomThemeState, ThemeExport } from './theme'

export { CSS_VAR_MAP, COLOR_GROUPS, COLOR_LABELS } from './theme'

// AI Types (Gemini API)
export type {
	AIService,
	RewriteStyle,
	AIModel,
	AIConfig,
	ChatMessage,
	ChatPart,
	GeminiFunctionCall,
	GeminiResponsePart,
	GeminiCandidate,
	GeminiAPIResponse,
	GeminiRequestBody,
	GeminiGenerationResult,
} from './ai'

// Note: MutedWord and PinnedPost are already exported from './storage'
