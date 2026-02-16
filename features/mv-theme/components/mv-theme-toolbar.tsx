/**
 * MV Theme Toolbar
 *
 * Two-zone layout:
 *   Top  → Theme identity (name, status badge, rename)
 *   Bottom → Action buttons (random, revert | save, update)
 *
 * Save-as-new form expands as a dedicated panel below with distinct background.
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { type MvThemePreset } from '../presets'
import Shuffle from 'lucide-react/dist/esm/icons/shuffle'
import Save from 'lucide-react/dist/esm/icons/save'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Pencil from 'lucide-react/dist/esm/icons/pencil'

export interface MvThemeToolbarState {
	linkedSavedPreset: MvThemePreset | null
	linkedBuiltInPreset: MvThemePreset | null
	linkedPreset: MvThemePreset | null
	isDirty: boolean
	isDetachedRandom: boolean
	hasOverrides: boolean
}

export interface MvThemeToolbarSaveFlow {
	saveDialogOpen: boolean
	presetName: string
	maxNameLength: number
	onPresetNameChange: (name: string) => void
	onOpenSaveDialog: () => void
	onSaveNew: () => void
	onCloseSavePanel: () => void
}

export interface MvThemeToolbarRenameFlow {
	isRenaming: boolean
	renameValue: string
	onRenameValueChange: (value: string) => void
	onStartRename: () => void
	onConfirmRename: () => void
	onCancelRename: () => void
}

export interface MvThemeToolbarActions {
	onGenerateRandom: () => void
	onRevertToPreset: () => void
	onResetToOriginal: () => void
	onUpdatePreset: () => void
}

type MvThemeToolbarProps = MvThemeToolbarState &
	MvThemeToolbarSaveFlow &
	MvThemeToolbarRenameFlow &
	MvThemeToolbarActions

export function MvThemeToolbar(props: MvThemeToolbarProps) {
	const {
		linkedSavedPreset,
		linkedBuiltInPreset,
		linkedPreset,
		isDirty,
		isDetachedRandom,
		hasOverrides,
		saveDialogOpen,
		presetName,
		maxNameLength,
		onPresetNameChange,
		onOpenSaveDialog,
		onSaveNew,
		onCloseSavePanel,
		isRenaming,
		renameValue,
		onRenameValueChange,
		onStartRename,
		onConfirmRename,
		onCancelRename,
		onGenerateRandom,
		onRevertToPreset,
		onResetToOriginal,
		onUpdatePreset,
	} = props

	// Accent stripe color for left border
	const accentBorder = linkedSavedPreset
		? isDirty
			? 'border-l-amber-500'
			: 'border-l-primary'
		: hasOverrides
		? 'border-l-muted-foreground/40'
		: 'border-l-transparent'

	return (
		<div className="space-y-0">
			{/* ── Main toolbar card ──────────────────────────────────── */}
			<div
				className={`rounded-lg border bg-card text-card-foreground shadow-sm border-l-4 ${accentBorder} transition-colors`}
			>
				{/* ── Theme identity zone ─────────────────────────────── */}
				<div className="px-4 py-3">
					<ThemeIdentity
						linkedSavedPreset={linkedSavedPreset}
						linkedBuiltInPreset={linkedBuiltInPreset}
						isDirty={isDirty}
						isDetachedRandom={isDetachedRandom}
						hasOverrides={hasOverrides}
						isRenaming={isRenaming}
						renameValue={renameValue}
						maxNameLength={maxNameLength}
						onRenameValueChange={onRenameValueChange}
						onStartRename={onStartRename}
						onConfirmRename={onConfirmRename}
						onCancelRename={onCancelRename}
					/>
				</div>

				{/* ── Separator ────────────────────────────────────────── */}
				<div className="border-t border-border/50" />

				{/* ── Actions zone ─────────────────────────────────────── */}
				<div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
					{/* Left: Creative actions */}
					<Button
						variant="outline"
						size="sm"
						onClick={onGenerateRandom}
						className="gap-1.5"
						title="Generar combinacion aleatoria con contraste legible"
					>
						<Shuffle className="w-3.5 h-3.5" />
						Aleatorio
					</Button>

					{isDirty && linkedPreset && (
						<Button variant="outline" size="sm" onClick={onRevertToPreset} className="gap-1.5">
							<RotateCcw className="w-3.5 h-3.5" />
							Deshacer
						</Button>
					)}

					{hasOverrides && !linkedPreset && (
						<Button variant="ghost" size="sm" onClick={onResetToOriginal} className="gap-1.5 text-muted-foreground">
							<RotateCcw className="w-3.5 h-3.5" />
							Restaurar original
						</Button>
					)}

					<div className="flex-1" />

					{/* Right: Persistence actions */}
					{linkedSavedPreset && isDirty && (
						<Button size="sm" onClick={onUpdatePreset} className="gap-1.5">
							<Save className="w-3.5 h-3.5" />
							Actualizar preset
						</Button>
					)}

					{hasOverrides && (
						<Button
							variant={saveDialogOpen ? 'secondary' : linkedSavedPreset ? 'outline' : 'default'}
							size="sm"
							onClick={saveDialogOpen ? onCloseSavePanel : onOpenSaveDialog}
							className="gap-1.5"
						>
							<Save className="w-3.5 h-3.5" />
							{saveDialogOpen ? 'Cancelar' : 'Guardar como nuevo'}
						</Button>
					)}
				</div>
			</div>

			{/* ── Save form panel (slides below toolbar) ─────────── */}
			{saveDialogOpen && (
				<div className="rounded-b-lg border border-t-0 bg-muted/40 px-4 py-3 -mt-[1px]">
					<p className="text-xs text-muted-foreground mb-2">
						Elige un nombre para tu nuevo tema (solo letras, números, guion y guion bajo)
					</p>
					<div className="flex items-center gap-2">
						<div className="relative flex-1 max-w-xs">
							<Input
								value={presetName}
								onChange={e =>
									onPresetNameChange(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, maxNameLength))
								}
								maxLength={maxNameLength}
								pattern="[A-Za-z0-9_-]+"
								placeholder="mi_tema_personalizado"
								className="h-9 pr-12 text-sm"
								onKeyDown={e => {
									if (e.key === 'Enter') onSaveNew()
									if (e.key === 'Escape') onCloseSavePanel()
								}}
								autoFocus
							/>
							<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 tabular-nums">
								{presetName.length}/{maxNameLength}
							</span>
						</div>
						<Button size="sm" onClick={onSaveNew} disabled={!presetName.trim()} className="gap-1.5">
							<Save className="w-3.5 h-3.5" />
							Guardar
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}

// ── Theme Identity ─────────────────────────────────────────────────────────

function ThemeIdentity({
	linkedSavedPreset,
	linkedBuiltInPreset,
	isDirty,
	isDetachedRandom,
	hasOverrides,
	isRenaming,
	renameValue,
	maxNameLength,
	onRenameValueChange,
	onStartRename,
	onConfirmRename,
	onCancelRename,
}: {
	linkedSavedPreset: MvThemePreset | null
	linkedBuiltInPreset: MvThemePreset | null
	isDirty: boolean
	isDetachedRandom: boolean
	hasOverrides: boolean
	isRenaming: boolean
	renameValue: string
	maxNameLength: number
	onRenameValueChange: (value: string) => void
	onStartRename: () => void
	onConfirmRename: () => void
	onCancelRename: () => void
}) {
	// ── User-saved preset ────────────────────────────────────
	if (linkedSavedPreset) {
		return (
			<div className="space-y-2">
				<div className="flex flex-wrap items-start justify-between gap-3 min-h-[32px]">
					<div className="min-w-0">
						<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Preset guardado</p>
						<p className="text-sm font-semibold leading-tight truncate">{linkedSavedPreset.name}</p>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{!isRenaming && (
							<Button type="button" variant="outline" size="sm" onClick={onStartRename} className="h-8 gap-1.5">
								<Pencil className="w-3.5 h-3.5" />
								Renombrar
							</Button>
						)}
					</div>
				</div>
				{!isRenaming && isDirty && (
					<p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
						Tienes cambios sin guardar en este preset.
					</p>
				)}

				{isRenaming && (
					<div className="rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-2">
						<div className="flex items-center gap-2">
							<div className="relative w-full max-w-[260px]">
								<Input
									value={renameValue}
									onChange={e =>
										onRenameValueChange(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, maxNameLength))
									}
									maxLength={maxNameLength}
									pattern="[A-Za-z0-9_-]+"
									placeholder="mi_preset"
									className="h-8 text-sm font-semibold pr-10"
									onKeyDown={e => {
										if (e.key === 'Enter') onConfirmRename()
										if (e.key === 'Escape') onCancelRename()
									}}
									autoFocus
								/>
								<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 tabular-nums">
									{renameValue.length}/{maxNameLength}
								</span>
							</div>
							<Button type="button" size="sm" onClick={onConfirmRename} className="h-8 gap-1.5">
								<Check className="w-3.5 h-3.5" />
								Guardar
							</Button>
							<Button type="button" variant="outline" size="sm" onClick={onCancelRename} className="h-8 gap-1.5">
								<X className="w-3.5 h-3.5" />
								Cancelar
							</Button>
						</div>
						<p className="text-[11px] text-muted-foreground">Solo letras, números, guion y guion bajo.</p>
					</div>
				)}
			</div>
		)
	}

	// ── Built-in preset ──────────────────────────────────────
	if (linkedBuiltInPreset) {
		return (
			<div className="flex items-center gap-2 min-h-[32px]">
				<span className="text-sm">
					Base: <span className="font-semibold">{linkedBuiltInPreset.name}</span>
				</span>
				<Badge variant="outline" className="text-[10px] px-2">
					Preset integrado
				</Badge>
			</div>
		)
	}

	// ── Detached random ──────────────────────────────────────
	if (isDetachedRandom) {
		return (
			<div className="flex items-center gap-2 min-h-[32px]">
				<Shuffle className="w-3.5 h-3.5 text-muted-foreground" />
				<span className="text-sm font-medium">Tema aleatorio</span>
				<Badge
					variant="outline"
					className="text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 text-[10px] px-2"
				>
					Sin guardar
				</Badge>
			</div>
		)
	}

	// ── Manual custom (no preset linked) ─────────────────────
	if (hasOverrides) {
		return (
			<div className="flex items-center gap-2 min-h-[32px]">
				<span className="text-sm font-medium">Tema personalizado</span>
				<Badge
					variant="outline"
					className="text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 text-[10px] px-2"
				>
					Sin guardar
				</Badge>
			</div>
		)
	}

	// ── No theme active ──────────────────────────────────────
	return (
		<div className="flex items-center gap-2 min-h-[32px]">
			<span className="text-sm text-muted-foreground">Tema original de Mediavida</span>
		</div>
	)
}
