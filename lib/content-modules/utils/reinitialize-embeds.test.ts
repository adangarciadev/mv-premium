import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
	reinitializeEmbeds,
	forceReinitializeEmbeds,
	setupGlobalEmbedListener,
	replaceTwitterEmbedsWithLite,
	startTwitterLiteEmbedGuard,
	stopTwitterLiteEmbedGuard,
	clearTwitterLiteCache,
} from './reinitialize-embeds'

const mockSendMessage = vi.fn()

vi.mock('@/lib/messaging', () => ({
	sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

describe('reinitializeEmbeds', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		// Reset window.twttr
		delete (window as any).twttr
		// Reset global listener flag
		delete (window as any).__mvpEmbedListenerActive
		stopTwitterLiteEmbedGuard()
		// Clear tweet lite cache between tests to avoid stale data
		clearTwitterLiteCache()
		mockSendMessage.mockReset()
		mockSendMessage.mockResolvedValue({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Texto del tweet',
				url: 'https://twitter.com/usuario/status/123',
			},
		})
	})

	afterEach(() => {
		stopTwitterLiteEmbedGuard()
		vi.restoreAllMocks()
	})

	it('should do nothing when no embeds are present', () => {
		const container = document.createElement('div')
		container.innerHTML = '<div>No embeds here</div>'

		// Should not throw
		expect(() => reinitializeEmbeds(container)).not.toThrow()
	})

	it('should mark embed as processed when iframe has no contentWindow (jsdom)', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<iframe style="height: 50px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		// In jsdom, iframe has no contentWindow, so fallback is applied
		expect(iframe.getAttribute('data-mvp-embed-init')).toBeTruthy()
	})

	it('should use Twitter widgets API when available', () => {
		const mockLoad = vi.fn().mockResolvedValue(undefined)
		;(window as any).twttr = {
			widgets: {
				load: mockLoad,
			},
		}

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<iframe style="height: 50px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		// Should call Twitter API for the embed container
		expect(mockLoad).toHaveBeenCalled()
	})

	it('should apply fallback height when no contentWindow available', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="instagram" class="embed instagram">
				<iframe style="height: 50px;" src="//instagram.com/embed"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		// Fallback should be applied (800px for Instagram)
		expect(parseInt(iframe.style.height, 10)).toBe(800)
		expect(iframe.getAttribute('data-mvp-embed-init')).toBe('fallback')
	})

	it('should skip already initialized embeds', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<iframe data-mvp-embed-init="true" style="height: 500px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		const mockLoad = vi.fn()
		;(window as any).twttr = {
			widgets: { load: mockLoad },
		}

		reinitializeEmbeds(container)

		// Should NOT call Twitter API for already initialized embed
		expect(mockLoad).not.toHaveBeenCalled()
	})

	it('should always reload Twitter embeds even with valid height (infinite scroll fix)', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<iframe style="height: 500px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		// Twitter embeds should be reloaded even with valid height because
		// content from DOMParser/cloneNode doesn't have the tweet rendered
		expect(iframe.getAttribute('data-mvp-embed-init')).toBe('reloading')
	})

	it('should not override existing valid height for non-Twitter embeds', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="instagram" class="embed instagram">
				<iframe style="height: 500px;" src="//instagram.com/embed"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		// Non-Twitter embeds with valid height should be kept as-is
		expect(iframe.style.height).toBe('500px')
		expect(iframe.getAttribute('data-mvp-embed-init')).toBe('true')
	})

	it('should handle multiple embeds of different types', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<iframe style="height: 50px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
			<div data-s9e-mediaembed="instagram" class="embed instagram">
				<iframe style="height: 30px;" src="//instagram.com/embed"></iframe>
			</div>
			<div data-s9e-mediaembed="tiktok" class="embed tiktok">
				<iframe style="height: 20px;" src="//tiktok.com/embed"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const iframes = container.querySelectorAll('iframe')
		iframes.forEach(iframe => {
			// All should be marked as processed (pending/reloading/fallback)
			expect(iframe.getAttribute('data-mvp-embed-init')).toBeTruthy()
		})

		// Non-Twitter embeds should have fallback heights applied immediately
		const instagramIframe = container.querySelector('[data-s9e-mediaembed="instagram"] iframe') as HTMLIFrameElement
		const tiktokIframe = container.querySelector('[data-s9e-mediaembed="tiktok"] iframe') as HTMLIFrameElement
		expect(parseInt(instagramIframe.style.height, 10)).toBe(800)
		expect(parseInt(tiktokIframe.style.height, 10)).toBe(750)
	})

	it('should apply correct fallback heights per embed type (non-Twitter)', () => {
		const container = document.createElement('div')
		// Note: Twitter uses async reload, so we test others here
		container.innerHTML = `
			<div data-s9e-mediaembed="reddit"><iframe style="height: 10px;"></iframe></div>
			<div data-s9e-mediaembed="instagram"><iframe style="height: 10px;"></iframe></div>
			<div data-s9e-mediaembed="tiktok"><iframe style="height: 10px;"></iframe></div>
			<div data-s9e-mediaembed="facebook"><iframe style="height: 10px;"></iframe></div>
			<div data-s9e-mediaembed="bluesky"><iframe style="height: 10px;"></iframe></div>
			<div data-s9e-mediaembed="unknown"><iframe style="height: 10px;"></iframe></div>
		`

		reinitializeEmbeds(container)

		const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
		const instagramIframe = container.querySelector('[data-s9e-mediaembed="instagram"] iframe') as HTMLIFrameElement
		const tiktokIframe = container.querySelector('[data-s9e-mediaembed="tiktok"] iframe') as HTMLIFrameElement
		const facebookIframe = container.querySelector('[data-s9e-mediaembed="facebook"] iframe') as HTMLIFrameElement
		const blueskyIframe = container.querySelector('[data-s9e-mediaembed="bluesky"] iframe') as HTMLIFrameElement
		const unknownIframe = container.querySelector('[data-s9e-mediaembed="unknown"] iframe') as HTMLIFrameElement

		expect(redditIframe.style.height).toBe('900px')
		expect(instagramIframe.style.height).toBe('800px')
		expect(tiktokIframe.style.height).toBe('750px')
		expect(facebookIframe.style.height).toBe('500px')
		expect(blueskyIframe.style.height).toBe('400px')
		expect(unknownIframe.style.height).toBe('500px') // default
	})

	it('should keep reddit embeds with valid existing height', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="reddit">
				<iframe style="height: 600px;" src="//www.redditmedia.com/r/test/comments/abc123/embed"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
		expect(redditIframe.getAttribute('data-mvp-embed-init')).toBe('true')
	})

	it('should avoid MessageChannel handshake for reddit embeds with small initial height', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="reddit">
				<iframe style="height: 10px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
			</div>
		`

		const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
		const postMessage = vi.fn()
		Object.defineProperty(redditIframe, 'contentWindow', {
			value: { postMessage },
			configurable: true,
		})

		reinitializeEmbeds(container)

		expect(postMessage).not.toHaveBeenCalled()
		expect(parseInt(redditIframe.style.height, 10)).toBeGreaterThanOrEqual(700)
		expect(redditIframe.getAttribute('data-mvp-embed-init')).toBe('fallback')
	})

	it('should use measured inner height for reddit fallback when available', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="reddit">
				<iframe style="height: 10px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
			</div>
		`

		const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
		const fakeDoc = document.implementation.createHTMLDocument('')
		fakeDoc.body.innerHTML = '<iframe height="740"></iframe>'
		Object.defineProperty(redditIframe, 'contentDocument', {
			value: fakeDoc,
			configurable: true,
		})

		reinitializeEmbeds(container)

		expect(redditIframe.style.height).toBe('740px')
		expect(redditIframe.getAttribute('data-mvp-embed-init')).toBe('reddit-measured')
	})

	it('should shrink reddit fallback height to stable measured value when discovered later', () => {
		vi.useFakeTimers()

		try {
			const container = document.createElement('div')
			container.innerHTML = `
				<div data-s9e-mediaembed="reddit">
					<iframe style="height: 10px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
				</div>
			`
			document.body.appendChild(container)

			const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
			const fakeDoc = document.implementation.createHTMLDocument('')
			fakeDoc.body.innerHTML = '<iframe height="740"></iframe>'

			let reads = 0
			Object.defineProperty(redditIframe, 'contentDocument', {
				get() {
					reads++
					return reads < 3 ? null : fakeDoc
				},
				configurable: true,
			})

			reinitializeEmbeds(container)
			expect(redditIframe.style.height).toBe('900px')

			vi.advanceTimersByTime(400)

			expect(redditIframe.style.height).toBe('740px')
			expect(redditIframe.getAttribute('data-mvp-embed-init')).toBe('reddit-measured')

			vi.advanceTimersByTime(1000)
			expect(redditIframe.getAttribute('data-mvp-reddit-height-sync')).toBe('done')
		} finally {
			vi.useRealTimers()
		}
	})

	it('should not force reload reddit iframe after MessageChannel timeout when height is already valid', () => {
		vi.useFakeTimers()

		const OriginalMessageChannel = globalThis.MessageChannel
		const globalAny = globalThis as any
		class MockMessageChannel {
			port1 = { onmessage: null as ((event: MessageEvent) => void) | null }
			port2 = {} as MessagePort
		}

		try {
			globalAny.MessageChannel = MockMessageChannel

			const container = document.createElement('div')
			container.innerHTML = `
				<div data-s9e-mediaembed="reddit">
					<iframe style="height: 10px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
				</div>
			`
			document.body.appendChild(container)

			const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
			Object.defineProperty(redditIframe, 'contentWindow', {
				value: { postMessage: vi.fn() },
				configurable: true,
			})

			const fakeDoc = document.implementation.createHTMLDocument('')
			fakeDoc.body.innerHTML = '<iframe height="740"></iframe>'
			Object.defineProperty(redditIframe, 'contentDocument', {
				value: fakeDoc,
				configurable: true,
			})

			reinitializeEmbeds(container)
			vi.advanceTimersByTime(6000)

			expect(redditIframe.getAttribute('data-mvp-embed-init')).not.toBe('reloaded')
			expect(parseInt(redditIframe.style.height, 10)).toBeGreaterThanOrEqual(700)
		} finally {
			globalAny.MessageChannel = OriginalMessageChannel
			vi.useRealTimers()
		}
	})

	it('should handle Twitter embeds with async reload', () => {
		vi.useFakeTimers()

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		const twitterIframe = container.querySelector('[data-s9e-mediaembed="twitter"] iframe') as HTMLIFrameElement

		// Should be marked as reloading (async process)
		expect(twitterIframe.getAttribute('data-mvp-embed-init')).toBe('reloading')

		vi.useRealTimers()
	})

	it('should replace twitter embed with lightweight card when twitterLiteMode is enabled', async () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<a href="https://x.com/usuario/status/123">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=123"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		// Allow full async chain: start → sendMessage resolve → card render
		await vi.waitFor(() => {
			const card = container.querySelector('.mvp-twitter-lite-card')
			expect(card).toBeTruthy()
			expect(card?.textContent).toContain('@usuario')
			expect(card?.textContent).toContain('Texto del tweet')
			expect(card?.classList.contains('mvp-twitter-lite-card')).toBe(true)
		})
		const embedContainer = container.querySelector('[data-mvp-twitter-lite-host="true"]') as HTMLDivElement
		expect(embedContainer.getAttribute('data-mvp-twitter-lite-host')).toBe('true')
		expect(embedContainer.getAttribute('data-s9e-mediaembed')).toBeNull()
		expect(embedContainer.classList.contains('twitter')).toBe(false)
		expect(mockSendMessage).toHaveBeenCalledWith('fetchTweetLiteData', {
			tweetUrl: 'https://twitter.com/usuario/status/123',
		})
	})

	it('should render replied tweet context when replyTo payload is available', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Mensaje de respuesta',
				url: 'https://twitter.com/usuario/status/321',
				replyTo: {
					username: 'autorOriginal',
					displayName: 'Autor Original',
					text: 'Este es el tweet original al que responde.',
					url: 'https://twitter.com/autorOriginal/status/111',
				},
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<a href="https://twitter.com/usuario/status/321">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=321"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			const card = container.querySelector('.mvp-twitter-lite-card')
			expect(card).toBeTruthy()
			const textContent = card?.textContent || ''
			expect(textContent).toContain('Mensaje de respuesta')
			expect(textContent).toContain('Este es el tweet original al que responde.')
			expect(textContent).not.toContain('Responde a')
			expect(card?.textContent).toContain('Ver tweet')
			expect(textContent.indexOf('Este es el tweet original al que responde.')).toBeLessThan(
				textContent.indexOf('Mensaje de respuesta')
			)
		})
	})

	it('should render reply context text even when replyTo has no URL', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Mensaje de respuesta',
				url: 'https://twitter.com/usuario/status/321',
				replyTo: {
					username: '',
					displayName: '',
					text: 'Contexto inferido del tweet original.',
				},
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<a href="https://twitter.com/usuario/status/321">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=321"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			const card = container.querySelector('.mvp-twitter-lite-card')
			expect(card).toBeTruthy()
			expect(card?.textContent).toContain('Contexto inferido del tweet original.')
			expect(card?.textContent).not.toContain('Responde a')
		})
		expect(container.querySelector('.mvp-twitter-lite-card')?.textContent).not.toContain('Ver tweet original')
	})

	it('should render verification and date metadata when available', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Mensaje con metadatos',
				url: 'https://twitter.com/usuario/status/321',
				isVerified: true,
				createdAt: '23 oct 2025, 16:16',
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<a href="https://twitter.com/usuario/status/321">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=321"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			const card = container.querySelector('.mvp-twitter-lite-card')
			expect(card).toBeTruthy()
			expect(card?.textContent).toContain('23 oct 2025, 16:16')
			expect(card?.textContent).toContain('Mensaje con metadatos')
		})
		expect(container.querySelector('.mvp-twitter-lite-card [aria-label="Verified account"]')).toBeTruthy()
	})

	it('should render "Ver tweet" button even when tweet has no media', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Tweet sin media',
				url: 'https://twitter.com/usuario/status/321',
				hasMedia: false,
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<a href="https://twitter.com/usuario/status/321">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=321"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			const button = container.querySelector<HTMLButtonElement>('.mvp-twitter-lite-media-btn')
			expect(button).toBeTruthy()
			expect(button?.textContent).toContain('Ver tweet')
		})
	})

	it('should load original twitter iframe on demand when media is available', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Tweet con media',
				url: 'https://twitter.com/usuario/status/456',
				hasMedia: true,
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<a href="https://twitter.com/usuario/status/456">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=456"></iframe>
			</div>
		`

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			expect(container.querySelector('.mvp-twitter-lite-media-btn')).toBeTruthy()
		})

		const mediaButton = container.querySelector<HTMLButtonElement>('.mvp-twitter-lite-media-btn')!
		mediaButton.click()

		const iframe = container.querySelector<HTMLIFrameElement>('[data-s9e-mediaembed="twitter"] iframe')
		expect(iframe).toBeTruthy()
		expect(iframe?.getAttribute('src')).toContain('platform.twitter.com/embed/Tweet.html?id=456')
		expect(iframe?.getAttribute('src')).toContain('mvp_allow=1')
		expect(iframe?.style.height).toBe('980px')
		expect(container.querySelector('[data-s9e-mediaembed="twitter"]')?.getAttribute('data-mvp-twitter-lite-expanded')).toBe(
			'true'
		)
		expect(container.querySelector('[data-s9e-mediaembed="twitter"]')?.getAttribute('data-mvp-twitter-lite-host')).toBeNull()
	})

	it('replaceTwitterEmbedsWithLite should skip embeds without tweet URL', async () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter">
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html"></iframe>
			</div>
		`

		replaceTwitterEmbedsWithLite(container)
		// Give a tick for the void promise to start (but it should bail early)
		await Promise.resolve()
		await Promise.resolve()

		expect(container.querySelector('.mvp-twitter-lite-card')).toBeFalsy()
		expect(mockSendMessage).not.toHaveBeenCalled()
	})

	it('twitter lite guard should remove late native iframes from non-expanded cards', async () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<a href="https://twitter.com/usuario/status/123">Tweet</a>
			</div>
		`
		document.body.appendChild(container)

		replaceTwitterEmbedsWithLite(container)
		await vi.waitFor(() => {
			expect(container.querySelector('.mvp-twitter-lite-card')).toBeTruthy()
		})

		startTwitterLiteEmbedGuard()

		const rogueIframe = document.createElement('iframe')
		rogueIframe.src = 'https://platform.twitter.com/embed/Tweet.html?id=123'
		container.querySelector('[data-s9e-mediaembed="twitter"]')?.appendChild(rogueIframe)

		await vi.waitFor(() => {
			expect(container.querySelector('.mvp-twitter-lite-card')).toBeTruthy()
			expect(container.querySelector('iframe[src*="platform.twitter.com"]')).toBeFalsy()
		})
	})

	it('twitter lite guard should preserve expanded embeds opened by user', async () => {
		mockSendMessage.mockResolvedValueOnce({
			success: true,
			data: {
				username: 'usuario',
				displayName: 'Usuario',
				text: 'Tweet con media',
				url: 'https://twitter.com/usuario/status/456',
				hasMedia: true,
			},
		})

		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="twitter" class="embed twitter">
				<a href="https://twitter.com/usuario/status/456">Tweet</a>
				<iframe style="height: 10px;" src="//platform.twitter.com/embed/Tweet.html?id=456"></iframe>
			</div>
		`
		document.body.appendChild(container)

		reinitializeEmbeds(container, { twitterLiteMode: true })
		await vi.waitFor(() => {
			expect(container.querySelector('.mvp-twitter-lite-media-btn')).toBeTruthy()
		})

		startTwitterLiteEmbedGuard()
		container.querySelector<HTMLButtonElement>('.mvp-twitter-lite-media-btn')?.click()

		await vi.waitFor(() => {
			expect(container.querySelector('[data-mvp-twitter-lite-expanded="true"]')).toBeTruthy()
			expect(container.querySelector('iframe[src*="platform.twitter.com"]')).toBeTruthy()
		})
	})

	it('twitter lite guard should remove orphan twitter iframes', async () => {
		const orphanWrapper = document.createElement('div')
		orphanWrapper.innerHTML = '<iframe src="https://platform.twitter.com/embed/Tweet.html?id=999"></iframe>'
		document.body.appendChild(orphanWrapper)

		startTwitterLiteEmbedGuard()

		await vi.waitFor(() => {
			expect(orphanWrapper.querySelector('iframe[src*="platform.twitter.com"]')).toBeFalsy()
		})
	})

	it('should not shrink reddit embed height when later measurements are smaller', () => {
		vi.useFakeTimers()

		try {
			const container = document.createElement('div')
			container.innerHTML = `
				<div data-s9e-mediaembed="reddit">
					<iframe style="height: 700px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
				</div>
			`

			const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
			const fakeDoc = document.implementation.createHTMLDocument('')
			fakeDoc.body.innerHTML = '<iframe height="740"></iframe>'
			const innerIframe = fakeDoc.querySelector('iframe') as HTMLIFrameElement

			Object.defineProperty(redditIframe, 'contentDocument', {
				value: fakeDoc,
				configurable: true,
			})

			// Sync loop only runs while iframe is attached to DOM.
			document.body.appendChild(container)

			reinitializeEmbeds(container)
			expect(redditIframe.style.height).toBe('740px')

			innerIframe.setAttribute('height', '360')
			vi.advanceTimersByTime(2000)

			expect(parseInt(redditIframe.style.height, 10)).toBeGreaterThanOrEqual(740)
		} finally {
			vi.useRealTimers()
		}
	})

	it('should not restart reddit sync loop when already done', () => {
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="reddit">
				<iframe data-mvp-reddit-height-sync="done" style="height: 720px;" src="//www.mediavida.com/embed/reddit.html"></iframe>
			</div>
		`

		reinitializeEmbeds(container)

		expect(setIntervalSpy).not.toHaveBeenCalled()
		const redditIframe = container.querySelector('[data-s9e-mediaembed="reddit"] iframe') as HTMLIFrameElement
		expect(redditIframe.getAttribute('data-mvp-reddit-height-sync')).toBe('done')
	})
})

describe('forceReinitializeEmbeds', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		delete (window as any).twttr
	})

	it('should remove init flag and reprocess embeds', () => {
		const container = document.createElement('div')
		container.innerHTML = `
			<div data-s9e-mediaembed="instagram" class="embed instagram">
				<iframe data-mvp-embed-init="true" style="height: 100px;" src="//instagram.com/embed"></iframe>
			</div>
		`

		forceReinitializeEmbeds(container)

		const iframe = container.querySelector('iframe') as HTMLIFrameElement
		// Should be reprocessed with new fallback height
		expect(iframe.getAttribute('data-mvp-embed-init')).toBe('fallback')
		expect(iframe.style.height).toBe('800px')
	})
})

describe('setupGlobalEmbedListener', () => {
	beforeEach(() => {
		delete (window as any).__mvpEmbedListenerActive
	})

	it('should set up listener only once', () => {
		const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

		setupGlobalEmbedListener()
		setupGlobalEmbedListener() // Call again

		// Should only add listener once
		const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
			call => call[0] === 'message'
		)
		expect(messageListenerCalls.length).toBe(1)
	})

	it('should mark as active after setup', () => {
		setupGlobalEmbedListener()

		expect((window as any).__mvpEmbedListenerActive).toBe(true)
	})
})
