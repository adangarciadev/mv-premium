/**
 * Preset Gallery - Grid de presets disponibles con preview
 */
import Check from 'lucide-react/dist/esm/icons/check'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Copy from 'lucide-react/dist/esm/icons/copy'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ThemePreset } from '@/types/theme'
import { ALL_PRESETS } from '@/features/theme-editor/presets'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useThemeStore } from '../theme-store'
import { toast } from '@/lib/lazy-toast'

interface PresetGalleryProps {
	activePresetId: string
	savedPresets: ThemePreset[]
	onSelect: (id: string) => void
	onDelete?: (id: string) => void
	mode: 'light' | 'dark'
}

interface PresetCardProps {
	preset: ThemePreset
	isActive: boolean
	isCustom: boolean
	onSelect: () => void
	onDelete?: () => void
	onDuplicate: () => void
	mode: 'light' | 'dark'
}

function PresetCard({ preset, isActive, isCustom, onSelect, onDelete, onDuplicate, mode }: PresetCardProps) {
	const colors = mode === 'light' ? preset.colors.light : preset.colors.dark

	return (
		<div
			className={cn(
				'relative group rounded-lg border-2 p-3 transition-all text-left w-full cursor-pointer',
				'hover:border-primary/50 hover:shadow-md',
				isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border'
			)}
			onClick={onSelect}
		>
			{/* Preview de colores */}
			<div className="aspect-video rounded-md overflow-hidden mb-3 border relative">
				<div className="h-full w-full flex flex-col" style={{ backgroundColor: colors.background }}>
					{/* Header simulado */}
					<div className="h-4 flex items-center gap-1 px-1.5" style={{ backgroundColor: colors.sidebar }}>
						<div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.destructive }} />
						<div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.chart5 }} />
						<div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.chart4 }} />
					</div>

					{/* Content simulado */}
					<div className="flex-1 flex p-1.5 gap-1.5">
						{/* Sidebar */}
						<div className="w-1/4 rounded-sm" style={{ backgroundColor: colors.sidebar }}>
							<div className="p-1 space-y-1">
								<div className="h-1.5 rounded-sm" style={{ backgroundColor: colors.sidebarAccent }} />
								<div className="h-1.5 rounded-sm" style={{ backgroundColor: colors.sidebarPrimary }} />
								<div className="h-1.5 rounded-sm" style={{ backgroundColor: colors.sidebarAccent }} />
							</div>
						</div>

						{/* Main */}
						<div className="flex-1 space-y-1.5">
							<div className="h-2.5 rounded-sm" style={{ backgroundColor: colors.card }} />
							<div className="flex gap-1">
								<div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: colors.primary }} />
								<div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: colors.secondary }} />
							</div>
							<div className="h-5 rounded-sm" style={{ backgroundColor: colors.muted }} />
						</div>
					</div>
				</div>
			</div>

			{/* Info */}
			<div className="space-y-1">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium truncate">{preset.name}</span>
					{isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
				</div>
				{preset.description && <p className="text-xs text-muted-foreground line-clamp-1">{preset.description}</p>}
			</div>

			{/* Color swatches */}
			<div className="flex gap-1 mt-3">
				<div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: colors.primary }} />
				<div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: colors.secondary }} />
				<div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: colors.accent }} />
				<div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: colors.muted }} />
				<div className="h-2.5 flex-1 rounded-sm" style={{ backgroundColor: colors.destructive }} />
			</div>

			{/* Menu Actions (Absolute Top Right) */}
			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 bg-background/80 backdrop-blur-sm border shadow-sm"
							onClick={e => e.stopPropagation()}
						>
							<MoreHorizontal className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={e => {
								e.stopPropagation()
								onDuplicate()
							}}
						>
							<Copy className="h-3.5 w-3.5 mr-2" />
							Duplicar
						</DropdownMenuItem>

						{isCustom && onDelete && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={e => {
										e.stopPropagation()
										onDelete()
									}}
								>
									<Trash2 className="h-3.5 w-3.5 mr-2" />
									Eliminar
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	)
}

export function PresetGallery({ activePresetId, savedPresets, onSelect, onDelete, mode }: PresetGalleryProps) {
	const builtInIds = ALL_PRESETS.map(p => p.id)
	const duplicatePreset = useThemeStore(state => state.duplicatePreset)

	const handleDuplicate = (id: string, name: string) => {
		duplicatePreset(id)
		toast.success('Tema duplicado', {
			description: `Se ha creado una copia de "${name}"`,
		})
	}

	return (
		<div className="space-y-6">
			{/* Presets integrados */}
			<div>
				<h4 className="text-sm font-medium mb-3">Temas integrados</h4>
				<div className="grid grid-cols-2 gap-4">
					{ALL_PRESETS.map(preset => (
						<PresetCard
							key={preset.id}
							preset={preset}
							isActive={activePresetId === preset.id}
							isCustom={false}
							onSelect={() => onSelect(preset.id)}
							onDuplicate={() => handleDuplicate(preset.id, preset.name)}
							mode={mode}
						/>
					))}
				</div>
			</div>

			{/* Presets guardados */}
			{savedPresets.length > 0 && (
				<div>
					<h4 className="text-sm font-medium mb-3">Mis temas</h4>
					<div className="grid grid-cols-2 gap-4">
						{savedPresets.map(preset => (
							<PresetCard
								key={preset.id}
								preset={preset}
								isActive={activePresetId === preset.id}
								isCustom={!builtInIds.includes(preset.id)}
								onSelect={() => onSelect(preset.id)}
								onDelete={onDelete ? () => onDelete(preset.id) : undefined}
								onDuplicate={() => handleDuplicate(preset.id, preset.name)}
								mode={mode}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
