/**
 * Tests for Subforums utilities
 */
import { describe, it, expect } from 'vitest'
import {
	SUBFORUMS,
	SUBFORUMS_JUEGOS,
	SUBFORUMS_TECNOLOGIA,
	SUBFORUMS_COMUNIDAD,
	ALL_SUBFORUMS,
	VALID_SUBFORUM_SLUGS,
	getNewThreadUrl,
	getSubforumUrl,
	getSubforumName,
} from './subforums'

describe('subforums', () => {
	describe('SUBFORUMS constants', () => {
		it('should have SUBFORUMS array with items', () => {
			expect(SUBFORUMS.length).toBeGreaterThan(0)
		})

		it('should have SUBFORUMS_JUEGOS array with items', () => {
			expect(SUBFORUMS_JUEGOS.length).toBeGreaterThan(0)
		})

		it('should have SUBFORUMS_TECNOLOGIA array with items', () => {
			expect(SUBFORUMS_TECNOLOGIA.length).toBeGreaterThan(0)
		})

		it('should have SUBFORUMS_COMUNIDAD array with items', () => {
			expect(SUBFORUMS_COMUNIDAD.length).toBeGreaterThan(0)
		})

		it('should have valid SubforumInfo structure', () => {
			for (const subforum of ALL_SUBFORUMS) {
				expect(subforum).toHaveProperty('slug')
				expect(subforum).toHaveProperty('name')
				expect(subforum).toHaveProperty('iconId')
				expect(typeof subforum.slug).toBe('string')
				expect(typeof subforum.name).toBe('string')
				expect(typeof subforum.iconId).toBe('number')
			}
		})

		it('should have unique slugs', () => {
			const slugs = ALL_SUBFORUMS.map(s => s.slug)
			const uniqueSlugs = new Set(slugs)
			expect(uniqueSlugs.size).toBe(slugs.length)
		})
	})

	describe('ALL_SUBFORUMS', () => {
		it('should contain all subforums from all categories', () => {
			const expected =
				SUBFORUMS.length + SUBFORUMS_JUEGOS.length + SUBFORUMS_TECNOLOGIA.length + SUBFORUMS_COMUNIDAD.length
			expect(ALL_SUBFORUMS.length).toBe(expected)
		})

		it('should include known subforums', () => {
			const slugs = ALL_SUBFORUMS.map(s => s.slug)
			expect(slugs).toContain('off-topic')
			expect(slugs).toContain('juegos')
			expect(slugs).toContain('dev')
			expect(slugs).toContain('mediavida')
		})
	})

	describe('VALID_SUBFORUM_SLUGS', () => {
		it('should be a Set', () => {
			expect(VALID_SUBFORUM_SLUGS).toBeInstanceOf(Set)
		})

		it('should contain all slugs from ALL_SUBFORUMS', () => {
			expect(VALID_SUBFORUM_SLUGS.size).toBe(ALL_SUBFORUMS.length)
			for (const subforum of ALL_SUBFORUMS) {
				expect(VALID_SUBFORUM_SLUGS.has(subforum.slug)).toBe(true)
			}
		})

		it('should allow checking valid slugs', () => {
			expect(VALID_SUBFORUM_SLUGS.has('off-topic')).toBe(true)
			expect(VALID_SUBFORUM_SLUGS.has('invalid-slug')).toBe(false)
		})
	})

	describe('getNewThreadUrl', () => {
		it('should return correct URL format', () => {
			expect(getNewThreadUrl('off-topic')).toBe('/foro/off-topic/nuevo-hilo')
		})

		it('should work with different slugs', () => {
			expect(getNewThreadUrl('juegos')).toBe('/foro/juegos/nuevo-hilo')
			expect(getNewThreadUrl('dev')).toBe('/foro/dev/nuevo-hilo')
		})
	})

	describe('getSubforumUrl', () => {
		it('should return correct URL format', () => {
			expect(getSubforumUrl('off-topic')).toBe('/foro/off-topic')
		})

		it('should work with different slugs', () => {
			expect(getSubforumUrl('juegos')).toBe('/foro/juegos')
			expect(getSubforumUrl('mediavida')).toBe('/foro/mediavida')
		})
	})

	describe('getSubforumName', () => {
		it('should return name for valid slug', () => {
			expect(getSubforumName('off-topic')).toBe('Off-topic')
			expect(getSubforumName('juegos')).toBe('Juegos')
			expect(getSubforumName('dev')).toBe('Desarrollo y diseño')
		})

		it('should handle case-insensitive lookup', () => {
			expect(getSubforumName('OFF-TOPIC')).toBe('Off-topic')
			expect(getSubforumName('Off-Topic')).toBe('Off-topic')
		})

		it('should format unknown slugs nicely', () => {
			expect(getSubforumName('unknown-slug')).toBe('Unknown Slug')
			expect(getSubforumName('test-subforum-name')).toBe('Test Subforum Name')
		})

		it('should return empty string for empty input', () => {
			expect(getSubforumName('')).toBe('')
		})

		it('should handle whitespace', () => {
			expect(getSubforumName('  off-topic  ')).toBe('Off-topic')
		})
	})
})
