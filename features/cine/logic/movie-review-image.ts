import { sendMessage } from '@/lib/messaging'
import {
	buildMovieMetadata,
	getMovieRatingTier,
	getMovieReviewBadge,
	normalizeMovieRating,
	normalizeMovieReviewQuote,
	type MovieReviewCardData,
} from './movie-review'

const WIDTH = 1200
const HEIGHT = 453
const UI_FONT = 'Inter, "Segoe UI", Arial, sans-serif'
const HEAVY_FONT = 'Inter, "Segoe UI Black", "Arial Black", "Segoe UI", Arial, sans-serif'

async function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
	if (!url) return null
	try {
		const source = url.startsWith('data:') ? url : (await sendMessage('fetchMovieReviewImage', { url })).dataUrl
		return await new Promise((resolve, reject) => {
			const image = new Image()
			image.onload = () => resolve(image)
			image.onerror = reject
			image.src = source
		})
	} catch {
		return null
	}
}

function cover(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number
) {
	const scale = Math.max(width / image.width, height / image.height)
	const sw = width / scale
	const sh = height / scale
	ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height)
}

function getBackdropAmbientColor(image: HTMLImageElement): [number, number, number] | null {
	const sample = document.createElement('canvas')
	sample.width = 24
	sample.height = 14
	const sampleCtx = sample.getContext('2d', { willReadFrequently: true })
	if (!sampleCtx) return null

	sampleCtx.drawImage(image, 0, 0, sample.width, sample.height)
	const pixels = sampleCtx.getImageData(0, 0, sample.width, sample.height).data
	let red = 0
	let green = 0
	let blue = 0
	let totalWeight = 0

	for (let index = 0; index < pixels.length; index += 4) {
		const pixelRed = pixels[index]
		const pixelGreen = pixels[index + 1]
		const pixelBlue = pixels[index + 2]
		const luminance = 0.2126 * pixelRed + 0.7152 * pixelGreen + 0.0722 * pixelBlue
		if (luminance < 24) continue

		const chroma = Math.max(pixelRed, pixelGreen, pixelBlue) - Math.min(pixelRed, pixelGreen, pixelBlue)
		const weight = 0.35 + chroma / 180
		red += pixelRed * weight
		green += pixelGreen * weight
		blue += pixelBlue * weight
		totalWeight += weight
	}

	if (totalWeight === 0) return null
	return [Math.round(red / totalWeight), Math.round(green / totalWeight), Math.round(blue / totalWeight)]
}

function drawAmbientGlow(ctx: CanvasRenderingContext2D, color: [number, number, number]) {
	const [red, green, blue] = color
	const glow = ctx.createRadialGradient(315, 220, 24, 315, 220, 500)
	glow.addColorStop(0, `rgba(${red},${green},${blue},0.04)`)
	glow.addColorStop(0.55, `rgba(${red},${green},${blue},0.018)`)
	glow.addColorStop(1, `rgba(${red},${green},${blue},0)`)
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, 790, HEIGHT)
}

function fitText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	start: number,
	min: number,
	weight = 900
) {
	let size = start
	do {
		ctx.font = `${weight} ${size}px ${HEAVY_FONT}`
		size -= 1
	} while (size >= min && ctx.measureText(text).width > maxWidth)
}

function drawWrappedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	maxLines: number
) {
	const words = text.split(' ')
	const lines: string[] = []
	let line = ''
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate
		else {
			lines.push(line)
			line = word
		}
	}
	if (line) lines.push(line)
	const visible = lines.slice(0, maxLines)
	if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.…]+$/, '')}…`
	visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight, maxWidth))
}

function drawMovieMetadata(
	ctx: CanvasRenderingContext2D,
	metadata: string,
	director: string,
	x: number,
	y: number,
	maxWidth: number
) {
	if (!metadata) return

	const safeDirector = director.trim() && director !== 'Desconocido' ? director.trim() : ''
	const segments = metadata.split(' · ')
	const separator = ' · '
	const measureLine = (fontSize: number) =>
		segments.reduce((width, segment, index) => {
			const isDirector = Boolean(safeDirector) && index === 0
			ctx.font = `${isDirector ? 600 : 500} ${fontSize}px ${UI_FONT}`
			const segmentWidth = ctx.measureText(segment).width
			if (index === segments.length - 1) return width + segmentWidth
			ctx.font = `400 ${fontSize}px ${UI_FONT}`
			return width + segmentWidth + ctx.measureText(separator).width
		}, 0)

	let fontSize = 14
	let lineWidth = measureLine(fontSize)
	if (lineWidth > maxWidth) {
		fontSize = 12
		lineWidth = measureLine(fontSize)
	}
	const horizontalScale = Math.min(1, maxWidth / lineWidth)

	ctx.save()
	ctx.translate(x, y)
	ctx.scale(horizontalScale, 1)
	let cursorX = 0
	segments.forEach((segment, index) => {
		const isDirector = Boolean(safeDirector) && index === 0
		ctx.font = `${isDirector ? 600 : 500} ${fontSize}px ${UI_FONT}`
		ctx.fillStyle = isDirector ? '#d0d0d5' : '#9d9ca3'
		ctx.fillText(segment, cursorX, 0)
		cursorX += ctx.measureText(segment).width

		if (index < segments.length - 1) {
			ctx.font = `400 ${fontSize}px ${UI_FONT}`
			ctx.fillStyle = 'rgba(170, 168, 176, 0.55)'
			ctx.fillText(separator, cursorX, 0)
			cursorX += ctx.measureText(separator).width
		}
	})
	ctx.restore()
}

function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	const safeRadius = Math.min(radius, width / 2, height / 2)
	ctx.beginPath()
	ctx.moveTo(x + safeRadius, y)
	ctx.lineTo(x + width - safeRadius, y)
	ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
	ctx.lineTo(x + width, y + height - safeRadius)
	ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
	ctx.lineTo(x + safeRadius, y + height)
	ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
	ctx.lineTo(x, y + safeRadius)
	ctx.quadraticCurveTo(x, y, x + safeRadius, y)
	ctx.closePath()
}

function traceStar(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	outerRadius: number,
	innerRadius: number
) {
	ctx.beginPath()
	for (let point = 0; point < 10; point += 1) {
		const radius = point % 2 === 0 ? outerRadius : innerRadius
		const angle = -Math.PI / 2 + point * Math.PI / 5
		const pointX = centerX + Math.cos(angle) * radius
		const pointY = centerY + Math.sin(angle) * radius
		if (point === 0) ctx.moveTo(pointX, pointY)
		else ctx.lineTo(pointX, pointY)
	}
	ctx.closePath()
}

function drawStars(ctx: CanvasRenderingContext2D, rating: number, x: number, y: number, color: string) {
	const outerRadius = 7.5
	const innerRadius = 3.45
	const step = 16.4
	const centerY = y - 6.5

	ctx.save()
	ctx.lineJoin = 'round'
	ctx.lineWidth = 1.1

	for (let index = 0; index < 10; index += 1) {
		const centerX = x + outerRadius + index * step
		const fill = rating >= index + 1 ? 1 : rating >= index + 0.5 ? 0.5 : 0

		traceStar(ctx, centerX, centerY, outerRadius, innerRadius)
		ctx.strokeStyle = fill === 1 ? color : 'rgba(214, 207, 190, 0.25)'
		ctx.globalAlpha = fill === 1 ? 0.82 : 0.72
		ctx.stroke()

		if (fill > 0) {
			ctx.save()
			if (fill === 0.5) {
				ctx.beginPath()
				ctx.rect(centerX - outerRadius - 1, centerY - outerRadius - 1, outerRadius + 1, outerRadius * 2 + 2)
				ctx.clip()
			}
			traceStar(ctx, centerX, centerY, outerRadius, innerRadius)
			ctx.globalAlpha = 1
			ctx.fillStyle = color
			ctx.fill()
			ctx.restore()
		}
	}

	ctx.restore()
}

export async function createMovieReviewImage(data: MovieReviewCardData): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = WIDTH
	canvas.height = HEIGHT
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas is not available')

	const [backdrop, poster, avatar] = await Promise.all([
		loadImage(data.backdropUrl),
		loadImage(data.posterUrl),
		loadImage(data.avatarUrl),
	])
	const rating = data.rating === null ? null : normalizeMovieRating(data.rating)
	const tier = getMovieRatingTier(rating ?? 7)
	const badge = getMovieReviewBadge(data.badge)
	const quote = normalizeMovieReviewQuote(data.quote)
	const posterX = 958
	const posterWidth = 190
	const posterHeight = 285

	const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
	base.addColorStop(0, '#090a0d')
	base.addColorStop(0.7, '#121116')
	base.addColorStop(1, '#060608')
	ctx.fillStyle = base
	ctx.fillRect(0, 0, WIDTH, HEIGHT)
	const backdropHeight = HEIGHT
	const backdropWidth = Math.round(HEIGHT * (16 / 9))
	const backdropX = WIDTH - backdropWidth
	if (backdrop) {
		ctx.save()
		ctx.globalAlpha = 0.68
		cover(ctx, backdrop, backdropX, 0, backdropWidth, backdropHeight)
		ctx.restore()
	}
	const veil = ctx.createLinearGradient(0, 0, 1010, 0)
	veil.addColorStop(0, 'rgba(7,8,11,.99)')
	veil.addColorStop(0.22, 'rgba(7,8,11,.96)')
	veil.addColorStop(backdropX / 1010, 'rgba(7,8,11,1)')
	veil.addColorStop(0.48, 'rgba(7,8,11,.82)')
	veil.addColorStop(0.72, 'rgba(7,8,11,.46)')
	veil.addColorStop(1, 'rgba(7,8,11,.12)')
	ctx.fillStyle = veil
	ctx.fillRect(0, 0, WIDTH, HEIGHT)
	const bottom = ctx.createLinearGradient(0, 210, 0, HEIGHT)
	bottom.addColorStop(0, 'rgba(7,8,11,0)')
	bottom.addColorStop(1, 'rgba(7,8,11,.96)')
	ctx.fillStyle = bottom
	ctx.fillRect(0, 0, WIDTH, HEIGHT)
	if (backdrop) {
		const ambientColor = getBackdropAmbientColor(backdrop)
		if (ambientColor) drawAmbientGlow(ctx, ambientColor)
	}

	ctx.fillStyle = '#fff'
	fitText(ctx, data.title, 650, 38, 27)
	ctx.fillText(data.title, 46, 78)
	const metadata = buildMovieMetadata(data.director, data.year, data.genres)
	drawMovieMetadata(ctx, metadata, data.director, 47, 108, 650)

	const ratingText = rating === null ? '—' : String(rating).replace('.', ',')
	ctx.font = `950 43px ${HEAVY_FONT}`
	ctx.fillStyle = rating === null ? '#74767d' : tier.accent
	ctx.fillText(ratingText, 46, 177)
	const ratingWidth = ctx.measureText(ratingText).width
	ctx.font = `600 13px ${UI_FONT}`
	ctx.fillStyle = '#aaa7ad'
	ctx.fillText('/10', 51 + ratingWidth, 174)
	drawStars(ctx, rating ?? 0, 126 + ratingWidth, 172, rating === null ? '#5f6066' : tier.accent)

	if (badge) {
		ctx.font = `800 10px ${UI_FONT}`
		ctx.fillStyle = badge.border
		ctx.fillRect(47, 194, 2, 18)
		ctx.fillStyle = badge.text
		ctx.fillText(badge.label, 57, 207)
	}

	if (quote) {
		ctx.font = `italic 700 18px ${UI_FONT}`
		ctx.fillStyle = '#f1f0ed'
		drawWrappedText(ctx, `“${quote}”`, 46, badge ? 258 : 232, 570, 25, 3)
	}

	const authorY = 399
	if (avatar) {
		ctx.save()
		ctx.beginPath()
		ctx.arc(61, authorY - 7, 19, 0, Math.PI * 2)
		ctx.clip()
		cover(ctx, avatar, 42, authorY - 26, 38, 38)
		ctx.restore()
	} else {
		ctx.fillStyle = tier.accent
		ctx.beginPath()
		ctx.arc(61, authorY - 7, 19, 0, Math.PI * 2)
		ctx.fill()
		ctx.font = `900 17px ${HEAVY_FONT}`
		ctx.fillStyle = '#17130a'
		ctx.textAlign = 'center'
		ctx.fillText(data.username.charAt(0).toUpperCase(), 61, authorY - 1)
		ctx.textAlign = 'left'
	}
	ctx.font = `600 13px ${UI_FONT}`
	ctx.fillStyle = '#b8b5b8'
	ctx.fillText('Vista y valorada por', 93, authorY - 2)
	ctx.font = `800 13px ${UI_FONT}`
	ctx.fillStyle = '#fff'
	ctx.fillText(data.username, 216, authorY - 2)
	ctx.font = `800 10px ${UI_FONT}`
	ctx.fillStyle = '#8e8b91'
	ctx.textAlign = 'right'
	ctx.fillText('MV PREMIUM  ·  DATOS DE TMDB', 1154, 400)
	ctx.textAlign = 'left'

	if (poster) {
		ctx.save()
		ctx.shadowColor = 'rgba(0,0,0,.65)'
		ctx.shadowBlur = 18
		roundedRect(ctx, posterX, 42, posterWidth, posterHeight, 9)
		ctx.clip()
		cover(ctx, poster, posterX, 42, posterWidth, posterHeight)
		ctx.restore()
		roundedRect(ctx, posterX, 42, posterWidth, posterHeight, 9)
		ctx.strokeStyle = 'rgba(255,255,255,.16)'
		ctx.lineWidth = 1
		ctx.stroke()
	} else {
		ctx.fillStyle = 'rgba(255,255,255,.06)'
		roundedRect(ctx, posterX, 42, posterWidth, posterHeight, 9)
		ctx.fill()
		ctx.font = `800 14px ${UI_FONT}`
		ctx.fillStyle = '#77737a'
		ctx.textAlign = 'center'
		ctx.fillText('SIN PÓSTER', posterX + posterWidth / 2, 190)
		ctx.textAlign = 'left'
	}

	return await new Promise((resolve, reject) =>
		canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png')
	)
}
