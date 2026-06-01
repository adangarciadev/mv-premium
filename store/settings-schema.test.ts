import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './settings-defaults'
import { validateSettings } from './settings-schema'

describe('settings schema', () => {
	it('defaults classic thread actions to compact menu mode', () => {
		expect(DEFAULT_SETTINGS.classicThreadActionsEnabled).toBe(false)
		expect(validateSettings({}).classicThreadActionsEnabled).toBe(false)
	})
})
