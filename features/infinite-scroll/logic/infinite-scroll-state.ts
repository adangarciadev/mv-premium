/**
 * Infinite Scroll State & Types
 *
 * Centralized state management and type definitions for the infinite scroll feature.
 */
import { DOM_MARKERS } from '@/constants/dom-markers'

// =============================================================================
// SLIDING WINDOW CONFIGURATION
// =============================================================================

/** Number of pages to keep before the current visible page */
export const PAGES_BEFORE = 2
/** Number of pages to keep after the current visible page */
export const PAGES_AFTER = 2
/** Total window size: PAGES_BEFORE + 1 (current) + PAGES_AFTER */
export const WINDOW_SIZE = PAGES_BEFORE + 1 + PAGES_AFTER
/** Minimum pages loaded before enabling unloading (let user build up some content first) */
export const MIN_PAGES_BEFORE_UNLOAD = WINDOW_SIZE + 1
/** Debounce time for window management (ms) */
export const WINDOW_MANAGEMENT_DEBOUNCE = 300

// =============================================================================
// DOM CLASSES & IDS
// =============================================================================

export const PAGE_BLOCK_CLASS = DOM_MARKERS.CLASSES.INFINITE_PAGE_BLOCK
export const PAGE_PLACEHOLDER_CLASS = DOM_MARKERS.CLASSES.INFINITE_PAGE_PLACEHOLDER
export const DIVIDER_CLASS = DOM_MARKERS.CLASSES.INFINITE_DIVIDER_CONTAINER

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents a page block in the sliding window system.
 * Each page can be either loaded (content in DOM) or unloaded (placeholder).
 */
export interface PageBlock {
	/** Page number */
	page: number
	/** Whether the content is currently in the DOM */
	isLoaded: boolean
	/** The container element (either content wrapper or placeholder) */
	container: HTMLElement
	/** Cached height when unloaded (for placeholder) */
	cachedHeight: number
	/** Cached HTML content (for reloading) */
	cachedHTML: string | null
	/** Divider element reference */
	dividerContainer: HTMLElement | null
	/** Feature ID for the divider component */
	dividerFeatureId: string | null
}

/**
 * Legacy page marker for scroll tracking
 */
export interface PageMarker {
	page: number
	el: HTMLElement
}

// =============================================================================
// STATE FACTORY
// =============================================================================

export interface InfiniteScrollState {
	startPage: number
	loadedPagesCount: number
	totalPages: number
	visiblePage: number
	isLoading: boolean
	isScrollActive: boolean
	isLiveModeActive: boolean
	pageBlocks: Map<number, PageBlock>
	pageMarkers: PageMarker[]
	dividerCounter: number
}

/**
 * Creates a fresh state object for infinite scroll
 */
export function createInitialState(startPage: number): InfiniteScrollState {
	return {
		startPage,
		loadedPagesCount: 1,
		totalPages: 1,
		visiblePage: startPage,
		isLoading: false,
		isScrollActive: false,
		isLiveModeActive: false,
		pageBlocks: new Map(),
		pageMarkers: [],
		dividerCounter: 0,
	}
}

/**
 * Resets mutable parts of state (keeps startPage and totalPages)
 */
export function resetState(state: InfiniteScrollState): void {
	state.pageMarkers = []
	state.pageBlocks.clear()
	state.dividerCounter = 0
	state.isLoading = false
	state.loadedPagesCount = 1
	state.visiblePage = state.startPage
}
