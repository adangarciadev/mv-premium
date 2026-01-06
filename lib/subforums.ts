/**
 * Mediavida Subforum Constants
 * Centralized list of all subforums with their slugs, names, and icon IDs
 * Extracted from native Mediavida forum dropdown
 */

export interface SubforumInfo {
	slug: string;
	name: string;
	iconId: number;
}

/**
 * All subforums organized in display order (matching native dropdown)
 * Includes separator markers for visual grouping
 */
export const SUBFORUMS: SubforumInfo[] = [
	// General
	{ slug: 'off-topic', name: 'Off-topic', iconId: 6 },
	{ slug: 'politica', name: 'Política', iconId: 168 },
	{ slug: 'streamers', name: 'Streamers e Influencers', iconId: 165 },
	{ slug: 'criptomonedas', name: 'Criptomonedas y finanzas', iconId: 156 },
	{ slug: 'estudios-trabajo', name: 'Estudios y trabajo', iconId: 132 },
	{ slug: 'ciencia', name: 'Ciencia', iconId: 148 },
	{ slug: 'musica', name: 'Música', iconId: 23 },
	{ slug: 'cine', name: 'Cine', iconId: 102 },
	{ slug: 'tv', name: 'Televisión', iconId: 82 },
	{ slug: 'libros-comics', name: 'Libros y cómics', iconId: 109 },
	{ slug: 'anime-manga', name: 'Anime y manga', iconId: 99 },
	{ slug: 'deportes', name: 'Deportes', iconId: 32 },
	{ slug: 'motor', name: 'Motor', iconId: 96 },
	{ slug: 'cocina', name: 'Cocina', iconId: 127 },
	{ slug: 'fitness', name: 'Fitness', iconId: 116 },
	{ slug: 'mascotas', name: 'Mascotas', iconId: 126 },
	{ slug: 'viajes', name: 'Viajes', iconId: 106 },
	{ slug: 'compra-venta', name: 'Compra-Venta', iconId: 112 },
	{ slug: 'club-hucha', name: 'Club de la hucha', iconId: 135 },
	{ slug: 'feda', name: 'FEDA', iconId: 90 },
];

export const SUBFORUMS_JUEGOS: SubforumInfo[] = [
	{ slug: 'juegos', name: 'Juegos', iconId: 7 },
	{ slug: 'mmo', name: 'MMO', iconId: 26 },
	{ slug: 'juegos-lucha', name: 'Juegos de lucha', iconId: 150 },
	{ slug: 'juegos-mesa-rol', name: 'Juegos de mesa y rol', iconId: 133 },
	{ slug: 'mafia', name: 'Mafia', iconId: 164 },
	{ slug: 'counterstrike', name: 'Counter-Strike', iconId: 1 },
	{ slug: 'diablo', name: 'Diablo IV', iconId: 114 },
	{ slug: 'lol', name: 'League of Legends', iconId: 110 },
	{ slug: 'poe', name: 'Path of Exile', iconId: 137 },
	{ slug: 'pokemon', name: 'Pokémon', iconId: 128 },
	{ slug: 'valorant', name: 'Valorant', iconId: 162 },
	{ slug: 'wow', name: 'World of Warcraft', iconId: 38 },
	{ slug: 'juegos-movil', name: 'Juegos de móvil', iconId: 136 },
	{ slug: 'intercambios', name: 'Intercambios', iconId: 144 },
];

export const SUBFORUMS_TECNOLOGIA: SubforumInfo[] = [
	{ slug: 'dev', name: 'Desarrollo y diseño', iconId: 9 },
	{ slug: 'gamedev', name: 'Desarrollo de juegos', iconId: 143 },
	{ slug: 'electronica-telefonia', name: 'Electrónica y telefonía', iconId: 83 },
	{ slug: 'hard-soft', name: 'Hardware y software', iconId: 3 },
];

export const SUBFORUMS_COMUNIDAD: SubforumInfo[] = [
	{ slug: 'mediavida', name: 'Mediavida', iconId: 4 },
];

/**
 * All subforums as a flat array
 */
export const ALL_SUBFORUMS: SubforumInfo[] = [
	...SUBFORUMS,
	...SUBFORUMS_JUEGOS,
	...SUBFORUMS_TECNOLOGIA,
	...SUBFORUMS_COMUNIDAD,
];

/**
 * Set of valid subforum slugs (for validation)
 */
export const VALID_SUBFORUM_SLUGS = new Set(ALL_SUBFORUMS.map(s => s.slug));

/**
 * Get the URL for creating a new thread in a subforum
 */
export function getNewThreadUrl(slug: string): string {
	return `/foro/${slug}/nuevo-hilo`;
}

/**
 * Get the URL for a subforum
 */
export function getSubforumUrl(slug: string): string {
	return `/foro/${slug}`;
}

/**
 * Get display name for a subforum slug
 * Handles exact matches first, then tries case-insensitive
 */
export function getSubforumName(slug: string): string {
    if (!slug) return '';
    
    // Try exact match
    const exact = ALL_SUBFORUMS.find(s => s.slug === slug);
    if (exact) return exact.name;

    // Try case-insensitive
    const lower = slug.toLowerCase().trim();
    const approximate = ALL_SUBFORUMS.find(s => s.slug.toLowerCase() === lower);
    if (approximate) return approximate.name;

    // Fallback to formatting the slug
    return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}
