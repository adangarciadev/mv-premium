import { describe, expect, it } from 'vitest'
import { parseMvThemeEnabled } from './theme-state'

describe('parseMvThemeEnabled', () => {
	it('returns false for empty values', () => {
		expect(parseMvThemeEnabled(undefined)).toBe(false)
		expect(parseMvThemeEnabled(null)).toBe(false)
		expect(parseMvThemeEnabled('')).toBe(false)
	})

	it('reads object payloads', () => {
		expect(parseMvThemeEnabled({ enabled: true })).toBe(true)
		expect(parseMvThemeEnabled({ enabled: false })).toBe(false)
		expect(parseMvThemeEnabled({})).toBe(false)
	})

	it('reads stringified JSON payloads', () => {
		expect(parseMvThemeEnabled('{"enabled":true}')).toBe(true)
		expect(parseMvThemeEnabled('{"enabled":false}')).toBe(false)
	})

	it('fails closed on invalid JSON', () => {
		expect(parseMvThemeEnabled('{enabled:true}')).toBe(false)
		expect(parseMvThemeEnabled('not-json')).toBe(false)
	})
})
