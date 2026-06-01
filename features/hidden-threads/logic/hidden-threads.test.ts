import { describe, expect, it } from 'vitest'
import { getThreadActionsPresentation } from './thread-actions'

describe('hidden thread action presentation', () => {
	it('uses the compact menu by default when any thread action is available', () => {
		expect(getThreadActionsPresentation({
			hideEnabled: true,
			saveEnabled: true,
			contentRulesEnabled: true,
			classicActionsEnabled: false,
		})).toBe('compact-menu')
	})

	it('uses classic buttons when the classic setting is enabled', () => {
		expect(getThreadActionsPresentation({
			hideEnabled: true,
			saveEnabled: true,
			contentRulesEnabled: true,
			classicActionsEnabled: true,
		})).toBe('classic-buttons')
	})

	it('does not show classic controls when save and hide actions are disabled', () => {
		expect(getThreadActionsPresentation({
			hideEnabled: false,
			saveEnabled: false,
			contentRulesEnabled: true,
			classicActionsEnabled: true,
		})).toBe('none')
	})
})
