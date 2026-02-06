import { useState, useMemo, useEffect } from 'react'
import { FieldDefinition } from '@/types/templates'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import Search from 'lucide-react/dist/esm/icons/search'
import X from 'lucide-react/dist/esm/icons/x'
import Variable from 'lucide-react/dist/esm/icons/variable'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'

interface VariablesSidebarProps {
	fields: FieldDefinition[]
	onInsertVariable: (key: string) => void
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	isSheetMode: boolean // If true, renders as Sheet. If false, renders as div.
}

export function VariablesSidebar({
	fields,
	onInsertVariable,
	isOpen,
	onOpenChange,
	isSheetMode,
}: VariablesSidebarProps) {
	// Sidebar state
	const [variableFilter, setVariableFilter] = useState('')
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
	const [showHelp, setShowHelp] = useState(false)

	// Filter fields
	const filteredFields = useMemo(() => {
		if (!variableFilter.trim()) return fields
		const q = variableFilter.toLowerCase()
		return fields.filter(f => f.key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q))
	}, [fields, variableFilter])

	// Group fields
	const groupedFields = useMemo(() => {
		const hasCategories = filteredFields.some(f => f.category)
		if (!hasCategories) return null
		const groups = new Map<string, FieldDefinition[]>()
		for (const field of filteredFields) {
			const cat = field.category || 'Otros'
			if (!groups.has(cat)) groups.set(cat, [])
			groups.get(cat)!.push(field)
		}
		return groups
	}, [filteredFields])

	const toggleGroup = (category: string) => {
		setCollapsedGroups(prev => {
			const next = new Set(prev)
			if (next.has(category)) next.delete(category)
			else next.add(category)
			return next
		})
	}

	// The inner content of the sidebar (shared between div and Sheet)
	const SidebarContent = (
		<div className={cn('flex flex-col bg-card', isSheetMode ? 'flex-1 min-h-0 overflow-hidden' : 'h-full')}>
			{/* Header (Desktop only) */}
			{!isSheetMode && (
				<div className="flex items-center justify-between h-9 px-2 border-b border-border bg-muted/30 shrink-0">
					<div className="flex items-center gap-2">
						<Variable className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="text-xs font-semibold text-foreground">Variables</span>
					</div>
					<button
						type="button"
						onClick={() => setShowHelp(prev => !prev)}
						className={cn('p-1.5 rounded hover:bg-accent transition-colors -mr-1', showHelp && 'text-primary')}
						title="Ayuda sobre variables"
					>
						<HelpCircle className="h-3.5 w-3.5" />
					</button>
				</div>
			)}

			{/* Help panel */}
			{showHelp && (
				<div className="px-3 py-2.5 border-b border-border bg-blue-500/5 space-y-2 text-[10px] text-muted-foreground leading-relaxed shrink-0">
					<div>
						<span className="font-semibold text-foreground">Sintaxis</span>
						<p className="mt-0.5">
							Escribe <code className="font-mono text-primary bg-muted px-1 rounded text-[9px]">{'{{variable}}'}</code>{' '}
							para insertar un campo.
						</p>
					</div>
					<div>
						<span className="font-semibold text-foreground">Condicional</span>
						<p className="mt-0.5">Si un campo no tiene valor, toda la línea se omite.</p>
					</div>
					<div>
						<span className="font-semibold text-foreground">Arrays</span>
						<p className="mt-0.5">Las listas (ej: géneros) se unen con coma automáticamente.</p>
					</div>
				</div>
			)}

			{/* Search filter */}
			{fields.length > 20 && (
				<div className="px-2 py-1.5 border-b border-border shrink-0">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
						<Input
							type="text"
							placeholder="Buscar variable..."
							value={variableFilter}
							onChange={e => setVariableFilter(e.target.value)}
							onKeyDown={e => e.stopPropagation()}
							className="h-7 pl-7 pr-7 text-[11px]"
						/>
						{variableFilter && (
							<button
								type="button"
								onClick={() => setVariableFilter('')}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-3 w-3" />
							</button>
						)}
					</div>
				</div>
			)}

			{/* Variable list */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-1.5 pr-3 space-y-0.5">
					{groupedFields
						? // Grouped rendering
						  Array.from(groupedFields.entries()).map(([category, categoryFields]) => (
								<div key={category}>
									<button
										type="button"
										onClick={() => toggleGroup(category)}
										className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
									>
										<ChevronDown
											className={cn('h-3 w-3 transition-transform', collapsedGroups.has(category) && '-rotate-90')}
										/>
										<span className="truncate">{category}</span>
										<span className="ml-auto text-[9px] font-normal tabular-nums">{categoryFields.length}</span>
									</button>
									{!collapsedGroups.has(category) && (
										<div className="space-y-0.5 pl-1">
											{categoryFields.map(field => (
												<VariableButton key={field.key} field={field} onInsert={() => onInsertVariable(field.key)} />
											))}
										</div>
									)}
								</div>
						  ))
						: // Flat rendering
						  filteredFields.map(field => (
								<VariableButton key={field.key} field={field} onInsert={() => onInsertVariable(field.key)} />
						  ))}
					{filteredFields.length === 0 && variableFilter && (
						<p className="text-[10px] text-muted-foreground text-center py-4">
							Sin resultados para &ldquo;{variableFilter}&rdquo;
						</p>
					)}
				</div>
			</ScrollArea>
		</div>
	)

	if (isSheetMode) {
		return (
			<Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}>
				<SheetContent
					side="right"
					className="w-[280px] p-0 sm:max-w-[280px] border-l shadow-2xl gap-0"
					hideOverlay={true}
					onPointerDownOutside={e => e.preventDefault()}
					onInteractOutside={e => e.preventDefault()}
				>
					<SheetHeader className="flex flex-row items-center justify-between p-4 border-b space-y-0">
						<div className="flex items-center gap-2">
							<Variable className="h-4 w-4 text-muted-foreground" />
							<SheetTitle className="text-sm font-semibold">Variables</SheetTitle>
						</div>
						<div className="flex items-center gap-2 pr-6">
							<button
								type="button"
								onClick={() => setShowHelp(prev => !prev)}
								className={cn('p-1.5 rounded hover:bg-accent transition-colors', showHelp && 'text-primary')}
								title="Ayuda sobre variables"
							>
								<HelpCircle className="h-4 w-4 text-muted-foreground" />
							</button>
						</div>
						<SheetDescription className="sr-only">Lista de variables disponibles</SheetDescription>
					</SheetHeader>
					{SidebarContent}
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<div className="w-52 h-full border border-border rounded-l-lg bg-card shadow-sm shrink-0 hidden 2xl:block">
			{SidebarContent}
		</div>
	)
}

function VariableButton({ field, onInsert }: { field: FieldDefinition; onInsert: () => void }) {
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onInsert}
					className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-accent transition-colors group overflow-hidden"
				>
					<span className="font-mono text-primary text-[11px] group-hover:text-primary/80 block truncate">
						{`{{${field.key}}}`}
					</span>
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="text-muted-foreground text-[10px] flex-1 min-w-0 truncate">{field.label}</span>
						{field.source === 'steam' && (
							<span className="shrink-0 text-[9px] font-semibold px-1 py-px rounded bg-[#1b2838] text-[#66c0f4] leading-none">
								STEAM
							</span>
						)}
						{field.source === 'igdb+steam' && (
							<span className="shrink-0 text-[9px] font-semibold px-1 py-px rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 leading-none">
								IGDB/S
							</span>
						)}
					</div>
				</button>
			</TooltipTrigger>
			<TooltipContent side="right" className="p-0 max-w-[240px] overflow-hidden">
				<div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b border-border">
					<span className="text-xs font-semibold text-foreground truncate">{field.label}</span>
					{field.source && (
						<span
							className={cn(
								'shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
								field.source === 'steam' && 'bg-[#1b2838] text-[#66c0f4]',
								field.source === 'igdb' && 'bg-[#9147ff]/15 text-[#9147ff] dark:text-[#bf94ff]',
								field.source === 'igdb+steam' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
							)}
						>
							{field.source === 'igdb' && 'IGDB'}
							{field.source === 'steam' && 'STEAM'}
							{field.source === 'igdb+steam' && 'IGDB / Steam'}
						</span>
					)}
				</div>
				<div className="px-3 py-2 space-y-1.5">
					<p className="text-[11px] text-muted-foreground leading-relaxed">{field.description}</p>
					{field.source === 'igdb+steam' && (
						<div className="flex items-start gap-1.5 pt-0.5">
							<span className="text-[10px] text-amber-500 mt-px">*</span>
							<p className="text-[10px] text-muted-foreground/70 leading-snug">
								Se usa la versión en español de Steam si está disponible, si no, la de IGDB (en inglés)
							</p>
						</div>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	)
}
