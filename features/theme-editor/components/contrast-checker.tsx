/**
 * Contrast Checker - WCAG contrast validator for themes
 */
import { useState, useMemo } from 'react'
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Sun from 'lucide-react/dist/esm/icons/sun'
import Moon from 'lucide-react/dist/esm/icons/moon'
import Check from 'lucide-react/dist/esm/icons/check'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getContrast } from '../lib/color-generator'
import type { ThemeColors } from '@/types/theme'
import { cn } from '@/lib/utils'

/**
 * Generates inline CSS styles with theme variables
 * so that the dialog components use the correct colors
 */
function generateThemeStyles(colors: ThemeColors): React.CSSProperties {
	return {
		'--background': colors.background,
		'--foreground': colors.foreground,
		'--card': colors.card,
		'--card-foreground': colors.cardForeground,
		'--popover': colors.popover,
		'--popover-foreground': colors.popoverForeground,
		'--primary': colors.primary,
		'--primary-foreground': colors.primaryForeground,
		'--secondary': colors.secondary,
		'--secondary-foreground': colors.secondaryForeground,
		'--muted': colors.muted,
		'--muted-foreground': colors.mutedForeground,
		'--accent': colors.accent,
		'--accent-foreground': colors.accentForeground,
		'--destructive': colors.destructive,
		'--destructive-foreground': colors.destructiveForeground,
		'--border': colors.border,
		'--input': colors.input,
		'--ring': colors.ring,
	} as React.CSSProperties
}

interface ContrastPair {
	name: string
	background: { label: string; key: keyof ThemeColors; oklch?: string }
	foreground: { label: string; key: keyof ThemeColors; oklch?: string }
}

// Color pairs to verify (background vs foreground)
const CONTRAST_PAIRS: ContrastPair[] = [
	// Content & Containers
	{
		name: 'Base',
		background: { label: 'Background', key: 'background' },
		foreground: { label: 'Foreground', key: 'foreground' },
	},
	{
		name: 'Card',
		background: { label: 'Background', key: 'card' },
		foreground: { label: 'Foreground', key: 'cardForeground' },
	},
	{
		name: 'Popover',
		background: { label: 'Background', key: 'popover' },
		foreground: { label: 'Foreground', key: 'popoverForeground' },
	},
	{
		name: 'Muted',
		background: { label: 'Background', key: 'muted' },
		foreground: { label: 'Foreground', key: 'mutedForeground' },
	},
	// Interactive Elements
	{
		name: 'Primary',
		background: { label: 'Background', key: 'primary' },
		foreground: { label: 'Foreground', key: 'primaryForeground' },
	},
	{
		name: 'Secondary',
		background: { label: 'Background', key: 'secondary' },
		foreground: { label: 'Foreground', key: 'secondaryForeground' },
	},
	{
		name: 'Accent',
		background: { label: 'Background', key: 'accent' },
		foreground: { label: 'Foreground', key: 'accentForeground' },
	},
	{
		name: 'Destructive',
		background: { label: 'Background', key: 'destructive' },
		foreground: { label: 'Foreground', key: 'destructiveForeground' },
	},
	// Sidebar
	{
		name: 'Sidebar',
		background: { label: 'Background', key: 'sidebar' },
		foreground: { label: 'Foreground', key: 'sidebarForeground' },
	},
	{
		name: 'Sidebar Primary',
		background: { label: 'Background', key: 'sidebarPrimary' },
		foreground: { label: 'Foreground', key: 'sidebarPrimaryForeground' },
	},
	{
		name: 'Sidebar Accent',
		background: { label: 'Background', key: 'sidebarAccent' },
		foreground: { label: 'Foreground', key: 'sidebarAccentForeground' },
	},
]

// Groups to organize pairs in the UI
const CONTRAST_GROUPS = [
	{
		label: 'Content & Containers',
		pairs: ['Base', 'Card', 'Popover', 'Muted'],
	},
	{
		label: 'Interactive Elements',
		pairs: ['Primary', 'Secondary', 'Accent', 'Destructive'],
	},
	{
		label: 'Sidebar',
		pairs: ['Sidebar', 'Sidebar Primary', 'Sidebar Accent'],
	},
]

/**
 * Determines a human-readable rating and style for a contrast ratio
 */
function getContrastRating(contrast: number): {
	label: string
	className: string
	passes: boolean
} {
	if (contrast >= 7) {
		return { label: 'AAA', className: 'bg-primary text-primary-foreground', passes: true }
	} else if (contrast >= 4.5) {
		return { label: 'AA', className: 'bg-primary text-primary-foreground', passes: true }
	} else if (contrast >= 3) {
		// Doesn't pass standard AA, only AA for large text - mark as issue
		return { label: 'AA Large', className: 'bg-destructive text-destructive-foreground', passes: false }
	}
	return { label: 'Fail', className: 'bg-destructive text-destructive-foreground', passes: false }
}

/**
 * ContrastCard component - Displays a specific contrast pair's results
 */
interface ContrastCardProps {
	pair: ContrastPair
	colors: ThemeColors
}

function ContrastCard({ pair, colors }: ContrastCardProps) {
	const bgColor = colors[pair.background.key]
	const fgColor = colors[pair.foreground.key]
	const contrast = getContrast(bgColor, fgColor)
	const rating = getContrastRating(contrast)

	return (
		<div
			className={cn(
				'bg-card border rounded-xl p-4 space-y-3 transition-colors',
				!rating.passes && 'border-destructive/50 bg-destructive/5'
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{!rating.passes && <TriangleAlert className="h-4 w-4 text-destructive" />}
					<h4 className={cn('font-medium', !rating.passes && 'text-destructive')}>{pair.name}</h4>
				</div>
				<span
					className={cn(
						'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold font-mono',
						rating.className
					)}
				>
					{rating.passes ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
					{contrast.toFixed(2)}
				</span>
			</div>

			{/* Color Info + Preview */}
			<div className="flex gap-3">
				{/* Color swatches and info */}
				<div className="flex-1 space-y-2 text-xs">
					{/* Background */}
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded border border-border/50 shrink-0" style={{ backgroundColor: bgColor }} />
						<div className="min-w-0">
							<div className="font-medium text-muted-foreground">{pair.background.label}</div>
							<div className="font-mono text-[10px] text-muted-foreground/70 truncate">{bgColor}</div>
						</div>
					</div>
					{/* Foreground */}
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded border border-border/50 shrink-0" style={{ backgroundColor: fgColor }} />
						<div className="min-w-0">
							<div className="font-medium text-muted-foreground">{pair.foreground.label}</div>
							<div className="font-mono text-[10px] text-muted-foreground/70 truncate">{fgColor}</div>
						</div>
					</div>
				</div>

				{/* Sample Text Preview */}
				<div
					className="w-24 h-18 rounded-lg flex flex-col items-center justify-center shrink-0 border"
					style={{ backgroundColor: bgColor }}
				>
					<span className="text-3xl font-semibold" style={{ color: fgColor }}>
						Aa
					</span>
					<span className="text-[10px]" style={{ color: fgColor }}>
						Sample Text
					</span>
				</div>
			</div>
		</div>
	)
}

/**
 * ContrastChecker component - Dialog to validate theme contrast against WCAG standards
 * @param colorsLight - Light theme colors
 * @param colorsDark - Dark theme colors
 * @param initialMode - Starting visual mode
 * @param trigger - Optional custom trigger element
 */
interface ContrastCheckerProps {
	colorsLight: ThemeColors
	colorsDark: ThemeColors
	initialMode?: 'light' | 'dark'
	trigger?: React.ReactNode
}

export function ContrastChecker({ colorsLight, colorsDark, initialMode = 'dark', trigger }: ContrastCheckerProps) {
	const [showOnlyIssues, setShowOnlyIssues] = useState(false)
	const [mode, setMode] = useState<'light' | 'dark'>(initialMode)

	// Current colors based on selected mode
	const colors = mode === 'light' ? colorsLight : colorsDark

	// Generate inline CSS styles so the dialog uses selected theme colors
	const themeStyles = useMemo(() => generateThemeStyles(colors), [colors])

	// Calculate issues
	const issues = CONTRAST_PAIRS.filter(pair => {
		const contrast = getContrast(colors[pair.background.key], colors[pair.foreground.key])
		return contrast < 4.5
	})

	// Filter pairs according to toggle state
	const filteredPairs = showOnlyIssues
		? CONTRAST_PAIRS.filter(pair => {
				const contrast = getContrast(colors[pair.background.key], colors[pair.foreground.key])
				return contrast < 4.5
		  })
		: CONTRAST_PAIRS

	return (
		<Dialog>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" size="sm" className="gap-2">
						<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<circle cx="12" cy="12" r="10" />
							<path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
						</svg>
						Contrast
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-4xl h-[600px] flex flex-col" style={themeStyles}>
				<DialogHeader className="shrink-0 pb-4 space-y-4">
					<div className="flex items-center justify-between gap-6">
						<div>
							<DialogTitle className="text-xl">Contrast Checker</DialogTitle>
							<p className="text-sm text-muted-foreground mt-1">
								WCAG 2.0 AA requires a contrast ratio of at least 4.5:1 •{' '}
								<a
									href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html"
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:text-foreground inline-flex items-center gap-1"
								>
									Learn more
									<ExternalLink className="h-3 w-3" />
								</a>
							</p>
						</div>
						<div className="flex items-center gap-2">
							{/* Mode toggle (simple button) */}
							<Button
								variant="outline"
								size="sm"
								onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
								className="gap-2"
							>
								{mode === 'light' ? (
									<>
										<Sun className="h-4 w-4" />
										Light
									</>
								) : (
									<>
										<Moon className="h-4 w-4" />
										Dark
									</>
								)}
							</Button>
							{/* All / Issues toggle */}
							<div className="flex border rounded-lg overflow-hidden">
								<button
									onClick={() => setShowOnlyIssues(false)}
									className={cn(
										'px-3 py-1.5 text-sm transition-colors',
										!showOnlyIssues ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									)}
								>
									All
								</button>
								<button
									onClick={() => setShowOnlyIssues(true)}
									className={cn(
										'px-3 py-1.5 text-sm transition-colors flex items-center gap-1.5',
										showOnlyIssues ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									)}
								>
									{issues.length > 0 ? (
										<span className="inline-flex items-center h-5 px-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium">
											<TriangleAlert className="h-3 w-3 mr-1" />
											{issues.length}
										</span>
									) : (
										<span className="inline-flex items-center h-5 px-1.5 rounded bg-muted text-muted-foreground text-xs font-medium">
											0
										</span>
									)}
									Issues
								</button>
							</div>
						</div>
					</div>
					<Separator />
				</DialogHeader>

				<ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
					<div className="py-4">
						{CONTRAST_GROUPS.map((group, index) => {
							const groupPairs = filteredPairs.filter(p => group.pairs.includes(p.name))
							if (groupPairs.length === 0) return null
							const isLast = index === CONTRAST_GROUPS.length - 1

							return (
								<div key={group.label} className="mb-6">
									<h3 className="text-sm font-medium text-muted-foreground mb-3">{group.label}</h3>
									<div className="grid grid-cols-2 gap-3">
										{groupPairs.map(pair => (
											<ContrastCard key={pair.name} pair={pair} colors={colors} />
										))}
									</div>
									{!isLast && <Separator className="mt-6" />}
								</div>
							)
						})}

						{showOnlyIssues && issues.length === 0 && (
							<div className="text-center py-12 text-muted-foreground">
								<div className="text-4xl mb-2">🎉</div>
								<p className="font-medium">¡Excelente!</p>
								<p className="text-sm">Todos los pares de colores cumplen con WCAG AA</p>
							</div>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
