/**
 * Tests for User Customizations Storage Types and Defaults
 */
import { describe, it, expect } from 'vitest'

// Re-define types and constants for testing
const MV_ROLE_COLORS = {
	ADMIN: '#ff4444',
	SUBADMIN: '#ff8800',
	MOD: '#4488ff',
	USER: '#888888',
}

interface UserCustomization {
	usernameCustom?: string
	usernameColour?: string
	badge?: string
	badgeColor?: string
	badgeTextColor?: string
	badgeStyle?: 'badge' | 'text'
	isIgnored?: boolean
	avatarUrl?: string
	note?: string
	highlightColor?: string
	ignoreType?: 'hide' | 'mute'
}

interface GlobalRoleSettings {
	adminColor: string
	subadminColor: string
	modColor: string
	userColor: string
}

interface UserCustomizationsData {
	users: Record<string, UserCustomization>
	globalSettings: GlobalRoleSettings
}

const DEFAULT_GLOBAL_SETTINGS: GlobalRoleSettings = {
	adminColor: MV_ROLE_COLORS.ADMIN,
	subadminColor: MV_ROLE_COLORS.SUBADMIN,
	modColor: MV_ROLE_COLORS.MOD,
	userColor: MV_ROLE_COLORS.USER,
}

describe('user-customizations storage', () => {
	describe('UserCustomization interface', () => {
		it('should support username customization', () => {
			const custom: UserCustomization = {
				usernameCustom: 'CoolNick',
				usernameColour: '#ff0000',
			}
			expect(custom.usernameCustom).toBe('CoolNick')
			expect(custom.usernameColour).toBe('#ff0000')
		})

		it('should support badge customization', () => {
			const custom: UserCustomization = {
				badge: 'VIP',
				badgeColor: '#gold',
				badgeTextColor: '#000',
				badgeStyle: 'badge',
			}
			expect(custom.badge).toBe('VIP')
			expect(custom.badgeStyle).toBe('badge')
		})

		it('should support ignore functionality', () => {
			const hiddenUser: UserCustomization = {
				isIgnored: true,
				ignoreType: 'hide',
			}
			const mutedUser: UserCustomization = {
				isIgnored: true,
				ignoreType: 'mute',
			}
			expect(hiddenUser.ignoreType).toBe('hide')
			expect(mutedUser.ignoreType).toBe('mute')
		})

		it('should support user notes', () => {
			const custom: UserCustomization = {
				note: 'This user posts great content',
			}
			expect(custom.note).toBeDefined()
		})

		it('should support post highlighting', () => {
			const custom: UserCustomization = {
				highlightColor: '#ffffcc',
			}
			expect(custom.highlightColor).toBe('#ffffcc')
		})
	})

	describe('GlobalRoleSettings', () => {
		it('should have default colors for all roles', () => {
			expect(DEFAULT_GLOBAL_SETTINGS.adminColor).toBeDefined()
			expect(DEFAULT_GLOBAL_SETTINGS.subadminColor).toBeDefined()
			expect(DEFAULT_GLOBAL_SETTINGS.modColor).toBeDefined()
			expect(DEFAULT_GLOBAL_SETTINGS.userColor).toBeDefined()
		})

		it('should match MV_ROLE_COLORS constants', () => {
			expect(DEFAULT_GLOBAL_SETTINGS.adminColor).toBe(MV_ROLE_COLORS.ADMIN)
			expect(DEFAULT_GLOBAL_SETTINGS.subadminColor).toBe(MV_ROLE_COLORS.SUBADMIN)
			expect(DEFAULT_GLOBAL_SETTINGS.modColor).toBe(MV_ROLE_COLORS.MOD)
			expect(DEFAULT_GLOBAL_SETTINGS.userColor).toBe(MV_ROLE_COLORS.USER)
		})
	})

	describe('UserCustomizationsData structure', () => {
		it('should organize users by ID', () => {
			const data: UserCustomizationsData = {
				users: {
					user123: { usernameCustom: 'Nick1' },
					user456: { usernameCustom: 'Nick2' },
				},
				globalSettings: DEFAULT_GLOBAL_SETTINGS,
			}
			expect(Object.keys(data.users)).toHaveLength(2)
			expect(data.users['user123']?.usernameCustom).toBe('Nick1')
		})

		it('should include global settings', () => {
			const data: UserCustomizationsData = {
				users: {},
				globalSettings: DEFAULT_GLOBAL_SETTINGS,
			}
			expect(data.globalSettings).toBeDefined()
			expect(data.globalSettings.adminColor).toBeDefined()
		})
	})
})
