/**
 * URL Insert Dialog - Dialog for inserting URL with display text
 * Used in draft and macro editors
 */
import { useState, useEffect } from 'react'
import Link from 'lucide-react/dist/esm/icons/link'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UrlDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onInsert: (url: string, displayText: string) => void
	/** Pre-filled display text (e.g., from selection) */
	initialDisplayText?: string
}

export function UrlDialog({ open, onOpenChange, onInsert, initialDisplayText = '' }: UrlDialogProps) {
	const [url, setUrl] = useState('')
	const [displayText, setDisplayText] = useState('')

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setUrl('')
			setDisplayText(initialDisplayText)
		}
	}, [open, initialDisplayText])

	const handleInsert = () => {
		if (!url.trim()) return
		onInsert(url.trim(), displayText.trim())
		onOpenChange(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && url.trim()) {
			e.preventDefault()
			handleInsert()
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Link className="h-5 w-5" />
						Insertar Enlace
					</DialogTitle>
					<DialogDescription>Introduce la URL y el texto que se mostrará</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="url-input">URL</Label>
						<Input
							id="url-input"
							value={url}
							onChange={e => setUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="https://ejemplo.com"
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="display-text">
							Texto a mostrar <span className="text-muted-foreground text-xs">(opcional)</span>
						</Label>
						<Input
							id="display-text"
							value={displayText}
							onChange={e => setDisplayText(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Texto del enlace"
						/>
						<p className="text-xs text-muted-foreground">Si se deja vacío, se mostrará la URL directamente</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button onClick={handleInsert} disabled={!url.trim()}>
						<Link className="h-4 w-4 mr-2" />
						Insertar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
