import { ShadowWrapper } from '@/components/shadow-wrapper'
import { MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { createContainer, isFeatureMounted, mountFeatureWithBoundary } from '@/lib/content-modules/utils/react-helpers'
import { getPlatformKind } from '@/lib/platform'
import {
	SUBFORUMS,
	SUBFORUMS_COMUNIDAD,
	SUBFORUMS_JUEGOS,
	SUBFORUMS_TECNOLOGIA,
	getNewThreadUrl,
	type SubforumInfo,
} from '@/lib/subforums'
import { MobileLitePanel, MOBILE_LITE_PANEL_OPEN_EVENT } from '../components/mobile-lite-panel'

const FEATURE_ID = 'mobile-lite-panel'
const CONTAINER_ID = 'mvp-mobile-lite-panel-root'
const MENU_ITEM_ATTR = 'data-mvp-mobile-lite-panel-menu-item'
const NEW_THREAD_MENU_ITEM_ATTR = 'data-mvp-mobile-lite-new-thread-menu-item'
const MENU_PREVIOUS_MAX_WIDTH_ATTR = 'data-mvp-mobile-lite-prev-max-width'
const MENU_PREVIOUS_MIN_WIDTH_ATTR = 'data-mvp-mobile-lite-prev-min-width'
const MENU_PREVIOUS_WIDTH_ATTR = 'data-mvp-mobile-lite-prev-width'
const MENU_TITLE_PREVIOUS_DISPLAY_ATTR = 'data-mvp-mobile-lite-prev-display'
const MENU_LINK_PREVIOUS_FONT_SIZE_ATTR = 'data-mvp-mobile-lite-prev-font-size'
const MENU_ICON_PREVIOUS_FONT_SIZE_ATTR = 'data-mvp-mobile-lite-prev-icon-font-size'

const NEW_THREAD_SUBFORUM_GROUPS = [SUBFORUMS, SUBFORUMS_JUEGOS, SUBFORUMS_TECNOLOGIA, SUBFORUMS_COMUNIDAD]
const NEW_THREAD_COMPACT_MENU_WIDTH = '72px'
const NEW_THREAD_FULL_WIDTH_SUBFORUMS = new Set(['gamedev'])

let initialized = false
let menuObserver: MutationObserver | null = null
let userMenuClickListenerAttached = false

function isUserMenuRelatedClick(event: MouseEvent): boolean {
	const target = event.target
	if (!(target instanceof Element)) return false

	return Boolean(
		target.closest(MV_SELECTORS.GLOBAL.USERMENU) ||
			target.closest('.usermenu, .user-menu, .avatar, .dropdown-toggle, [href="#usermenu"]')
	)
}

function handleUserMenuClick(event: MouseEvent): void {
	if (!isUserMenuRelatedClick(event)) return

	window.setTimeout(injectPanelMenuItem, 0)
	window.setTimeout(injectPanelMenuItem, 150)
}

function isMobileLitePanelAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function openMobileLitePanel(event?: Event): void {
	event?.preventDefault()
	event?.stopPropagation()
	event?.stopImmediatePropagation()
	closeNewThreadSubforumPanels()
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

function createSubforumLink(subforum: SubforumInfo, options: { fullWidth?: boolean } = {}): HTMLLIElement {
	const item = document.createElement('li')
	item.style.minWidth = '0'
	if (options.fullWidth) item.style.gridColumn = '1 / -1'

	const link = document.createElement('a')
	link.href = getNewThreadUrl(subforum.slug)
	link.style.setProperty('align-items', 'center', 'important')
	link.style.setProperty('box-sizing', 'border-box', 'important')
	link.style.setProperty('display', 'flex', 'important')
	link.style.setProperty('gap', '8px', 'important')
	link.style.setProperty('line-height', '1.2', 'important')
	link.style.setProperty('min-height', '38px', 'important')
	link.style.setProperty('min-width', '0', 'important')
	link.style.setProperty('overflow', 'hidden', 'important')
	link.style.setProperty('padding', '5px 6px', 'important')
	link.style.setProperty('text-decoration', 'none', 'important')
	link.style.setProperty('width', '100%', 'important')
	link.innerHTML = `
		<i class="fid fid-${subforum.iconId}" style="flex: 0 0 24px; font-size: 22px;"></i>
		<span class="title" style="display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${subforum.name}</span>
	`
	item.appendChild(link)
	return item
}

function shouldUseFullWidthSubforum(subforum: SubforumInfo, group: SubforumInfo[]): boolean {
	return group.length === 1 || NEW_THREAD_FULL_WIDTH_SUBFORUMS.has(subforum.slug)
}

function createSubforumSeparator(): HTMLLIElement {
	const item = document.createElement('li')
	item.setAttribute('role', 'separator')
	item.style.borderTop = '1px solid rgba(255, 255, 255, 0.12)'
	item.style.gridColumn = '1 / -1'
	item.style.height = '1px'
	item.style.margin = '6px -8px'
	return item
}

function restoreStyleProperty(element: HTMLElement, attrName: string, propertyName: string): void {
	const previousValue = element.getAttribute(attrName)
	if (previousValue) {
		element.style.setProperty(propertyName, previousValue)
	} else {
		element.style.removeProperty(propertyName)
	}
	element.removeAttribute(attrName)
}

function setMenuCompactMode(menu: HTMLElement, enabled: boolean): void {
	if (enabled) {
		if (!menu.hasAttribute(MENU_PREVIOUS_WIDTH_ATTR)) {
			menu.setAttribute(MENU_PREVIOUS_WIDTH_ATTR, menu.style.width)
			menu.setAttribute(MENU_PREVIOUS_MIN_WIDTH_ATTR, menu.style.minWidth)
			menu.setAttribute(MENU_PREVIOUS_MAX_WIDTH_ATTR, menu.style.maxWidth)
		}

		menu.style.setProperty('width', NEW_THREAD_COMPACT_MENU_WIDTH, 'important')
		menu.style.setProperty('min-width', NEW_THREAD_COMPACT_MENU_WIDTH, 'important')
		menu.style.setProperty('max-width', NEW_THREAD_COMPACT_MENU_WIDTH, 'important')
		menu.querySelectorAll<HTMLElement>(':scope > li > a').forEach(link => {
			if (!link.hasAttribute(MENU_LINK_PREVIOUS_FONT_SIZE_ATTR)) {
				link.setAttribute(MENU_LINK_PREVIOUS_FONT_SIZE_ATTR, link.style.fontSize)
			}
			link.style.setProperty('font-size', '0', 'important')
			link.querySelectorAll<HTMLElement>('i').forEach(icon => {
				if (!icon.hasAttribute(MENU_ICON_PREVIOUS_FONT_SIZE_ATTR)) {
					icon.setAttribute(MENU_ICON_PREVIOUS_FONT_SIZE_ATTR, icon.style.fontSize)
				}
				icon.style.setProperty('font-size', '18px', 'important')
			})
		})
		menu.querySelectorAll<HTMLElement>(':scope > li > a .title').forEach(title => {
			if (!title.hasAttribute(MENU_TITLE_PREVIOUS_DISPLAY_ATTR))
				title.setAttribute(MENU_TITLE_PREVIOUS_DISPLAY_ATTR, title.style.display)
			title.style.setProperty('display', 'none', 'important')
		})
		return
	}

	restoreStyleProperty(menu, MENU_PREVIOUS_WIDTH_ATTR, 'width')
	restoreStyleProperty(menu, MENU_PREVIOUS_MIN_WIDTH_ATTR, 'min-width')
	restoreStyleProperty(menu, MENU_PREVIOUS_MAX_WIDTH_ATTR, 'max-width')
	menu.querySelectorAll<HTMLElement>(`[${MENU_LINK_PREVIOUS_FONT_SIZE_ATTR}]`).forEach(link => {
		restoreStyleProperty(link, MENU_LINK_PREVIOUS_FONT_SIZE_ATTR, 'font-size')
	})
	menu.querySelectorAll<HTMLElement>(`[${MENU_ICON_PREVIOUS_FONT_SIZE_ATTR}]`).forEach(icon => {
		restoreStyleProperty(icon, MENU_ICON_PREVIOUS_FONT_SIZE_ATTR, 'font-size')
	})
	menu.querySelectorAll<HTMLElement>(`[${MENU_TITLE_PREVIOUS_DISPLAY_ATTR}]`).forEach(title => {
		restoreStyleProperty(title, MENU_TITLE_PREVIOUS_DISPLAY_ATTR, 'display')
	})
}

function positionSubforumPanel(menu: HTMLElement, panel: HTMLUListElement): void {
	const menuRect = menu.getBoundingClientRect()
	const visualViewport = window.visualViewport
	const viewportWidth = visualViewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth
	const viewportHeight = visualViewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight
	const viewportOffsetTop = visualViewport?.offsetTop ?? 0
	const viewportOffsetLeft = visualViewport?.offsetLeft ?? 0
	const rightOffset = Math.max(0, viewportWidth - menuRect.left)
	const bottomOffset = Math.max(0, window.innerHeight - viewportOffsetTop - viewportHeight)

	panel.style.left = `${Math.max(0, viewportOffsetLeft)}px`
	panel.style.right = `${rightOffset}px`
	panel.style.top = `${Math.max(0, viewportOffsetTop, menuRect.top)}px`
	panel.style.bottom = `calc(${bottomOffset}px + env(safe-area-inset-bottom))`
	panel.style.paddingBottom = 'calc(8px + env(safe-area-inset-bottom))'
	panel.style.maxHeight = `calc(${viewportHeight}px - ${Math.max(0, menuRect.top - viewportOffsetTop)}px - env(safe-area-inset-bottom))`
}

function createNewThreadMenuItem(): HTMLLIElement {
	const item = document.createElement('li')
	item.setAttribute(NEW_THREAD_MENU_ITEM_ATTR, 'true')

	const link = document.createElement('a')
	link.href = '#mvp-new-thread'
	link.setAttribute('aria-haspopup', 'true')
	link.setAttribute('aria-expanded', 'false')
	link.innerHTML = '<i class="fa fa-plus-circle"></i> <span class="title">Nuevo hilo</span>'

	const subforumList = document.createElement('ul')
	subforumList.setAttribute('aria-hidden', 'true')
	subforumList.style.background = '#2f363b'
	subforumList.style.borderRight = '1px solid rgba(255, 255, 255, 0.12)'
	subforumList.style.boxSizing = 'border-box'
	subforumList.style.columnGap = '10px'
	subforumList.style.display = 'none'
	subforumList.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
	subforumList.style.listStyle = 'none'
	subforumList.style.margin = '0'
	subforumList.style.overflowX = 'hidden'
	subforumList.style.overflowY = 'auto'
	subforumList.style.padding = '8px'
	subforumList.style.position = 'fixed'
	subforumList.style.rowGap = '2px'
	subforumList.style.zIndex = '99998'

	NEW_THREAD_SUBFORUM_GROUPS.forEach((group, groupIndex) => {
		if (groupIndex > 0) subforumList.appendChild(createSubforumSeparator())
		group.forEach(subforum => {
			subforumList.appendChild(createSubforumLink(subforum, { fullWidth: shouldUseFullWidthSubforum(subforum, group) }))
		})
	})

	link.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		event.stopImmediatePropagation()
		const isOpen = subforumList.style.display === 'none'
		const menu = item.parentElement
		if (menu instanceof HTMLElement) {
			setMenuCompactMode(menu, isOpen)
			if (isOpen) positionSubforumPanel(menu, subforumList)
		}
		subforumList.style.display = isOpen ? 'grid' : 'none'
		subforumList.setAttribute('aria-hidden', String(!isOpen))
		link.setAttribute('aria-expanded', String(isOpen))
	})

	item.append(link, subforumList)
	return item
}

function ensureNewThreadMenuItem(menu: HTMLElement, panelItem: HTMLLIElement): void {
	const existingItem = Array.from(menu.children).find(
		(child): child is HTMLLIElement => child instanceof HTMLLIElement && child.hasAttribute(NEW_THREAD_MENU_ITEM_ATTR)
	)
	if (existingItem) {
		if (existingItem.nextElementSibling !== panelItem) {
			menu.insertBefore(existingItem, panelItem)
		}

		return
	}

	menu.insertBefore(createNewThreadMenuItem(), panelItem)
}

function closeNewThreadSubforumPanels(): void {
	document.querySelectorAll<HTMLElement>(`[${NEW_THREAD_MENU_ITEM_ATTR}="true"]`).forEach(item => {
		const menu = item.parentElement
		if (menu instanceof HTMLElement) setMenuCompactMode(menu, false)

		const trigger = item.querySelector<HTMLAnchorElement>(':scope > a')
		const panel = item.querySelector<HTMLUListElement>(':scope > ul')
		trigger?.setAttribute('aria-expanded', 'false')
		if (panel) {
			panel.style.display = 'none'
			panel.setAttribute('aria-hidden', 'true')
		}
	})
}

function findMenuInsertionTarget(menu: HTMLElement): Element | null {
	const links = Array.from(menu.children)
		.map(child =>
			Array.from(child.children).find(
				(innerChild): innerChild is HTMLAnchorElement => innerChild instanceof HTMLAnchorElement
			)
		)
		.filter((link): link is HTMLAnchorElement => Boolean(link))
	const configLink = links.find(
		link => link.href.includes('/configuracion') || link.textContent?.includes('Configuración')
	)
	if (configLink?.parentElement) return configLink.parentElement

	const logoutLink = links.find(link => link.textContent?.includes('Salir'))
	return logoutLink?.parentElement ?? menu.lastElementChild
}

function injectPanelMenuItem(): void {
	if (!isMobileLitePanelAllowed()) return

	const menu = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.USERMENU)
	if (!menu) return

	menu.querySelectorAll<HTMLElement>(`[${MENU_ITEM_ATTR}="true"]`).forEach(item => {
		if (item.parentElement !== menu) item.remove()
	})
	menu.querySelectorAll<HTMLElement>(`[${NEW_THREAD_MENU_ITEM_ATTR}="true"]`).forEach(item => {
		if (item.parentElement !== menu) item.remove()
	})

	const existingPanelItem = Array.from(menu.children).find(
		(child): child is HTMLLIElement => child instanceof HTMLLIElement && child.hasAttribute(MENU_ITEM_ATTR)
	)
	if (existingPanelItem) {
		ensureNewThreadMenuItem(menu, existingPanelItem)
		return
	}

	const item = createPanelMenuItem()
	const insertionTarget = findMenuInsertionTarget(menu)
	if (insertionTarget) {
		menu.insertBefore(item, insertionTarget)
		ensureNewThreadMenuItem(menu, item)
		return
	}

	menu.appendChild(item)
	ensureNewThreadMenuItem(menu, item)
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

function ensureUserMenuObserver(): void {
	if (menuObserver) return

	const menu = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.USERMENU)
	if (!menu) return

	menuObserver = new MutationObserver(injectPanelMenuItem)
	menuObserver.observe(menu, { childList: true })
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
	ensureUserMenuObserver()
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
	document.querySelectorAll(`[${NEW_THREAD_MENU_ITEM_ATTR}="true"]`).forEach(item => item.remove())
}
