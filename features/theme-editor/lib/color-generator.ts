/**
 * Color Generator - Generation of harmonic color palettes with OKLCH
 *
 * Uses color-utils-lite for perceptually uniform color manipulation.
 * Lightweight replacement for culori (~5KB vs ~100KB).
 * Ensures WCAG AA contrast (4.5:1 for normal text, 3:1 for large text).
 */
import { oklch, hexToOklch, oklchToHex, wcagContrast, parse, formatHex, type Oklch } from './color-utils-lite'
import type { ThemeColors, ThemePreset } from '@/types/theme'

// Re-export for external usage
export { hexToOklch, oklchToHex, type Oklch }

// ============================================================================
// TYPES
// ============================================================================

export type ColorHarmony =
	| 'complementary' // Opposite colors (180°)
	| 'analogous' // Adjacent colors (±30°)
	| 'triadic' // 3 equidistant colors (120°)
	| 'split-complementary' // Split complementary (150° and 210°)
	| 'tetradic' // 4 colors (90°)

export interface GeneratorOptions {
	harmony?: ColorHarmony
	baseHue?: number // 0-360, random if not specified
	saturation?: number // 0-0.4 for OKLCH
	seedName?: string // Name for the generated preset
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Converts any color string to hex format
 * @param color - Input color string
 * @returns Hex representation
 */
export function toHex(color: string): string {
	const parsed = parse(color)
	if (!parsed) return color
	return formatHex(parsed) || color
}

/**
 * Creates an OKLCH color object
 * @param l - Lightness
 * @param c - Chroma
 * @param h - Hue
 * @returns Oklch object
 */
export function createOklch(l: number, c: number, h: number): Oklch {
	return oklch(l, c, h)
}

/**
 * Calculates WCAG contrast ratio between two colors
 * @param color1 - First color
 * @param color2 - Second color
 * @returns Contrast ratio
 */
export function getContrast(color1: string, color2: string): number {
	return wcagContrast(color1, color2)
}

/**
 * Verifies if the contrast holds up to WCAG AA standards
 * @param foreground - Text color
 * @param background - Background color
 * @param largeText - Whether the text is large (lower threshold)
 * @returns True if compliant
 */
export function meetsWcagAA(foreground: string, background: string, largeText = false): boolean {
	const contrast = getContrast(foreground, background)
	return largeText ? contrast >= 3 : contrast >= 4.5
}

/**
 * Adjusts color lightness to guarantee WCAG AA contrast
 * @param foreground - Foreground color to adjust
 * @param background - Fixed background color
 * @param minContrast - Threshold (default 4.5)
 * @returns Adjusted hex color
 */
export function ensureContrast(foreground: string, background: string, minContrast = 4.5): string {
	const fgOklch = hexToOklch(foreground)
	const bgOklch = hexToOklch(background)

	if (!fgOklch || !bgOklch) return foreground

	let currentContrast = getContrast(foreground, background)
	if (currentContrast >= minContrast) return foreground

	// Determine adjustment direction based on background lightness
	const direction = bgOklch.l > 0.5 ? -1 : 1

	// Iteratively adjust lightness
	let adjustedFg = { ...fgOklch }
	let iterations = 0
	const maxIterations = 50

	while (currentContrast < minContrast && iterations < maxIterations) {
		adjustedFg.l = Math.max(0, Math.min(1, adjustedFg.l + direction * 0.02))
		const newHex = oklchToHex(adjustedFg)
		currentContrast = getContrast(newHex, background)
		iterations++

		// If we reach the limits without sufficient contrast, go to extremes
		if (adjustedFg.l <= 0.05 || adjustedFg.l >= 0.95) {
			adjustedFg.l = direction === -1 ? 0.05 : 0.95
			break
		}
	}

	return oklchToHex(adjustedFg)
}

// ============================================================================
// HARMONY GENERATION
// ============================================================================

/**
 * Computes a set of harmonic hues based on a base hue and a harmony strategy.
 * @param baseHue - The starting hue in degrees (0-360)
 * @param harmony - The geometric harmony type to apply
 * @returns Array of relative hues
 */
function getHarmonyHues(baseHue: number, harmony: ColorHarmony): number[] {
	const normalize = (h: number) => ((h % 360) + 360) % 360

	switch (harmony) {
		case 'complementary':
			return [baseHue, normalize(baseHue + 180)]
		case 'analogous':
			return [normalize(baseHue - 30), baseHue, normalize(baseHue + 30)]
		case 'triadic':
			return [baseHue, normalize(baseHue + 120), normalize(baseHue + 240)]
		case 'split-complementary':
			return [baseHue, normalize(baseHue + 150), normalize(baseHue + 210)]
		case 'tetradic':
			return [baseHue, normalize(baseHue + 90), normalize(baseHue + 180), normalize(baseHue + 270)]
		default:
			return [baseHue]
	}
}

/**
 * Generates a consistent 5-color chart palette based on the theme's base hue.
 * @param baseHue - The primary theme hue
 * @param isDark - Whether to generate colors for dark mode context
 */
function generateChartColors(
	baseHue: number,
	isDark: boolean
): Pick<ThemeColors, 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5'> {
	const baseLightness = isDark ? 0.65 : 0.55
	const chroma = isDark ? 0.15 : 0.18

	return {
		chart1: oklchToHex(createOklch(baseLightness, chroma, baseHue)),
		chart2: oklchToHex(createOklch(baseLightness, chroma, (baseHue + 72) % 360)),
		chart3: oklchToHex(createOklch(baseLightness, chroma, (baseHue + 144) % 360)),
		chart4: oklchToHex(createOklch(baseLightness, chroma, (baseHue + 216) % 360)),
		chart5: oklchToHex(createOklch(baseLightness, chroma, (baseHue + 288) % 360)),
	}
}

// ============================================================================
// THEME GENERATION
// ============================================================================

type TableStyle = 'standard' | 'strong' | 'vibrant' | 'subtle'

/**
 * Orchestrates the generation of all colors for the Light Mode preset.
 * @param hues - The semantic hues to use for the palette
 * @param saturation - The base saturation level
 * @param tableStyle - The style variation for tables
 * @returns A complete set of theme colors
 */
function generateLightColors(hues: number[], saturation: number, tableStyle: TableStyle = 'standard'): ThemeColors {
	const [primaryHue, accentHue = primaryHue + 180] = hues

	// Colores base
	const background = oklchToHex(createOklch(0.995, 0.002, primaryHue))
	const foreground = oklchToHex(createOklch(0.15, 0.01, primaryHue))

	// Colores principales
	const primary = oklchToHex(createOklch(0.45, saturation, primaryHue))
	const primaryForeground = ensureContrast('#ffffff', primary)

	// Secondary (more subtle)
	const secondary = oklchToHex(createOklch(0.94, 0.02, primaryHue))
	const secondaryForeground = ensureContrast(foreground, secondary)

	// Muted
	const muted = oklchToHex(createOklch(0.96, 0.01, primaryHue))
	const mutedForeground = oklchToHex(createOklch(0.45, 0.02, primaryHue))

	// Accent
	const accent = oklchToHex(createOklch(0.92, 0.03, accentHue))
	const accentForeground = ensureContrast(foreground, accent)

	// Destructive
	const destructive = oklchToHex(createOklch(0.55, 0.22, 25))
	const destructiveForeground = ensureContrast('#ffffff', destructive)

	// Borders
	const border = oklchToHex(createOklch(0.9, 0.01, primaryHue))
	const input = oklchToHex(createOklch(0.9, 0.01, primaryHue))
	const ring = primary

	// Card & Popover
	const card = background
	const cardForeground = foreground
	const popover = background
	const popoverForeground = foreground

	// Sidebar
	const sidebar = oklchToHex(createOklch(0.98, 0.005, primaryHue))
	const sidebarForeground = foreground
	const sidebarPrimary = primary
	const sidebarPrimaryForeground = primaryForeground
	const sidebarAccent = accent
	const sidebarAccentForeground = accentForeground
	const sidebarBorder = border
	const sidebarRing = ring

	// Charts
	const charts = generateChartColors(primaryHue, false)

	// Tables
	let tableHeader, tableHeaderForeground

	switch (tableStyle) {
		case 'strong':
			tableHeader = primary
			tableHeaderForeground = primaryForeground
			break
		case 'vibrant':
			tableHeader = accent
			tableHeaderForeground = accentForeground
			break
		case 'subtle':
			tableHeader = muted
			tableHeaderForeground = mutedForeground
			break
		case 'standard':
		default:
			tableHeader = secondary
			tableHeaderForeground = secondaryForeground
			break
	}

	const tableRow = background
	const tableRowAlt = oklchToHex(createOklch(0.985, 0.005, primaryHue))
	const tableRowForeground = foreground
	const tableBorder = border

	return {
		background,
		foreground,
		card,
		cardForeground,
		popover,
		popoverForeground,
		primary,
		primaryForeground,
		secondary,
		secondaryForeground,
		muted,
		mutedForeground,
		accent,
		accentForeground,
		destructive,
		destructiveForeground,
		border,
		input,
		ring,
		sidebar,
		sidebarForeground,
		sidebarPrimary,
		sidebarPrimaryForeground,
		sidebarAccent,
		sidebarAccentForeground,
		sidebarBorder,
		sidebarRing,
		...charts,
		tableHeader,
		tableHeaderForeground,
		tableRow,
		tableRowAlt,
		tableRowForeground,
		tableBorder,
	}
}

/**
 * Orchestrates the generation of all colors for the Dark Mode preset.
 * @param hues - The semantic hues to use for the palette
 * @param saturation - The base saturation level
 * @param tableStyle - The style variation for tables
 * @returns A complete set of theme colors
 */
function generateDarkColors(hues: number[], saturation: number, tableStyle: TableStyle = 'standard'): ThemeColors {
	const [primaryHue, accentHue = primaryHue + 180] = hues

	// Colores base
	const background = oklchToHex(createOklch(0.13, 0.015, primaryHue))
	const foreground = oklchToHex(createOklch(0.95, 0.01, primaryHue))

	// Colores principales
	const primary = oklchToHex(createOklch(0.75, saturation * 0.8, primaryHue))
	const primaryForeground = ensureContrast(oklchToHex(createOklch(0.15, 0.02, primaryHue)), primary)

	// Secundario
	const secondary = oklchToHex(createOklch(0.22, 0.025, primaryHue))
	const secondaryForeground = ensureContrast(foreground, secondary)

	// Muted
	const muted = oklchToHex(createOklch(0.2, 0.02, primaryHue))
	const mutedForeground = oklchToHex(createOklch(0.6, 0.02, primaryHue))

	// Accent
	const accent = oklchToHex(createOklch(0.25, 0.03, accentHue))
	const accentForeground = ensureContrast(foreground, accent)

	// Destructive
	const destructive = oklchToHex(createOklch(0.65, 0.2, 25))
	const destructiveForeground = ensureContrast(oklchToHex(createOklch(0.15, 0.02, 25)), destructive)

	// Borders
	const border = oklchToHex(createOklch(0.28, 0.02, primaryHue))
	const input = oklchToHex(createOklch(0.28, 0.02, primaryHue))
	const ring = oklchToHex(createOklch(0.55, 0.04, primaryHue))

	// Card & Popover
	const card = oklchToHex(createOklch(0.17, 0.02, primaryHue))
	const cardForeground = foreground
	const popover = card
	const popoverForeground = foreground

	// Sidebar
	const sidebar = oklchToHex(createOklch(0.15, 0.018, primaryHue))
	const sidebarForeground = foreground
	const sidebarPrimary = primary
	const sidebarPrimaryForeground = primaryForeground
	const sidebarAccent = accent
	const sidebarAccentForeground = accentForeground
	const sidebarBorder = border
	const sidebarRing = ring

	// Charts
	const charts = generateChartColors(primaryHue, true)

	// Tables
	let tableHeader, tableHeaderForeground

	switch (tableStyle) {
		case 'strong':
			tableHeader = primary
			tableHeaderForeground = primaryForeground
			break
		case 'vibrant':
			tableHeader = accent
			tableHeaderForeground = accentForeground
			break
		case 'subtle':
			tableHeader = muted
			tableHeaderForeground = mutedForeground
			break
		case 'standard':
		default:
			tableHeader = secondary
			tableHeaderForeground = secondaryForeground
			break
	}

	const tableRow = background
	const tableRowAlt = oklchToHex(createOklch(0.15, 0.015, primaryHue))
	const tableRowForeground = foreground
	const tableBorder = border

	return {
		background,
		foreground,
		card,
		cardForeground,
		popover,
		popoverForeground,
		primary,
		primaryForeground,
		secondary,
		secondaryForeground,
		muted,
		mutedForeground,
		accent,
		accentForeground,
		destructive,
		destructiveForeground,
		border,
		input,
		ring,
		sidebar,
		sidebarForeground,
		sidebarPrimary,
		sidebarPrimaryForeground,
		sidebarAccent,
		sidebarAccentForeground,
		sidebarBorder,
		sidebarRing,
		...charts,
		tableHeader,
		tableHeaderForeground,
		tableRow,
		tableRowAlt,
		tableRowForeground,
		tableBorder,
	}
}

/**
 * Generates a complete random theme preset
 * @param options - Generator configuration
 * @returns ThemePreset object
 */
export function generateRandomTheme(options: GeneratorOptions = {}): ThemePreset {
	const {
		harmony = ['complementary', 'analogous', 'triadic', 'split-complementary'][
			Math.floor(Math.random() * 4)
		] as ColorHarmony,
		baseHue = Math.floor(Math.random() * 360),
		saturation = 0.15 + Math.random() * 0.15, // 0.15-0.30
		seedName,
	} = options

	const hues = getHarmonyHues(baseHue, harmony)
	const id = `random-${Date.now()}`

	// Randomize table style
	const tableStyles: TableStyle[] = ['standard', 'standard', 'strong', 'vibrant', 'subtle']
	const tableStyle = tableStyles[Math.floor(Math.random() * tableStyles.length)]

	// Creative names based on base hue
	const hueNames: Record<number, string> = {
		0: 'Rubí',
		15: 'Coral',
		30: 'Ámbar',
		45: 'Oro',
		60: 'Limón',
		75: 'Lima',
		90: 'Manzana',
		105: 'Jade',
		120: 'Esmeralda',
		135: 'Menta',
		150: 'Turquesa',
		165: 'Aguamarina',
		180: 'Cian',
		195: 'Celeste',
		210: 'Cielo',
		225: 'Cobalto',
		240: 'Azul',
		255: 'Índigo',
		270: 'Violeta',
		285: 'Púrpura',
		300: 'Magenta',
		315: 'Fucsia',
		330: 'Rosa',
		345: 'Carmesí',
	}

	const closestHue = (Math.round(baseHue / 15) * 15) % 360
	const baseName = hueNames[closestHue] || 'Custom'
	const name = seedName || `${baseName} ${harmony.charAt(0).toUpperCase() + harmony.slice(1)}`

	return {
		id,
		name,
		description: `Generated automatically - Harmony: ${harmony}, Base Hue: ${baseHue}°, Table: ${tableStyle}`,
		colors: {
			light: generateLightColors(hues, saturation, tableStyle),
			dark: generateDarkColors(hues, saturation, tableStyle),
		},
		radius: '0.625rem',
	}
}

/**
 * Generates a theme based on a specific input color
 * @param hexColor - Starting color
 * @param harmony - Harmony logic to apply
 */
export function generateThemeFromColor(hexColor: string, harmony: ColorHarmony = 'complementary'): ThemePreset {
	const color = hexToOklch(hexColor)
	if (!color || color.h === undefined) {
		return generateRandomTheme({ harmony })
	}

	return generateRandomTheme({
		harmony,
		baseHue: color.h,
		saturation: color.c,
		seedName: `Theme from ${hexColor}`,
	})
}

/**
 * Validates and fixes all contrast pairs in a theme
 * @param preset - Theme preset to normalize
 */
export function validateAndFixTheme(preset: ThemePreset): ThemePreset {
	const fixColors = (colors: ThemeColors): ThemeColors => {
		const fixed = { ...colors }

		// Foreground/Background pairs that require contrast validation
		const pairs: [keyof ThemeColors, keyof ThemeColors][] = [
			['foreground', 'background'],
			['cardForeground', 'card'],
			['popoverForeground', 'popover'],
			['primaryForeground', 'primary'],
			['secondaryForeground', 'secondary'],
			['mutedForeground', 'muted'],
			['accentForeground', 'accent'],
			['destructiveForeground', 'destructive'],
			['sidebarForeground', 'sidebar'],
			['sidebarPrimaryForeground', 'sidebarPrimary'],
			['sidebarAccentForeground', 'sidebarAccent'],
			['tableHeaderForeground', 'tableHeader'],
			['tableRowForeground', 'tableRow'],
		]

		for (const [fg, bg] of pairs) {
			fixed[fg] = ensureContrast(fixed[fg], fixed[bg])
		}

		return fixed
	}

	return {
		...preset,
		colors: {
			light: fixColors(preset.colors.light),
			dark: fixColors(preset.colors.dark),
		},
	}
}
