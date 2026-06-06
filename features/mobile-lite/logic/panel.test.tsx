import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('Mobile Lite panel injection', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isFeatureMounted.mockReturnValue(false)
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

	it('adds the Panel MVPremium entry before configuration', () => {
		initMobileLitePanel()

		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
			link.textContent?.trim()
		)

		expect(links).toEqual(['Notificaciones', 'Panel MVPremium', 'Configuración', 'Salir'])
		expect(mocks.mountFeatureWithBoundary).toHaveBeenCalledOnce()
	})

	it('adds the Panel MVPremium entry to Mediavida mobile side user menu', () => {
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

		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
			link.textContent?.trim()
		)

		expect(links).toEqual(['Notificaciones', 'Favoritos', 'Mensajes', 'Marcadores', 'Menciones', 'Panel MVPremium', 'Configuración', 'Salir'])
	})

	it('adds the Panel MVPremium entry to the visible mobile menu instead of the hidden logout dropdown', () => {
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

		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#usermenu > li > a')).map(link =>
			link.textContent?.trim()
		)

		expect(links).toEqual(['Notificaciones', 'Favoritos', 'Mensajes', 'Marcadores', 'Menciones', 'Panel MVPremium', 'Configuración', 'Más'])
		expect(document.querySelector('#usermenu .dropdown-menu [data-mvp-mobile-lite-panel-menu-item]')).toBeNull()
	})

	it('opens the panel from the injected menu entry', () => {
		const openSpy = vi.fn()
		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, openSpy)

		initMobileLitePanel()
		document.querySelector<HTMLAnchorElement>('[data-mvp-mobile-lite-panel-menu-item] a')?.click()

		expect(openSpy).toHaveBeenCalledOnce()

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
		window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT))

		const searchInput = await screen.findByPlaceholderText('Buscar o escribir nick exacto')
		await user.type(searchInput, 'BrokenUser')
		await user.click(screen.getByRole('button', { name: 'Ocultar' }))

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el filtro. Inténtalo de nuevo.')
		})
	})

	it('labels active filtered-user buttons as applied states', async () => {
		mocks.getUserCustomizations.mockResolvedValue({
			users: {
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
				HiddenUser: { isIgnored: true, ignoreType: 'hide' },
			},
			globalSettings: {
				adminColor: '',
				subadminColor: '',
				modColor: '',
				userColor: '',
			},
		})

		render(<MobileLitePanel />)
		window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT))

		expect(await screen.findByRole('button', { name: 'Silenciado' })).toBeInTheDocument()
		expect(await screen.findByRole('button', { name: 'Ocultado' })).toBeInTheDocument()
	})
})
