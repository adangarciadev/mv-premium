import { describe, expect, it } from 'vitest'
import { getAvatarUrlFromImage, sanitizeAvatarUrl } from './avatar-utils'

describe('sanitizeAvatarUrl', () => {
	it('accepts real avatar URLs', () => {
		expect(sanitizeAvatarUrl('https://mediavida.com/img/users/avatar/usuario.jpg')).toBe(
			'https://mediavida.com/img/users/avatar/usuario.jpg'
		)
	})

	it('rejects empty values', () => {
		expect(sanitizeAvatarUrl(undefined)).toBeUndefined()
		expect(sanitizeAvatarUrl(null)).toBeUndefined()
		expect(sanitizeAvatarUrl('')).toBeUndefined()
	})

	it('rejects lazy-load placeholders and data URIs', () => {
		expect(sanitizeAvatarUrl('https://mediavida.com/style/img/pix.gif')).toBeUndefined()
		expect(sanitizeAvatarUrl('https://mediavida.com/style/img/anything.png')).toBeUndefined()
		expect(sanitizeAvatarUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toBeUndefined()
	})
})

describe('getAvatarUrlFromImage', () => {
	it('prefers the lazy-load data-src over a placeholder src', () => {
		const img = document.createElement('img')
		img.src = 'https://mediavida.com/style/img/pix.gif'
		img.setAttribute('data-src', 'https://mediavida.com/img/users/avatar/usuario.jpg')

		expect(getAvatarUrlFromImage(img)).toBe('https://mediavida.com/img/users/avatar/usuario.jpg')
	})

	it('falls back to src when there is no data-src', () => {
		const img = document.createElement('img')
		img.src = 'https://mediavida.com/img/users/avatar/usuario.jpg'

		expect(getAvatarUrlFromImage(img)).toBe('https://mediavida.com/img/users/avatar/usuario.jpg')
	})

	it('returns undefined for placeholder-only images and missing images', () => {
		const img = document.createElement('img')
		img.src = 'https://mediavida.com/style/img/pix.gif'

		expect(getAvatarUrlFromImage(img)).toBeUndefined()
		expect(getAvatarUrlFromImage(null)).toBeUndefined()
	})
})
