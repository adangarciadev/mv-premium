import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wxt/browser', () => ({
	browser: {
		contextMenus: {
			removeAll: vi.fn(),
			create: vi.fn(),
			onClicked: { addListener: vi.fn() },
		},
		tabs: {
			create: vi.fn(),
			reload: vi.fn(),
		},
		scripting: {
			executeScript: vi.fn(),
		},
		runtime: {
			onMessage: { addListener: vi.fn() },
		},
	},
}))

vi.mock('#imports', () => ({
	storage: {
		getItem: vi.fn(),
		setItem: vi.fn(),
		removeItem: vi.fn(),
	},
}))

vi.mock('@/features/saved-threads/logic/storage', () => ({
	saveThreadFromUrl: vi.fn(),
}))

vi.mock('@/features/hidden-threads/logic/storage', () => ({
	hideThreadFromUrl: vi.fn(),
	isThreadHidden: vi.fn(),
}))

vi.mock('@/features/drafts/storage', () => ({
	createDraft: vi.fn(),
}))

vi.mock('@/features/thread-clipper/logic/history-storage', () => ({
	addThreadClipperHistoryEntry: vi.fn(),
}))

const { saveClippedThreadPrefillMock } = vi.hoisted(() => ({
	saveClippedThreadPrefillMock: vi.fn(),
}))

vi.mock('@/features/thread-clipper', () => ({
	saveClippedThreadPrefill: saveClippedThreadPrefillMock,
}))

vi.mock('@/lib/messaging', () => ({
	onMessage: vi.fn(),
	sendMessage: vi.fn(async () => undefined),
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

import { browser } from 'wxt/browser'
import { storage } from '#imports'
import {
	buildClippedThreadPrefill,
	createContextMenus,
	setupContextMenuListener,
	setupThreadClipperTrayListener,
} from './context-menus'

const mockedCreateMenu = vi.mocked(browser.contextMenus.create)
const mockedGetItem = vi.mocked(storage.getItem)
const mockedSetItem = vi.mocked(storage.setItem)
const mockedRemoveItem = vi.mocked(storage.removeItem)
const mockedExecuteScript = vi.mocked(browser.scripting.executeScript)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

beforeEach(() => {
	vi.clearAllMocks()
	mockedGetItem.mockResolvedValue(null)
	mockedSetItem.mockResolvedValue(undefined)
	mockedRemoveItem.mockResolvedValue(undefined)
	mockedExecuteScript.mockResolvedValue([] as any)
})

describe('manifest permissions', () => {
	it('does not request broad host permissions for external pages', () => {
		const config = readFileSync(resolve(repoRoot, 'wxt.config.ts'), 'utf8')
		const hostPermissions = config.match(/host_permissions:\s*\[([\s\S]*?)\]/)?.[1] ?? ''

		expect(hostPermissions).not.toContain('<all_urls>')
		expect(hostPermissions).not.toContain('*://*/*')
		expect(hostPermissions).not.toContain('http://*/*')
		expect(hostPermissions).not.toContain('https://*/*')
		expect(config).toContain("'activeTab'")
		expect(config).toContain("'scripting'")
	})
})

describe('buildClippedThreadPrefill', () => {
	it('builds a Juegos thread prefill from the current page', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Nuevo trailer de Test Game - Example',
		})

		expect(prefill).toEqual({
			subforum: 'juegos',
			title: 'Nuevo trailer de Test Game',
			sourceUrl: 'https://example.com/news/game',
			body: '[b][url=https://example.com/news/game]Fuente[/url][/b]',
		})
	})

	it('uses a short text selection as title and quotes it in the body', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://x.com/user/status/1',
			tabTitle: 'X',
			selectionText: 'Anunciado Test Game 2 para PC y consolas',
		})

		expect(prefill?.title).toBe('Anunciado Test Game 2 para PC y consolas')
		expect(prefill?.body).toContain('[quote]\nAnunciado Test Game 2 para PC y consolas\n[/quote]')
	})

	it('sanitizes BBCode-sensitive title, selection and URL characters', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news?q=[test]',
			tabTitle: '[Análisis] Test Game',
			selectionText: '[b]Anunciado[/b] Test Game 2',
		})

		expect(prefill?.sourceUrl).toBe('https://example.com/news?q=%5Btest%5D')
		expect(prefill?.title).toBe('(b)Anunciado(/b) Test Game 2')
		expect(prefill?.body).toContain('[quote]\n(b)Anunciado(/b) Test Game 2\n[/quote]')
		expect(prefill?.body).toContain('[b][url=https://example.com/news?q=%5Btest%5D]Fuente[/url][/b]')
	})

	it('keeps normal long article selections beyond the old body limit', () => {
		const selectionText = 'A'.repeat(1300)
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Long selection',
			selectionText,
		})

		const quoted = prefill?.body.match(/\[quote\]\n([\s\S]*)\n\[\/quote\]/)?.[1] ?? ''
		expect(quoted).toHaveLength(1300)
	})

	it('still caps extreme selections to avoid oversized stored prefills', () => {
		const selectionText = 'A'.repeat(13000)
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Long selection',
			selectionText,
		})

		const quoted = prefill?.body.match(/\[quote\]\n([\s\S]*)\n\[\/quote\]/)?.[1] ?? ''
		expect(quoted).toHaveLength(12000)
	})

	it('limits generated titles to Mediavida max length', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Este es un titular extremadamente largo que supera el límite real de Mediavida para los hilos',
		})

		expect(prefill?.title.length).toBeLessThanOrEqual(72)
		expect(prefill?.title.endsWith('...')).toBe(false)
	})

	it('keeps the source link at the end even when thread title is capped', () => {
		const tabTitle = 'Este es un titular extremadamente largo que supera el límite real de Mediavida para los hilos'
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle,
		})

		expect(prefill?.title.length).toBeLessThanOrEqual(72)
		expect(prefill?.body).toBe('[b][url=https://example.com/news/game]Fuente[/url][/b]')
	})

	it('preserves selected paragraph breaks in the quote body', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Noticia',
			selectionText: 'Primer párrafo seleccionado.\n\nSegundo párrafo seleccionado.',
		})

		expect(prefill?.body).toContain('[quote]\nPrimer párrafo seleccionado.\n\nSegundo párrafo seleccionado.\n[/quote]')
	})

	it('drops script content from captured selections', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})
		mockedExecuteScript.mockImplementation(async details => {
			const funcName = typeof details.func === 'function' ? details.func.name : ''
			if (funcName !== 'captureSelectionForThreadClipper') return []

			document.body.innerHTML = `
				<article id="article">
					<p>Primer párrafo.</p>
					<script>cnx.cmd.push(function(){cnx({ playerId: 'ad' })})</script>
					<p>Segundo párrafo.</p>
				</article>
			`
			const range = document.createRange()
			range.selectNodeContents(document.getElementById('article')!)
			const selection = window.getSelection()!
			selection.removeAllRanges()
			selection.addRange(range)

			return [{ result: details.func?.() }]
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Noticia con script' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		trayListener({ type: 'mvp-thread-clipper-tray', action: 'add-selection' }, { tab } as any)
		await vi.waitFor(() => {
			const basket = storageMap.get('local:mvp-thread-clipper-basket') as { items: Array<{ value: string }> }
			expect(basket.items[0].value).toContain('Primer párrafo.')
			expect(basket.items[0].value).toContain('Segundo párrafo.')
			expect(basket.items[0].value).not.toContain('cnx.cmd')
		})
	})

	it('can insert clipped text as plain body text instead of quote', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Noticia',
			textFormat: 'plain',
			items: [{ type: 'text', value: 'Primer párrafo.\n\nSegundo párrafo.' }],
		})

		expect(prefill?.body).toContain('Primer párrafo.\n\nSegundo párrafo.')
		expect(prefill?.body).not.toContain('[quote]')
	})

	it('uses edited tray text when creating the Mediavida prefill', async () => {
		const storageMap = new Map<string, unknown>()
		storageMap.set('local:mvp-thread-clipper-basket', {
			version: 1,
			sessionId: 'test-session',
			tabId: 10,
			sourceUrl: 'https://example.com/news',
			sourceTitle: 'Noticia editable',
			items: [{ type: 'text', value: 'Texto original' }],
			textFormat: 'plain',
			template: 'news',
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupThreadClipperTrayListener()
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10 }

		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'update-text-item', itemIndex: 0, value: 'Texto editado raw' },
			{ tab } as any
		)
		await vi.waitFor(() => {
			const basket = storageMap.get('local:mvp-thread-clipper-basket') as { items: Array<{ value: string }> }
			expect(basket.items[0].value).toBe('Texto editado raw')
		})

		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'create', subforum: 'juegos' },
			{ tab } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		expect(saveClippedThreadPrefillMock.mock.calls[0][0].body).toContain('Texto editado raw')
		expect(saveClippedThreadPrefillMock.mock.calls[0][0].body).not.toContain('Texto original')
	})

	it('never generates image BBCode for quick thread prefills', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Noticia',
			selectionText: 'Texto con https://example.com/a.jpg como parte de la noticia',
		})

		expect(prefill?.body).not.toContain('[img]')
		expect(prefill?.body).not.toContain('[/img]')
	})

	it('adds only YouTube, X/Twitter and Instagram media as Mediavida media tags', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Noticia',
			items: [
				{ type: 'media', value: 'https://www.youtube.com/embed/abc123?start=30' },
				{ type: 'media', value: 'https://i.ytimg.com/vi/lazy123/hqdefault.jpg' },
				{ type: 'media', value: 'https://x.com/usuario/status/123456789' },
				{ type: 'media', value: 'https://www.instagram.com/reel/ABC123xyz/?utm_source=ig_web_copy_link' },
				{ type: 'media', value: 'https://x.com/usuario/status/123456789/photo/1' },
				{ type: 'media', value: 'https://vimeo.com/123456' },
				{ type: 'media', value: 'https://www.twitch.tv/videos/123456' },
				{ type: 'media', value: 'https://example.com/not-media' },
			],
		})

		expect(prefill?.body).toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
		expect(prefill?.body).toContain('[media]https://www.youtube.com/watch?v=lazy123[/media]')
		expect(prefill?.body).toContain('[media]https://twitter.com/usuario/status/123456789[/media]')
		expect(prefill?.body).toContain('[media]https://www.instagram.com/reel/ABC123xyz/[/media]')
		expect(prefill?.body).not.toContain('/photo/1')
		expect(prefill?.body).not.toContain('vimeo.com')
		expect(prefill?.body).not.toContain('twitch.tv')
		expect(prefill?.body).not.toContain('not-media')
	})

	it('can build media-only prefills for social posts with the source at the end', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://x.com/usuario/status/123456789',
			tabTitle: 'X/Twitter',
			titleOverride: '',
			contentMode: 'media-only',
			items: [{ type: 'media', value: 'https://x.com/usuario/status/123456789' }],
		})

		expect(prefill?.title).toBe('')
		expect(prefill?.body).toBe(
			'[media]https://twitter.com/usuario/status/123456789[/media]\n\n' +
				'[b][url=https://x.com/usuario/status/123456789]Fuente[/url][/b]'
		)
	})

	it('keeps the source link after limiting oversized multi-item bodies', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'juegos',
			sourceUrl: 'https://example.com/news/game',
			tabTitle: 'Noticia enorme',
			items: Array.from({ length: 20 }, (_, index) => ({
				type: 'text' as const,
				value: `Bloque ${index} ${'A'.repeat(12000)}`,
			})),
		})

		expect(prefill?.body.length).toBeLessThanOrEqual(60000)
		expect(prefill?.body).toMatch(/\[b\]\[url=https:\/\/example\.com\/news\/game\]Fuente\[\/url\]\[\/b\]$/)
	})


	it('rejects unsupported URLs', () => {
		expect(
			buildClippedThreadPrefill({
				subforum: 'juegos',
				sourceUrl: 'chrome://extensions',
				tabTitle: 'Extensions',
			})
		).toBeNull()
	})

	it('supports any known Mediavida subforum', () => {
		const prefill = buildClippedThreadPrefill({
			subforum: 'cine',
			sourceUrl: 'https://example.com/movie',
			tabTitle: 'Nuevo trailer',
		})

		expect(prefill?.subforum).toBe('cine')
	})

	it('rejects unknown subforums', () => {
		expect(
			buildClippedThreadPrefill({
				subforum: 'nope',
				sourceUrl: 'https://example.com/movie',
				tabTitle: 'Nuevo trailer',
			})
		).toBeNull()
	})
})

describe('createContextMenus', () => {
	it('creates a single thread clipper entry when subforums are configured', async () => {
		mockedGetItem.mockResolvedValue(
			JSON.stringify({
				state: {
					threadClipperSubforums: ['cine', 'dev'],
				},
			})
		)

		await createContextMenus()

		const clipperMenus = mockedCreateMenu.mock.calls
			.map(([item]) => item)
			.filter(item => item.id === 'mvp-open-thread-clipper')
		expect(clipperMenus).toHaveLength(1)
		expect(clipperMenus[0]).toMatchObject({
			title: 'MV Premium: preparar hilo',
			contexts: ['page', 'link', 'selection'],
		})
		expect(clipperMenus[0].contexts).not.toContain('image')
		const titles = mockedCreateMenu.mock.calls.map(([item]) => item.title)
		expect(titles).not.toContain('Crear hilo en Cine')
		expect(titles).not.toContain('Crear hilo en Desarrollo y diseño')
		expect(titles).not.toContain('Añadir texto o media al recorte')
		expect(titles).not.toContain('Limpiar recorte')
	})

	it('does not expose one context-menu item per configured subforum', async () => {
		mockedGetItem.mockResolvedValue(
			JSON.stringify({
				state: {
					threadClipperSubforums: ['cine', 'cine', 'nope', 'dev'],
				},
			})
		)

		await createContextMenus()

		const titles = mockedCreateMenu.mock.calls.map(([item]) => item.title)
		expect(titles.filter(title => title === 'MV Premium: preparar hilo')).toHaveLength(1)
		expect(titles).not.toContain('Crear hilo en Cine')
		expect(titles).not.toContain('Crear hilo en Desarrollo y diseño')
		const clipperMenus = mockedCreateMenu.mock.calls
			.map(([item]) => item)
			.filter(item => typeof item.id === 'string' && item.id.startsWith('mvp-create-thread'))
		expect(clipperMenus).toHaveLength(0)
	})

	it('uses provided subforum overrides when refreshing menus before settings persistence catches up', async () => {
		mockedGetItem.mockResolvedValue(
			JSON.stringify({
				state: {
					threadClipperSubforums: ['juegos'],
				},
			})
		)

		await createContextMenus(['cine'])

		const titles = mockedCreateMenu.mock.calls.map(([item]) => item.title)
		expect(titles).toContain('MV Premium: preparar hilo')
		expect(titles).not.toContain('Crear hilo en Cine')
		expect(titles).not.toContain('Crear hilo en Juegos')
	})

	it('does not create the thread clipper menu when no subforums are configured', async () => {
		mockedGetItem.mockResolvedValue(
			JSON.stringify({
				state: {
					threadClipperSubforums: [],
				},
			})
		)

		await createContextMenus()

		const titles = mockedCreateMenu.mock.calls.map(([item]) => item.title)
		expect(titles).not.toContain('MV Premium: preparar hilo')
		expect(titles).not.toContain('Crear hilo en Juegos')
	})

	it('serializes concurrent menu rebuilds to avoid duplicate context menu ids', async () => {
		let releaseFirstRemoval: (() => void) | undefined
		const firstRemoval = new Promise<void>(resolve => {
			releaseFirstRemoval = resolve
		})
			vi.mocked(browser.contextMenus.removeAll).mockReturnValueOnce(firstRemoval as any)

		const firstRebuild = createContextMenus()
		const secondRebuild = createContextMenus()

		await new Promise(resolve => setTimeout(resolve, 0))

		expect(browser.contextMenus.removeAll).toHaveBeenCalledTimes(1)
		releaseFirstRemoval?.()

		await Promise.all([firstRebuild, secondRebuild])

		expect(browser.contextMenus.removeAll).toHaveBeenCalledTimes(2)
	})
})

describe('thread clipper basket context actions', () => {
	it('accumulates separated text blocks before creating the thread prefill', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})
		const source = {
			url: 'https://example.com/news',
			domain: 'example.com',
			title: 'Titular completo de la noticia',
		}
		const captureResults = [
			{ text: '', mediaUrls: [], source },
			{ text: 'Bloque uno\n\nPárrafo uno', mediaUrls: [], source },
			{ text: 'Bloque dos\n\nPárrafo dos', mediaUrls: [], source },
		]
		mockedExecuteScript.mockImplementation(async details => {
			const funcName = typeof details.func === 'function' ? details.func.name : ''
			if (funcName === 'captureSelectionForThreadClipper') {
				return [{ result: captureResults.shift() ?? { text: '', mediaUrls: [] } }]
			}
			return []
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Titular completo de la noticia' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				action: 'add-selection',
			} as any,
			{ tab } as any
		)
		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(1)
		)
		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				action: 'add-selection',
			} as any,
			{ tab } as any
		)
		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(2)
		)
		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'create', subforum: 'juegos' },
			{ tab } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		const prefill = saveClippedThreadPrefillMock.mock.calls[0][0]
		expect(prefill.body).toContain('[quote]\nBloque uno\n\nPárrafo uno\n[/quote]')
		expect(prefill.body).toContain('[quote]\nBloque dos\n\nPárrafo dos\n[/quote]')
		expect(prefill.body).not.toContain('[img]')
		expect(prefill.body).toMatch(/\[b\]\[url=https:\/\/example\.com\/news\]Fuente\[\/url\]\[\/b\]$/)
		expect(mockedRemoveItem).toHaveBeenCalledWith('local:mvp-thread-clipper-basket')
		expect(mockedExecuteScript).toHaveBeenCalledWith(
			expect.objectContaining({
				func: expect.any(Function),
				args: [
					expect.objectContaining({
						texts: expect.any(Array),
						media: expect.any(Array),
					}),
				],
			})
		)
	})

	it('removes visual-tray items and keeps supported media embeds', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Titular completo de la noticia' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(0)
		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'add-media', mediaUrl: 'https://www.youtube.com/watch?v=abc123' },
			{ tab } as any
		)
		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(1)
		)
		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				action: 'add-media',
				mediaUrl: 'https://www.instagram.com/p/ABC123xyz/',
				pickerMode: 'media',
			},
			{ tab } as any
		)
		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(2)
		)
		expect((storageMap.get('local:mvp-thread-clipper-basket') as { activePicker?: string }).activePicker).toBe('media')
		trayListener({ type: 'mvp-thread-clipper-tray', action: 'remove-item', itemIndex: 0 }, { tab } as any)
		await vi.waitFor(() => {
			const basket = storageMap.get('local:mvp-thread-clipper-basket') as { items: Array<{ value: string }> }
			expect(basket.items).toHaveLength(1)
			expect(basket.items.some(item => item.value === 'https://www.youtube.com/watch?v=abc123')).toBe(false)
		})
		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'create', subforum: 'juegos' },
			{ tab } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		const prefill = saveClippedThreadPrefillMock.mock.calls[0][0]
		expect(prefill.body).not.toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
		expect(prefill.body).toContain('[media]https://www.instagram.com/p/ABC123xyz/[/media]')
	})

	it('does not open the thread clipper from Mediavida pages', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})

		setupContextMenuListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const tab = { id: 10, title: 'Hilo de Mediavida' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://www.mediavida.com/foro/juegos/hilo-test',
			} as any,
			tab as any
		)

		expect(storageMap.get('local:mvp-thread-clipper-basket')).toBeUndefined()
		expect(mockedExecuteScript).not.toHaveBeenCalled()
	})

	it('blocks direct X, YouTube and Instagram pages for this feature', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})

		setupContextMenuListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const tab = { id: 10, title: 'Página social directa' }

		for (const pageUrl of [
			'https://x.com/usuario/status/123456789',
			'https://twitter.com/i/status/123456789',
			'https://www.youtube.com/watch?v=abc123',
			'https://youtu.be/abc123',
			'https://www.instagram.com/p/ABC123xyz/',
		]) {
			await menuListener(
				{
					menuItemId: 'mvp-open-thread-clipper',
					pageUrl,
				} as any,
				tab as any
			)
		}

		expect(storageMap.get('local:mvp-thread-clipper-basket')).toBeUndefined()
		expect(mockedExecuteScript).not.toHaveBeenCalled()
	})

	it('opens the recortador from an external article even when the right click is on a YouTube link', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})

		setupContextMenuListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const tab = { id: 10, title: 'Página con vídeo' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
				linkUrl: 'https://youtu.be/abc123?t=42',
			} as any,
			tab as any
		)

		const basket = storageMap.get('local:mvp-thread-clipper-basket') as {
			sourceUrl: string
			title: string
			contentMode: string
			items: Array<{ type: string; value: string }>
		}
		expect(basket.sourceUrl).toBe('https://example.com/news')
		expect(basket.title).toBe('Página con vídeo')
		expect(basket.contentMode).toBe('article')
		expect(basket.items).toEqual([])
	})

	it('adds compatible embedded media from an external article through the visual tray', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Noticia con embeds' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		const mediaUrls = [
			'https://www.youtube.com/embed/abc123?start=30',
			'https://x.com/usuario/status/123456789',
			'https://www.instagram.com/reel/ABC123xyz/?utm_source=ig_web_copy_link',
		]
		for (const [index, mediaUrl] of mediaUrls.entries()) {
			trayListener(
				{ type: 'mvp-thread-clipper-tray', action: 'add-media', mediaUrl, pickerMode: 'media' },
				{ tab } as any
			)
			await vi.waitFor(() =>
				expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(
					index + 1
				)
			)
		}
		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'create', subforum: 'juegos' },
			{ tab } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		const prefill = saveClippedThreadPrefillMock.mock.calls[0][0]
		expect(prefill.body).toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
		expect(prefill.body).toContain('[media]https://twitter.com/usuario/status/123456789[/media]')
		expect(prefill.body).toContain('[media]https://www.instagram.com/reel/ABC123xyz/[/media]')
	})

	it('ignores unsupported X/Twitter media URLs selected inside an external article', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Noticia con enlaces sociales' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)

		for (const mediaUrl of [
			'https://x.com/usuario',
			'https://x.com/search?q=mediavida',
			'https://x.com/home',
			'https://x.com/usuario/status/123456789/photo/1',
		]) {
			trayListener(
				{ type: 'mvp-thread-clipper-tray', action: 'add-media', mediaUrl },
				{ tab } as any
			)
		}

		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(0)
		)
	})

	it('clears the visual tray content without closing or deleting the basket', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Noticia con vídeo' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'add-media', mediaUrl: 'https://youtu.be/abc123' },
			{ tab } as any
		)
		await vi.waitFor(() =>
			expect((storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }).items).toHaveLength(1)
		)
		trayListener({ type: 'mvp-thread-clipper-tray', action: 'clear' }, { tab } as any)

		await vi.waitFor(() => {
			const basket = storageMap.get('local:mvp-thread-clipper-basket') as { items: unknown[] }
			expect(basket.items).toHaveLength(0)
		})
		expect(mockedRemoveItem).not.toHaveBeenCalledWith('local:mvp-thread-clipper-basket')
		expect(mockedExecuteScript).toHaveBeenCalledWith(
			expect.objectContaining({
				func: expect.any(Function),
				args: [
					expect.objectContaining({
						texts: [],
						media: [],
					}),
				],
			})
		)
	})

	it('can create a thread from the visual tray without another context-menu click', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const tab = { id: 10, title: 'Titular completo de la noticia' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/news',
			} as any,
			tab as any
		)
		await trayListener(
			{ type: 'mvp-thread-clipper-tray', action: 'create', subforum: 'juegos' },
			{ tab } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		expect(saveClippedThreadPrefillMock.mock.calls[0][0]).toMatchObject({
			subforum: 'juegos',
			title: 'Titular completo de la noticia',
			sourceUrl: 'https://example.com/news',
		})
		expect(browser.tabs.create).toHaveBeenCalledWith({
			url: 'https://www.mediavida.com/foro/juegos/nuevo-hilo',
		})
	})

	it('rejects actions from a stale tray session after another tab opens a new clip', async () => {
		const storageMap = new Map<string, unknown>()
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupContextMenuListener()
		setupThreadClipperTrayListener()
		const menuListener = vi.mocked(browser.contextMenus.onClicked.addListener).mock.calls[0][0]
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any
		const firstTab = { id: 10, title: 'Primera noticia' }
		const secondTab = { id: 20, title: 'Segunda noticia' }

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/one',
			} as any,
			firstTab as any
		)
		const firstSession = (storageMap.get('local:mvp-thread-clipper-basket') as { sessionId: string }).sessionId

		await menuListener(
			{
				menuItemId: 'mvp-open-thread-clipper',
				pageUrl: 'https://example.com/two',
			} as any,
			secondTab as any
		)

		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				sessionId: firstSession,
				action: 'add-media',
				mediaUrl: 'https://youtu.be/abc123',
			},
			{ tab: firstTab } as any
		)

		await vi.waitFor(() => {
			const basket = storageMap.get('local:mvp-thread-clipper-basket') as { sourceUrl: string; items: unknown[] }
			expect(basket.sourceUrl).toBe('https://example.com/two')
			expect(basket.items).toHaveLength(0)
		})
	})

	it('uses the visible tray snapshot when creating without waiting for debounced storage updates', async () => {
		const storageMap = new Map<string, unknown>()
		storageMap.set('local:mvp-thread-clipper-basket', {
			version: 1,
			sessionId: 'visible-session',
			tabId: 10,
			sourceUrl: 'https://example.com/news',
			sourceTitle: 'Texto anterior',
			items: [{ type: 'text', value: 'Texto anterior' }],
			textFormat: 'quote',
			template: 'news',
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)
		mockedSetItem.mockImplementation(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		})
		mockedRemoveItem.mockImplementation(async (key: string) => {
			storageMap.delete(key)
		})

		setupThreadClipperTrayListener()
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any

		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				sessionId: 'visible-session',
				action: 'create',
				subforum: 'juegos',
				createSnapshot: {
					title: 'Título visible',
					subforum: 'juegos',
					textFormat: 'plain',
					items: [{ type: 'text', value: 'Texto visible sin esperar debounce' }],
				},
			},
			{ tab: { id: 10 } } as any
		)

		await vi.waitFor(() => expect(saveClippedThreadPrefillMock).toHaveBeenCalledTimes(1))
		expect(saveClippedThreadPrefillMock.mock.calls[0][0].title).toBe('Título visible')
		expect(saveClippedThreadPrefillMock.mock.calls[0][0].body).toContain('Texto visible sin esperar debounce')
		expect(saveClippedThreadPrefillMock.mock.calls[0][0].body).not.toContain('Texto anterior')
	})

	it('ignores corrupt persisted link items instead of throwing during create', async () => {
		const storageMap = new Map<string, unknown>()
		storageMap.set('local:mvp-thread-clipper-basket', {
			version: 1,
			sessionId: 'corrupt-session',
			tabId: 10,
			sourceUrl: 'https://example.com/news',
			sourceTitle: 'Noticia corrupta',
			items: [{ type: 'link', value: 'https://example.com/missing-label' }],
			textFormat: 'quote',
			template: 'news',
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
		mockedGetItem.mockImplementation(async (key: string) => storageMap.get(key) ?? null)

		setupThreadClipperTrayListener()
		const trayListener = vi.mocked(browser.runtime.onMessage.addListener).mock.calls[0][0] as any

		trayListener(
			{
				type: 'mvp-thread-clipper-tray',
				sessionId: 'corrupt-session',
				action: 'create',
				subforum: 'juegos',
			},
			{ tab: { id: 10 } } as any
		)

		await new Promise(resolve => setTimeout(resolve, 0))
		expect(saveClippedThreadPrefillMock).not.toHaveBeenCalled()
	})
})
