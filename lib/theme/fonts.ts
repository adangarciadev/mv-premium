import { browser, type Browser } from 'wxt/browser'
import { customFontStorage, applyFontGloballyStorage } from './storage'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { STORAGE_KEYS } from '@/constants/storage-keys'

// Track loaded fonts to avoid duplicate <link> tags
const loadedFonts = new Set<string>()

// Track if global font listener is already initialized
let globalFontListenerInitialized = false

/**
 * Inject Google Font into the document head (global)
 * Fonts must be loaded globally, they cannot be loaded inside Shadow DOM
 * The CSS variable --font-sans will then reference the loaded font
 */
export function ensureGoogleFontLoaded(fontName: string) {
	if (!fontName || loadedFonts.has(fontName)) return

	const FONT_LINK_ID = `mvp-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`

	// Check if already exists in document
	if (document.getElementById(FONT_LINK_ID)) {
		loadedFonts.add(fontName)
		return
	}

	// Create <link> element in document head (not shadow DOM)
	const link = document.createElement('link')
	link.id = FONT_LINK_ID
	link.rel = 'stylesheet'
	link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(
		/\s+/g,
		'+'
	)}:wght@400;500;600;700&display=swap`
	document.head.appendChild(link)

	loadedFonts.add(fontName)
}

/**
 * Apply font globally to the entire website (not just extension components)
 */
function applyFontToWebsite(fontName: string, apply: boolean) {
	const GLOBAL_FONT_STYLE_ID = DOM_MARKERS.IDS.GLOBAL_FONT

	// Remove existing styles (including early inject to avoid duplicates)
	document.getElementById(GLOBAL_FONT_STYLE_ID)?.remove()
	document.getElementById(DOM_MARKERS.IDS.EARLY_FONT)?.remove()
	// Keep mvp-early-font (the <link>) as it's needed for the font to load

	if (!apply || !fontName) return

	// Create style that overrides the entire page's font
	// IMPORTANT: Exclude icon fonts (FontAwesome, Material Icons, etc.)
	const style = document.createElement('style')
	style.id = GLOBAL_FONT_STYLE_ID
	style.textContent = `
		/* Apply custom font to text elements only, excluding <i> tags which are typically icons */
		body, 
		body p, body span:not(.fa):not([class*="icon"]), 
		body div, body a, body li, body td, body th,
		body h1, body h2, body h3, body h4, body h5, body h6,
		body label, body input, body textarea, body button, body select,
		body article, body section, body header, body footer, body nav,
		body blockquote, body figcaption, body strong, body em, body b {
			font-family: "${fontName}", system-ui, -apple-system, sans-serif !important;
		}
		
		/* Restore FontAwesome font explicitly */
		.fa, .fas, .far, .fal, .fab, .fad, .fass,
		[class^="fa-"], [class*=" fa-"],
		i.fa, i[class*="fa-"] {
			font-family: "FontAwesome", "Font Awesome 6 Free", "Font Awesome 5 Free", "Font Awesome 5 Pro" !important;
		}
		
		/* Restore other icon fonts */
		.glyphicon, [class^="glyphicon-"],
		.material-icons, .material-icons-outlined,
		[class^="icon-"], [class*=" icon-"],
		i[class*="icon"] {
			font-family: unset !important;
		}
		
		/* Preserve monospace for code elements */
		code, pre, kbd, samp, tt, .monospace, [class*="code"], [class*="mono"] {
			font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace !important;
		}
	`
	document.head.appendChild(style)
}

/**
 * Initialize global font application listener
 * This applies the custom font to the entire website when enabled
 */
export function initGlobalFontListener(): () => void {
	if (globalFontListenerInitialized) return () => {}
	globalFontListenerInitialized = true

	const updateGlobalFont = async () => {
		const font = await customFontStorage.getValue()
		const applyGlobally = await applyFontGloballyStorage.getValue()

		if (font) {
			ensureGoogleFontLoaded(font)
		}
		applyFontToWebsite(font || '', applyGlobally === true)
	}

	// Initial application
	updateGlobalFont()

	// Listen for changes
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName === 'local') {
			if (changes[STORAGE_KEYS.CUSTOM_FONT] || changes[STORAGE_KEYS.APPLY_FONT_GLOBALLY]) {
				updateGlobalFont()
			}
		}
	}

	browser.storage.onChanged.addListener(listener)

	return () => {
		browser.storage.onChanged.removeListener(listener)
		globalFontListenerInitialized = false
	}
}
