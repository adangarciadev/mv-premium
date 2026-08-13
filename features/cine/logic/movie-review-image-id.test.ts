import { describe, expect, it } from 'vitest'
import { extractImageId, MIN_IMAGE_ID_LENGTH, sourceMatchesImageId } from './movie-review-image-id'

/**
 * The two hosts the extension uploads to put their identifier in different places, so both
 * shapes are covered explicitly. Getting this wrong is silent: reviews would simply never
 * be confirmed as published.
 */
describe('extractImageId', () => {
	it('takes the filename stem when the host puts its id there (freeimage.host)', () => {
		expect(extractImageId('https://iili.io/4ypDNabBJ.png')).toBe('4ypDNabBJ')
	})

	it('keeps the directory when the host puts its id there (ImgBB)', () => {
		expect(extractImageId('https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg')).toBe('0jZ8XKq/image-1700000000000')
	})

	it('keeps two ImgBB uploads apart even when our generated filename repeats', () => {
		expect(extractImageId('https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg')).not.toBe(
			extractImageId('https://i.ibb.co/9aBcDeF/image-1700000000000.jpg')
		)
	})

	it('gives the same identifier regardless of protocol', () => {
		expect(extractImageId('http://iili.io/4ypDNabBJ.png')).toBe(extractImageId('https://iili.io/4ypDNabBJ.png'))
	})

	it('strips the size suffix so a resized variant matches the original', () => {
		expect(extractImageId('https://iili.io/4ypDNabBJ_th.png')).toBe('4ypDNabBJ')
		expect(extractImageId('https://iili.io/4ypDNabBJ_md.jpg')).toBe('4ypDNabBJ')
	})

	it('returns null below the minimum length, so a short id never risks a false match', () => {
		expect(MIN_IMAGE_ID_LENGTH).toBe(6)
		expect(extractImageId('https://iili.io/abc.png')).toBeNull()
		expect(extractImageId('https://iili.io/ab12.png')).toBeNull()
	})

	it('returns null for empty or path-less input', () => {
		expect(extractImageId('')).toBeNull()
		expect(extractImageId('https://iili.io/')).toBeNull()
	})

	it('returns null for arbitrary text, which URL parsing silently turns into a path', () => {
		expect(extractImageId('not a url at all')).toBeNull()
	})

	/**
	 * Mediavida does not serve external images directly. It rewrites them through wsrv.nl, so a
	 * published card never arrives at its original URL. These are real srcs taken from a live
	 * thread; without unwrapping them the proxy's own path is empty and nothing is found.
	 */
	describe('through Mediavida image proxy', () => {
		const PROXIED = 'https://wsrv.nl/?n=-1&output=webp&url=https%3A%2F%2Fiili.io%2FC687Ivj.png'

		it('unwraps the original URL from the proxy', () => {
			expect(extractImageId(PROXIED)).toBe('C687Ivj')
		})

		it('gives a proxied image the same identity as the original', () => {
			expect(extractImageId(PROXIED)).toBe(extractImageId('https://iili.io/C687Ivj.png'))
		})

		it('unwraps an ImgBB upload, whose identifier spans two path segments', () => {
			const proxied = `https://wsrv.nl/?url=${encodeURIComponent('https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg')}`

			expect(extractImageId(proxied)).toBe('0jZ8XKq/image-1700000000000')
		})

		it('still reads a URL that is not proxied at all', () => {
			expect(extractImageId('https://iili.io/C687Ivj.png')).toBe('C687Ivj')
		})

		it('ignores a url parameter that is not an absolute address', () => {
			expect(extractImageId('https://iili.io/C687Ivj.png?url=nope')).toBe('C687Ivj')
		})
	})
})

describe('sourceMatchesImageId', () => {
	it('matches the identifier inside the served src for both host shapes', () => {
		expect(sourceMatchesImageId('https://iili.io/4ypDNabBJ.png', '4ypDNabBJ')).toBe(true)
		expect(
			sourceMatchesImageId('https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg', '0jZ8XKq/image-1700000000000')
		).toBe(true)
	})

	it('matches a resized variant of the same upload', () => {
		expect(sourceMatchesImageId('https://iili.io/4ypDNabBJ_th.png', '4ypDNabBJ')).toBe(true)
	})

	it('does not match an unrelated image', () => {
		expect(sourceMatchesImageId('https://iili.io/ZZZZZZZZZ.png', '4ypDNabBJ')).toBe(false)
		expect(
			sourceMatchesImageId('https://i.ibb.co/ZZZZZZZ/image-1700000000000.jpg', '0jZ8XKq/image-1700000000000')
		).toBe(false)
	})

	it('refuses to match on an identifier below the minimum length', () => {
		expect(sourceMatchesImageId('https://iili.io/abc.png', 'abc')).toBe(false)
	})

	it('handles an empty source', () => {
		expect(sourceMatchesImageId('', '4ypDNabBJ')).toBe(false)
	})

	/**
	 * The published post never carries the raw URL, so this is the case that decides whether a
	 * review is ever confirmed as published.
	 */
	it('matches a card served through the Mediavida image proxy', () => {
		const proxied = 'https://wsrv.nl/?n=-1&output=webp&url=https%3A%2F%2Fiili.io%2FC687Ivj.png'

		expect(sourceMatchesImageId(proxied, 'C687Ivj')).toBe(true)
	})

	it('matches a proxied ImgBB card, whose slash is percent-encoded and defeats a raw substring test', () => {
		const imageId = '0jZ8XKq/image-1700000000000'
		const proxied = `https://wsrv.nl/?url=${encodeURIComponent('https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg')}`

		expect(proxied.includes(imageId)).toBe(false)
		expect(sourceMatchesImageId(proxied, imageId)).toBe(true)
	})

	it('does not match a different card behind the same proxy', () => {
		const proxied = `https://wsrv.nl/?url=${encodeURIComponent('https://iili.io/ZZZZZZZ.png')}`

		expect(sourceMatchesImageId(proxied, 'C687Ivj')).toBe(false)
	})
})
