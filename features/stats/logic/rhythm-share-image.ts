/**
 * Canvas/PNG renderer for the "Tiempo en Mediavida" share image.
 *
 * DOM canvas only — no React. Turns a `ShareSummary` (see
 * `rhythm-share-summary.ts`) into a PNG Blob ready to copy or download.
 */
import { fmtTime, type ShareSummary } from './rhythm-share-summary'

type DocumentWithFonts = Document & {
	fonts?: {
		load?: (font: string, text?: string) => Promise<FontFace[]>
		ready?: Promise<unknown>
	}
}

const CANVAS_WIDTH = 1280
const CANVAS_HEIGHT = 1600
const CANVAS_SCALE = 2
const HOUR_BUCKET_MAX_MS = 60 * 60_000

const CENTER_X = CANVAS_WIDTH / 2
const CONTENT_LEFT = 96
const CONTENT_RIGHT = CANVAS_WIDTH - 96
const CONTENT_W = CONTENT_RIGHT - CONTENT_LEFT
const FRAME = { x: 36, y: 36, w: CANVAS_WIDTH - 72, h: CANVAS_HEIGHT - 72, r: 12 } as const
/** Single corner radius shared by every rectangular surface for a uniform, straight look. */
const UI_RADIUS = 12
/** Display ("Grotesk") font used for headings and feature names, matching the dashboard. */
const DISPLAY_FONT_PRIMARY = '"Bricolage Grotesque Variable"'
const DISPLAY_FONT = `${DISPLAY_FONT_PRIMARY}, "Bricolage Grotesque", "Instrument Sans Variable", system-ui, sans-serif`
const SANS_FONT_PRIMARY = '"Instrument Sans Variable"'
const SANS_FONT = `${SANS_FONT_PRIMARY}, "Instrument Sans", system-ui, sans-serif`
const DATA_FONT_PRIMARY = '"Spline Sans Mono Variable"'
const DATA_FONT = `${DATA_FONT_PRIMARY}, "Spline Sans Mono", ui-monospace, monospace`

const CANVAS_FONT_LOADS = [
	`800 60px ${DISPLAY_FONT_PRIMARY}`,
	`750 24px ${SANS_FONT_PRIMARY}`,
	`900 48px ${DATA_FONT_PRIMARY}`,
] as const

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	const radius = Math.min(r, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + radius, y)
	ctx.lineTo(x + w - radius, y)
	ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
	ctx.lineTo(x + w, y + h - radius)
	ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
	ctx.lineTo(x + radius, y + h)
	ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
	ctx.lineTo(x, y + radius)
	ctx.quadraticCurveTo(x, y, x + radius, y)
	ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text
	let next = text
	while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
		next = next.slice(0, -1)
	}
	return `${next}...`
}

function setFittedFont(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	weight: number,
	size: number,
	family: string,
	minSize = 28
): void {
	let nextSize = size
	do {
		ctx.font = `${weight} ${nextSize}px ${family}`
		if (ctx.measureText(text).width <= maxWidth || nextSize <= minSize) return
		nextSize -= 3
	} while (nextSize > minSize)
}

function drawSoftCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
	roundedRect(ctx, x, y, w, h, UI_RADIUS)
	ctx.fillStyle = 'rgba(9, 12, 17, 0.74)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
	ctx.lineWidth = 1.5
	ctx.stroke()
}

type CanvasWithTracking = CanvasRenderingContext2D & { letterSpacing: string }

/** Set canvas letter-spacing (supported in modern Chrome/Firefox; no-op otherwise). */
function setTracking(ctx: CanvasRenderingContext2D, value: string): void {
	;(ctx as CanvasWithTracking).letterSpacing = value
}

function drawMetricTile(
	ctx: CanvasRenderingContext2D,
	label: string,
	value: string,
	x: number,
	y: number,
	w: number
): void {
	ctx.save()
	drawSoftCard(ctx, x, y, w, 96)
	const midX = x + w / 2
	ctx.textAlign = 'center'
	ctx.fillStyle = 'rgba(94, 234, 212, 0.85)'
	ctx.font = `850 12px ${DATA_FONT}`
	setTracking(ctx, '2px')
	ctx.fillText(label.toUpperCase(), midX, y + 32)
	setTracking(ctx, '0px')

	// Premium accent divider: teal core fading out symmetrically.
	const sepW = 48
	const sep = ctx.createLinearGradient(midX - sepW / 2, 0, midX + sepW / 2, 0)
	sep.addColorStop(0, 'rgba(94, 234, 212, 0)')
	sep.addColorStop(0.5, 'rgba(94, 234, 212, 0.6)')
	sep.addColorStop(1, 'rgba(94, 234, 212, 0)')
	ctx.fillStyle = sep
	ctx.fillRect(midX - sepW / 2, y + 44, sepW, 2)

	ctx.fillStyle = '#f8fafc'
	setFittedFont(ctx, value, w - 36, 900, 28, DATA_FONT, 16)
	ctx.fillText(value, midX, y + 76)
	ctx.restore()
}

/** Big hero time, horizontally centered on `cx`: bold hours + amber minutes/seconds. */
function drawMainTime(ctx: CanvasRenderingContext2D, value: string, cx: number, y: number): void {
	const [head = value, ...restParts] = value.split(' ')
	const rest = restParts.join(' ')
	ctx.save()
	ctx.textAlign = 'left'
	setFittedFont(ctx, head, 680, 950, 96, DATA_FONT, 58)
	const headWidth = ctx.measureText(head).width
	let restWidth = 0
	if (rest) {
		ctx.save()
		ctx.font = `900 42px ${DATA_FONT}`
		restWidth = ctx.measureText(rest).width
		ctx.restore()
	}
	const gap = rest ? 20 : 0
	const startX = cx - (headWidth + gap + restWidth) / 2
	ctx.fillStyle = '#f8fafc'
	ctx.fillText(head, startX, y)
	if (rest) {
		ctx.fillStyle = '#f5a400'
		ctx.font = `900 42px ${DATA_FONT}`
		ctx.fillText(rest, startX + headWidth + gap, y)
	}
	ctx.restore()
}

/** Width a pill would occupy for `text` (same font as drawPill), for centering. */
function measurePill(ctx: CanvasRenderingContext2D, text: string, paddingX = 18): number {
	ctx.save()
	ctx.font = `850 18px ${SANS_FONT}`
	const width = Math.ceil(ctx.measureText(text).width + paddingX * 2)
	ctx.restore()
	return width
}

function drawPill(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	paddingX = 18,
	color = '#f5a400'
): number {
	ctx.save()
	ctx.textAlign = 'left'
	ctx.font = `850 18px ${SANS_FONT}`
	const width = Math.ceil(ctx.measureText(text).width + paddingX * 2)
	roundedRect(ctx, x, y, width, 44, UI_RADIUS)
	ctx.fillStyle = color === '#f5a400' ? 'rgba(245, 164, 0, 0.14)' : 'rgba(94, 234, 212, 0.12)'
	ctx.fill()
	ctx.strokeStyle = color === '#f5a400' ? 'rgba(245, 164, 0, 0.40)' : 'rgba(94, 234, 212, 0.32)'
	ctx.lineWidth = 1.5
	ctx.stroke()
	ctx.fillStyle = color
	ctx.fillText(text, x + paddingX, y + 28)
	ctx.restore()
	return width
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
	ctx.fillStyle = '#06080c'
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	const sweep = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
	sweep.addColorStop(0, 'rgba(245, 164, 0, 0.16)')
	sweep.addColorStop(0.4, 'rgba(6, 8, 12, 0.18)')
	sweep.addColorStop(0.72, 'rgba(94, 234, 212, 0.09)')
	sweep.addColorStop(1, 'rgba(245, 164, 0, 0.07)')
	ctx.fillStyle = sweep
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	// Central glow sitting behind the seal — anchors the eye to the emblem.
	const glow = ctx.createRadialGradient(CENTER_X, 648, 30, CENTER_X, 648, 600)
	glow.addColorStop(0, 'rgba(245, 164, 0, 0.18)')
	glow.addColorStop(0.5, 'rgba(94, 234, 212, 0.06)')
	glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	ctx.save()
	ctx.strokeStyle = 'rgba(94, 234, 212, 0.04)'
	ctx.lineWidth = 1
	for (let x = -120; x < CANVAS_WIDTH + 320; x += 150) {
		ctx.beginPath()
		ctx.moveTo(x, -20)
		ctx.lineTo(x - 300, CANVAS_HEIGHT + 20)
		ctx.stroke()
	}
	ctx.restore()

	ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
	for (let i = 0; i < 220; i++) {
		const x = 44 + ((i * 131) % (CANVAS_WIDTH - 88))
		const y = 44 + ((i * 89) % (CANVAS_HEIGHT - 88))
		ctx.fillRect(x, y, 1.2, 1.2)
	}

	// Framed "minted" panel: outer surface + inner amber hairline.
	roundedRect(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, FRAME.r)
	ctx.fillStyle = 'rgba(8, 11, 16, 0.62)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
	ctx.lineWidth = 2
	ctx.stroke()

	roundedRect(ctx, FRAME.x + 11, FRAME.y + 11, FRAME.w - 22, FRAME.h - 22, Math.max(2, FRAME.r - 6))
	ctx.strokeStyle = 'rgba(245, 164, 0, 0.18)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	// Corner ornaments.
	const cm = 30
	const cl = 30
	const corners: Array<[number, number, number, number]> = [
		[FRAME.x + cm, FRAME.y + cm, 1, 1],
		[FRAME.x + FRAME.w - cm, FRAME.y + cm, -1, 1],
		[FRAME.x + cm, FRAME.y + FRAME.h - cm, 1, -1],
		[FRAME.x + FRAME.w - cm, FRAME.y + FRAME.h - cm, -1, -1],
	]
	ctx.save()
	ctx.strokeStyle = 'rgba(245, 164, 0, 0.6)'
	ctx.lineWidth = 2.5
	ctx.lineCap = 'round'
	for (const [cx, cy, sx, sy] of corners) {
		ctx.beginPath()
		ctx.moveTo(cx + sx * cl, cy)
		ctx.lineTo(cx, cy)
		ctx.lineTo(cx, cy + sy * cl)
		ctx.stroke()
	}
	ctx.restore()

	// Bottom closure mark.
	drawDiamond(ctx, CENTER_X, FRAME.y + FRAME.h - 44, 5, 'rgba(245, 164, 0, 0.5)')
}

/**
 * The collectible centerpiece: a radial 24h "huella" ring (one wedge per hour,
 * length + brightness = average time) with the archetype emoji and peak hour
 * minted into the center disc.
 */
function drawSeal(ctx: CanvasRenderingContext2D, summary: ShareSummary, cx: number, cy: number): void {
	const R_OUTER = 152
	const R_INNER = 98
	const R_DISC = 90
	const R_MIN = R_INNER + 6
	const half = 7.5 - 1 // 15°/hour wedge minus a 2° gap
	const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180

	ctx.save()

	// Backplate glow.
	const plate = ctx.createRadialGradient(cx, cy, 30, cx, cy, R_OUTER + 36)
	plate.addColorStop(0, 'rgba(245, 164, 0, 0.16)')
	plate.addColorStop(0.6, 'rgba(94, 234, 212, 0.05)')
	plate.addColorStop(1, 'rgba(0, 0, 0, 0)')
	ctx.fillStyle = plate
	ctx.beginPath()
	ctx.arc(cx, cy, R_OUTER + 36, 0, Math.PI * 2)
	ctx.fill()

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
	ctx.lineWidth = 1
	for (const r of [R_OUTER + 20, R_OUTER + 8]) {
		ctx.beginPath()
		ctx.arc(cx, cy, r, 0, Math.PI * 2)
		ctx.stroke()
	}

	// 24h wedges. A soft drop shadow + radial bevel (darker base -> bright rim)
	// makes each wedge read as an extruded bar instead of a flat slice.
	ctx.save()
	ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
	ctx.shadowBlur = 10
	ctx.shadowOffsetY = 4
	summary.hours.forEach((rawValue, hour) => {
		const value = Math.max(0, Number(rawValue) || 0)
		const t = Math.min(1, value / HOUR_BUCKET_MAX_MS)
		const outerR = value > 0 ? R_MIN + t * (R_OUTER - R_MIN) : R_MIN
		const a0 = hour * 15 - half
		const a1 = hour * 15 + half
		const isPeak = summary.hasEnoughData && summary.peakLabel.startsWith(String(hour).padStart(2, '0'))

		ctx.beginPath()
		ctx.arc(cx, cy, outerR, toRad(a0), toRad(a1), false)
		ctx.arc(cx, cy, R_INNER, toRad(a1), toRad(a0), true)
		ctx.closePath()
		if (value > 0) {
			const grad = ctx.createRadialGradient(cx, cy, R_INNER, cx, cy, outerR)
			grad.addColorStop(0, `rgba(196, 130, 0, ${0.34 + t * 0.46})`)
			grad.addColorStop(1, `rgba(255, 193, 84, ${0.5 + t * 0.5})`)
			ctx.fillStyle = grad
		} else {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
		}
		ctx.fill()
		if (isPeak) {
			ctx.shadowColor = 'transparent'
			ctx.strokeStyle = '#5eead4'
			ctx.lineWidth = 2.5
			ctx.stroke()
			ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
		}
	})
	ctx.restore()

	// Hour ticks (00 / 06 / 12 / 18).
	ctx.fillStyle = 'rgba(201, 212, 229, 0.7)'
	ctx.font = `800 13px ${DATA_FONT}`
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (const hour of [0, 6, 12, 18]) {
		const tx = cx + Math.cos(toRad(hour * 15)) * (R_OUTER + 24)
		const ty = cy + Math.sin(toRad(hour * 15)) * (R_OUTER + 24)
		ctx.fillText(String(hour).padStart(2, '0'), tx, ty)
	}

	// Center disc: vertical bevel (lighter top -> darker bottom) plus an inner top
	// highlight and bottom shadow, so it reads like a minted, raised medal.
	ctx.beginPath()
	ctx.arc(cx, cy, R_DISC, 0, Math.PI * 2)
	const discGrad = ctx.createLinearGradient(cx, cy - R_DISC, cx, cy + R_DISC)
	discGrad.addColorStop(0, 'rgba(20, 26, 36, 0.96)')
	discGrad.addColorStop(1, 'rgba(4, 6, 10, 0.96)')
	ctx.fillStyle = discGrad
	ctx.fill()

	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, R_DISC - 1.5, Math.PI * 1.15, Math.PI * 1.85)
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)'
	ctx.lineWidth = 2
	ctx.stroke()
	ctx.beginPath()
	ctx.arc(cx, cy, R_DISC - 1.5, Math.PI * 0.15, Math.PI * 0.85)
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
	ctx.lineWidth = 2
	ctx.stroke()
	ctx.restore()

	ctx.beginPath()
	ctx.arc(cx, cy, R_DISC, 0, Math.PI * 2)
	ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	const peakHour = summary.hasEnoughData ? summary.peakLabel.slice(0, 5) : '--:--'
	ctx.fillStyle = '#f8fafc'
	ctx.font = `400 34px ${SANS_FONT}`
	ctx.fillText(summary.archetypeEmoji, cx, cy - 34)
	ctx.font = `900 40px ${DATA_FONT}`
	ctx.fillText(peakHour, cx, cy + 8)
	ctx.fillStyle = 'rgba(201, 212, 229, 0.78)'
	ctx.font = `700 14px ${SANS_FONT}`
	ctx.fillText(summary.hasEnoughData ? 'hora punta' : 'pocos datos', cx, cy + 38)

	ctx.textBaseline = 'alphabetic'
	ctx.restore()
}

/** Centered headline: section label + big total time + caption. */
function drawHero(ctx: CanvasRenderingContext2D, summary: ShareSummary): void {
	ctx.save()
	ctx.textAlign = 'center'
	ctx.fillStyle = '#f5a400'
	ctx.font = `900 18px ${DATA_FONT}`
	setTracking(ctx, '2.2px')
	const label = summary.mainLabel.toUpperCase()
	const labelWidth = ctx.measureText(label).width
	const ruleW = 48
	const ruleGap = 22
	const ruleY = 270
	const leftRule = ctx.createLinearGradient(
		CENTER_X - labelWidth / 2 - ruleGap - ruleW,
		0,
		CENTER_X - labelWidth / 2 - ruleGap,
		0
	)
	leftRule.addColorStop(0, 'rgba(245, 164, 0, 0)')
	leftRule.addColorStop(1, 'rgba(245, 164, 0, 0.58)')
	ctx.fillStyle = leftRule
	ctx.fillRect(CENTER_X - labelWidth / 2 - ruleGap - ruleW, ruleY, ruleW, 2)

	const rightRule = ctx.createLinearGradient(
		CENTER_X + labelWidth / 2 + ruleGap,
		0,
		CENTER_X + labelWidth / 2 + ruleGap + ruleW,
		0
	)
	rightRule.addColorStop(0, 'rgba(245, 164, 0, 0.58)')
	rightRule.addColorStop(1, 'rgba(245, 164, 0, 0)')
	ctx.fillStyle = rightRule
	ctx.fillRect(CENTER_X + labelWidth / 2 + ruleGap, ruleY, ruleW, 2)

	ctx.fillStyle = '#f5a400'
	ctx.fillText(label, CENTER_X, 276)
	setTracking(ctx, '0px')

	drawMainTime(ctx, summary.mainValue, CENTER_X, 374)

	ctx.textAlign = 'center'
	ctx.fillStyle = '#c9d4e5'
	ctx.font = `750 24px ${SANS_FONT}`
	ctx.fillText(truncateText(ctx, summary.mainCaption, CONTENT_W), CENTER_X, 418)
	ctx.restore()
}

/** Archetype + optional @username pills, centered beneath the seal. */
function drawSealPills(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const pills: Array<{ text: string; pad: number; color: string }> = [
		{ text: `${summary.archetypeEmoji} ${summary.archetypeLabel}`, pad: 22, color: '#f5a400' },
	]
	if (summary.username) pills.push({ text: `@${summary.username}`, pad: 22, color: '#5eead4' })

	const widths = pills.map(p => measurePill(ctx, p.text, p.pad))
	const gap = 14
	const total = widths.reduce((acc, w) => acc + w, 0) + gap * (pills.length - 1)
	let cursor = CENTER_X - total / 2
	pills.forEach((p, index) => {
		drawPill(ctx, p.text, cursor, y, p.pad, p.color)
		cursor += widths[index] + gap
	})
}

/** Three evenly-spaced metric tiles spanning the content width. */
function drawMetricTiles(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const tiles: Array<[string, string]> = [
		['Hora punta', summary.peakLabel],
		['Franja activa', summary.bandLabel],
		[summary.secondaryLabel, summary.secondaryValue],
	]
	const gap = 20
	const tileW = (CONTENT_W - gap * 2) / 3
	tiles.forEach(([label, value], index) => {
		drawMetricTile(ctx, label, value, CONTENT_LEFT + index * (tileW + gap), y, tileW)
	})
}

/** Top-3 subforums by total accumulated time, in a framed card. */
function drawForumsCard(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const x = CONTENT_LEFT
	const w = CONTENT_W
	const h = 168
	ctx.save()
	roundedRect(ctx, x, y, w, h, UI_RADIUS)
	ctx.fillStyle = 'rgba(6, 8, 13, 0.55)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	ctx.textAlign = 'center'
	ctx.fillStyle = 'rgba(94, 234, 212, 0.85)'
	ctx.font = `700 13px ${DATA_FONT}`
	setTracking(ctx, '2.5px')
	ctx.fillText(`${summary.forumTitle.toUpperCase()} · TIEMPO TOTAL`, x + w / 2, y + 34)
	setTracking(ctx, '0px')

	if (summary.forums.length === 0) {
		ctx.fillStyle = '#aeb8c7'
		ctx.font = `600 18px ${SANS_FONT}`
		ctx.fillText('Aún sin subforos suficientes.', x + w / 2, y + 100)
		ctx.restore()
		return
	}

	const cols = summary.forums.slice(0, 3)
	const colW = w / cols.length
	const chip = 26
	cols.forEach((forum, index) => {
		const colX = x + index * colW + 26
		const nameY = y + 92
		const chipY = nameY - 19

		// Column divider.
		if (index > 0) {
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
			ctx.lineWidth = 1
			ctx.beginPath()
			ctx.moveTo(x + index * colW, y + 62)
			ctx.lineTo(x + index * colW, y + h - 24)
			ctx.stroke()
		}

		// Neutral rank chip (no amber on #1).
		roundedRect(ctx, colX, chipY, chip, chip, 6)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
		ctx.fill()
		ctx.textAlign = 'center'
		ctx.fillStyle = 'rgba(201, 212, 229, 0.85)'
		ctx.font = `900 14px ${DATA_FONT}`
		ctx.fillText(String(index + 1), colX + chip / 2, nameY - 1)

		// Subforum name — display "Grotesk" font for variety vs the mono/sans elsewhere.
		ctx.textAlign = 'left'
		ctx.fillStyle = '#f8fafc'
		ctx.font = `800 22px ${DISPLAY_FONT}`
		ctx.fillText(truncateText(ctx, forum.label, colW - chip - 60), colX + chip + 12, nameY)

		// Total time — the prominent, colour-accented figure (amber #1, teal rest).
		ctx.fillStyle = index === 0 ? '#f5a400' : 'rgba(94, 234, 212, 0.92)'
		ctx.font = `800 19px ${DATA_FONT}`
		ctx.fillText(forum.value, colX + chip + 12, nameY + 32)
	})
	ctx.restore()
}

/** Compact duration for tight bar labels: biggest non-zero unit only ("119h", "45m"). */
function fmtShort(ms: number): string {
	const h = Math.floor(ms / 3_600_000)
	if (h >= 1) return `${h}h`
	const m = Math.floor(ms / 60_000)
	if (m >= 1) return `${m}m`
	return `${Math.max(1, Math.floor(ms / 1000))}s`
}

/**
 * Trend chart (month / day / week) drawn as a readable static graphic — a baseline
 * axis plus value labels above the bars (no faux-interactive "slots"), with the peak
 * bar highlighted to tie it to the "Pico" figure.
 */
function drawBars(ctx: CanvasRenderingContext2D, summary: ShareSummary, titleY: number): void {
	const x = CONTENT_LEFT
	const w = CONTENT_W
	const barAreaH = 52
	const baseY = titleY + 108
	const values = summary.bars.map(bar => Math.max(0, bar.value))
	const max = Math.max(...values, 0)
	const peakIndex = max > 0 ? values.indexOf(max) : -1
	const showValues = summary.bars.length <= 14
	const gap = summary.bars.length > 14 ? 4 : 12
	const barWidth = (w - gap * (summary.bars.length - 1)) / summary.bars.length

	ctx.save()
	ctx.fillStyle = 'rgba(245, 164, 0, 0.92)'
	ctx.font = `800 14px ${DATA_FONT}`
	ctx.textAlign = 'left'
	setTracking(ctx, '2.5px')
	ctx.fillText(summary.barTitle.toUpperCase(), x, titleY)
	setTracking(ctx, '0px')
	ctx.fillStyle = 'rgba(174, 184, 199, 0.65)'
	ctx.font = `600 15px ${SANS_FONT}`
	ctx.textAlign = 'right'
	ctx.fillText(max > 0 ? `Pico: ${fmtTime(max)}` : 'Sin actividad visible', x + w, titleY)

	// Baseline axis.
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
	ctx.lineWidth = 1.5
	ctx.beginPath()
	ctx.moveTo(x, baseY + 1)
	ctx.lineTo(x + w, baseY + 1)
	ctx.stroke()

	summary.bars.forEach((bar, index) => {
		const value = values[index]
		const t = max > 0 ? value / max : 0
		const isPeak = index === peakIndex
		const bh = value > 0 ? Math.max(5, Math.round(t * barAreaH)) : 2
		const bx = x + index * (barWidth + gap)
		const barTop = baseY - bh

		roundedRect(ctx, bx, barTop, barWidth, bh, 4)
		ctx.fillStyle = value > 0
			? isPeak
				? '#f5a400'
				: `rgba(245, 164, 0, ${0.32 + t * 0.5})`
			: 'rgba(255, 255, 255, 0.08)'
		ctx.fill()

		// Value above the bar (all bars when few; otherwise just the peak).
		if (value > 0 && (showValues || isPeak)) {
			ctx.fillStyle = isPeak ? '#f5a400' : 'rgba(201, 212, 229, 0.82)'
			ctx.font = `${isPeak ? 800 : 700} 12px ${DATA_FONT}`
			ctx.textAlign = 'center'
			ctx.fillText(fmtShort(value), bx + barWidth / 2, barTop - 8)
		}

		// X-axis label.
		const showLabel =
			summary.bars.length <= 14 || index === 0 || index === summary.bars.length - 1 || index % 5 === 0
		if (showLabel) {
			ctx.fillStyle = isPeak ? 'rgba(245, 164, 0, 0.9)' : '#9aa6b6'
			ctx.font = `700 13px ${SANS_FONT}`
			ctx.textAlign = 'center'
			ctx.fillText(bar.label, bx + barWidth / 2, baseY + 22)
		}
	})

	ctx.restore()
}

/** A small rotated-square brand mark. */
function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
	ctx.save()
	ctx.translate(cx, cy)
	ctx.rotate(Math.PI / 4)
	ctx.fillStyle = color
	ctx.fillRect(-r, -r, r * 2, r * 2)
	ctx.restore()
}

function drawHeader(ctx: CanvasRenderingContext2D, summary: ShareSummary): void {
	ctx.save()
	ctx.textBaseline = 'alphabetic'

	// Credential row: brand mark + label (left), period chip (right).
	drawDiamond(ctx, CONTENT_LEFT + 7, 110, 7, '#f5a400')
	ctx.textAlign = 'left'
	ctx.fillStyle = '#f5a400'
	ctx.font = `900 15px ${DATA_FONT}`
	setTracking(ctx, '3px')
	ctx.fillText('MEDIAVIDA PREMIUM', CONTENT_LEFT + 28, 116)
	setTracking(ctx, '0px')

	const chipPad = 18
	const chipW = measurePill(ctx, summary.period, chipPad)
	drawPill(ctx, summary.period, CONTENT_RIGHT - chipW, 90, chipPad, '#f5a400')

	// The period chip and hero metric carry the context; no repeated headline here.
	ctx.restore()
}

async function waitForCanvasFonts(): Promise<void> {
	const fonts = (document as DocumentWithFonts).fonts
	if (!fonts) return

	await Promise.all(
		CANVAS_FONT_LOADS.map(font => fonts.load?.(font, 'Mediavida Premium 0123456789')?.catch(() => []) ?? [])
	)
	await fonts.ready?.catch(() => undefined)
}

export async function createShareImageBlob(summary: ShareSummary): Promise<Blob> {
	await waitForCanvasFonts()

	const canvas = document.createElement('canvas')
	canvas.width = CANVAS_WIDTH * CANVAS_SCALE
	canvas.height = CANVAS_HEIGHT * CANVAS_SCALE

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo de imagen.')

	ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
	drawBackground(ctx)
	drawHeader(ctx, summary)
	drawHero(ctx, summary)
	drawSeal(ctx, summary, CENTER_X, 660)
	drawSealPills(ctx, summary, 872)
	drawMetricTiles(ctx, summary, 962)
	drawForumsCard(ctx, summary, 1098)
	drawBars(ctx, summary, 1322)

	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob)
			else reject(new Error('No se pudo generar el PNG.'))
		}, 'image/png')
	})
}
