/**
 * Format Utilities
 * Funciones de formateo reutilizables en toda la aplicación
 */

/**
 * Formatea milisegundos a formato legible (ej: "2h 30m 15s")
 */
export function formatPreciseTime(ms: number): string {
	const seconds = Math.floor((ms / 1000) % 60)
	const minutes = Math.floor((ms / (1000 * 60)) % 60)
	const hours = Math.floor(ms / (1000 * 60 * 60))

	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
	if (minutes > 0) return `${minutes}m ${seconds}s`
	return `${seconds}s`
}

/**
 * Formatea milisegundos a formato corto (ej: "2h 30m")
 * Útil para espacios reducidos
 */
export function formatPreciseTimeShort(ms: number): string {
	const minutes = Math.floor((ms / (1000 * 60)) % 60)
	const hours = Math.floor(ms / (1000 * 60 * 60))

	if (hours > 0) return `${hours}h ${minutes}m`
	if (minutes > 0) return `${minutes}m`
	return `${Math.floor(ms / 1000)}s`
}

/**
 * Formatea bytes a formato legible (ej: "1.5 MB")
 */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
	const k = 1024
	const sizes = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
