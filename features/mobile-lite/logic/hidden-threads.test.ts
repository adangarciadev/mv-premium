import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HiddenThread } from '@/features/hidden-threads/logic/storage'
import {
	applyMobileLiteHiddenThreads,
	initMobileLiteHiddenThreads,
	isMobileLiteHiddenThreadsPath,
	teardownMobileLiteHiddenThreads,
} from './hidden-threads'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getHiddenThreads: vi.fn(() => Promise.resolve<HiddenThread[]>([])),
	hideThread: vi.fn((thread: Omit<HiddenThread, 'hiddenAt'>) => Promise.resolve({ ...thread, hiddenAt: 1 })),
	watchHiddenThreads: vi.fn(() => vi.fn()),
	getSettingsState: vi.fn(() => ({ hideThreadEnabled: true })),
	loggerError: vi.fn(),
}))

vi.mock('@/lib/platform', () => ({
	getPlatformKind: mocks.getPlatformKind,
}))

vi.mock('@/lib/feature-flags', () => ({
	FeatureFlag: {
		MobileLite: 'mobile-lite',
	},
	isFeatureEnabled: mocks.isFeatureEnabled,
}))

vi.mock('@/features/hidden-threads/logic/storage', () => ({
	getHiddenThreads: mocks.getHiddenThreads,
	hideThread: mocks.hideThread,
	watchHiddenThreads: mocks.watchHiddenThreads,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: mocks.getSettingsState,
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		error: mocks.loggerError,
	},
}))

function renderThreadRows(): void {
	document.body.innerHTML = `
		<table id="temas">
			<tbody id="temas">
				<tr id="t1">
					<td class="col-th">
						<div class="thread">
							<a href="/foro/cine/supergirl-2026-dc-studios-729454" title="Supergirl (2026) | DC Studios">Supergirl (2026)</a>
						</div>
					</td>
					<td class="col-av"><a href="/id/Creator">Creator</a></td>
				</tr>
				<tr id="t2">
					<td class="col-th">
						<div class="thread">
							<a href="/foro/juegos/hilo-visible-123">Hilo visible</a>
						</div>
					</td>
					<td class="col-av"><a href="/id/Other">Other</a></td>
				</tr>
			</tbody>
		</table>
	`
}

describe('Mobile Lite hidden threads', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getHiddenThreads.mockResolvedValue([])
		mocks.hideThread.mockImplementation((thread: Omit<HiddenThread, 'hiddenAt'>) =>
			Promise.resolve({ ...thread, hiddenAt: 1 })
		)
		mocks.watchHiddenThreads.mockReturnValue(vi.fn())
		mocks.getSettingsState.mockReturnValue({ hideThreadEnabled: true })
		window.history.replaceState({}, '', '/foro/cine')
		renderThreadRows()
	})

	afterEach(() => {
		teardownMobileLiteHiddenThreads()
	})

	it('injects hide buttons for visible thread rows', async () => {
		initMobileLiteHiddenThreads()
		await Promise.resolve()

		expect(document.querySelectorAll('[data-mvp-mobile-lite-hide-thread]')).toHaveLength(2)
		expect(document.querySelector('#t1 [data-mvp-mobile-lite-hide-thread]')?.getAttribute('aria-label')).toBe('Ocultar hilo')
	})

	it('allows individual hidden-thread controls on spy pages', () => {
		expect(isMobileLiteHiddenThreadsPath('/foro/spy')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/foro/spy/live')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/foro/cine')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/foro/cine/supergirl-2026-dc-studios-729454')).toBe(false)
	})

	it('allows hidden-thread controls on profile thread lists', () => {
		expect(isMobileLiteHiddenThreadsPath('/id/SomeUser')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/id/SomeUser/posts')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/id/SomeUser/temas')).toBe(true)
		expect(isMobileLiteHiddenThreadsPath('/id')).toBe(false)
	})

	it('hides rows already present in hidden thread storage', async () => {
		mocks.getHiddenThreads.mockResolvedValue([
			{
				id: '/foro/cine/supergirl-2026-dc-studios-729454',
				title: 'Supergirl',
				subforum: 'Cine',
				subforumId: '/foro/cine',
				hiddenAt: 1,
			},
		])

		initMobileLiteHiddenThreads()
		await Promise.resolve()

		expect(document.querySelector('#t1')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBe('true')
		expect(document.querySelector('#t2')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBeNull()
	})

	it('stores and hides a thread when tapping its hide button', async () => {
		initMobileLiteHiddenThreads()
		await Promise.resolve()

		document.querySelector<HTMLButtonElement>('#t1 [data-mvp-mobile-lite-hide-thread]')?.click()
		await Promise.resolve()

		expect(mocks.hideThread).toHaveBeenCalledWith({
			id: '/foro/cine/supergirl-2026-dc-studios-729454',
			title: 'Supergirl (2026) | DC Studios',
			subforum: 'Cine',
			subforumId: '/foro/cine',
		})
		expect(document.querySelector('#t1')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBe('true')
	})

	it('does not inject controls when hidden threads are disabled', () => {
		mocks.getSettingsState.mockReturnValue({ hideThreadEnabled: false })

		applyMobileLiteHiddenThreads()

		expect(document.querySelector('[data-mvp-mobile-lite-hide-thread]')).toBeNull()
	})

	it('keeps stored threads hidden when the hide button setting is disabled', async () => {
		mocks.getSettingsState.mockReturnValue({ hideThreadEnabled: false })
		mocks.getHiddenThreads.mockResolvedValue([
			{
				id: '/foro/cine/supergirl-2026-dc-studios-729454',
				title: 'Supergirl',
				subforum: 'Cine',
				subforumId: '/foro/cine',
				hiddenAt: 1,
			},
		])

		initMobileLiteHiddenThreads()
		await Promise.resolve()

		expect(document.querySelector('#t1')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBe('true')
		expect(document.querySelector('#t2')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBeNull()
		expect(document.querySelector('[data-mvp-mobile-lite-hide-thread]')).toBeNull()
	})

	it('removes hide buttons but keeps rows hidden when the setting is toggled off', async () => {
		mocks.getHiddenThreads.mockResolvedValue([
			{
				id: '/foro/cine/supergirl-2026-dc-studios-729454',
				title: 'Supergirl',
				subforum: 'Cine',
				subforumId: '/foro/cine',
				hiddenAt: 1,
			},
		])

		initMobileLiteHiddenThreads()
		await Promise.resolve()
		expect(document.querySelectorAll('[data-mvp-mobile-lite-hide-thread]').length).toBeGreaterThan(0)

		mocks.getSettingsState.mockReturnValue({ hideThreadEnabled: false })
		applyMobileLiteHiddenThreads()

		expect(document.querySelector('[data-mvp-mobile-lite-hide-thread]')).toBeNull()
		expect(document.querySelector('#t1')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBe('true')
	})

	it('hides stored threads on profile thread lists', async () => {
		window.history.replaceState({}, '', '/id/SomeUser/posts')
		mocks.getHiddenThreads.mockResolvedValue([
			{
				id: '/foro/cine/supergirl-2026-dc-studios-729454',
				title: 'Supergirl',
				subforum: 'Cine',
				subforumId: '/foro/cine',
				hiddenAt: 1,
			},
		])

		initMobileLiteHiddenThreads()
		await Promise.resolve()

		expect(document.querySelector('#t1')?.getAttribute('data-mvp-mobile-lite-hidden-thread')).toBe('true')
		expect(document.querySelector('#t2 [data-mvp-mobile-lite-hide-thread]')).not.toBeNull()
	})

	it('cleans injected controls and hidden markers on teardown', async () => {
		initMobileLiteHiddenThreads()
		await Promise.resolve()

		document.querySelector<HTMLButtonElement>('#t1 [data-mvp-mobile-lite-hide-thread]')?.click()
		await Promise.resolve()
		teardownMobileLiteHiddenThreads()

		expect(document.querySelector('[data-mvp-mobile-lite-hide-thread]')).toBeNull()
		expect(document.querySelector('[data-mvp-mobile-lite-hidden-thread]')).toBeNull()
	})
})
