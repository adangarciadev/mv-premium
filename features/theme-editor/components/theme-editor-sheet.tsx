/**
 * Theme Editor Sheet - Full sidebar panel for theme customization
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import Palette from 'lucide-react/dist/esm/icons/palette'
import Shuffle from 'lucide-react/dist/esm/icons/shuffle'
import Download from 'lucide-react/dist/esm/icons/download'
import Upload from 'lucide-react/dist/esm/icons/upload'
import Save from 'lucide-react/dist/esm/icons/save'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Sun from 'lucide-react/dist/esm/icons/sun'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import FileJson from 'lucide-react/dist/esm/icons/file-json'
import Type from 'lucide-react/dist/esm/icons/type'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import Info from 'lucide-react/dist/esm/icons/info'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/lib/lazy-toast'
import { PresetGallery } from './preset-gallery'
import { ColorEditor } from './color-editor'
import { GoogleFontPicker } from './google-font-picker'
import { ContrastChecker } from './contrast-checker'
import { useThemeStore } from '../theme-store'
import { getPresetById, defaultPreset } from '@/features/theme-editor/presets'
import { DOM_MARKERS } from '@/constants/dom-markers'
import type { ThemeExport } from '@/types/theme'
import type { ColorHarmony } from '../lib/color-generator'

// Descriptions for color harmony types (standard Color Theory)
const HARMONY_DESCRIPTIONS: Record<ColorHarmony, string> = {
	complementary: 'Colores opuestos en la rueda (180°). Máximo contraste visual.',
	analogous: 'Colores vecinos (±30°). Resultado suave y armonioso.',
	triadic: '3 colores equidistantes (120°). Vibrante y equilibrado.',
	'split-complementary': 'Variación del complementario (150° y 210°). Contraste sin tensión.',
	tetradic: '4 colores en cuadrado (90°). Muy rico y variado.',
}

interface ThemeEditorSheetProps {
	trigger?: React.ReactNode
	resolvedTheme: 'light' | 'dark'
	/** Controlled open state (optional) */
	open?: boolean
	/** Controlled open change handler (optional) */
	onOpenChange?: (open: boolean) => void
}

/**
 * ThemeEditorSheet component - Main entry point for theme editing UI
 */
export function ThemeEditorSheet({ trigger, resolvedTheme, open, onOpenChange }: ThemeEditorSheetProps) {
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Internal state for uncontrolled mode
	const [internalOpen, setInternalOpen] = useState(false)

	// Use controlled or uncontrolled state
	const isOpen = open !== undefined ? open : internalOpen
	const setIsOpen = onOpenChange || setInternalOpen
	const [editMode, setEditMode] = useState<'light' | 'dark'>(resolvedTheme)
	const [savePopoverOpen, setSavePopoverOpen] = useState(false)
	const [themeName, setThemeName] = useState('')
	const [harmony, setHarmony] = useState<ColorHarmony>('complementary')
	const [customFontInput, setCustomFontInput] = useState('')

	// Usar selectores individuales para garantizar reactividad
	const isLoaded = useThemeStore(state => state.isLoaded)
	const activePresetId = useThemeStore(state => state.activePresetId)
	const customColorsLight = useThemeStore(state => state.customColorsLight)
	const customColorsDark = useThemeStore(state => state.customColorsDark)
	const customRadius = useThemeStore(state => state.customRadius)
	const customFont = useThemeStore(state => state.customFont)
	const applyFontGlobally = useThemeStore(state => state.applyFontGlobally)
	const savedPresets = useThemeStore(state => state.savedPresets)
	const loadFromStorage = useThemeStore(state => state.loadFromStorage)
	const setActivePreset = useThemeStore(state => state.setActivePreset)
	const setCustomColor = useThemeStore(state => state.setCustomColor)
	const setCustomRadius = useThemeStore(state => state.setCustomRadius)
	const setCustomFont = useThemeStore(state => state.setCustomFont)
	const setApplyFontGlobally = useThemeStore(state => state.setApplyFontGlobally)
	const resetCustomColors = useThemeStore(state => state.resetCustomColors)
	const generateRandom = useThemeStore(state => state.generateRandom)
	const saveCurrentAsPreset = useThemeStore(state => state.saveCurrentAsPreset)
	const updatePreset = useThemeStore(state => state.updatePreset)
	const deletePreset = useThemeStore(state => state.deletePreset)
	const importPresets = useThemeStore(state => state.importPresets)
	const exportAllSavedPresets = useThemeStore(state => state.exportAllSavedPresets)

	// Compute activePreset locally to ensure reactivity
	const activePreset = useMemo(() => {
		const basePreset = getPresetById(activePresetId) || savedPresets.find(p => p.id === activePresetId) || defaultPreset

		return {
			...basePreset,
			colors: {
				light: { ...basePreset.colors.light, ...customColorsLight },
				dark: { ...basePreset.colors.dark, ...customColorsDark },
			},
			radius: customRadius || basePreset.radius,
		}
	}, [activePresetId, savedPresets, customColorsLight, customColorsDark, customRadius])

	// Load from storage on open
	useEffect(() => {
		if (isOpen && !isLoaded) {
			loadFromStorage()
		}
	}, [isOpen, isLoaded, loadFromStorage])

	// Sync editMode with current theme
	useEffect(() => {
		setEditMode(resolvedTheme)
	}, [resolvedTheme])

	// Apply custom font when loaded from storage
	useEffect(() => {
		if (isLoaded && customFont) {
			applyGoogleFont(customFont)
		}
	}, [isLoaded, customFont])

	/**
	 * Injects a Google Font link tag into the head
	 */
	const applyGoogleFont = (fontName: string) => {
		// Remove previous font if exists
		const existingLink = document.getElementById(DOM_MARKERS.IDS.GOOGLE_FONT)
		if (existingLink) existingLink.remove()

		if (!fontName) {
			document.documentElement.style.removeProperty('--font-sans')
			return
		}

		// Load Google Font
		const link = document.createElement('link')
		link.id = DOM_MARKERS.IDS.GOOGLE_FONT
		link.rel = 'stylesheet'
		link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(
			/\s+/g,
			'+'
		)}:wght@400;500;600;700&display=swap`
		document.head.appendChild(link)

		// Apply to CSS variable
		document.documentElement.style.setProperty('--font-sans', `"${fontName}", system-ui, sans-serif`)
	}

	const handleFontChange = (font: string) => {
		// "default" significa restaurar la fuente por defecto
		const actualFont = font === 'default' ? '' : font
		setCustomFont(actualFont)
		applyGoogleFont(actualFont)
		toast.success(actualFont ? `Fuente cambiada a ${actualFont}` : 'Fuente restaurada por defecto')
	}

	const handleCustomFontApply = () => {
		if (customFontInput.trim()) {
			handleFontChange(customFontInput.trim())
			setCustomFontInput('')
		}
	}

	const handleGenerateRandom = () => {
		generateRandom(harmony)
		toast.success('🎲 Tema generado', {
			description: 'Previsualiza los colores. Dale a "Guardar" para conservarlo.',
		})
	}

	const handleSavePreset = (isUpdate = false) => {
		if (!themeName.trim()) {
			toast.error('Error', {
				description: 'Ingresa un nombre para el tema.',
			})
			return
		}

		if (isUpdate && activePresetId) {
			updatePreset(activePresetId, themeName)
			toast.success('✅ Tema actualizado', {
				description: `"${themeName}" se ha actualizado correctamente.`,
			})
		} else {
			saveCurrentAsPreset(themeName)
			toast.success('✅ Tema guardado', {
				description: `"${themeName}" se ha guardado en tus temas.`,
			})
		}

		setSavePopoverOpen(false)
		setThemeName('')
	}

	const handleExport = () => {
		const exported = exportAllSavedPresets()
		if (!exported) {
			toast.error('No hay temas', {
				description: 'No tienes temas personalizados para exportar.',
			})
			return
		}

		const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `mv-premium-themes-${new Date().toISOString().split('T')[0]}.json`
		a.click()
		URL.revokeObjectURL(url)

		toast.success('📦 Temas exportados', {
			description: `Se han exportado ${exported.presets.length} tema(s).`,
		})
	}

	const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = e => {
			try {
				const imported = JSON.parse(e.target?.result as string)

				// Handle new format (multiple presets)
				if (imported.presets && Array.isArray(imported.presets)) {
					importPresets(imported.presets)
					toast.success('✅ Temas importados', {
						description: `Se han importado ${imported.presets.length} tema(s).`,
					})
					return
				}

				// Handle old format (single preset)
				if (imported.preset && imported.preset.colors) {
					importPresets([imported.preset])
					toast.success('✅ Tema importado', {
						description: `"${imported.preset.name}" se ha añadido a tus temas.`,
					})
					return
				}

				throw new Error('Formato de tema inválido')
			} catch (error) {
				toast.error('Error al importar', {
					description: 'El archivo no es un tema válido.',
				})
			}
		}
		reader.readAsText(file)

		// Reset input
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleReset = () => {
		resetCustomColors()
		toast.success('↩️ Colores reseteados', {
			description: 'Se han restaurado los colores originales del preset.',
		})
	}

	const currentColors = editMode === 'light' ? activePreset.colors.light : activePreset.colors.dark

	const radiusValue = customRadius
		? parseFloat(customRadius)
		: activePreset.radius
		? parseFloat(activePreset.radius)
		: 0.625

	return (
		<>
			<Sheet open={isOpen} onOpenChange={setIsOpen}>
				{trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
				<SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" hideOverlay>
					<SheetHeader className="p-6 pb-0">
						<SheetTitle className="flex items-center gap-2">
							<Palette className="h-5 w-5" />
							Editor de Temas
						</SheetTitle>
						<SheetDescription>Personaliza los colores de la extensión o genera paletas aleatorias.</SheetDescription>
					</SheetHeader>

					<div className="p-6 pt-4 space-y-5 pb-24">
						{/* Main actions - Clear hierarchy */}
						<div className="flex items-center gap-2">
							{/* Primary action: Generate - Using Popover instead of DropdownMenu to avoid z-index conflicts */}
							<Popover>
								<PopoverTrigger asChild>
									<Button size="sm" className="gap-2 shadow-sm">
										<Sparkles className="h-4 w-4" />
										Generar Tema
									</Button>
								</PopoverTrigger>
								<PopoverContent align="start" className="w-72">
									<div className="space-y-4">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<h4 className="font-medium text-sm">Generador de Temas</h4>
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
														</TooltipTrigger>
														<TooltipContent side="right" className="max-w-xs">
															<p className="text-xs">
																Genera paletas de colores armónicas automáticamente. Los colores se ajustan para
																garantizar contraste WCAG AA (legibilidad).
															</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
											<p className="text-xs text-muted-foreground">Elige una armonía y genera una paleta aleatoria.</p>
										</div>

										<div className="space-y-2">
											<Label className="text-xs font-medium">Armonía de colores</Label>
											<Select value={harmony} onValueChange={v => setHarmony(v as ColorHarmony)}>
												<SelectTrigger className="h-9">
													<SelectValue />
												</SelectTrigger>
												<SelectContent position="popper" sideOffset={4}>
													<SelectItem value="complementary">Complementario</SelectItem>
													<SelectItem value="analogous">Análogo</SelectItem>
													<SelectItem value="triadic">Triádico</SelectItem>
													<SelectItem value="split-complementary">Split-Complementario</SelectItem>
													<SelectItem value="tetradic">Tetrádico</SelectItem>
												</SelectContent>
											</Select>
											<p className="text-xs text-muted-foreground">{HARMONY_DESCRIPTIONS[harmony]}</p>
										</div>

										<Button size="sm" className="w-full gap-2" onClick={handleGenerateRandom}>
											<Shuffle className="h-4 w-4" />
											Generar Aleatorio
										</Button>

										<p className="text-xs text-muted-foreground text-center border-t pt-3">
											💡 Pulsa "Guardar" para conservar el tema generado.
										</p>
									</div>
								</PopoverContent>
							</Popover>

							{/* Acciones secundarias */}
							<Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
								<PopoverTrigger asChild>
									<Button variant="outline" size="sm" className="gap-2">
										<Save className="h-4 w-4" />
										Guardar
									</Button>
								</PopoverTrigger>
								<PopoverContent
									className="w-72"
									align="start"
									onOpenAutoFocus={e => {
										// Prefill name if editing custom preset
										if (activePresetId.startsWith('custom-') || activePresetId.startsWith('imported-')) {
											setThemeName(activePreset.name)
										}
									}}
								>
									<div className="space-y-3">
										<div className="space-y-1">
											<h4 className="font-medium text-sm">Guardar tema</h4>
											<p className="text-xs text-muted-foreground">
												Guarda tu tema personalizado para usarlo más tarde.
											</p>
										</div>
										<div className="space-y-2">
											<Label htmlFor="save-name" className="text-xs flex justify-between">
												Nombre del tema
												<span className="text-muted-foreground font-normal font-mono text-[10px] pt-0.5">{themeName.length}/20</span>
											</Label>
											<Input
												id="save-name"
												value={themeName}
												onChange={e => setThemeName(e.target.value)}
												maxLength={20}
												placeholder="Mi tema personalizado"
												className="h-8"
												onKeyDown={e => {
													if (e.key === 'Enter') {
														e.preventDefault()
														handleSavePreset()
													}
												}}
											/>
										</div>
										<div className="flex flex-col gap-2 pt-1">
											{/* Differentiated action buttons */}
											{activePresetId.startsWith('custom-') || activePresetId.startsWith('imported-') ? (
												<>
													<Button size="sm" className="w-full" onClick={() => handleSavePreset(true)}>
														Actualizar tema
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="w-full"
														onClick={() => handleSavePreset(false)}
													>
														Guardar como nuevo
													</Button>
												</>
											) : (
												<Button size="sm" className="w-full" onClick={() => handleSavePreset(false)}>
													Guardar como nuevo
												</Button>
											)}

											<Button
												variant="ghost"
												size="sm"
												className="w-full h-8 text-xs text-muted-foreground"
												onClick={() => {
													setSavePopoverOpen(false)
													setThemeName('')
												}}
											>
												Cancelar
											</Button>
										</div>
									</div>
								</PopoverContent>
							</Popover>

							{/* Contrast Checker */}
							<ContrastChecker
								colorsLight={activePreset.colors.light}
								colorsDark={activePreset.colors.dark}
								initialMode={editMode}
							/>

							{/* More options menu */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" className="h-8 w-8">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleExport}>
										<Download className="h-4 w-4 mr-2" />
										Exportar tema
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
										<Upload className="h-4 w-4 mr-2" />
										Importar tema
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleReset} className="text-destructive focus:text-destructive">
										<RotateCcw className="h-4 w-4 mr-2" />
										Restaurar colores
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							<input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
						</div>

						{/* Tabs principales - Mejorados */}
						<Tabs defaultValue="presets" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="presets" className="gap-2">
									<Palette className="h-4 w-4" />
									Presets
								</TabsTrigger>
								<TabsTrigger value="customize" className="gap-2">
									<Settings2 className="h-4 w-4" />
									Personalizar
								</TabsTrigger>
							</TabsList>

							{/* Presets Tab */}
							<TabsContent value="presets" className="mt-6">
								<PresetGallery
									activePresetId={activePresetId}
									savedPresets={savedPresets}
									onSelect={setActivePreset}
									onDelete={deletePreset}
									mode={editMode}
								/>
							</TabsContent>

							{/* Customize Tab */}
							<TabsContent value="customize" className="mt-6 space-y-6">
								{/* Toggle Light/Dark */}
								<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
									<Label className="text-sm font-medium">Editando modo</Label>
									<div className="flex items-center gap-1 p-1 bg-background rounded-lg border">
										<Button
											variant={editMode === 'light' ? 'default' : 'ghost'}
											size="sm"
											className="h-8 px-3 gap-2"
											onClick={() => setEditMode('light')}
										>
											<Sun className="h-4 w-4" />
											Claro
										</Button>
										<Button
											variant={editMode === 'dark' ? 'default' : 'ghost'}
											size="sm"
											className="h-8 px-3 gap-2"
											onClick={() => setEditMode('dark')}
										>
											<Moon className="h-4 w-4" />
											Oscuro
										</Button>
									</div>
								</div>

								{/* Radius */}
								<div className="space-y-3 p-4 border rounded-lg">
									<div className="flex items-center justify-between">
										<Label className="text-sm font-medium">Radio de bordes</Label>
										<span className="text-sm text-muted-foreground font-mono">{radiusValue.toFixed(2)}rem</span>
									</div>
									<Slider
										value={[radiusValue]}
										onValueChange={([val]) => setCustomRadius(`${val}rem`)}
										min={0}
										max={1.5}
										step={0.0625}
										className="py-1"
									/>
									<div className="flex gap-3 pt-2">
										<div
											className="h-10 flex-1 border-2 border-primary"
											style={{ borderRadius: `${radiusValue}rem` }}
										/>
										<div className="h-10 w-10 bg-primary" style={{ borderRadius: `${radiusValue}rem` }} />
									</div>
								</div>

								{/* Font Selection */}
								<div className="space-y-3 p-4 border rounded-lg">
									<div className="flex items-center justify-between">
										<Label className="text-sm font-medium flex items-center gap-2">
											<Type className="h-4 w-4" />
											Fuente personalizada
										</Label>
										{customFont && (
											<Button
												variant="ghost"
												size="sm"
												className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
												onClick={() => handleFontChange('')}
											>
												Restablecer
											</Button>
										)}
									</div>
									<GoogleFontPicker value={customFont} onChange={handleFontChange} />
									{customFont && (
										<>
											<p
												className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md"
												style={{ fontFamily: customFont }}
											>
												Vista previa: El veloz murciélago hindú comía feliz cardillo y kiwi.
											</p>
											<div className="flex items-center gap-3 pt-2">
												<Checkbox
													id="apply-font-globally"
													checked={applyFontGlobally}
													onCheckedChange={checked => setApplyFontGlobally(checked === true)}
												/>
												<Label htmlFor="apply-font-globally" className="text-sm cursor-pointer leading-tight">
													Aplicar también a toda la web de Mediavida
												</Label>
											</div>
										</>
									)}
								</div>

								<Separator />

								{/* Color Editor */}
								<ColorEditor
									colors={currentColors}
									onColorChange={(key, value) => setCustomColor(key, value, editMode)}
									mode={editMode}
								/>
							</TabsContent>
						</Tabs>
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}
