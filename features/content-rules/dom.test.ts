import { describe, expect, it } from 'vitest'
import {
	applyContentRuleRowState,
	CONTENT_RULE_HIDDEN_CLASS,
	CONTENT_RULE_HIGHLIGHT_CLASS,
	CONTENT_RULE_HIGHLIGHT_TINT_PERCENT,
	CONTENT_RULE_HIGHLIGHT_VAR,
} from './dom'

describe('content rules DOM helpers', () => {
	it('hides rows for hide matches', () => {
		const row = document.createElement('tr')

		applyContentRuleRowState(row, 'hide', 'mvp-hidden-thread')

		expect(row.classList.contains('mvp-hidden-thread')).toBe(true)
		expect(row.classList.contains(CONTENT_RULE_HIDDEN_CLASS)).toBe(true)
		expect(row.classList.contains(CONTENT_RULE_HIGHLIGHT_CLASS)).toBe(false)
	})

	it('highlights rows for highlight matches', () => {
		const row = document.createElement('tr')
		const cell = document.createElement('td')
		row.appendChild(cell)

		applyContentRuleRowState(row, 'highlight', 'mvp-hidden-thread', '#ff0000')

		expect(row.classList.contains(CONTENT_RULE_HIGHLIGHT_CLASS)).toBe(true)
		expect(row.classList.contains('mvp-hidden-thread')).toBe(false)
		expect(row.style.getPropertyValue(CONTENT_RULE_HIGHLIGHT_VAR)).toBe('#ff0000')
		expect(cell.style.getPropertyPriority('background-color')).toBe('important')
		expect(cell.getAttribute('style')).toContain('color-mix(in srgb')
		expect(cell.getAttribute('style')).toContain(`${CONTENT_RULE_HIGHLIGHT_TINT_PERCENT}%, transparent)`)
	})

	it('cleans rule classes when no rule matches', () => {
		const row = document.createElement('tr')
		const cell = document.createElement('td')
		row.appendChild(cell)
		row.classList.add(CONTENT_RULE_HIDDEN_CLASS, CONTENT_RULE_HIGHLIGHT_CLASS)
		cell.style.setProperty('background-color', 'red', 'important')

		applyContentRuleRowState(row, null, 'mvp-hidden-thread')

		expect(row.classList.contains(CONTENT_RULE_HIDDEN_CLASS)).toBe(false)
		expect(row.classList.contains(CONTENT_RULE_HIGHLIGHT_CLASS)).toBe(false)
		expect(row.style.getPropertyValue(CONTENT_RULE_HIGHLIGHT_VAR)).toBe('')
		expect(cell.style.getPropertyValue('background-color')).toBe('')
	})
})
