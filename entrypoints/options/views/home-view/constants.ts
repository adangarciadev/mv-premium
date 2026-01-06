/**
 * Home View - Constants and helpers
 */
import Settings from 'lucide-react/dist/esm/icons/settings'
import Package from 'lucide-react/dist/esm/icons/package'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Star from 'lucide-react/dist/esm/icons/star'
import Users from 'lucide-react/dist/esm/icons/users'
import Pin from 'lucide-react/dist/esm/icons/pin'
import BarChart from 'lucide-react/dist/esm/icons/bar-chart-2'
import Activity from 'lucide-react/dist/esm/icons/activity'

// Current year constant (avoid magic numbers)
export const currentYear = new Date().getFullYear()

// Storage item with compression info
export interface StorageItem {
	key: string
	compressedSize: number
	originalSize: number | null // null if not compressed
	isCompressed: boolean
	category: string
}

// Category labels for storage inspector
export const CATEGORY_LABELS: Record<string, string> = {
	actividad: 'Actividad',
	borradores: 'Borradores',
	favoritos: 'Favoritos',
	usuarios: 'Usuarios',
	configuracion: 'Configuración',
	guardados: 'Guardados',
	estadisticas: 'Estadísticas',
	otros: 'Otros',
}

// Category icons for storage inspector
export const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	actividad: Activity,
	borradores: FileText,
	favoritos: Star,
	usuarios: Users,
	configuracion: Settings,
	guardados: Pin,
	estadisticas: BarChart,
	otros: Package,
}

// Helper to get first letter (defensive)
export function getInitial(name?: string): string {
	return name ? name.charAt(0).toUpperCase() : 'M'
}

// Detect compression and estimate original size
export function analyzeStorageValue(key: string, value: unknown): StorageItem {
	const compressedSize = new Blob([JSON.stringify(value)]).size + key.length
	let isCompressed = false
	let originalSize: number | null = null

	// Check for lz-string compression markers
	if (typeof value === 'string') {
		if (value.startsWith('__LZB64__') || value.startsWith('__LZ__')) {
			isCompressed = true
			// Estimate original size (compressed ratio is typically 60-80% reduction)
			// For display purposes, we estimate ~3x expansion
			const compressedData = value.startsWith('__LZB64__') ? value.slice(9) : value.slice(6)
			originalSize = Math.round(compressedData.length * 2.5)
		}
	}

	// Categorize by key prefix
	let category = 'otros'
	if (key.includes('activity') || key.includes('mvp-activity')) category = 'actividad'
	else if (key.includes('draft') || key.includes('mvp-drafts')) category = 'borradores'
	else if (key.includes('favorite') || key.includes('fav-')) category = 'favoritos'
	else if (key.includes('user') || key.includes('muted')) category = 'usuarios'
	else if (key.includes('setting') || key.includes('theme') || key.includes('config')) category = 'configuracion'
	else if (key.includes('pinned') || key.includes('saved')) category = 'guardados'
	else if (key.includes('time') || key.includes('stats')) category = 'estadisticas'

	return { key, compressedSize, originalSize, isCompressed, category }
}
