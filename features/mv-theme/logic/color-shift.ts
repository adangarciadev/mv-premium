/**
 * OKLCH Color Shifting
 *
 * When a user changes a semantic group's base color, all related shades
 * shift proportionally using OKLCH perceptual color space math.
 *
 * Reuses existing color-utils-lite.ts functions.
 */
import { hexToOklch, oklchToHex, clampChroma, type Oklch } from '@/features/theme-editor/lib/color-utils-lite'

/**
 * Shifts a hex color by the same OKLCH delta as baseHex → newBaseHex.
 *
 * The lightness/chroma/hue deltas from the base shift are applied
 * proportionally to the shade, preserving its relative appearance.
 *
 * @param shadeHex    - The original shade color to shift
 * @param baseHex     - The original base color of the group
 * @param newBaseHex  - The new base color chosen by the user
 * @returns The shifted shade as a hex string
 */
export function shiftColor(shadeHex: string, baseHex: string, newBaseHex: string): string {
	const shade = hexToOklch(shadeHex)
	const base = hexToOklch(baseHex)
	const newBase = hexToOklch(newBaseHex)

	if (!shade || !base || !newBase) return shadeHex

	// Calculate deltas
	const dL = newBase.l - base.l
	const dC = newBase.c - base.c
	const dH = hueDelta(base.h, newBase.h)

	// Apply deltas to shade
	const shifted: Oklch = {
		mode: 'oklch',
		l: clampValue(shade.l + dL, 0, 1),
		c: Math.max(0, shade.c + dC),
		h: shade.h != null
			? normalizeHue(shade.h + dH)
			: newBase.h != null
				? normalizeHue(newBase.h)
				: undefined,
	}

	// Clamp chroma to fit sRGB gamut
	return oklchToHex(clampChroma(shifted))
}

/**
 * Compute shortest-path hue delta between two hues (handles wraparound).
 */
function hueDelta(fromH: number | undefined, toH: number | undefined): number {
	const from = fromH ?? 0
	const to = toH ?? 0
	let delta = to - from

	// Wrap to [-180, 180] range for shortest path
	if (delta > 180) delta -= 360
	if (delta < -180) delta += 360

	return delta
}

/**
 * Normalize hue to [0, 360) range.
 */
function normalizeHue(h: number): number {
	return ((h % 360) + 360) % 360
}

/**
 * Clamp a number to a min/max range.
 */
function clampValue(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v))
}
