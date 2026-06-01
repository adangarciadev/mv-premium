export const CONTENT_RULE_HIGHLIGHT_CLASS = 'mvp-content-rule-highlight'
export const CONTENT_RULE_HIDDEN_CLASS = 'mvp-content-rule-hidden'

export const CONTENT_RULE_HIGHLIGHT_VAR = '--mvp-content-rule-highlight-color'
export const CONTENT_RULE_HIGHLIGHT_TINT_PERCENT = 24
const DEFAULT_HIGHLIGHT_COLOR = '#f7be58'

function getRowCells(row: HTMLElement): HTMLElement[] {
	return Array.from(row.children).filter(
		(child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'TD'
	)
}

function applyInlineHighlight(row: HTMLElement, highlightColor?: string): void {
	const color = highlightColor || DEFAULT_HIGHLIGHT_COLOR
	const value = `color-mix(in srgb, ${color} ${CONTENT_RULE_HIGHLIGHT_TINT_PERCENT}%, transparent)`
	for (const cell of getRowCells(row)) {
		cell.style.setProperty('background-color', value, 'important')
	}
}

function clearInlineHighlight(row: HTMLElement): void {
	for (const cell of getRowCells(row)) {
		cell.style.removeProperty('background-color')
	}
}

export function applyContentRuleRowState(
	row: HTMLElement,
	action: 'hide' | 'highlight' | null,
	hiddenClass: string,
	highlightColor?: string
): void {
	if (action === 'hide') {
		row.classList.add(hiddenClass, CONTENT_RULE_HIDDEN_CLASS)
		row.classList.remove(CONTENT_RULE_HIGHLIGHT_CLASS)
		row.style.removeProperty(CONTENT_RULE_HIGHLIGHT_VAR)
		clearInlineHighlight(row)
		return
	}

	row.classList.remove(CONTENT_RULE_HIDDEN_CLASS)
	if (action === 'highlight') {
		row.classList.add(CONTENT_RULE_HIGHLIGHT_CLASS)
		if (highlightColor) {
			row.style.setProperty(CONTENT_RULE_HIGHLIGHT_VAR, highlightColor)
		} else {
			row.style.removeProperty(CONTENT_RULE_HIGHLIGHT_VAR)
		}
		applyInlineHighlight(row, highlightColor)
		return
	}

	row.classList.remove(CONTENT_RULE_HIGHLIGHT_CLASS)
	row.style.removeProperty(CONTENT_RULE_HIGHLIGHT_VAR)
	clearInlineHighlight(row)
}
