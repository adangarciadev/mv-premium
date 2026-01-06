/**
 * Wiki Posts Table Types
 */

import type { PinnedPost } from '@/features/pinned-posts/logic/storage'

export interface FlatPinnedPost extends PinnedPost {
	threadId: string
	threadTitle: string
	subforum: string
}

export interface SubforumOption {
	id: string
	name: string
}

export interface PaginationInfo {
	start: number
	end: number
	total: number
}

export type DateFilter = 'all' | 'today' | 'week' | 'month'
