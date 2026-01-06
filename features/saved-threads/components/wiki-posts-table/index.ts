/**
 * Wiki Posts Table Module
 * Public exports for the refactored wiki posts table
 */

export { WikiPostsTable } from './wiki-posts-table'
export { useWikiPostsTable } from './use-wiki-posts-table'
export { useWikiPostsColumns } from './use-wiki-posts-columns'
export type { FlatPinnedPost, SubforumOption, PaginationInfo, DateFilter } from './types'
export { ITEMS_PER_PAGE, getSubforumInfo, formatRelativeTime, getPostUrl } from './utils'
