/**
 * Index Creator Dialog
 *
 * A dialog that allows users to create a custom index with anchor links.
 * Generates BBCode with [ancla=id]text[/ancla] links and [ancla]id[/ancla] targets.
 *
 * REFACTORED: Removed @dnd-kit dependency (~100KB savings)
 * Now uses simple arrow buttons for reordering instead of drag & drop.
 */
import { useState, useEffect, useCallback } from 'react'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import List from 'lucide-react/dist/esm/icons/list'
import ListIndentIncrease from 'lucide-react/dist/esm/icons/list-indent-increase'
import ListIndentDecrease from 'lucide-react/dist/esm/icons/list-indent-decrease'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// Types
// ============================================================================

interface IndexItem {
	id: string
	title: string
	anchorId: string
	level: number // 0: Main, 1: Sub, 2: Sub-sub...
}

interface IndexCreatorDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (bbcode: string) => void
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a URL-friendly slug from a section title to serve as a BBCode anchor ID.
 * @param title - The raw section title
 */
function generateSlug(title: string): string {
	return (
		title
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // Remove accents
			.replace(/[^a-z0-9\s-]/g, '') // Remove special chars
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/-+/g, '-') // Remove consecutive hyphens
			.trim()
			.substring(0, 30) || 'item'
	)
}

/**
 * Utility to generate unique identifiers for internal list management.
 */
function generateItemId(): string {
	return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
}

/**
 * Immutable utility to move an item within an array.
 * @param array - The source array
 * @param fromIndex - Source position
 * @param toIndex - Target position
 */
function arrayMove<T>(array: T[], fromIndex: number, toIndex: number): T[] {
	const result = [...array]
	const [removed] = result.splice(fromIndex, 1)
	result.splice(toIndex, 0, removed)
	return result
}

// ============================================================================
// Index Item Component
// ============================================================================

interface IndexItemRowProps {
	item: IndexItem
	index: number
	totalItems: number
	onUpdateTitle: (id: string, title: string) => void
	onUpdateAnchorId: (id: string, anchorId: string) => void
	onRemove: (id: string) => void
	onMoveUp: (index: number) => void
	onMoveDown: (index: number) => void
	onIndent: (id: string, increase: boolean) => void
	canDelete: boolean
}

function IndexItemRow({
	item,
	index,
	totalItems,
	onUpdateTitle,
	onUpdateAnchorId,
	onRemove,
	onMoveUp,
	onMoveDown,
	onIndent,
	canDelete,
}: IndexItemRowProps) {
	const isFirst = index === 0
	const isLast = index === totalItems - 1

	return (
		<div
			className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 transition-all"
			style={{ marginLeft: `${item.level * 24}px` }}
		>
			{/* Indent buttons */}
			<div className="flex flex-col gap-0.5">
				<button
					type="button"
					onClick={() => onIndent(item.id, true)}
					disabled={item.level >= 3}
					className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					title="Aumentar nivel"
				>
					<ListIndentIncrease className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => onIndent(item.id, false)}
					disabled={item.level <= 0}
					className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					title="Reducir nivel"
				>
					<ListIndentDecrease className="h-3.5 w-3.5" />
				</button>
			</div>
			{/* Reorder buttons */}
			<div className="flex flex-col gap-0.5">
				<button
					type="button"
					onClick={() => onMoveUp(index)}
					disabled={isFirst}
					className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					title="Mover arriba"
				>
					<ChevronUp className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => onMoveDown(index)}
					disabled={isLast}
					className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					title="Mover abajo"
				>
					<ChevronDown className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* Number badge */}
			<span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-medium bg-primary/10 text-primary rounded-full">
				{index + 1}
			</span>

			{/* Title input */}
			<div className="flex-1 min-w-0">
				<Input
					value={item.title}
					onChange={e => onUpdateTitle(item.id, e.target.value)}
					placeholder={`Sección ${index + 1}`}
					className="h-8 text-sm"
				/>
			</div>

			{/* Anchor ID (collapsed) */}
			<Input
				value={item.anchorId}
				onChange={e => onUpdateAnchorId(item.id, e.target.value)}
				placeholder="id"
				className="w-20 h-8 text-xs font-mono text-muted-foreground"
				title="ID del ancla (auto-generado)"
			/>

			{/* Delete button */}
			<button
				type="button"
				onClick={() => onRemove(item.id)}
				disabled={!canDelete}
				className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
				title="Eliminar"
			>
				<Trash2 className="h-4 w-4" />
			</button>
		</div>
	)
}

/**
 * IndexCreatorDialog component - Provides an interface for creating complex indexes with anchor links.
 * Generates structured BBCode with bidirectional navigation support.
 */
export function IndexCreatorDialog({ isOpen, onClose, onInsert }: IndexCreatorDialogProps) {
	// State
	const [items, setItems] = useState<IndexItem[]>([{ id: generateItemId(), title: '', anchorId: '', level: 0 }])
	const [includeTargets, setIncludeTargets] = useState(true)
	const [indexTitle, setIndexTitle] = useState('Índice')

	// Reset on open
	useEffect(() => {
		if (isOpen) {
			setItems([{ id: generateItemId(), title: '', anchorId: '', level: 0 }])
			setIncludeTargets(true)
			setIndexTitle('Índice')
		}
	}, [isOpen])

	// Add a new item
	const addItem = useCallback(() => {
		setItems(prev => {
			const lastLevel = prev.length > 0 ? prev[prev.length - 1].level : 0
			return [...prev, { id: generateItemId(), title: '', anchorId: '', level: lastLevel }]
		})
	}, [])

	// Hierarchical numbering helper
	const getHierarchicalNumber = (index: number, currentItems: IndexItem[]): string => {
		const numbers: number[] = []
		const levelIndices = new Array(5).fill(0)

		for (let i = 0; i <= index; i++) {
			const item = currentItems[i]
			if (!item.title.trim()) continue // Skip empty items in numbering

			levelIndices[item.level]++
			// Reset all sub-levels
			for (let j = item.level + 1; j < levelIndices.length; j++) {
				levelIndices[j] = 0
			}

			if (i === index) {
				for (let k = 0; k <= item.level; k++) {
					numbers.push(levelIndices[k])
				}
			}
		}

		return numbers.join('.')
	}

	// Remove an item
	const removeItem = useCallback((id: string) => {
		setItems(prev => {
			if (prev.length <= 1) return prev // Keep at least one item
			return prev.filter(item => item.id !== id)
		})
	}, [])

	// Update item title (and auto-generate anchor ID)
	const updateItemTitle = useCallback((id: string, title: string) => {
		setItems(prev =>
			prev.map(item => {
				if (item.id !== id) return item
				return {
					...item,
					title,
					anchorId: generateSlug(title) || `item${prev.indexOf(item) + 1}`,
				}
			})
		)
	}, [])

	// Update item anchor ID manually
	const updateItemAnchorId = useCallback((id: string, anchorId: string) => {
		setItems(prev =>
			prev.map(item => {
				if (item.id !== id) return item
				return { ...item, anchorId: anchorId.replace(/[^a-z0-9-]/gi, '').toLowerCase() }
			})
		)
	}, [])

	// Indent/Outdent item
	const handleIndent = useCallback((id: string, increase: boolean) => {
		setItems(prev =>
			prev.map(item => {
				if (item.id !== id) return item
				const newLevel = increase ? Math.min(3, item.level + 1) : Math.max(0, item.level - 1)
				return { ...item, level: newLevel }
			})
		)
	}, [])

	// Move item up
	const moveItemUp = useCallback((index: number) => {
		if (index <= 0) return
		setItems(prev => arrayMove(prev, index, index - 1))
	}, [])

	// Move item down
	const moveItemDown = useCallback((index: number) => {
		setItems(prev => {
			if (index >= prev.length - 1) return prev
			return arrayMove(prev, index, index + 1)
		})
	}, [])

	// Generate BBCode
	const generateBBCode = useCallback((): string => {
		const validItems = items.filter(item => item.title.trim())
		if (validItems.length === 0) return ''

		const lines: string[] = []

		// Index title
		if (indexTitle.trim()) {
			lines.push(`[bar]${indexTitle}[/bar]`)
		}

		// Index links - MUST match Mediavida's expected format exactly:
		// [list=1]
		// [*] [ancla=id]Title[/ancla]
		//   1.1. [ancla=id]SubTitle[/ancla]     <-- 2 spaces per level, NO [*]
		// [*] [ancla=id]Title2[/ancla]
		// [/list]

		if (validItems.length > 0) {
			lines.push('[list=1]')

			validItems.forEach((item, i) => {
				const anchorId = item.anchorId || `item${i + 1}`
				const hierarchicalNum = getHierarchicalNumber(i, validItems)

				if (item.level === 0) {
					// Level 0: use [*] marker
					lines.push(`[*] [ancla=${anchorId}]${item.title}[/ancla]`)
				} else {
					// Sub-levels: plain text with 2-space indentation per level
					const indent = '  '.repeat(item.level)
					lines.push(`${indent}${hierarchicalNum}. [ancla=${anchorId}]${item.title}[/ancla]`)
				}
			})

			lines.push('[/list]')
		}

		// Target anchors (if enabled)
		if (includeTargets) {
			lines.push('')
			lines.push('---')
			lines.push('')

			for (let i = 0; i < validItems.length; i++) {
				const item = validItems[i]
				const anchorId = item.anchorId || `item${i + 1}`
				const hierarchicalNum = getHierarchicalNumber(i, validItems)
				lines.push(`[ancla]${anchorId}[/ancla]`)

				// Format heading based on level
				let headingPrefix = '##' // Level 0
				if (item.level === 1) headingPrefix = '###'
				if (item.level >= 2) headingPrefix = '####'

				lines.push(`${headingPrefix} ${hierarchicalNum}. ${item.title}`)
				lines.push('Escribe aquí el contenido...')
				lines.push('')
			}
		}

		return lines.join('\n')
	}, [items, includeTargets, indexTitle])

	// Handle insert
	const handleInsert = useCallback(() => {
		const bbcode = generateBBCode()
		if (bbcode) {
			onInsert(bbcode)
			onClose()
		}
	}, [generateBBCode, onInsert, onClose])

	// Count valid items
	const validItemCount = items.filter(item => item.title.trim()).length

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<List className="h-5 w-5 text-primary" />
						Crear Índice
					</DialogTitle>
					<DialogDescription>Añade secciones para generar un índice con enlaces de navegación.</DialogDescription>
				</DialogHeader>

				{/* Index Title */}
				<div className="space-y-1.5">
					<Label htmlFor="index-title" className="text-sm font-medium">
						Título del índice
					</Label>
					<Input
						id="index-title"
						value={indexTitle}
						onChange={e => setIndexTitle(e.target.value)}
						placeholder="Índice"
						className="h-9"
					/>
				</div>

				{/* Items List with Arrow Reordering */}
				<ScrollArea className="flex-1 -mx-6 px-6 max-h-75">
					<div className="space-y-2 py-2">
						{items.map((item, index) => (
							<IndexItemRow
								key={item.id}
								item={item}
								index={index}
								totalItems={items.length}
								onUpdateTitle={updateItemTitle}
								onUpdateAnchorId={updateItemAnchorId}
								onRemove={removeItem}
								onMoveUp={moveItemUp}
								onMoveDown={moveItemDown}
								onIndent={handleIndent}
								canDelete={items.length > 1}
							/>
						))}
					</div>
				</ScrollArea>

				{/* Add Item Button */}
				<Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full gap-2">
					<Plus className="h-4 w-4" />
					Añadir sección
				</Button>

				{/* Options */}
				<div className="flex items-center justify-between py-2 border-t">
					<div className="flex items-center gap-2">
						<Switch id="include-targets" checked={includeTargets} onCheckedChange={setIncludeTargets} />
						<Label htmlFor="include-targets" className="text-sm cursor-pointer">
							Incluir secciones de destino
						</Label>
					</div>
					<span className="text-xs text-muted-foreground">
						{validItemCount} {validItemCount === 1 ? 'sección' : 'secciones'}
					</span>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button onClick={handleInsert} disabled={validItemCount === 0}>
						Insertar Índice
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default IndexCreatorDialog
