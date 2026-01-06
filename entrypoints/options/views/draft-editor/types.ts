/**
 * Draft Editor Types
 * Shared types and schema for the draft editor view
 */

import { z } from 'zod'
import type { UseFormReturn } from 'react-hook-form'
import type { DraftFolder } from '@/features/drafts/storage'
import type { DialogType, DialogData, UseDialogManagerReturn } from '@/hooks/use-dialog-manager'

// ============================================================================
// Form Schema
// ============================================================================

export const draftFormSchema = z.object({
	title: z.string().max(72, 'Máximo 72 caracteres'),
	trigger: z
		.string()
		.max(16, 'Máximo 16 caracteres')
		.regex(/^[a-z0-9-]*$/, 'Solo letras minúsculas, números y guiones'),
	content: z.string(),
	subforum: z.string(),
	category: z.string(),
	folderId: z.string(),
})

export type DraftFormData = z.infer<typeof draftFormSchema>

// ============================================================================
// Component Props
// ============================================================================

export interface DraftEditorViewProps {
	docType?: 'draft' | 'template'
}

export interface EditorHeaderProps {
	docType: 'draft' | 'template'
	isEditing: boolean
	form: UseFormReturn<DraftFormData>
	folders: DraftFolder[]
	onOpenFolderDialog: () => void
}

export interface EditorFooterProps {
	content: string
	lastSavedAt: Date | null
	isDirty: boolean
	onClear: () => void
}

export interface PreviewPanelProps {
	content: string
	boldColor: string
	theme?: 'light' | 'dark'
	showPreview: boolean
	previewRef: React.RefObject<HTMLDivElement | null>
}

// ============================================================================
// Hook Options
// ============================================================================

export interface UseDraftEditorOptions {
	docType: 'draft' | 'template'
	form: UseFormReturn<DraftFormData>
}

export interface UseEditorHandlersOptions {
	form: UseFormReturn<DraftFormData>
	textareaRef: React.RefObject<HTMLTextAreaElement | null>
	previewRef: React.RefObject<HTMLDivElement | null>
	editor: {
		insertAtCursor: (text: string) => void
		wrapSelection: (prefix: string, suffix: string) => void
		executeAction: (actionId: string) => void
		getSelection: () => { text: string; start: number; end: number }
		replaceSelection: (text: string) => void
	}
	dialogs: {
		open: (type: Exclude<DialogType, null>, data?: DialogData) => void
		close: () => void
	}
	checkActiveFormats: () => void
}

// Re-export dialog types for convenience
export type { DialogType, DialogData, UseDialogManagerReturn }
