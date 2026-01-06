/**
 * CreateFolderDialog - Shared dialog for creating draft folders
 * Used in both DraftsView and DraftEditorView
 */
import { useState } from 'react'
import FolderPlus from 'lucide-react/dist/esm/icons/folder-plus'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const MAX_FOLDER_NAME_LENGTH = 24

interface CreateFolderDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreate: (name: string, icon: string, type: 'draft' | 'template') => void
	/** Type of folder to create */
	folderType?: 'draft' | 'template'
}

export function CreateFolderDialog({ open, onOpenChange, onCreate, folderType = 'draft' }: CreateFolderDialogProps) {
	const [name, setName] = useState('')
	// Fixed icon - no longer customizable per user request
	const icon = 'lucide:folder'

	const handleCreate = () => {
		if (name.trim()) {
			onCreate(name.trim(), icon, folderType)
			setName('')
			onOpenChange(false)
		}
	}

	// Reset state when dialog closes
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setName('')
		}
		onOpenChange(newOpen)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderPlus className="h-5 w-5" />
						Nueva Carpeta
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<Label>Nombre de la carpeta</Label>
							<span
								className={cn(
									'text-xs tabular-nums',
									name.length >= 20 ? 'text-orange-500' : 'text-muted-foreground',
									name.length >= MAX_FOLDER_NAME_LENGTH && 'text-destructive'
								)}
							>
								{name.length}/{MAX_FOLDER_NAME_LENGTH}
							</span>
						</div>
						<Input
							value={name}
							onChange={e => setName(e.target.value.slice(0, MAX_FOLDER_NAME_LENGTH))}
							maxLength={MAX_FOLDER_NAME_LENGTH}
							placeholder="Mi carpeta..."
							autoFocus
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancelar
					</Button>
					<Button onClick={handleCreate} disabled={!name.trim()}>
						<FolderPlus className="h-4 w-4 mr-2" />
						Crear Carpeta
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
