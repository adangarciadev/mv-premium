/**
 * Wiki Posts Table Utilities
 */

import { ALL_SUBFORUMS } from '@/lib/subforums'

export const ITEMS_PER_PAGE = 30

export function getSubforumInfo(subforum: string) {
	const subforumData = ALL_SUBFORUMS.find(s => s.slug === subforum)
	return {
		slug: subforum,
		name: subforumData?.name || subforum,
		iconId: subforumData?.iconId || 4,
	}
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp

	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 60) return `${minutes}m`
	if (hours < 24) return `${hours}h`
	return `${days}d`
}

export function getPostUrl(threadId: string, pageNum: number, postNum: number): string {
	return `${threadId}/${pageNum}#${postNum}`
}
