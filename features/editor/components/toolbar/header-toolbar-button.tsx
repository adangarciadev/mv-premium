/**
 * Header Toolbar Button - Dropdown for inserting headers/titles
 * Uses Shadcn DropdownMenu with Lucide icons (same as dashboard)
 */
import Heading1 from 'lucide-react/dist/esm/icons/heading-1'
import Heading2 from 'lucide-react/dist/esm/icons/heading-2'
import Heading3 from 'lucide-react/dist/esm/icons/heading-3'
import Heading from 'lucide-react/dist/esm/icons/heading'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

// Same as dashboard HEADER_TYPES from components/editor/toolbar/constants.ts
const HEADER_OPTIONS = [
	{ id: 'h1', label: 'Título 1', icon: Heading1, prefix: '# ', description: 'Título principal' },
	{ id: 'h2', label: 'Título 2', icon: Heading2, prefix: '## ', description: 'Subtítulo' },
	{ id: 'h3', label: 'Título 3', icon: Heading3, prefix: '### ', description: 'Sección' },
	{
		id: 'bar',
		label: 'Barra destacada',
		icon: Heading,
		prefix: '[bar]',
		suffix: '[/bar]',
		description: 'Encabezado con línea',
	},
]

interface HeaderToolbarButtonProps {
	onInsertHeader: (prefix: string, suffix?: string) => void
}

/**
 * HeaderToolbarButton component - Dropdown for inserting various header levels and bars.
 * Employs a Shadcn DropdownMenu for a modern selection interface.
 */
export function HeaderToolbarButton({ onInsertHeader }: HeaderToolbarButtonProps) {
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
					title="Insertar encabezado"
					onClick={handleTriggerClick}
					onPointerDown={e => e.stopPropagation()}
				>
					<i className="fa fa-header" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-52">
				<DropdownMenuLabel>Encabezados</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{HEADER_OPTIONS.map(header => (
					<DropdownMenuItem
						key={header.id}
						onClick={() => onInsertHeader(header.prefix, header.suffix)}
						className="gap-2"
					>
						<header.icon className="h-4 w-4" />
						<div className="flex flex-col">
							<span>{header.label}</span>
							<span className="text-xs text-muted-foreground">{header.description}</span>
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
