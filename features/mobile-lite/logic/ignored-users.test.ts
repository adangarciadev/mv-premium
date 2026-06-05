import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	applyMobileLiteIgnoredUsers,
	getMobileLitePostAuthor,
	initMobileLiteIgnoredUsers,
	teardownMobileLiteIgnoredUsers,
} from './ignored-users'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(),
	watchUserCustomizations: vi.fn(() => vi.fn()),
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

function renderThread(): void {
	document.body.innerHTML = `
		<div id="posts-wrap">
			<div class="post" data-num="1" id="post-1">
				<div class="post-meta">
					<a class="autor" href="/id/VisibleUser">VisibleUser</a>
				</div>
				<div class="wrap">
					<div class="post-contents">Visible content</div>
				</div>
			</div>
			<div class="post" data-num="2" id="post-2">
				<div class="post-meta">
					<a class="autor" href="/id/HiddenUser">HiddenUser</a>
				</div>
				<div class="wrap">
					<div class="post-contents">Hidden content</div>
				</div>
			</div>
			<div class="rep" data-num="3">
				<div class="post-header">
					<a class="autor" href="/id/MutedUser">MutedUser</a>
				</div>
				<div class="wrap">
					<div class="post-contents">Muted content</div>
				</div>
			</div>
		</div>
	`
}

describe('Mobile Lite ignored users', () => {
	beforeEach(() => {
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))
		mocks.watchUserCustomizations.mockReturnValue(vi.fn())
	})

	afterEach(() => {
		teardownMobileLiteIgnoredUsers()
	})

	it('detects the post author from the /id/ author link', () => {
		renderThread()

		const post = document.querySelector<HTMLElement>('#post-2')

		expect(post).not.toBeNull()
		expect(getMobileLitePostAuthor(post!)).toBe('HiddenUser')
	})

	it('hides posts from users ignored with hide mode', () => {
		renderThread()

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				HiddenUser: {
					isIgnored: true,
					ignoreType: 'hide',
				},
			})
		)

		const hiddenPost = document.querySelector<HTMLElement>('#post-2')
		const visiblePost = document.querySelector<HTMLElement>('#post-1')

		expect(hiddenPost).not.toBeNull()
		expect(hiddenPost).toHaveClass('mvp-ignored-user')
		expect(hiddenPost).toHaveStyle({ display: 'none' })
		expect(visiblePost).not.toHaveClass('mvp-ignored-user')
	})

	it('mutes posts from users ignored with mute mode', () => {
		renderThread()

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				MutedUser: {
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		const mutedPost = document.querySelector<HTMLElement>('.rep[data-num="3"]')

		expect(mutedPost).not.toBeNull()
		expect(mutedPost).toHaveClass('mvp-muted-user')
		expect(mutedPost?.querySelector('.mvp-mute-placeholder')).not.toBeNull()
		expect(document.getElementById('mvp-mobile-lite-ignored-users-styles')).not.toBeNull()
	})

	it('does not initialize outside Firefox Android', () => {
		renderThread()
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLiteIgnoredUsers()

		expect(mocks.getUserCustomizations).not.toHaveBeenCalled()
		expect(mocks.watchUserCustomizations).not.toHaveBeenCalled()
	})

	it('does not initialize when mobileLiteEnabled is false', () => {
		renderThread()
		mocks.isFeatureEnabled.mockReturnValue(false)

		initMobileLiteIgnoredUsers()

		expect(mocks.getUserCustomizations).not.toHaveBeenCalled()
		expect(mocks.watchUserCustomizations).not.toHaveBeenCalled()
	})
})
