/**
 * Lightweight Color Utilities - Replacement for heavy culori library
 *
 * Only implements OKLCH ↔ hex conversions and WCAG contrast.
 * ~5KB vs ~100KB+ for full culori.
 *
 * Based on:
 * - https://bottosson.github.io/posts/oklab/ (Oklab/Oklch)
 * - https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Oklch {
	mode: 'oklch'
	l: number // Lightness 0-1
	c: number // Chroma 0-0.4+
	h?: number // Hue 0-360
	alpha?: number
}

export interface Rgb {
	r: number // 0-1
	g: number // 0-1
	b: number // 0-1
	alpha?: number
}

// ============================================================================
// HEX PARSING
// ============================================================================

/**
 * Decodes a hex color string into normalized RGB components (0.0 to 1.0).
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) formats.
 */
export function parseHex(hex: string): Rgb | undefined {
	const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i)
	if (!match) {
		// Try 3-digit hex
		const short = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i)
		if (short) {
			return {
				r: parseInt(short[1] + short[1], 16) / 255,
				g: parseInt(short[2] + short[2], 16) / 255,
				b: parseInt(short[3] + short[3], 16) / 255,
			}
		}
		return undefined
	}
	return {
		r: parseInt(match[1], 16) / 255,
		g: parseInt(match[2], 16) / 255,
		b: parseInt(match[3], 16) / 255,
		alpha: match[4] ? parseInt(match[4], 16) / 255 : undefined,
	}
}

/**
 * Encodes normalized RGB components back into a standard hex color string.
 */
export function formatHex(rgb: Rgb): string {
	const clamp = (v: number) => Math.max(0, Math.min(1, v))
	const toHex = (v: number) =>
		Math.round(clamp(v) * 255)
			.toString(16)
			.padStart(2, '0')
	return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

// ============================================================================
// SRGB ↔ LINEAR RGB
// ============================================================================

function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c: number): number {
	return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

// ============================================================================
// OKLAB CONVERSIONS (via linear RGB)
// ============================================================================

/**
 * Transforms Linear RGB components into the perceptual Oklab color space.
 */
function lrgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
	const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
	const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
	const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

	const l_ = Math.cbrt(l)
	const m_ = Math.cbrt(m)
	const s_ = Math.cbrt(s)

	return {
		L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
		a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
		b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
	}
}

/**
 * Convert Oklab to linear RGB
 */
function oklabToLrgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b
	const s_ = L - 0.0894841775 * a - 1.291485548 * b

	const l = l_ * l_ * l_
	const m = m_ * m_ * m_
	const s = s_ * s_ * s_

	return {
		r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	}
}

// ============================================================================
// OKLCH ↔ RGB CONVERSIONS
// ============================================================================

/**
 * Convert RGB (0-1) to Oklch
 */
export function rgbToOklch(rgb: Rgb): Oklch {
	const lr = srgbToLinear(rgb.r)
	const lg = srgbToLinear(rgb.g)
	const lb = srgbToLinear(rgb.b)

	const lab = lrgbToOklab(lr, lg, lb)

	const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
	let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
	if (h < 0) h += 360

	return {
		mode: 'oklch',
		l: lab.L,
		c: c,
		h: c < 0.0001 ? undefined : h,
		alpha: rgb.alpha,
	}
}

/**
 * Convert Oklch to RGB (0-1)
 */
export function oklchToRgb(oklch: Oklch): Rgb {
	const h = oklch.h ?? 0
	const hRad = (h * Math.PI) / 180

	const a = oklch.c * Math.cos(hRad)
	const b = oklch.c * Math.sin(hRad)

	const lrgb = oklabToLrgb(oklch.l, a, b)

	return {
		r: linearToSrgb(lrgb.r),
		g: linearToSrgb(lrgb.g),
		b: linearToSrgb(lrgb.b),
		alpha: oklch.alpha,
	}
}

// ============================================================================
// HEX ↔ OKLCH CONVERSIONS
// ============================================================================

/**
 * Convert hex to Oklch
 */
export function hexToOklch(hex: string): Oklch | undefined {
	const rgb = parseHex(hex)
	if (!rgb) return undefined
	return rgbToOklch(rgb)
}

/**
 * Convert Oklch to hex (with gamut clamping)
 */
export function oklchToHex(oklch: Oklch): string {
	const rgb = oklchToRgb(oklch)
	return formatHex(clampRgb(rgb))
}

/**
 * Clamp RGB values to 0-1 range
 */
function clampRgb(rgb: Rgb): Rgb {
	return {
		r: Math.max(0, Math.min(1, rgb.r)),
		g: Math.max(0, Math.min(1, rgb.g)),
		b: Math.max(0, Math.min(1, rgb.b)),
		alpha: rgb.alpha,
	}
}

/**
 * Check if RGB is in gamut
 */
function isInGamut(rgb: Rgb): boolean {
	return rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1
}

/**
 * Clamp chroma to fit in sRGB gamut using binary search
 */
export function clampChroma(oklch: Oklch): Oklch {
	const rgb = oklchToRgb(oklch)
	if (isInGamut(rgb)) return oklch

	// Binary search for max chroma that fits
	let low = 0
	let high = oklch.c
	let result = { ...oklch, c: 0 }

	for (let i = 0; i < 15; i++) {
		const mid = (low + high) / 2
		const test = { ...oklch, c: mid }
		const testRgb = oklchToRgb(test)

		if (isInGamut(testRgb)) {
			result = test
			low = mid
		} else {
			high = mid
		}
	}

	return result
}

// ============================================================================
// OKLCH FACTORY
// ============================================================================

/**
 * Create an Oklch color
 */
export function oklch(l: number, c: number, h?: number): Oklch {
	return { mode: 'oklch', l, c, h }
}

// ============================================================================
// WCAG CONTRAST
// ============================================================================

/**
 * Calculate relative luminance (WCAG 2.1)
 */
function relativeLuminance(rgb: Rgb): number {
	const r = srgbToLinear(rgb.r)
	const g = srgbToLinear(rgb.g)
	const b = srgbToLinear(rgb.b)
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Calculate WCAG contrast ratio between two colors
 */
export function wcagContrast(color1: string, color2: string): number {
	const rgb1 = parseHex(color1)
	const rgb2 = parseHex(color2)
	if (!rgb1 || !rgb2) return 0

	const l1 = relativeLuminance(rgb1)
	const l2 = relativeLuminance(rgb2)

	const lighter = Math.max(l1, l2)
	const darker = Math.min(l1, l2)

	return (lighter + 0.05) / (darker + 0.05)
}

// ============================================================================
// GENERAL PARSING
// ============================================================================

/**
 * Parse any supported color format (currently just hex)
 * Returns RGB for compatibility
 */
export function parse(color: string): Rgb | undefined {
	if (color.startsWith('#')) {
		return parseHex(color)
	}
	// Could add rgb(), hsl(), etc. parsing here if needed
	return undefined
}
