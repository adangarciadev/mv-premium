/**
 * Tests for IGDB Types and Utilities
 */
import { describe, it, expect } from 'vitest'
import {
	getIGDBImageUrl,
	IGDBWebsiteCategory,
	IGDBAgeRatingCategory,
	PEGI_RATING_LABELS,
	ESRB_RATING_LABELS,
	GAME_MODE_TRANSLATIONS,
	GENRE_TRANSLATIONS,
	THEME_TRANSLATIONS,
} from './igdb-types'

describe('IGDB Types', () => {
	describe('getIGDBImageUrl', () => {
		it('should return correct URL with default size (cover_big)', () => {
			const result = getIGDBImageUrl('abc123')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/abc123.jpg')
		})

		it('should return correct URL with cover_small size', () => {
			const result = getIGDBImageUrl('abc123', 'cover_small')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_cover_small/abc123.jpg')
		})

		it('should return correct URL with screenshot_big size', () => {
			const result = getIGDBImageUrl('screenshot_id', 'screenshot_big')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_screenshot_big/screenshot_id.jpg')
		})

		it('should return correct URL with screenshot_huge size', () => {
			const result = getIGDBImageUrl('huge_id', 'screenshot_huge')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_screenshot_huge/huge_id.jpg')
		})

		it('should return correct URL with 1080p size', () => {
			const result = getIGDBImageUrl('hd_id', '1080p')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_1080p/hd_id.jpg')
		})

		it('should return correct URL with 720p size', () => {
			const result = getIGDBImageUrl('hd_id', '720p')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_720p/hd_id.jpg')
		})

		it('should return correct URL with thumb size', () => {
			const result = getIGDBImageUrl('thumb_id', 'thumb')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_thumb/thumb_id.jpg')
		})

		it('should handle image IDs with special characters', () => {
			const result = getIGDBImageUrl('co1abc_def')
			expect(result).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc_def.jpg')
		})
	})

	describe('IGDBWebsiteCategory enum', () => {
		it('should have correct values for common categories', () => {
			expect(IGDBWebsiteCategory.Official).toBe(1)
			expect(IGDBWebsiteCategory.Steam).toBe(13)
			expect(IGDBWebsiteCategory.GOG).toBe(17)
			expect(IGDBWebsiteCategory.EpicGames).toBe(16)
			expect(IGDBWebsiteCategory.Discord).toBe(18)
		})

		it('should have correct values for social media', () => {
			expect(IGDBWebsiteCategory.Twitter).toBe(5)
			expect(IGDBWebsiteCategory.YouTube).toBe(9)
			expect(IGDBWebsiteCategory.Twitch).toBe(6)
			expect(IGDBWebsiteCategory.Reddit).toBe(14)
		})
	})

	describe('IGDBAgeRatingCategory enum', () => {
		it('should have correct values', () => {
			expect(IGDBAgeRatingCategory.ESRB).toBe(1)
			expect(IGDBAgeRatingCategory.PEGI).toBe(2)
			expect(IGDBAgeRatingCategory.CERO).toBe(3)
			expect(IGDBAgeRatingCategory.USK).toBe(4)
		})
	})

	describe('PEGI_RATING_LABELS', () => {
		it('should have all PEGI ratings', () => {
			expect(PEGI_RATING_LABELS[1]).toBe('PEGI 3')
			expect(PEGI_RATING_LABELS[2]).toBe('PEGI 7')
			expect(PEGI_RATING_LABELS[3]).toBe('PEGI 12')
			expect(PEGI_RATING_LABELS[4]).toBe('PEGI 16')
			expect(PEGI_RATING_LABELS[5]).toBe('PEGI 18')
		})

		it('should have exactly 5 ratings', () => {
			expect(Object.keys(PEGI_RATING_LABELS)).toHaveLength(5)
		})
	})

	describe('ESRB_RATING_LABELS', () => {
		it('should have all ESRB ratings', () => {
			expect(ESRB_RATING_LABELS[6]).toBe('RP (Rating Pending)')
			expect(ESRB_RATING_LABELS[7]).toBe('EC (Early Childhood)')
			expect(ESRB_RATING_LABELS[8]).toBe('E (Everyone)')
			expect(ESRB_RATING_LABELS[9]).toBe('E10+ (Everyone 10+)')
			expect(ESRB_RATING_LABELS[10]).toBe('T (Teen)')
			expect(ESRB_RATING_LABELS[11]).toBe('M (Mature 17+)')
			expect(ESRB_RATING_LABELS[12]).toBe('AO (Adults Only)')
		})

		it('should have exactly 7 ratings', () => {
			expect(Object.keys(ESRB_RATING_LABELS)).toHaveLength(7)
		})
	})

	describe('GAME_MODE_TRANSLATIONS', () => {
		it('should translate common game modes to Spanish', () => {
			expect(GAME_MODE_TRANSLATIONS['Single player']).toBe('Un jugador')
			expect(GAME_MODE_TRANSLATIONS['Multiplayer']).toBe('Multijugador')
			expect(GAME_MODE_TRANSLATIONS['Co-operative']).toBe('Cooperativo')
			expect(GAME_MODE_TRANSLATIONS['Split screen']).toBe('Pantalla dividida')
		})

		it('should keep MMO and Battle Royale in English/Spanish hybrid', () => {
			expect(GAME_MODE_TRANSLATIONS['Massively Multiplayer Online (MMO)']).toBe('MMO')
			expect(GAME_MODE_TRANSLATIONS['Battle Royale']).toBe('Battle Royale')
		})
	})

	describe('GENRE_TRANSLATIONS', () => {
		it('should translate common genres to Spanish', () => {
			expect(GENRE_TRANSLATIONS['Fighting']).toBe('Lucha')
			expect(GENRE_TRANSLATIONS['Shooter']).toBe('Disparos')
			expect(GENRE_TRANSLATIONS['Platform']).toBe('Plataformas')
			expect(GENRE_TRANSLATIONS['Racing']).toBe('Carreras')
			expect(GENRE_TRANSLATIONS['Adventure']).toBe('Aventura')
		})

		it('should translate RPG correctly', () => {
			expect(GENRE_TRANSLATIONS['Role-playing (RPG)']).toBe('RPG')
		})

		it('should translate strategy genres', () => {
			expect(GENRE_TRANSLATIONS['Strategy']).toBe('Estrategia')
			expect(GENRE_TRANSLATIONS['Real Time Strategy (RTS)']).toBe('Estrategia en tiempo real')
			expect(GENRE_TRANSLATIONS['Turn-based strategy (TBS)']).toBe('Estrategia por turnos')
		})

		it('should keep some genres in original form', () => {
			expect(GENRE_TRANSLATIONS['Indie']).toBe('Indie')
			expect(GENRE_TRANSLATIONS['Arcade']).toBe('Arcade')
			expect(GENRE_TRANSLATIONS['MOBA']).toBe('MOBA')
		})
	})

	describe('THEME_TRANSLATIONS', () => {
		it('should translate common themes to Spanish', () => {
			expect(THEME_TRANSLATIONS['Action']).toBe('Acción')
			expect(THEME_TRANSLATIONS['Fantasy']).toBe('Fantasía')
			expect(THEME_TRANSLATIONS['Science fiction']).toBe('Ciencia ficción')
			expect(THEME_TRANSLATIONS['Horror']).toBe('Terror')
			expect(THEME_TRANSLATIONS['Survival']).toBe('Supervivencia')
		})

		it('should translate gaming-specific themes', () => {
			expect(THEME_TRANSLATIONS['Open world']).toBe('Mundo abierto')
			expect(THEME_TRANSLATIONS['Sandbox']).toBe('Sandbox')
			expect(THEME_TRANSLATIONS['Stealth']).toBe('Sigilo')
		})

		it('should translate 4X correctly', () => {
			expect(THEME_TRANSLATIONS['4X (explore, expand, exploit, and exterminate)']).toBe('4X')
		})
	})
})
