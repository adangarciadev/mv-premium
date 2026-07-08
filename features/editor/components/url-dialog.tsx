/**
 * URL Insert Dialog - Dialog for inserting URL with display text
 * Used in draft and macro editors
 */
import { useState, useEffect } from 'react'
import Link from 'lucide-react/dist/esm/icons/link'
import Type from 'lucide-react/dist/esm/icons/type'
import X from 'lucide-react/dist/esm/icons/x'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
			<DialogContent className="p-0 gap-0 overflow-hidden bg-card border-border rounded-xl sm:max-w-[420px]" showCloseButton={false}>
				<DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border p-4 px-5">
					<DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
						<div className="flex rounded-lg bg-primary/15 p-1.5">
							<Link className="h-4 w-4 text-primary" />
						</div>
						Insertar Enlace
					</DialogTitle>
					<button
						onClick={() => onOpenChange(false)}
						className="flex h-7 w-7 items-center justify-center rounded-md border-none bg-transparent text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X className="h-[18px] w-[18px]" />
					</button>
				</DialogHeader>

				<div className="space-y-4 p-5">
					<div className="space-y-1.5">
						<Label htmlFor="url-input" className="text-[13px] font-medium">
							URL
						</Label>
						<div className="relative">
							<Link className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="url-input"
								value={url}
								onChange={e => setUrl(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="https://ejemplo.com"
								autoFocus
								className="h-10 bg-muted/20 pl-9 focus-visible:bg-transparent"
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="display-text" className="text-[13px] font-medium">
							Texto a mostrar <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
						</Label>
						<div className="relative">
							<Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="display-text"
								value={displayText}
								onChange={e => setDisplayText(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Texto del enlace"
								className="h-10 bg-muted/20 pl-9 focus-visible:bg-transparent"
							/>
						</div>
						<p className="text-xs text-muted-foreground">Si se deja vacío, se mostrará la URL directamente</p>
					</div>
				</div>

				<DialogFooter className="flex justify-end gap-2 border-t border-border bg-muted/10 p-3 px-5">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="flex h-9 min-w-[104px] items-center justify-center rounded-md border border-border bg-transparent text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleInsert}
						disabled={!url.trim()}
						className={cn(
							'flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-md text-sm font-medium shadow-sm transition-colors',
							url.trim()
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
						)}
					>
						<Link className="h-3.5 w-3.5" />
						Insertar
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
