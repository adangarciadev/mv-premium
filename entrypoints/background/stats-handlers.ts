/**
 * Stats persistence handlers.
 *
 * Serializes rhythm/time chunks in the background context so multiple content
 * scripts cannot overwrite each other's storage read-modify-write.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { onMessage, type RhythmTimeChunkPayload, type RhythmTimeChunkResult } from '@/lib/messaging'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'
import {
	accumulateRhythm,
	createEmptyRhythm,
	normalizeRhythm,
	prepareRhythmStatsForStorage,
	type RhythmStats,
} from '@/features/stats/logic/rhythm-model'
import type { TimeStats } from '@/features/stats/logic/time-tracker'

const TIME_STATS_KEY = `local:${STORAGE_KEYS.TIME_STATS}` as `local:${string}`
const RHYTHM_KEY = `local:${STORAGE_KEYS.RHYTHM_STATS}` as `local:${string}`

const timeStatsStorage = storage.defineItem<TimeStats>(TIME_STATS_KEY, {
	defaultValue: {},
})

let writeQueue: Promise<void> = Promise.resolve()

function isValidChunk(payload: RhythmTimeChunkPayload): boolean {
	return (
		typeof payload.subforum === 'string' &&
		payload.subforum.trim().length > 0 &&
		Number.isFinite(payload.ms) &&
		payload.ms > 0 &&
		Number.isFinite(payload.at)
	)
}

async function persistRhythmTimeChunk(payload: RhythmTimeChunkPayload): Promise<RhythmTimeChunkResult> {
	if (!isValidChunk(payload)) {
		return { success: false, error: 'invalid-payload' }
	}

	try {
		const subforum = payload.subforum.trim()
		const currentStats = await timeStatsStorage.getValue()
		const nextStats: TimeStats = { ...currentStats }
		nextStats[subforum] = (Number(nextStats[subforum]) || 0) + payload.ms
		await timeStatsStorage.setValue(nextStats)

		const storedRhythm = await getCompressed<RhythmStats>(RHYTHM_KEY)
		const rhythm = normalizeRhythm(storedRhythm ?? createEmptyRhythm())
		const nextRhythm = accumulateRhythm(rhythm, payload.ms, new Date(payload.at), subforum)
		await setCompressed(RHYTHM_KEY, prepareRhythmStatsForStorage(nextRhythm))

		return { success: true }
	} catch (error) {
		logger.error('Failed to persist rhythm time chunk:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'unknown-error',
		}
	}
}

export function recordRhythmTimeChunkForTest(payload: RhythmTimeChunkPayload): Promise<RhythmTimeChunkResult> {
	const run = writeQueue.then(() => persistRhythmTimeChunk(payload))
	writeQueue = run.then(
		() => undefined,
		() => undefined
	)
	return run
}

export function setupStatsHandlers(): void {
	onMessage('recordRhythmTimeChunk', async ({ data }) => recordRhythmTimeChunkForTest(data))
}
