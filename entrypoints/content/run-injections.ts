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

// Track initialization state
let globalFeaturesInitialized = false

type PinnedPostsModule = typeof import('@/features/pinned-posts/logic/pin-posts')
type InfiniteScrollModule = typeof import('@/features/infinite-scroll')
type LiveThreadModule = typeof import('@/features/live-thread')
type GalleryModule = typeof import('@/features/gallery')
type SavedThreadsModule = typeof import('@/features/saved-threads')
type ThreadSummarizerModule = typeof import('@/features/thread-summarizer')
type PostSummaryModule = typeof import('@/features/post-summary')
type MutedWordsModule = typeof import('@/features/muted-words/logic/muted-words')

interface ThreadFeatureModules {
	pinnedPosts?: PinnedPostsModule
	infiniteScroll?: InfiniteScrollModule
	liveThread?: LiveThreadModule
	gallery?: GalleryModule
	savedThreads?: SavedThreadsModule
	threadSummarizer?: ThreadSummarizerModule
	postSummary?: PostSummaryModule
	mutedWords?: MutedWordsModule
}

const THREAD_FEATURE_NAMES = [
	'pinned-posts',
	'infinite-scroll',
	'live-thread',
	'gallery',
	'saved-threads',
	'thread-summarizer',
	'post-summary',
	'muted-words',
] as const

let threadFeatureModulesCache: ThreadFeatureModules | null = null
let threadFeatureModulesPromise: Promise<ThreadFeatureModules> | null = null

async function loadThreadFeatureModules(): Promise<ThreadFeatureModules> {
	if (threadFeatureModulesCache) {
		return threadFeatureModulesCache
	}

	if (threadFeatureModulesPromise) {
		return threadFeatureModulesPromise
	}

	threadFeatureModulesPromise = (async () => {
		// Parallel load thread features using allSettled so single failures don't break others.
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

		const [pinnedPosts, infiniteScroll, liveThread, gallery, savedThreads, threadSummarizer, postSummary, mutedWords] = results

		const modules: ThreadFeatureModules = {
			pinnedPosts: pinnedPosts.status === 'fulfilled' ? pinnedPosts.value : undefined,
			infiniteScroll: infiniteScroll.status === 'fulfilled' ? infiniteScroll.value : undefined,
			liveThread: liveThread.status === 'fulfilled' ? liveThread.value : undefined,
			gallery: gallery.status === 'fulfilled' ? gallery.value : undefined,
			savedThreads: savedThreads.status === 'fulfilled' ? savedThreads.value : undefined,
			threadSummarizer: threadSummarizer.status === 'fulfilled' ? threadSummarizer.value : undefined,
			postSummary: postSummary.status === 'fulfilled' ? postSummary.value : undefined,
			mutedWords: mutedWords.status === 'fulfilled' ? mutedWords.value : undefined,
		}

		logger.debug('Thread feature modules loaded', {
			failed: results.filter(r => r.status === 'rejected').length,
		})

		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				logger.error(`Failed to load thread feature: ${THREAD_FEATURE_NAMES[index]}`, result.reason)
			}
		})

		threadFeatureModulesCache = modules
		return modules
	})()

	try {
		return await threadFeatureModulesPromise
	} finally {
		threadFeatureModulesPromise = null
	}
}

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
	const hasEditor = document.querySelector('textarea#cuerpo, textarea[name="cuerpo"], textarea[name="msg"]')
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

		if (isFeatureEnabled(FeatureFlag.SteamBundleInlineCards)) {
			import('@/features/media-hover-cards').then(({ initSteamBundleInlineCards }) => {
				initSteamBundleInlineCards()
			})
		}
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
	// Hidden threads first to minimize visible time before canonical filter is applied.
	// Includes profile pages where "Últimos posts" or similar thread lists may appear.
	const isPaginatedSubforum = /^\/foro\/[^/]+\/p\d+\/?$/.test(window.location.pathname)
	const isUserProfilePage = /^\/id\/[^/]+(?:\/.*)?$/.test(window.location.pathname)
	if (
		pageContext?.isForumList ||
		pageContext?.isSubforum ||
		isPaginatedSubforum ||
		pageContext?.isForumGlobalView ||
		pageContext?.isFavorites ||
		isUserProfilePage
	) {
		const { initHiddenThreadsFiltering } = await import('@/features/hidden-threads')
		void initHiddenThreadsFiltering()
	}

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
		if (isFeatureEnabled(FeatureFlag.SteamBundleInlineCards)) {
			import('@/features/media-hover-cards').then(({ initSteamBundleInlineCards }) => {
				initSteamBundleInlineCards()
			})
		}

		// Inject scroll-to-bottom button (lightweight, no dynamic import needed)
		import('@/lib/content-modules').then(({ injectScrollToBottomButton }) => {
			injectScrollToBottomButton()
		})

		// Postit toggle - Adds accessible toggle for postits with embedded videos
		import('@/features/postit-toggle').then(({ initPostitToggle }) => {
			initPostitToggle()
		})

		// Check for pending thread creation, post edit, or reply (captures context after redirect)
		import('@/features/stats').then(
			({ completePendingThreadCreation, completePendingPostEdit, completePendingReply }) => {
				completePendingThreadCreation()
				completePendingPostEdit()
				completePendingReply()
			}
		)

		const threadModules = await loadThreadFeatureModules()

		// Each feature initializes independently
		if (threadModules.pinnedPosts && isFeatureEnabled(FeatureFlag.PinnedPosts)) {
			threadModules.pinnedPosts.initPinButtonsObserver()
			threadModules.pinnedPosts.injectPinnedPostsSidebar()
		}

		if (threadModules.infiniteScroll && isFeatureEnabled(FeatureFlag.InfiniteScroll)) {
			threadModules.infiniteScroll.injectInfiniteScroll(ctx)
		}

		if (threadModules.liveThread && isFeatureEnabled(FeatureFlag.LiveThread)) {
			threadModules.liveThread.injectLiveThreadButton()
		}

		if (threadModules.gallery && isFeatureEnabled(FeatureFlag.Gallery)) {
			threadModules.gallery.injectGalleryTrigger()
		}

		if (threadModules.savedThreads) {
			threadModules.savedThreads.injectSaveThreadButton()
		}

		if (threadModules.threadSummarizer && isFeatureEnabled(FeatureFlag.ThreadSummarizer)) {
			threadModules.threadSummarizer.injectSummarizerButton()
			threadModules.threadSummarizer.injectMultiPageSummarizerButton()
		}

		if (threadModules.postSummary && isFeatureEnabled(FeatureFlag.PostSummary)) {
			threadModules.postSummary.initSummaryButtonsObserver()
		}

		if (threadModules.mutedWords && isFeatureEnabled(FeatureFlag.MutedWords)) {
			void threadModules.mutedWords.applyMutedWordsFilter()
		}
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
