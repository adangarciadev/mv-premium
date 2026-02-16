/**
 * MV Theme Live Preview
 *
 * Compact "mini-Mediavida" mockup that renders the current theme colors
 * in real-time. Placed above the color editor so the user always sees
 * how individual color changes affect the overall look.
 *
 * Not rendered when the original MV theme is active (parent hides it).
 */
import { MV_COLOR_GROUPS } from '../logic/color-groups'

interface MvThemeLivePreviewProps {
	colorOverrides: Record<string, string>
}

function getColor(overrides: Record<string, string>, groupId: string): string {
	if (overrides[groupId]) return overrides[groupId]
	const group = MV_COLOR_GROUPS.find(g => g.id === groupId)
	return group?.baseColor ?? '#000000'
}

export function MvThemeLivePreview({ colorOverrides }: MvThemeLivePreviewProps) {
	const pageBg = getColor(colorOverrides, 'page-bg')
	const containerBg = getColor(colorOverrides, 'container-bg')
	const containerAlt = getColor(colorOverrides, 'container-alt')
	const elevatedBg = getColor(colorOverrides, 'elevated-bg')
	const surfaceBg = getColor(colorOverrides, 'surface-bg')
	const inputBg = getColor(colorOverrides, 'input-bg')
	const textPrimary = getColor(colorOverrides, 'text-primary')
	const textSecondary = getColor(colorOverrides, 'text-secondary')
	const textMuted = getColor(colorOverrides, 'text-muted')
	const accent = getColor(colorOverrides, 'accent')
	const link = getColor(colorOverrides, 'link')
	const border3d = getColor(colorOverrides, 'border-3d')
	const borderInput = getColor(colorOverrides, 'border-input')
	const buttonBg = getColor(colorOverrides, 'button-bg')
	const hoverBg = getColor(colorOverrides, 'hover-bg')

	return (
		<div className="space-y-2">
		<p className="text-xs font-medium text-muted-foreground">Vista previa</p>
		<div
			className="w-full rounded-lg overflow-hidden border border-border"
			style={{ backgroundColor: pageBg }}
		>
			{/* ── Top Navigation Bar ─────────────────────────────────── */}
			<div
				className="flex items-center gap-2 px-3 py-1.5"
				style={{ backgroundColor: surfaceBg, borderBottom: `1px solid ${border3d}` }}
			>
				{/* Logo */}
				<div className="w-14 h-2.5 rounded-sm" style={{ backgroundColor: accent }} />
				{/* Nav items */}
				<div className="flex gap-2 ml-2">
					<div className="w-8 h-2 rounded-sm" style={{ backgroundColor: textMuted, opacity: 0.6 }} />
					<div className="w-6 h-2 rounded-sm" style={{ backgroundColor: textMuted, opacity: 0.6 }} />
					<div className="w-10 h-2 rounded-sm" style={{ backgroundColor: link, opacity: 0.7 }} />
				</div>
				<div className="flex-1" />
				{/* Search */}
				<div
					className="w-16 h-3 rounded-sm"
					style={{ backgroundColor: inputBg, border: `1px solid ${borderInput}` }}
				/>
				{/* Avatar */}
				<div className="w-4 h-4 rounded-full" style={{ backgroundColor: elevatedBg }} />
			</div>

			{/* ── Content Area ────────────────────────────────────────── */}
			<div className="flex gap-1.5 p-2" style={{ minHeight: 80 }}>
				{/* Sidebar */}
				<div className="w-1/4 space-y-1.5 p-1.5 rounded-sm" style={{ backgroundColor: containerAlt }}>
					<div className="w-3/4 h-1.5 rounded-full" style={{ backgroundColor: textMuted, opacity: 0.5 }} />
					<div className="w-full h-1.5 rounded-full" style={{ backgroundColor: link, opacity: 0.7 }} />
					<div className="w-1/2 h-1.5 rounded-full" style={{ backgroundColor: textMuted, opacity: 0.4 }} />
					<div className="w-2/3 h-1.5 rounded-full" style={{ backgroundColor: textSecondary, opacity: 0.5 }} />
				</div>

				{/* Main content - Thread posts */}
				<div className="flex-1 space-y-1.5">
					{/* Post 1 */}
					<div className="rounded-sm p-1.5 space-y-1" style={{ backgroundColor: containerBg, border: `1px solid ${border3d}` }}>
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: elevatedBg }} />
							<div className="w-10 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
							<div className="w-6 h-1 rounded-full ml-auto" style={{ backgroundColor: textMuted, opacity: 0.4 }} />
						</div>
						<div className="w-full h-1 rounded-full" style={{ backgroundColor: textPrimary, opacity: 0.35 }} />
						<div className="w-4/5 h-1 rounded-full" style={{ backgroundColor: textSecondary, opacity: 0.3 }} />
						<div className="w-8 h-1 rounded-full" style={{ backgroundColor: link, opacity: 0.7 }} />
					</div>

					{/* Post 2 */}
					<div className="rounded-sm p-1.5 space-y-1" style={{ backgroundColor: containerBg, border: `1px solid ${border3d}` }}>
						<div className="flex items-center gap-1.5">
							<div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: elevatedBg }} />
							<div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
							<div className="w-6 h-1 rounded-full ml-auto" style={{ backgroundColor: textMuted, opacity: 0.4 }} />
						</div>
						{/* Quote block */}
						<div className="rounded-sm p-1 ml-1" style={{ backgroundColor: containerAlt, borderLeft: `2px solid ${accent}` }}>
							<div className="w-3/4 h-0.5 rounded-full" style={{ backgroundColor: textMuted, opacity: 0.4 }} />
						</div>
						<div className="w-full h-1 rounded-full" style={{ backgroundColor: textPrimary, opacity: 0.35 }} />
						{/* Action buttons */}
						<div className="flex gap-1 pt-0.5">
							<div className="w-4 h-2 rounded-sm" style={{ backgroundColor: buttonBg }} />
							<div className="w-4 h-2 rounded-sm" style={{ backgroundColor: hoverBg }} />
						</div>
					</div>
				</div>
			</div>
		</div>
		</div>
	)
}
