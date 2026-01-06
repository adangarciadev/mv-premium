/**
 * Drafts Feature - Draft management components
 *
 * BUNDLE OPTIMIZATION:
 * This barrel only exports what's needed for the CONTENT SCRIPT.
 * Heavy components (DraftGrid, DataTable, etc.) and hooks that use
 * react-router-dom are NOT exported here to avoid bloating main.js.
 *
 * For options page/dashboard, import directly from the component files:
 * - import { DraftGrid } from '@/features/drafts/components/draft-grid'
 * - import { useDraftsActions } from '@/features/drafts/hooks/use-drafts-actions'
 */

// Components needed in Content Script
export { DraftsList } from './components/drafts-list'
export { DraftManager } from './components/draft-manager'
export { DraftStatus } from './components/draft-status'
export { DraftCard, type DraftCardProps } from './components/draft-card'

// TYPES ONLY - these don't import the actual modules
export type { FolderItemProps, FolderWithCount } from './components/folder-item'
export type { DraftsEmptyStateProps } from './components/drafts-empty-state'
export type { AllDraftsDropTargetProps } from './components/all-drafts-drop-target'
export type { DraftsSidebarProps } from './components/drafts-sidebar'
export type { DraftsToolbarProps, SortOrder } from './components/drafts-toolbar'
export type { DraftGridProps } from './components/draft-grid'

// Hooks - ONLY lightweight ones needed in content script
// Heavy hooks (useDraftsActions, useDraftsFiltering, etc.) use react-router-dom
// and should be imported directly in options page code
export {
	useSlashCommand,
	type UseSlashCommandOptions,
	type UseSlashCommandReturn,
	type TemplateInsertData,
} from './hooks/use-slash-command'

// Injection logic
export { injectSaveDraftButton, cleanupSaveDraftButton } from './logic/save-draft-button-inject'
