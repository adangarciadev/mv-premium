import { describe, expect, it } from 'vitest'
import { getMobileLiteDevActivation, getUrlWithoutMobileLiteDevParam } from './dev-activation'

describe('mobile lite dev activation', () => {
	it('detects enable query value', () => {
		expect(getMobileLiteDevActivation('?mvp_mobile_lite=enable')).toBe('enable')
	})

	it('detects disable query value', () => {
		expect(getMobileLiteDevActivation('?mvp_mobile_lite=disable')).toBe('disable')
	})

	it('detects enable hash value', () => {
		expect(getMobileLiteDevActivation('', '#mvp_mobile_lite=enable')).toBe('enable')
	})

	it('detects disable hash value', () => {
		expect(getMobileLiteDevActivation('', '#mvp_mobile_lite=disable')).toBe('disable')
	})

	it('ignores unknown values', () => {
		expect(getMobileLiteDevActivation('?mvp_mobile_lite=true')).toBeNull()
	})

	it('removes only the mobile lite dev param from an URL', () => {
		expect(getUrlWithoutMobileLiteDevParam('https://www.mediavida.com/foro/cine/hilo-1?x=1&mvp_mobile_lite=enable#p2')).toBe(
			'/foro/cine/hilo-1?x=1#p2'
		)
	})

	it('removes the mobile lite dev param from a URL hash', () => {
		expect(getUrlWithoutMobileLiteDevParam('https://www.mediavida.com/foro/cine/hilo-1#x=1&mvp_mobile_lite=enable')).toBe(
			'/foro/cine/hilo-1#x=1'
		)
	})
})
