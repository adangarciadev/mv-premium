import { describe, it, expect, vi } from 'vitest'

vi.mock('@/services/ai/gemini-service', () => ({ getAIService: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('./fetch-pages', () => ({ fetchMultiplePages: vi.fn() }))

import { normalizeUserAnalysisPayload, normalizeText, normalizeStringList } from './analyze-user'

describe('normalizeText', () => {
	it('trims and collapses whitespace', () => {
		expect(normalizeText('  hello   world  ')).toBe('hello world')
	})

	it('returns empty string for non-string input', () => {
		expect(normalizeText(null)).toBe('')
		expect(normalizeText(undefined)).toBe('')
		expect(normalizeText(42)).toBe('')
		expect(normalizeText({})).toBe('')
	})

	it('handles empty string', () => {
		expect(normalizeText('')).toBe('')
		expect(normalizeText('   ')).toBe('')
	})

	it('preserves single-spaced text', () => {
		expect(normalizeText('already clean')).toBe('already clean')
	})
})

describe('normalizeStringList', () => {
	it('returns empty array for non-array input', () => {
		expect(normalizeStringList(null)).toEqual([])
		expect(normalizeStringList(undefined)).toEqual([])
		expect(normalizeStringList('string')).toEqual([])
		expect(normalizeStringList(42)).toEqual([])
	})

	it('filters out empty and whitespace-only strings', () => {
		expect(normalizeStringList(['hello', '', '   ', 'world'])).toEqual(['hello', 'world'])
	})

	it('deduplicates case-insensitively', () => {
		expect(normalizeStringList(['Hello', 'hello', 'HELLO'])).toEqual(['Hello'])
	})

	it('normalizes whitespace within items', () => {
		expect(normalizeStringList(['  too   many   spaces  '])).toEqual(['too many spaces'])
	})

	it('filters non-string items', () => {
		expect(normalizeStringList(['valid', 42, null, 'also valid'])).toEqual(['valid', 'also valid'])
	})

	it('preserves order of first occurrence', () => {
		expect(normalizeStringList(['beta', 'alpha', 'Beta', 'gamma'])).toEqual(['beta', 'alpha', 'gamma'])
	})
})

describe('normalizeUserAnalysisPayload', () => {
	it('normalizes all fields of a payload', () => {
		const raw = {
			tagline: '  The   troll  ',
			profile: 'A  very  active  user',
			topics: ['topic A', 'Topic A', '  topic B  '],
			interactions: ['interacts with @Pepe', 'Interacts With @Pepe'],
			style: '  direct  and  sharp  ',
			highlights: ['highlight 1', '', 'highlight 2'],
			verdict: '  final   verdict  ',
		}

		const result = normalizeUserAnalysisPayload(raw)

		expect(result.tagline).toBe('The troll')
		expect(result.profile).toBe('A very active user')
		expect(result.topics).toEqual(['topic A', 'topic B'])
		expect(result.interactions).toEqual(['interacts with @Pepe'])
		expect(result.style).toBe('direct and sharp')
		expect(result.highlights).toEqual(['highlight 1', 'highlight 2'])
		expect(result.verdict).toBe('final verdict')
	})

	it('handles missing or invalid fields gracefully', () => {
		const raw = {
			tagline: undefined,
			profile: null,
			topics: 'not an array',
			interactions: undefined,
			style: 42,
			highlights: [],
			verdict: '',
		} as any

		const result = normalizeUserAnalysisPayload(raw)

		expect(result.tagline).toBe('')
		expect(result.profile).toBe('')
		expect(result.topics).toEqual([])
		expect(result.interactions).toEqual([])
		expect(result.style).toBe('')
		expect(result.highlights).toEqual([])
		expect(result.verdict).toBe('')
	})

	it('normalizes accidental numeric @refs to #refs in interactions/highlights', () => {
		const raw = {
			tagline: 'tag',
			profile: 'profile',
			topics: ['topic'],
			interactions: ['@377: Le responde en seco', '#377: Le responde en seco', 'Debate con @Pepe en #779'],
			style: 'style',
			highlights: ['@921 [👍1]: Momento irónico', '#921 [👍1]: Momento irónico'],
			verdict: 'verdict',
		}

		const result = normalizeUserAnalysisPayload(raw)

		expect(result.interactions).toEqual(['#377: Le responde en seco', 'Debate con @Pepe en #779'])
		expect(result.highlights).toEqual(['#921 [👍1]: Momento irónico'])
	})
})
