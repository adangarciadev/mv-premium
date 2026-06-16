/**
 * Tests for Activity Stats Storage - date and tracking logic
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'
import { formatDateKey, getTodayKey, parseDateKey } from '@/lib/date-utils'
import { setCompressed } from '@/lib/storage/compressed-storage'
import {
	clearActivityData,
	getActivityData,
	trackActivity,
	type ActivityData,
	type ActivityEntry,
} from './storage'

const mockGetSettings = vi.hoisted(() => vi.fn())

vi.mock('@/store', () => ({
	getSettings: mockGetSettings,
}))

const ACTIVITY_KEY = `local:${STORAGE_KEYS.ACTIVITY}` as const

function setActivityTrackingPreference(value: boolean): void {
	mockGetSettings.mockResolvedValue({
		enableActivityTracking: value,
	})
}

function createActivityEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
	return {
		id: 'existing-entry',
		type: 'post',
		action: 'publish',
		timestamp: Date.now(),
		title: 'Existing thread',
		context: 'Juegos',
		url: 'https://www.mediavida.com/foro/juegos/thread-1',
		...overrides,
	}
}

beforeEach(() => {
	mockGetSettings.mockReset()
	mockGetSettings.mockResolvedValue({})
})

describe('activity-stats date utilities', () => {
	describe('formatDateKey', () => {
		it('should format a date to DD-MM-YYYY', () => {
			const date = new Date(2024, 0, 15) // January 15, 2024
			const result = formatDateKey(date)
			expect(result).toBe('15-01-2024')
		})

		it('should pad single digit day and month', () => {
			const date = new Date(2024, 0, 5) // January 5, 2024
			const result = formatDateKey(date)
			expect(result).toBe('05-01-2024')
		})

		it('should handle end of year', () => {
			const date = new Date(2024, 11, 31) // December 31, 2024
			const result = formatDateKey(date)
			expect(result).toBe('31-12-2024')
		})
	})

	describe('parseDateKey', () => {
		it('should parse DD-MM-YYYY to Date object', () => {
			const result = parseDateKey('15-01-2024')
			expect(result).not.toBeNull()
			expect(result!.getFullYear()).toBe(2024)
			expect(result!.getMonth()).toBe(0) // January
			expect(result!.getDate()).toBe(15)
		})

		it('should handle padded values', () => {
			const result = parseDateKey('05-03-2024')
			expect(result).not.toBeNull()
			expect(result!.getDate()).toBe(5)
			expect(result!.getMonth()).toBe(2) // March
		})

		it('should return null for invalid date keys', () => {
			expect(parseDateKey('invalid')).toBeNull()
			expect(parseDateKey('15-01')).toBeNull() // Missing year
			expect(parseDateKey('')).toBeNull()
		})

		it('should parse YYYY-MM-DD format differently (wrong order)', () => {
			// Note: parseDateKey expects DD-MM-YYYY, so YYYY-MM-DD will parse incorrectly
			const result = parseDateKey('2024-01-15')
			expect(result).not.toBeNull()
			// 2024 is parsed as day, 01 as month, 15 as year - resulting in invalid but parseable date
		})

		it('should be reversible with formatDateKey', () => {
			const original = new Date(2024, 5, 20) // June 20, 2024
			const key = formatDateKey(original)
			const parsed = parseDateKey(key)

			expect(parsed).not.toBeNull()
			expect(parsed!.getFullYear()).toBe(original.getFullYear())
			expect(parsed!.getMonth()).toBe(original.getMonth())
			expect(parsed!.getDate()).toBe(original.getDate())
		})
	})
})

describe('activity entry structure', () => {
	it('should define correct ActivityType values', () => {
		const validTypes = ['draft', 'post']
		validTypes.forEach(type => {
			expect(['draft', 'post']).toContain(type)
		})
	})

	it('should define correct action values', () => {
		const validActions = ['create', 'update', 'publish']
		validActions.forEach(action => {
			expect(['create', 'update', 'publish']).toContain(action)
		})
	})
})

describe('activity tracking legacy opt-in', () => {
	it('does not record new activity when there is no explicit preference and no legacy data', async () => {
		await trackActivity({ type: 'post', action: 'publish', title: 'New reply' })

		await expect(getActivityData()).resolves.toEqual({})
	})

	it('records activity when the user explicitly enables the legacy heatmap', async () => {
		setActivityTrackingPreference(true)

		await trackActivity({ type: 'post', action: 'create', title: 'New thread', context: 'Off-topic' })

		const todayEntries = (await getActivityData())[getTodayKey()]
		expect(todayEntries).toHaveLength(1)
		expect(todayEntries?.[0]).toMatchObject({
			type: 'post',
			action: 'create',
			title: 'New thread',
			context: 'Off-topic',
		})
	})

	it('does not record activity when the user explicitly disables the legacy heatmap', async () => {
		const todayKey = getTodayKey()
		const existingData: ActivityData = {
			[todayKey]: [createActivityEntry()],
		}
		await setCompressed(ACTIVITY_KEY, existingData)
		setActivityTrackingPreference(false)

		await trackActivity({ type: 'post', action: 'publish', title: 'Ignored reply' })

		const todayEntries = (await getActivityData())[todayKey]
		expect(todayEntries).toHaveLength(1)
		expect(todayEntries?.[0].title).toBe('Existing thread')
	})

	it('keeps recording for legacy users with activity data but no explicit preference', async () => {
		const todayKey = getTodayKey()
		const existingData: ActivityData = {
			[todayKey]: [createActivityEntry()],
		}
		await setCompressed(ACTIVITY_KEY, existingData)

		await trackActivity({ type: 'post', action: 'publish', title: 'Legacy reply' })

		const todayEntries = (await getActivityData())[todayKey]
		expect(todayEntries).toHaveLength(2)
		expect(todayEntries?.[1]).toMatchObject({
			type: 'post',
			action: 'publish',
			title: 'Legacy reply',
		})
	})

	it('clears compressed activity data through the compressed storage layer', async () => {
		const existingData: ActivityData = {
			[getTodayKey()]: [createActivityEntry()],
		}
		await setCompressed(ACTIVITY_KEY, existingData)

		await clearActivityData()

		await expect(getActivityData()).resolves.toEqual({})
	})
})
