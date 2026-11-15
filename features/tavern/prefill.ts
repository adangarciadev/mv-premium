import { NICK_PARAMETER, subforumRooms } from './location'

export function prefillTavernLobby(): (() => void) | undefined {
	const url = new URL(window.location.href)
	const params = new URLSearchParams(url.hash.slice(1))
	const requestedRoom = params.get('room')
	const nick = params.get(NICK_PARAMETER)?.trim()
	if (url.pathname !== '/' || !nick) return
	url.hash = ''
	history.replaceState(history.state, '', url)

	const dialog = document.getElementById('username-dialog')
	if (!dialog) return
	const fill = () => {
		const input = dialog.querySelector<HTMLInputElement>('#username-input')
		const rooms = dialog.querySelectorAll<HTMLElement>('#room-options [data-room]')
		if (!input || !rooms.length) return false
		// The game restores its saved nick while creating the room options.
		// Wait for that step so the suggested nick survives initialization.
		input.value = input.maxLength > 0 ? nick.slice(0, input.maxLength) : nick
		input.dispatchEvent(new Event('input', { bubbles: true }))
		Array.from(rooms).find(room => room.dataset.room === requestedRoom)?.click()
		if (params.get('panel') === '1' && window.parent !== window &&
			document.referrer === 'https://www.mediavida.com/') {
			if (!dialog.querySelector('.model-option.selected')) {
				dialog.querySelector<HTMLElement>('.model-option[data-model]')?.click()
			}
			dialog.querySelector<HTMLButtonElement>('#start-button:not(:disabled)')?.click()
		}
		return true
	}
	if (fill()) return
	const observer = new MutationObserver(() => {
		if (fill()) observer.disconnect()
	})
	observer.observe(dialog, { childList: true, subtree: true })
	return () => observer.disconnect()
}

// The game's direct room entry reads playerName synchronously at startup.
// Set the explicit forum alias before navigating, in the iframe's own partition.
export function joinPanelRoom(url: URL, navigate: (path: string) => void): boolean {
	const params = new URLSearchParams(url.hash.slice(1))
	const room = params.get('room')
	const nick = params.get(NICK_PARAMETER)?.trim().slice(0, 15)
	if (url.pathname !== '/' || params.get('panel') !== '1' || !nick ||
		!room || !Array.from(subforumRooms.values()).includes(room)) return false
	try {
		localStorage.setItem('playerName', nick)
		if (localStorage.getItem('playerName') !== nick) return false
	} catch { return false }
	navigate('/' + room)
	return true
}
