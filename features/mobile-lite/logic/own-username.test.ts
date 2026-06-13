import { afterEach, describe, expect, it } from 'vitest'
import { getOwnUsername, resetOwnUsernameCache } from './own-username'

describe('getOwnUsername', () => {
	afterEach(() => {
		resetOwnUsernameCache()
		document.body.innerHTML = ''
	})

	it('reads the logged-in username from the user menu, lowercased', () => {
		document.body.innerHTML = '<ul id="usermenu"><li><a href="/id/MiNick">MiNick</a></li></ul>'

		expect(getOwnUsername()).toBe('minick')
	})

	it('returns null when the user menu has no profile link', () => {
		document.body.innerHTML = '<ul id="usermenu"><li><a href="/logout">Salir</a></li></ul>'

		expect(getOwnUsername()).toBeNull()
	})

	it('does not cache a missing profile link before the user menu is ready', () => {
		document.body.innerHTML = ''
		expect(getOwnUsername()).toBeNull()

		document.body.innerHTML = '<ul id="usermenu"><li><a href="/id/LateUser">LateUser</a></li></ul>'
		expect(getOwnUsername()).toBe('lateuser')
	})

	it('caches detected usernames until reset', () => {
		document.body.innerHTML = '<ul id="usermenu"><li><a href="/id/MiNick">MiNick</a></li></ul>'
		expect(getOwnUsername()).toBe('minick')

		document.body.innerHTML = ''
		expect(getOwnUsername()).toBe('minick')

		resetOwnUsernameCache()
		expect(getOwnUsername()).toBeNull()
	})

	it('decodes percent-encoded usernames', () => {
		document.body.innerHTML = '<ul id="usermenu"><li><a href="/id/Mi%C3%91ick">MiÑick</a></li></ul>'

		expect(getOwnUsername()).toBe('miñick')
	})
})
