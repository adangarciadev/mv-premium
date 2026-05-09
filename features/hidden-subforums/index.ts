export { HiddenSubforumButton } from './components/hidden-subforum-button'
export { HiddenSubforumBlocker } from './components/hidden-subforum-blocker'
export { initHiddenSubforums } from './logic/hidden-subforums'
export {
	clearHiddenSubforums,
	getHiddenSubforums,
	hideSubforum,
	unhideSubforum,
	unhideSubforums,
	isSubforumHidden,
	toggleHiddenSubforum,
	watchHiddenSubforums,
	HIDDEN_SUBFORUM_ERROR_CODES,
	type HiddenSubforum,
} from './logic/storage'
