/**
 * DraftsSidebar - Sidebar component for folder navigation in drafts view
 */
import FolderPlus from 'lucide-react/dist/esm/icons/folder-plus'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AllDraftsDropTarget } from './all-drafts-drop-target'
import { FolderItem, type FolderWithCount } from './folder-item'

// ============================================================================
// Types
// ============================================================================

export interface DraftsSidebarProps {
	/** List of folders with counts filtered by type */
	folders: FolderWithCount[]
	/** Currently selected folder ID (null = "All") */
	selectedFolder: string | null
	/** Callback when a folder is selected */
	onFolderSelect: (folderId: string | null) => void
	/** Callback when a draft is dropped on the "All" section */
	onDropToAll: (draftId: string) => void
	/** Callback when a draft is dropped on a folder */
	onDropToFolder: (draftId: string, folderId: string) => void
	/** Callback to open create folder dialog */
	onCreateFolderClick: () => void
	/** Callback when folder delete is requested */
	onFolderDelete: (folder: FolderWithCount) => void
	/** Total count of items (filtered by type) */
	totalCount: number
	/** Whether viewing templates (true) or drafts (false) */
	isTemplate?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function DraftsSidebar({
	folders,
	selectedFolder,
	onFolderSelect,
	onDropToAll,
	onDropToFolder,
	onCreateFolderClick,
	onFolderDelete,
	totalCount,
	isTemplate = false,
}: DraftsSidebarProps) {
	return (
		<aside className="w-full lg:w-64 shrink-0">
			<div className="sticky top-0 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Carpetas</h2>
					<Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCreateFolderClick}>
						<FolderPlus className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-1">
					{/* All drafts - also a drop target to remove from folder */}
					<AllDraftsDropTarget
						isSelected={selectedFolder === null}
						draftsCount={totalCount}
						onClick={() => onFolderSelect(null)}
						onDrop={onDropToAll}
						isTemplate={isTemplate}
					/>

					<Separator className="my-2" />

					{/* Folders */}
					{folders.length > 0 ? (
						folders.map(folder => (
							<FolderItem
								key={folder.id}
								folder={folder}
								isSelected={selectedFolder === folder.id}
								onClick={() => onFolderSelect(folder.id)}
								onDrop={draftId => onDropToFolder(draftId, folder.id)}
								onDelete={() => onFolderDelete(folder)}
							/>
						))
					) : (
						<div className="px-2 py-8 text-center">
							<p className="text-xs text-muted-foreground/60 italic">Sin carpetas</p>
						</div>
					)}
				</div>
			</div>
		</aside>
	)
}
