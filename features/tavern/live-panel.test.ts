import { injectTavernLinks } from './links'
import { afterEach, expect, it, vi } from 'vitest'
import { joinPanelRoom } from './prefill'
import { injectLiveTavernPanel } from './live-panel'

afterEach(() => {
	document.body.replaceChildren()
	localStorage.clear()
	vi.restoreAllMocks()
})

it('loads only on entry, preserves the frame on expansion and releases it on exit', () => {
	history.replaceState(null, '', '/foro/feda/hilo-123/live')
	document.body.innerHTML = '<div id="more-actions"></div><aside class="c-side"></aside><a id="user-data"><span>Forero</span></a>'
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
	injectLiveTavernPanel('feda')
	injectTavernLinks(true, 'feda')
	const top = document.getElementById('mvp-gamedev-tavern')!
	const root = document.querySelector('#mvp-live-tavern')!.shadowRoot!
	expect(root.querySelector('iframe')).toBeNull()
	root.querySelector<HTMLButtonElement>('.enter')!.click()
	expect(root.querySelector<HTMLButtonElement>('.enter')!.disabled).toBe(true)
	expect(top.inert).toBe(true)
	const dock = document.getElementById('mvp-tavern-dock')!.shadowRoot!
	const frame = dock.querySelector('iframe')!
	expect(new URLSearchParams(new URL(frame.src).hash.slice(1)).get('room')).toBe('feda')
	localStorage.setItem('playerName', 'patata')
	const navigate = vi.fn(() => expect(localStorage.getItem('playerName')).toBe('Forero'))
	expect(joinPanelRoom(new URL(frame.src), navigate)).toBe(true)
	expect(navigate).toHaveBeenCalledWith('/feda')
	expect(frame.allow).toContain('microphone')
	const panel = dock.querySelector<HTMLElement>('.panel')!
	const width = innerWidth - 15
	const height = innerHeight - 15
	vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(width)
	vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(height)
	vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => new DOMRect(
		width - (parseFloat(panel.style.right) || 12) - 640.25,
		height - (parseFloat(panel.style.bottom) || 12) - 400.5,
		640.25, 400.5
	))
	const handle = dock.querySelector<HTMLButtonElement>('.move')!
	for (const key of ['ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
		handle.dispatchEvent(new KeyboardEvent('keydown', { key }))
	}
	expect(panel.style.right).toBe('36px')
	expect(panel.style.bottom).toBe('36px')
	handle.setPointerCapture = vi.fn()
	const pointer = (type: string, x: number, y: number) => new PointerEvent(type, {
		pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y,
	})
	handle.dispatchEvent(pointer('pointerdown', 500, 400))
	handle.dispatchEvent(pointer('pointermove', 400, 300))
	expect(panel.style.right).toBe('136px')
	expect(panel.style.bottom).toBe('136px')
	handle.dispatchEvent(pointer('pointermove', 3000, 3000))
	expect(panel.style.right).toBe('12px')
	expect(panel.style.bottom).toBe('12px')
	handle.dispatchEvent(pointer('lostpointercapture', 3000, 3000))
	expect(panel.classList.contains('adjusting')).toBe(false)
	dock.querySelector('.resize')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
	expect(dock.querySelector<HTMLElement>('.panel')!.style.width).not.toBe('')
	injectLiveTavernPanel('feda')
	expect(dock.querySelector('iframe')).toBe(frame)
	dock.querySelector<HTMLButtonElement>('.leave')!.click()
	expect(document.getElementById('mvp-tavern-dock')).toBeNull()
	expect(top.inert).toBe(false)
	expect(root.querySelector<HTMLButtonElement>('.enter')!.disabled).toBe(false)
	expect(root.querySelector('iframe')).toBeNull()
	document.querySelector('#mvp-live-tavern')!.remove()
	history.replaceState(null, '', '/foro/feda/otro-456/live')
	injectLiveTavernPanel('feda')
	expect(document.querySelector('#mvp-live-tavern')).toBeTruthy()
})

it.each(['dev', 'gamedev', 'off-topic', 'juegos'])('checks room availability on a LIVE thread in %s', slug => {
	history.replaceState(null, '', '/foro/' + slug + '/hilo-123/live')
	document.body.innerHTML = '<aside class="c-side"></aside>'
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
	injectLiveTavernPanel(slug)
	expect(Boolean(document.querySelector('#mvp-live-tavern'))).toBe(slug !== 'juegos')
})
