/**
 * UI Store - Zustand store for UI state
 * Controls ephemeral UI states like panels, modals, dragging
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 */
import { create } from 'zustand'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

// Storage items for persisted UI settings
const livePreviewEnabledStorage = storage.defineItem<string>(`local:${STORAGE_KEYS.LIVE_PREVIEW_ENABLED}`, {
	defaultValue: 'false',
})
const livePreviewPositionStorage = storage.defineItem<string>(`local:${STORAGE_KEYS.LIVE_PREVIEW_POSITION}`, {
	defaultValue: JSON.stringify({ x: 20, y: 80 }),
})

interface LivePreviewState {
	isVisible: boolean
	position: { x: number; y: number }
	isDragging: boolean
}

interface UIState {
	// Live Preview
	livePreview: LivePreviewState

	// Actions
	toggleLivePreview: () => void
	setLivePreviewVisible: (visible: boolean) => void
	setLivePreviewPosition: (position: { x: number; y: number }) => void
	setLivePreviewDragging: (isDragging: boolean) => void
}

export const useUIStore = create<UIState>(set => ({
	// Initial state (will be hydrated async)
	livePreview: {
		isVisible: false,
		position: { x: 20, y: 80 },
		isDragging: false,
	},

	// Actions
	toggleLivePreview: () =>
		set(state => {
			const newVisible = !state.livePreview.isVisible
			void livePreviewEnabledStorage.setValue(newVisible ? 'true' : 'false')
			return {
				livePreview: { ...state.livePreview, isVisible: newVisible },
			}
		}),

	setLivePreviewVisible: visible =>
		set(state => {
			void livePreviewEnabledStorage.setValue(visible ? 'true' : 'false')
			return {
				livePreview: { ...state.livePreview, isVisible: visible },
			}
		}),

	setLivePreviewPosition: position =>
		set(state => {
			// Persist position
			void livePreviewPositionStorage.setValue(JSON.stringify(position))
			return {
				livePreview: { ...state.livePreview, position },
			}
		}),

	setLivePreviewDragging: isDragging =>
		set(state => ({
			livePreview: { ...state.livePreview, isDragging },
		})),
}))

// Hydrate outside of create to avoid recreating state shape
void (async () => {
	try {
		// NOTE: We intentionally do NOT hydrate livePreview.isVisible
		// The Live Preview should always start hidden when entering a new page
		// This prevents the preview panel from appearing when the editor isn't even visible

		// Hydrate Live Preview position (but not visibility)
		const positionStored = await livePreviewPositionStorage.getValue()
		if (positionStored) {
			try {
				const position = JSON.parse(positionStored)
				if (typeof position.x === 'number' && typeof position.y === 'number') {
					useUIStore.setState(state => ({
						livePreview: { ...state.livePreview, position },
					}))
				}
			} catch {
				// ignore invalid json
			}
		}
	} catch {
		// ignore
	}
})()
