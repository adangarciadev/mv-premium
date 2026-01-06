import { useState } from 'react'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import { MovieTemplateDialog } from './movie-template-dialog'
import { Button } from '@/components/ui/button'

interface MovieTemplateButtonProps {
	textarea: HTMLTextAreaElement
}

/**
 * MovieTemplateButton component - A toolbar button that triggers the MovieTemplateDialog.
 * Interfaces with the textarea to insert generated BBCode templates.
 */
export function MovieTemplateButton({ textarea }: MovieTemplateButtonProps) {
	const [isOpen, setIsOpen] = useState(false)

	const handleInsert = (template: string) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const before = textarea.value.substring(0, start)
		const after = textarea.value.substring(end)

		textarea.value = before + template + after

		const newPosition = start + template.length
		textarea.selectionStart = newPosition
		textarea.selectionEnd = newPosition

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.focus()
	}

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="text-muted-foreground hover:text-foreground"
				title="Generar plantilla de película"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					setIsOpen(true)
				}}
			>
				<Clapperboard className="h-4 w-4" />
			</Button>

			<MovieTemplateDialog isOpen={isOpen} onClose={() => setIsOpen(false)} onInsert={handleInsert} />
		</>
	)
}
