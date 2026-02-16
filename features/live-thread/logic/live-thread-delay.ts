/**
 * Live Thread Delay Manager
 *
 * Queues incoming posts before rendering them in the custom Live Thread mode.
 * Delay affects only NEW incoming posts and preserves natural post ordering.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import type { PostInfo } from './live-thread-state'

const MAX_QUEUE_SIZE = 100

export const LIVE_THREAD_DELAY_OPTIONS = [
	{ value: 0, label: 'Sin delay', shortLabel: 'Real-time' },
	{ value: 15000, label: '15 segundos', shortLabel: '15s' },
	{ value: 30000, label: '30 segundos', shortLabel: '30s' },
	{ value: 45000, label: '45 segundos', shortLabel: '45s' },
	{ value: 60000, label: '1 minuto', shortLabel: '1m' },
	{ value: 75000, label: '1m 15s', shortLabel: '1m 15s' },
	{ value: 90000, label: '1m 30s', shortLabel: '1m 30s' },
	{ value: 105000, label: '1m 45s', shortLabel: '1m 45s' },
	{ value: 120000, label: '2 minutos', shortLabel: '2m' },
] as const

interface QueuedPost {
	post: PostInfo
	pageNum: number
	revealAt: number
	timeoutId: ReturnType<typeof setTimeout>
}

type RevealPostCallback = (post: PostInfo, pageNum: number) => void
type QueueSizeCallback = (size: number) => void

const liveThreadDelayStorage = storage.defineItem<number>(`local:${STORAGE_KEYS.LIVE_THREAD_DELAY}`, {
	defaultValue: 0,
})

let isEnabled = false
let currentDelay = 0
let pendingPosts: Map<number, QueuedPost> = new Map()
let revealPostCallback: RevealPostCallback | null = null
let queueSizeCallback: QueueSizeCallback | null = null

function notifyQueueSizeChange(): void {
	queueSizeCallback?.(pendingPosts.size)
}

function revealPost(postNum: number): void {
	const queued = pendingPosts.get(postNum)
	if (!queued) return

	clearTimeout(queued.timeoutId)
	pendingPosts.delete(postNum)
	revealPostCallback?.(queued.post, queued.pageNum)
}

function flushDuePosts(): void {
	const now = Date.now()
	const duePostNums = Array.from(pendingPosts.entries())
		.filter(([, queued]) => queued.revealAt <= now)
		.map(([postNum]) => postNum)
		.sort((a, b) => a - b)

	if (duePostNums.length === 0) return

	for (const postNum of duePostNums) {
		revealPost(postNum)
	}

	notifyQueueSizeChange()
}

function revealOldestQueuedPost(): void {
	let oldestPostNum: number | null = null
	let oldestRevealAt = Infinity

	for (const [postNum, queued] of pendingPosts.entries()) {
		if (queued.revealAt < oldestRevealAt || (queued.revealAt === oldestRevealAt && postNum < (oldestPostNum ?? Infinity))) {
			oldestRevealAt = queued.revealAt
			oldestPostNum = postNum
		}
	}

	if (oldestPostNum === null) return

	revealPost(oldestPostNum)
	notifyQueueSizeChange()
	logger.debug(`[LiveThreadDelay] Queue limit reached, revealing oldest queued post #${oldestPostNum}`)
}

export async function loadLiveThreadDelayPreference(): Promise<number> {
	currentDelay = await liveThreadDelayStorage.getValue()
	return currentDelay
}

export async function setLiveThreadDelay(delayMs: number): Promise<void> {
	currentDelay = delayMs
	await liveThreadDelayStorage.setValue(delayMs)
	logger.info(`[LiveThreadDelay] Delay updated to ${delayMs}ms`)
}

export function getLiveThreadDelay(): number {
	return currentDelay
}

export function setLiveThreadDelayEnabled(enabled: boolean): void {
	isEnabled = enabled
}

export function getLiveThreadDelayEnabled(): boolean {
	return isEnabled
}

export function setLiveThreadDelayRevealCallback(callback: RevealPostCallback | null): void {
	revealPostCallback = callback
}

export function onLiveThreadDelayQueueSizeChange(callback: QueueSizeCallback | null): void {
	queueSizeCallback = callback
	notifyQueueSizeChange()
}

/**
 * Queue post for delayed rendering. Returns true if queued, false if should render immediately.
 */
export function enqueueLiveThreadPost(post: PostInfo, pageNum: number): boolean {
	if (!isEnabled || currentDelay === 0) {
		return false
	}

	if (pendingPosts.has(post.num)) {
		return true
	}

	if (pendingPosts.size >= MAX_QUEUE_SIZE) {
		revealOldestQueuedPost()
	}

	const revealAt = Date.now() + currentDelay
	const timeoutId = setTimeout(() => {
		flushDuePosts()
	}, currentDelay)

	pendingPosts.set(post.num, {
		post,
		pageNum,
		revealAt,
		timeoutId,
	})

	notifyQueueSizeChange()
	return true
}

export function getLiveThreadDelayQueueSize(): number {
	return pendingPosts.size
}

export function clearLiveThreadDelayQueue(options: { reveal: boolean } = { reveal: false }): void {
	const queuedEntries = Array.from(pendingPosts.entries()).sort((a, b) => a[0] - b[0])

	for (const [, queued] of queuedEntries) {
		clearTimeout(queued.timeoutId)
	}

	pendingPosts.clear()
	notifyQueueSizeChange()

	if (!options.reveal) return

	for (const [, queued] of queuedEntries) {
		revealPostCallback?.(queued.post, queued.pageNum)
	}
}

export function resetLiveThreadDelayRuntime(): void {
	clearLiveThreadDelayQueue({ reveal: false })
	queueSizeCallback = null
	revealPostCallback = null
	isEnabled = false
}
