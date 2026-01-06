/**
 * Editor Storage
 *
 * Storage definitions for editor-related features.
 * Uses @wxt-dev/storage (unified API)
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

// ============================================================================
// TYPES
// ============================================================================

export interface EditorPreservedContent {
	content: string
	timestamp: number
}

// ============================================================================
// STORAGE ITEM DEFINITIONS
// ============================================================================

/**
 * Editor content preservation storage
 * Used to preserve textarea content when switching from quick reply to extended editor
 *
 * Key: 'local:mvp-editor-preserve' (same as legacy 'editor-content-preserve')
 * @returns Storage item of type EditorPreservedContent
 */
export const editorPreserveStorage = storage.defineItem<EditorPreservedContent | null>(
	`local:${STORAGE_KEYS.EDITOR_PRESERVE}`,
	{ defaultValue: null }
)

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum age for restored content in milliseconds (30 seconds) */
export const MAX_RESTORE_AGE_MS = 30000
