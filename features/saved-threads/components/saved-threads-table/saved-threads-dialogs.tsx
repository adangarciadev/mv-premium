/**
 * Saved Threads Dialogs
 * Note editor and delete confirmation dialogs
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

interface NoteEditorDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	note: string
	onNoteChange: (note: string) => void
	onSave: () => void
}

export function NoteEditorDialog({ open, onOpenChange, note, onNoteChange, onSave }: NoteEditorDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="bg-card text-card-foreground border-border shadow-2xl">
				<AlertDialogHeader>
					<AlertDialogTitle>Editar nota</AlertDialogTitle>
					<AlertDialogDescription className="text-muted-foreground">
						Añade una nota personal para este hilo (formato texto plano).
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="py-2">
					<Textarea
						value={note}
						onChange={e => onNoteChange(e.target.value)}
						placeholder="Escribe tu nota aquí..."
						className="min-h-[100px] bg-secondary/50 border-border/50 focus:border-primary/50"
						maxLength={160}
					/>
					<div className="text-right text-xs text-muted-foreground mt-1">{note.length}/160 caracteres</div>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel className="bg-transparent border-border hover:bg-white/5">Cancelar</AlertDialogCancel>
					<AlertDialogAction
						onClick={onSave}
						className="bg-[#ff5912] hover:bg-[#ff5912]/90 text-white font-medium"
					>
						Guardar Nota
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

interface DeleteConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	selectedCount: number
	onConfirm: () => void
}

export function DeleteConfirmDialog({ open, onOpenChange, selectedCount, onConfirm }: DeleteConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="bg-card text-card-foreground border-border shadow-2xl">
				<AlertDialogHeader>
					<AlertDialogTitle>¿Eliminar hilos seleccionados?</AlertDialogTitle>
					<AlertDialogDescription className="text-muted-foreground">
						Vas a eliminar **{selectedCount}** hilos de tu lista de guardados. Esta acción no se puede deshacer.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="bg-transparent border-border hover:bg-white/5">Cancelar</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
					>
						Eliminar permanentemente
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
