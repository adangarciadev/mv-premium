import { storage } from '#imports'
import { z } from 'zod'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { setFromImport } from './compressed-storage'

export type BackupWrite = { key: string; value: unknown }
const RECOVERY_KEY = `local:${STORAGE_KEYS.BACKUP_RECOVERY}` as const
const recoverySchema = z.array(z.object({ key: z.string().min(1), existed: z.boolean(), value: z.unknown() }))

/** The journal contains raw values so recovery preserves compression and absence exactly. */
export async function recoverPendingBackupImport(): Promise<void> {
	const pending = await storage.getItem<unknown>(RECOVERY_KEY)
	if (pending === null) return
	const journal = recoverySchema.parse(pending)
	const errors: unknown[] = []
	for (const entry of [...journal].reverse()) {
		try {
			const key = `local:${entry.key}` as const
			if (entry.existed) await storage.setItem(key, entry.value)
			else await storage.removeItem(key)
		} catch (error) { errors.push(error) }
	}
	if (errors.length > 0) throw new Error('No se pudo recuperar el estado anterior. La copia de recuperación sigue guardada; vuelve a intentarlo.')
	await storage.removeItem(RECOVERY_KEY)
}

export async function applyBackupWrites(writes: BackupWrite[]): Promise<void> {
	if (writes.length === 0) return
	const snapshot = await storage.snapshot('local')
	const journal = [...new Set(writes.map(write => write.key))].map(key => ({
		key, existed: Object.prototype.hasOwnProperty.call(snapshot, key), value: snapshot[key] ?? null,
	}))
	// If making the recovery copy fails, no user data has been changed.
	await storage.setItem(RECOVERY_KEY, journal)
	try {
		for (const { key, value } of writes) await setFromImport(key, value)
		await storage.removeItem(RECOVERY_KEY)
	} catch {
		await recoverPendingBackupImport()
		throw new Error('No se pudo restaurar el backup. Se han recuperado los datos anteriores.')
	}
}
