/**
 * Snippet Toolbar Button - Dropdown for inserting predefined templates
 * Uses Shadcn DropdownMenu with same snippets as dashboard
 */
import Table from 'lucide-react/dist/esm/icons/table'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Terminal from 'lucide-react/dist/esm/icons/terminal'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ImageIcon from 'lucide-react/dist/esm/icons/image'
import Quote from 'lucide-react/dist/esm/icons/quote'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import type { LucideIcon } from 'lucide-react'

// Same as DEFAULT_SNIPPETS from types/editor.ts
const SNIPPETS: Array<{
	id: string
	label: string
	description: string
	icon: LucideIcon
	template: string
}> = [
	{
		id: 'table-3x3',
		label: 'Tabla 3x3',
		description: 'Tabla Markdown de 3 columnas',
		icon: Table,
		template: `| Cabecera 1 | Cabecera 2 | Cabecera 3 |
|:---|:---|:---|
|  |  |  |
|  |  |  |
|  |  |  |`,
	},
	{
		id: 'thread-template',
		label: 'Plantilla de Hilo',
		description: 'Estructura básica para nuevo hilo',
		icon: FileText,
		template: `[bar]Introducción[/bar]


[bar]Desarrollo[/bar]


[bar]Conclusión[/bar]

`,
	},
	{
		id: 'code-block',
		label: 'Bloque de Código',
		description: 'Código con lenguaje',
		icon: Terminal,
		template: `[code=javascript]

[/code]`,
	},
	{
		id: 'spoiler-block',
		label: 'Spoiler con Título',
		description: 'Contenido oculto con título',
		icon: EyeOff,
		template: `[spoiler=Título]

[/spoiler]`,
	},
	{
		id: 'image-centered',
		label: 'Imagen Centrada',
		description: 'Imagen con centrado',
		icon: ImageIcon,
		template: `[center][img][/img][/center]`,
	},
	{
		id: 'quote-author',
		label: 'Cita con Autor',
		description: 'Cita atribuida',
		icon: Quote,
		template: `[quote=Autor]

[/quote]`,
	},
]

interface SnippetToolbarButtonProps {
	onInsertSnippet: (template: string) => void
}

/**
 * SnippetToolbarButton component - Dropdown providing access to commonly used BBCode templates and structures.
 */
export function SnippetToolbarButton({ onInsertSnippet }: SnippetToolbarButtonProps) {
	const handleTriggerClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="mvp-toolbar-btn"
					title="Insertar plantilla"
					onClick={handleTriggerClick}
					onPointerDown={e => e.stopPropagation()}
				>
					<i className="fa fa-magic" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuLabel>Insertar Plantilla</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{SNIPPETS.map(snippet => (
					<DropdownMenuItem key={snippet.id} onClick={() => onInsertSnippet(snippet.template)} className="gap-2">
						<snippet.icon className="h-4 w-4 text-muted-foreground" />
						<div className="flex flex-col">
							<span>{snippet.label}</span>
							<span className="text-xs text-muted-foreground">{snippet.description}</span>
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
