import { describe, expect, it } from 'vitest'
import type { GameTemplateDataInput } from '@/types/templates'
import { generatePlaceholderData } from './placeholders'

describe('generatePlaceholderData', () => {
	it('suppresses desktop game store cards until a real game is selected', () => {
		const data = generatePlaceholderData('game') as GameTemplateDataInput

		expect(data.steamStoreUrl).toBeNull()
		expect(data.gogStoreUrl).toBeNull()
	})
})
