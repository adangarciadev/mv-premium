import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	getCachedUserAnalysis,
	setCachedUserAnalysis,
	getCachedUserAnalysisAge,
	getCachedUserAnalysisMulti,
	setCachedUserAnalysisMulti,
	getCachedUserAnalysisMultiAge,
	formatCacheAge,
} from './summary-cache'
import type { UserAnalysis } from './analyze-user'

function makeAnalysis(overrides: Partial<UserAnalysis> = {}): UserAnalysis {
	return {
		username: 'TestUser',
		tagline: 'A tagline',
		profile: 'A profile',
		topics: ['topic1'],
		interactions: ['interaction1'],
		style: 'direct',
		highlights: ['highlight1'],
		verdict: 'A verdict',
		title: 'Thread title',
		postsAnalyzed: 10,
		...overrides,
	}
}

// The cache uses window.location.pathname as part of the key
beforeEach(() => {
	Object.defineProperty(window, 'location', {
		value: { pathname: '/foro/test/thread-123' },
		writable: true,
	})
})

// =============================================================================
// SINGLE-PAGE USER ANALYSIS CACHE
// =============================================================================

describe('user analysis single-page cache', () => {
	it('returns null for uncached entry', () => {
		expect(getCachedUserAnalysis('Unknown', 1)).toBeNull()
	})

	it('stores and retrieves an analysis', () => {
		const analysis = makeAnalysis()
		setCachedUserAnalysis('TestUser', 1, analysis)
		expect(getCachedUserAnalysis('TestUser', 1)).toEqual(analysis)
	})

	it('does not cache analyses with errors', () => {
		const analysis = makeAnalysis({ error: 'something failed' })
		setCachedUserAnalysis('ErrorUser', 1, analysis)
		expect(getCachedUserAnalysis('ErrorUser', 1)).toBeNull()
	})

	it('normalizes username case for cache key', () => {
		const analysis = makeAnalysis()
		setCachedUserAnalysis('TestUser', 1, analysis)
		expect(getCachedUserAnalysis('testuser', 1)).toEqual(analysis)
		expect(getCachedUserAnalysis('TESTUSER', 1)).toEqual(analysis)
	})

	it('differentiates by page number', () => {
		const a1 = makeAnalysis({ postsAnalyzed: 5 })
		const a2 = makeAnalysis({ postsAnalyzed: 10 })
		setCachedUserAnalysis('User', 1, a1)
		setCachedUserAnalysis('User', 2, a2)
		expect(getCachedUserAnalysis('User', 1)?.postsAnalyzed).toBe(5)
		expect(getCachedUserAnalysis('User', 2)?.postsAnalyzed).toBe(10)
	})

	it('returns null and cleans up after TTL expires', () => {
		const analysis = makeAnalysis()
		setCachedUserAnalysis('Expired', 1, analysis)

		// Fast-forward 6 minutes
		vi.useFakeTimers()
		vi.advanceTimersByTime(6 * 60 * 1000)

		expect(getCachedUserAnalysis('Expired', 1)).toBeNull()
		vi.useRealTimers()
	})
})

describe('getCachedUserAnalysisAge', () => {
	it('returns null for uncached entry', () => {
		expect(getCachedUserAnalysisAge('Nobody', 1)).toBeNull()
	})

	it('returns age in ms for cached entry', () => {
		vi.useFakeTimers()
		const analysis = makeAnalysis()
		setCachedUserAnalysis('AgeUser', 5, analysis)

		vi.advanceTimersByTime(30_000)
		const age = getCachedUserAnalysisAge('AgeUser', 5)
		expect(age).toBeGreaterThanOrEqual(30_000)

		vi.useRealTimers()
	})

	it('returns null for expired entry', () => {
		vi.useFakeTimers()
		setCachedUserAnalysis('OldUser', 1, makeAnalysis())
		vi.advanceTimersByTime(6 * 60 * 1000)
		expect(getCachedUserAnalysisAge('OldUser', 1)).toBeNull()
		vi.useRealTimers()
	})
})

// =============================================================================
// MULTI-PAGE USER ANALYSIS CACHE
// =============================================================================

describe('user analysis multi-page cache', () => {
	it('returns null for uncached entry', () => {
		expect(getCachedUserAnalysisMulti('Unknown', 1, 5)).toBeNull()
	})

	it('stores and retrieves a multi-page analysis', () => {
		const analysis = makeAnalysis({ pagesAnalyzed: 5, pageRange: '1-5' })
		setCachedUserAnalysisMulti('User', 1, 5, analysis)
		expect(getCachedUserAnalysisMulti('User', 1, 5)).toEqual(analysis)
	})

	it('does not cache analyses with errors', () => {
		const analysis = makeAnalysis({ error: 'failed' })
		setCachedUserAnalysisMulti('ErrorMulti', 1, 5, analysis)
		expect(getCachedUserAnalysisMulti('ErrorMulti', 1, 5)).toBeNull()
	})

	it('normalizes username case', () => {
		const analysis = makeAnalysis()
		setCachedUserAnalysisMulti('MixedCase', 1, 3, analysis)
		expect(getCachedUserAnalysisMulti('mixedcase', 1, 3)).toEqual(analysis)
	})

	it('differentiates by page range', () => {
		const a1 = makeAnalysis({ pageRange: '1-3' })
		const a2 = makeAnalysis({ pageRange: '4-6' })
		setCachedUserAnalysisMulti('User', 1, 3, a1)
		setCachedUserAnalysisMulti('User', 4, 6, a2)
		expect(getCachedUserAnalysisMulti('User', 1, 3)?.pageRange).toBe('1-3')
		expect(getCachedUserAnalysisMulti('User', 4, 6)?.pageRange).toBe('4-6')
	})

	it('expires after TTL', () => {
		vi.useFakeTimers()
		setCachedUserAnalysisMulti('User', 1, 5, makeAnalysis())
		vi.advanceTimersByTime(6 * 60 * 1000)
		expect(getCachedUserAnalysisMulti('User', 1, 5)).toBeNull()
		vi.useRealTimers()
	})
})

describe('getCachedUserAnalysisMultiAge', () => {
	it('returns null for uncached entry', () => {
		expect(getCachedUserAnalysisMultiAge('Nobody', 1, 5)).toBeNull()
	})

	it('returns age in ms', () => {
		vi.useFakeTimers()
		setCachedUserAnalysisMulti('User', 1, 3, makeAnalysis())
		vi.advanceTimersByTime(45_000)
		const age = getCachedUserAnalysisMultiAge('User', 1, 3)
		expect(age).toBeGreaterThanOrEqual(45_000)
		vi.useRealTimers()
	})
})

// =============================================================================
// FORMAT CACHE AGE
// =============================================================================

describe('formatCacheAge', () => {
	it('formats seconds as "hace unos segundos"', () => {
		expect(formatCacheAge(5_000)).toBe('hace unos segundos')
		expect(formatCacheAge(59_000)).toBe('hace unos segundos')
	})

	it('formats minutes', () => {
		expect(formatCacheAge(60_000)).toBe('hace 1 min')
		expect(formatCacheAge(150_000)).toBe('hace 2 min')
		expect(formatCacheAge(300_000)).toBe('hace 5 min')
	})
})
