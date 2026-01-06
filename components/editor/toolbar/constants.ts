import List from 'lucide-react/dist/esm/icons/list'
import ListOrdered from 'lucide-react/dist/esm/icons/list-ordered'
import CheckSquare from 'lucide-react/dist/esm/icons/check-square'
import Square from 'lucide-react/dist/esm/icons/square'
import Heading1 from 'lucide-react/dist/esm/icons/heading-1'
import Heading2 from 'lucide-react/dist/esm/icons/heading-2'
import Heading3 from 'lucide-react/dist/esm/icons/heading-3'
import Heading from 'lucide-react/dist/esm/icons/heading'

export const CODE_LANGUAGES = [
	{ id: '', label: 'Auto / Default' },
	{ id: 'plaintext', label: 'Texto Plano / Estructura' },
	{ id: 'javascript', label: 'JavaScript' },
	{ id: 'typescript', label: 'TypeScript' },
	{ id: 'jsx', label: 'React (JSX)' },
	{ id: 'tsx', label: 'React (TSX)' },
	{ id: 'html', label: 'HTML / XML' },
	{ id: 'css', label: 'CSS' },
	{ id: 'python', label: 'Python' },
	{ id: 'json', label: 'JSON' },
	{ id: 'sql', label: 'SQL' },
	{ id: 'bash', label: 'Bash / Shell' },
	{ id: 'java', label: 'Java' },
	{ id: 'csharp', label: 'C#' },
	{ id: 'cpp', label: 'C++' },
	{ id: 'c', label: 'C' },
	{ id: 'php', label: 'PHP' },
	{ id: 'go', label: 'Go' },
	{ id: 'rust', label: 'Rust' },
	{ id: 'ruby', label: 'Ruby' },
	{ id: 'swift', label: 'Swift' },
	{ id: 'kotlin', label: 'Kotlin' },
	{ id: 'yaml', label: 'YAML' },
	{ id: 'markdown', label: 'Markdown' },
]

export const LIST_TYPES = [
	{ id: 'unordered', label: 'Lista con puntos', icon: List, prefix: '* ' },
	{ id: 'ordered', label: 'Lista numerada', icon: ListOrdered, prefix: '1. ' },
	{ id: 'task-unchecked', label: 'Tarea sin marcar', icon: Square, prefix: '- [ ] ' },
	{ id: 'task-checked', label: 'Tarea completada', icon: CheckSquare, prefix: '- [x] ' },
]

export const HEADER_TYPES = [
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
