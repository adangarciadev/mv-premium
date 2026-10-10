import type * as repository from './repository'
export interface DraftMutationMap {
	createDraft: typeof repository.createDraft
	updateDraft: typeof repository.updateDraft
	deleteDraft: typeof repository.deleteDraft
	deleteDrafts: typeof repository.deleteDrafts
	duplicateDraft: typeof repository.duplicateDraft
	convertDraftType: typeof repository.convertDraftType
	moveDraftToFolder: typeof repository.moveDraftToFolder
	moveDraftsToFolder: typeof repository.moveDraftsToFolder
	createFolder: typeof repository.createFolder
	updateFolder: typeof repository.updateFolder
	deleteFolder: typeof repository.deleteFolder
}
export type DraftMutation = {
	[K in keyof DraftMutationMap]: {
		operation: K
		args: Parameters<DraftMutationMap[K]>
		clearedFields?: string[]
	}
}[keyof DraftMutationMap]
export type DraftMutationResult = Awaited<ReturnType<DraftMutationMap[keyof DraftMutationMap]>>
