import { describe, expect, it } from 'vitest'
import { normalizeFilterTab } from './filters-tabs'

describe('filters tabs', () => {
	it('defaults to thread filters for missing or unknown tabs', () => {
		expect(normalizeFilterTab(null)).toBe('threads')
		expect(normalizeFilterTab('legacy')).toBe('threads')
	})

	it('accepts the supported filter tabs', () => {
		expect(normalizeFilterTab('words')).toBe('words')
		expect(normalizeFilterTab('users')).toBe('users')
		expect(normalizeFilterTab('hidden-threads')).toBe('hidden-threads')
		expect(normalizeFilterTab('hidden-subforums')).toBe('hidden-subforums')
	})
})
