import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	applyMobileLiteIgnoredUserThreads,
	initMobileLiteIgnoredUserThreads,
	isNormalMobileLiteSubforumPath,
	teardownMobileLiteIgnoredUserThreads,
} from './ignored-user-threads'

type WatchUserCustomizations = (callback: (data: UserCustomizationsData) => void) => () => void

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(),
	watchUserCustomizations: vi.fn<WatchUserCustomizations>(() => vi.fn()),
	getSettingsState: vi.fn(() => ({ hideIgnoredUserThreadsEnabled: true })),
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

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: mocks.getSettingsState,
	},
}))

vi.mock('@/features/user-customizations/storage', async importOriginal => {
	const actual = await importOriginal<typeof import('@/features/user-customizations/storage')>()
	return {
		...actual,
		getUserCustomizations: mocks.getUserCustomizations,
		watchUserCustomizations: mocks.watchUserCustomizations,
	}
})

const DEFAULT_GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}

function userCustomizations(users: UserCustomizationsData['users']): UserCustomizationsData {
	return {
		users,
		globalSettings: DEFAULT_GLOBAL_SETTINGS,
	}
}

function setPath(pathname: string): void {
	window.history.replaceState({}, '', pathname)
}

function renderThreadList(): void {
	document.body.innerHTML = `
		<table>
			<tbody id="temas">
				<tr id="thread-visible">
					<td class="col-av">
						<a href="/id/VisibleUser" title="VisibleUser creó el tema">VisibleUser</a>
					</td>
					<td class="col-th">
						<div class="thread"><a href="/foro/juegos/hilo-visible-111">Visible thread</a></div>
					</td>
				</tr>
				<tr id="thread-hidden">
					<td class="col-av">
						<a href="/id/HiddenUser" title="HiddenUser creó el tema">HiddenUser</a>
					</td>
					<td class="col-th">
						<div class="thread"><a href="/foro/juegos/hilo-hidden-222">Hidden thread</a></div>
					</td>
				</tr>
				<tr id="thread-muted">
					<td class="col-av">
						<a href="/id/MutedUser" title="MutedUser creó el tema">MutedUser</a>
					</td>
					<td class="col-th">
						<div class="thread"><a href="/foro/juegos/hilo-muted-333">Muted thread</a></div>
					</td>
				</tr>
			</tbody>
		</table>
	`
}

describe('Mobile Lite ignored user threads', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getSettingsState.mockReturnValue({ hideIgnoredUserThreadsEnabled: true })
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))
		mocks.watchUserCustomizations.mockReturnValue(vi.fn())
		setPath('/foro/juegos')
	})

	afterEach(() => {
		teardownMobileLiteIgnoredUserThreads()
		document.body.innerHTML = ''
	})

	it('detects normal subforum paths but excludes global views and thread pages', () => {
		expect(isNormalMobileLiteSubforumPath('/foro/juegos')).toBe(true)
		expect(isNormalMobileLiteSubforumPath('/foro/juegos/2')).toBe(true)
		expect(isNormalMobileLiteSubforumPath('/foro/spy')).toBe(false)
		expect(isNormalMobileLiteSubforumPath('/foro/new')).toBe(false)
		expect(isNormalMobileLiteSubforumPath('/foro/unread')).toBe(false)
		expect(isNormalMobileLiteSubforumPath('/foro/top')).toBe(false)
		expect(isNormalMobileLiteSubforumPath('/foro/featured')).toBe(false)
		expect(isNormalMobileLiteSubforumPath('/foro/juegos/hilo-hidden-222')).toBe(false)
	})

	it('hides normal subforum threads created by users ignored with hide mode', () => {
		renderThreadList()

		applyMobileLiteIgnoredUserThreads(['HiddenUser'])

		expect(document.querySelector<HTMLElement>('#thread-hidden')).toHaveStyle({ display: 'none' })
		expect(document.querySelector<HTMLElement>('#thread-hidden')).toHaveAttribute(
			'data-mvp-mobile-lite-hidden-ignored-author',
			'true'
		)
		expect(document.querySelector<HTMLElement>('#thread-visible')).not.toHaveAttribute(
			'data-mvp-mobile-lite-hidden-ignored-author'
		)
	})

	it('does not hide muted users when syncing from storage', async () => {
		renderThreadList()
		mocks.getUserCustomizations.mockResolvedValue(
			userCustomizations({
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
			})
		)

		initMobileLiteIgnoredUserThreads()
		await vi.waitFor(() => {
			expect(document.querySelector<HTMLElement>('#thread-hidden')).toHaveStyle({ display: 'none' })
		})

		expect(document.querySelector<HTMLElement>('#thread-muted')).not.toHaveAttribute(
			'data-mvp-mobile-lite-hidden-ignored-author'
		)
	})

	it('does not hide threads on spy pages', () => {
		renderThreadList()
		setPath('/foro/spy')

		applyMobileLiteIgnoredUserThreads(['HiddenUser'])

		expect(document.querySelector<HTMLElement>('#thread-hidden')).not.toHaveAttribute(
			'data-mvp-mobile-lite-hidden-ignored-author'
		)
	})

	it('clears hidden rows when the desktop setting is disabled', () => {
		renderThreadList()
		applyMobileLiteIgnoredUserThreads(['HiddenUser'])

		mocks.getSettingsState.mockReturnValue({ hideIgnoredUserThreadsEnabled: false })
		applyMobileLiteIgnoredUserThreads(['HiddenUser'])

		expect(document.querySelector<HTMLElement>('#thread-hidden')).not.toHaveAttribute(
			'data-mvp-mobile-lite-hidden-ignored-author'
		)
		expect(document.querySelector<HTMLElement>('#thread-hidden')).not.toHaveStyle({ display: 'none' })
	})

	it('does not initialize outside Firefox Android Mobile Lite', () => {
		renderThreadList()
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLiteIgnoredUserThreads()

		expect(mocks.getUserCustomizations).not.toHaveBeenCalled()
		expect(mocks.watchUserCustomizations).not.toHaveBeenCalled()
	})
})
