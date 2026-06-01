import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Info from 'lucide-react/dist/esm/icons/info'
import ListFilter from 'lucide-react/dist/esm/icons/list-filter'
import Star from 'lucide-react/dist/esm/icons/star'
import ToggleRight from 'lucide-react/dist/esm/icons/toggle-right'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import { useSettingsStore } from '@/store/settings-store'
import {
	createContentRule,
	deleteContentRule,
	deleteContentRules,
	duplicateContentRule,
	getContentRules,
	updateContentRule,
	watchContentRules,
	type ContentRule,
} from '@/features/content-rules'
import { RuleBuilder } from './content-rules/rule-builder'
import { RulesAutomationList } from './content-rules/rules-automation-list'
import {
	EMPTY_FORM,
	buildRuleName,
	getSubforumName,
	hasRuleFormCriteria,
	type RuleFormState,
} from './content-rules/shared'

interface ContentRulesViewProps {
	embedded?: boolean
}

export function ContentRulesView({ embedded = false }: ContentRulesViewProps) {
	const [rules, setRules] = useState<ContentRule[]>([])
	const [form, setForm] = useState<RuleFormState>(EMPTY_FORM)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [searchFilter, setSearchFilter] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [ruleToDelete, setRuleToDelete] = useState<ContentRule | null>(null)
	const [bulkDeleteTarget, setBulkDeleteTarget] = useState<{ rules: ContentRule[]; scopeLabel: string } | null>(null)
	const contentRulesEnabled = useSettingsStore(state => state.contentRulesEnabled)
	const setSetting = useSettingsStore(state => state.setSetting)

	useEffect(() => {
		let mounted = true

		void getContentRules().then(nextRules => {
			if (!mounted) return
			setRules(nextRules)
			setIsLoading(false)
		})

		const unwatch = watchContentRules(nextRules => {
			setRules(nextRules)
			setIsLoading(false)
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	const stats = useMemo(
		() => ({
			active: rules.filter(rule => rule.enabled).length,
			hidden: rules.filter(rule => rule.action === 'hide').length,
			highlighted: rules.filter(rule => rule.action === 'highlight').length,
		}),
		[rules]
	)

	const filteredRules = useMemo(() => {
		const query = searchFilter.trim().toLowerCase()
		if (!query) return rules
		return rules.filter(rule =>
			[rule.name, rule.matchTitle, rule.matchAuthor, rule.subforumIds.map(getSubforumName).join(' ')]
				.join(' ')
				.toLowerCase()
				.includes(query)
		)
	}, [rules, searchFilter])

	const resetForm = () => {
		setForm(EMPTY_FORM)
		setEditingId(null)
	}

	const handleSubmit = async () => {
		if (!contentRulesEnabled) {
			toast.error('Activa las reglas para crear o editar reglas de hilos')
			return
		}

		if (!hasRuleFormCriteria(form)) {
			toast.error('Selecciona al menos un subforo y escribe un título o autor')
			return
		}

		const payload = {
			name: buildRuleName(form),
			enabled: true,
			action: form.action,
			matchTitle: form.matchTitle,
			matchAuthor: form.matchAuthor,
			subforumIds: form.subforumIds,
			highlightColor: form.action === 'highlight' ? form.highlightColor : undefined,
		}

		if (editingId) {
			await updateContentRule(editingId, payload)
			toast.success('Regla actualizada')
		} else {
			await createContentRule(payload)
			toast.success('Regla creada')
		}

		resetForm()
	}

	const handleEdit = (rule: ContentRule) => {
		if (!contentRulesEnabled) return
		setEditingId(rule.id)
		setForm({
			name: rule.name,
			action: rule.action,
			matchTitle: rule.matchTitle,
			matchAuthor: rule.matchAuthor,
			subforumIds: [...rule.subforumIds],
			highlightColor: rule.highlightColor ?? EMPTY_FORM.highlightColor,
		})
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}

	const activateContentRules = () => {
		setSetting('contentRulesEnabled', true)
		toast.success('Reglas activadas')
	}

	return (
		<div className={embedded ? 'flex flex-col gap-6' : 'mx-auto flex max-w-7xl flex-col gap-6 p-6 animate-in fade-in duration-300'}>
			<header className="rounded-xl border bg-card p-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-start gap-4">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary">
							<ListFilter className="h-5 w-5" />
						</div>
						<div className="max-w-2xl space-y-2">
							<h1 className="text-3xl font-bold tracking-tight">Reglas de hilos</h1>
							<p className="text-sm text-muted-foreground">
								Automatiza qué hilos se destacan u ocultan cuando coinciden con título, autor y subforo.
							</p>
						</div>
					</div>

					<div className="flex w-full items-center justify-between gap-4 rounded-lg border bg-background/60 px-4 py-3 lg:w-auto">
						<div>
							<p className="text-sm font-semibold">{contentRulesEnabled ? 'Reglas activas' : 'Reglas pausadas'}</p>
							<p className="text-xs text-muted-foreground">Spy no permite filtrar por creador.</p>
						</div>
						<Switch
							checked={contentRulesEnabled}
							onCheckedChange={value => {
								setSetting('contentRulesEnabled', value)
								toast.success(value ? 'Reglas activadas' : 'Reglas desactivadas')
							}}
						/>
					</div>
				</div>
				<div className="mt-5 flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
					<Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					<div className="space-y-1">
						<p className="font-semibold">Qué son estas reglas</p>
						<p className="text-muted-foreground">
							Son automatizaciones: si un hilo cumple las condiciones, se destaca o se oculta. No sustituyen a
							los hilos ocultos a mano, subforos ocultos, palabras silenciadas ni usuarios ignorados; esas
							opciones viven en sus propias pestañas de Filtros y siguen teniendo efecto por separado.
						</p>
					</div>
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					<HeaderStat
						value={stats.active}
						singularLabel={contentRulesEnabled ? 'ACTIVO' : 'CONFIGURADO'}
						pluralLabel={contentRulesEnabled ? 'ACTIVOS' : 'CONFIGURADOS'}
						tone="active"
						icon={ToggleRight}
					/>
					<HeaderStat value={stats.highlighted} singularLabel="DESTACADO" pluralLabel="DESTACADOS" tone="highlight" icon={Star} />
					<HeaderStat value={stats.hidden} singularLabel="OCULTADO" pluralLabel="OCULTADOS" tone="hide" icon={EyeOff} />
				</div>
			</header>

			<RuleBuilder
				form={form}
				setForm={setForm}
				editing={Boolean(editingId)}
				contentRulesEnabled={contentRulesEnabled}
				onActivate={activateContentRules}
				onSubmit={handleSubmit}
				onReset={resetForm}
			/>

			<RulesAutomationList
				rules={rules}
				filteredRules={filteredRules}
				searchFilter={searchFilter}
				isLoading={isLoading}
				contentRulesEnabled={contentRulesEnabled}
				onActivate={activateContentRules}
				onSearchChange={setSearchFilter}
				onEdit={handleEdit}
				onToggle={(rule, enabled) => {
					if (!contentRulesEnabled) return
					void updateContentRule(rule.id, { enabled })
				}}
				onDuplicate={rule => {
					if (!contentRulesEnabled) return
					void duplicateContentRule(rule.id).then(() => toast.success('Regla duplicada'))
				}}
				onDelete={rule => {
					if (!contentRulesEnabled) return
					setRuleToDelete(rule)
				}}
				onDeleteMany={(targetRules, scopeLabel) => {
					if (!contentRulesEnabled || targetRules.length === 0) return
					setBulkDeleteTarget({ rules: targetRules, scopeLabel })
				}}
			/>

			<ConfirmDialog
				open={Boolean(ruleToDelete)}
				onOpenChange={open => {
					if (!open) setRuleToDelete(null)
				}}
				title="Eliminar regla"
				description={
					ruleToDelete
						? `Vas a eliminar "${ruleToDelete.name}". Esta acción no se puede deshacer.`
						: 'Vas a eliminar esta regla. Esta acción no se puede deshacer.'
				}
				cancelText="Cancelar"
				confirmText="Eliminar regla"
				variant="destructive"
				onConfirm={() => {
					if (!ruleToDelete) return
					void deleteContentRule(ruleToDelete.id).then(() => {
						toast.success('Regla eliminada')
						setRuleToDelete(null)
					})
				}}
			/>

			<ConfirmDialog
				open={Boolean(bulkDeleteTarget)}
				onOpenChange={open => {
					if (!open) setBulkDeleteTarget(null)
				}}
				title="Eliminar reglas visibles"
				description={
					bulkDeleteTarget ? (
						<div className="space-y-2">
							<p>
								Vas a eliminar {bulkDeleteTarget.rules.length}{' '}
								{bulkDeleteTarget.rules.length === 1 ? 'regla' : 'reglas'} de{' '}
								<span className="font-semibold text-foreground">{bulkDeleteTarget.scopeLabel}</span>.
							</p>
							<p>
								Se respetan la búsqueda y la pestaña actual: las reglas que no estén dentro de este filtro no se tocarán.
							</p>
							<p>Esta acción no se puede deshacer.</p>
						</div>
					) : (
						'Vas a eliminar las reglas visibles. Esta acción no se puede deshacer.'
					)
				}
				cancelText="Cancelar"
				confirmText={
					bulkDeleteTarget?.rules.length === 1 ? 'Eliminar 1 regla' : `Eliminar ${bulkDeleteTarget?.rules.length ?? 0} reglas`
				}
				variant="destructive"
				onConfirm={() => {
					if (!bulkDeleteTarget) return
					void deleteContentRules(bulkDeleteTarget.rules.map(rule => rule.id)).then(deletedCount => {
						toast.success(deletedCount === 1 ? 'Regla eliminada' : `${deletedCount} reglas eliminadas`)
						setBulkDeleteTarget(null)
					})
				}}
			/>
		</div>
	)
}

function HeaderStat({
	value,
	tone,
	singularLabel,
	pluralLabel,
	icon: Icon,
}: {
	value: number
	tone: 'active' | 'highlight' | 'hide'
	singularLabel: string
	pluralLabel: string
	icon: LucideIcon
}) {
	const toneClasses = {
		active: {
			color: 'var(--chart-3)',
			icon: 'text-[color:var(--stat-color)]',
			label: 'text-[color:var(--stat-color)]',
		},
		highlight: {
			color: 'var(--primary)',
			icon: 'text-[color:var(--stat-color)]',
			label: 'text-[color:var(--stat-color)]',
		},
		hide: {
			color: 'var(--destructive)',
			icon: 'text-[color:var(--stat-color)]',
			label: 'text-[color:var(--stat-color)]',
		},
	}[tone]
	const style = {
		'--stat-color': toneClasses.color,
		borderColor: 'color-mix(in srgb, var(--stat-color) 30%, var(--border))',
		background: 'linear-gradient(135deg, color-mix(in srgb, var(--stat-color) 9%, var(--card)) 0%, var(--card) 70%)',
	} as CSSProperties
	const label = value === 1 ? singularLabel : pluralLabel

	return (
		<div className="flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sm" style={style}>
			<div>
				<p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
				<p className={`mt-1 text-xs font-black uppercase tracking-wide ${toneClasses.label}`}>{label}</p>
			</div>
			<div
				className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneClasses.icon}`}
				style={{
					borderColor: 'color-mix(in srgb, var(--stat-color) 38%, var(--border))',
					background: 'color-mix(in srgb, var(--stat-color) 12%, transparent)',
				}}
			>
				<Icon className="h-4 w-4" />
			</div>
		</div>
	)
}
