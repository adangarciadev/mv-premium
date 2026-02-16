/**
 * MV Theme Preset Gallery
 *
 * Grid of visual theme previews for quick selection.
 * Shows built-in presets and user-saved presets.
 */
import { MV_BUILTIN_PRESETS, type MvThemePreset } from '../presets'
import { MV_COLOR_GROUPS } from '../logic/color-groups'
import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Download from 'lucide-react/dist/esm/icons/download'
import EllipsisVertical from 'lucide-react/dist/esm/icons/ellipsis-vertical'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Upload from 'lucide-react/dist/esm/icons/upload'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MvThemePresetGalleryProps {
	activePresetId: string
	savedPresets: MvThemePreset[]
	onSelect: (presetId: string) => void
	onCopy: (presetId: string) => void
	onExport: (presetId: string) => void
	onImport: () => void
	onDelete?: (presetId: string) => void
}

/**
 * Get the effective color for a group from preset overrides
 */
function getPresetColor(preset: MvThemePreset, groupId: string): string {
	if (preset.colors[groupId]) return preset.colors[groupId]
	const group = MV_COLOR_GROUPS.find(g => g.id === groupId)
	return group?.baseColor ?? '#000000'
}

/**
 * Preview card showing a miniature representation of the theme
 */
/**
 * Preview card showing a miniature representation of the theme.
 * The "original" preset (empty colors) shows the MVP logo instead of
 * a color mockup since the actual theme depends on the user's MV profile.
 */
function PresetCard({
	preset,
	isActive,
	onSelect,
	onCopy,
	onExport,
	onDelete,
}: {
	preset: MvThemePreset
	isActive: boolean
	onSelect: () => void
	onCopy?: () => void
	onExport?: () => void
	onDelete?: () => void
}) {
	const hasFixedColors = Object.keys(preset.colors).length > 0
	const showActions = preset.id !== 'original'

	return (
		<div className="relative group/preset">
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					'text-left w-full rounded-xl border transition-all duration-200 overflow-hidden bg-card',
					'hover:ring-2 hover:ring-primary/30 hover:shadow-md',
					isActive ? 'border-primary ring-2 ring-primary/25 shadow-md' : 'border-border hover:border-primary/50'
				)}
			>
				{/* Active indicator */}
				{isActive && (
					<div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 shadow-sm">
						<Check className="w-3 h-3 text-primary-foreground" />
						<span className="text-[10px] font-semibold text-primary-foreground uppercase tracking-wide">Activo</span>
					</div>
				)}

				{/* Preview area */}
				{hasFixedColors ? (
					<ThemeMockup preset={preset} />
				) : (
					<OriginalThemePreview />
				)}

				{/* Footer */}
				<div className="px-3.5 py-3 border-t-2 border-border bg-muted flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sm font-semibold truncate leading-tight">{preset.name}</p>
						<p className="text-xs text-muted-foreground truncate mt-1 leading-tight">{preset.description}</p>
					</div>
					{hasFixedColors && (
						<div className="flex gap-1 shrink-0">
							{[
								getPresetColor(preset, 'page-bg'),
								getPresetColor(preset, 'container-bg'),
								getPresetColor(preset, 'accent'),
								getPresetColor(preset, 'link'),
								getPresetColor(preset, 'text-primary'),
							].map((color, i) => (
								<div
									key={i}
									className="w-3.5 h-3.5 rounded-full border border-border/60"
									style={{ backgroundColor: color }}
								/>
							))}
						</div>
					)}
				</div>
			</button>

			{/* Card actions menu */}
			{showActions && (
				<CardActions
					presetName={preset.name}
					onCopy={onCopy ?? (() => {})}
					onExport={onExport}
					onDelete={onDelete}
				/>
			)}
		</div>
	)
}

/** Color mockup for presets that define colors */
function ThemeMockup({ preset }: { preset: MvThemePreset }) {
	const pageBg = getPresetColor(preset, 'page-bg')
	const containerBg = getPresetColor(preset, 'container-bg')
	const containerAlt = getPresetColor(preset, 'container-alt')
	const textPrimary = getPresetColor(preset, 'text-primary')
	const textMuted = getPresetColor(preset, 'text-muted')
	const accent = getPresetColor(preset, 'accent')
	const link = getPresetColor(preset, 'link')
	const borderColor = getPresetColor(preset, 'border-3d')

	return (
		<div className="w-full aspect-[16/10] p-2.5" style={{ backgroundColor: pageBg }}>
			<div
				className="h-3 rounded-sm mb-1.5 flex items-center gap-1 px-1"
				style={{ backgroundColor: containerBg, borderBottom: `1px solid ${borderColor}` }}
			>
				<div className="w-4 h-1.5 rounded-sm" style={{ backgroundColor: accent }} />
				<div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: textMuted }} />
			</div>
			<div className="flex gap-1 h-[calc(100%-1rem)]">
				<div className="w-1/4 rounded-sm p-1 space-y-1" style={{ backgroundColor: containerAlt }}>
					<div className="h-1 rounded-full w-3/4" style={{ backgroundColor: textMuted }} />
					<div className="h-1 rounded-full w-1/2" style={{ backgroundColor: textMuted }} />
					<div className="h-1 rounded-full w-2/3" style={{ backgroundColor: link }} />
				</div>
				<div className="flex-1 space-y-1 p-1">
					{[0, 1].map(i => (
						<div key={i} className="rounded-sm p-1 space-y-0.5" style={{ backgroundColor: containerBg }}>
							<div className="h-1 rounded-full w-1/3" style={{ backgroundColor: accent }} />
							<div className="h-0.5 rounded-full w-full" style={{ backgroundColor: textPrimary, opacity: 0.5 }} />
							<div className="h-0.5 rounded-full w-3/4" style={{ backgroundColor: textMuted, opacity: 0.5 }} />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

/** Placeholder for "original" preset - shows MVP logo */
function OriginalThemePreview() {
	return (
		<div className="w-full aspect-[16/10] bg-card flex items-center justify-center">
			<img
				src="/icon/128.png"
				alt="MV Premium"
				className="w-16 h-16 object-contain opacity-50"
			/>
		</div>
	)
}

function CardActions({
	presetName,
	onCopy,
	onExport,
	onDelete,
}: {
	presetName: string
	onCopy: () => void
	onExport?: () => void
	onDelete?: () => void
}) {
	const handleCopy = () => {
		onCopy()
	}

	const handleExport = () => {
		onExport?.()
	}

	const handleDelete = () => {
		onDelete?.()
	}

	const stopCardSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation()
	}

	return (
		<div className="absolute top-2 right-2 z-20">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`Más acciones para ${presetName}`}
						className={cn(
							'inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/35 text-white/95 shadow-sm backdrop-blur-sm',
							'hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
						)}
						onClick={stopCardSelection}
					>
						<EllipsisVertical className="h-4 w-4" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem onSelect={handleCopy}>
						<Copy className="h-4 w-4" />
						Copiar
					</DropdownMenuItem>
					{onExport && (
						<DropdownMenuItem onSelect={handleExport}>
							<Download className="h-4 w-4" />
							Exportar
						</DropdownMenuItem>
					)}
					{onDelete && (
						<DropdownMenuItem onSelect={handleDelete} variant="destructive">
							<Trash2 className="h-4 w-4" />
							Eliminar
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}

export function MvThemePresetGallery({
	activePresetId,
	savedPresets,
	onSelect,
	onCopy,
	onExport,
	onImport,
	onDelete,
}: MvThemePresetGalleryProps) {
	return (
		<div className="space-y-5">
			{/* Built-in presets */}
			<div className="rounded-xl border bg-card/40 p-4 space-y-4">
				<div>
					<h4 className="text-sm font-semibold">
						Temas integrados
						<span className="ml-1.5 text-xs font-medium text-muted-foreground">({MV_BUILTIN_PRESETS.length})</span>
					</h4>
					<p className="text-xs text-muted-foreground mt-0.5">Presets base para empezar rápido.</p>
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
					{MV_BUILTIN_PRESETS.map(preset => (
						<PresetCard
							key={preset.id}
							preset={preset}
							isActive={activePresetId === preset.id}
							onSelect={() => onSelect(preset.id)}
							onCopy={preset.id === 'original' ? undefined : () => onCopy(preset.id)}
						/>
					))}
				</div>
			</div>

			{/* User-saved presets */}
			<div className="rounded-xl border bg-card/40 p-4 space-y-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h4 className="text-sm font-semibold">
							Mis temas
							<span className="ml-1.5 text-xs font-medium text-muted-foreground">({savedPresets.length})</span>
						</h4>
						<p className="text-xs text-muted-foreground mt-0.5">Tus presets guardados y listos para reutilizar.</p>
					</div>
					<Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={onImport}>
						<Upload className="h-4 w-4" />
						Importar
					</Button>
				</div>
				{savedPresets.length > 0 ? (
					<div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
						{savedPresets.map(preset => (
							<PresetCard
								key={preset.id}
								preset={preset}
								isActive={activePresetId === preset.id}
								onSelect={() => onSelect(preset.id)}
								onCopy={() => onCopy(preset.id)}
								onExport={Object.keys(preset.colors).length > 0 ? () => onExport(preset.id) : undefined}
								onDelete={onDelete ? () => onDelete(preset.id) : undefined}
							/>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground rounded-lg border border-dashed px-3 py-4">
						Aún no tienes temas guardados.
					</p>
				)}
			</div>
		</div>
	)
}
