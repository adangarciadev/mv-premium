/**
 * Saved Threads Table Types
 */

export type DateFilter = 'all' | 'today' | 'week' | 'month'

export interface SubforumInfo {
	id: string
	slug: string
	name: string
	iconId: number
}

export interface PaginationInfo {
	start: number
	end: number
	total: number
}
