/**
 * ID Generation Utilities
 * Centralized functions for generating unique identifiers
 */

/**
 * Generate a unique ID using crypto.randomUUID if available,
 * with a timestamp-based fallback for older environments.
 *
 * @returns A unique string identifier (UUID or timestamp-based)
 */
export function generateId(): string {
	// Modern approach: use crypto.randomUUID (available in all modern browsers)
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	// Fallback for older environments
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generate a simple timestamp-based ID (shorter, less unique)
 * Use only when collision risk is acceptable (e.g., local-only data)
 *
 * @returns A timestamp-based string identifier
 */
export function generateSimpleId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
