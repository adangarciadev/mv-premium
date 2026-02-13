import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reinitializeEmbeds, forceReinitializeEmbeds, setupGlobalEmbedListener } from './reinitialize-embeds'

describe('reinitializeEmbeds', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		// Reset window.twttr
		delete (window as any).twttr
		// Reset global listener flag
		delete (window as any).__mvpEmbedListenerActive
	})

	afterEach(() => {
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
