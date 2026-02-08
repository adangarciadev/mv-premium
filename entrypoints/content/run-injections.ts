/**
 * Feature Injections Module
 * Runs all content script feature injections based on current page context
 *
 * OPTIMIZATION: Heavy features use dynamic imports to reduce initial bundle size.
 * Features are loaded on-demand based on page context and user interactions.
 */

/**
 * Pre-calculated page context to avoid repeated regex checks on URL
 * This is calculated ONCE at script load in content.tsx
 */
export interface PageContext {
	isThread: boolean
	isCine: boolean
	isFavorites: boolean
	isForumGlobalView: boolean
	isBookmarks: boolean
	isForumList: boolean
	isSubforum: boolean
	isProfileSubpage: boolean
	/** Homepage (/) */
	isHomepage: boolean
	/** Any forum-related page (/foro/*, /, subforums) */
	isForumRelated: boolean
	/** Media forums: /foro/cine/* or /foro/tv/* */
	isMediaForum: boolean
}

// Only import truly lightweight utilities statically
// Heavy features are loaded dynamically below
import { logger } from '@/lib/logger'
import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'
import { useSettingsStore } from '@/store/settings-store'

// Track initialization state
let globalFeaturesInitialized = false

/**
 * Run all content injections based on current page
 * @param ctx - Optional content script context for features that need it
 * @param pageContext - Pre-calculated page context to avoid repeated regex checks
 */
export async function runInjections(ctx?: unknown, pageContext?: PageContext): Promise<void> {
	// =========================================================================
	// TRULY GLOBAL INJECTIONS - Run on all pages where extension loads
	// =========================================================================

	// Initialize global features only once (not on mutation re-runs)
	if (!globalFeaturesInitialized) {
		globalFeaturesInitialized = true

		// Command Menu - TRULY global (Ctrl+K works everywhere)
		import('@/features/command-menu/logic/inject-command-menu').then(({ injectCommandMenu }) => {
			injectCommandMenu()
		})

		// User Customizations - TRULY global (CSS applies everywhere)
		import('@/features/user-customizations').then(({ initUserCustomizations }) => {
			initUserCustomizations()
		})

		// Dashboard Button - TRULY global (available everywhere)
		import('@/features/dashboard').then(({ injectDashboardButton }) => {
			injectDashboardButton()
		})

		// New Thread Button - TRULY global (available everywhere)
		import('@/features/new-thread/logic/new-thread-inject').then(({ injectNewThreadButton }) => {
			injectNewThreadButton()
		})

		// Global Shortcuts
		import('@/features/shortcuts').then(({ initGlobalShortcuts }) => {
			initGlobalShortcuts()
		})

		// User Menu Navigation Injection
		import('@/features/nav-menu/logic/inject-user-menu').then(({ injectUserNavigation }) => {
			injectUserNavigation()
		})

		// Media Hover Cards - Only on cine/tv forums AND if enabled
		if (pageContext?.isMediaForum && isFeatureEnabled(FeatureFlag.MediaHoverCards)) {
			import('@/features/media-hover-cards').then(({ initMediaHoverCards }) => {
				initMediaHoverCards()
			})
		}
	}

	// =========================================================================
	// HOMEPAGE
	// =========================================================================
	if (pageContext?.isHomepage && isFeatureEnabled(FeatureFlag.NewHomepage)) {
		import('@/features/new-homepage').then(({ injectHomepage }) => {
			injectHomepage()
		})
	}

	// =========================================================================
	// EDITOR FEATURES - Only when editor exists on page
	// These need to run on mutations too (for dynamically loaded editors)
	// =========================================================================
	const hasEditor = document.querySelector('textarea#cuerpo, textarea[name="cuerpo"]')
	if (hasEditor) {
		import('@/features/editor/logic/editor-toolbar').then(
			({ injectEditorToolbar, injectDraftAutosave, injectCharacterCounter, injectPasteHandler }) => {
				injectEditorToolbar()
				injectDraftAutosave()
				injectCharacterCounter()
				injectPasteHandler()
			}
		)

		import('@/features/editor/logic/editor-content-preserve').then(({ injectEditorContentPreservation }) => {
			injectEditorContentPreservation()
		})

		// Draft save button - Only where editor exists
		import('@/features/drafts').then(({ injectSaveDraftButton }) => {
			injectSaveDraftButton()
		})
	}

	// =========================================================================
	// CODE HIGHLIGHTING - Only when code blocks exist
	// =========================================================================
	// Note: Mediavida uses pre.code (with or without inner <code>)
	const hasCodeBlocks = document.querySelector('pre code, pre.code, .code-block, [class*="language-"]')
	if (hasCodeBlocks) {
		import('@/features/editor/logic/code-highlighter').then(({ highlightCodeBlocks }) => {
			highlightCodeBlocks()
		})
	}

	// =========================================================================
	// FORUM LIST / SUBFORUM PAGES
	// =========================================================================
	if (pageContext?.isForumList || pageContext?.isSubforum) {
		const { injectFavoriteSubforumButtons } = await import(
			'@/features/favorite-subforums/logic/favorite-subforum-inject'
		)
		injectFavoriteSubforumButtons()
	}

	// Sidebar on subforum pages, global view pages (spy, new, unread, top, featured), and thread pages
	if (pageContext?.isSubforum || pageContext?.isForumGlobalView || pageContext?.isThread) {
		const { injectFavoriteSubforumsSidebar } = await import(
			'@/features/favorite-subforums/logic/favorite-subforum-inject'
		)
		injectFavoriteSubforumsSidebar()
	}

	// =========================================================================
	// THREAD PAGES
	// =========================================================================
	if (pageContext?.isThread) {
		// Inject scroll-to-bottom button (lightweight, no dynamic import needed)
		import('@/lib/content-modules').then(({ injectScrollToBottomButton }) => {
			injectScrollToBottomButton()
		})

		// Postit toggle - Adds accessible toggle for postits with embedded videos
		import('@/features/postit-toggle').then(({ initPostitToggle }) => {
			initPostitToggle()
		})

		// Check for pending thread creation (captures URL after redirect from new thread page)
		import('@/features/stats').then(({ completePendingThreadCreation }) => {
			completePendingThreadCreation()
		})

		// Parallel load thread features using allSettled to prevent single failure from breaking all
		const results = await Promise.allSettled([
			import('@/features/pinned-posts/logic/pin-posts'),
			import('@/features/infinite-scroll'),
			import('@/features/live-thread'),
			import('@/features/gallery'),
			import('@/features/saved-threads'),
			import('@/features/thread-summarizer'),
			import('@/features/post-summary'),
			import('@/features/muted-words/logic/muted-words'),
		])

		// Process each result individually - failed imports don't block others
		const [pinnedPosts, infiniteScroll, liveThread, gallery, savedThreads, threadSummarizer, postSummary, mutedWords] =
			results

		logger.debug('Thread features loaded', {
			failed: results.filter(r => r.status === 'rejected').length,
		})

		// Each feature initializes independently
		if (pinnedPosts.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.PinnedPosts)) {
			pinnedPosts.value.initPinButtonsObserver()
			pinnedPosts.value.injectPinnedPostsSidebar()
		}

		if (infiniteScroll.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.InfiniteScroll)) {
			infiniteScroll.value.injectInfiniteScroll(ctx)
		}

		if (liveThread.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.LiveThread)) {
			liveThread.value.injectLiveThreadButton()
		}

		if (gallery.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.Gallery)) {
			gallery.value.injectGalleryTrigger()
		}

		if (savedThreads.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.SavedThreads)) {
			savedThreads.value.injectSaveThreadButton()
		}

		if (threadSummarizer.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.ThreadSummarizer)) {
			threadSummarizer.value.injectSummarizerButton()
		}

		if (postSummary.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.PostSummary)) {
			postSummary.value.initSummaryButtonsObserver()
		}

		if (mutedWords.status === 'fulfilled' && isFeatureEnabled(FeatureFlag.MutedWords)) {
			void mutedWords.value.applyMutedWordsFilter()
		}

		// Log any failures for debugging
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const featureNames = [
					'pinned-posts',
					'infinite-scroll',
					'live-thread',
					'gallery',
					'saved-threads',
					'thread-summarizer',
					'post-summary',
					'muted-words',
				]
				logger.error(`Failed to load thread feature: ${featureNames[index]}`, result.reason)
			}
		})
	}

	// =========================================================================
	// FAVORITES PAGE
	// =========================================================================
	if (pageContext?.isFavorites) {
		const { injectFavoritesPageButtons } = await import('@/features/favorites')
		injectFavoritesPageButtons()
	}

	// =========================================================================
	// BOOKMARKS PAGE
	// =========================================================================
	if (pageContext?.isBookmarks) {
		const { injectBookmarksUI } = await import('@/features/bookmarks')
		injectBookmarksUI()
	}

	// =========================================================================
	// PROFILE PAGES
	// =========================================================================
	if (pageContext?.isProfileSubpage) {
		const { initProfileSavedThreadsTab } = await import('@/features/saved-threads')
		initProfileSavedThreadsTab()
	}

	// =========================================================================
	// NATIVE LIVE THREAD PAGES (e.g., /foro/feda/thread-123/live)
	// =========================================================================
	const { isNativeLiveThreadPage } = await import('@/lib/content-modules/utils/page-detection')
	if (isNativeLiveThreadPage()) {
		import('@/features/native-live-delay').then(({ injectNativeLiveDelayControl }) => {
			injectNativeLiveDelayControl()
		})
	}
}
