/**
 * Subforum Icons & Colors
 * Maps subforum slugs to lucide icons and accent colors
 */

export interface SubforumStyle {
	icon: string
	color: string
	bgColor: string
}

// Color palette for subforum groups
const COLORS = {
	green: { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
	purple: { color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
	blue: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
	orange: { color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
	pink: { color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
	yellow: { color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
	cyan: { color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' },
	red: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
	indigo: { color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.15)' },
	emerald: { color: '#059669', bgColor: 'rgba(5, 150, 105, 0.15)' },
}

export const SUBFORUM_STYLES: Record<string, SubforumStyle> = {
	// General
	'off-topic': { icon: 'lucide:message-circle', ...COLORS.green },
	politica: { icon: 'lucide:landmark', ...COLORS.red },
	streamers: { icon: 'lucide:video', ...COLORS.purple },
	criptomonedas: { icon: 'lucide:bitcoin', ...COLORS.orange },
	mafia: { icon: 'mdi:redhat', ...COLORS.indigo },
	'estudios-trabajo': { icon: 'lucide:graduation-cap', ...COLORS.blue },
	ciencia: { icon: 'lucide:flask-conical', ...COLORS.cyan },
	musica: { icon: 'lucide:music', ...COLORS.pink },
	cine: { icon: 'lucide:film', ...COLORS.indigo },
	tv: { icon: 'lucide:tv', ...COLORS.purple },
	'libros-comics': { icon: 'lucide:book-open', ...COLORS.yellow },
	'anime-manga': { icon: 'arcticons:manga-dogs', ...COLORS.pink },
	deportes: { icon: 'lucide:trophy', ...COLORS.emerald },
	motor: { icon: 'lucide:car', ...COLORS.red },
	cocina: { icon: 'lucide:chef-hat', ...COLORS.orange },
	fitness: { icon: 'lucide:dumbbell', ...COLORS.green },
	mascotas: { icon: 'lucide:paw-print', ...COLORS.yellow },
	viajes: { icon: 'lucide:plane', ...COLORS.cyan },
	'compra-venta': { icon: 'lucide:shopping-cart', ...COLORS.green },
	'club-hucha': { icon: 'lucide:piggy-bank', ...COLORS.yellow },
	feda: { icon: 'lucide:zap', ...COLORS.orange },

	// Gaming
	juegos: { icon: 'lucide:gamepad-2', ...COLORS.purple },
	mmo: { icon: 'fa-solid:hat-wizard', ...COLORS.blue },
	'juegos-lucha': { icon: 'lucide:swords', ...COLORS.red },
	'juegos-mesa-rol': { icon: 'lucide:dice-5', ...COLORS.orange },
	counterstrike: { icon: 'simple-icons:counterstrike', ...COLORS.yellow },
	diablo: { icon: 'game-icons:diablo-skull', ...COLORS.red },
	lol: { icon: 'simple-icons:leagueoflegends', ...COLORS.blue },
	poe: { icon: 'lucide:skull', ...COLORS.green },
	pokemon: { icon: 'ic:baseline-catching-pokemon', ...COLORS.yellow },
	valorant: { icon: 'simple-icons:valorant', ...COLORS.red },
	wow: { icon: 'lucide:sword', ...COLORS.orange },
	'juegos-movil': { icon: 'lucide:smartphone', ...COLORS.cyan },
	intercambios: { icon: 'lucide:repeat', ...COLORS.green },

	// Technology
	dev: { icon: 'lucide:code-2', ...COLORS.blue },
	gamedev: { icon: 'lucide:cpu', ...COLORS.purple },
	'electronica-telefonia': { icon: 'lucide:smartphone', ...COLORS.cyan },
	'hard-soft': { icon: 'lucide:monitor', ...COLORS.indigo },

	// Community
	mediavida: { icon: '/icon/32.png', ...COLORS.pink },
}

/**
 * Get style for a subforum, with fallback
 */
export function getSubforumStyle(slug: string): SubforumStyle {
	return (
		SUBFORUM_STYLES[slug] || {
			icon: 'lucide:hash',
			color: '#6b7280',
			bgColor: 'rgba(107, 114, 128, 0.15)',
		}
	)
}

/**
 * Subforum groups for display in selector
 */
export interface SubforumGroup {
	name: string
	slugs: string[]
}

export const SUBFORUM_GROUPS: SubforumGroup[] = [
	{
		name: 'General',
		slugs: [
			'off-topic',
			'politica',
			'streamers',
			'criptomonedas',
			'estudios-trabajo',
			'ciencia',
			'musica',
			'cine',
			'tv',
			'libros-comics',
			'anime-manga',
			'deportes',
			'motor',
			'cocina',
			'fitness',
			'mascotas',
			'viajes',
			'compra-venta',
			'club-hucha',
			'feda',
		],
	},
	{
		name: 'Gaming',
		slugs: [
			'juegos',
			'mmo',
			'juegos-lucha',
			'juegos-mesa-rol',
			'mafia',
			'counterstrike',
			'diablo',
			'lol',
			'poe',
			'pokemon',
			'valorant',
			'wow',
			'juegos-movil',
			'intercambios',
		],
	},
	{
		name: 'Tecnología',
		slugs: ['dev', 'gamedev', 'electronica-telefonia', 'hard-soft'],
	},
	{
		name: 'Comunidad',
		slugs: ['mediavida'],
	},
]
