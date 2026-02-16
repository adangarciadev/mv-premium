/**
 * Built-in MV Theme Presets
 *
 * Each preset provides overrides for the semantic color groups.
 * Empty colors object = no overrides (uses the user's current Mediavida style).
 */

export interface MvThemePreset {
	id: string
	name: string
	description: string
	/** Map of groupId → hex override. Missing groups keep the current Mediavida style. */
	colors: Record<string, string>
	isBuiltIn?: boolean
}

export const MV_BUILTIN_PRESETS: MvThemePreset[] = [
	{
		id: 'original',
		name: 'Tema original de Mediavida',
		description: 'Quita la personalización y vuelve a tu tema activo en Mediavida',
		colors: {},
		isBuiltIn: true,
	},
	{
		id: 'midnight-blue',
		name: 'Azul Noche',
		description: 'Tonos azul profundo',
		colors: {
			'page-bg': '#161b24',
			'container-bg': '#1e2a3a',
			'container-alt': '#1a2535',
			'elevated-bg': '#263448',
			'input-bg': '#141c28',
			'surface-bg': '#223040',
			'hover-bg': '#2c3d56',
			'text-primary': '#e0e6ef',
			'text-secondary': '#8ba3c0',
			'text-muted': '#6882a0',
			'accent': '#4c9df0',
			'link': '#5ba8e6',
			'highlight': '#2a4060',
			'unread-old': '#6882a0',
			'unread-new': '#4c9df0',
			'border-3d': '#1c2840',
			'border-input': '#2a3c55',
			'border-control': '#3a5070',
			'button-bg': '#2a3a52',
		},
		isBuiltIn: true,
	},
	{
		id: 'forest',
		name: 'Verde Bosque',
		description: 'Tonos verdes naturales',
		colors: {
			'page-bg': '#171e1a',
			'container-bg': '#243830',
			'container-alt': '#1e3228',
			'elevated-bg': '#2e4438',
			'input-bg': '#1a2620',
			'surface-bg': '#25382f',
			'hover-bg': '#2d4a3c',
			'text-primary': '#e0ede6',
			'text-secondary': '#8fb5a0',
			'text-muted': '#6a9480',
			'accent': '#4caf68',
			'link': '#55b86e',
			'highlight': '#2a5040',
			'unread-old': '#6a9480',
			'unread-new': '#4caf68',
			'border-3d': '#1c3028',
			'border-input': '#2a4438',
			'border-control': '#3a6050',
			'button-bg': '#2a4436',
		},
		isBuiltIn: true,
	},
	{
		id: 'purple-haze',
		name: 'Morado',
		description: 'Tonos púrpura oscuro',
		colors: {
			'page-bg': '#1a1720',
			'container-bg': '#2e2640',
			'container-alt': '#261e38',
			'elevated-bg': '#3a3050',
			'input-bg': '#1e1828',
			'surface-bg': '#2b2440',
			'hover-bg': '#3a2f58',
			'text-primary': '#e8e2f0',
			'text-secondary': '#a898c0',
			'text-muted': '#887aa0',
			'accent': '#a06ce4',
			'link': '#9070d8',
			'highlight': '#3a2e5a',
			'unread-old': '#887aa0',
			'unread-new': '#a06ce4',
			'border-3d': '#221c38',
			'border-input': '#362c50',
			'border-control': '#4e4070',
			'button-bg': '#362a4e',
		},
		isBuiltIn: true,
	},
	{
		id: 'warm-dark',
		name: 'Cálido',
		description: 'Grises cálidos con tintes ámbar',
		colors: {
			'page-bg': '#201e1a',
			'container-bg': '#3e3830',
			'container-alt': '#36302a',
			'elevated-bg': '#4a4238',
			'input-bg': '#282420',
			'surface-bg': '#3a332d',
			'hover-bg': '#4a4035',
			'text-primary': '#f0ebe4',
			'text-secondary': '#c0b098',
			'text-muted': '#a09080',
			'accent': '#e8a030',
			'link': '#c09040',
			'highlight': '#504838',
			'unread-old': '#a09080',
			'unread-new': '#e8a030',
			'border-3d': '#302a22',
			'border-input': '#484038',
			'border-control': '#605848',
			'button-bg': '#484038',
		},
		isBuiltIn: true,
	},
	{
		id: 'light',
		name: 'Claro',
		description: 'Base clara con contraste alto para lectura',
		colors: {
			'page-bg': '#f4f7fb',
			'container-bg': '#ffffff',
			'container-alt': '#edf2f8',
			'elevated-bg': '#e6edf6',
			'input-bg': '#ffffff',
			'surface-bg': '#e8eff8',
			'hover-bg': '#d8e4f3',
			'text-primary': '#1d2b3a',
			'text-secondary': '#32495f',
			'text-muted': '#5a7086',
			'accent': '#9a5200',
			'link': '#0b4f8a',
			'highlight': '#cfdcf0',
			'unread-old': '#748aa1',
			'unread-new': '#9a5200',
			'border-3d': '#c3cfde',
			'border-input': '#adbed2',
			'border-control': '#96aac1',
			'button-bg': '#dbe5f2',
		},
		isBuiltIn: true,
	},
]

/**
 * Get a built-in preset by ID
 */
export function getBuiltInPreset(id: string): MvThemePreset | undefined {
	return MV_BUILTIN_PRESETS.find(p => p.id === id)
}
