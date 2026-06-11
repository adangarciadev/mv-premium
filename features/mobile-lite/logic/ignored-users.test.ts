import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	applyMobileLiteIgnoredUsers,
	getMobileLitePostAuthor,
	initMobileLiteIgnoredUsers,
	setMobileLiteUserIgnore,
	teardownMobileLiteIgnoredUsers,
} from './ignored-users'

type WatchUserCustomizations = (callback: (data: UserCustomizationsData) => void) => () => void

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(),
	saveUserCustomizations: vi.fn(),
	watchUserCustomizations: vi.fn<WatchUserCustomizations>(() => vi.fn()),
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
		saveUserCustomizations: mocks.saveUserCustomizations,
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

function renderThreadWithPostWrapper(): void {
	document.body.innerHTML = `
		<div id="post-wrapper">
			<div class="post" data-num="1" id="post-1">
				<div class="post-meta">
					<a class="autor" href="/id/MutedUser">MutedUser</a>
				</div>
				<div class="wrap">
					<div class="post-contents">First muted content</div>
				</div>
			</div>
			<div class="post" data-num="2" id="post-2">
				<div class="post-meta">
					<a class="autor" href="/id/VisibleUser">VisibleUser</a>
				</div>
				<div class="wrap">
					<div class="post-contents">Visible content</div>
				</div>
			</div>
		</div>
	`
}

function renderNativeUserCard(username = 'HiddenUser', id = 'user-card', avatarUrl?: string): void {
	document.body.insertAdjacentHTML(
		'beforeend',
		`
			<div ${id ? `id="${id}"` : ''} class="f-card show">
				<div class="user-info">
					${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="${username}">` : ''}
					<h4><a href="/id/${username}">${username}</a></h4>
				</div>
				<div class="user-controls">
					<a class="btn" href="/mensajes/${username}"><i class="fa fa-envelope"></i> Mensaje</a>
					<button class="btn" type="button"><i class="fa fa-filter"></i> Filtrar posts</button>
				</div>
			</div>
		`
	)
}

describe('Mobile Lite ignored users', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))
		mocks.saveUserCustomizations.mockResolvedValue(undefined)
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

	it('does not mute a post wrapper when it contains real post rows', () => {
		renderThreadWithPostWrapper()

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				MutedUser: {
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		const wrapper = document.querySelector<HTMLElement>('#post-wrapper')
		const mutedPost = document.querySelector<HTMLElement>('#post-1')
		const visiblePost = document.querySelector<HTMLElement>('#post-2')

		expect(wrapper).not.toHaveClass('mvp-muted-user')
		expect(Array.from(wrapper?.children ?? []).some(child => child.classList.contains('mvp-mute-placeholder'))).toBe(false)
		expect(mutedPost).toHaveClass('mvp-muted-user')
		expect(mutedPost?.querySelector('.mvp-mute-placeholder')).not.toBeNull()
		expect(visiblePost).not.toHaveClass('mvp-muted-user')
	})

	it('keeps the native author link behavior so Mediavida can open its user card', () => {
		renderThread()

		applyMobileLiteIgnoredUsers(userCustomizations({}))

		const authorLink = document.querySelector<HTMLAnchorElement>('#post-2 a.autor')
		const event = new MouseEvent('click', { bubbles: true, cancelable: true })
		authorLink?.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(document.querySelector('[data-mvp-mobile-lite-user-actions-menu="true"]')).toBeNull()
	})

	it('injects manual actions into the native Mediavida user card', () => {
		renderThread()
		renderNativeUserCard()

		applyMobileLiteIgnoredUsers(userCustomizations({}))

		const actions = document.querySelector<HTMLElement>('[data-mvp-mobile-lite-user-card-actions="true"]')
		expect(actions).not.toBeNull()
		expect(actions?.parentElement).toBe(document.querySelector('#user-card'))
		expect(actions?.textContent).toContain('Silenciar')
		expect(actions?.textContent).toContain('Ocultar')
		expect(actions?.textContent).not.toContain('Quitar filtro')
	})

	it('injects manual actions into native f-card user popovers without an id', () => {
		renderThread()
		renderNativeUserCard('HiddenUser', '')

		applyMobileLiteIgnoredUsers(userCustomizations({}))

		const card = document.querySelector<HTMLElement>('.f-card')
		const actions = document.querySelector<HTMLElement>('[data-mvp-mobile-lite-user-card-actions="true"]')
		expect(actions).not.toBeNull()
		expect(actions?.parentElement).toBe(card)
		expect(actions?.textContent).toContain('Silenciar')
		expect(actions?.textContent).toContain('Ocultar')
	})

	it('marks active user-card actions and offers clearing when a filter already exists', () => {
		renderThread()
		renderNativeUserCard('MutedUser')

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				MutedUser: {
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		const actions = document.querySelector<HTMLElement>('[data-mvp-mobile-lite-user-card-actions="true"]')
		expect(actions?.textContent).toContain('Silenciado')
		expect(actions?.textContent).toContain('Ocultar')
		expect(actions?.textContent).not.toContain('Quitar filtro')
		expect(actions?.querySelector('.mvp-mobile-lite-user-card-action-active')?.textContent).toContain('Silenciado')
	})

	it('updates actions when Mediavida reuses the same user card for another user', () => {
		renderThread()
		renderNativeUserCard('HiddenUser')

		applyMobileLiteIgnoredUsers(userCustomizations({}))

		const card = document.querySelector<HTMLElement>('#user-card')
		const usernameLink = card?.querySelector<HTMLAnchorElement>('.user-info h4 a')
		expect(usernameLink).not.toBeNull()

		usernameLink!.href = '/id/MutedUser'
		usernameLink!.textContent = 'MutedUser'

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				MutedUser: {
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		const actions = document.querySelector<HTMLElement>('[data-mvp-mobile-lite-user-card-actions="true"]')
		expect(actions?.getAttribute('data-mvp-mobile-lite-user-card-actions-key')).toBe('muteduser:mute')
		expect(actions?.textContent).toContain('Silenciado')
		expect(actions?.textContent).not.toContain('Quitar filtro')
	})

	it('lets active user-card actions clear the filter and dismisses the card after saving', async () => {
		renderThread()
		renderNativeUserCard('MutedUser')
		mocks.getUserCustomizations.mockResolvedValue(
			userCustomizations({
				MutedUser: {
					note: 'No spoilers',
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		applyMobileLiteIgnoredUsers(
			userCustomizations({
				MutedUser: {
					note: 'No spoilers',
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		const activeButton = document.querySelector<HTMLButtonElement>('.mvp-mobile-lite-user-card-action-active')
		expect(activeButton).not.toBeNull()

		activeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		await vi.waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
				userCustomizations({
					MutedUser: {
						note: 'No spoilers',
					},
				})
			)
		})
		expect(document.querySelector<HTMLElement>('#user-card')).toBeNull()
		expect(document.querySelector<HTMLElement>('.rep[data-num="3"]')).not.toHaveClass('mvp-muted-user')
	})

	it('cleans stale muted placeholders even when the mobile ignored marker is missing', async () => {
		renderThread()
		const mutedPost = document.querySelector<HTMLElement>('.rep[data-num="3"]')
		expect(mutedPost).not.toBeNull()
		mutedPost!.classList.add('mvp-muted-user')
		mutedPost!.dataset.mvpHasPlaceholder = 'true'
		mutedPost!.insertAdjacentHTML('beforeend', '<div class="mvp-mute-placeholder">Mensaje oculto de MutedUser</div>')

		mocks.getUserCustomizations.mockResolvedValue(
			userCustomizations({
				MutedUser: {
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)

		await setMobileLiteUserIgnore('MutedUser', null)

		expect(mutedPost).not.toHaveClass('mvp-muted-user')
		expect(mutedPost?.querySelector('.mvp-mute-placeholder')).toBeNull()
		expect(mutedPost?.dataset.mvpHasPlaceholder).toBeUndefined()
	})

	it('shows a confirmation toast when ignoring a user (swipe or user card)', async () => {
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))

		await setMobileLiteUserIgnore('Trolencio', 'mute')

		let toast = document.getElementById('mvp-mobile-lite-action-toast')
		expect(toast?.textContent).toContain('Trolencio ha sido silenciado')
		expect(toast?.getAttribute('role')).toBe('status')

		await setMobileLiteUserIgnore('Trolencio', 'hide')
		toast = document.getElementById('mvp-mobile-lite-action-toast')
		expect(toast?.textContent).toContain('Trolencio ha sido ocultado')

		await setMobileLiteUserIgnore('Trolencio', null)
		toast = document.getElementById('mvp-mobile-lite-action-toast')
		expect(toast?.textContent).toContain('Trolencio vuelve a ser visible')
	})

	it('undoes an ignore from the toast Deshacer button', async () => {
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))

		await setMobileLiteUserIgnore('Trolencio', 'mute')

		const undoButton = document.querySelector<HTMLButtonElement>(
			'#mvp-mobile-lite-action-toast .mvp-mobile-lite-action-toast-button'
		)
		expect(undoButton?.textContent).toBe('Deshacer')

		undoButton?.click()

		await vi.waitFor(() => {
			const toast = document.getElementById('mvp-mobile-lite-action-toast')
			expect(toast?.textContent).toContain('Trolencio vuelve a ser visible')
		})
		// The follow-up toast must not offer another undo
		expect(document.querySelector('#mvp-mobile-lite-action-toast .mvp-mobile-lite-action-toast-button')).toBeNull()
	})

	it('ignores stale storage snapshots after clearing a manual mute', async () => {
		renderThread()
		let watchCallback: (data: UserCustomizationsData) => void = () => undefined
		const initialMutedData = userCustomizations({
			MutedUser: {
				isIgnored: true,
				ignoreType: 'mute',
			},
		})
		const currentMutedData = userCustomizations({
			MutedUser: {
				isIgnored: true,
				ignoreType: 'mute',
			},
		})
		const staleMutedData = userCustomizations({
			MutedUser: {
				isIgnored: true,
				ignoreType: 'mute',
			},
		})
		mocks.watchUserCustomizations.mockImplementation(callback => {
			watchCallback = callback
			return vi.fn()
		})
		mocks.getUserCustomizations.mockResolvedValueOnce(initialMutedData).mockResolvedValueOnce(currentMutedData)

		initMobileLiteIgnoredUsers()

		await vi.waitFor(() => {
			expect(document.querySelector<HTMLElement>('.rep[data-num="3"]')).toHaveClass('mvp-muted-user')
		})

		await setMobileLiteUserIgnore('MutedUser', null)
		const mutedPost = document.querySelector<HTMLElement>('.rep[data-num="3"]')
		expect(mutedPost).not.toHaveClass('mvp-muted-user')

		watchCallback(staleMutedData)

		expect(mutedPost).not.toHaveClass('mvp-muted-user')
		expect(mutedPost?.querySelector('.mvp-mute-placeholder')).toBeNull()

		applyMobileLiteIgnoredUsers(staleMutedData)

		expect(mutedPost).not.toHaveClass('mvp-muted-user')
		expect(mutedPost?.querySelector('.mvp-mute-placeholder')).toBeNull()
	})

	it('saves a manual mute action while preserving existing customization data', async () => {
		mocks.getUserCustomizations.mockResolvedValue(
			userCustomizations({
				HiddenUser: {
					note: 'No spoilers',
				},
			})
		)

		await setMobileLiteUserIgnore('HiddenUser', 'mute')

		expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
			userCustomizations({
				HiddenUser: {
					note: 'No spoilers',
					isIgnored: true,
					ignoreType: 'mute',
				},
			})
		)
	})

	it('stores the native user-card avatar when saving a manual action from the card', async () => {
		renderThread()
		renderNativeUserCard('HiddenUser', 'user-card', 'https://www.mediavida.com/img/users/avatar/hidden-user.png')
		mocks.getUserCustomizations.mockResolvedValue(userCustomizations({}))

		applyMobileLiteIgnoredUsers(userCustomizations({}))

		const muteButton = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mvp-mobile-lite-user-card-actions="true"] button')).find(
			button => button.textContent?.includes('Silenciar')
		)
		expect(muteButton).not.toBeNull()

		muteButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		await vi.waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
				userCustomizations({
					HiddenUser: {
						isIgnored: true,
						ignoreType: 'mute',
						avatarUrl: 'https://www.mediavida.com/img/users/avatar/hidden-user.png',
					},
				})
			)
		})
	})

	it('removes only the manual ignore fields when clearing a filtered user', async () => {
		mocks.getUserCustomizations.mockResolvedValue(
			userCustomizations({
				HiddenUser: {
					note: 'No spoilers',
					isIgnored: true,
					ignoreType: 'hide',
				},
			})
		)

		await setMobileLiteUserIgnore('HiddenUser', null)

		expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
			userCustomizations({
				HiddenUser: {
					note: 'No spoilers',
				},
			})
		)
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
