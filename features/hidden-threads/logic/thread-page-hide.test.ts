import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	isThreadPage: vi.fn(() => true),
	hideThreadFromUrl: vi.fn((): Promise<{ id: string } | null> => Promise.resolve({ id: '/foro/cine/peli-12345' })),
	isThreadHidden: vi.fn((): Promise<boolean> => Promise.resolve(false)),
	getState: vi.fn(() => ({ hideThreadEnabled: true })),
}))

vi.mock('@/lib/content-modules/utils/page-detection', () => ({
	isThreadPage: mocks.isThreadPage,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: { getState: mocks.getState },
}))

vi.mock('./storage', () => ({
	hideThreadFromUrl: mocks.hideThreadFromUrl,
	isThreadHidden: mocks.isThreadHidden,
}))

import {
	cleanupThreadPageHideButton,
	injectThreadPageHideButton,
	redirectIfThreadHidden,
	resolveHiddenThreadRedirectTarget,
	type ThreadPageHideNotifier,
} from './thread-page-hide'

const HIDE_BUTTON_ID = 'mvp-thread-page-hide-btn'
const THREAD_URL = 'https://www.mediavida.com/foro/cine/peli-12345/2'

let replaceMock: ReturnType<typeof vi.fn>
let originalLocation: Location

function setLocation(href: string): void {
	Object.defineProperty(window, 'location', {
		configurable: true,
		value: { href, pathname: new URL(href).pathname, replace: replaceMock },
	})
}

function makeNotifier(): ThreadPageHideNotifier {
	return { onCountdown: vi.fn(), onError: vi.fn() }
}

beforeEach(() => {
	vi.useFakeTimers()
	originalLocation = window.location
	replaceMock = vi.fn()
	setLocation(THREAD_URL)
	document.body.innerHTML = '<div id="more-actions"></div>'
	mocks.isThreadPage.mockReturnValue(true)
	mocks.getState.mockReturnValue({ hideThreadEnabled: true })
	mocks.hideThreadFromUrl.mockResolvedValue({ id: '/foro/cine/peli-12345' })
	mocks.isThreadHidden.mockResolvedValue(false)
})

afterEach(() => {
	cleanupThreadPageHideButton()
	Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
	vi.useRealTimers()
	vi.clearAllMocks()
})

describe('resolveHiddenThreadRedirectTarget', () => {
	it('returns the subforum path for a thread url', () => {
		expect(resolveHiddenThreadRedirectTarget('https://www.mediavida.com/foro/cine/peli-12345/2')).toBe('/foro/cine')
	})

	it('falls back to /foro when the url is not a thread', () => {
		expect(resolveHiddenThreadRedirectTarget('https://example.com/whatever')).toBe('/foro')
	})
})

describe('redirectIfThreadHidden', () => {
	it('replaces with the subforum when the current thread is hidden', async () => {
		mocks.isThreadHidden.mockResolvedValue(true)

		await expect(redirectIfThreadHidden()).resolves.toBe(true)
		expect(replaceMock).toHaveBeenCalledWith('/foro/cine')
	})

	it('does nothing when the current thread is not hidden', async () => {
		mocks.isThreadHidden.mockResolvedValue(false)

		await expect(redirectIfThreadHidden()).resolves.toBe(false)
		expect(replaceMock).not.toHaveBeenCalled()
	})

	it('does nothing outside thread pages', async () => {
		mocks.isThreadPage.mockReturnValue(false)

		await expect(redirectIfThreadHidden()).resolves.toBe(false)
		expect(mocks.isThreadHidden).not.toHaveBeenCalled()
	})
})

describe('injectThreadPageHideButton', () => {
	it('injects the hide button into the actions row', () => {
		injectThreadPageHideButton(makeNotifier())

		const button = document.getElementById(HIDE_BUTTON_ID)
		expect(button).not.toBeNull()
		expect(button?.querySelector('i')?.className).toContain('fa-eye-slash')
	})

	it('is idempotent across repeated injections', () => {
		injectThreadPageHideButton(makeNotifier())
		injectThreadPageHideButton(makeNotifier())

		expect(document.querySelectorAll(`#${HIDE_BUTTON_ID}`).length).toBe(1)
	})

	it('does not inject outside thread pages', () => {
		mocks.isThreadPage.mockReturnValue(false)
		injectThreadPageHideButton(makeNotifier())

		expect(document.getElementById(HIDE_BUTTON_ID)).toBeNull()
	})

	it('removes the button when the feature is disabled', () => {
		injectThreadPageHideButton(makeNotifier())
		expect(document.getElementById(HIDE_BUTTON_ID)).not.toBeNull()

		mocks.getState.mockReturnValue({ hideThreadEnabled: false })
		injectThreadPageHideButton(makeNotifier())

		expect(document.getElementById(HIDE_BUTTON_ID)).toBeNull()
	})

	it('hides the thread, counts down and replaces with the subforum on click', async () => {
		const notifier = makeNotifier()
		injectThreadPageHideButton(notifier)

		const button = document.getElementById(HIDE_BUTTON_ID) as HTMLAnchorElement
		button.click()

		// Flush the hide promise; the first countdown tick fires, no redirect yet.
		await vi.advanceTimersByTimeAsync(0)
		expect(mocks.hideThreadFromUrl).toHaveBeenCalledWith(THREAD_URL)
		expect(notifier.onCountdown).toHaveBeenNthCalledWith(1, 3)
		expect(replaceMock).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(3000)
		expect(notifier.onCountdown).toHaveBeenCalledTimes(3)
		expect(notifier.onCountdown).toHaveBeenLastCalledWith(1)
		expect(replaceMock).toHaveBeenCalledWith('/foro/cine')
	})

	it('reports an error and does not redirect when hiding fails', async () => {
		mocks.hideThreadFromUrl.mockResolvedValue(null)
		const notifier = makeNotifier()
		injectThreadPageHideButton(notifier)

		const button = document.getElementById(HIDE_BUTTON_ID) as HTMLAnchorElement
		button.click()

		await vi.advanceTimersByTimeAsync(3000)
		expect(notifier.onError).toHaveBeenCalledTimes(1)
		expect(notifier.onCountdown).not.toHaveBeenCalled()
		expect(replaceMock).not.toHaveBeenCalled()
	})
})
