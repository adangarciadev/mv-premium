/**
 * Drafts Dialogs
 * Dialog components used in the drafts view
 */

import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Folder from 'lucide-react/dist/esm/icons/folder'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { FolderWithCount } from '@/features/drafts/components/folder-item'

// ============================================================================
// Delete Draft Dialog
// ============================================================================

interface DeleteDraftDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	draftTitle: string
	onConfirm: () => void
}

export function DeleteDraftDialog({ open, onOpenChange, draftTitle, onConfirm }: DeleteDraftDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Eliminar borrador
					</DialogTitle>
					<DialogDescription>
						¿Estás seguro de que quieres eliminar "{draftTitle}"? Esta acción no se puede deshacer.
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						<Trash2 className="h-4 w-4 mr-2" />
						Eliminar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ============================================================================
// Move Draft Dialog
// ============================================================================

interface MoveDraftDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	folders: FolderWithCount[]
	currentFolderId?: string
	onMove: (folderId: string | undefined) => void
}

export function MoveDraftDialog({ open, onOpenChange, folders, currentFolderId, onMove }: MoveDraftDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderOpen className="h-5 w-5" />
						Mover a carpeta
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-2 py-4">
					<button
						type="button"
						onClick={() => {
							onMove(undefined)
							onOpenChange(false)
						}}
						className={cn(
							'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-muted/50',
							!currentFolderId && 'bg-primary/10 text-primary'
						)}
					>
						<FileText className="h-4 w-4" />
						<span className="text-sm">Sin carpeta</span>
					</button>

					<Separator />

					{folders.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-2">No hay carpetas creadas</p>
					)}

					{folders.map(folder => (
						<button
							type="button"
							key={folder.id}
							onClick={() => {
								onMove(folder.id)
								onOpenChange(false)
							}}
							className={cn(
								'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-muted/50',
								currentFolderId === folder.id && 'bg-primary/10 text-primary'
							)}
						>
							<Folder className="h-5 w-5" />
							<span className="flex-1 text-sm">{folder.name}</span>
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	)
}

// ============================================================================
// Delete Folder Dialog
// ============================================================================

interface DeleteFolderDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	folder: FolderWithCount | null
	onConfirm: () => void
}

export function DeleteFolderDialog({ open, onOpenChange, folder, onConfirm }: DeleteFolderDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Eliminar carpeta
					</DialogTitle>
					<DialogDescription>
						¿Estás seguro de que quieres eliminar la carpeta "{folder?.name}"?
						{folder && folder.count > 0 && (
							<span className="block mt-2 text-muted-foreground">
								Los {folder.count} borradores de esta carpeta se moverán a "Sin carpeta".
							</span>
						)}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						<Trash2 className="h-4 w-4 mr-2" />
						Eliminar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
