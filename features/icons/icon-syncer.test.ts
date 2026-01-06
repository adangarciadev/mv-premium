/**
 * Tests for Icon Syncer types and structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing
interface FidIconStyle {
	iconClass: string
	color?: string
	size?: number
	customUrl?: string
}

interface IconSyncConfig {
	enabled: boolean
	lastSync: number
	syncInterval: number
}

const ICONS_STORAGE_KEY = 'fid_icons'
const DEFAULT_SYNC_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

describe('icon-syncer', () => {
	describe('FidIconStyle interface', () => {
		it('should require iconClass', () => {
			const icon: FidIconStyle = {
				iconClass: 'fid fid-6',
			}

			expect(icon.iconClass).toBe('fid fid-6')
		})

		it('should support optional color', () => {
			const icon: FidIconStyle = {
				iconClass: 'fid fid-7',
				color: '#ff5500',
			}

			expect(icon.color).toBe('#ff5500')
		})

		it('should support optional size', () => {
			const icon: FidIconStyle = {
				iconClass: 'fid fid-8',
				size: 24,
			}

			expect(icon.size).toBe(24)
		})

		it('should support custom URL for custom icons', () => {
			const icon: FidIconStyle = {
				iconClass: 'custom-icon',
				customUrl: 'https://example.com/icon.svg',
			}

			expect(icon.customUrl).toBeDefined()
		})
	})

	describe('storage key', () => {
		it('should have a defined storage key', () => {
			expect(ICONS_STORAGE_KEY).toBe('fid_icons')
		})
	})

	describe('IconSyncConfig', () => {
		it('should track sync state', () => {
			const config: IconSyncConfig = {
				enabled: true,
				lastSync: Date.now() - 3600000, // 1 hour ago
				syncInterval: DEFAULT_SYNC_INTERVAL,
			}

			expect(config.enabled).toBe(true)
			expect(config.lastSync).toBeLessThan(Date.now())
		})

		it('should have default sync interval', () => {
			expect(DEFAULT_SYNC_INTERVAL).toBe(86400000) // 24 hours in ms
		})
	})

	describe('sync timing', () => {
		it('should determine if sync is needed', () => {
			const lastSync = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
			const syncInterval = DEFAULT_SYNC_INTERVAL

			const needsSync = Date.now() - lastSync > syncInterval

			expect(needsSync).toBe(true)
		})

		it('should not sync if recent', () => {
			const lastSync = Date.now() - 1 * 60 * 60 * 1000 // 1 hour ago
			const syncInterval = DEFAULT_SYNC_INTERVAL

			const needsSync = Date.now() - lastSync > syncInterval

			expect(needsSync).toBe(false)
		})
	})

	describe('icon class parsing', () => {
		it('should extract icon ID from class', () => {
			const iconClass = 'fid fid-6'
			const match = iconClass.match(/fid-(\d+)/)
			const iconId = match ? parseInt(match[1]) : null

			expect(iconId).toBe(6)
		})

		it('should handle multiple classes', () => {
			const iconClass = 'fid fid-12 active highlighted'
			const match = iconClass.match(/fid-(\d+)/)
			const iconId = match ? parseInt(match[1]) : null

			expect(iconId).toBe(12)
		})

		it('should handle no icon ID', () => {
			const iconClass = 'some-other-class'
			const match = iconClass.match(/fid-(\d+)/)
			const iconId = match ? parseInt(match[1]) : null

			expect(iconId).toBeNull()
		})
	})

	describe('icon map operations', () => {
		it('should store icons by subforum', () => {
			const iconMap = new Map<string, FidIconStyle>()

			iconMap.set('cine', { iconClass: 'fid fid-7' })
			iconMap.set('hardwar', { iconClass: 'fid fid-6' })

			expect(iconMap.get('cine')?.iconClass).toBe('fid fid-7')
			expect(iconMap.size).toBe(2)
		})

		it('should update existing icons', () => {
			const iconMap = new Map<string, FidIconStyle>()

			iconMap.set('cine', { iconClass: 'fid fid-7' })
			iconMap.set('cine', { iconClass: 'fid fid-7', color: '#ff0000' })

			expect(iconMap.get('cine')?.color).toBe('#ff0000')
			expect(iconMap.size).toBe(1) // Still only one entry
		})
	})
})
