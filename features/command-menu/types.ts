/**
 * Command Menu Types
 * Type definitions for the command menu feature
 */

import type { JSX } from 'react'

/**
 * Props for the CommandMenu component
 */
export interface CommandMenuProps {
	/** Whether the menu is controlled by a parent (Dashboard mode) */
	open?: boolean
	/** Callback to update open state (Dashboard mode) */
	onOpenChange?: (open: boolean) => void
}

/**
 * A searchable/executable action in the command menu
 */
export interface CommandAction {
	key: string
	label: string
	action: () => void
	icon: JSX.Element
	category?: string
	shortcut?: string
}

/**
 * Quick action with optional shortcut
 */
export interface QuickAction {
	key: string
	label: string
	action: () => void
	icon: JSX.Element
	shortcut?: string
}

/**
 * Filtered data structure for search results
 */
export interface FilteredData {
	favorites: import('@/features/favorite-subforums/logic/storage').FavoriteSubforum[]
	subforums: import('@/lib/subforums').SubforumInfo[]
	threads: import('@/features/saved-threads/logic/storage').SavedThread[]
	drafts: import('@/features/drafts/storage').Draft[]
	templates: import('@/features/drafts/storage').Draft[]
	actions: CommandAction[]
}
