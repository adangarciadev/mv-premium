import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGogGameDetails } from './gog'

afterEach(() => {
	vi.restoreAllMocks()
})

function makeCatalogProduct(slug: string) {
	return {
		id: '1456460669',
		slug,
		title: "Baldur's Gate 3",
		storeLink: `https://www.gog.com/en/game/${slug}`,
		coverHorizontal: 'https://images.gog-statics.com/bg3.png',
		releaseDate: '2023.08.03',
		developers: ['Larian Studios'],
		genres: [
			{ name: 'Role-playing', slug: 'rpg' },
			{ name: 'Fantasy', slug: 'fantasy' },
		],
		operatingSystems: ['windows', 'osx'],
		price: {
			final: '44,99 €',
			base: '59,99 €',
			discount: '-25%',
		},
		reviewsRating: 46,
		reviewsCount: 8968,
	}
}

describe('fetchGogGameDetails', () => {
	it('maps only the exact catalog slug match', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					products: [makeCatalogProduct('baldurs_gate_3_digital_deluxe_edition_upgrade'), makeCatalogProduct('baldurs_gate_iii')],
				})
			)
		)

		const result = await fetchGogGameDetails('baldurs_gate_iii')

		expect(result).toEqual({
			slug: 'baldurs_gate_iii',
			title: "Baldur's Gate 3",
			storeUrl: 'https://www.gog.com/en/game/baldurs_gate_iii',
			coverHorizontal: 'https://images.gog-statics.com/bg3.png',
			releaseDate: '2023.08.03',
			developers: ['Larian Studios'],
			genres: ['Role-playing', 'Fantasy'],
			operatingSystems: ['windows', 'osx'],
			price: '44,99 €',
			originalPrice: '59,99 €',
			discountPercent: 25,
			reviewsRating: 4.6,
			reviewsCount: 8968,
		})

		const requestedUrl = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
		expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://catalog.gog.com/v1/catalog')
		expect(requestedUrl.searchParams.get('query')).toBe('like:baldurs gate iii')
		expect(requestedUrl.searchParams.get('countryCode')).toBe('ES')
		expect(requestedUrl.searchParams.get('locale')).toBe('es-ES')
		expect(requestedUrl.searchParams.get('currencyCode')).toBe('EUR')
	})

	it('returns null when the catalog has no exact slug match', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					products: [makeCatalogProduct('baldurs_gate_3_toolkit')],
				})
			)
		)

		await expect(fetchGogGameDetails('missing_game')).resolves.toBeNull()
	})

	it('rejects invalid slugs without requesting the catalog', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch')

		await expect(fetchGogGameDetails('../baldurs_gate_iii')).resolves.toBeNull()
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it('returns null for failed catalog responses', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('unavailable', { status: 503 }))

		await expect(fetchGogGameDetails('server_failure_game')).resolves.toBeNull()
	})
})
