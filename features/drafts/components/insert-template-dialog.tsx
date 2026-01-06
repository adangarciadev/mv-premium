/**
 * Insert Template Dialog
 * A command palette-style dialog for inserting saved templates at cursor position
 * Organized by folders, subforums, and categories
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Tag from 'lucide-react/dist/esm/icons/tag'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { getTemplates, getFolders, type Draft, type DraftFolder } from '@/features/drafts/storage'
import { Badge } from '@/components/ui/badge'
import { ALL_SUBFORUMS, getSubforumName } from '@/lib/subforums'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'

interface InsertTemplateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onInsert: (content: string, title?: string, category?: string) => void
}


// Get category label from value and subforum
function getCategoryLabel(categoryValue?: string, subforumSlug?: string): string | null {
	if (!categoryValue || !subforumSlug) return null
	const categories = getCategoriesForSubforum(subforumSlug)
	const category = categories.find(c => c.value === categoryValue)
	return category?.label || categoryValue
}

// Get iconId from slug
function getIconIdForSubforum(subforumSlug?: string): number {
	if (!subforumSlug) return 0
	const subforum = ALL_SUBFORUMS.find(s => s.slug === subforumSlug)
	return subforum?.iconId || 0
}

// Group templates by folder, subforum, or ungrouped
interface TemplateGroup {
	id: string
	name: string
	icon: React.ReactNode
	type: 'folder' | 'subforum' | 'ungrouped'
	templates: Draft[]
}

function groupTemplates(templates: Draft[], folders: DraftFolder[]): TemplateGroup[] {
	const groups: TemplateGroup[] = []
	const folderMap = new Map(folders.map(f => [f.id, f]))
	const usedTemplates = new Set<string>()

	// Group by folders first
	folders.forEach(folder => {
		const folderTemplates = templates.filter(t => t.folderId === folder.id)
		if (folderTemplates.length > 0) {
			groups.push({
				id: `folder-${folder.id}`,
				name: folder.name,
				icon: <Folder className="h-4 w-4" style={{ color: folder.color || 'currentColor' }} />,
				type: 'folder',
				templates: folderTemplates,
			})
			folderTemplates.forEach(t => usedTemplates.add(t.id))
		}
	})

	// Group remaining by subforum
	const subforumGroups = new Map<string, Draft[]>()
	templates.forEach(t => {
		if (usedTemplates.has(t.id)) return
		if (t.subforum) {
			const existing = subforumGroups.get(t.subforum) || []
			existing.push(t)
			subforumGroups.set(t.subforum, existing)
			usedTemplates.add(t.id)
		}
	})

	subforumGroups.forEach((subTemplates, subforum) => {
		const iconId = getIconIdForSubforum(subforum)
		groups.push({
			id: `subforum-${subforum}`,
			name: getSubforumName(subforum) || subforum,
			icon: <NativeFidIcon iconId={iconId} className="h-4 w-4" />,
			type: 'subforum',
			templates: subTemplates,
		})
	})

	// Ungrouped templates
	const ungrouped = templates.filter(t => !usedTemplates.has(t.id))
	if (ungrouped.length > 0) {
		groups.push({
			id: 'ungrouped',
			name: 'Sin carpeta',
			icon: <FileText className="h-4 w-4 text-muted-foreground" />,
			type: 'ungrouped',
			templates: ungrouped,
		})
	}

	return groups
}

export function InsertTemplateDialog({ open, onOpenChange, onInsert }: InsertTemplateDialogProps) {
	const [templates, setTemplates] = useState<Draft[]>([])
	const [folders, setFolders] = useState<DraftFolder[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [searchQuery, setSearchQuery] = useState('')
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

	// Toggle group expansion
	const toggleGroup = (groupId: string) => {
		setExpandedGroups(prev => {
			const next = new Set(prev)
			if (next.has(groupId)) {
				next.delete(groupId)
			} else {
				next.add(groupId)
			}
			return next
		})
	}

	// Load templates and folders when dialog opens
	useEffect(() => {
		if (open) {
			setIsLoading(true)
			Promise.all([getTemplates(), getFolders()])
				.then(([templatesData, foldersData]) => {
					setTemplates(templatesData)
					// Only include template folders
					setFolders(foldersData.filter(f => f.type === 'template'))
				})
				.finally(() => setIsLoading(false))
		}
	}, [open])

	// Group templates for display
	const groups = groupTemplates(templates, folders)

	const handleSelect = useCallback(
		(template: Draft) => {
			onInsert(template.content, template.title, template.category)
			onOpenChange(false)
		},
		[onInsert, onOpenChange]
	)

	// Get preview of content (first 80 chars, stripped of BBCode)
	const getPreview = (content: string) => {
		const stripped = content.replace(/\[.*?\]/g, '').trim()
		return stripped.length > 80 ? stripped.slice(0, 80) + '...' : stripped
	}

	// --- Filtering Logic ---
	const filteredGroups = useMemo(() => {
		const query = searchQuery.toLowerCase().trim()
		if (!query) return groups

		return groups
			.map(group => {
				// Check if group matches
				const groupMatches = group.name.toLowerCase().includes(query)
				
				// Filter templates
				const matchedTemplates = group.templates.filter(t => {
					const matchTitle = (t.title || '').toLowerCase().includes(query)
					const matchContent = (t.content || '').toLowerCase().includes(query)
					const matchTrigger = (t.trigger || '').toLowerCase().includes(query)
					const matchSubforum = (t.subforum || '').toLowerCase().includes(query)
					
					return matchTitle || matchContent || matchTrigger || matchSubforum
				})

				if (groupMatches && matchedTemplates.length === 0) {
					// If group matches but no templates, show all templates of that group? 
					// Or maybe just show the group name? Let's show all for now if group matches
					return group
				}

				if (matchedTemplates.length > 0) {
					return { ...group, templates: matchedTemplates }
				}

				return null
			})
			.filter(Boolean) as TemplateGroup[]
	}, [groups, searchQuery])


	const hasResults = filteredGroups.length > 0

	// Expand all groups when searching
	useEffect(() => {
		if (searchQuery) {
			const allIds = new Set(filteredGroups.map(g => g.id))
			setExpandedGroups(allIds)
		} else {
			setExpandedGroups(new Set())
		}
	}, [searchQuery, filteredGroups.map(g => g.id).join(',')])


	// Navigation
	const allVisibleTemplates = useMemo(() => {
		return filteredGroups.flatMap(g => expandedGroups.has(g.id) ? g.templates : [])
	}, [filteredGroups, expandedGroups])

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setSelectedIndex(prev => (prev < allVisibleTemplates.length - 1 ? prev + 1 : 0))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setSelectedIndex(prev => (prev > 0 ? prev - 1 : allVisibleTemplates.length - 1))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			const template = allVisibleTemplates[selectedIndex]
			if (template) handleSelect(template)
		}
	}, [allVisibleTemplates, selectedIndex, handleSelect])

	// Ensure selected index is valid
	useEffect(() => {
		if (selectedIndex >= allVisibleTemplates.length && allVisibleTemplates.length > 0) {
			setSelectedIndex(allVisibleTemplates.length - 1)
		}
	}, [allVisibleTemplates.length, selectedIndex])


	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent 
				className="w-full max-w-3xl h-[600px] p-0 gap-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl"
				showCloseButton={false}
			>
				{/* Header */}
				<div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/10">
					<div className="flex items-center gap-2 text-foreground font-semibold">
						<span>Insertar Plantilla</span>
					</div>
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{/* Search */}
				<div className="p-3 border-b border-border/50 bg-background/50 backdrop-blur-sm z-10">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Buscar por nombre, contenido, comando..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							className="pl-9 bg-muted/30 border-muted-foreground/20 focus:bg-background h-10 transition-colors"
							autoFocus
						/>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 min-h-0 overflow-hidden bg-muted/5 relative">
					<ScrollArea className="h-full">
					{isLoading ? (
						<div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
							<p className="text-sm">Cargando biblioteca...</p>
						</div>
					) : !hasResults ? (
						<div className="flex flex-col items-center justify-center p-12 text-muted-foreground/50">
							<Wand2 className="h-12 w-12 mb-4 opacity-20" />
							<p className="text-base font-medium text-muted-foreground">No se encontraron plantillas</p>
							<p className="text-xs mt-1">Prueba con otros términos de búsqueda</p>
						</div>
					) : (
						<div className="p-2 space-y-2">
							{filteredGroups.map(group => (
								<div key={group.id} className="bg-card border border-border/40 rounded-lg overflow-hidden shadow-sm">
									<button
										onClick={() => toggleGroup(group.id)}
										className="w-full flex items-center gap-2 h-8 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
									>
										{expandedGroups.has(group.id) ? (
											<ChevronDown className="w-3.5 h-3.5" />
										) : (
											<ChevronRight className="w-3.5 h-3.5" />
										)}
										<div className="flex items-center gap-2 flex-1 min-w-0">
											<span className="shrink-0">{group.icon}</span>
											<span className="truncate">{group.name}</span>
										</div>
										<Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px] h-5 min-w-5 justify-center bg-muted text-muted-foreground font-medium">
											{group.templates.length}
										</Badge>
									</button>

									{expandedGroups.has(group.id) && (
										<div className="px-1 pb-1 space-y-0.5">
											{group.templates.map(template => {
												// Find index in global list
												const globalIndex = allVisibleTemplates.findIndex(
													t => t.id === template.id
												)
												const isSelected = globalIndex === selectedIndex

												return (
													<div
														key={template.id}
														onClick={() => handleSelect(template)}
														onMouseEnter={() => setSelectedIndex(globalIndex)}
														className={cn(
															"group relative flex flex-col gap-1 p-2.5 px-3 text-sm cursor-pointer rounded-md border-l-2 transition-colors",
															isSelected 
																? "bg-accent border-l-primary" 
																: "bg-transparent border-l-transparent hover:bg-muted"
														)}
													>
														<div className="flex items-center justify-between gap-2 overflow-hidden mb-0.5">
															<div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
																<span className={cn(
																	"font-medium truncate text-sm",
																	isSelected ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
																)}>
																	{template.title || <span className="italic text-muted-foreground">Sin título</span>}
																</span>
																
																{template.trigger && (
																	<span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm whitespace-nowrap">
																		/{template.trigger}
																	</span>
																)}
																
																{template.category && template.subforum && (
																	<span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background text-foreground border border-border shadow-sm whitespace-nowrap flex items-center gap-1">
																		<Tag className="w-3 h-3 text-muted-foreground" />
																		{getCategoryLabel(template.category, template.subforum)}
																	</span>
																)}
															</div>
														</div>
														<p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 line-clamp-1 break-all">
															{getPreview(template.content)}
														</p>
													</div>
												)
											})}
										</div>
									)}
								</div>
							))}
						</div>
					)}
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	)
}
