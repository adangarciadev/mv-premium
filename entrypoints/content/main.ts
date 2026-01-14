/**
 * Content Script Main
 *
 * Core initialization logic for the extension.
 * All imports are static - no lazy loading needed since bundle loads from disk.
 */

import { browser } from 'wxt/browser'

import { useSettingsStore, waitForHydration } from '@/store/settings-store'
import { detectAndSaveCurrentUser } from '@/entrypoints/options/lib/current-user'
import { initGlobalFontListener, initGlobalThemeListener } from '@/lib/theme-sync'
import { initThemes } from '@/features/editor/lib/themes'
import { createDebouncedObserver, observeDocument } from '@/lib/content-modules/utils/mutation-observer'
import {
	isThreadPage,
	isCineForum,
	isFavoritesPage,
	isForumGlobalViewPage,
	isBookmarksPage,
	isForumListPage,
	isSubforumPage,
	isProfileSubpage,
	isMediaForum,
} from '@/lib/content-modules/utils/page-detection'
import { runInjections, type PageContext } from './run-injections'
import { applyBoldColor, watchBoldColor } from './init-bold-color'
import { syncFidIcons } from '@/features/icons/icon-syncer'
import { initUltrawide } from '@/features/ultrawide'
import { setupPostTracker } from '@/features/stats/post-tracker'
import { initTimeTracker } from '@/features/stats/logic/time-tracker'
import { initNativePreviewInterceptor } from '@/features/editor/logic/code-highlighter'
import { watchMutedWordsConfig, getMutedWordsConfig } from '@/features/muted-words/logic/storage'
import { updateMutedWordsConfig, applyMutedWordsFilter } from '@/features/muted-words/logic/muted-words'
import { initUserCardInjector } from '@/features/user-customizations/user-card-injector'
import { onMessage } from '@/lib/messaging'
import { toast } from '@/lib/lazy-toast'

export async function runContentMain(ctx: unknown): Promise<void> {
	// =====================================================================
	// DEBUG: Expose a global function to inspect extension storage from console
	// Usage: mvpDebug() in browser console
	// Note: Kept in production for user support/debugging
	// =====================================================================
	window.mvpDebug = async () => {
		const allData = await browser.storage.local.get(null)
		const mvpKeys = Object.keys(allData).filter(k => k.startsWith('mvp-'))
		console.group('🔍 MVP Storage Debug')
		console.table(
			Object.fromEntries(
				mvpKeys.map(k => [
					k,
					typeof allData[k] === 'object' ? JSON.stringify(allData[k]).slice(0, 100) + '...' : allData[k],
				])
			)
		)
		console.groupEnd()
		return { keys: mvpKeys, data: Object.fromEntries(mvpKeys.map(k => [k, allData[k]])) }
	}

	// =====================================================================
	// 1. HYDRATE SETTINGS
	// =====================================================================
	useSettingsStore.persist.rehydrate()
	await waitForHydration()

	// =====================================================================
	// 2. DETECT AND SAVE CURRENT USER
	// =====================================================================
	await detectAndSaveCurrentUser()

	// =====================================================================
	// 3. INITIALIZE CORE SYSTEMS (Light DOM global styles)
	// =====================================================================
	initThemes()
	applyBoldColor()
	watchBoldColor() // Enable live updates without page refresh

	// Initialize global font listener (applies custom font to entire website if enabled)
	initGlobalFontListener()

	// Initialize global theme listener (syncs theme colors to :root for scrollbars, etc.)
	initGlobalThemeListener()

	// Initialize page width feature (applies max-width constraints if enabled)
	await initUltrawide()

	// =====================================================================
	// 4. CALCULATE PAGE CONTEXT (once)
	// Note: Mediavida is MPA, URL won't change without reload
	// =====================================================================
	const pathname = window.location.pathname
	const isHomepage = pathname === '/' || pathname === ''
	const isThread = isThreadPage()
	const isCine = isCineForum()
	const isFavorites = isFavoritesPage()
	const isForumGlobalView = isForumGlobalViewPage()
	const isBookmarks = isBookmarksPage()
	const isForumList = isForumListPage()
	const isSubforum = isSubforumPage()
	const isProfile = isProfileSubpage()

	// Derived flag: Any forum-related page (for dashboard button)
	const isForumRelated = pathname.startsWith('/foro') || isHomepage

	const pageContext: PageContext = {
		isThread,
		isCine,
		isFavorites,
		isForumGlobalView,
		isBookmarks,
		isForumList,
		isSubforum,
		isProfileSubpage: isProfile,
		isHomepage,
		isForumRelated,
		isMediaForum: isMediaForum(),
	}

	// =====================================================================
	// 5. RUN FEATURE INJECTIONS with pre-calculated context
	// =====================================================================
	await runInjections(ctx, pageContext)

	// Initialize native preview interceptor for code highlighting
	initNativePreviewInterceptor()

	// =====================================================================
	// 6. ACTIVITY TRACKING (Posts/Threads/Time)
	// =====================================================================
	setupPostTracker()
	initTimeTracker()

	// Sync Icons (lazy load)
	setTimeout(() => {
		syncFidIcons()
	}, 2000)

	// =====================================================================
	// 7. OBSERVE FOR DYNAMIC CONTENT
	// =====================================================================
	const observer = createDebouncedObserver({ onMutation: () => runInjections(ctx, pageContext) }, 100)
	observeDocument(observer)

	// =====================================================================
	// 8. EVENT LISTENERS & WATCHERS
	// =====================================================================

	// Watch for muted words changes
	if (pageContext.isThread) {
		// Initial load to populate cache and apply filter
		const initialConfig = await getMutedWordsConfig()
		updateMutedWordsConfig(initialConfig)
		void applyMutedWordsFilter() // Explicit call - not auto-triggered by updateMutedWordsConfig

		// Watch for updates
		watchMutedWordsConfig(newConfig => {
			updateMutedWordsConfig(newConfig)
			void applyMutedWordsFilter() // Re-apply on config changes
		})

		// Initialize user card button injection
		initUserCardInjector()
	}

	// =====================================================================
	// 9. EXTERNAL MESSAGING (Agentic AI Context)
	// =====================================================================
	onMessage('getPageContext', () => {
		const selection = window.getSelection()?.toString() || ''

		// Extract user info if available
		const userLink = document.querySelector('.usermenu .avatar') as HTMLAnchorElement
		const username = userLink?.href?.split('/id/')?.[1] || undefined

		// Simple thread ID extraction (can be improved)
		const threadTitle = pageContext.isThread ? document.querySelector('h1')?.textContent || document.title : undefined

		return {
			url: window.location.href,
			title: threadTitle || document.title,
			selection: selection.substring(0, 5000), // Limit selection size
			username,
			threadId: pageContext.isThread ? window.location.pathname : undefined,
		}
	})

	// =====================================================================
	// 10. CONTEXT MENU TOAST LISTENER
	// =====================================================================
	browser.runtime.onMessage.addListener((message: { type: string; message: string }) => {
		if (message.type === 'MVP_TOAST') {
			// Determine toast type from emoji prefix
			const text = message.message
			if (text.startsWith('✅') || text.startsWith('🔇') || text.startsWith('📌')) {
				toast.success(text)
			} else if (text.startsWith('❌')) {
				toast.error(text)
			} else if (text.startsWith('ℹ️')) {
				toast.info(text)
			} else {
				toast.info(text)
			}
		}
	})
}
