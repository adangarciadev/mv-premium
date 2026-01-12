import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CODE_LANGUAGES } from '@/components/editor/toolbar'
import FileCode from 'lucide-react/dist/esm/icons/file-code'

interface CodeToolbarButtonProps {
	onInsertCode: (lang: string) => void
}

/**
 * CodeToolbarButton - Dropdown menu for inserting language-specific code blocks.
 * @param props - Component properties
 */
export function CodeToolbarButton({ onInsertCode }: CodeToolbarButtonProps) {
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button type="button" className="mvp-toolbar-btn" title="Insertar código">
					<FileCode className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuLabel>Selecciona un lenguaje</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{CODE_LANGUAGES.map(lang => (
					<DropdownMenuItem key={lang.id || 'default'} onClick={() => onInsertCode(lang.id)}>
						{lang.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
