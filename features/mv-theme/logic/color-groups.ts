/**
 * Semantic Color Groups for Mediavida Dark Theme
 *
 * Each group maps a user-editable "base color" to related shades.
 * When the user changes a base color, shades are auto-shifted proportionally
 * using OKLCH color space math.
 */

export interface MvColorGroup {
	id: string
	label: string
	description: string
	baseColor: string
	shades: string[]
	category: 'backgrounds' | 'text' | 'accents' | 'borders'
}

export const MV_COLOR_GROUPS: MvColorGroup[] = [
	// ── Backgrounds ──────────────────────────────────────────────────────
	{
		id: 'page-bg',
		label: 'Fondo de página',
		description: 'Fondo principal del sitio',
		baseColor: '#1c2022',
		shades: ['#171a1c', '#131516', '#15202b', '#101213', '#1c1f22', '#1b1f22'],
		category: 'backgrounds',
	},
	{
		id: 'container-bg',
		label: 'Fondo de contenido',
		description: 'Posts, bloques, editor, firma',
		baseColor: '#39464c',
		shades: ['#32383e', '#343b41', '#393e41'],
		category: 'backgrounds',
	},
	{
		id: 'container-alt',
		label: 'Fondo alternativo',
		description: 'Citas, bloques secundarios',
		baseColor: '#323e43',
		shades: ['#2a3237', '#2f383e', '#323639', '#262b31'],
		category: 'backgrounds',
	},
	{
		id: 'elevated-bg',
		label: 'Elementos elevados',
		description: 'Tooltips, dropdowns, modales',
		baseColor: '#435056',
		shades: ['#434c52', '#454c4f', '#414549'],
		category: 'backgrounds',
	},
	{
		id: 'input-bg',
		label: 'Campos de entrada',
		description: 'Inputs, textareas, selects',
		baseColor: '#232a2e',
		shades: [],
		category: 'backgrounds',
	},
	{
		id: 'surface-bg',
		label: 'Superficie secundaria',
		description: 'Cabeceras de tablas, iconos, paneles laterales, cabecera usermenu',
		baseColor: '#272d30',
		shades: ['#272a2b', '#323639', '#3d4245', '#2f3338'],
		category: 'backgrounds',
	},
	{
		id: 'hover-bg',
		label: 'Hover interactivo',
		description: 'Estados hover del header y controles interactivos',
		baseColor: '#393e41',
		shades: ['#444c55'],
		category: 'backgrounds',
	},
	{
		id: 'tweet-card',
		label: 'Card de tweets',
		description: 'Fondo de las tarjetas ligeras de Twitter/X',
		baseColor: '#15202b',
		shades: [],
		category: 'backgrounds',
	},

	// ── Text ─────────────────────────────────────────────────────────────
	{
		id: 'text-primary',
		label: 'Texto principal',
		description: 'Títulos, cuerpo de texto',
		baseColor: '#ecedef',
		shades: ['#f9fcff', '#ffffff', '#efefef'],
		category: 'text',
	},
	{
		id: 'text-secondary',
		label: 'Texto secundario',
		description: 'Subtítulos, información complementaria',
		baseColor: '#b3c3d3',
		shades: ['#939aa0', '#c2c7cb', '#b4bbbf', '#a0a8ae', '#97999b', '#8b959c'],
		category: 'text',
	},
	{
		id: 'text-muted',
		label: 'Texto atenuado',
		description: 'Metadatos, timestamps, placeholders',
		baseColor: '#8f989e',
		shades: ['#8a9199', '#777777', '#666666', '#999999', '#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#eeeeee'],
		category: 'text',
	},

	// ── Accents ──────────────────────────────────────────────────────────
	{
		id: 'accent',
		label: 'Acento (naranja MV)',
		description: 'Botones primarios, usernames, highlights',
		baseColor: '#fc8f22',
		shades: ['#fb8500', '#f68900', '#de6e17', '#dc5a0b', '#dc6f5b', '#d55f17', '#cb5911', '#cf6903', '#e65e0b', '#ff6700', '#f47426', '#bb4949'],
		category: 'accents',
	},
	{
		id: 'link',
		label: 'Enlaces',
		description: 'Links, acciones secundarias',
		baseColor: '#0c7ec6',
		shades: ['#0577b1', '#2472a4', '#539be2', '#5ca5ee', '#93aac0', '#0080ff'],
		category: 'accents',
	},
	{
		id: 'unread-old',
		label: 'No leídos (viejos)',
		description: 'Badge gris de mensajes no leídos antiguos',
		baseColor: '#8f989e',
		shades: [],
		category: 'accents',
	},
	{
		id: 'unread-new',
		label: 'No leídos (nuevos)',
		description: 'Badge principal de mensajes no leídos nuevos',
		baseColor: '#fc8f22',
		shades: [],
		category: 'accents',
	},
	{
		id: 'highlight',
		label: 'Resaltado',
		description: 'Animaciones, selección',
		baseColor: '#58646f',
		shades: [],
		category: 'accents',
	},

	// ── Borders ──────────────────────────────────────────────────────────
	{
		id: 'border-3d',
		label: 'Bordes 3D',
		description: 'Bordes de secciones, separadores',
		baseColor: '#30353a',
		shades: ['#1b1c1d', '#171819', '#353638', '#3e444c', '#262a2c'],
		category: 'borders',
	},
	{
		id: 'border-input',
		label: 'Bordes de campos',
		description: 'Bordes de inputs y textareas',
		baseColor: '#485358',
		shades: ['#5e666e', '#6f7d8a'],
		category: 'borders',
	},
	{
		id: 'border-control',
		label: 'Bordes de controles',
		description: 'Botones, checkboxes, selects',
		baseColor: '#616b70',
		shades: ['#616a70'],
		category: 'borders',
	},
	{
		id: 'button-bg',
		label: 'Fondo de botones',
		description: 'Botones predeterminados',
		baseColor: '#505658',
		shades: ['#383c3d', '#56524f'],
		category: 'borders',
	},
]

/**
 * Get a color group by ID
 */
export function getColorGroup(id: string): MvColorGroup | undefined {
	return MV_COLOR_GROUPS.find(g => g.id === id)
}

/**
 * Get all hex colors (base + shades) for a group
 */
export function getGroupHexes(group: MvColorGroup): string[] {
	return [group.baseColor, ...group.shades]
}

/**
 * Get all default base colors as a map: groupId → hex
 */
export function getDefaultColors(): Record<string, string> {
	const defaults: Record<string, string> = {}
	for (const group of MV_COLOR_GROUPS) {
		defaults[group.id] = group.baseColor
	}
	return defaults
}

/**
 * Category labels in Spanish for UI grouping
 */
export const CATEGORY_LABELS: Record<MvColorGroup['category'], string> = {
	backgrounds: 'Fondos',
	text: 'Texto',
	accents: 'Acentos',
	borders: 'Bordes y controles',
}
