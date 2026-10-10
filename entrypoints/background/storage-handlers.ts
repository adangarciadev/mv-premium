/** One writer for draft mutations and backup restores from every extension context. */
import { onMessage } from '@/lib/messaging'
import type { DraftMutation, DraftMutationResult } from '@/features/drafts/storage/mutations'
import * as drafts from '@/features/drafts/storage/repository'
import { restoreBackupData } from '@/lib/storage/backup-service'
import { enqueueStorageWrite as enqueue } from '@/lib/storage/write-queue'

function restoreClearedFields<T extends object>(patch: T, fields: string[], allowed: string[]): T {
	if (fields.some(field => !allowed.includes(field))) throw new Error('Campo de borradores inválido.')
	return { ...patch, ...Object.fromEntries(fields.map(field => [field, undefined])) }
}

async function applyDraftMutation(request: DraftMutation): Promise<DraftMutationResult> {
	switch (request.operation) {
		case 'createDraft': return drafts.createDraft(...request.args)
		case 'updateDraft': return drafts.updateDraft(request.args[0], restoreClearedFields(request.args[1], request.clearedFields ?? [], ['subforum', 'category', 'categoryLabel', 'folderId', 'trigger']))
		case 'deleteDraft': return drafts.deleteDraft(...request.args)
		case 'deleteDrafts': return drafts.deleteDrafts(...request.args)
		case 'duplicateDraft': return drafts.duplicateDraft(...request.args)
		case 'convertDraftType': return drafts.convertDraftType(...request.args)
		case 'moveDraftToFolder': return drafts.moveDraftToFolder(request.args[0], request.args[1] ?? undefined)
		case 'moveDraftsToFolder': return drafts.moveDraftsToFolder(request.args[0], request.args[1] ?? undefined)
		case 'createFolder': return drafts.createFolder(...request.args)
		case 'updateFolder': return drafts.updateFolder(request.args[0], restoreClearedFields(request.args[1], request.clearedFields ?? [], ['color', 'type']))
		case 'deleteFolder': return drafts.deleteFolder(...request.args)
		default: throw new Error('Operación de borradores inválida.')
	}
}
export function setupStorageHandlers(): void {
	onMessage('readDrafts', () => enqueue(() => drafts.readDraftsData()))
	onMessage('mutateDrafts', ({ data }) => enqueue(() => applyDraftMutation(data)))
	onMessage('restoreBackup', ({ data }) => enqueue(() => restoreBackupData(data.input, data.options)))
}
