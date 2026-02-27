import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

import { buildPageUrl } from './fetch-pages'

function setLocation(pathAndQuery: string): void {
	window.history.replaceState({}, '', pathAndQuery)
}

describe('fetch-pages buildPageUrl', () => {
	beforeEach(() => {
		setLocation('/foro/politica/hilo-123')
	})

	it('builds standard thread page URLs without user filter', () => {
		const baseUrl = '/foro/politica/hilo-123'

		expect(buildPageUrl(baseUrl, 1)).toBe(`${window.location.origin}${baseUrl}`)
		expect(buildPageUrl(baseUrl, 5)).toBe(`${window.location.origin}${baseUrl}/5`)
	})

	it('removes stale pagina param when requesting page 1 in user-filter mode', () => {
		setLocation('/foro/politica/hilo-123?u=OnE&pagina=8')

		const result = new URL(buildPageUrl('/foro/politica/hilo-123', 1))
		expect(result.pathname).toBe('/foro/politica/hilo-123')
		expect(result.searchParams.get('u')).toBe('OnE')
		expect(result.searchParams.has('pagina')).toBe(false)
	})

	it('updates pagina param for pages > 1 in user-filter mode', () => {
		setLocation('/foro/politica/hilo-123?u=OnE&pagina=8')

		const result = new URL(buildPageUrl('/foro/politica/hilo-123', 3))
		expect(result.pathname).toBe('/foro/politica/hilo-123')
		expect(result.searchParams.get('u')).toBe('OnE')
		expect(result.searchParams.get('pagina')).toBe('3')
	})

	it('preserves unrelated query params in user-filter mode', () => {
		setLocation('/foro/politica/hilo-123?u=OnE&foo=bar&pagina=8')

		const result = new URL(buildPageUrl('/foro/politica/hilo-123', 1))
		expect(result.searchParams.get('u')).toBe('OnE')
		expect(result.searchParams.get('foo')).toBe('bar')
		expect(result.searchParams.has('pagina')).toBe(false)
	})
})
