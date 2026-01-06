/**
 * Storage Upgrade Service
 *
 * Handles migrations between different versions of stored data.
 * Use this when changing the schema of settings, bookmarks, or other persisted data.
 *
 * @usage
 * ```ts
 * import { runMigrations } from '@/services/upgrades'
 *
 * // Call on extension startup (background.ts or content.tsx)
 * await runMigrations()
 * ```
 *
 * To add a new migration:
 * 1. Add a new version number to CURRENT_VERSION
 * 2. Add a migration function to the migrations array
 * 3. Migrations run in order, only if needed
 */
import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'

// =============================================================================
// VERSION TRACKING
// =============================================================================

const VERSION_KEY = 'local:mvp-storage-version'
const CURRENT_VERSION = 1

/**
 * Get the current stored version (0 if never set)
 */
async function getStoredVersion(): Promise<number> {
	const version = await storage.getItem<number>(VERSION_KEY)
	return version ?? 0
}

/**
 * Set the stored version after migration
 */
async function setStoredVersion(version: number): Promise<void> {
	await storage.setItem(VERSION_KEY, version)
}

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

interface Migration {
	version: number
	name: string
	migrate: () => Promise<void>
}

/**
 * Array of migrations to run. Add new migrations at the end.
 * Migrations should be idempotent (safe to run multiple times).
 */
const migrations: Migration[] = [
	// Example migration v1: Rename storage keys from old prefix to new prefix
	{
		version: 1,
		name: 'Initial version setup',
		migrate: async () => {
			// This is a placeholder for the first version
			// In the future, you can add migrations like:
			// - Renaming 'mv-qol-*' keys to 'mvp-*'
			// - Changing data structure of settings
			// - Migrating from sync to local storage
			logger.info('[MVP Upgrade] Running migration v1: Initial setup')
		},
	},
	// Example of a future migration:
	// {
	//   version: 2,
	//   name: 'Migrate user customizations format',
	//   migrate: async () => {
	//     const oldData = await storage.getItem<OldFormat>('local:mvp-user-customizations')
	//     if (oldData) {
	//       const newData = transformToNewFormat(oldData)
	//       await storage.setItem('local:mvp-user-customizations', newData)
	//     }
	//   }
	// }
]

// =============================================================================
// MIGRATION RUNNER
// =============================================================================

/**
 * Run all pending migrations.
 * Call this once on extension startup.
 *
 * @returns Object with migration results
 */
export async function runMigrations(): Promise<{
	previousVersion: number
	currentVersion: number
	migrationsRun: string[]
}> {
	const previousVersion = await getStoredVersion()
	const migrationsRun: string[] = []

	// Skip if already at current version
	if (previousVersion >= CURRENT_VERSION) {
		return { previousVersion, currentVersion: CURRENT_VERSION, migrationsRun }
	}

	// Run pending migrations in order
	for (const migration of migrations) {
		if (migration.version > previousVersion) {
			logger.info(`[MVP Upgrade] Running migration: ${migration.name}`)
			try {
				await migration.migrate()
				migrationsRun.push(migration.name)
			} catch (error) {
				logger.error(`[MVP Upgrade] Migration failed: ${migration.name}`, error)
				// Stop running further migrations on error
				throw error
			}
		}
	}

	// Update stored version
	await setStoredVersion(CURRENT_VERSION)

	if (migrationsRun.length > 0) {
		logger.info(`[MVP Upgrade] Completed ${migrationsRun.length} migrations`)
	}

	return { previousVersion, currentVersion: CURRENT_VERSION, migrationsRun }
}

// =============================================================================
// HELPER FUNCTIONS FOR MIGRATIONS
// =============================================================================

/**
 * Rename a storage key (copy value and delete old key)
 */
export async function renameStorageKey(
	oldKey: `local:${string}` | `sync:${string}` | `session:${string}`,
	newKey: `local:${string}` | `sync:${string}` | `session:${string}`
): Promise<boolean> {
	const value = await storage.getItem<unknown>(oldKey)
	if (value !== null && value !== undefined) {
		await storage.setItem(newKey, value)
		await storage.removeItem(oldKey)
		return true
	}
	return false
}

/**
 * Transform stored data with a mapping function
 */
export async function transformStorageValue<T, R>(
	key: `local:${string}` | `sync:${string}` | `session:${string}`,
	transform: (value: T) => R
): Promise<boolean> {
	const value = await storage.getItem<T>(key)
	if (value !== null && value !== undefined) {
		const transformed = transform(value)
		await storage.setItem(key, transformed)
		return true
	}
	return false
}

/**
 * Get current storage version (for debugging)
 */
export async function getVersion(): Promise<{ stored: number; current: number }> {
	return {
		stored: await getStoredVersion(),
		current: CURRENT_VERSION,
	}
}
