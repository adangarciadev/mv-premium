import { useState, useEffect, createElement } from 'react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'

interface NoteEditorDialogProps {
	username: string
	avatarUrl: string
	initialNote: string
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onSave: (note: string) => void
	onCancel: () => void
}

const MAX_NOTE_LENGTH = 160

export function NoteEditorDialog({
	username,
	avatarUrl,
	initialNote,
	isOpen,
	onOpenChange,
	onSave,
	onCancel,
}: NoteEditorDialogProps) {
	const [note, setNote] = useState(initialNote)
	const [isSaving, setIsSaving] = useState(false)

	// Reset state when opening
	useEffect(() => {
		if (isOpen) {
			setNote(initialNote)
			setIsSaving(false)
		}
	}, [isOpen, initialNote])

	const handleSave = () => {
		if (note.length > MAX_NOTE_LENGTH) return
		setIsSaving(true)
		// Small artificial delay for better UX (optional)
		setTimeout(() => {
			onSave(note.trim())
			setIsSaving(false)
		}, 100)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSave()
		}
	}

	const charsRemaining = MAX_NOTE_LENGTH - note.length
	const isOverLimit = charsRemaining < 0

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[425px] z-[99999]'>
				<DialogHeader>
					<div className='flex items-center gap-3 mb-2'>
						<Avatar className='h-10 w-10 border border-border'>
							<AvatarImage src={avatarUrl} alt={username} />
							<AvatarFallback>{username.substring(0, 2).toUpperCase()}</AvatarFallback>
						</Avatar>
						<div>
							<DialogTitle>Nota para {username}</DialogTitle>
							<DialogDescription>Añade una nota privada que solo tú podrás ver.</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<div className='grid gap-4 py-2'>
					<div className='grid gap-2'>
						<Label htmlFor='note' className='sr-only'>
							Nota
						</Label>
						<Textarea
							id='note'
							value={note}
							onChange={e => setNote(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder='Escribe algo sobre este usuario...'
							className={`h-24 resize-none ${isOverLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
							autoFocus
							maxLength={MAX_NOTE_LENGTH} // Hard limit
						/>
						<div className='flex justify-between items-center text-xs text-muted-foreground'>
							<span>Ctrl+Enter para guardar</span>
							<span className={isOverLimit ? 'text-destructive font-medium' : ''}>
								{note.length} / {MAX_NOTE_LENGTH}
							</span>
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant='outline' onClick={onCancel} disabled={isSaving}>
						Cancelar
					</Button>
					<Button onClick={handleSave} disabled={isOverLimit || isSaving}>
						{isSaving ? 'Guardando...' : 'Guardar'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

/**
 * Opens the NoteEditorDialog as a modal
 * Returns Promise<string | null> - the note on save, null on cancel
 */
export function openNoteDialog(username: string, currentNote: string, avatarUrl: string): Promise<string | null> {
	return new Promise(resolve => {
		const featureId = `note-editor-${Date.now()}`
		const container = document.createElement('div')
		document.body.appendChild(container)

		const cleanup = () => {
			unmountFeature(featureId)
			container.remove()
		}

		const handleClose = (shouldSave: boolean, value: string | null) => {
			update(false) // Trigger close animation
			setTimeout(() => {
				resolve(shouldSave ? value : null)
				cleanup()
			}, 300)
		}

		const update = (isOpen: boolean) => {
			mountFeatureWithBoundary(
				featureId,
				container,
				createElement(NoteEditorDialog, {
					username,
					avatarUrl,
					initialNote: currentNote,
					isOpen,
					onOpenChange: open => {
						if (!open) handleClose(false, null)
					},
					onSave: note => handleClose(true, note),
					onCancel: () => handleClose(false, null),
				}),
				'Editor de Nota'
			)
		}

		update(true)
	})
}
