/**
 * Bookmarks Page Module (Refactored)
 * Uses React + Shadcn UI components for modern table view
 */

import { storage } from '@wxt-dev/storage'
import { mountFeature, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { applyStoredTheme } from '@/lib/theme-sync'
import { BookmarksManager } from '../components/bookmarks-manager'
import { STORAGE_KEYS, FEATURE_IDS, DOM_MARKERS, MV_SELECTORS } from '@/constants'

const INJECTED_MARKER = DOM_MARKERS.INJECTION.BOOKMARKS
const FEATURE_ID = FEATURE_IDS.BOOKMARKS_MANAGER
const MANAGER_ID = DOM_MARKERS.IDS.BOOKMARKS_MANAGER
const VIEW_MODE_STORAGE_KEY = `local:${STORAGE_KEYS.BOOKMARKS_VIEW_MODE}` as `local:${string}`

type ViewMode = 'cards' | 'table'

const viewModeStorage = storage.defineItem<ViewMode>(VIEW_MODE_STORAGE_KEY, {
	defaultValue: 'cards',
})

export interface BookmarkData {
	id: string
	compositeId: string
	threadId: string
	postId: string
	title: string
	url: string
	author: string
	preview: string
	timeText: string
	timeTitle: string
}

/**
 * Scrapes metadata from a native bookmark card element to create a BookmarkData object.
 * @param post - The DOM element of the native card
 */
function extractBookmarkData(post: HTMLElement): BookmarkData | null {
	// Title is in: .post-meta h1 a
	const titleLink = post.querySelector(MV_SELECTORS.BOOKMARKS.TITLE_LINK) as HTMLAnchorElement
	// Author is in: a.autor
	const authorEl = post.querySelector(MV_SELECTORS.THREAD.POST_AUTHOR_LINK)
	// Post content preview
	const postContent = post.querySelector(MV_SELECTORS.BOOKMARKS.CONTENTS)
	// Time
	const timeEl = post.querySelector(MV_SELECTORS.BOOKMARKS.TIME) as HTMLElement

	const title = titleLink?.textContent?.trim() || ''
	const url = titleLink?.href || '#'
	const author = authorEl?.textContent?.trim() || ''

	// Extract preview
	let preview = postContent?.textContent?.trim() || ''
	if (preview.length > 120) {
		preview = preview.substring(0, 120).trim() + '...'
	}

	// Extract IDs from URL
	let tid = ''
	if (url && url !== '#') {
		const urlMatch = url.match(/\/foro\/[^/]+\/[^/]+-(\d+)/)
		if (urlMatch) {
			tid = urlMatch[1]
		}
	}

	const pid = post.getAttribute('data-num') || ''
	const compositeId = tid && pid ? `${tid}-${pid}` : ''

	if (!compositeId || !title) return null

	return {
		id: post.id || `post-${compositeId}`,
		compositeId,
		threadId: tid,
		postId: pid,
		title,
		url,
		author,
		preview,
		timeText: timeEl?.textContent?.trim() || '',
		timeTitle: timeEl?.getAttribute('title') || '',
	}
}

/**
 * Enhances the native bookmarks page by injecting a React-based management interface.
 * Scrapes existing bookmarks and mounts the BookmarksManager component.
 */
export async function injectBookmarksUI(): Promise<void> {
	const container = document.querySelector(MV_SELECTORS.GLOBAL.CONTENT_CONTAINER)
	if (!container) return

	// Check if already injected
	if (container.hasAttribute(INJECTED_MARKER)) return
	container.setAttribute(INJECTED_MARKER, 'true')

	// Check if already mounted
	if (isFeatureMounted(FEATURE_ID)) return

	// Get all bookmark posts and extract data
	const posts = container.querySelectorAll<HTMLElement>(MV_SELECTORS.BOOKMARKS.CARD)
	if (posts.length === 0) return

	const bookmarks: BookmarkData[] = []
	posts.forEach((post: HTMLElement) => {
		const data = extractBookmarkData(post)
		if (data) {
			bookmarks.push(data)
		}
	})

	// Get persisted view mode
	const initialViewMode = await viewModeStorage.getValue()

	// Hide native cards IMMEDIATELY if table mode is active (before React mounts)
	// This prevents the flash of cards before the table view renders
	if (initialViewMode === 'table') {
		posts.forEach((post: HTMLElement) => {
			post.style.display = 'none'
		})
	}

	// Create container for the React component
	const managerContainer = document.createElement('div')
	managerContainer.id = MANAGER_ID
	applyStoredTheme(managerContainer)
	container.insertBefore(managerContainer, container.firstChild)

	// Mount the React component
	mountFeature(
		FEATURE_ID,
		managerContainer,
		<BookmarksManager
			initialBookmarks={bookmarks}
			initialViewMode={initialViewMode}
			onViewModeChange={async mode => {
				await viewModeStorage.setValue(mode)
			}}
			nativeCardsContainer={container as HTMLElement}
		/>
	)
}

export function cleanupBookmarksUI(): void {
	const container = document.querySelector(MV_SELECTORS.GLOBAL.CONTENT_CONTAINER)
	container?.removeAttribute(INJECTED_MARKER)

	if (isFeatureMounted(FEATURE_ID)) {
		unmountFeature(FEATURE_ID)
	}

	document.getElementById(MANAGER_ID)?.remove()

	// Restore native cards visibility if they were hidden for table view
	if (container) {
		const posts = container.querySelectorAll<HTMLElement>(MV_SELECTORS.BOOKMARKS.CARD)
		posts.forEach(post => {
			post.style.display = ''
		})
	}
}
