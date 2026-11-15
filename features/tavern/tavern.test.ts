import { afterEach, expect, it, vi } from 'vitest'
import { injectTavernLinks } from './links'
import { prefillTavernLobby } from './prefill'

afterEach(() => {
	document.body.replaceChildren()
	history.replaceState(null, '', '/')
})

it('opens the bar without sharing a nick when browsing as a guest', () => {
	document.body.innerHTML = '<div id="more-actions"></div>'
	injectTavernLinks(true, 'gamedev')
	injectTavernLinks(true, 'gamedev')
	const links = document.querySelectorAll<HTMLAnchorElement>('#more-actions a')
	expect(links).toHaveLength(1)
	expect(links[0].href).toBe('https://taberna.d.jacobocaraballo.com/gamedev')
	expect(links[0].rel).toContain('noreferrer')
	expect(links[0].target).toBe('_blank')
})

it.each([['dev', 'desarrollo'], ['cine', null]] as const)('prefills the nick from %s and selects only a matching bar', async (slug, room) => {
	const nick = 'Míke+A&B'
	document.body.innerHTML = `<a id="user-data"><span></span></a><div class="forum-nav"><a href="/foro/${slug}/nuevo-hilo">Nuevo hilo</a></div>`
	document.querySelector('#user-data span')!.textContent = nick
	injectTavernLinks(false, slug)
	const group = document.querySelector('#mvp-gamedev-tavern')!
	expect(group.nextElementSibling?.textContent).toBe('Nuevo hilo')
	expect(group.querySelector('button')?.textContent).toContain('Taberna')
	const links = group.querySelectorAll<HTMLAnchorElement>('a')
	expect(links[1].hash).toBe('')
	const lobby = new URL(links[0].href)
	expect(lobby.origin + lobby.pathname).toBe('https://taberna.d.jacobocaraballo.com/')
	history.replaceState(null, '', '/' + lobby.hash)
	document.body.innerHTML = '<div id="username-dialog"><input id="username-input" maxlength="15"><div id="room-options"></div><button id="start-button"></button></div>'
	const started = vi.fn()
	document.querySelector('#start-button')!.addEventListener('click', started)
	const cleanup = prefillTavernLobby()
	expect(location.hash).toBe('')
	const option = document.createElement('button')
	option.dataset.room = 'desarrollo'
	const selected = vi.fn()
	option.addEventListener('click', selected)
	document.querySelector('#room-options')!.append(option)
	const input = document.querySelector<HTMLInputElement>('#username-input')!
	input.value = 'Nick anterior'
	await Promise.resolve()
	expect(input.value).toBe(nick)
	expect(selected).toHaveBeenCalledTimes(room ? 1 : 0)
	expect(started).not.toHaveBeenCalled()
	cleanup?.()
})
