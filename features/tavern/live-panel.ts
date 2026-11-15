import { syncTavernAccess } from './access'
import { enableTavernWindow } from './resize'
import { detectCurrentUser } from '@/entrypoints/options/lib/current-user'
import { MV_SELECTORS } from '@/constants/mediavida-selectors'
import { getThreadIdFromUrl, isNativeLiveThreadPage } from '@/lib/content-modules/utils/page-detection'
import { getSubforumName } from '@/lib/subforums'
import { NICK_PARAMETER, subforumRooms, TAVERN_ORIGIN } from './location'
import styles from './live-panel.css?inline'

export function injectLiveTavernPanel(slug: string): void {
	if (document.getElementById('mvp-live-tavern')) return
	const room = subforumRooms.get(slug)
	if (!room) return
	const thread = getThreadIdFromUrl()
	if (!thread) return
	const livePath = '/foro/' + slug + '/' + thread + '/live'
	if (!isNativeLiveThreadPage() && location.pathname.replace(/\/$/, '') !== livePath &&
		!document.querySelector('a[href="' + CSS.escape(livePath) + '"]')) return
	const sidebar = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar || !sidebar.getClientRects().length) return
	const roomName = getSubforumName(slug)
	const nick = detectCurrentUser()?.username
	const direct = new URL(room, TAVERN_ORIGIN)
	const host = document.createElement('section')
	host.id = 'mvp-live-tavern'
	const root = host.attachShadow({ mode: 'open' })
	const css = document.createElement('style')
	css.textContent = styles
	root.append(css)
	const title = 'Taberna de ' + roomName
	const enter = document.createElement('button')
	enter.className = 'enter'
	enter.type = 'button'
	enter.innerHTML = '<i aria-hidden="true">🍺</i><strong></strong><span></span><b aria-hidden="true">↗</b>'
	enter.querySelector('strong')!.textContent = title
	enter.dataset.entryLabel = nick ? 'Entrar como ' + nick : 'Entrar a la taberna'
	enter.querySelector('span')!.textContent = enter.dataset.entryLabel
	root.append(enter)
	sidebar.append(host)
	syncTavernAccess()

	enter.onclick = () => {
		const openDock = document.getElementById('mvp-tavern-dock')
		if (openDock) {
			openDock.shadowRoot?.querySelector('iframe')?.focus()
			return
		}
		const dock = document.createElement('section')
		dock.id = 'mvp-tavern-dock'
		dock.setAttribute('aria-label', title)
		const view = dock.attachShadow({ mode: 'open' })
		view.append(css.cloneNode(true))
		const panel = document.createElement('div')
		panel.className = 'panel'
		panel.innerHTML = '<header><button class="resize" aria-label="Ajustar tamaño" title="Arrastra o usa las flechas para ajustar el tamaño">⤡</button><button class="move" type="button" aria-label="Mover la taberna con las flechas" title="Arrastra para mover · Flechas para ajustar"><span aria-hidden="true">⠿</span> <strong></strong></button><a target="_blank" rel="noopener noreferrer" title="Abrir en otra pestaña" aria-label="Abrir en otra pestaña">↗</a><button class="leave">Salir</button></header>'
		panel.querySelector('strong')!.textContent = title
		panel.querySelector('a')!.href = direct.href
		view.append(panel)
		const url = new URL(direct)
		if (nick) {
			url.pathname = '/'
			url.hash = new URLSearchParams({ [NICK_PARAMETER]: nick, room, panel: '1' }).toString()
		}
		const frame = document.createElement('iframe')
		frame.title = title
		frame.allow = 'microphone; fullscreen'
		frame.referrerPolicy = 'origin'
		frame.src = url.href
		panel.append(frame)
		document.body.append(dock)
		syncTavernAccess()
		const cleanup = enableTavernWindow(panel, panel.querySelector<HTMLElement>('.resize')!, panel.querySelector<HTMLElement>('.move')!)
		panel.querySelector<HTMLButtonElement>('.leave')!.onclick = () => {
			cleanup()
			dock.remove()
			syncTavernAccess()
			document.getElementById('mvp-live-tavern')?.shadowRoot?.querySelector<HTMLButtonElement>('.enter')?.focus()
		}
		frame.focus()
	}
}
