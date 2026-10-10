import { recoverPendingBackupImport } from './backup-transaction'

let queue: Promise<unknown> = Promise.resolve()

/** Use only in background: one queue shared by drafts, restores and rhythm writes. */
export function enqueueStorageWrite<T>(write: () => Promise<T>): Promise<T> {
	const result = queue.then(async () => {
		await recoverPendingBackupImport()
		return write()
	})
	queue = result.catch(() => undefined)
	return result
}
