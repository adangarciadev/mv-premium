/**
 * Tests for Subforum Categories
 */
import { describe, it, expect } from 'vitest'
import { SUBFORUM_CATEGORIES, type SubforumCategory } from './subforum-categories'

// Import the helper function if it's exported, otherwise test the constant structure
describe('subforum-categories', () => {
	describe('SUBFORUM_CATEGORIES', () => {
		it('should be an object', () => {
			expect(typeof SUBFORUM_CATEGORIES).toBe('object')
		})

		it('should have common subforums', () => {
			expect(SUBFORUM_CATEGORIES).toHaveProperty('off-topic')
			expect(SUBFORUM_CATEGORIES).toHaveProperty('feda')
			expect(SUBFORUM_CATEGORIES).toHaveProperty('politica')
		})

		it('should have valid category structure for each subforum', () => {
			for (const [slug, categories] of Object.entries(SUBFORUM_CATEGORIES)) {
				expect(Array.isArray(categories)).toBe(true)
				expect(categories.length).toBeGreaterThan(0)

				for (const category of categories) {
					expect(category).toHaveProperty('value')
					expect(category).toHaveProperty('label')
					expect(typeof category.value).toBe('string')
					expect(typeof category.label).toBe('string')
					expect(category.value.length).toBeGreaterThan(0)
					expect(category.label.length).toBeGreaterThan(0)
				}
			}
		})

		it('should have unique values within each subforum', () => {
			for (const [slug, categories] of Object.entries(SUBFORUM_CATEGORIES)) {
				const values = categories.map(c => c.value)
				const uniqueValues = new Set(values)
				expect(uniqueValues.size).toBe(values.length)
			}
		})
	})

	describe('off-topic categories', () => {
		it('should contain expected categories', () => {
			const offTopic = SUBFORUM_CATEGORIES['off-topic']
			expect(offTopic).toBeDefined()

			const labels = offTopic.map(c => c.label)
			expect(labels).toContain('Noticia')
			expect(labels).toContain('Pregunta')
			expect(labels).toContain('Debate')
			expect(labels).toContain('Gracioso')
		})
	})

	describe('politica categories', () => {
		it('should contain expected categories', () => {
			const politica = SUBFORUM_CATEGORIES['politica']
			expect(politica).toBeDefined()

			const labels = politica.map(c => c.label)
			expect(labels).toContain('Nacional')
			expect(labels).toContain('Internacional')
		})
	})

	describe('category values', () => {
		it('should be numeric strings', () => {
			for (const categories of Object.values(SUBFORUM_CATEGORIES)) {
				for (const category of categories) {
					// Values should be parseable as numbers (MV uses numeric IDs)
					expect(Number.isNaN(parseInt(category.value, 10))).toBe(false)
				}
			}
		})
	})
})
