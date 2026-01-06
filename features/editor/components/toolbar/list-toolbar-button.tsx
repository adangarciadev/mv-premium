/**
 * List Toolbar Button - Dropdown for inserting different list types
 * Uses Shadcn DropdownMenu with Lucide icons (same as dashboard)
 */
import List from 'lucide-react/dist/esm/icons/list'
import ListOrdered from 'lucide-react/dist/esm/icons/list-ordered'
import Square from 'lucide-react/dist/esm/icons/square'
import CheckSquare from 'lucide-react/dist/esm/icons/check-square'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

// Same as LIST_TYPES from components/editor/toolbar/constants.ts
const LIST_OPTIONS = [
	{ id: 'unordered', label: 'Lista con puntos', icon: List },
	{ id: 'ordered', label: 'Lista numerada', icon: ListOrdered },
	{ id: 'task-unchecked', label: 'Tarea sin marcar', icon: Square },
	{ id: 'task-checked', label: 'Tarea completada', icon: CheckSquare },
]

interface ListToolbarButtonProps {
	onInsertUnorderedList: () => void
	onInsertOrderedList: () => void
	onInsertTaskList: (checked: boolean) => void
}

/**
 * ListToolbarButton component - Dropdown for inserting various list formats (ordered, unordered, task).
 */
export function ListToolbarButton({
	onInsertUnorderedList,
	onInsertOrderedList,
	onInsertTaskList,
}: ListToolbarButtonProps) {
	const handleTriggerClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
	}

	const handleListClick = (id: string) => {
		switch (id) {
			case 'unordered':
				onInsertUnorderedList()
				break
			case 'ordered':
				onInsertOrderedList()
				break
			case 'task-unchecked':
				onInsertTaskList(false)
				break
			case 'task-checked':
				onInsertTaskList(true)
				break
		}
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="mvp-toolbar-btn"
					title="Insertar lista"
					onClick={handleTriggerClick}
					onPointerDown={e => e.stopPropagation()}
				>
					<i className="fa fa-list-ul" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-48">
				<DropdownMenuLabel>Tipo de lista</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{LIST_OPTIONS.map(list => (
					<DropdownMenuItem key={list.id} onClick={() => handleListClick(list.id)} className="gap-2">
						<list.icon className="h-4 w-4" />
						<span>{list.label}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
