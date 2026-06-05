import { ShadowWrapper } from '@/components/shadow-wrapper'
import { MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { createContainer, isFeatureMounted, mountFeatureWithBoundary } from '@/lib/content-modules/utils/react-helpers'
import { getPlatformKind } from '@/lib/platform'
import { MobileLitePanel, MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'

const FEATURE_ID = 'mobile-lite-panel'
const CONTAINER_ID = 'mvp-mobile-lite-panel-root'
const MENU_ITEM_ATTR = 'data-mvp-mobile-lite-panel-menu-item'
const USER_MENU_SELECTOR = [
	`${MV_SELECTORS.GLOBAL.USERMENU} li.logout ul.dropdown-menu.user-menu`,
	`${MV_SELECTORS.GLOBAL.USERMENU} ul.dropdown-menu.user-menu`,
	`${MV_SELECTORS.GLOBAL.USERMENU} .user-menu`,
	MV_SELECTORS.GLOBAL.USERMENU,
].join(', ')

let initialized = false
let menuObserver: MutationObserver | null = null
let userMenuClickListenerAttached = false

function handleUserMenuClick(event: MouseEvent): void {
	const target = event.target
	if (!(target instanceof Element)) return
	if (!target.closest(MV_SELECTORS.GLOBAL.USERMENU)) return

	window.setTimeout(injectPanelMenuItem, 0)
	window.setTimeout(injectPanelMenuItem, 150)
}

function isMobileLitePanelAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function openMobileLitePanel(event?: Event): void {
	event?.preventDefault()
	event?.stopPropagation()
	window.dispatchEvent(new CustomEvent(MOBILE_LITE_PANEL_OPEN_EVENT))
}

function createPanelMenuItem(): HTMLLIElement {
	const item = document.createElement('li')
	item.setAttribute(MENU_ITEM_ATTR, 'true')

	const link = document.createElement('a')
	link.href = '#mvp-panel'
	link.innerHTML = '<i class="fa fa-shield"></i> <span class="title">Panel MVPremium</span>'
	link.addEventListener('click', openMobileLitePanel)

	item.appendChild(link)
	return item
}

function findMenuInsertionTarget(menu: HTMLElement): Element | null {
	const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>('a'))
	const configLink = links.find(link => link.href.includes('/configuracion') || link.textContent?.includes('Configuración'))
	if (configLink?.parentElement) return configLink.parentElement

	const logoutLink = links.find(link => link.textContent?.includes('Salir'))
	return logoutLink?.parentElement ?? menu.lastElementChild
}

function injectPanelMenuItem(): void {
	if (!isMobileLitePanelAllowed()) return

	document.querySelectorAll<HTMLElement>(USER_MENU_SELECTOR).forEach(menu => {
		if (menu.querySelector(`[${MENU_ITEM_ATTR}="true"]`)) return
		if (menu.matches(MV_SELECTORS.GLOBAL.USERMENU) && menu.querySelector('ul.dropdown-menu.user-menu, .user-menu')) return

		const item = createPanelMenuItem()
		const insertionTarget = findMenuInsertionTarget(menu)
		if (insertionTarget) {
			menu.insertBefore(item, insertionTarget)
			return
		}

		if (menu.matches(MV_SELECTORS.GLOBAL.USERMENU)) return

		menu.appendChild(item)
	})
}

function ensurePanelRoot(): void {
	if (isFeatureMounted(FEATURE_ID)) return

	const existingContainer = document.getElementById(CONTAINER_ID)
	const container =
		existingContainer ??
		createContainer({
			id: CONTAINER_ID,
			parent: document.body,
		})

	mountFeatureWithBoundary(
		FEATURE_ID,
		container,
		<ShadowWrapper>
			<MobileLitePanel />
		</ShadowWrapper>,
		'Mobile Lite Panel'
	)
}

function ensureUserMenuClickListener(): void {
	if (userMenuClickListenerAttached) return

	document.addEventListener('click', handleUserMenuClick, true)
	userMenuClickListenerAttached = true
}

export function initMobileLitePanel(): void {
	if (!isMobileLitePanelAllowed()) return
	if (initialized) {
		injectPanelMenuItem()
		return
	}

	initialized = true
	ensurePanelRoot()
	injectPanelMenuItem()
	ensureUserMenuClickListener()

	menuObserver = new MutationObserver(injectPanelMenuItem)
	menuObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLitePanel(): void {
	menuObserver?.disconnect()
	menuObserver = null
	if (userMenuClickListenerAttached) {
		document.removeEventListener('click', handleUserMenuClick, true)
		userMenuClickListenerAttached = false
	}
	initialized = false
	document.querySelectorAll(`[${MENU_ITEM_ATTR}="true"]`).forEach(item => item.remove())
}
