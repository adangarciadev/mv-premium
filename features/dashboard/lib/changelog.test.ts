/**
 * Tests for Dashboard Changelog utilities
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface ChangeEntry {
	type: 'feature' | 'fix' | 'improvement'
	description: string
	category?: string
}

interface ChangelogEntry {
	version: string
	date: string
	title: string
	summary?: string
	changes: ChangeEntry[]
}

// Sample changelog for testing
const CHANGELOG: ChangelogEntry[] = [
	{
		version: '1.2.0',
		date: '2025-02-01',
		title: 'Febrero Update',
		changes: [
			{ type: 'feature', description: 'Nueva feature', category: 'Test' },
			{ type: 'fix', description: 'Bug fix', category: 'Test' },
		],
	},
	{
		version: '1.1.0',
		date: '2025-01-15',
		title: 'Enero Update',
		changes: [{ type: 'improvement', description: 'Mejora de rendimiento' }],
	},
	{
		version: '1.0.0',
		date: '2025-01-05',
		title: 'Lanzamiento Oficial',
		summary: 'Primera versión',
		changes: [{ type: 'feature', description: 'Feature inicial' }],
	},
]

function getLatestVersion(changelog: ChangelogEntry[]): string {
	return changelog[0]?.version ?? '0.0.0'
}

function getChangesSince(changelog: ChangelogEntry[], version: string): ChangelogEntry[] {
	const index = changelog.findIndex(entry => entry.version === version)
	if (index === -1) {
		return changelog
	}
	return changelog.slice(0, index)
}

function countChangesSince(changelog: ChangelogEntry[], version: string): number {
	const entries = getChangesSince(changelog, version)
	return entries.reduce((count, entry) => count + entry.changes.length, 0)
}

function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split('.').map(Number)
	const parts2 = v2.split('.').map(Number)

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const p1 = parts1[i] || 0
		const p2 = parts2[i] || 0
		if (p1 > p2) return 1
		if (p1 < p2) return -1
	}
	return 0
}

describe('dashboard changelog', () => {
	describe('ChangeEntry interface', () => {
		it('should support feature type', () => {
			const entry: ChangeEntry = {
				type: 'feature',
				description: 'Nueva funcionalidad',
				category: 'Productividad',
			}

			expect(entry.type).toBe('feature')
		})

		it('should support fix type', () => {
			const entry: ChangeEntry = {
				type: 'fix',
				description: 'Corrección de error',
			}

			expect(entry.type).toBe('fix')
		})

		it('should support improvement type', () => {
			const entry: ChangeEntry = {
				type: 'improvement',
				description: 'Mejora de rendimiento',
			}

			expect(entry.type).toBe('improvement')
		})
	})

	describe('ChangelogEntry interface', () => {
		it('should have required fields', () => {
			const entry: ChangelogEntry = {
				version: '1.0.0',
				date: '2025-01-05',
				title: 'Release',
				changes: [],
			}

			expect(entry.version).toBeDefined()
			expect(entry.date).toBeDefined()
			expect(entry.title).toBeDefined()
			expect(entry.changes).toBeDefined()
		})

		it('should support optional summary', () => {
			const entry: ChangelogEntry = {
				version: '1.0.0',
				date: '2025-01-05',
				title: 'Release',
				summary: 'Description of release',
				changes: [],
			}

			expect(entry.summary).toBe('Description of release')
		})
	})

	describe('getLatestVersion', () => {
		it('should return the first entry version', () => {
			expect(getLatestVersion(CHANGELOG)).toBe('1.2.0')
		})

		it('should return fallback for empty changelog', () => {
			expect(getLatestVersion([])).toBe('0.0.0')
		})
	})

	describe('getChangesSince', () => {
		it('should return all entries for unknown version', () => {
			const result = getChangesSince(CHANGELOG, 'unknown')
			expect(result).toEqual(CHANGELOG)
		})

		it('should return newer entries only', () => {
			const result = getChangesSince(CHANGELOG, '1.1.0')

			expect(result).toHaveLength(1)
			expect(result[0].version).toBe('1.2.0')
		})

		it('should return empty for latest version', () => {
			const result = getChangesSince(CHANGELOG, '1.2.0')
			expect(result).toHaveLength(0)
		})

		it('should return multiple entries when behind', () => {
			const result = getChangesSince(CHANGELOG, '1.0.0')

			expect(result).toHaveLength(2)
		})
	})

	describe('countChangesSince', () => {
		it('should count total changes', () => {
			const count = countChangesSince(CHANGELOG, '1.1.0')
			expect(count).toBe(2) // 1.2.0 has 2 changes
		})

		it('should return 0 for latest version', () => {
			const count = countChangesSince(CHANGELOG, '1.2.0')
			expect(count).toBe(0)
		})

		it('should count across multiple versions', () => {
			const count = countChangesSince(CHANGELOG, '1.0.0')
			expect(count).toBe(3) // 1.2.0 (2) + 1.1.0 (1)
		})
	})

	describe('compareVersions', () => {
		it('should compare major versions', () => {
			expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
			expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
		})

		it('should compare minor versions', () => {
			expect(compareVersions('1.2.0', '1.1.0')).toBe(1)
			expect(compareVersions('1.1.0', '1.2.0')).toBe(-1)
		})

		it('should compare patch versions', () => {
			expect(compareVersions('1.0.2', '1.0.1')).toBe(1)
			expect(compareVersions('1.0.1', '1.0.2')).toBe(-1)
		})

		it('should return 0 for equal versions', () => {
			expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
		})

		it('should handle different length versions', () => {
			expect(compareVersions('1.0', '1.0.0')).toBe(0)
			expect(compareVersions('1.0.1', '1.0')).toBe(1)
		})
	})

	describe('changelog filtering', () => {
		it('should filter by change type', () => {
			const allChanges = CHANGELOG.flatMap(e => e.changes)
			const features = allChanges.filter(c => c.type === 'feature')

			expect(features.length).toBeGreaterThan(0)
		})

		it('should filter by category', () => {
			const allChanges = CHANGELOG.flatMap(e => e.changes)
			const testCategory = allChanges.filter(c => c.category === 'Test')

			expect(testCategory).toHaveLength(2)
		})
	})

	describe('date handling', () => {
		it('should have valid ISO date format', () => {
			const datePattern = /^\d{4}-\d{2}-\d{2}$/

			CHANGELOG.forEach(entry => {
				expect(entry.date).toMatch(datePattern)
			})
		})

		it('should be chronologically ordered (newest first)', () => {
			for (let i = 0; i < CHANGELOG.length - 1; i++) {
				const current = new Date(CHANGELOG[i].date)
				const next = new Date(CHANGELOG[i + 1].date)
				expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
			}
		})
	})
})
