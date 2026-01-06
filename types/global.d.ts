/**
 * Global Type Definitions
 *
 * Extends the global Window interface with Mediavida-specific properties
 * and extension-internal properties used across the codebase.
 *
 * This eliminates the need for `as any` casts when accessing these properties.
 */

/**
 * Handler function type for form submission interception
 */
type FormSubmitHandler = (e: Event) => Promise<void> | void

/**
 * Mediavida global functions injected by the forum's scripts
 */
interface MediavidaGlobals {
	/**
	 * Initializes tooltips for quote hovers and user info popups.
	 * Called by Mediavida's native scripts after DOM manipulation.
	 */
	initTooltips?: () => void
}

/**
 * Extension-internal properties stored on window for cross-component communication
 */
interface ExtensionGlobals {
	/**
	 * Form submit handler for live thread mode.
	 * Stored on window to allow cleanup from different module.
	 */
	__mvLiveFormHandler?: FormSubmitHandler

	/**
	 * Debug function for infinite scroll feature.
	 * Enables/disables verbose logging.
	 */
	mvInfiniteScrollDebug?: (enable: boolean) => void

	/**
	 * Returns current state of infinite scroll for debugging.
	 */
	mvInfiniteScrollState?: () => unknown
}

declare global {
	interface Window extends MediavidaGlobals, ExtensionGlobals {}
}

export {}
