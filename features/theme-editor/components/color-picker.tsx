/**
 * Color Picker - Selector de color con soporte OKLCH y preview
 */
import { useState, useEffect, useCallback } from 'react'
import Info from 'lucide-react/dist/esm/icons/info'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { hexToOklch, oklchToHex, createOklch, getContrast } from '../lib/color-generator'
import { cn } from '@/lib/utils'

const WCAG_EXPLANATION = `El ratio de contraste WCAG mide la legibilidad del texto:
• 7:1+ (AAA) - Óptimo para cualquier tamaño de texto
• 4.5:1+ (AA) - Mínimo recomendado para texto normal
• 3:1+ (AA grande) - Solo válido para texto grande (18pt+)
• <3:1 - Insuficiente, puede ser difícil de leer`

interface ColorPickerProps {
	value: string
	onChange: (value: string) => void
	label?: string
	contrastAgainst?: string // Color para mostrar contraste
}

export function ColorPicker({ value, onChange, label, contrastAgainst }: ColorPickerProps) {
	const [hexValue, setHexValue] = useState(value)
	const [oklchValues, setOklchValues] = useState({ l: 0.5, c: 0.1, h: 0 })
	const [isOpen, setIsOpen] = useState(false)

	// Sincronizar cuando cambia el valor externo
	useEffect(() => {
		setHexValue(value)
		const oklch = hexToOklch(value)
		if (oklch) {
			setOklchValues({
				l: oklch.l ?? 0.5,
				c: oklch.c ?? 0.1,
				h: oklch.h ?? 0,
			})
		}
	}, [value])

	// Actualizar desde hex input
	const handleHexChange = useCallback(
		(hex: string) => {
			setHexValue(hex)
			if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
				onChange(hex)
				const oklch = hexToOklch(hex)
				if (oklch) {
					setOklchValues({
						l: oklch.l ?? 0.5,
						c: oklch.c ?? 0.1,
						h: oklch.h ?? 0,
					})
				}
			}
		},
		[onChange]
	)

	// Actualizar desde sliders OKLCH
	const handleOklchChange = useCallback(
		(key: 'l' | 'c' | 'h', val: number) => {
			const newValues = { ...oklchValues, [key]: val }
			setOklchValues(newValues)
			const hex = oklchToHex(createOklch(newValues.l, newValues.c, newValues.h))
			setHexValue(hex)
			onChange(hex)
		},
		[oklchValues, onChange]
	)

	const contrast = contrastAgainst ? getContrast(value, contrastAgainst) : null
	const contrastRating = contrast
		? contrast >= 7
			? 'AAA'
			: contrast >= 4.5
			? 'AA'
			: contrast >= 3
			? 'AA (grande)'
			: 'Insuficiente'
		: null

	return (
		<div className="space-y-1.5">
			{label && <Label className="text-xs">{label}</Label>}
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" className="w-full justify-start gap-2 h-9 px-2">
						<div className="h-5 w-5 rounded border border-border shrink-0" style={{ backgroundColor: value }} />
						<span className="font-mono text-xs truncate">{value}</span>
						{contrast !== null && (
							<span
								className={cn(
									'ml-auto text-xs',
									contrast >= 4.5 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
								)}
							>
								{contrast.toFixed(1)}:1
							</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-72" align="start">
					<div className="space-y-4">
						{/* Preview */}
						<div className="flex gap-2">
							<div className="h-16 flex-1 rounded-md border" style={{ backgroundColor: value }} />
							{contrastAgainst && (
								<div
									className="h-16 flex-1 rounded-md border flex items-center justify-center text-sm font-medium"
									style={{
										backgroundColor: contrastAgainst,
										color: value,
									}}
								>
									Texto
								</div>
							)}
						</div>

						{/* Contraste */}
						{contrast !== null && (
							<TooltipProvider delayDuration={200}>
								<div className="flex items-center justify-between text-xs">
									<span className="text-muted-foreground flex items-center gap-1">
										Contraste WCAG
										<Tooltip>
											<TooltipTrigger asChild>
												<Info className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-help" />
											</TooltipTrigger>
											<TooltipContent side="bottom" className="max-w-55">
												<p className="text-xs whitespace-pre-line">{WCAG_EXPLANATION}</p>
											</TooltipContent>
										</Tooltip>
									</span>
									<span
										className={cn(
											'font-medium',
											contrast >= 4.5 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
										)}
									>
										{contrast.toFixed(2)}:1 ({contrastRating})
									</span>
								</div>
							</TooltipProvider>
						)}

						{/* Hex Input */}
						<div className="space-y-1.5">
							<Label className="text-xs">Hex</Label>
							<Input
								value={hexValue}
								onChange={e => handleHexChange(e.target.value)}
								className="font-mono h-8"
								placeholder="#000000"
							/>
						</div>

						{/* Lightness Slider */}
						<div className="space-y-1.5">
							<div className="flex justify-between">
								<Label className="text-xs">Luminosidad</Label>
								<span className="text-xs text-muted-foreground">{(oklchValues.l * 100).toFixed(0)}%</span>
							</div>
							<Slider
								value={[oklchValues.l]}
								onValueChange={([val]) => handleOklchChange('l', val)}
								min={0}
								max={1}
								step={0.01}
								className="py-1"
							/>
						</div>

						{/* Chroma Slider */}
						<div className="space-y-1.5">
							<div className="flex justify-between">
								<Label className="text-xs">Saturación</Label>
								<span className="text-xs text-muted-foreground">{(oklchValues.c * 100).toFixed(0)}%</span>
							</div>
							<Slider
								value={[oklchValues.c]}
								onValueChange={([val]) => handleOklchChange('c', val)}
								min={0}
								max={0.4}
								step={0.005}
								className="py-1"
							/>
						</div>

						{/* Hue Slider */}
						<div className="space-y-1.5">
							<div className="flex justify-between">
								<Label className="text-xs">Tono</Label>
								<span className="text-xs text-muted-foreground">{oklchValues.h.toFixed(0)}°</span>
							</div>
							<div
								className="h-3 rounded-md"
								style={{
									background:
										'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
								}}
							/>
							<Slider
								value={[oklchValues.h]}
								onValueChange={([val]) => handleOklchChange('h', val)}
								min={0}
								max={360}
								step={1}
								className="py-1"
							/>
						</div>

						{/* Native Color Picker */}
						<div className="pt-2 border-t">
							<Label className="text-xs mb-1.5 block">Selector nativo</Label>
							<input
								type="color"
								value={value}
								onChange={e => handleHexChange(e.target.value)}
								className="w-full h-8 rounded cursor-pointer"
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}
