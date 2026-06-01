export const FILTER_TABS = ['threads', 'words', 'users', 'hidden-threads', 'hidden-subforums'] as const

export type FilterTab = (typeof FILTER_TABS)[number]

export function normalizeFilterTab(value: string | null): FilterTab {
	return FILTER_TABS.includes(value as FilterTab) ? (value as FilterTab) : 'threads'
}
