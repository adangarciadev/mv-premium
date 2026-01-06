/**
 * Saved Threads Table Utilities
 */

import { ALL_SUBFORUMS } from '@/lib/subforums'
import type { SubforumInfo } from './types'

export const ITEMS_PER_PAGE = 30

export function getSubforumInfo(subforumPath: string): SubforumInfo {
	const slug = subforumPath.replace('/foro/', '')
	const subforum = ALL_SUBFORUMS.find(s => s.slug === slug)
	return {
		id: subforumPath,
		slug,
		name: subforum?.name || slug || subforumPath,
		iconId: subforum?.iconId || 4,
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
	if (days < 30) return `${days}d`

	const date = new Date(timestamp)
	const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
	return `${monthNames[date.getMonth()]} '${String(date.getFullYear()).slice(2)}`
}
