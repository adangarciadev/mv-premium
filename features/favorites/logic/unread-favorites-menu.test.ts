import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEATURE_IDS } from '@/constants'

const mocks = vi.hoisted(() => ({ send: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('@/lib/messaging', () => ({ sendMessage: mocks.send }))
vi.mock('@/lib/lazy-toast', () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { injectUnreadFavoritesMenu } from './unread-favorites-menu'

const first = '/foro/cine/que-pelicula-has-visto-514622/1235#37047'
const second = '/foro/ia/claude-code-reglas-733745/119#3561'
const row = (url: string, unread = true) => `<li><div><a class="h" href="${url.split('#')[0]}">Hilo</a>${unread ? `<a class="unseen-num" href="${url}">3</a>` : ''}</div></li>`
const flyout = (rows: string) => `<div class="flypos froot"><div class="fly flyout"><div class="flyheader">Favoritos</div><div class="nano"><ul class="content threads">${rows}</ul></div><div class="flyfooter"><a href="/foro/favoritos">Ver más</a></div></div></div>`
const button = () => document.getElementById(FEATURE_IDS.FAVORITES_OPEN_UNREAD) as HTMLButtonElement
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }

describe('native favorites menu action', () => {
	let cleanup: (() => void) | undefined
	beforeEach(() => {
		mocks.send.mockReset().mockResolvedValue({ opened: 2, failed: 0 })
		document.body.innerHTML = '<ul id="usermenu"><li class="f2"><a class="flink" href="/foro/favoritos">Favoritos<span id="bf">0</span></a></li><li class="messages"></li></ul>'
		// Native .flink handlers prevent default navigation to the favorites page.
		document.querySelector('a.flink')!.addEventListener('click', event => event.preventDefault())
	})
	afterEach(() => cleanup?.())
	const mount = (rows: string) => {
		document.querySelector('.f2')!.insertAdjacentHTML('beforeend', flyout(rows))
		cleanup = injectUnreadFavoritesMenu()
	}

	it('adds one accessible button when the flyout is created later', async () => {
		cleanup = injectUnreadFavoritesMenu()
		expect(button()).toBeNull()
		document.querySelector('.f2')!.insertAdjacentHTML('beforeend', flyout(row(first)))
		await flush()
		expect(button()).toHaveTextContent('Abrir no leídos')
		expect(button()).toHaveAttribute('type', 'button')
		expect(button()).toHaveAccessibleName(/pestañas en segundo plano/)
		expect(injectUnreadFavoritesMenu()).toBe(cleanup)
		expect(document.querySelectorAll(`#${FEATURE_IDS.FAVORITES_OPEN_UNREAD}`)).toHaveLength(1)
	})

	it('preserves native links and sends only exact unread destinations, deduplicated by thread', async () => {
		mount(row(first) + row(second) + row('/foro/cine/leido-789', false) + row(first) + row('https://evil.test/foro/cine/x-999'))
		const nativeHref = document.querySelector('.unseen-num')!.getAttribute('href')
		button().click()
		await flush()
		expect(mocks.send).toHaveBeenCalledWith('openUnreadFavorites', {
			urls: [`https://www.mediavida.com${first}`, `https://www.mediavida.com${second}`], loadRemaining: false,
		})
		expect(document.querySelector('.unseen-num')).toHaveAttribute('href', nativeHref)
		expect(mocks.success).toHaveBeenCalledWith('2 hilos abiertos en segundo plano')
	})

	it('does not bubble its click to native thread navigation or menu-close handlers', async () => {
		mount(row(first))
		const nativeClick = vi.fn()
		document.querySelector('.f2')!.addEventListener('click', nativeClick)
		button().click()
		await flush()
		expect(nativeClick).not.toHaveBeenCalled()
	})

	it('refreshes unread counters from the server when reopening the native menu after opening threads', async () => {
		mount(row(first))
		const container = document.querySelector<HTMLElement>('.f2')!
		const trigger = container.querySelector<HTMLAnchorElement>('a.flink')!
		container.classList.add('active')
		button().click()
		await flush()
		// The threads have loaded in other tabs: Mediavida cleared the navbar count,
		// but its cached flyout still contains the original unread badge.
		container.classList.remove('active')
		let fetched = 0
		trigger.addEventListener('click', event => {
			event.preventDefault()
			// Mirrors common.min.js: an existing flyout is reused without a request.
			if (!container.querySelector('.froot')) {
				fetched++
				container.insertAdjacentHTML('beforeend', flyout(row(first, false)))
			}
			container.classList.add('active')
		})
		trigger.click()
		await flush()
		expect(fetched).toBe(1)
		expect(container.querySelector('.unseen-num')).toBeNull()
		expect(button()).toBeNull()
	})

	it('keeps the open flyout intact when closing the star menu', () => {
		mount(row(first))
		const container = document.querySelector<HTMLElement>('.f2')!
		container.classList.add('active')
		const original = container.querySelector('.froot')
		container.querySelector<HTMLAnchorElement>('a.flink')!.click()
		expect(container.querySelector('.froot')).toBe(original)
	})

	it('keeps an in-flight native request attached when reopening during loading', () => {
		mount(row(first) + '<li class="loading">Cargando</li>')
		const container = document.querySelector<HTMLElement>('.f2')!
		const original = container.querySelector('.froot')
		container.querySelector<HTMLAnchorElement>('a.flink')!.click()
		expect(container.querySelector('.froot')).toBe(original)
	})

	it('does not refresh for modified clicks or while the batch is in progress', async () => {
		let finish!: (value: { opened: number; failed: number }) => void
		mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve }))
		mount(row(first))
		const container = document.querySelector<HTMLElement>('.f2')!
		const trigger = container.querySelector<HTMLAnchorElement>('a.flink')!
		const original = container.querySelector('.froot')
		trigger.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }))
		expect(container.querySelector('.froot')).toBe(original)
		button().click()
		trigger.click()
		expect(container.querySelector('.froot')).toBe(original)
		finish({ opened: 1, failed: 0 })
		await flush()
	})

	it('removes the refresh listener when the feature is disposed', () => {
		mount(row(first))
		const container = document.querySelector<HTMLElement>('.f2')!
		const original = container.querySelector('.froot')
		cleanup!()
		container.querySelector<HTMLAnchorElement>('a.flink')!.click()
		expect(container.querySelector('.froot')).toBe(original)
	})

	it('hides the action until there are unread threads, even with 20 read favorites', async () => {
		mount('<li class="loading">Cargando</li>')
		expect(button()).toBeNull()
		document.querySelector('.threads')!.innerHTML = row(first, false).repeat(20)
		await flush()
		expect(button()).toBeNull()
		document.querySelector('.threads')!.innerHTML = row(first)
		await flush()
		expect(button()).toBeEnabled()
		document.querySelector('.threads')!.innerHTML = row(first, false)
		await flush()
		expect(button()).toBeNull()
		expect(document.querySelector('.flyheader')).not.toHaveClass('mvp-unread-favorites-header')
	})

	it('checks later pages even when the first 20 threads have no unread messages', async () => {
		document.getElementById('bf')!.textContent = '1'
		mount(row(first, false).repeat(20))
		expect(button()).toBeEnabled()
		button().click()
		await flush()
		expect(mocks.send).toHaveBeenCalledWith('openUnreadFavorites', { urls: [], loadRemaining: true })
		document.getElementById('bf')!.textContent = '0'
		await flush()
		expect(button()).toBeNull()
	})

	it('prevents duplicate clicks while opening tabs', async () => {
		let finish!: (value: { opened: number; failed: number }) => void
		mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve }))
		mount(row(first))
		button().click()
		button().dispatchEvent(new MouseEvent('click', { bubbles: true }))
		expect(button()).toBeDisabled()
		expect(button()).toHaveTextContent('Abriendo…')
		expect(mocks.send).toHaveBeenCalledTimes(1)
		finish({ opened: 1, failed: 0 })
		await flush()
		expect(button()).toBeEnabled()
	})

	it('restores the action and explains failure so it can be retried', async () => {
		mocks.send.mockRejectedValueOnce(new Error('network unavailable'))
		mount(row(first))
		button().click()
		await flush()
		expect(button()).toBeEnabled()
		expect(mocks.error).toHaveBeenCalledWith('No se han podido abrir los favoritos. Vuelve a intentarlo.')
		button().click()
		await flush()
		expect(mocks.send).toHaveBeenCalledTimes(2)
	})

	it('reports partially opened sets and empty results', async () => {
		mocks.send.mockResolvedValueOnce({ opened: 1, failed: 1 }).mockResolvedValueOnce({ opened: 0, failed: 0 })
		mount(row(first))
		button().click()
		await flush()
		expect(mocks.error).toHaveBeenCalledWith('1 hilo abierto; 1 no se ha podido abrir.')
		button().click()
		await flush()
		expect(mocks.info).toHaveBeenCalledWith('No hay mensajes no leídos en los favoritos')
	})

	it('reinjects after the native flyout is replaced and cleans up observers and styles', async () => {
		mount(row(first))
		document.querySelector('.froot')!.outerHTML = flyout(row(second))
		await flush()
		expect(button()).toBeEnabled()
		cleanup!()
		expect(button()).toBeNull()
		document.querySelector('.f2')!.insertAdjacentHTML('beforeend', flyout(row(first)))
		await flush()
		expect(button()).toBeNull()
		expect(Array.from(document.head.querySelectorAll('style')).some(style => style.textContent?.includes(FEATURE_IDS.FAVORITES_OPEN_UNREAD))).toBe(false)
	})

	it('ignores notifications and messages, and does nothing for logged-out visitors', () => {
		document.querySelector('.messages')!.innerHTML = flyout(row(first))
		cleanup = injectUnreadFavoritesMenu()
		expect(button()).toBeNull()
		cleanup!()
		document.body.innerHTML = '<ul id="usermenu"><li>Inicia sesión</li></ul>'
		expect(injectUnreadFavoritesMenu()).toBeUndefined()
	})
})
