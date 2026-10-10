import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockBrowser } from '../../tests/setup'
import type { OpenUnreadFavoritesPayload, OpenUnreadFavoritesResult } from '@/features/favorites/logic/unread-favorites'

const onMessage = vi.hoisted(() => vi.fn())
vi.mock('@/lib/messaging', () => ({ onMessage }))
import { setupFavoritesHandlers } from './favorites-handlers'

type Handler = (message: {
	data: OpenUnreadFavoritesPayload
	sender: { tab: { id: number; windowId: number; url: string } }
}) => Promise<OpenUnreadFavoritesResult>

const base = 'https://www.mediavida.com'
const first = `${base}/foro/juegos/primer-hilo-123/2#45`
const second = `${base}/foro/tv/segundo-hilo-456#12`
const sender = { tab: { id: 8, windowId: 3, url: `${base}/foro` } }
const row = (url: string, unread = true) => `<li><a href="${url}">Título</a>${unread ? `<a class="unseen-num" href="${url}">3</a>` : ''}</li>`

describe('opening unread favorites', () => {
	let handler: Handler
	const fetchMock = vi.fn()
	beforeEach(() => {
		onMessage.mockReset()
		onMessage.mockImplementation((_name: string, callback: Handler) => { handler = callback })
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
		mockBrowser.tabs.create.mockReset().mockResolvedValue({ id: 1 })
		setupFavoritesHandlers()
	})

	it('opens the exact unread destinations once, in background tabs in the source window', async () => {
		expect(await handler({ data: { urls: [first, first.replace('/2#45', '/3#61'), second, 'https://evil.test/foro/x/y-789'], loadRemaining: false }, sender }))
			.toEqual({ opened: 2, failed: 0 })
		expect(mockBrowser.tabs.create.mock.calls).toEqual([
			[{ url: first, active: false, windowId: 3, openerTabId: 8 }],
			[{ url: second, active: false, windowId: 3, openerTabId: 8 }],
		])
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('includes unread threads beyond the first 20 favorites, ignoring read threads', async () => {
		fetchMock.mockResolvedValueOnce(new Response(row(first).repeat(20)))
			.mockResolvedValueOnce(new Response(row(second) + row(`${base}/foro/cine/leido-999`, false)))
		expect(await handler({ data: { urls: [first], loadRemaining: true }, sender })).toEqual({ opened: 2, failed: 0 })
		expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
			`${base}/foro/favoritos/fly/1`, `${base}/foro/favoritos/fly/2`,
		])
		expect(mockBrowser.tabs.create).toHaveBeenNthCalledWith(2, { url: second, active: false, windowId: 3, openerTabId: 8 })
	})

	it.each([10, 11])('enforces the ten-thread limit before creating any of %s tabs', async count => {
		const urls = Array.from({ length: count }, (_, i) => `${base}/foro/cine/hilo-${1000 + i}#1`)
		const result = await handler({ data: { urls: [...urls, urls[0]], loadRemaining: false }, sender })
		if (count === 10) {
			expect(result).toEqual({ opened: 10, failed: 0 })
			expect(mockBrowser.tabs.create).toHaveBeenCalledTimes(10)
		} else {
			expect(result).toEqual({ opened: 0, failed: 0, limitExceeded: true, unreadCount: 11 })
			expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
		}
	})

	it('opens no partial batch when subsequent pages push the total past ten and permits retry', async () => {
		const urls = Array.from({ length: 11 }, (_, i) => `${base}/foro/cine/hilo-${1000 + i}#1`)
		fetchMock.mockResolvedValueOnce(new Response(urls.slice(0, 10).map(url => row(url)).join('') + row(first, false).repeat(10)))
			.mockResolvedValueOnce(new Response(row(urls[10])))
		expect(await handler({ data: { urls: urls.slice(0, 10), loadRemaining: true }, sender }))
			.toEqual({ opened: 0, failed: 0, limitExceeded: true, unreadCount: 11 })
		expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
		await expect(handler({ data: { urls: [first], loadRemaining: false }, sender })).resolves.toEqual({ opened: 1, failed: 0 })
	})

	it('handles an exactly full final page followed by an empty response', async () => {
		fetchMock.mockResolvedValueOnce(new Response(row(first).repeat(20))).mockResolvedValueOnce(new Response(''))
		expect(await handler({ data: { urls: [first], loadRemaining: true }, sender })).toEqual({ opened: 1, failed: 0 })
	})

	it('opens no tabs when fetching a subsequent page fails', async () => {
		fetchMock.mockResolvedValueOnce(new Response(row(first).repeat(20))).mockResolvedValueOnce(new Response('', { status: 500 }))
		await expect(handler({ data: { urls: [first], loadRemaining: true }, sender })).rejects.toThrow()
		expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
	})

	it('rejects login HTML and repeated pages instead of looping or opening a partial set', async () => {
		fetchMock.mockResolvedValueOnce(new Response('<form>Inicia sesión</form>'))
		await expect(handler({ data: { urls: [], loadRemaining: true }, sender })).rejects.toThrow()
		fetchMock.mockResolvedValue(new Response(row(first).repeat(20)))
		await expect(handler({ data: { urls: [first], loadRemaining: true }, sender })).rejects.toThrow()
		expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
	})

	it('continues when one tab fails and reports partial success', async () => {
		mockBrowser.tabs.create.mockRejectedValueOnce(new Error('tab failed')).mockResolvedValueOnce({ id: 2 })
		expect(await handler({ data: { urls: [first, second], loadRemaining: false }, sender })).toEqual({ opened: 1, failed: 1 })
	})

	it('blocks overlapping requests from the same tab and permits retry after completion', async () => {
		let finish!: (value: { id: number }) => void
		mockBrowser.tabs.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
		const request = { data: { urls: [first], loadRemaining: false }, sender }
		const pending = handler(request)
		await expect(handler(request)).rejects.toThrow('Ya se están abriendo')
		finish({ id: 1 })
		await pending
		await expect(handler(request)).resolves.toEqual({ opened: 1, failed: 0 })
	})

	it('rejects requests from other sites and malformed payloads', async () => {
		await expect(handler({ data: { urls: [first], loadRemaining: false }, sender: { tab: { ...sender.tab, url: 'https://evil.test' } } })).rejects.toThrow()
		await expect(handler({ data: { urls: [123], loadRemaining: false } as unknown as OpenUnreadFavoritesPayload, sender })).rejects.toThrow()
		expect(mockBrowser.tabs.create).not.toHaveBeenCalled()
	})
})
