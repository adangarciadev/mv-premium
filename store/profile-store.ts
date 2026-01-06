/**
 * Profile Store - Zustand store for user profile state
 * Manages profile UI state across sidebar, modal, and options page modes
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
	ProfileStore,
	ProfileViewMode,
	ProfileTabId,
	SidebarPosition,
} from '@/types/profile-types'

/** Default values */
const DEFAULTS = {
	viewMode: 'sidebar' as ProfileViewMode,
	isOpen: false,
	activeTab: 'overview' as ProfileTabId,
	sidebarWidth: 380,
	sidebarPosition: 'left' as SidebarPosition,
}

export const useProfileStore = create<ProfileStore>()(
	persist(
		(set) => ({
			// Initial state
			viewMode: DEFAULTS.viewMode,
			isOpen: DEFAULTS.isOpen,
			activeTab: DEFAULTS.activeTab,
			sidebarWidth: DEFAULTS.sidebarWidth,
			sidebarPosition: DEFAULTS.sidebarPosition,

			// Actions
			openProfile: () => set({ isOpen: true }),

			closeProfile: () => set({ isOpen: false }),

			toggleProfile: () => set((state) => ({ isOpen: !state.isOpen })),

			setViewMode: (viewMode: ProfileViewMode) => set({ viewMode }),

			setActiveTab: (activeTab: ProfileTabId) => set({ activeTab }),

			setSidebarWidth: (sidebarWidth: number) =>
				set({ sidebarWidth: Math.max(300, Math.min(600, sidebarWidth)) }),

			setSidebarPosition: (sidebarPosition: SidebarPosition) =>
				set({ sidebarPosition }),
		}),
		{
			name: 'mvp-profile',
			// Only persist preferences, not ephemeral state like isOpen
			partialize: (state) => ({
				viewMode: state.viewMode,
				activeTab: state.activeTab,
				sidebarWidth: state.sidebarWidth,
				sidebarPosition: state.sidebarPosition,
			}),
		}
	)
)

/** Selector hooks for specific state slices */
export const useProfileViewMode = () => useProfileStore((s) => s.viewMode)
export const useProfileIsOpen = () => useProfileStore((s) => s.isOpen)
export const useProfileActiveTab = () => useProfileStore((s) => s.activeTab)
export const useSidebarWidth = () => useProfileStore((s) => s.sidebarWidth)
export const useSidebarPosition = () => useProfileStore((s) => s.sidebarPosition)
