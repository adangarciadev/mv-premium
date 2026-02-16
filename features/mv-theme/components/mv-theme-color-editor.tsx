/**
 * MV Theme Color Editor
 *
 * Accordion-based editor for semantic color groups, organized by category.
 * Each group shows a color swatch with a native color picker.
 *
 * Includes a "modified colors summary" strip that shows all changed colors
 * at a glance (reference → current) without needing to open accordion sections.
 *
 * Only the first category ("Fondos") is expanded by default to avoid
 * overwhelming the user with 18 controls at once.
 *
 * Not rendered when the original MV theme is active (parent hides it).
 */
import { useMemo } from 'react'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { MV_COLOR_GROUPS, CATEGORY_LABELS, type MvColorGroup } from '../logic/color-groups'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'

const CATEGORIES: MvColorGroup['category'][] = ['backgrounds', 'text', 'accents', 'borders']
const DEFAULT_OPEN: MvColorGroup['category'][] = ['backgrounds']

interface MvThemeColorEditorProps {
	colorOverrides: Record<string, string>
	referenceColors?: Record<string, string>
	onColorChange: (groupId: string, hex: string) => void
	onReset: () => void
	resetLabel?: string
}

/**
 * Color swatch + picker for a single color group.
 * Shows a reference → current comparison when the color has been modified.
 */
function ColorGroupRow({
	group,
	currentColor,
	referenceColor,
	onChange,
}: {
	group: MvColorGroup
	currentColor: string
	referenceColor: string
	onChange: (hex: string) => void
}) {
	const isModified = currentColor !== referenceColor

	return (
		<div className="flex items-center justify-between py-2 px-1 group/row">
			<div className="flex items-center gap-3 min-w-0">
				<label className="relative cursor-pointer shrink-0">
					{/* Color swatch with reference indicator */}
					<div className="relative">
						<div
							className="w-8 h-8 rounded-md border border-border shadow-sm transition-transform hover:scale-110"
							style={{ backgroundColor: currentColor }}
						/>
						{/* Small reference dot in corner when modified */}
						{isModified && (
							<div
								className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background"
								style={{ backgroundColor: referenceColor }}
								title={`Original: ${referenceColor}`}
							/>
						)}
					</div>
					<input
						type="color"
						value={currentColor}
						onChange={e => onChange(e.target.value)}
						className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
					/>
				</label>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-primary truncate">{group.label}</span>
						{isModified && (
							<span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full leading-none">
								Editado
							</span>
						)}
					</div>
					<p className="text-xs text-muted-foreground truncate">{group.description}</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<code className="text-[11px] font-mono text-muted-foreground hidden sm:block">
					{currentColor}
				</code>
				{isModified && (
					<button
						onClick={() => onChange(referenceColor)}
						className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded"
						title="Restaurar color de referencia"
					>
						<RotateCcw className="w-3.5 h-3.5" />
					</button>
				)}
			</div>
		</div>
	)
}

/**
 * Modified Colors Summary - shows all changed colors at a glance.
 * Each chip displays reference → current swatch pair + group label.
 * Clicking a chip resets that color to its reference value.
 */
function ModifiedColorsSummary({
	modifiedGroups,
	onColorChange,
}: {
	modifiedGroups: Array<{ group: MvColorGroup; currentColor: string; referenceColor: string }>
	onColorChange: (groupId: string, hex: string) => void
}) {
	if (modifiedGroups.length === 0) return null

	return (
		<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
			<p className="text-xs font-medium text-primary">
				{modifiedGroups.length} color{modifiedGroups.length !== 1 ? 'es' : ''} editado{modifiedGroups.length !== 1 ? 's' : ''}
			</p>
			<div className="flex flex-wrap gap-1.5">
				{modifiedGroups.map(({ group, currentColor, referenceColor }) => (
					<button
						key={group.id}
						onClick={() => onColorChange(group.id, referenceColor)}
						className="group/chip inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] transition-colors hover:border-destructive/40 hover:bg-destructive/5"
						title={`${group.label}: ${referenceColor} → ${currentColor} (click para restaurar)`}
					>
						{/* Reference → Current swatch pair */}
						<span className="inline-flex items-center gap-0.5">
							<span
								className="w-3 h-3 rounded-sm border border-border/80 shrink-0"
								style={{ backgroundColor: referenceColor }}
							/>
							<ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60" />
							<span
								className="w-3 h-3 rounded-sm border border-border/80 shrink-0"
								style={{ backgroundColor: currentColor }}
							/>
						</span>
						<span className="text-muted-foreground group-hover/chip:text-destructive/80 transition-colors truncate max-w-[100px]">
							{group.label}
						</span>
						<RotateCcw className="w-2.5 h-2.5 text-muted-foreground/40 group-hover/chip:text-destructive/60 transition-colors shrink-0" />
					</button>
				))}
			</div>
		</div>
	)
}

export function MvThemeColorEditor({ colorOverrides, referenceColors, onColorChange, onReset, resetLabel }: MvThemeColorEditorProps) {
	const groupsByCategory = useMemo(() => {
		const map = new Map<MvColorGroup['category'], MvColorGroup[]>()
		for (const group of MV_COLOR_GROUPS) {
			const list = map.get(group.category) || []
			list.push(group)
			map.set(group.category, list)
		}
		return map
	}, [])

	const getReferenceColor = (group: MvColorGroup): string => referenceColors?.[group.id] || group.baseColor

	const modifiedGroups = useMemo(
		() => MV_COLOR_GROUPS
			.map(g => ({
				group: g,
				currentColor: colorOverrides[g.id] || g.baseColor,
				referenceColor: getReferenceColor(g),
			}))
			.filter(entry => entry.currentColor !== entry.referenceColor),
		[colorOverrides, referenceColors],
	)

	const modifiedCount = modifiedGroups.length

	const getCategoryModifiedCount = (category: MvColorGroup['category']): number => {
		const groups = groupsByCategory.get(category) || []
		return groups.filter(g => {
			const currentColor = colorOverrides[g.id] || g.baseColor
			return currentColor !== getReferenceColor(g)
		}).length
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold">
						Colores
						<span className="ml-1.5 text-xs font-medium text-primary/60">
							({MV_COLOR_GROUPS.length})
						</span>
					</h3>
					{modifiedCount > 0 && (
						<p className="text-xs text-muted-foreground">
							{modifiedCount} color{modifiedCount !== 1 ? 'es' : ''} modificado{modifiedCount !== 1 ? 's' : ''}
						</p>
					)}
				</div>
				{modifiedCount > 0 && (
					<Button variant="ghost" size="sm" onClick={onReset} className="text-xs gap-1.5">
						<RotateCcw className="w-3.5 h-3.5" />
						{resetLabel ?? 'Restaurar todos'}
					</Button>
				)}
			</div>

			{/* Always-visible summary of changed colors */}
			<ModifiedColorsSummary
				modifiedGroups={modifiedGroups}
				onColorChange={onColorChange}
			/>

			<div className="rounded-lg border border-border/60 bg-muted/35 px-3 py-2">
				<p className="text-xs text-muted-foreground">
					Haz click en el cuadrado de color de la izquierda para editar. El código de la derecha es solo referencia.
				</p>
			</div>

			<Accordion type="multiple" defaultValue={DEFAULT_OPEN} className="space-y-2">
				{CATEGORIES.map(category => {
					const groups = groupsByCategory.get(category) || []
					const catModified = getCategoryModifiedCount(category)

					return (
						<AccordionItem key={category} value={category} className="border rounded-lg px-4">
							<AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
								<span className="inline-flex items-center gap-1.5">
									<span className="text-primary">{CATEGORY_LABELS[category]}</span>
									{catModified > 0 && catModified < groups.length ? (
										<>
											<span className="text-xs text-primary/60 font-normal">
												({groups.length})
											</span>
											<span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full leading-none">
												{catModified}
											</span>
										</>
									) : (
										<span className={`text-xs font-normal ${catModified === groups.length ? 'text-primary' : 'text-primary/60'}`}>
											({groups.length})
										</span>
									)}
								</span>
							</AccordionTrigger>
							<AccordionContent>
								<div className="divide-y divide-border/50">
									{groups.map(group => {
										const currentColor = colorOverrides[group.id] || group.baseColor
										const referenceColor = getReferenceColor(group)

										return (
											<ColorGroupRow
												key={group.id}
												group={group}
												currentColor={currentColor}
												referenceColor={referenceColor}
												onChange={hex => onColorChange(group.id, hex)}
											/>
										)
									})}
								</div>
							</AccordionContent>
						</AccordionItem>
					)
				})}
			</Accordion>
		</div>
	)
}
