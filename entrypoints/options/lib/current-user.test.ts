import { describe, expect, it } from 'vitest'
import { getLargeAvatarUrl } from './current-user'

describe('getLargeAvatarUrl', () => {
	it('derives the full-size variant from the navbar avatar', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/img/users/avatar/4y/4ypDNabBJ.png')).toBe(
			'https://www.mediavida.com/img/users/avatar/4y/4ypDNabBJ_full.png'
		)
	})

	it('keeps the original extension', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/img/users/avatar/1u/1ux9btqhd.gif')).toBe(
			'https://www.mediavida.com/img/users/avatar/1u/1ux9btqhd_full.gif'
		)
	})

	it('upgrades the _big variant rather than stacking suffixes', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/img/users/avatar/6h/6hiy9r0Om_big.jpg')).toBe(
			'https://www.mediavida.com/img/users/avatar/6h/6hiy9r0Om_full.jpg'
		)
	})

	it('returns null when the avatar is already full size', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/img/users/avatar/4y/4ypDNabBJ_full.png')).toBeNull()
	})

	it('works with protocol-relative and root-relative URLs', () => {
		expect(getLargeAvatarUrl('/img/users/avatar/4y/4ypDNabBJ.png')).toBe('/img/users/avatar/4y/4ypDNabBJ_full.png')
	})

	it('ignores URLs that are not Mediavida avatars', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/style/img/pix.gif')).toBeNull()
		expect(getLargeAvatarUrl('https://example.com/avatar.png')).toBeNull()
	})

	it('ignores an avatar URL with no file extension', () => {
		expect(getLargeAvatarUrl('https://www.mediavida.com/img/users/avatar/4y/4ypDNabBJ')).toBeNull()
	})
})
