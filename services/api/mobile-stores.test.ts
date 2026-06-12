import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchGooglePlayApp, searchItunesApp } from './mobile-stores'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('searchItunesApp', () => {
	it('returns the app when the title is a strong match', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					results: [
						{
							trackId: 1592081003,
							trackName: 'MARVEL SNAP',
							trackViewUrl: 'https://apps.apple.com/es/app/marvel-snap/id1592081003',
						},
					],
				})
			)
		)

		const result = await searchItunesApp('Marvel Snap')

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('itunes.apple.com/search')
		expect(result).toEqual({
			url: 'https://apps.apple.com/es/app/marvel-snap/id1592081003',
			storeId: '1592081003',
			name: 'MARVEL SNAP',
		})
	})

	it('rejects weak title matches to avoid attaching the wrong app', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					results: [
						{
							trackId: 1,
							trackName: 'Completely Different Game',
							trackViewUrl: 'https://apps.apple.com/es/app/other/id1',
						},
					],
				})
			)
		)

		const result = await searchItunesApp('Unmatchable Mobile Quest')

		expect(result).toBeNull()
	})
})

describe('searchGooglePlayApp', () => {
	it('extracts the first app result from the search page', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				'<html><a href="/store/apps/details?id=com.nvsgames.snap"><span>MARVEL SNAP</span></a>' +
					'<a href="/store/apps/details?id=com.other.game">Other</a></html>'
			)
		)

		const result = await searchGooglePlayApp('Snap Card Game')

		expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('play.google.com/store/search')
		expect(result).toEqual({
			url: 'https://play.google.com/store/apps/details?id=com.nvsgames.snap',
			storeId: 'com.nvsgames.snap',
			name: null,
		})
	})

	it('returns null when the page has no app results', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html>no results</html>'))

		const result = await searchGooglePlayApp('No Results Game Xyz')

		expect(result).toBeNull()
	})
})
