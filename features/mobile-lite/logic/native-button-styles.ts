/**
 * Premium pill recipe (DESIGN.md §5) translated to plain CSS for native
 * light-DOM `.btn` elements injected outside the Shadow DOM panel (Live,
 * Galería). Tokens come from DESIGN.md §2 — do not introduce new hex values
 * here without adding them to the design system first.
 */
export function getPremiumPillButtonCss(selector: string): string {
	return `
		${selector} {
			background: linear-gradient(180deg, rgba(240,160,32,0.22) 0%, rgba(240,160,32,0.07) 100%) !important;
			border-color: rgba(240,160,32,0.25) !important;
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.35) !important;
			color: #f0a020 !important;
			letter-spacing: 0 !important;
			text-decoration: none !important;
			text-transform: none !important;
		}
		${selector}:active {
			background: linear-gradient(180deg, rgba(240,160,32,0.3) 0%, rgba(240,160,32,0.12) 100%) !important;
		}
	`
}
