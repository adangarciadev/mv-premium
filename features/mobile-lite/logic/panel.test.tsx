import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HiddenThread } from '@/features/hidden-threads/logic/storage'
import type { UserCustomization, UserCustomizationsData } from '@/features/user-customizations/storage'
import type { MvUserAvatarResult } from '@/lib/messaging'
import { MobileLitePanel, MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'
import { initMobileLitePanel, teardownMobileLitePanel } from './panel'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(() =>
		Promise.resolve<UserCustomizationsData>({
			users: {},
			globalSettings: {
				adminColor: '',
				subadminColor: '',
				modColor: '',
				userColor: '',
			},
		})
	),
	saveUserCustomizations: vi.fn((_data: UserCustomizationsData) => Promise.resolve()),
	watchUserCustomizations: vi.fn(() => vi.fn()),
	getHiddenThreads: vi.fn(() => Promise.resolve<HiddenThread[]>([])),
	unhideThread: vi.fn((_threadId: string) => Promise.resolve()),
	watchHiddenThreads: vi.fn(() => vi.fn()),
	dispatchMobileLiteIgnoredUsersSync: vi.fn(),
	sendMessage: vi.fn<() => Promise<MvUserAvatarResult>>(() => Promise.resolve({ success: false })),
	createContainer: vi.fn((options: { id?: string; parent: Element }) => {
		const container = document.createElement('div')
		if (options.id) container.id = options.id
		options.parent.appendChild(container)
		return container
	}),
	isFeatureMounted: vi.fn(() => false),
	mountFeatureWithBoundary: vi.fn(),
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

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	createContainer: mocks.createContainer,
	isFeatureMounted: mocks.isFeatureMounted,
	mountFeatureWithBoundary: mocks.mountFeatureWithBoundary,
}))

vi.mock('@/features/user-customizations/storage', () => ({
	getUserCustomizations: mocks.getUserCustomizations,
	saveUserCustomizations: mocks.saveUserCustomizations,
	watchUserCustomizations: mocks.watchUserCustomizations,
}))

vi.mock('@/features/hidden-threads/logic/storage', () => ({
	getHiddenThreads: mocks.getHiddenThreads,
	unhideThread: mocks.unhideThread,
	watchHiddenThreads: mocks.watchHiddenThreads,
}))

vi.mock('./ignored-users-sync-event', () => ({
	dispatchMobileLiteIgnoredUsersSync: mocks.dispatchMobileLiteIgnoredUsersSync,
}))

vi.mock('@/lib/messaging', () => ({
	sendMessage: mocks.sendMessage,
}))

vi.mock('@/components/shadow-wrapper', () => ({
	ShadowWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function createCustomizationData(users: Record<string, UserCustomization>): UserCustomizationsData {
	return {
		users,
		globalSettings: {
			adminColor: '',
			subadminColor: '',
			modColor: '',
			userColor: '',
		},
	}
}

function cloneCustomizationData(data: UserCustomizationsData): UserCustomizationsData {
	return createCustomizationData(
		Object.fromEntries(Object.entries(data.users).map(([username, customization]) => [username, { ...customization }]))
	)
}

async function openPanel() {
	await act(async () => {
		window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT))
	})
}

function filterButtonName(label: string, count: number): RegExp {
	return new RegExp(`^${label}\\s*\\(\\s*${count}\\s*\\)$`)
}

describe('Mobile Lite panel injection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isFeatureMounted.mockReturnValue(false)
		mocks.getUserCustomizations.mockResolvedValue(createCustomizationData({}))
		mocks.saveUserCustomizations.mockResolvedValue(undefined)
		mocks.getHiddenThreads.mockResolvedValue([])
		mocks.unhideThread.mockResolvedValue(undefined)
		mocks.watchHiddenThreads.mockReturnValue(vi.fn())
		mocks.sendMessage.mockResolvedValue({ success: false })
		document.body.innerHTML = `
			<ul id="usermenu">
				<li><a href="/notificaciones">Notificaciones</a></li>
				<li><a href="/configuracion">Configuración</a></li>
				<li><a href="/logout">Salir</a></li>
			</ul>
		`
	})

	afterEach(() => {
		teardownMobileLitePanel()
	})

	it('adds the new thread and Panel MVPremium entries before configuration', async () => {
		initMobileLitePanel()

		await waitFor(() => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
				link.textContent?.trim()
			)

			expect(links).toEqual(['Notificaciones', 'Nuevo hilo', 'Panel MVPremium', 'Configuración', 'Salir'])
		})
		expect(mocks.mountFeatureWithBoundary).toHaveBeenCalledOnce()
	})

	it('adds the new thread and Panel MVPremium entries to Mediavida mobile side user menu', async () => {
		document.body.innerHTML = `
			<ul id="usermenu" class="m-side">
				<li><a href="/notificaciones"><i class="fa fa-exclamation-circle"></i><span class="title">Notificaciones</span></a></li>
				<li><a href="/foro/favoritos"><i class="fa fa-star"></i><span class="title">Favoritos</span></a></li>
				<li><a href="/mensajes"><i class="fa fa-envelope"></i><span class="title">Mensajes</span></a></li>
				<li><a href="/id/Test/marcadores"><i class="fa fa-bookmark"></i><span class="title">Marcadores</span></a></li>
				<li><a href="/id/Test/menciones"><i class="fa fa-at"></i><span class="title">Menciones</span></a></li>
				<li><a href="/configuracion"><i class="fa fa-cog"></i><span class="title">Configuración</span></a></li>
				<li><a href="/logout"><i class="fa fa-sign-out"></i><span class="title">Salir</span></a></li>
			</ul>
		`

		initMobileLitePanel()

		await waitFor(() => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
				link.textContent?.trim()
			)

			expect(links).toEqual(['Notificaciones', 'Favoritos', 'Mensajes', 'Marcadores', 'Menciones', 'Nuevo hilo', 'Panel MVPremium', 'Configuración', 'Salir'])
		})
	})

	it('adds the new thread and Panel MVPremium entries to the visible mobile menu instead of the hidden logout dropdown', async () => {
		document.body.innerHTML = `
			<ul id="usermenu">
				<li><a href="/notificaciones"><span class="title">Notificaciones</span></a></li>
				<li><a href="/foro/favoritos"><span class="title">Favoritos</span></a></li>
				<li><a href="/mensajes"><span class="title">Mensajes</span></a></li>
				<li><a href="/id/Test/marcadores"><span class="title">Marcadores</span></a></li>
				<li><a href="/id/Test/menciones"><span class="title">Menciones</span></a></li>
				<li><a href="/configuracion"><span class="title">Configuración</span></a></li>
				<li class="logout dd">
					<a href="#" class="off dropdown-toggle">Más</a>
					<ul class="dropdown-menu pull-right user-menu">
						<li><a href="/id/Test/marcadores">Marcadores</a></li>
						<li data-mvp-mobile-lite-panel-menu-item="true"><a href="#mvp-panel">Panel MVPremium</a></li>
						<li><a href="/configuracion">Configuración</a></li>
						<li><a href="/logout">Salir</a></li>
					</ul>
				</li>
			</ul>
		`

		initMobileLitePanel()

		await waitFor(() => {
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
				link.textContent?.trim()
			)

			expect(links).toEqual(['Notificaciones', 'Favoritos', 'Mensajes', 'Marcadores', 'Menciones', 'Nuevo hilo', 'Panel MVPremium', 'Configuración', 'Más'])
		})
		expect(document.querySelector('#usermenu .dropdown-menu [data-mvp-mobile-lite-panel-menu-item]')).toBeNull()
	})

	it('toggles the new thread subforum list and keeps it open after menu reinjection checks', async () => {
		initMobileLitePanel()

		const newThreadLink = await waitFor(() => document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-new-thread-menu-item] > a'))
		expect(newThreadLink?.textContent?.trim()).toBe('Nuevo hilo')

		const subforumList = document.querySelector<HTMLUListElement>('[data-mvp-mobile-lite-new-thread-menu-item] > ul')
		const menu = document.querySelector<HTMLElement>('#usermenu')
		expect(subforumList?.style.display).toBe('none')
		expect(subforumList?.getAttribute('aria-hidden')).toBe('true')

		newThreadLink?.click()

		expect(newThreadLink?.getAttribute('aria-expanded')).toBe('true')
		expect(subforumList?.getAttribute('aria-hidden')).toBe('false')
		expect(subforumList?.style.display).toBe('grid')
		expect(subforumList?.style.gridTemplateColumns).toContain('repeat(2')
		expect(subforumList?.style.position).toBe('fixed')
		expect(subforumList?.style.left).toBe('0px')
		expect(menu?.style.width).toBe('72px')
		expect(menu?.style.minWidth).toBe('72px')
		expect(menu?.style.maxWidth).toBe('72px')
		expect(newThreadLink?.style.fontSize).toBe('0px')
		expect(newThreadLink?.querySelector<HTMLElement>('i')?.style.fontSize).toBe('18px')
		expect(newThreadLink?.querySelector<HTMLElement>('.title')?.style.display).toBe('none')

		const subforumLinks = Array.from(subforumList?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
		expect(subforumLinks[0]?.textContent?.trim()).toBe('Off-topic')
		expect(subforumLinks[0]?.getAttribute('href')).toBe('/foro/off-topic/nuevo-hilo')
		expect(subforumLinks.some(link => link.textContent?.trim() === 'Juegos')).toBe(true)
		const gameDevItem = subforumLinks.find(link => link.textContent?.trim() === 'Desarrollo de juegos')?.parentElement
		expect(gameDevItem?.style.gridColumn).toBe('1 / -1')
		const mediavidaItem = subforumLinks.find(link => link.textContent?.trim() === 'Mediavida')?.parentElement
		expect(mediavidaItem?.style.gridColumn).toBe('1 / -1')
		expect(subforumList?.querySelectorAll('[role="separator"]')).toHaveLength(3)

		await new Promise(resolve => window.setTimeout(resolve, 180))

		const stableNewThreadLink = document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-new-thread-menu-item] > a')
		const stableSubforumList = document.querySelector<HTMLUListElement>('[data-mvp-mobile-lite-new-thread-menu-item] > ul')
		expect(stableNewThreadLink).toBe(newThreadLink)
		expect(stableNewThreadLink?.getAttribute('aria-expanded')).toBe('true')
		expect(stableSubforumList?.style.display).toBe('grid')

		stableNewThreadLink?.click()

		expect(stableNewThreadLink?.getAttribute('aria-expanded')).toBe('false')
		expect(stableSubforumList?.style.display).toBe('none')
		expect(menu?.style.width).toBe('')
		expect(stableNewThreadLink?.style.fontSize).toBe('')
		expect(stableNewThreadLink?.querySelector<HTMLElement>('i')?.style.fontSize).toBe('')
		expect(stableNewThreadLink?.querySelector<HTMLElement>('.title')?.style.display).toBe('')
	})

	it('hides text-only menu labels while the new thread list compacts the side menu', async () => {
		document.body.innerHTML = `
			<ul id="usermenu">
				<li><a href="/notificaciones"><i class="fa fa-exclamation-circle"></i><span class="title">Notificaciones</span></a></li>
				<li class="logout dd"><a href="#" class="off dropdown-toggle">Más</a></li>
				<li><a href="/configuracion"><i class="fa fa-cog"></i><span class="title">Configuración</span></a></li>
			</ul>
		`

		initMobileLitePanel()
		const newThreadLink = await waitFor(() => document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-new-thread-menu-item] > a'))
		const textOnlyLink = document.querySelector<HTMLAnchorElement>('#usermenu .logout > a')

		newThreadLink?.click()

		expect(textOnlyLink?.style.fontSize).toBe('0px')

		newThreadLink?.click()

		expect(textOnlyLink?.style.fontSize).toBe('')
	})

	it('opens the panel from the injected menu entry', async () => {
		const openSpy = vi.fn()
		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, openSpy)

		initMobileLitePanel()
		const panelLink = await waitFor(() => document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-panel-menu-item] a'))
		panelLink?.click()

		expect(openSpy).toHaveBeenCalledOnce()

		window.removeEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, openSpy)
	})

	it('closes the new thread panel and restores menu width before opening Panel MVPremium', async () => {
		const openSpy = vi.fn()
		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, openSpy)

		initMobileLitePanel()
		const newThreadLink = await waitFor(() => document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-new-thread-menu-item] > a'))
		const panelLink = await waitFor(() => document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-panel-menu-item] a'))
		const subforumList = document.querySelector<HTMLUListElement>('[data-mvp-mobile-lite-new-thread-menu-item] > ul')
		const menu = document.querySelector<HTMLElement>('#usermenu')

		newThreadLink?.click()
		expect(subforumList?.style.display).toBe('grid')
		expect(menu?.style.width).toBe('72px')

		panelLink?.click()

		expect(openSpy).toHaveBeenCalledOnce()
		expect(subforumList?.style.display).toBe('none')
		expect(subforumList?.getAttribute('aria-hidden')).toBe('true')
		expect(menu?.style.width).toBe('')

		window.removeEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, openSpy)
	})

	it('does not inject outside Firefox Android Mobile Lite', () => {
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLitePanel()

		expect(document.querySelector('[data-mvp-mobile-lite-panel-menu-item]')).toBeNull()
		expect(mocks.mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('shows a visible error when saving a filter fails', async () => {
		mocks.saveUserCustomizations.mockRejectedValueOnce(new Error('storage failed'))
		const user = userEvent.setup()

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'BrokenUser')
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el filtro. Inténtalo de nuevo.')
		})
	})

	it('clears the search after adding an exact username filter', async () => {
		const user = userEvent.setup()

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'NewHiddenUser')
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(searchInput).toHaveValue('')
		})
		expect(screen.getByRole('status')).toHaveTextContent('NewHiddenUser ocultado.')
	})

	it('stores the visible page avatar when adding a user from the search', async () => {
		const user = userEvent.setup()
		document.body.insertAdjacentHTML(
			'beforeend',
			`
				<a class="user-card" href="/id/AvatarUser">
					<img class="avatar" alt="AvatarUser" src="https://www.mediavida.com/img/users/avatar/avatar-user.png">
				</a>
			`
		)

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'AvatarUser')
		await user.click(screen.getByRole('button', { name: 'Silenciar' }))

		await waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalled()
		})
		const savedData = mocks.saveUserCustomizations.mock.calls[mocks.saveUserCustomizations.mock.calls.length - 1][0]
		expect(savedData.users.AvatarUser).toMatchObject({
			isIgnored: true,
			ignoreType: 'mute',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/avatar-user.png',
		})
		expect(mocks.sendMessage).not.toHaveBeenCalled()
	})

	it('stores a resolved avatar when adding a user that is not visible on the page', async () => {
		const user = userEvent.setup()
		mocks.sendMessage.mockResolvedValueOnce({
			success: true,
			username: 'RemoteUser',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/remote-user.png',
		})

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'RemoteUser')
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalled()
		})
		expect(mocks.sendMessage).toHaveBeenCalledWith('resolveMvUserAvatar', { username: 'RemoteUser' })
		const savedData = mocks.saveUserCustomizations.mock.calls[mocks.saveUserCustomizations.mock.calls.length - 1][0]
		expect(savedData.users.RemoteUser).toMatchObject({
			isIgnored: true,
			ignoreType: 'hide',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/remote-user.png',
		})
	})

	it('hydrates missing avatars for already filtered users when the panel opens', async () => {
		const importedData = createCustomizationData({
			ImportedUser: { isIgnored: true, ignoreType: 'hide' },
		})
		mocks.getUserCustomizations.mockResolvedValue(importedData)
		mocks.sendMessage.mockResolvedValueOnce({
			success: true,
			username: 'ImportedUser',
			avatarUrl: 'https://www.mediavida.com/img/users/avatar/imported-user.png',
		})

		render(<MobileLitePanel />)
		await openPanel()

		await waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
				createCustomizationData({
					ImportedUser: {
						isIgnored: true,
						ignoreType: 'hide',
						avatarUrl: 'https://www.mediavida.com/img/users/avatar/imported-user.png',
					},
				})
			)
		})
	})

	it('lets users manually refresh missing avatars after an automatic hydration miss', async () => {
		const user = userEvent.setup()
		const importedData = createCustomizationData({
			LegacyUser: { isIgnored: true, ignoreType: 'hide' },
		})
		mocks.getUserCustomizations.mockResolvedValue(importedData)
		mocks.sendMessage
			.mockResolvedValueOnce({ success: false })
			.mockResolvedValueOnce({
				success: true,
				username: 'LegacyUser',
				avatarUrl: 'https://www.mediavida.com/img/users/avatar/legacy-user.png',
			})

		render(<MobileLitePanel />)
		await openPanel()

		await waitFor(() => {
			expect(mocks.sendMessage).toHaveBeenCalledWith('resolveMvUserAvatar', { username: 'LegacyUser' })
		})
		await user.click(await screen.findByRole('button', { name: /Actualizar avatares \(1\)/ }))

		await waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
				createCustomizationData({
					LegacyUser: {
						isIgnored: true,
						ignoreType: 'hide',
						avatarUrl: 'https://www.mediavida.com/img/users/avatar/legacy-user.png',
					},
				})
			)
		})
	})

	it('retries avatar hydration after a failed resolve when the panel opens again', async () => {
		const user = userEvent.setup()
		const importedData = createCustomizationData({
			RetryUser: { isIgnored: true, ignoreType: 'hide' },
		})
		mocks.getUserCustomizations.mockResolvedValue(importedData)
		mocks.sendMessage
			.mockResolvedValueOnce({ success: false })
			.mockResolvedValueOnce({
				success: true,
				username: 'RetryUser',
				avatarUrl: 'https://www.mediavida.com/img/users/avatar/retry-user.png',
			})

		render(<MobileLitePanel />)
		await openPanel()

		await waitFor(() => {
			expect(mocks.sendMessage).toHaveBeenCalledWith('resolveMvUserAvatar', { username: 'RetryUser' })
		})
		expect(mocks.saveUserCustomizations).not.toHaveBeenCalledWith(
			createCustomizationData({
				RetryUser: {
					isIgnored: true,
					ignoreType: 'hide',
					avatarUrl: 'https://www.mediavida.com/img/users/avatar/retry-user.png',
				},
			})
		)

		await user.click(screen.getByRole('button', { name: 'Cerrar' }))
		await openPanel()

		await waitFor(() => {
			expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
				createCustomizationData({
					RetryUser: {
						isIgnored: true,
						ignoreType: 'hide',
						avatarUrl: 'https://www.mediavida.com/img/users/avatar/retry-user.png',
					},
				})
			)
		})
	})

	it('validates username length and allowed characters before adding a filter', async () => {
		const user = userEvent.setup()

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'ab')

		expect(screen.getByText('Escribe al menos 3 caracteres para añadir un usuario.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Silenciar' })).not.toBeInTheDocument()

		await user.clear(searchInput)
		await user.type(searchInput, 'bad user')

		expect(screen.getByText('Usa solo letras, números, guiones y guiones bajos.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument()

		await user.clear(searchInput)
		await user.type(searchInput, 'LongUserName123')

		expect(searchInput).toHaveValue('LongUserName123')
		expect(screen.getByText('El nick no puede tener más de 13 caracteres.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Silenciar' })).not.toBeInTheDocument()
	})

	it('matches existing usernames case-insensitively while preserving stored casing', async () => {
		const user = userEvent.setup()
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				FraG: { usernameColour: '#f0a020' },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		const searchInput = await screen.findByPlaceholderText('Buscar o añadir nick (3-13)')
		await user.type(searchInput, 'frag')

		expect(screen.getByText('FraG')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(searchInput).toHaveValue('')
		})
		expect(screen.getByRole('status')).toHaveTextContent('FraG ocultado.')
	})

	it('labels active filtered-user buttons as applied states', async () => {
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		expect(await screen.findByRole('button', { name: 'Silenciado' })).toBeInTheDocument()
		expect(await screen.findByRole('button', { name: 'Ocultado' })).toBeInTheDocument()
	})

	it('shows user filter counters for all, muted and hidden users', async () => {
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
				LegacyHiddenUser: { isIgnored: true },
				VisibleUser: { isIgnored: false },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		expect(await screen.findByRole('button', { name: filterButtonName('Todos', 3) })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: filterButtonName('Silenciados', 1) })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: filterButtonName('Ocultos', 2) })).toBeInTheDocument()
	})

	it('filters the list to muted users', async () => {
		const user = userEvent.setup()
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
				LegacyHiddenUser: { isIgnored: true },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		await user.click(await screen.findByRole('button', { name: filterButtonName('Silenciados', 1) }))

		expect(screen.getByText('MutedUser')).toBeInTheDocument()
		expect(screen.queryByText('HiddenUser')).not.toBeInTheDocument()
		expect(screen.queryByText('LegacyHiddenUser')).not.toBeInTheDocument()
	})

	it('filters the list to hidden users including legacy entries without ignoreType', async () => {
		const user = userEvent.setup()
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
				LegacyHiddenUser: { isIgnored: true },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		await user.click(await screen.findByRole('button', { name: filterButtonName('Ocultos', 2) }))

		expect(screen.queryByText('MutedUser')).not.toBeInTheDocument()
		expect(screen.getByText('HiddenUser')).toBeInTheDocument()
		expect(screen.getByText('LegacyHiddenUser')).toBeInTheDocument()
	})

	it('applies text search inside the active user filter', async () => {
		const user = userEvent.setup()
		mocks.getUserCustomizations.mockResolvedValue(
			createCustomizationData({
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
				LegacyHiddenUser: { isIgnored: true },
			})
		)

		render(<MobileLitePanel />)
		await openPanel()

		await user.click(await screen.findByRole('button', { name: filterButtonName('Ocultos', 2) }))
		await user.type(screen.getByPlaceholderText('Buscar o añadir nick (3-13)'), 'legacy')

		expect(screen.getByText('LegacyHiddenUser')).toBeInTheDocument()
		expect(screen.queryByText('HiddenUser')).not.toBeInTheDocument()
		expect(screen.queryByText('MutedUser')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: filterButtonName('Todos', 3) })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: filterButtonName('Ocultos', 2) })).toBeInTheDocument()
	})

	it('updates counters and visible results when changing a muted user to hidden', async () => {
		const user = userEvent.setup()
		let storedData = createCustomizationData({
			MutedUser: { isIgnored: true, ignoreType: 'mute' },
		})
		mocks.getUserCustomizations.mockImplementation(() => Promise.resolve(cloneCustomizationData(storedData)))
		mocks.saveUserCustomizations.mockImplementation((nextData: UserCustomizationsData) => {
			storedData = nextData
			return Promise.resolve()
		})

		render(<MobileLitePanel />)
		await openPanel()

		await user.click(await screen.findByRole('button', { name: filterButtonName('Silenciados', 1) }))
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(screen.getByRole('button', { name: filterButtonName('Silenciados', 0) })).toBeInTheDocument()
		})
		expect(screen.getByRole('button', { name: filterButtonName('Ocultos', 1) })).toBeInTheDocument()
		expect(screen.queryByText('MutedUser')).not.toBeInTheDocument()
		expect(screen.getByText('No hay resultados para este filtro.')).toBeInTheDocument()
	})

	it('lists hidden threads and lets users restore them from the panel', async () => {
		const user = userEvent.setup()
		const hiddenThread: HiddenThread = {
			id: '/foro/cine/supergirl-2026-dc-studios-729454',
			title: 'Supergirl (2026) | DC Studios',
			subforum: 'Cine',
			subforumId: '/foro/cine',
			hiddenAt: new Date('2026-06-09T12:00:00Z').getTime(),
		}
		mocks.getHiddenThreads.mockResolvedValueOnce([hiddenThread]).mockResolvedValueOnce([])

		render(<MobileLitePanel />)
		await openPanel()
		await user.click(screen.getByRole('tab', { name: 'Hilos' }))

		expect(await screen.findByText('Supergirl (2026) | DC Studios')).toBeInTheDocument()
		expect(screen.getByText('Cine')).toBeInTheDocument()
		expect(screen.getByText('09/06/26')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Mostrar' }))

		await waitFor(() => {
			expect(mocks.unhideThread).toHaveBeenCalledWith('/foro/cine/supergirl-2026-dc-studios-729454')
		})
		expect(await screen.findByText('No hay hilos ocultos.')).toBeInTheDocument()
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
	})
})
