import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings-defaults'
import { validateSettings } from './settings-schema'

describe('settings schema', () => {
	it('defaults classic thread actions to compact menu mode', () => {
		expect(DEFAULT_SETTINGS.classicThreadActionsEnabled).toBe(false)
		expect(validateSettings({}).classicThreadActionsEnabled).toBe(false)
	})

	it('defaults legacy activity heatmap tracking to opt-in', () => {
		expect(DEFAULT_SETTINGS.enableActivityTracking).toBe(false)
		expect(validateSettings({}).enableActivityTracking).toBe(false)
	})

	it('defaults related threads to hidden', () => {
		expect(DEFAULT_SETTINGS.relatedThreadsDisplay).toBe('hidden')
		expect(validateSettings({}).relatedThreadsDisplay).toBe('hidden')
	})

	it('accepts every related thread display mode', () => {
		for (const mode of ['hidden', 'collapsible', 'original'] as const) {
			expect(validateSettings({ relatedThreadsDisplay: mode }).relatedThreadsDisplay).toBe(mode)
		}
	})

	it('rejects an invalid related thread display mode', () => {
		expect(() => validateSettings({ relatedThreadsDisplay: 'expanded' })).toThrow()
	})
})
