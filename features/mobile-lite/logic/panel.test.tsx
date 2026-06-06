import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserCustomization, UserCustomizationsData } from '@/features/user-customizations/storage'
import { MobileLitePanel, MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'
import { initMobileLitePanel, teardownMobileLitePanel } from './panel'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(() =>
		Promise.resolve({
			users: {},
			globalSettings: {
				adminColor: '',
				subadminColor: '',
				modColor: '',
				userColor: '',
			},
		})
	),
	saveUserCustomizations: vi.fn(() => Promise.resolve()),
	watchUserCustomizations: vi.fn(() => vi.fn()),
	dispatchMobileLiteIgnoredUsersSync: vi.fn(),
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

vi.mock('./ignored-users-sync-event', () => ({
	dispatchMobileLiteIgnoredUsersSync: mocks.dispatchMobileLiteIgnoredUsersSync,
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
		expect(stableNewThreadLink?.querySelector<HTMLElement>('.title')?.style.display).toBe('')
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
				FraG: { adminColor: '#f0a020' },
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
})
