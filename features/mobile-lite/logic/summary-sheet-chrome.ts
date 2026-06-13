/**
 * Shared "summary sheet open" chrome for Mobile Lite result sheets (thread &
 * post summaries). While a sheet is open, MV's fixed bottom nav
 * (#bottom-nav, MV_SELECTORS.THREAD.BOTTOM_NAV_ID) is hidden so it can't cover
 * the sheet's footer buttons (Copiar / Cerrar / Configurar IA).
 *
 * The sheet renders inside Shadow DOM and can't style the light-DOM bar, so a
 * light-DOM rule is injected once and a <body> class is toggled with the sheet.
 */

const STYLE_ID = 'mvp-mobile-lite-summary-sheet-chrome'
const BODY_CLASS = 'mvp-mobile-lite-summary-open'

export function ensureSummarySheetChromeStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		body.${BODY_CLASS} #bottom-nav {
			display: none !important;
		}
	`
	document.head.appendChild(style)
}

export function setSummarySheetOpen(isOpen: boolean): void {
	document.body.classList.toggle(BODY_CLASS, isOpen)
}

export function teardownSummarySheetChrome(): void {
	document.getElementById(STYLE_ID)?.remove()
	document.body.classList.remove(BODY_CLASS)
}
