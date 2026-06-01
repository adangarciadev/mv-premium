import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Copy from 'lucide-react/dist/esm/icons/copy'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ListFilter from 'lucide-react/dist/esm/icons/list-filter'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Search from 'lucide-react/dist/esm/icons/search'
import Star from 'lucide-react/dist/esm/icons/star'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { ContentRule } from '@/features/content-rules'
import { DEFAULT_HIGHLIGHT_COLOR, getSubforumScopeLabel } from './shared'
import { PausedRulesOverlay } from './paused-rules-overlay'

type RuleListFilter = 'all' | 'active' | 'inactive' | 'highlight' | 'hide'
const RULES_PER_PAGE = 20

interface RulesAutomationListProps {
	rules: ContentRule[]
	filteredRules: ContentRule[]
	searchFilter: string
	isLoading: boolean
	contentRulesEnabled: boolean
	onActivate: () => void
	onSearchChange: (value: string) => void
	onEdit: (rule: ContentRule) => void
	onToggle: (rule: ContentRule, enabled: boolean) => void
	onDuplicate: (rule: ContentRule) => void
	onDelete: (rule: ContentRule) => void
	onDeleteMany: (rules: ContentRule[], scopeLabel: string) => void
}

export function RulesAutomationList({
	rules,
	filteredRules,
	searchFilter,
	isLoading,
	contentRulesEnabled,
	onActivate,
	onSearchChange,
	onEdit,
	onToggle,
	onDuplicate,
	onDelete,
	onDeleteMany,
}: RulesAutomationListProps) {
	const [listFilter, setListFilter] = useState<RuleListFilter>('all')
	const [page, setPage] = useState(1)
	const displayedRules = useMemo(
		() =>
			filteredRules.filter(rule => {
				if (listFilter === 'active') return rule.enabled
				if (listFilter === 'inactive') return !rule.enabled
				if (listFilter === 'highlight') return rule.action === 'highlight'
				if (listFilter === 'hide') return rule.action === 'hide'
				return true
			}),
		[filteredRules, listFilter]
	)
	const totalPages = Math.max(1, Math.ceil(displayedRules.length / RULES_PER_PAGE))
	const pageRules = displayedRules.slice((page - 1) * RULES_PER_PAGE, page * RULES_PER_PAGE)
	const filterOptions: Array<{ value: RuleListFilter; label: string; count: number; deleteScope: string }> = [
		{
			value: 'all',
			label: 'Todos',
			count: filteredRules.length,
			deleteScope: searchFilter.trim() ? 'reglas encontradas' : 'todas las reglas',
		},
		{ value: 'active', label: 'Activos', count: filteredRules.filter(rule => rule.enabled).length, deleteScope: 'reglas activas' },
		{ value: 'inactive', label: 'Pausados', count: filteredRules.filter(rule => !rule.enabled).length, deleteScope: 'reglas pausadas' },
		{ value: 'highlight', label: 'Destacados', count: filteredRules.filter(rule => rule.action === 'highlight').length, deleteScope: 'reglas destacadas' },
		{ value: 'hide', label: 'Ocultos', count: filteredRules.filter(rule => rule.action === 'hide').length, deleteScope: 'reglas ocultas' },
	]
	const activeFilter = filterOptions.find(option => option.value === listFilter) ?? filterOptions[0]
	const deleteButtonLabel = displayedRules.length === 1 ? 'Eliminar visible' : 'Eliminar visibles'

	useEffect(() => {
		setPage(1)
	}, [searchFilter, listFilter])

	useEffect(() => {
		if (page > totalPages) setPage(totalPages)
	}, [page, totalPages])

	return (
		<section className="rounded-xl border bg-card">
			<PausedRulesOverlay disabled={!contentRulesEnabled} onActivate={onActivate} title="Reglas creadas pausadas">
				<div className="space-y-4 border-b p-6">
					<div className="min-w-0 space-y-2">
						<p className="text-sm font-semibold text-primary">Reglas creadas por ti</p>
						<h2 className="text-xl font-semibold">Reglas de hilos</h2>
					</div>

					<div className="grid gap-3 xl:grid-cols-[minmax(0,max-content)_minmax(280px,430px)_auto] xl:items-center xl:justify-between">
						<div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-background/45 p-1 whitespace-nowrap">
							{filterOptions.map(option => (
								<button
									key={option.value}
									type="button"
									onClick={() => setListFilter(option.value)}
									className={cn(
										'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
										listFilter === option.value && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
									)}
								>
									{option.label}
									<span
										className={cn(
											'rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground',
											listFilter === option.value && 'bg-primary-foreground/20 text-primary-foreground'
										)}
									>
										{option.count}
									</span>
								</button>
							))}
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={searchFilter}
								onChange={event => onSearchChange(event.target.value)}
								placeholder="Buscar reglas..."
								className="h-10 pl-9"
							/>
						</div>
						<Button
							type="button"
							variant="destructive"
							className="gap-2 xl:justify-self-end"
							disabled={!contentRulesEnabled || displayedRules.length === 0}
							onClick={() => onDeleteMany(displayedRules, activeFilter.deleteScope)}
						>
							<Trash2 className="h-4 w-4" />
							{deleteButtonLabel}
						</Button>
					</div>
				</div>

				<div className="p-6">
					{isLoading ? (
						<p className="py-12 text-center text-sm text-muted-foreground">Cargando reglas...</p>
					) : displayedRules.length === 0 ? (
						<EmptyState
							icon={ListFilter}
							title={rules.length === 0 ? 'Aún no has creado reglas' : 'Sin resultados'}
							description={
								rules.length === 0
									? 'Crea una regla para destacar u ocultar hilos por titulo, autor y subforo.'
									: 'No hay reglas que coincidan con tu busqueda.'
							}
							className="border-dashed shadow-none"
						/>
					) : (
						<>
							<div className="grid gap-3">
								{pageRules.map(rule => (
									<RuleAutomationRow
										key={rule.id}
										rule={rule}
										contentRulesEnabled={contentRulesEnabled}
										onEdit={() => onEdit(rule)}
										onToggle={enabled => onToggle(rule, enabled)}
										onDuplicate={() => onDuplicate(rule)}
										onDelete={() => onDelete(rule)}
									/>
								))}
							</div>
							{totalPages > 1 && (
								<div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-sm text-muted-foreground">
										Mostrando {(page - 1) * RULES_PER_PAGE + 1}-{Math.min(page * RULES_PER_PAGE, displayedRules.length)} de{' '}
										{displayedRules.length}
									</p>
									<div className="flex items-center gap-2">
										<Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(current => current - 1)}>
											Anterior
										</Button>
										<span className="min-w-16 text-center text-sm font-medium">
											{page} / {totalPages}
										</span>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={page === totalPages}
											onClick={() => setPage(current => current + 1)}
										>
											Siguiente
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</PausedRulesOverlay>
		</section>
	)
}

function RuleAutomationRow({
	rule,
	contentRulesEnabled,
	onEdit,
	onToggle,
	onDuplicate,
	onDelete,
}: {
	rule: ContentRule
	contentRulesEnabled: boolean
	onEdit: () => void
	onToggle: (enabled: boolean) => void
	onDuplicate: () => void
	onDelete: () => void
}) {
	const isHighlight = rule.action === 'highlight'
	const color = rule.highlightColor ?? DEFAULT_HIGHLIGHT_COLOR
	const scope = getSubforumScopeLabel(rule.subforumIds)
	const actionLabel = isHighlight ? 'DESTACADO' : 'OCULTADO'
	const actionIcon = isHighlight ? <Star className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />
	const actionColor = isHighlight ? color : 'var(--destructive)'
	const titleAlreadyNamed = Boolean(
		rule.matchTitle && rule.name.trim().toLowerCase() === `título: ${rule.matchTitle.trim()}`.toLowerCase()
	)
	const rowStyle = {
		'--rule-color': actionColor,
		borderColor: 'color-mix(in srgb, var(--rule-color) 28%, var(--border))',
		background:
			'linear-gradient(135deg, color-mix(in srgb, var(--rule-color) 8%, var(--card)) 0%, var(--card) 55%)',
	} as CSSProperties
	const conditionPills = [
		rule.matchTitle && !titleAlreadyNamed ? { label: 'Título', value: rule.matchTitle } : null,
		rule.matchAuthor ? { label: 'Autor', value: rule.matchAuthor } : null,
		{ label: 'Ámbito', value: scope },
	].filter(Boolean) as Array<{ label: string; value: string }>

	return (
		<article
			className={cn(
				'group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-[background-color,border-color,box-shadow] hover:shadow-md',
				!rule.enabled && 'opacity-60'
			)}
			style={rowStyle}
		>
			<div
				className="absolute inset-y-0 left-0 w-1"
				style={{ backgroundColor: 'var(--rule-color)' }}
				aria-hidden
			/>
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="flex min-w-0 items-start gap-3 pl-2">
					<div
						className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-[color:var(--rule-color)] shadow-sm"
						style={{
							borderColor: 'color-mix(in srgb, var(--rule-color) 40%, var(--border))',
							background: 'color-mix(in srgb, var(--rule-color) 12%, transparent)',
						}}
					>
						{isHighlight ? <Star className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
					</div>

					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="font-semibold">{rule.name}</h3>
							{!rule.enabled && (
								<Badge variant="outline" className="rounded-[var(--radius)]">
									Pausada
								</Badge>
							)}
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{isHighlight ? 'Resalta los hilos que coincidan con esta regla.' : 'Oculta los hilos que coincidan con esta regla.'}
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{conditionPills.map(pill => (
								<span
									key={`${pill.label}-${pill.value}`}
									className="inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius)] border bg-background/55 px-2.5 py-1 text-xs"
								>
									<span className="font-semibold text-muted-foreground">{pill.label}</span>
									<span className="max-w-[16rem] truncate font-medium text-foreground">{pill.value}</span>
								</span>
							))}
							<Badge
								variant={isHighlight ? 'secondary' : 'destructive'}
								className={cn('gap-1.5 rounded-[var(--radius)] font-semibold tracking-wide', isHighlight && 'border-transparent')}
								style={
									isHighlight
										? {
												background: 'color-mix(in srgb, var(--rule-color) 16%, var(--secondary))',
												color: 'var(--rule-color)',
											}
										: undefined
								}
							>
								{actionIcon}
								{actionLabel}
							</Badge>
							{isHighlight && (
								<Badge variant="outline" className="gap-1.5 rounded-[var(--radius)]">
									<span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: color }} />
									Tinte {color}
								</Badge>
							)}
						</div>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2 md:self-center">
					<Switch checked={rule.enabled} disabled={!contentRulesEnabled} onCheckedChange={onToggle} />
					<Button type="button" variant="outline" size="icon" disabled={!contentRulesEnabled} onClick={onEdit}>
						<Pencil className="h-4 w-4" />
						<span className="sr-only">Editar</span>
					</Button>
					<Button type="button" variant="outline" size="icon" disabled={!contentRulesEnabled} onClick={onDuplicate}>
						<Copy className="h-4 w-4" />
						<span className="sr-only">Duplicar</span>
					</Button>
					<Button type="button" variant="outline" size="icon" disabled={!contentRulesEnabled} onClick={onDelete}>
						<Trash2 className="h-4 w-4" />
						<span className="sr-only">Eliminar</span>
					</Button>
				</div>
			</div>
		</article>
	)
}
