import {
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Plus from 'lucide-react/dist/esm/icons/plus'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Search from 'lucide-react/dist/esm/icons/search'
import Star from 'lucide-react/dist/esm/icons/star'
import X from 'lucide-react/dist/esm/icons/x'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { useUserSearch } from '@/features/users/hooks/use-user-search'
import { cn } from '@/lib/utils'
import {
	ALL_SUBFORUM_IDS,
	DEFAULT_HIGHLIGHT_COLOR,
	QUICK_COLORS,
	RULE_AUTHOR_MAX_LENGTH,
	RULE_AUTHOR_MIN_LENGTH,
	RULE_TITLE_MAX_LENGTH,
	buildRuleName,
	getSubforumId,
	getSubforumScopeLabel,
	hasRuleFormCriteria,
	type RuleFormState,
} from './shared'
import { PausedRulesOverlay } from './paused-rules-overlay'

interface RuleBuilderProps {
	form: RuleFormState
	setForm: Dispatch<SetStateAction<RuleFormState>>
	editing: boolean
	contentRulesEnabled: boolean
	onActivate: () => void
	onSubmit: () => void
	onReset: () => void
}

export function RuleBuilder({
	form,
	setForm,
	editing,
	contentRulesEnabled,
	onActivate,
	onSubmit,
	onReset,
}: RuleBuilderProps) {
	const [subforumFilter, setSubforumFilter] = useState('')
	const [expanded, setExpanded] = useState(false)

	// Expand automatically when the user starts editing an existing rule.
	useEffect(() => {
		if (editing) setExpanded(true)
	}, [editing])

	const handleCancel = () => {
		onReset()
		setExpanded(false)
	}

	const hasMatch = Boolean(form.matchTitle.trim() || form.matchAuthor.trim())
	const hasSubforums = form.subforumIds.length > 0
	const titleLength = form.matchTitle.length
	const authorLength = form.matchAuthor.length
	const hasInvalidAuthor = authorLength > 0 && authorLength < RULE_AUTHOR_MIN_LENGTH
	const isValid = hasRuleFormCriteria(form)
	const allSubforumsSelected = form.subforumIds.length === ALL_SUBFORUMS.length

	const visibleSubforums = useMemo(() => {
		const query = subforumFilter.trim().toLowerCase()
		if (!query) return ALL_SUBFORUMS
		return ALL_SUBFORUMS.filter(
			subforum => subforum.name.toLowerCase().includes(query) || subforum.slug.toLowerCase().includes(query)
		)
	}, [subforumFilter])

	const toggleSubforum = (id: string) => {
		setForm(current => ({
			...current,
			subforumIds: current.subforumIds.includes(id)
				? current.subforumIds.filter(item => item !== id)
				: [...current.subforumIds, id],
		}))
	}

	const updateTitle = (value: string) => {
		setForm(current => ({ ...current, matchTitle: value.slice(0, RULE_TITLE_MAX_LENGTH) }))
	}

	const updateAuthor = (value: string) => {
		setForm(current => ({ ...current, matchAuthor: value.slice(0, RULE_AUTHOR_MAX_LENGTH) }))
	}

	return (
		<section className="rounded-xl border bg-card">
			<PausedRulesOverlay disabled={!contentRulesEnabled} onActivate={onActivate} title="Edición de reglas pausada">
				<Collapsible open={expanded} onOpenChange={setExpanded}>
					<div className="flex items-center justify-between gap-3 p-5">
						<CollapsibleTrigger asChild>
							<button type="button" className="flex flex-1 items-center gap-3 text-left">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
									<Plus className="h-5 w-5" />
								</span>
								<span className="flex flex-col">
									<span className="font-semibold">{editing ? 'Editando regla' : 'Nueva regla'}</span>
									<span className="text-sm text-muted-foreground">
										{expanded
											? 'Define cuándo se aplica la regla'
											: 'Destaca u oculta hilos por título, autor y subforo'}
									</span>
								</span>
								<ChevronDown
									className={cn(
										'ml-auto h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
										expanded && 'rotate-180'
									)}
								/>
							</button>
						</CollapsibleTrigger>
						{editing && (
							<Button type="button" variant="outline" disabled={!contentRulesEnabled} onClick={handleCancel}>
								<X className="mr-2 h-4 w-4" />
								Cancelar edición
							</Button>
						)}
					</div>

					<CollapsibleContent>
						<fieldset className="space-y-5 border-t p-5 disabled:cursor-not-allowed" disabled={!contentRulesEnabled}>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
						<div className="space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="rule-title">Titulo contiene</Label>
									<Input
										id="rule-title"
										value={form.matchTitle}
										onChange={event => updateTitle(event.target.value)}
										placeholder="#HG, Temporada..."
										maxLength={RULE_TITLE_MAX_LENGTH}
									/>
									<p className="text-xs text-muted-foreground">
										{titleLength}/{RULE_TITLE_MAX_LENGTH}
									</p>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="rule-author">Autor exacto</Label>
									<AuthorSearchInput value={form.matchAuthor} onChange={updateAuthor} />
									<p className={cn('text-xs text-muted-foreground', hasInvalidAuthor && 'text-destructive')}>
										Busca usuarios reales de Mediavida como en el directorio. Min {RULE_AUTHOR_MIN_LENGTH}, max{' '}
										{RULE_AUTHOR_MAX_LENGTH} caracteres.
									</p>
								</div>
							</div>

							<div className="space-y-3 rounded-lg border bg-background/35 p-3">
								<div className="flex flex-wrap items-center gap-2">
									<Label className="mr-auto">Subforos</Label>
									<Button
										type="button"
										variant={allSubforumsSelected ? 'secondary' : 'outline'}
										size="sm"
										onClick={() => setForm(current => ({ ...current, subforumIds: [...ALL_SUBFORUM_IDS] }))}
									>
										Todos
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={!hasSubforums}
										onClick={() => setForm(current => ({ ...current, subforumIds: [] }))}
									>
										Limpiar
									</Button>
									<Badge variant="outline" className={cn(!hasSubforums && 'border-destructive/40 text-destructive')}>
										{hasSubforums ? getSubforumScopeLabel(form.subforumIds) : 'Selecciona subforos'}
									</Badge>
								</div>

								<div className="relative">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={subforumFilter}
										onChange={event => setSubforumFilter(event.target.value)}
										placeholder="Filtrar subforos"
										className="pl-9"
									/>
								</div>

								<div className="scrollbar-thin grid h-[220px] grid-cols-1 content-start gap-1.5 overflow-y-auto rounded-md border bg-muted/15 p-2 sm:grid-cols-2">
									{visibleSubforums.map(subforum => {
										const id = getSubforumId(subforum.slug)
										const checked = form.subforumIds.includes(id)
										const checkedStyle = checked
											? ({
													borderColor: 'color-mix(in srgb, var(--primary) 38%, var(--border))',
													background: 'color-mix(in srgb, var(--primary) 10%, var(--background))',
											  } as CSSProperties)
											: undefined
										return (
											<label
												key={subforum.slug}
												className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm transition-colors hover:border-border/70 hover:bg-muted/35"
												style={checkedStyle}
											>
												<Checkbox
													checked={checked}
													onCheckedChange={() => toggleSubforum(id)}
													aria-label={`Incluir ${subforum.name}`}
												/>
												<NativeFidIcon iconId={subforum.iconId} className="h-4 w-4 shrink-0" />
												<span className="truncate font-medium text-foreground">{subforum.name}</span>
											</label>
										)
									})}
									{visibleSubforums.length === 0 && (
										<div className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
											No hay subforos que coincidan
										</div>
									)}
								</div>
							</div>
						</div>

						<div className="space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<ActionChoice
									active={form.action === 'highlight'}
									icon={<Star className="h-4 w-4" />}
									title="Destacar"
									description="Aplica un tinte suave."
									tone="highlight"
									onClick={() => setForm(current => ({ ...current, action: 'highlight' }))}
								/>
								<ActionChoice
									active={form.action === 'hide'}
									icon={<EyeOff className="h-4 w-4" />}
									title="Ocultar"
									description="Quita el hilo del listado."
									tone="hide"
									onClick={() => setForm(current => ({ ...current, action: 'hide' }))}
								/>
							</div>

							{form.action === 'highlight' && (
								<div className="space-y-2 rounded-lg border bg-background/35 p-3">
									<div className="space-y-1">
										<Label htmlFor="rule-highlight-tint">Tinte del destacado</Label>
										<p className="text-xs text-muted-foreground">
											Se mezcla con el fondo: amarillo significa capa amarilla suave, no fila amarilla solida.
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-3">
										<input
											id="rule-highlight-tint"
											type="color"
											value={form.highlightColor}
											onChange={event => setForm(current => ({ ...current, highlightColor: event.target.value }))}
											className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
											aria-label="Tinte del destacado"
										/>
										<Input
											value={form.highlightColor}
											onChange={event => setForm(current => ({ ...current, highlightColor: event.target.value }))}
											className="max-w-32 font-mono"
											placeholder={DEFAULT_HIGHLIGHT_COLOR}
										/>
										<div className="flex gap-1">
											{QUICK_COLORS.map(color => (
												<button
													key={color}
													type="button"
													className={cn(
														'h-7 w-7 rounded-full border transition-transform hover:scale-110',
														form.highlightColor.toLowerCase() === color &&
															'ring-2 ring-primary ring-offset-2 ring-offset-background'
													)}
													style={{ backgroundColor: color }}
													onClick={() => setForm(current => ({ ...current, highlightColor: color }))}
													aria-label={`Usar tinte ${color}`}
												/>
											))}
										</div>
									</div>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="rule-name">Nombre opcional</Label>
								<Input
									id="rule-name"
									value={form.name}
									onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
									placeholder={buildRuleName({ ...form, name: '' })}
								/>
							</div>

							<div className="flex flex-col gap-2 sm:flex-row">
								<Button type="button" onClick={onSubmit} disabled={!contentRulesEnabled || !isValid}>
									{editing ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
									{editing ? 'Guardar cambios' : 'Crear regla'}
								</Button>
								<Button type="button" variant="outline" onClick={onReset}>
									<RotateCcw className="mr-2 h-4 w-4" />
									Limpiar
								</Button>
							</div>
							{(!hasMatch || !hasSubforums) && (
								<p className="text-xs text-destructive">
									{!hasMatch && !hasSubforums
										? 'Escribe un titulo o autor y selecciona al menos un subforo.'
										: !hasMatch
										? 'Escribe un titulo o autor.'
										: 'Selecciona al menos un subforo.'}
								</p>
							)}
						</div>
					</div>
						</fieldset>
					</CollapsibleContent>
				</Collapsible>
			</PausedRulesOverlay>
		</section>
	)
}

function AuthorSearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	const [query, setQuery] = useState(value)
	const [debouncedQuery, setDebouncedQuery] = useState(value)
	const [open, setOpen] = useState(false)
	const { users, isLoading } = useUserSearch(debouncedQuery)

	useEffect(() => {
		setQuery(value)
	}, [value])

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 350)
		return () => clearTimeout(timer)
	}, [query])

	const showResults = open && query.trim().length >= 3

	return (
		<div className="relative">
			<Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				id="rule-author"
				value={query}
				onFocus={() => setOpen(true)}
				onBlur={() => window.setTimeout(() => setOpen(false), 120)}
				onChange={event => {
					const nextValue = event.target.value.slice(0, RULE_AUTHOR_MAX_LENGTH)
					setQuery(nextValue)
					onChange(nextValue)
					setOpen(true)
				}}
				placeholder="Buscar usuario..."
				className="pl-9"
				minLength={RULE_AUTHOR_MIN_LENGTH}
				maxLength={RULE_AUTHOR_MAX_LENGTH}
				autoComplete="off"
			/>

			{showResults && (
				<div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-xl">
					{isLoading ? (
						<p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
					) : users.length === 0 ? (
						<p className="px-3 py-2 text-sm text-muted-foreground">No se encontraron usuarios.</p>
					) : (
						users.map(user => (
							<button
								key={user.value}
								type="button"
								className="flex w-full min-w-0 items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
								onMouseDown={event => event.preventDefault()}
								onClick={() => {
									const username = user.data.nombre.slice(0, RULE_AUTHOR_MAX_LENGTH)
									setQuery(username)
									onChange(username)
									setOpen(false)
								}}
							>
								<span className="min-w-0 flex-1 truncate font-medium">{user.data.nombre}</span>
							</button>
						))
					)}
				</div>
			)}
		</div>
	)
}

function ActionChoice({
	active,
	icon,
	title,
	description,
	tone,
	onClick,
}: {
	active: boolean
	icon: ReactNode
	title: string
	description: string
	tone: 'highlight' | 'hide'
	onClick: () => void
}) {
	const toneColor = tone === 'highlight' ? 'var(--primary)' : 'var(--destructive)'
	const style = active
		? ({
				'--action-choice-color': toneColor,
				borderColor: 'color-mix(in srgb, var(--action-choice-color) 55%, var(--border))',
				background: 'color-mix(in srgb, var(--action-choice-color) 14%, var(--background))',
				boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--action-choice-color) 20%, transparent)',
		  } as CSSProperties)
		: ({ '--action-choice-color': toneColor } as CSSProperties)

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				'relative rounded-lg border bg-background/40 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
			)}
			style={style}
		>
			<span
				className={cn(
					'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded border text-muted-foreground transition-colors',
					active && 'text-background'
				)}
				style={
					active
						? {
								borderColor: 'var(--action-choice-color)',
								background: 'var(--action-choice-color)',
						  }
						: undefined
				}
			>
				{active && <Check className="h-3 w-3" />}
			</span>
			<div className="flex items-center gap-2 font-semibold">
				<span
					className={cn('text-muted-foreground transition-colors', active && 'text-[color:var(--action-choice-color)]')}
				>
					{icon}
				</span>
				{title}
			</div>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		</button>
	)
}
