/**
 * Profile Types - Types for the user profile system
 */
import type { LucideIcon } from 'lucide-react'

/** View mode for the profile UI */
export type ProfileViewMode = 'sidebar' | 'modal' | 'options'

/** Sidebar position preference */
export type SidebarPosition = 'left' | 'right'

/** Profile tab identifiers */
export type ProfileTabId = 'overview' | 'pins' | 'drafts' | 'muted' | 'subforums' | 'settings' | 'stats'

/** Profile tab definition */
export interface ProfileTab {
	id: ProfileTabId
	label: string
	icon: LucideIcon
}

/** Profile UI state */
export interface ProfileState {
	/** Current view mode preference */
	viewMode: ProfileViewMode
	/** Whether the profile is currently open (for sidebar/modal modes) */
	isOpen: boolean
	/** Currently active tab */
	activeTab: ProfileTabId
	/** Sidebar width in pixels */
	sidebarWidth: number
	/** Sidebar position (left or right) */
	sidebarPosition: SidebarPosition
}

/** Profile actions */
export interface ProfileActions {
	openProfile: () => void
	closeProfile: () => void
	toggleProfile: () => void
	setViewMode: (mode: ProfileViewMode) => void
	setActiveTab: (tab: ProfileTabId) => void
	setSidebarWidth: (width: number) => void
	setSidebarPosition: (position: SidebarPosition) => void
}

/** Combined store type */
export type ProfileStore = ProfileState & ProfileActions

/** Profile statistics */
export interface ProfileStats {
	pinnedPostsCount: number
	draftsCount: number
	mutedWordsCount: number
	favoriteSubforumsCount: number
	totalUploads: number
	totalUploadSize: number
}

/** Pinned post data */
export interface PinnedPost {
	postNumber: number
	author: string
	page: number
	timestamp?: number
}

/** Pinned thread with posts */
export interface PinnedThread {
	threadId: string
	threadTitle: string
	posts: PinnedPost[]
}

/** Draft item data */
export interface DraftItem {
	path: string
	content: string
	timestamp: number
	title?: string
}

/** Muted word data */
export interface MutedWord {
	id: string
	word: string
	createdAt: number
	isRegex?: boolean
}
