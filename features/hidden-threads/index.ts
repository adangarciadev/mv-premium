export { initHiddenThreadsFiltering, applyHiddenThreadsFilter } from './logic/hidden-threads'
export {
	injectThreadPageHideButton,
	cleanupThreadPageHideButton,
	performThreadHide,
	redirectIfThreadHidden,
	setupHiddenThreadGuard,
	resolveHiddenThreadRedirectTarget,
	REDIRECT_COUNTDOWN_SECONDS,
	type ThreadPageHideNotifier,
} from './logic/thread-page-hide'
export { desktopThreadHideNotifier } from './logic/hide-toast'
export {
	getHiddenThreads,
	saveHiddenThreads,
	isThreadHidden,
	hideThread,
	hideThreadFromUrl,
	unhideThread,
	unhideThreads,
	clearHiddenThreads,
	watchHiddenThreads,
	type HiddenThread,
} from './logic/storage'
