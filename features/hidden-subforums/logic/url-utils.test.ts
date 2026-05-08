import { describe, expect, it } from 'vitest'
import { extractSubforumSlugFromUrl, getHiddenSubforumMatch, isSubforumUrlHidden } from './url-utils'

describe('hidden-subforums url utils', () => {
	it('extracts valid subforum slugs from root and thread urls', () => {
		expect(extractSubforumSlugFromUrl('/foro/cine')).toBe('cine')
		expect(extractSubforumSlugFromUrl('/foro/cine/odisea-christopher-nolan-2026-715428')).toBe('cine')
		expect(extractSubforumSlugFromUrl('https://www.mediavida.com/foro/off-topic/hilo-123#4')).toBe('off-topic')
	})

	it('ignores non-subforum forum routes', () => {
		expect(extractSubforumSlugFromUrl('/foro/spy')).toBeNull()
		expect(extractSubforumSlugFromUrl('/foro/favoritos')).toBeNull()
		expect(extractSubforumSlugFromUrl('/buscar')).toBeNull()
	})

	it('checks whether a link belongs to a hidden subforum', () => {
		const hidden = new Set(['cine', 'tv'])

		expect(isSubforumUrlHidden('/foro/cine', hidden)).toBe(true)
		expect(isSubforumUrlHidden('/foro/tv/serie-123', hidden)).toBe(true)
		expect(isSubforumUrlHidden('/foro/juegos', hidden)).toBe(false)
	})

	it('returns the current hidden subforum match with root info', () => {
		const hidden = new Set(['cine'])

		expect(getHiddenSubforumMatch('/foro/cine', hidden)).toEqual({
			slug: 'cine',
			pathname: '/foro/cine',
			isSubforumRoot: true,
		})

		expect(getHiddenSubforumMatch('/foro/cine/odisea-123', hidden)).toEqual({
			slug: 'cine',
			pathname: '/foro/cine/odisea-123',
			isSubforumRoot: false,
		})

		expect(getHiddenSubforumMatch('/foro/juegos', hidden)).toBeNull()
	})
})
