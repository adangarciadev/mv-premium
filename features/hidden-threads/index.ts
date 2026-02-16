export { initHiddenThreadsFiltering, applyHiddenThreadsFilter } from './logic/hidden-threads'
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
