import { browser } from 'wxt/browser'
import { DOM_MARKERS } from '@/constants'

const STORAGE_KEY = DOM_MARKERS.STORAGE_KEYS.HIDDEN_SUBFORUMS

const hiddenSubforumsCallbacks = new Set<() => void>()

let globalListenersInitialized = false

function initGlobalHiddenSubforumsListeners(): void {
	if (globalListenersInitialized) return
	globalListenersInitialized = true

	window.addEventListener(DOM_MARKERS.EVENTS.HIDDEN_SUBFORUMS_CHANGED, () => {
		hiddenSubforumsCallbacks.forEach(callback => callback())
	})

	browser.storage.onChanged.addListener((changes, areaName) => {
		if (areaName === 'local' && changes[STORAGE_KEY]) {
			hiddenSubforumsCallbacks.forEach(callback => callback())
		}
	})
}

export function subscribeHiddenSubforumsChanges(callback: () => void): () => void {
	initGlobalHiddenSubforumsListeners()
	hiddenSubforumsCallbacks.add(callback)

	return () => {
		hiddenSubforumsCallbacks.delete(callback)
	}
}

export function notifyHiddenSubforumsChanged(): void {
	window.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.HIDDEN_SUBFORUMS_CHANGED))
}
