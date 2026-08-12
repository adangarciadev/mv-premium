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
})
