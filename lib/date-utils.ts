/**
 * Date Formatting Utilities
 * Shared date formatting functions for consistent display across the app
 */

// =============================================================================
// Date Key Functions (DD-MM-YYYY format for storage keys)
// =============================================================================

/**
 * Get today's date as a storage key (DD-MM-YYYY format)
 * Used for activity tracking, heatmaps, etc.
 */
export function getTodayKey(): string {
	const now = new Date()
	return formatDateKey(now)
}

/**
 * Format a Date object to DD-MM-YYYY storage key format
 */
export function formatDateKey(date: Date): string {
	const day = String(date.getDate()).padStart(2, '0')
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const year = date.getFullYear()
	return `${day}-${month}-${year}`
}

/**
 * Parse a date key (DD-MM-YYYY) back to a Date object
 * Returns null if the key is invalid
 */
export function parseDateKey(key: string): Date | null {
	const parts = key.split('-')
	if (parts.length !== 3) return null

	const day = parseInt(parts[0], 10)
	const month = parseInt(parts[1], 10) - 1 // 0-indexed
	const year = parseInt(parts[2], 10)

	const date = new Date(year, month, day)
	return isNaN(date.getTime()) ? null : date
}

// =============================================================================
// Display Formatting Functions
// =============================================================================

/**
 * Format a timestamp as a localized date string
 */
export function formatDate(timestamp: number): string {
	const date = new Date(timestamp)
	return date.toLocaleDateString('es-ES', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

/**
 * Format a timestamp as a relative date string (e.g., "Hace 5 min", "Hace 2h")
 */
export function formatRelativeDate(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 1) return 'Ahora mismo'
	if (minutes < 60) return `Hace ${minutes} min`
	if (hours < 24) return `Hace ${hours}h`
	if (days < 7) return `Hace ${days} días`
	return formatDate(timestamp)
}

/**
 * Format a timestamp as a short relative date (e.g., "5m", "2h", "3d")
 */
export function formatShortRelativeDate(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 1) return 'ahora'
	if (minutes < 60) return `${minutes}m`
	if (hours < 24) return `${hours}h`
	if (days < 30) return `${days}d`
	return formatDate(timestamp)
}
