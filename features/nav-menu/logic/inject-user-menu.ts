import { MV_SELECTORS } from '@/constants'

const INJECTED_CLASS = 'mv-user-nav-injected'

/**
 * Injects 'Threads Guardados' and 'Posts Anclados' links into the user dropdown menu.
 */
export function injectUserNavigation(): void {
	const userMenuDropdown = document.querySelector<HTMLUListElement>(`${MV_SELECTORS.GLOBAL.USERMENU} li.logout ul.dropdown-menu.user-menu`)
	
	if (!userMenuDropdown || userMenuDropdown.classList.contains(INJECTED_CLASS)) return

	// Extract username from existing links (e.g. Marcadores)
	// format: /id/Username/marcadores
	const links = userMenuDropdown.querySelectorAll('a')
	let username = ''
	
	for (const link of links) {
		const match = link.getAttribute('href')?.match(/\/id\/([^/]+)/)
		if (match && match[1]) {
			username = match[1]
			break
		}
	}

	if (!username) return

	userMenuDropdown.classList.add(INJECTED_CLASS)

	// Align existing native icons (Marcadores, Config, etc.)
	const existingIcons = userMenuDropdown.querySelectorAll('i.fa')
	existingIcons.forEach(icon => icon.classList.add('fa-fw'))

	// Add icon to "Salir" if missing
	const navLinks = userMenuDropdown.querySelectorAll('a')
	for (const link of navLinks) {
		if (link.textContent?.trim() === 'Salir') {
			link.innerHTML = `<i class="fa fa-fw fa-sign-out"></i> Salir`
			break
		}
	}

	// Create items with direct URLs
	const savedThreadsItem = createMenuItem(
		'Threads Guardados', 
		'fa-folder-open', 
		`/id/${username}/temas#guardados`
	)
	
	const pinnedPostsItem = createMenuItem(
		'Posts Anclados', 
		'fa-thumb-tack', 
		`/id/${username}/temas#anclados`
	)

	// Find insertion point: Before "Configuración" or "Salir"
	const configLink = Array.from(userMenuDropdown.querySelectorAll('a')).find(a => a.href.includes('/configuracion'))
	
	if (configLink) {
		const configLi = configLink.parentElement
		userMenuDropdown.insertBefore(savedThreadsItem, configLi)
		userMenuDropdown.insertBefore(pinnedPostsItem, configLi)
	} else {
		// Fallback: Append before the last item (usually logout)
		const lastItem = userMenuDropdown.lastElementChild
		userMenuDropdown.insertBefore(savedThreadsItem, lastItem)
		userMenuDropdown.insertBefore(pinnedPostsItem, lastItem)
	}
}

function createMenuItem(text: string, iconClass: string, href: string): HTMLLIElement {
	const li = document.createElement('li')
	const a = document.createElement('a')
	a.href = href
	a.innerHTML = `<i class="fa fa-fw ${iconClass}"></i> ${text}`
	
	li.appendChild(a)
	return li
}
