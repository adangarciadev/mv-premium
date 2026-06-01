import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_TEMPLATES, getFieldsForType } from './templates'

describe('media template types', () => {
	it('includes anime and manga defaults', () => {
		expect(DEFAULT_USER_TEMPLATES.anime).toBeNull()
		expect(DEFAULT_USER_TEMPLATES.manga).toBeNull()
	})

	it('exposes AniList fields for anime and manga templates', () => {
		expect(getFieldsForType('anime').map(field => field.key)).toContain('linksText')
		expect(getFieldsForType('manga').map(field => field.key)).toContain('authors')
	})
})
