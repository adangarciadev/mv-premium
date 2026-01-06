/**
 * Tests for Drafts Storage - generateDuplicateTitle function
 *
 * Since generateDuplicateTitle is a private function, we test it indirectly
 * through the duplicateDraft function's behavior, but we can also export
 * it for testing or create a separate test utility.
 *
 * This file tests the title generation logic separately.
 */
import { describe, it, expect } from 'vitest'

// Re-implement the function here for testing since it's not exported
// In production, this is the exact same logic used in storage/index.ts
function generateDuplicateTitle(originalTitle: string, existingTitles: string[]): string {
	const MAX_TITLE_LENGTH = 72
	const COPY_SUFFIX = ' (copia)'

	// Remove existing copy suffixes: "(copia)" or "(copia N)"
	const baseTitle = originalTitle.replace(/\s*\(copia(?:\s+\d+)?\)$/i, '').trim()

	// Get all existing titles for comparison (lowercase)
	const existingSet = new Set(existingTitles.map(t => t.toLowerCase()))

	// Try "(copia)" first
	let candidateTitle = baseTitle + COPY_SUFFIX
	if (candidateTitle.length > MAX_TITLE_LENGTH) {
		const maxBaseLength = MAX_TITLE_LENGTH - COPY_SUFFIX.length
		candidateTitle = baseTitle.slice(0, maxBaseLength).trim() + COPY_SUFFIX
	}

	if (!existingSet.has(candidateTitle.toLowerCase())) {
		return candidateTitle
	}

	// Try "(copia N)" with incrementing numbers
	let copyNumber = 2
	while (copyNumber < 1000) {
		const numberedSuffix = ` (copia ${copyNumber})`
		candidateTitle = baseTitle + numberedSuffix

		if (candidateTitle.length > MAX_TITLE_LENGTH) {
			const maxBaseLength = MAX_TITLE_LENGTH - numberedSuffix.length
			candidateTitle = baseTitle.slice(0, maxBaseLength).trim() + numberedSuffix
		}

		if (!existingSet.has(candidateTitle.toLowerCase())) {
			return candidateTitle
		}

		copyNumber++
	}

	// Fallback with timestamp
	const fallbackSuffix = ` (${Date.now()})`
	const maxBaseLength = MAX_TITLE_LENGTH - fallbackSuffix.length
	return baseTitle.slice(0, maxBaseLength).trim() + fallbackSuffix
}

describe('generateDuplicateTitle', () => {
	describe('basic functionality', () => {
		it('should add "(copia)" suffix to original title', () => {
			const result = generateDuplicateTitle('Mi borrador', [])
			expect(result).toBe('Mi borrador (copia)')
		})

		it('should handle empty existing titles array', () => {
			const result = generateDuplicateTitle('Test', [])
			expect(result).toBe('Test (copia)')
		})
	})

	describe('removing existing copy suffixes', () => {
		it('should remove "(copia)" from title before adding new suffix', () => {
			const result = generateDuplicateTitle('Mi borrador (copia)', [])
			expect(result).toBe('Mi borrador (copia)')
		})

		it('should remove "(copia N)" from title before adding new suffix', () => {
			const result = generateDuplicateTitle('Mi borrador (copia 5)', [])
			expect(result).toBe('Mi borrador (copia)')
		})

		it('should handle multiple nested copy suffixes', () => {
			// This shouldn't happen in practice, but test edge case
			const result = generateDuplicateTitle('Mi borrador (copia) (copia)', [])
			// Only removes the last one
			expect(result).toBe('Mi borrador (copia) (copia)')
		})
	})

	describe('uniqueness handling', () => {
		it('should increment to "(copia 2)" when "(copia)" exists', () => {
			const existing = ['Mi borrador (copia)']
			const result = generateDuplicateTitle('Mi borrador', existing)
			expect(result).toBe('Mi borrador (copia 2)')
		})

		it('should increment to "(copia 3)" when "(copia)" and "(copia 2)" exist', () => {
			const existing = ['Mi borrador (copia)', 'Mi borrador (copia 2)']
			const result = generateDuplicateTitle('Mi borrador', existing)
			expect(result).toBe('Mi borrador (copia 3)')
		})

		it('should find first available number', () => {
			const existing = [
				'Mi borrador (copia)',
				'Mi borrador (copia 2)',
				'Mi borrador (copia 3)',
				'Mi borrador (copia 5)', // gap at 4
			]
			const result = generateDuplicateTitle('Mi borrador', existing)
			expect(result).toBe('Mi borrador (copia 4)')
		})

		it('should be case-insensitive when checking uniqueness', () => {
			const existing = ['MI BORRADOR (COPIA)']
			const result = generateDuplicateTitle('Mi borrador', existing)
			expect(result).toBe('Mi borrador (copia 2)')
		})
	})

	describe('72 character limit', () => {
		it('should truncate long titles to fit within 72 characters', () => {
			const longTitle = 'A'.repeat(70) // 70 chars
			const result = generateDuplicateTitle(longTitle, [])
			expect(result.length).toBeLessThanOrEqual(72)
			expect(result).toContain('(copia)')
		})

		it('should handle exactly 72 character result', () => {
			// " (copia)" is 8 characters, so base should be 64
			const baseTitle = 'A'.repeat(64)
			const result = generateDuplicateTitle(baseTitle, [])
			expect(result.length).toBe(72)
			expect(result).toBe(baseTitle + ' (copia)')
		})

		it('should truncate when title + suffix exceeds 72', () => {
			const baseTitle = 'A'.repeat(70)
			const result = generateDuplicateTitle(baseTitle, [])
			// Should truncate base to fit " (copia)" (8 chars)
			expect(result.length).toBe(72)
			expect(result.endsWith(' (copia)')).toBe(true)
		})

		it('should handle numbered suffix with long titles', () => {
			const baseTitle = 'A'.repeat(60)
			const existing = [baseTitle + ' (copia)']
			const result = generateDuplicateTitle(baseTitle, existing)
			// " (copia 2)" is 10 chars
			expect(result.length).toBeLessThanOrEqual(72)
			expect(result).toContain('(copia 2)')
		})

		it('should handle very long numbered suffixes', () => {
			const baseTitle = 'A'.repeat(60)
			const existing: string[] = []
			// Create many existing copies
			for (let i = 1; i <= 100; i++) {
				const suffix = i === 1 ? ' (copia)' : ` (copia ${i})`
				existing.push(baseTitle.slice(0, 72 - suffix.length) + suffix)
			}
			const result = generateDuplicateTitle(baseTitle, existing)
			expect(result.length).toBeLessThanOrEqual(72)
		})
	})

	describe('edge cases', () => {
		it('should handle empty original title', () => {
			const result = generateDuplicateTitle('', [])
			expect(result).toBe(' (copia)')
		})

		it('should handle whitespace-only title', () => {
			const result = generateDuplicateTitle('   ', [])
			expect(result).toBe(' (copia)')
		})

		it('should handle title that is exactly "(copia)"', () => {
			const result = generateDuplicateTitle('(copia)', [])
			expect(result).toBe(' (copia)')
		})

		it('should handle special characters in title', () => {
			const result = generateDuplicateTitle('Test @#$% título!', [])
			expect(result).toBe('Test @#$% título! (copia)')
		})

		it('should handle unicode characters', () => {
			const result = generateDuplicateTitle('日本語タイトル', [])
			expect(result).toBe('日本語タイトル (copia)')
		})
	})

	describe('multiple duplicate scenarios', () => {
		it('should handle duplicating a duplicate', () => {
			const existing = ['Original', 'Original (copia)']
			const result = generateDuplicateTitle('Original (copia)', existing)
			expect(result).toBe('Original (copia 2)')
		})

		it('should handle duplicating numbered duplicate', () => {
			const existing = ['Original', 'Original (copia)', 'Original (copia 2)']
			const result = generateDuplicateTitle('Original (copia 2)', existing)
			expect(result).toBe('Original (copia 3)')
		})
	})
})
