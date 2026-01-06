/**
 * Color Editor - Group-based theme color editor
 */
import Info from 'lucide-react/dist/esm/icons/info'
import { ColorPicker } from './color-picker'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { COLOR_GROUPS, COLOR_LABELS, type ThemeColors } from '@/types/theme'

// Descriptions for each color group (used in tooltips)
const GROUP_DESCRIPTIONS: Record<string, string> = {
	core: 'Colores principales de la interfaz. El primario se usa en botones y acciones destacadas.',
	surfaces: 'Fondos de tarjetas, popovers y áreas atenuadas.',
	interactive: 'Colores para elementos interactivos, acentos y acciones destructivas.',
	borders: 'Colores de bordes, inputs y anillos de foco.',
	sidebar: 'Colores específicos para la barra lateral del dashboard.',
	charts: 'Paleta de colores para gráficos y visualizaciones de datos.',
	tables: 'Colores para tablas del foro: cabeceras, filas y bordes.',
}

interface ColorEditorProps {
	colors: ThemeColors
	onColorChange: (key: keyof ThemeColors, value: string) => void
	mode: 'light' | 'dark'
}

/**
 * ColorEditor component - Orchestrates color pickers organized by functional groups
 */
export function ColorEditor({ colors, onColorChange, mode }: ColorEditorProps) {
	// Determine contrast color based on variable type
	/**
	 * Determines contrast background color based on the variable type
	 */
	const getContrastColor = (key: keyof ThemeColors): string | undefined => {
		// Foregrounds contrast against their corresponding background
		if (key.endsWith('Foreground')) {
			const bgKey = key.replace('Foreground', '') as keyof ThemeColors
			return colors[bgKey]
		}
		// For base colors, contrast against general background
		if (['primary', 'secondary', 'accent', 'muted', 'destructive'].includes(key)) {
			return colors.background
		}
		return undefined
	}

	const groupEntries = Object.entries(COLOR_GROUPS)

	return (
		<TooltipProvider delayDuration={300}>
			<Accordion type="multiple" defaultValue={[]} className="w-full space-y-2">
				{groupEntries.map(([groupKey, group]) => (
					<AccordionItem key={groupKey} value={groupKey} className="border rounded-lg px-3">
						<AccordionTrigger className="text-sm hover:no-underline py-3">
							<div className="flex items-center gap-3">
								<span className="font-medium">{group.label}</span>
								{GROUP_DESCRIPTIONS[groupKey] && (
									<Tooltip>
										<TooltipTrigger asChild onClick={e => e.stopPropagation()}>
											<Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
										</TooltipTrigger>
										<TooltipContent side="right" className="max-w-50">
											<p className="text-xs">{GROUP_DESCRIPTIONS[groupKey]}</p>
										</TooltipContent>
									</Tooltip>
								)}
								<div className="flex gap-1 ml-auto">
									{group.keys.slice(0, 4).map(colorKey => (
										<div
											key={colorKey}
											className="h-4 w-4 rounded-sm border border-border/50"
											style={{ backgroundColor: colors[colorKey] }}
										/>
									))}
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4">
							<div className="grid grid-cols-2 gap-4 pt-3">
								{group.keys.map(colorKey => (
									<ColorPicker
										key={colorKey}
										label={COLOR_LABELS[colorKey]}
										value={colors[colorKey]}
										onChange={value => onColorChange(colorKey, value)}
										contrastAgainst={getContrastColor(colorKey)}
									/>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</TooltipProvider>
	)
}
