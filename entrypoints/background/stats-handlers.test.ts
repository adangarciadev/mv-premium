import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import type { RhythmTimeChunkPayload, RhythmTimeChunkResult } from '@/lib/messaging'
import { getCompressed } from '@/lib/storage/compressed-storage'
import {
	getDayKey,
	getWeekKey,
	type RhythmStats,
} from '@/features/stats/logic/rhythm-model'
import type { TimeStats } from '@/features/stats/logic/time-tracker'
import { MAX_RHYTHM_CHUNK_MS } from '@/features/stats/logic/rhythm-time-constants'
import { mockBrowser } from '../../tests/setup'

const mockOnMessage = vi.hoisted(() => vi.fn())
const mockSendMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	onMessage: mockOnMessage,
	sendMessage: mockSendMessage,
}))

import { setupStatsHandlers } from './stats-handlers'

type RecordRhythmHandler = (message: { data: RhythmTimeChunkPayload }) => Promise<RhythmTimeChunkResult>

const TIME_STATS_KEY = `local:${STORAGE_KEYS.TIME_STATS}` as `local:${string}`
const RHYTHM_KEY = `local:${STORAGE_KEYS.RHYTHM_STATS}` as `local:${string}`

describe('setupStatsHandlers', () => {
	const handlers = new Map<string, RecordRhythmHandler>()

	beforeEach(() => {
		handlers.clear()
		mockOnMessage.mockReset()
		mockOnMessage.mockImplementation((name: string, handler: RecordRhythmHandler) => {
			handlers.set(name, handler)
		})
		mockBrowser.storage.local._setStore({})
		mockBrowser.storage.sync._setStore({})
	})

	it('registers the rhythm chunk persistence handler', () => {
		setupStatsHandlers()

		expect(handlers.has('recordRhythmTimeChunk')).toBe(true)
	})

	it('persists concurrent chunks without dropping one write', async () => {
		const at = new Date(2026, 0, 5, 10, 15).getTime()
		vi.useFakeTimers()
		vi.setSystemTime(at)
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')
		expect(handler).toBeTruthy()

		await Promise.all([
			handler?.({ data: { subforum: 'off-topic', ms: 1000, at } }),
			handler?.({ data: { subforum: 'off-topic', ms: 2000, at } }),
		])

		const timeStats = await storage.getItem<TimeStats>(TIME_STATS_KEY)
		const rhythm = await getCompressed<RhythmStats>(RHYTHM_KEY)

		expect(timeStats?.['off-topic']).toBe(3000)
		expect(rhythm?.hours[10]).toBe(3000)
		expect(rhythm?.hourSubforums['10']['off-topic']).toBe(3000)
	})

	it('rejects invalid payloads without writing storage', async () => {
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')
		expect(handler).toBeTruthy()

		const result = await handler?.({ data: { subforum: '', ms: 1000, at: Date.now() } })

		expect(result).toEqual({ success: false, error: 'invalid-payload' })
		await expect(storage.getItem(TIME_STATS_KEY)).resolves.toBeNull()
		await expect(getCompressed<RhythmStats>(RHYTHM_KEY)).resolves.toBeNull()
	})

	it('rejects chunks larger than the max without writing storage', async () => {
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')

		const result = await handler?.({
			data: { subforum: 'off-topic', ms: MAX_RHYTHM_CHUNK_MS + 1, at: Date.now() },
		})

		expect(result).toEqual({ success: false, error: 'invalid-payload' })
		await expect(storage.getItem(TIME_STATS_KEY)).resolves.toBeNull()
		await expect(getCompressed<RhythmStats>(RHYTHM_KEY)).resolves.toBeNull()
	})

	it('rejects timestamps too far in the future without writing storage', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 0, 7, 12, 0))
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')

		// 6 minutes ahead, beyond the 5 minute skew allowance.
		const result = await handler?.({
			data: { subforum: 'off-topic', ms: 1000, at: Date.now() + 6 * 60_000 },
		})

		expect(result).toEqual({ success: false, error: 'invalid-payload' })
		await expect(storage.getItem(TIME_STATS_KEY)).resolves.toBeNull()
		await expect(getCompressed<RhythmStats>(RHYTHM_KEY)).resolves.toBeNull()
	})

	it('rejects timestamps older than the past-age limit without writing storage', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 0, 7, 12, 0))
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')

		// 25 hours old, beyond the 24 hour past-age limit.
		const result = await handler?.({
			data: { subforum: 'off-topic', ms: 1000, at: Date.now() - 25 * 60 * 60_000 },
		})

		expect(result).toEqual({ success: false, error: 'invalid-payload' })
		await expect(storage.getItem(TIME_STATS_KEY)).resolves.toBeNull()
		await expect(getCompressed<RhythmStats>(RHYTHM_KEY)).resolves.toBeNull()
	})

	it('accepts a chunk exactly at the max with a current timestamp', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date(2026, 0, 7, 12, 0))
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')

		const result = await handler?.({
			data: { subforum: 'off-topic', ms: MAX_RHYTHM_CHUNK_MS, at: Date.now() },
		})

		const timeStats = await storage.getItem<TimeStats>(TIME_STATS_KEY)
		expect(result).toEqual({ success: true })
		expect(timeStats?.['off-topic']).toBe(MAX_RHYTHM_CHUNK_MS)
	})

	it('writes the expected hour, weekday, week, day and subforum buckets', async () => {
		const date = new Date(2026, 0, 7, 22, 30)
		vi.useFakeTimers()
		vi.setSystemTime(date)
		setupStatsHandlers()
		const handler = handlers.get('recordRhythmTimeChunk')
		expect(handler).toBeTruthy()

		const result = await handler?.({ data: { subforum: 'cine', ms: 4000, at: date.getTime() } })
		const rhythm = await getCompressed<RhythmStats>(RHYTHM_KEY)

		expect(result).toEqual({ success: true })
		expect(rhythm?.hours[22]).toBe(4000)
		expect(rhythm?.weekdays[date.getDay()]).toBe(4000)
		expect(rhythm?.weeks[getWeekKey(date)]).toBe(4000)
		expect(rhythm?.days[getDayKey(date)]).toBe(4000)
		expect(rhythm?.hourSubforums['22'].cine).toBe(4000)
		expect(rhythm?.weekdaySubforums[String(date.getDay())].cine).toBe(4000)
		expect(rhythm?.daySubforums[getDayKey(date)].cine).toBe(4000)
	})
})
