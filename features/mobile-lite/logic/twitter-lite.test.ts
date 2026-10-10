import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initMobileLiteTwitterLite, teardownMobileLiteTwitterLite } from './twitter-lite'
import { clearTwitterLiteCache } from '@/lib/content-modules/utils/reinitialize-embeds'

const mocks = vi.hoisted(() => ({
	platform: vi.fn(() => 'firefox-android'),
	allowed: vi.fn(() => true),
	settings: { twitterLiteEmbedsEnabled: true },
	sendMessage: vi.fn(),
}))
vi.mock('@/lib/platform', () => ({ getPlatformKind: mocks.platform }))
vi.mock('@/lib/feature-flags', () => ({ FeatureFlag: { MobileLite: 'mobile-lite' }, isFeatureEnabled: mocks.allowed }))
vi.mock('@/store/settings-store', () => ({ useSettingsStore: { getState: () => mocks.settings } }))
vi.mock('@/lib/messaging', () => ({ sendMessage: mocks.sendMessage }))

const tweet = (id: string, lazy = false) => `<span data-s9e-mediaembed="twitter"><iframe ${lazy ? 'src="about:blank" data-src' : 'src'}="https://platform.twitter.com/embed/Tweet.html?id=${id}"></iframe></span>`

describe('Mobile Lite Twitter integration', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		clearTwitterLiteCache()
		mocks.platform.mockReturnValue('firefox-android')
		mocks.allowed.mockReturnValue(true)
		mocks.settings.twitterLiteEmbedsEnabled = true
		vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
		document.body.innerHTML = `<div id="posts-wrap">${tweet('123')}</div>`
		mocks.sendMessage.mockResolvedValue({ success: true, data: { username: 'usuario', text: 'Texto del tweet', url: 'https://twitter.com/usuario/status/123', hasVideo: true } })
	})
	afterEach(() => {
		teardownMobileLiteTwitterLite()
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it('renders existing tweets using the real shared renderer and initializes only once', async () => {
		initMobileLiteTwitterLite()
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(250)
		expect(document.querySelectorAll('.mvp-twitter-lite-card')).toHaveLength(1)
		expect(document.querySelector('.mvp-twitter-lite-content')?.textContent).toBe('Texto del tweet')
		expect(document.querySelector('iframe')).toBeNull()
		expect(mocks.sendMessage).toHaveBeenCalledOnce()
		expect(document.documentElement).toHaveAttribute('data-mvp-mobile-twitter-lite', 'true')
	})

	it.each(['firefox-desktop', 'chrome-desktop', 'other'])('leaves native tweets intact on %s', async platform => {
		mocks.platform.mockReturnValue(platform)
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(300)
		expect(document.querySelector('iframe')).not.toBeNull()
		expect(mocks.sendMessage).not.toHaveBeenCalled()
	})

	it.each(['mobile-lite', 'tweets-lite'])('does not touch embeds with %s disabled', async setting => {
		if (setting === 'mobile-lite') mocks.allowed.mockReturnValue(false)
		else mocks.settings.twitterLiteEmbedsEnabled = false
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(300)
		expect(document.querySelector('iframe')).not.toBeNull()
		expect(mocks.sendMessage).not.toHaveBeenCalled()
	})

	it('waits for Firefox load and cancels pending startup on teardown', async () => {
		vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive')
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(300)
		expect(mocks.sendMessage).not.toHaveBeenCalled()
		window.dispatchEvent(new Event('load'))
		teardownMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(300)
		expect(mocks.sendMessage).not.toHaveBeenCalled()
		expect(document.documentElement).not.toHaveAttribute('data-mvp-mobile-twitter-lite')
	})

	it('replaces late lazy tweets and preserves the original embed when requested', async () => {
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(250)
		document.getElementById('posts-wrap')!.insertAdjacentHTML('beforeend', tweet('456', true))
		await vi.advanceTimersByTimeAsync(100)
		expect(mocks.sendMessage).toHaveBeenLastCalledWith('fetchTweetLiteData', { tweetUrl: 'https://twitter.com/i/status/456' })
		expect(document.querySelectorAll('.mvp-twitter-lite-card')).toHaveLength(2)
		const hosts = document.querySelectorAll('[data-mvp-twitter-lite-host]')
		;(hosts[1].querySelector('.mvp-twitter-lite-media-btn') as HTMLButtonElement).click()
		const iframe = document.querySelector('iframe')!
		expect(new URL(iframe.src).searchParams.get('id')).toBe('456')
		expect(new URL(iframe.src).searchParams.get('mvp_allow')).toBe('1')
		await vi.advanceTimersByTimeAsync(100)
		expect(document.querySelector('iframe')).toBe(iframe)
	})

	it('renders a fallback and keeps Ver tweet available if the tweet service fails', async () => {
		mocks.sendMessage.mockRejectedValue(new Error('offline'))
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(250)
		expect(document.querySelector('.mvp-twitter-lite-content')?.textContent).toBe('No se pudo cargar el texto de este tweet.')
		expect(document.querySelector('.mvp-twitter-lite-media-btn')).not.toBeNull()
	})

	it('starts after load when the page is still preparing embeds', async () => {
		vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive')
		initMobileLiteTwitterLite()
		window.dispatchEvent(new Event('load'))
		await vi.advanceTimersByTimeAsync(250)
		expect(document.querySelector('.mvp-twitter-lite-card')).not.toBeNull()
	})

	it('stops observing new posts on teardown', async () => {
		initMobileLiteTwitterLite()
		await vi.advanceTimersByTimeAsync(250)
		teardownMobileLiteTwitterLite()
		document.getElementById('posts-wrap')!.insertAdjacentHTML('beforeend', tweet('789'))
		await vi.advanceTimersByTimeAsync(300)
		expect(document.querySelector('iframe')).not.toBeNull()
		expect(mocks.sendMessage).toHaveBeenCalledOnce()
	})
})
