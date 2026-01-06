/**
 * DraftGrid - Grid component for displaying drafts with selection support
 * Cards-only view with multi-select capabilities
 */
import { useMemo, useCallback } from 'react'
import { DraftCard } from './draft-card'
import type { Draft } from '@/features/drafts/storage'

// ============================================================================
// Types
// ============================================================================

export interface DraftGridProps {
	/** Drafts to display */
	drafts: Draft[]
	/** Set of selected draft IDs */
	selectedIds: Set<string>
	/** Callback when selection changes */
	onSelectionChange: (ids: Set<string>) => void
	/** Callback when editing a draft */
	onEdit: (draftId: string) => void
	/** Callback when duplicating a draft */
	onDuplicate: (draft: Draft) => void
	/** Callback when deleting a draft */
	onDelete: (draft: Draft) => void
	/** Callback when moving a draft to folder */
	onMove: (draft: Draft) => void
	/** Callback when converting draft to template or vice versa */
	onConvert?: (draft: Draft) => void
	/** Number of columns in grid view (default: 3) */
	columns?: number
	/** Last clicked draft ID for shift-select range */
	lastClickedId?: string | null
	/** Callback to update last clicked ID */
	onLastClickedChange?: (id: string | null) => void
}

// ============================================================================
// Component
// ============================================================================

export function DraftGrid({
	drafts,
	selectedIds,
	onSelectionChange,
	onEdit,
	onDuplicate,
	onDelete,
	onMove,
	onConvert,
	columns = 3,
	lastClickedId,
	onLastClickedChange,
}: DraftGridProps) {
	// Grid classes based on columns
	const gridClasses = useMemo(() => {
		switch (columns) {
			case 1:
				return 'grid grid-cols-1'
			case 2:
				return 'grid grid-cols-1 md:grid-cols-2'
			case 3:
				return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
			default:
				return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
		}
	}, [columns])

	// Handle card selection with shift-click support
	const handleSelect = useCallback(
		(draftId: string, event: React.MouseEvent) => {
			const newSelection = new Set(selectedIds)

			if (event.shiftKey && lastClickedId) {
				// Shift-click: select range
				const lastIndex = drafts.findIndex(d => d.id === lastClickedId)
				const currentIndex = drafts.findIndex(d => d.id === draftId)

				if (lastIndex !== -1 && currentIndex !== -1) {
					const start = Math.min(lastIndex, currentIndex)
					const end = Math.max(lastIndex, currentIndex)

					for (let i = start; i <= end; i++) {
						newSelection.add(drafts[i].id)
					}
				}
			} else if (event.ctrlKey || event.metaKey) {
				// Ctrl/Cmd-click: toggle individual
				if (newSelection.has(draftId)) {
					newSelection.delete(draftId)
				} else {
					newSelection.add(draftId)
				}
			} else {
				// Regular click on checkbox: toggle individual
				if (newSelection.has(draftId)) {
					newSelection.delete(draftId)
				} else {
					newSelection.add(draftId)
				}
			}

			onSelectionChange(newSelection)
			onLastClickedChange?.(draftId)
		},
		[selectedIds, lastClickedId, drafts, onSelectionChange, onLastClickedChange]
	)

	// Check if any items are selected
	const hasSelection = selectedIds.size > 0

	return (
		<div className={`${gridClasses} gap-4`}>
			{drafts.map(draft => (
				<DraftCard
					key={draft.id}
					draft={draft}
					isSelected={selectedIds.has(draft.id)}
					showCheckbox={hasSelection}
					onSelect={e => handleSelect(draft.id, e)}
					onEdit={() => onEdit(draft.id)}
					onDuplicate={() => onDuplicate(draft)}
					onDelete={() => onDelete(draft)}
					onMove={() => onMove(draft)}
					onConvert={onConvert ? () => onConvert(draft) : undefined}
				/>
			))}
		</div>
	)
}
