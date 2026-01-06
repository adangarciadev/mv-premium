/**
 * Storage Types - Persisted data structures
 */

import type { Browser } from 'wxt/browser'

/**
 * Type alias for WXT storage change handler
 * Use this for all browser.storage.onChanged listeners
 */
export type StorageChangeHandler = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => void

// Muted Words
export interface MutedWord {
	id: string
	word: string
	createdAt: number
}

// Pinned Posts
export interface PinnedPost {
	postId: string
	postNum: number
	author: string
	timestamp: number
	content?: string
}

export interface ThreadPins {
	threadId: string
	threadTitle: string
	posts: PinnedPost[]
}

// Favorite Subforums
export interface FavoriteSubforum {
	id: string // Unique identifier (slug from URL, e.g., "off-topic")
	name: string // Display name (e.g., "OFF-Topic")
	url: string // Full URL path (e.g., "/foro/off-topic")
	iconClass?: string // Forum icon CSS class (e.g., "fid fid-6")
	description?: string // Forum description
	addedAt: number // Timestamp when added to favorites
}

// Settings
export interface ExtensionSettings {
	theme: 'light' | 'dark' | 'system'
	boldColor: string
	imgbbApiKey: string
	syncEnabled: boolean
	customFont?: string
}

import { STORAGE_KEYS } from '@/constants/storage-keys'

export { STORAGE_KEYS }

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
