/**
 * Infinite Scroll Debug Module
 *
 * Provides visual debugging tools for the sliding window system.
 * Includes debug panel, placeholder visualization, and console utilities.
 */
import { logger } from '@/lib/logger'
import { DOM_MARKERS } from '@/constants/dom-markers'

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_BLOCK_CLASS = DOM_MARKERS.CLASSES.INFINITE_PAGE_BLOCK
const PAGE_PLACEHOLDER_CLASS = DOM_MARKERS.CLASSES.INFINITE_PAGE_PLACEHOLDER

// =============================================================================
// STATE
// =============================================================================

let debugMode = false

// =============================================================================
// TYPES
// =============================================================================

export interface DebugState {
	isActive: boolean
	startPage: number
	visiblePage: number
	loadedPagesCount: number
	totalPages: number
	windowConfig: {
		PAGES_BEFORE: number
		PAGES_AFTER: number
		WINDOW_SIZE: number
		MIN_PAGES_BEFORE_UNLOAD: number
	}
	currentWindow: {
		start: number
		end: number
	}
	pageBlocks: Array<{
		page: number
		isLoaded: boolean
		cachedHeight: number
		hasCachedHTML: boolean
	}>
	loadedInDOM: number
	unloadedPlaceholders: number
}

// =============================================================================
// DEBUG MODE CONTROL
// =============================================================================

/**
 * Check if debug mode is currently enabled
 */
export function isDebugMode(): boolean {
	return debugMode
}

/**
 * Toggle debug mode for infinite scroll.
 * When enabled, shows visual indicators on placeholders and logs state to console.
 */
export function toggleInfiniteScrollDebug(enable?: boolean): void {
	debugMode = enable ?? !debugMode
	logger.info(`[InfiniteScroll Debug] ${debugMode ? 'ENABLED' : 'DISABLED'}`)

	if (debugMode) {
		injectDebugStyles()
	} else {
		removeDebugStyles()
	}
}

// =============================================================================
// DEBUG STYLES
// =============================================================================

/** Inject CSS styles for debug visualization */
function injectDebugStyles(): void {
	if (document.getElementById('mvp-infinite-debug-styles')) return

	const style = document.createElement('style')
	style.id = 'mvp-infinite-debug-styles'
	style.textContent = `
		.${PAGE_PLACEHOLDER_CLASS} {
			background: repeating-linear-gradient(
				45deg,
				rgba(255, 100, 100, 0.1),
				rgba(255, 100, 100, 0.1) 10px,
				rgba(255, 100, 100, 0.2) 10px,
				rgba(255, 100, 100, 0.2) 20px
			) !important;
			border: 3px dashed #ff6464 !important;
			position: relative !important;
			min-height: 100px !important;
		}
		.${PAGE_PLACEHOLDER_CLASS}::before {
			content: 'PLACEHOLDER - Página ' attr(data-page) ' (altura: ' attr(data-cached-height) 'px)' !important;
			position: absolute !important;
			top: 50% !important;
			left: 50% !important;
			transform: translate(-50%, -50%) !important;
			background: #ff6464 !important;
			color: white !important;
			padding: 12px 24px !important;
			border-radius: 8px !important;
			font-size: 16px !important;
			font-weight: bold !important;
			z-index: 1000 !important;
			white-space: nowrap !important;
		}
		.${PAGE_BLOCK_CLASS} {
			outline: 2px solid rgba(100, 200, 100, 0.5) !important;
			position: relative !important;
		}
		.${PAGE_BLOCK_CLASS}::after {
			content: 'LOADED - Página ' attr(data-page) !important;
			position: fixed !important;
			right: 10px !important;
			top: 50% !important;
			background: rgba(100, 200, 100, 0.9) !important;
			color: white !important;
			padding: 4px 8px !important;
			border-radius: 4px !important;
			font-size: 11px !important;
			font-weight: bold !important;
			z-index: 9999 !important;
			pointer-events: none !important;
			display: none !important;
		}
		/* Debug overlay panel */
		#mvp-infinite-debug-panel {
			position: fixed !important;
			bottom: 10px !important;
			right: 10px !important;
			background: rgba(0, 0, 0, 0.9) !important;
			color: #0f0 !important;
			font-family: monospace !important;
			font-size: 12px !important;
			padding: 12px !important;
			border-radius: 8px !important;
			z-index: 99999 !important;
			min-width: 280px !important;
			border: 1px solid #0f0 !important;
		}
		#mvp-infinite-debug-panel h4 {
			margin: 0 0 8px 0 !important;
			color: #0f0 !important;
			font-size: 14px !important;
		}
		#mvp-infinite-debug-panel .row {
			display: flex !important;
			justify-content: space-between !important;
			margin: 2px 0 !important;
		}
		#mvp-infinite-debug-panel .loaded { color: #6f6 !important; }
		#mvp-infinite-debug-panel .unloaded { color: #f66 !important; }
	`
	document.head.appendChild(style)

	// Create debug panel
	createDebugPanel()
}

/** Remove debug styles */
function removeDebugStyles(): void {
	document.getElementById('mvp-infinite-debug-styles')?.remove()
	document.getElementById('mvp-infinite-debug-panel')?.remove()
}

// =============================================================================
// DEBUG PANEL
// =============================================================================

/** Create or update the debug panel */
function createDebugPanel(): void {
	let panel = document.getElementById('mvp-infinite-debug-panel')
	if (!panel) {
		panel = document.createElement('div')
		panel.id = 'mvp-infinite-debug-panel'
		document.body.appendChild(panel)
	}
}

/** Update debug panel content */
export function updateDebugPanel(state: DebugState): void {
	const panel = document.getElementById('mvp-infinite-debug-panel')
	if (!panel || !debugMode) return

	const pagesStatus = state.pageBlocks
		.map(b => `<span class="${b.isLoaded ? 'loaded' : 'unloaded'}">${b.page}${b.isLoaded ? '✓' : '○'}</span>`)
		.join(' ')

	panel.innerHTML = `
		<h4>🔍 Infinite Scroll Debug</h4>
		<div class="row"><span>Página visible:</span><span>${state.visiblePage}</span></div>
		<div class="row"><span>Páginas cargadas:</span><span>${state.loadedPagesCount} / ${state.totalPages}</span></div>
		<div class="row"><span>Ventana activa:</span><span>[${state.currentWindow.start} - ${state.currentWindow.end}]</span></div>
		<div class="row"><span>En DOM:</span><span class="loaded">${state.loadedInDOM} páginas</span></div>
		<div class="row"><span>Placeholders:</span><span class="unloaded">${state.unloadedPlaceholders} páginas</span></div>
		<div style="margin-top: 8px; border-top: 1px solid #333; padding-top: 8px;">
			<span>Estado: ${pagesStatus}</span>
		</div>
		<div style="margin-top: 8px; font-size: 10px; color: #888;">
			✓ = en DOM | ○ = placeholder
		</div>
	`
}

/** Update all debug indicators */
export function updateDebugIndicators(state: DebugState): void {
	if (!debugMode) return
	updateDebugPanel(state)
}

// =============================================================================
// GLOBAL REGISTRATION
// =============================================================================

/**
 * Register debug functions globally.
 * Called when infinite scroll is injected.
 */
export function registerDebugGlobals(getStateFn: () => DebugState): void {
	if (typeof window === 'undefined') return
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const win = window as any
	win.mvInfiniteScrollDebug = toggleInfiniteScrollDebug
	win.mvInfiniteScrollState = getStateFn
	logger.info('Infinite Scroll debug disponible: mvInfiniteScrollDebug(true) | mvInfiniteScrollState()')
}
