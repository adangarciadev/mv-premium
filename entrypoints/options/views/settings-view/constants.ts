/**
 * Settings View - Constants and helpers
 */
import Plug from 'lucide-react/dist/esm/icons/plug'
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Wrench from 'lucide-react/dist/esm/icons/wrench'
import ToggleRight from 'lucide-react/dist/esm/icons/toggle-right'
import Keyboard from 'lucide-react/dist/esm/icons/keyboard'

export const SETTINGS_CATEGORIES = [
	{ id: 'integrations', label: 'Integraciones', icon: Plug },
	{ id: 'features', label: 'Funcionalidades', icon: ToggleRight },
	{ id: 'navigation', label: 'Navegación', icon: ScrollText },
	{ id: 'content', label: 'Contenido', icon: MessageSquare },
	{ id: 'shortcuts', label: 'Atajos de Teclado', icon: Keyboard },
	{ id: 'advanced', label: 'Avanzado', icon: Wrench },
] as const

export type CategoryId = (typeof SETTINGS_CATEGORIES)[number]['id']

export function isValidCategory(id: string): id is CategoryId {
	return SETTINGS_CATEGORIES.some(cat => cat.id === id)
}

export function getTabFromUrl(): CategoryId | null {
	const urlParams = new URLSearchParams(window.location.search)
	const urlTab = urlParams.get('tab')
	if (urlTab && isValidCategory(urlTab)) return urlTab
	return null
}

export function updateUrlParam(tabId: CategoryId) {
	const url = new URL(window.location.href)
	url.searchParams.set('tab', tabId)
	window.history.replaceState({}, '', url.toString())
}
