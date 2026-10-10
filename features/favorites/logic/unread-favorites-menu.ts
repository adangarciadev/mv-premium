import { FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { sendMessage } from '@/lib/messaging'
import { toast } from '@/lib/lazy-toast'
import { logger } from '@/lib/logger'
import { MAX_UNREAD_FAVORITE_TABS, uniqueUnreadFavoriteUrls, unreadFavoritesLimitMessage } from './unread-favorites'

const selectors = MV_SELECTORS.GLOBAL
const id = FEATURE_IDS.FAVORITES_OPEN_UNREAD
const cleanups = new WeakMap<HTMLElement, () => void>()

/** Observe only the star's menu: its flyout and later pages are loaded by AJAX. */
export function injectUnreadFavoritesMenu(): (() => void) | undefined {
	const trigger = document.querySelector<HTMLAnchorElement>(selectors.FAVORITES_TRIGGER)
	const container = trigger?.parentElement
	if (!container) return
	const existing = cleanups.get(container)
	if (existing) return existing

	let busy = false
	let disposed = false
	// Mediavida otherwise reuses the cached flyout indefinitely. Run before its
	// click handler so it rebuilds the list (and its pagination) from the server.
	const refreshOnOpen = (event: MouseEvent) => {
		if (disposed || busy || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
		// The native loader serializes requests globally. Keep its current target
		// attached until the response arrives, otherwise the replacement stays loading.
		if (container.querySelector(`${selectors.FAVORITES_FLYOUT_LIST} .loading`)) return
		if (!container.classList.contains('active')) {
			container.querySelector(selectors.FAVORITES_FLYOUT)?.remove()
		}
	}
	trigger.addEventListener('click', refreshOnOpen, true)
	const style = document.createElement('style')
	style.className = 'mvp'
	style.textContent = `
		.mvp-unread-favorites-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
		#${id} { background: none; border: 0; border-radius: 3px; font: inherit; font-weight: normal;
			padding: 2px 4px; min-height: 24px; cursor: pointer; white-space: nowrap; text-decoration: underline; text-underline-offset: 2px; }
		#${id}:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
		#${id}:disabled { color: inherit; cursor: default; opacity: .6; text-decoration: none; }
	`
	document.head.appendChild(style)

	const getList = () => container.querySelector<HTMLElement>(selectors.FAVORITES_FLYOUT_LIST)
	const getUrls = () => uniqueUnreadFavoriteUrls(
		Array.from(getList()?.querySelectorAll<HTMLAnchorElement>(selectors.UNREAD_FAVORITE_LINK) ?? [])
			.map(link => link.getAttribute('href') ?? '')
	)
	const hasRemaining = () => (getList()?.querySelectorAll(':scope > li:not(.loading)').length ?? 0) >= 20
	const getUnreadCount = () => {
		const visibleCount = getUrls().length
		if (!hasRemaining()) return visibleCount
		// The star's counter includes unread threads on pages not yet in the flyout.
		const pendingCount = Number.parseInt(trigger.querySelector(selectors.FAVORITES_UNREAD_COUNT)?.textContent ?? '0', 10)
		return Math.max(visibleCount, Number.isFinite(pendingCount) ? pendingCount : 0)
	}
	const update = () => {
		if (disposed) return
		const header = container.querySelector<HTMLElement>(`${selectors.FAVORITES_FLYOUT} ${selectors.FAVORITES_FLYOUT_HEADER}`)
		if (!header) return
		let button = header.querySelector<HTMLButtonElement>(`#${id}`)
		const list = getList()
		const loading = !!list?.querySelector('.loading')
		// Having more favorites does not imply that any of them are unread. The
		// navbar count also covers unread threads on pages not loaded into the menu.
		const unreadCount = getUnreadCount()
		const canOpen = unreadCount > 0
		if (!busy && !canOpen) {
			button?.remove()
			if (header.classList.contains('mvp-unread-favorites-header')) {
				header.classList.remove('mvp-unread-favorites-header')
			}
			return
		}
		if (!button) {
			button = document.createElement('button')
			button.id = id
			button.type = 'button'
			button.className = 'btn-link mvp'
			button.addEventListener('click', openUnread)
			header.classList.add('mvp-unread-favorites-header')
			header.appendChild(button)
		}
		const label = busy ? 'Abriendo…' : `Abrir no leídos (${unreadCount})`
		if (button.textContent !== label) button.textContent = label
		button.disabled = busy || loading || !canOpen
		button.title = busy ? 'Abriendo hilos en segundo plano' : loading ? 'Cargando favoritos' : unreadCount > MAX_UNREAD_FAVORITE_TABS
			? unreadFavoritesLimitMessage(unreadCount) : canOpen
			? 'Abrir todos los favoritos con mensajes no leídos en pestañas en segundo plano'
			: 'No hay mensajes no leídos en los favoritos'
		button.setAttribute('aria-label', `${label}. ${button.title}`)
		button.setAttribute('aria-busy', String(busy))
	}

	async function openUnread(event: MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		if (busy || disposed) return
		const unreadCount = getUnreadCount()
		if (unreadCount > MAX_UNREAD_FAVORITE_TABS) {
			toast.info(unreadFavoritesLimitMessage(unreadCount))
			return
		}
		const urls = getUrls()
		const loadRemaining = hasRemaining()
		if (!urls.length && !loadRemaining) return
		busy = true
		update()
		try {
			const result = await sendMessage('openUnreadFavorites', { urls, loadRemaining })
			if (disposed) return
			if (result.limitExceeded) {
				toast.info(unreadFavoritesLimitMessage(result.unreadCount ?? unreadCount))
			} else if (result.failed) {
				const openedLabel = result.opened === 1 ? '1 hilo abierto' : `${result.opened} hilos abiertos`
				const failedLabel = result.failed === 1 ? '1 no se ha podido abrir' : `${result.failed} no se han podido abrir`
				toast.error(`${openedLabel}; ${failedLabel}.`)
			} else if (result.opened) {
				toast.success(`${result.opened === 1 ? '1 hilo abierto' : `${result.opened} hilos abiertos`} en segundo plano`)
			} else {
				toast.info('No hay mensajes no leídos en los favoritos')
			}
		} catch (error) {
			logger.error('Failed to open unread favorites', error)
			if (!disposed) toast.error('No se han podido abrir los favoritos. Vuelve a intentarlo.')
		} finally {
			busy = false
			update()
		}
	}

	const observer = new MutationObserver(update)
	observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class'], characterData: true })
	const cleanup = () => {
		disposed = true
		trigger.removeEventListener('click', refreshOnOpen, true)
		observer.disconnect()
		container.querySelector(`#${id}`)?.remove()
		container.querySelector('.mvp-unread-favorites-header')?.classList.remove('mvp-unread-favorites-header')
		style.remove()
		cleanups.delete(container)
	}
	cleanups.set(container, cleanup)
	update()
	return cleanup
}
