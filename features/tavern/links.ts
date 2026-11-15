import { syncTavernAccess } from './access'
import { MV_SELECTORS } from '@/constants/mediavida-selectors'
import { detectCurrentUser } from '@/entrypoints/options/lib/current-user'
import { getMainActionsRow } from '@/lib/content-modules/utils/extra-actions-row'
import { TAVERN_ORIGIN, NICK_PARAMETER, subforumRooms } from './location'

function createLink(url: URL, label: string): HTMLAnchorElement {
	const link = document.createElement('a')
	link.className = 'btn'
	link.href = url.href
	link.target = '_blank'
	link.rel = 'noopener noreferrer'
	link.textContent = label
	link.title = label + ' (abre en otra pestaña)'
	return link
}

export function injectTavernLinks(isThread: boolean, slug: string): void {
	if (document.getElementById('mvp-gamedev-tavern')) return
	const nav = document.querySelector(MV_SELECTORS.GLOBAL.FORUM_NAV) ??
		document.querySelector(MV_SELECTORS.GLOBAL.FORUM_NAV_ALT)
	const target = (isThread ? getMainActionsRow() : nav) ?? document.querySelector(MV_SELECTORS.GLOBAL.MAIN_CONTENT)
	if (!target) return

	const nick = detectCurrentUser()?.username
	const room = subforumRooms.get(slug)
	const direct = createLink(new URL(room ?? '/', TAVERN_ORIGIN), nick ? 'Abrir sin compartir mi nick' : '🍺 Taberna')
	let control: HTMLElement = direct
	if (nick) {
		const lobby = new URL('/', TAVERN_ORIGIN)
		const params = new URLSearchParams({ [NICK_PARAMETER]: nick })
		if (room) params.set('room', room)
		lobby.hash = params.toString()
		const group = document.createElement('span')
		group.style.cssText = 'position:relative;display:inline-block'
		const button = document.createElement('button')
		button.type = 'button'
		button.className = 'btn'
		button.textContent = '🍺 Taberna ▾'
		const menu = document.createElement('div')
		menu.id = 'mvp-tavern-options'
		menu.popover = 'auto'
		menu.style.cssText = 'position:fixed;inset:auto;margin:0;padding:4px;border:1px solid #565e61;border-radius:4px;background:#282d30;color:white'
		button.popoverTargetElement = menu
		button.setAttribute('aria-controls', menu.id)
		menu.addEventListener('beforetoggle', event => {
			if ((event as ToggleEvent).newState !== 'open') return
			const rect = button.getBoundingClientRect()
			menu.style.minWidth = 'min(220px, 95vw)'
			menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 228)) + 'px'
			menu.style.top = rect.bottom + 4 + 'px'
		})
		for (const link of [createLink(lobby, 'Entrar como ' + nick), direct]) {
			link.style.cssText = 'display:block;text-align:left;margin:2px'
			link.addEventListener('click', () => menu.hidePopover())
			menu.append(link)
		}
		group.append(button, menu)
		control = group
	}
	control.id = 'mvp-gamedev-tavern'
	const newThreadSelector = `a[href$="/foro/${slug}/nuevo-hilo"], a[href="nuevo-hilo"]`
	const newThread = !isThread && (nav?.querySelector<HTMLAnchorElement>(newThreadSelector) ??
		document.querySelector(MV_SELECTORS.GLOBAL.MAIN_CONTENT)?.querySelector<HTMLAnchorElement>(newThreadSelector))
	if (newThread) {
		control.style.marginRight = '6px'
		if (getComputedStyle(newThread).float === 'right') {
			control.style.float = 'right'
			newThread.after(control)
		} else {
			newThread.before(control)
		}
	} else if (target.matches(MV_SELECTORS.GLOBAL.MAIN_CONTENT)) target.prepend(control)
	else target.append(control)
	syncTavernAccess()
}
