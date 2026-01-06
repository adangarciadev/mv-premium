/**
 * DraftsToolbar - Toolbar component for filtering drafts/templates
 */
import Search from 'lucide-react/dist/esm/icons/search'
import SortAsc from 'lucide-react/dist/esm/icons/sort-asc'
import X from 'lucide-react/dist/esm/icons/x'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubforumCombobox } from '@/components/subforum-combobox'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import type { FolderWithCount } from './folder-item'

// ============================================================================
// Types
// ============================================================================

export type SortOrder = 'newest' | 'oldest' | 'alpha' | 'updated'

export interface DraftsToolbarProps {
	/** Current search query */
	searchQuery: string
	/** Callback when search query changes */
	onSearchChange: (query: string) => void
	/** Current subforum filter ('all' for no filter) */
	subforumFilter: string
	/** Callback when subforum filter changes */
	onSubforumChange: (subforum: string) => void
	/** Current sort order */
	sortOrder: SortOrder
	/** Callback when sort order changes */
	onSortChange: (order: SortOrder) => void
	/** Whether to show template-specific text */
	isTemplate?: boolean
	/** Whether there are active filters */
	hasActiveFilters?: boolean
	/** Currently selected folder ID */
	selectedFolder?: string | null
	/** List of all folders (for filter display) */
	folders?: FolderWithCount[]
	/** Callback to clear selected folder */
	onClearFolder?: () => void
	/** Callback to clear all filters */
	onClearAllFilters?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function DraftsToolbar({
	searchQuery,
	onSearchChange,
	subforumFilter,
	onSubforumChange,
	sortOrder,
	onSortChange,
	isTemplate = false,
	hasActiveFilters = false,
	selectedFolder,
	folders = [],
	onClearFolder,
	onClearAllFilters,
}: DraftsToolbarProps) {
	return (
		<>
			<div className="flex flex-col sm:flex-row gap-3 items-center w-full">
				{/* Search */}
				<div className="relative w-full sm:flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder={isTemplate ? 'Buscar plantillas...' : 'Buscar borradores...'}
						value={searchQuery}
						onChange={e => onSearchChange(e.target.value)}
						className="pl-9 h-9 border-none bg-muted hover:bg-muted/80 focus-visible:bg-background focus-visible:border-primary transition-colors focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground"
					/>
				</div>

				{/* Subforum Filter */}
				<SubforumCombobox
					value={subforumFilter === 'all' ? 'none' : subforumFilter}
					onValueChange={value => onSubforumChange(value === 'none' ? 'all' : value)}
					className="w-full sm:w-48 h-9"
				/>

				{/* Sort */}
				<Select value={sortOrder} onValueChange={v => onSortChange(v as SortOrder)}>
					<SelectTrigger className="w-full sm:w-40 h-9">
						<SortAsc className="h-4 w-4 mr-2" />
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="newest">Más recientes</SelectItem>
						<SelectItem value="oldest">Más antiguos</SelectItem>
						<SelectItem value="updated">Editados recientemente</SelectItem>
						<SelectItem value="alpha">Alfabético</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Active Filters */}
			{hasActiveFilters && (
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-sm text-muted-foreground">Filtros activos:</span>
					{selectedFolder && (
						<Badge variant="secondary" className="gap-1">
							{folders.find(f => f.id === selectedFolder)?.name || 'Carpeta'}
							<X className="h-3 w-3 cursor-pointer" onClick={onClearFolder} />
						</Badge>
					)}
					{subforumFilter !== 'all' && (
						<Badge variant="secondary" className="gap-1">
							{ALL_SUBFORUMS.find(s => s.slug === subforumFilter)?.name}
							<X className="h-3 w-3 cursor-pointer" onClick={() => onSubforumChange('all')} />
						</Badge>
					)}
					{searchQuery && (
						<Badge variant="secondary" className="gap-1">
							"{searchQuery}"
							<X className="h-3 w-3 cursor-pointer" onClick={() => onSearchChange('')} />
						</Badge>
					)}
					<Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAllFilters}>
						Limpiar todo
					</Button>
				</div>
			)}
		</>
	)
}
