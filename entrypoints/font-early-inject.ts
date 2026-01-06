/**
 * Early Font Injection Script
 *
 * This script runs at document_start (before DOM is parsed) to apply
 * the custom font immediately, preventing the "flash of original font".
 *
 * NOTE: This file intentionally uses browser.storage.local.get directly
 * instead of WXT storage.defineItem because:
 * 1. It runs at document_start before the full extension runtime initializes
 * 2. It needs fast synchronous-like access to avoid visual flash
 * 3. There are no reactivity requirements (one-time read on page load)
 * 4. WXT storage is designed for normal content scripts, not early injection
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	async main() {
		try {
			const data = await browser.storage.local.get(['mvp-custom-font', 'mvp-apply-font-globally'])
			const font = data['mvp-custom-font'] as string | undefined
			const applyGlobally = data['mvp-apply-font-globally'] as boolean | undefined

			if (!font || !applyGlobally) return

			// Create Google Font link
			const fontLink = document.createElement('link')
			fontLink.id = 'mvp-early-font'
			fontLink.rel = 'stylesheet'
			fontLink.href = `https://fonts.googleapis.com/css2?family=${font.replace(
				/\s+/g,
				'+'
			)}:wght@400;500;600;700&display=swap`

			// Create font override style
			const style = document.createElement('style')
			style.id = 'mvp-early-font-override'
			style.textContent = `
				body, 
				body p, body span:not(.fa):not([class*="icon"]), 
				body div, body a, body li, body td, body th,
				body h1, body h2, body h3, body h4, body h5, body h6,
				body label, body input, body textarea, body button, body select,
				body article, body section, body header, body footer, body nav,
				body blockquote, body figcaption, body strong, body em, body b {
					font-family: "${font}", system-ui, -apple-system, sans-serif !important;
				}
				.fa, .fas, .far, .fal, .fab, .fad, .fass,
				[class^="fa-"], [class*=" fa-"],
				i.fa, i[class*="fa-"] {
					font-family: "FontAwesome", "Font Awesome 6 Free", "Font Awesome 5 Free", "Font Awesome 5 Pro" !important;
				}
				.glyphicon, [class^="glyphicon-"],
				.material-icons, .material-icons-outlined,
				[class^="icon-"], [class*=" icon-"],
				i[class*="icon"] {
					font-family: unset !important;
				}
				code, pre, kbd, samp, tt, .monospace, [class*="code"], [class*="mono"] {
					font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace !important;
				}
			`

			// Inject as soon as possible
			const inject = () => {
				const target = document.head || document.documentElement
				if (target) {
					target.appendChild(fontLink)
					target.appendChild(style)
				} else {
					// Document not ready yet, wait a tiny bit
					setTimeout(inject, 0)
				}
			}

			inject()
		} catch (e) {
			// Silent fail - main content script will handle it
		}
	},
})
