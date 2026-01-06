/**
 * Drafts Hooks - Reusable hooks for drafts feature logic
 */

export {
	useDraftsFiltering,
	type UseDraftsFilteringOptions,
	type UseDraftsFilteringReturn,
} from './use-drafts-filtering'
export { useDraftsFolders, type UseDraftsFoldersOptions, type UseDraftsFoldersReturn } from './use-drafts-folders'
export {
	useDraftsActions,
	type UseDraftsActionsOptions,
	type UseDraftsActionsReturn,
	type DeleteDialogState,
	type MoveDialogState,
	type DeleteFolderDialogState,
} from './use-drafts-actions'
export { useDraftsSearch, type UseDraftsSearchOptions, type UseDraftsSearchReturn } from './use-drafts-search'
export {
	useSlashCommand,
	type UseSlashCommandOptions,
	type UseSlashCommandReturn,
	type TemplateInsertData,
} from './use-slash-command'
