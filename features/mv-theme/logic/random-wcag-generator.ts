import { hexToOklch, oklchToHex, wcagContrast } from '@/features/theme-editor/lib/color-utils-lite'
import { logger } from '@/lib/logger'
import { MV_COLOR_GROUPS } from './color-groups'

export type MvColorHarmony =
	| 'complementary'
	| 'analogous'
	| 'triadic'
	| 'split-complementary'
export type MvThemeTone = 'dark' | 'light' | 'mixed'

interface RandomMvThemeOptions {
	harmony?: MvColorHarmony
	baseHue?: number
	saturation?: number
	tone?: MvThemeTone
	random?: () => number
}

const HARMONIES: MvColorHarmony[] = [
	'complementary',
	'analogous',
	'triadic',
	'split-complementary',
]

/**
 * Generate a random MV theme override map with WCAG-aware contrast corrections.
 */
export function generateRandomMvThemeOverrides(options: RandomMvThemeOptions = {}): Record<string, string> {
	const random = options.random ?? Math.random
	const harmony = options.harmony ?? HARMONIES[randomInt(random, 0, HARMONIES.length - 1)]
	const baseHue = normalizeHue(options.baseHue ?? randomFloat(random, 0, 360))
	const saturation = clamp(options.saturation ?? randomFloat(random, 0.09, 0.2), 0.06, 0.24)
	const requestedTone = options.tone ?? 'mixed'
	const tone: Exclude<MvThemeTone, 'mixed'> =
		requestedTone === 'mixed' ? (random() < 0.72 ? 'dark' : 'light') : requestedTone
	const hues = getHarmonyHues(baseHue, harmony)
	const accentHue = normalizeHue(hues[1] ?? baseHue + 180)
	const linkHue = normalizeHue(hues[2] ?? baseHue + 205)

	let pageBg: string
	let containerBg: string
	let containerAlt: string
	let elevatedBg: string
	let inputBg: string
	let surfaceBg: string
	let hoverBg: string

	let textPrimary: string
	let textSecondary: string
	let textMuted: string

	let accent: string
	let link: string
	let unreadOld: string
	let highlight: string

	let border3d: string
	let borderInput: string
	let borderControl: string
	let buttonBg: string

	if (tone === 'dark') {
		// Keep dark mode feel, but avoid "always black" randomness.
		const depth = randomFloat(random, 0.16, 0.24)
		const baseChroma = clamp(saturation * 0.34, 0.018, 0.08)

		pageBg = ensureMinContrastAgainstBlack(hex(depth, baseChroma, baseHue), 1.28)
		containerBg = hex(depth + randomFloat(random, 0.08, 0.13), baseChroma + 0.008, baseHue)
		containerAlt = hex(depth + randomFloat(random, 0.06, 0.11), baseChroma + 0.005, baseHue)
		elevatedBg = hex(depth + randomFloat(random, 0.11, 0.17), baseChroma + 0.012, baseHue)
		inputBg = hex(depth + randomFloat(random, 0.03, 0.07), baseChroma + 0.004, baseHue)
		surfaceBg = hex(depth + randomFloat(random, 0.05, 0.1), baseChroma + 0.006, baseHue)
		hoverBg = hex(depth + randomFloat(random, 0.12, 0.18), baseChroma + 0.016, baseHue)

		textPrimary = ensureContrast(hex(0.95, 0.01, baseHue), pageBg, 4.5)
		textSecondary = ensureContrast(hex(0.8, 0.02, baseHue), containerBg, 4.5)
		textMuted = ensureContrast(hex(0.72, 0.017, baseHue), containerBg, 4.5)

		accent = ensureContrast(hex(0.72, Math.min(0.2, saturation + 0.06), accentHue), pageBg, 4.5)
		link = ensureContrast(hex(0.7, Math.min(0.22, saturation + 0.08), linkHue), pageBg, 4.5)
		unreadOld = ensureContrast(hex(0.63, 0.02, baseHue), pageBg, 3)
		highlight = ensureContrast(hex(0.55, 0.05, normalizeHue(accentHue + 25)), pageBg, 3)

		border3d = hex(0.3, 0.012, baseHue)
		borderInput = hex(0.38, 0.018, baseHue)
		borderControl = hex(0.44, 0.02, baseHue)
		buttonBg = hex(0.36, 0.02, baseHue)
	} else {
		// Light variant for users who want bright random themes.
		const depth = randomFloat(random, 0.86, 0.93)
		const baseChroma = clamp(saturation * 0.22, 0.01, 0.05)

		pageBg = hex(depth, baseChroma, baseHue)
		containerBg = hex(depth + randomFloat(random, 0.02, 0.05), Math.max(0, baseChroma - 0.003), baseHue)
		containerAlt = hex(depth - randomFloat(random, 0.01, 0.04), baseChroma + 0.004, baseHue)
		elevatedBg = hex(depth - randomFloat(random, 0.02, 0.05), baseChroma + 0.005, baseHue)
		inputBg = hex(depth + randomFloat(random, 0.01, 0.04), baseChroma, baseHue)
		surfaceBg = hex(depth - randomFloat(random, 0.015, 0.045), baseChroma + 0.004, baseHue)
		hoverBg = hex(depth - randomFloat(random, 0.04, 0.08), baseChroma + 0.01, baseHue)

		textPrimary = ensureContrast(hex(0.24, 0.02, baseHue), pageBg, 4.5)
		textSecondary = ensureContrast(hex(0.33, 0.025, baseHue), containerBg, 4.5)
		textMuted = ensureContrast(hex(0.42, 0.02, baseHue), containerBg, 4.5)

		accent = ensureContrast(hex(0.45, Math.min(0.18, saturation + 0.05), accentHue), pageBg, 4.5)
		link = ensureContrast(hex(0.42, Math.min(0.2, saturation + 0.07), linkHue), pageBg, 4.5)
		unreadOld = ensureContrast(hex(0.55, 0.03, baseHue), pageBg, 3)
		highlight = ensureContrast(hex(0.78, 0.03, normalizeHue(accentHue + 25)), pageBg, 3)

		border3d = hex(0.78, 0.01, baseHue)
		borderInput = hex(0.7, 0.015, baseHue)
		borderControl = hex(0.64, 0.018, baseHue)
		buttonBg = hex(0.84, 0.014, baseHue)

		// Keep active accents visibly separated from muted UI icons in light themes
		// while preserving AA contrast on the page background.
		accent = ensureContrastForTargets(accent, [
			{ background: pageBg, minContrast: 4.5 },
			{ background: textMuted, minContrast: 2.15 },
		])
		accent = enforceLightAccentReadability(accent, pageBg, textMuted)
	}

	const unreadNew = accent

	const generated: Record<string, string> = {
		'page-bg': pageBg,
		'container-bg': containerBg,
		'container-alt': containerAlt,
		'elevated-bg': elevatedBg,
		'input-bg': inputBg,
		'surface-bg': surfaceBg,
		'hover-bg': hoverBg,
		'text-primary': textPrimary,
		'text-secondary': textSecondary,
		'text-muted': textMuted,
		accent,
		link,
		'unread-old': unreadOld,
		'unread-new': unreadNew,
		highlight,
		'border-3d': border3d,
		'border-input': borderInput,
		'border-control': borderControl,
		'button-bg': buttonBg,
	}

	// Keep compatibility if groups are expanded in the future.
	const defaults: Record<string, string> = {}
	for (const group of MV_COLOR_GROUPS) {
		defaults[group.id] = generated[group.id] ?? group.baseColor
	}

	return defaults
}

function ensureContrast(foreground: string, background: string, minContrast: number): string {
	const fg = hexToOklch(foreground)
	if (!fg || !hexToOklch(background)) return foreground

	let candidate = foreground
	let contrast = wcagContrast(candidate, background)
	if (contrast >= minContrast) return candidate

	let bestCandidate: { hex: string; delta: number } | null = null
	let fallbackCandidate = foreground
	let fallbackContrast = contrast

	for (const direction of [-1, 1] as const) {
		for (let step = 1; step <= 60; step++) {
			const adjusted = { ...fg, l: clamp(fg.l + direction * 0.015 * step, 0.02, 0.98) }
			const next = oklchToHex(adjusted)
			const nextContrast = wcagContrast(next, background)

			if (nextContrast > fallbackContrast) {
				fallbackContrast = nextContrast
				fallbackCandidate = next
			}

			if (nextContrast >= minContrast) {
				const delta = Math.abs(adjusted.l - fg.l)
				if (!bestCandidate || delta < bestCandidate.delta) {
					bestCandidate = { hex: next, delta }
				}
				break
			}
		}
	}

	return bestCandidate?.hex ?? fallbackCandidate
}

function ensureContrastForTargets(
	foreground: string,
	targets: Array<{ background: string; minContrast: number }>
): string {
	const fg = hexToOklch(foreground)
	if (!fg) return foreground

	let bestMeetingCandidate: { hex: string; delta: number } | null = null
	let bestFallback: { hex: string; score: number; delta: number } = {
		hex: foreground,
		score: Number.NEGATIVE_INFINITY,
		delta: 0,
	}

	for (let step = 0; step <= 96; step++) {
		const l = clamp(step / 96, 0.02, 0.98)
		const candidate = oklchToHex({ ...fg, l })
		const delta = Math.abs(l - fg.l)

		let minScore = Number.POSITIVE_INFINITY
		let allMet = true

		for (const target of targets) {
			const contrast = wcagContrast(candidate, target.background)
			const score = contrast / target.minContrast
			minScore = Math.min(minScore, score)
			if (contrast < target.minContrast) allMet = false
		}

		if (allMet) {
			if (!bestMeetingCandidate || delta < bestMeetingCandidate.delta) {
				bestMeetingCandidate = { hex: candidate, delta }
			}
			continue
		}

		if (
			minScore > bestFallback.score ||
			(minScore === bestFallback.score && delta < bestFallback.delta)
		) {
			bestFallback = { hex: candidate, score: minScore, delta }
		}
	}

	return bestMeetingCandidate?.hex ?? bestFallback.hex
}

function enforceLightAccentReadability(accent: string, pageBg: string, textMuted: string): string {
	if (wcagContrast(accent, pageBg) >= 4.5 && wcagContrast(accent, textMuted) >= 2.1) {
		return accent
	}

	const safeDarkAccents = ['#000000', '#111111', '#1a1a1a', '#222222', '#2a2a2a', '#333333']
	for (const candidate of safeDarkAccents) {
		if (wcagContrast(candidate, pageBg) >= 4.5 && wcagContrast(candidate, textMuted) >= 2.1) {
			return candidate
		}
	}

	return accent
}

function ensureMinContrastAgainstBlack(color: string, minContrast: number): string {
	const parsed = hexToOklch(color)
	if (!parsed) return color

	let candidate = color
	if (wcagContrast(candidate, '#000000') >= minContrast) {
		return candidate
	}

	const adjusted = { ...parsed }
	for (let i = 0; i < 60; i++) {
		adjusted.l = clamp(adjusted.l + 0.01, 0.02, 0.98)
		candidate = oklchToHex(adjusted)
		if (wcagContrast(candidate, '#000000') >= minContrast) {
			return candidate
		}
	}

	logger.warn('Random MV theme contrast adjustment hit max attempts against black.', {
		minContrast,
		initialColor: color,
		lastCandidate: candidate,
	})

	return candidate
}

function getHarmonyHues(baseHue: number, harmony: MvColorHarmony): number[] {
	switch (harmony) {
		case 'complementary':
			return [baseHue, baseHue + 180]
		case 'analogous':
			return [baseHue - 30, baseHue, baseHue + 30]
		case 'triadic':
			return [baseHue, baseHue + 120, baseHue + 240]
		case 'split-complementary':
			return [baseHue, baseHue + 150, baseHue + 210]
		default:
			return [baseHue]
	}
}

function hex(l: number, c: number, h: number): string {
	return oklchToHex({ mode: 'oklch', l: clamp(l, 0, 1), c: Math.max(0, c), h: normalizeHue(h) })
}

function normalizeHue(h: number): number {
	return ((h % 360) + 360) % 360
}

function randomFloat(random: () => number, min: number, max: number): number {
	return min + random() * (max - min)
}

function randomInt(random: () => number, min: number, max: number): number {
	return Math.floor(randomFloat(random, min, max + 1))
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}
