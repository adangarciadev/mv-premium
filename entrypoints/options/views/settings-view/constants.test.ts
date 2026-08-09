import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/store/settings-defaults'
import { getSettingById, settingMatchesQuickFilter, settingMatchesQuery } from './constants'

describe('related threads settings metadata', () => {
	it('makes the related-thread preference searchable', () => {
		const setting = getSettingById('related-threads-display')

		expect(setting).not.toBeNull()
		expect(settingMatchesQuery(setting!, 'desplegable')).toBe(true)
		expect(setting?.settingKeys).toEqual(['relatedThreadsDisplay'])
	})

	it('treats hidden as disabled and visible modes as enabled', () => {
		const setting = getSettingById('related-threads-display')!

		expect(
			settingMatchesQuickFilter(setting, 'disabled', {
				...DEFAULT_SETTINGS,
				relatedThreadsDisplay: 'hidden',
			}),
		).toBe(true)
		expect(
			settingMatchesQuickFilter(setting, 'enabled', {
				...DEFAULT_SETTINGS,
				relatedThreadsDisplay: 'collapsible',
			}),
		).toBe(true)
	})
})
