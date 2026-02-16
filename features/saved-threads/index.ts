/**
 * Saved Threads Feature - Public Exports
 * 
 * NOTE: Heavy table components (WikiPostsTable, SavedThreadsTable) are NOT
 * exported here to enable proper code splitting. They are loaded dynamically
 * in inject-profile-tab.tsx to avoid bundling TanStack Table in main.js.
 */

// Storage (lightweight, safe to export statically)
export {
	type SavedThread,
	getSavedThreads,
	isThreadSaved,
	parseSavedThreadFromUrl,
	saveThread,
	saveThreadFromUrl,
	unsaveThread,
	toggleSaveThread,
	toggleSaveThreadFromUrl,
	updateThreadNotes,
	clearAllSavedThreads,
	watchSavedThreads,
} from './logic/storage'

// Injection (triggers, not heavy components)
export { injectSaveThreadButton } from './logic/inject-save-thread'
export { initProfileSavedThreadsTab } from './logic/inject-profile-tab.tsx'

// Lightweight components (safe to export)
export { SaveThreadButton } from './components/save-thread-button'

// NOTE: WikiPostsTable and SavedThreadsTable are intentionally NOT exported here.
// They are loaded dynamically in inject-profile-tab.tsx via:
//   const { WikiPostsTable } = await import('../components/wiki-posts-table')
