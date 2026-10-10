/** Options UI helpers; persistence runs in the shared background writer. */
import { sendMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import type { BackupData, BackupImportOptions, BackupImportResult } from '@/lib/storage/backup-service'
export { BACKUP_SCHEMA_VERSION, backupContainsPersonalApiKeys, createBackupData, validateBackupData } from '@/lib/storage/backup-service'
export type { BackupData, BackupOptions, BackupImportOptions, BackupImportResult, BackupImportStats, PinnedPostsBackupEntry } from '@/lib/storage/backup-service'
export function downloadBackupJSON(data: BackupData, filename = 'mv-premium-backup.json'): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	setTimeout(() => URL.revokeObjectURL(url), 100)
}
async function regenerateMvThemeCSSAfterImport(): Promise<void> {
	try {
		const { useMvThemeStore } = await import('@/features/mv-theme/mv-theme-store')
		await useMvThemeStore.getState().loadFromStorage()
		useMvThemeStore.getState().regenerateAndCacheCSS()
	} catch (error) {
		logger.warn('MV theme CSS regeneration after backup import skipped:', error)
	}
}
export async function importBackupData(input: unknown, options: BackupImportOptions = {}): Promise<BackupImportResult> {
	try {
		const result = await sendMessage('restoreBackup', { input, options })
		if (result.success && result.stats?.themesUpdated)
			await regenerateMvThemeCSSAfterImport()
		return result
	} catch {
		return { success: false, error: 'No se pudo contactar con la extensión para restaurar el backup.' }
	}
}
