/**
 * Timing Constants
 * Centralized timing values for debounces, delays, and timeouts.
 * All values are in milliseconds unless otherwise noted.
 */

// =============================================================================
// DEBOUNCE DELAYS
// =============================================================================

export const DEBOUNCE = {
	/** Scroll event debounce (e.g., infinite scroll tracking) */
	SCROLL: 100,

	/** Text input debounce (e.g., search fields) */
	INPUT: 150,

	/** Search query debounce (e.g., user search, GIF picker) */
	SEARCH: 300,

	/** Heavy search operations (e.g., TMDB, user finder) */
	SEARCH_HEAVY: 400,

	/** Live preview update debounce */
	PREVIEW: 300,

	/** Text history debounce */
	HISTORY: 300,

	/** GIF search debounce */
	GIF_SEARCH: 500,
} as const

// =============================================================================
// UI FEEDBACK DELAYS
// =============================================================================

export const FEEDBACK = {
	/** "Copied to clipboard" feedback duration */
	COPY_FEEDBACK: 2000,

	/** Toast notification display duration */
	TOAST_DURATION: 3000,

	/** Tooltip delay before showing */
	TOOLTIP_DELAY: 300,

	/** Tooltip delay for instant tooltips (hover menus) */
	TOOLTIP_INSTANT: 0,

	/** Quick tooltip delay (color pickers, etc.) */
	TOOLTIP_QUICK: 200,

	/** Post highlight animation duration */
	HIGHLIGHT_DURATION: 2000,

	/** Drag-drop feedback duration */
	DROP_FEEDBACK: 500,

	/** Status idle reset delay */
	STATUS_RESET: 300,
} as const

// =============================================================================
// OPERATION DELAYS
// =============================================================================

export const DELAY = {
	/** Minimum delay for focus operations */
	FOCUS: 50,

	/** Short delay for UI transitions */
	SHORT: 100,

	/** Medium delay for async feedback */
	MEDIUM: 150,

	/** Delay before live thread poll starts after submit */
	LIVE_THREAD_POLL: 500,

	/** Delay for animation completion before next action */
	ANIMATION: 250,

	/** Progress bar completion delay */
	PROGRESS_COMPLETE: 350,

	/** Delay between retry attempts */
	RETRY: 500,

	/** Delay before page reload after settings change */
	RELOAD: 1500,

	/** Initial update toast delay */
	UPDATE_TOAST: 1500,

	/** Simulated operation delay (export, etc.) */
	SIMULATED_OPERATION: 800,

	/** Reset after settings import */
	SETTINGS_RELOAD: 1500,
} as const

// =============================================================================
// INTERSECTION OBSERVER
// =============================================================================

export const INTERSECTION = {
	/** Root margin for infinite scroll (preload threshold) */
	INFINITE_SCROLL_MARGIN: '400px',

	/** Root margin for GIF picker lazy load */
	GIF_LAZY_LOAD_MARGIN: '100px',
} as const

// =============================================================================
// TIMEOUTS
// =============================================================================

export const TIMEOUT = {
	/** Code highlighter retry delays (progressive) */
	CODE_HIGHLIGHT_RETRIES: [200, 500, 800, 1200, 1800, 2500, 3000] as readonly number[],

	/** Code highlighter observer disconnect timeout */
	CODE_HIGHLIGHT_OBSERVER: 5000,

	/** Max history entries for text undo */
	MAX_HISTORY_ENTRIES: 100,
} as const

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const TIMING = {
	DEBOUNCE,
	FEEDBACK,
	DELAY,
	INTERSECTION,
	TIMEOUT,
} as const
