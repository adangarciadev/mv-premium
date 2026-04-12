/**
 * Multi-Page Thread Summarizer
 *
 * Summarizes multiple pages of a thread using a map-reduce approach:
 * - Pages ≤ batch limit: Single prompt with all posts combined
 * - Pages > batch limit: Summarize each group → meta-summary from partial summaries
 *
 * Includes exponential-backoff retry on 429 (Rate Limit) errors,
 * and community stats injection (top posters, most-voted posts).
 */

import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'
import { fetchMultiplePages, getMultiPageLimit, type MultiPageProgress, type PageData } from './fetch-pages'
import { formatPostsForPrompt } from './extract-posts'
import {
	generateWithRetry,
	hydrateParticipantAvatars,
	parseJsonWithAIFallback,
	SUMMARY_JSON_STRUCTURE,
} from './summarizer-helpers'
import {
	getScaledLimits,
	buildSingleBatchPromptGemini,
	buildMetaSummaryPromptGemini,
} from './prompt-builder'

// =============================================================================
// TYPES
// =============================================================================

export interface MultiPageSummary {
	topic: string
	keyPoints: string[]
	participants: { name: string; contribution: string; avatarUrl?: string }[]
	status: string
	// Metadata
	title: string
	totalPostsAnalyzed: number
	totalUniqueAuthors: number
	pagesAnalyzed: number
	pageRange: string
	fetchErrors: number[]
	generationMs?: number
	modelUsed?: string
	error?: string
}

type SummaryPayload = {
	topic: string
	keyPoints: string[]
	participants: { name: string; contribution: string }[]
	status: string
}

interface BatchResult {
	summary: string
	pageRange: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

// GEMINI LIMITS (Original, High Performance)
const GEMINI_PAGES_PER_BATCH = 8
const GEMINI_MAX_CHARS_PER_BATCH = 40000

// CONCURRENCY (Gemini parallel batch processing)
const GEMINI_MAX_CONCURRENT_BATCHES = 3

/**
 * Worker-pool concurrency limiter.
 * Runs async tasks in parallel with at most `maxConcurrency` active at a time.
 * Results are returned in the original order.
 */
async function runConcurrent<T, R>(
	items: T[],
	maxConcurrency: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length)
	let nextIndex = 0

	async function worker(): Promise<void> {
		while (nextIndex < items.length) {
			const idx = nextIndex++
			results[idx] = await fn(items[idx], idx)
		}
	}

	const workerCount = Math.min(maxConcurrency, items.length)
	await Promise.all(Array.from({ length: workerCount }, () => worker()))

	return results
}

// =============================================================================
// COMMUNITY STATS
// =============================================================================

/**
 * Builds a stats block from all fetched posts to inject into the AI prompt.
 * Includes top posters by post count and most-voted posts by the community.
 */
function buildStatsBlock(pages: PageData[]): string {
	const postCounts = new Map<string, number>()
	const votedPosts: { number: number; author: string; votes: number }[] = []

	for (const page of pages) {
		for (const post of page.posts) {
			postCounts.set(post.author, (postCounts.get(post.author) || 0) + 1)
			if (post.votes && post.votes > 0) {
				votedPosts.push({ number: post.number, author: post.author, votes: post.votes })
			}
		}
	}

	const topPosters = [...postCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([author, count]) => `${author} (${count})`)
		.join(', ')

	const topVoted = votedPosts
		.sort((a, b) => b.votes - a.votes)
		.slice(0, 10)
		.map(p => `#${p.number} por ${p.author} (${p.votes} votos)`)
		.join(', ')

	let block = `ESTADISTICAS DEL HILO:\n- Usuarios mas activos (por nº de posts): ${topPosters}`
	if (topVoted) {
		block += `\n- Posts mas votados por la comunidad: ${topVoted}`
	}
	return block
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Summarizes multiple pages of a thread.
 *
 * @param fromPage - Start page (inclusive)
 * @param toPage - End page (inclusive)
 * @param onProgress - Progress callback for UI updates
 */
export async function summarizeMultiplePages(
	fromPage: number,
	toPage: number,
	onProgress?: (progress: MultiPageProgress) => void
): Promise<MultiPageSummary> {
	const aiService = await getAIService()

	if (!aiService) {
		return createErrorSummary('', fromPage, toPage, 'IA no configurada. Ve a Ajustes > Integraciones.')
	}

	const totalRequestedPages = Math.max(1, toPage - fromPage + 1)
	const maxPages = getMultiPageLimit()

	// Multi-page mode is intentionally 2+ pages.
	if (totalRequestedPages < 2) {
		return createErrorSummary('', fromPage, toPage, 'Para resumir una sola página, usa el botón "Resumir" del hilo.')
	}

	if (totalRequestedPages > maxPages) {
		return createErrorSummary(
			'',
			fromPage,
			toPage,
			`El máximo es ${maxPages} páginas por resumen.`
		)
	}

	const pagesPerBatch = GEMINI_PAGES_PER_BATCH
	const maxCharsPerBatch = GEMINI_MAX_CHARS_PER_BATCH

	// 1. Fetch all pages
	const fetchResult = await fetchMultiplePages(fromPage, toPage, onProgress)

	if (fetchResult.pages.length === 0) {
		return createErrorSummary(
			fetchResult.threadTitle,
			fromPage,
			toPage,
			'No se pudieron obtener posts de las paginas solicitadas.'
		)
	}

	// Build avatar map from all pages
	const avatarMap = new Map<string, string>()
	fetchResult.pages.forEach(page => {
		page.posts.forEach(post => {
			if (post.avatarUrl && !avatarMap.has(post.author)) {
				avatarMap.set(post.author, post.avatarUrl)
			}
		})
	})
	const { maxParticipants, maxKeyPoints } = getScaledLimits(fetchResult.pages.length)
	const targetParticipants = Math.min(maxParticipants, fetchResult.totalUniqueAuthors)

	try {
		let parsed: SummaryPayload

		const totalPages = fetchResult.pages.length
		const statsBlock = buildStatsBlock(fetchResult.pages)

		if (totalPages <= pagesPerBatch) {
			// Direct single-batch summarization
			onProgress?.({ phase: 'summarizing', current: 1, total: 2 })
			const rawSummary = await summarizeBatch(
				aiService,
				fetchResult.threadTitle,
				fetchResult.pages,
				totalPages,
				statsBlock,
				maxCharsPerBatch
			)
			onProgress?.({ phase: 'summarizing', current: 2, total: 2 })
			parsed = await parseSummaryPayloadWithFallback(rawSummary, aiService, 'resumen final')
		} else {
			// Map-reduce: split into batches and summarize them in parallel with a concurrency limit.
			const batches = splitIntoBatches(fetchResult.pages, pagesPerBatch)
			let completedBatches = 0
			const batchResults = await runConcurrent(batches, GEMINI_MAX_CONCURRENT_BATCHES, async batch => {
				const result = await processBatch(
					aiService,
					fetchResult.threadTitle,
					batch,
					totalPages,
					statsBlock,
					maxCharsPerBatch
				)
				completedBatches++
				onProgress?.({
					phase: 'summarizing',
					current: completedBatches,
					total: batches.length + 1,
					batch: completedBatches,
					totalBatches: batches.length,
				})
				return result
			})

			// Meta-summary from partials
			onProgress?.({
				phase: 'summarizing',
				current: batches.length + 1,
				total: batches.length + 1,
				batch: batches.length + 1,
				totalBatches: batches.length + 1,
			})

			const partialSummaries = batchResults.map(r => r.summary)
			const batchPageRanges = batchResults.map(r => r.pageRange)

			const rawSummary = await createMetaSummary(
				aiService,
				fetchResult.threadTitle,
				partialSummaries,
				batchPageRanges,
				fromPage,
				toPage,
				totalPages,
				statsBlock
			)
			parsed = await parseSummaryPayloadWithFallback(rawSummary, aiService, 'meta-resumen final')
		}
		parsed = normalizeSummaryPayload(parsed, {
			targetParticipants,
			targetKeyPoints: maxKeyPoints,
		})

		// Hydrate participants with avatars
		const participantsWithAvatars = hydrateParticipantAvatars(parsed.participants, avatarMap)

		return {
			...parsed,
			participants: participantsWithAvatars,
			title: fetchResult.threadTitle,
			totalPostsAnalyzed: fetchResult.totalPosts,
			totalUniqueAuthors: fetchResult.totalUniqueAuthors,
			pagesAnalyzed: fetchResult.pages.length,
			pageRange: `${fromPage}-${toPage}`,
			fetchErrors: fetchResult.fetchErrors,
		}
	} catch (error) {
		logger.error('MultiPageSummarizer error:', error)

		const errorMessage = error instanceof Error ? error.message : String(error)

		let userFriendlyError = 'Error al generar el resumen multi-pagina.'

		if (
			errorMessage.includes('429') ||
			errorMessage.includes('TPM') ||
			errorMessage.includes('Rate limit') ||
			errorMessage.includes('Límite de velocidad') ||
			errorMessage.includes('modelos agotados')
		) {
			userFriendlyError =
				'Límite de velocidad excedido. El plan gratuito es limitado para resúmenes largos. Espera un momento o reduce el rango de páginas.'
		} else if (
			errorMessage.includes('400') ||
			errorMessage.includes('too large') ||
			errorMessage.includes('context length')
		) {
			userFriendlyError = 'Contenido demasiado largo para procesar. Intenta reducir el número de páginas.'
		} else if (errorMessage.includes('500') || errorMessage.includes('503')) {
			userFriendlyError = 'Error temporal del servidor. Inténtalo de nuevo.'
		} else if (errorMessage.includes('tardó demasiado') || errorMessage.includes('tiempo máximo')) {
			userFriendlyError = errorMessage
		}

		return createErrorSummary(fetchResult.threadTitle, fromPage, toPage, userFriendlyError)
	}
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Processes a single batch: computes page range label and calls summarizeBatch.
 */
async function processBatch(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	batch: PageData[],
	totalPageCount: number,
	statsBlock: string,
	maxCharsPerBatch: number
): Promise<BatchResult> {
	const rangeStart = batch[0].pageNumber
	const rangeEnd = batch[batch.length - 1].pageNumber
	const pageRange = `Paginas ${rangeStart}-${rangeEnd}`

	const summary = await summarizeBatch(
		aiService,
		threadTitle,
		batch,
		totalPageCount,
		statsBlock,
		maxCharsPerBatch
	)

	return { summary, pageRange }
}

/**
 * Summarizes a single batch of pages in one AI call (with retry on 429).
 */
async function summarizeBatch(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	pages: PageData[],
	totalPageCount: number,
	statsBlock?: string,
	maxChars: number = GEMINI_MAX_CHARS_PER_BATCH
): Promise<string> {
	const pageRangeLabel =
		pages.length === 1
			? `Pagina ${pages[0].pageNumber}`
			: `Paginas ${pages[0].pageNumber}-${pages[pages.length - 1].pageNumber}`

	let formattedContent = ''
	for (const page of pages) {
		const formatted = formatPostsForPrompt(page.posts)
		formattedContent += `\n--- PAGINA ${page.pageNumber} (${page.postCount} posts) ---\n${formatted}\n`
	}

	// Truncate if total content is too large
	if (formattedContent.length > maxChars) {
		formattedContent = formattedContent.substring(0, maxChars) + '\n[...contenido truncado]'
	}

	const statsSection = statsBlock ? `\n${statsBlock}\n` : ''

	const prompt = `${buildSingleBatchPromptGemini(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle} (${pageRangeLabel})
${statsSection}
POSTS:
${formattedContent}`

	return generateWithRetry(aiService, prompt)
}

/**
 * Creates a meta-summary from partial summaries using map-reduce (with retry on 429).
 * Includes page range labels for each partial and global stats.
 */
async function createMetaSummary(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	partialSummaries: string[],
	batchPageRanges: string[],
	fromPage: number,
	toPage: number,
	totalPageCount: number,
	statsBlock: string
): Promise<string> {
	const formattedPartials = partialSummaries
		.map((summary, i) => {
			const rangeLabel = batchPageRanges[i] || `Seccion ${i + 1}`
			return `--- ${rangeLabel} ---\n${summary}`
		})
		.join('\n\n')

	const prompt = `${buildMetaSummaryPromptGemini(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle}
RANGO DE PAGINAS: ${fromPage} a ${toPage}

${statsBlock}

RESUMENES PARCIALES:
${formattedPartials}`

	return generateWithRetry(aiService, prompt)
}

/**
 * Splits pages into batches of the given size.
 */
function splitIntoBatches(pages: PageData[], batchSize: number): PageData[][] {
	const batches: PageData[][] = []
	for (let i = 0; i < pages.length; i += batchSize) {
		batches.push(pages.slice(i, i + batchSize))
	}
	return batches
}

// =============================================================================
// HELPERS
// =============================================================================

function createErrorSummary(title: string, fromPage: number, toPage: number, error: string): MultiPageSummary {
	return {
		topic: '',
		keyPoints: [],
		participants: [],
		status: '',
		title,
		totalPostsAnalyzed: 0,
		totalUniqueAuthors: 0,
		pagesAnalyzed: 0,
		pageRange: `${fromPage}-${toPage}`,
		fetchErrors: [],
		error,
	}
}

interface NormalizeSummaryOptions {
	targetParticipants: number
	targetKeyPoints: number
}

const MAX_STATUS_CHARS = 400

const COMPARISON_STOPWORDS = new Set([
	'el',
	'la',
	'los',
	'las',
	'un',
	'una',
	'unos',
	'unas',
	'de',
	'del',
	'en',
	'con',
	'por',
	'para',
	'sobre',
	'que',
	'se',
	'no',
	'ya',
	'al',
	'lo',
	'su',
	'sus',
	'es',
])

function normalizeSummaryPayload(
	parsed: SummaryPayload,
	options: NormalizeSummaryOptions
): SummaryPayload {
	const { targetParticipants, targetKeyPoints } = options
	const topic = normalizeWhitespace(typeof parsed.topic === 'string' ? parsed.topic : '')
	const keyPoints = normalizeKeyPoints(Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [], targetKeyPoints)
	const participants = normalizeParticipants(Array.isArray(parsed.participants) ? parsed.participants : [], targetParticipants)
	const status = normalizeStatus(typeof parsed.status === 'string' ? parsed.status : '')

	return {
		topic,
		keyPoints,
		participants,
		status,
	}
}

function normalizeKeyPoints(rawKeyPoints: string[], targetKeyPoints: number): string[] {
	if (targetKeyPoints <= 0) return []

	const seen = new Set<string>()
	const normalized: string[] = []

	for (const point of rawKeyPoints) {
		const clean = normalizeWhitespace(typeof point === 'string' ? point : '')
		if (!clean) continue

		const signature = getComparisonSignature(clean)
		if (seen.has(signature)) continue
		if (normalized.some(existing => areLikelyDuplicatePoints(existing, clean))) continue

		seen.add(signature)
		normalized.push(clean)
		if (normalized.length >= targetKeyPoints) break
	}

	return normalized
}

function normalizeParticipants(
	rawParticipants: { name: string; contribution: string }[],
	targetParticipants: number
): { name: string; contribution: string }[] {
	if (targetParticipants <= 0) return []

	const seenNames = new Set<string>()
	const normalized: { name: string; contribution: string }[] = []

	for (const participant of rawParticipants) {
		const name = normalizeWhitespace(typeof participant?.name === 'string' ? participant.name : '')
		if (!name) continue

		const signature = name.toLowerCase()
		if (seenNames.has(signature)) continue
		seenNames.add(signature)

		const contribution = normalizeWhitespace(
			typeof participant?.contribution === 'string' ? participant.contribution : ''
		)
		if (!contribution) continue

		normalized.push({
			name,
			contribution,
		})

		if (normalized.length >= targetParticipants) return normalized
	}

	return normalized
}

function normalizeStatus(rawStatus: string): string {
	const clean = collapseDuplicateSentences(normalizeWhitespace(rawStatus))
	if (!clean) return ''
	if (clean.length > MAX_STATUS_CHARS) return clean.slice(0, MAX_STATUS_CHARS).trim()
	return clean
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim()
}

function getComparisonSignature(text: string): string {
	return normalizeWhitespace(
		text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9\s]/g, ' ')
			.replace(/\s+/g, ' ')
	)
}

function getComparisonTokens(text: string): Set<string> {
	const signature = getComparisonSignature(text)
	if (!signature) return new Set<string>()
	return new Set(
		signature
			.split(' ')
			.filter(token => token.length >= 3)
			.filter(token => !COMPARISON_STOPWORDS.has(token))
	)
}

function tokenJaccardSimilarity(left: Set<string>, right: Set<string>): number {
	if (left.size === 0 || right.size === 0) return 0
	let intersection = 0
	for (const token of left) {
		if (right.has(token)) intersection++
	}
	const union = left.size + right.size - intersection
	return union > 0 ? intersection / union : 0
}

function areLikelyDuplicatePoints(a: string, b: string): boolean {
	const leftSignature = getComparisonSignature(a)
	const rightSignature = getComparisonSignature(b)

	if (!leftSignature || !rightSignature) return false
	if (leftSignature === rightSignature) return true
	if (leftSignature.length >= 42 && rightSignature.length >= 42) {
		if (leftSignature.includes(rightSignature) || rightSignature.includes(leftSignature)) return true
	}

	const similarity = tokenJaccardSimilarity(getComparisonTokens(leftSignature), getComparisonTokens(rightSignature))
	return similarity >= 0.78
}

function collapseDuplicateSentences(text: string): string {
	const sentences = text.split(/(?<=[.!?])\s+/)
	const seen = new Set<string>()
	const unique: string[] = []

	for (const sentence of sentences) {
		const clean = sentence.trim()
		if (!clean) continue
		const signature = clean.toLowerCase()
		if (seen.has(signature)) continue
		seen.add(signature)
		unique.push(clean)
	}

	return unique.join(' ')
}

async function parseSummaryPayloadWithFallback(
	rawSummary: string,
	aiService: { generate: (prompt: string) => Promise<string> },
	label: string
): Promise<SummaryPayload> {
	return parseJsonWithAIFallback<SummaryPayload>(rawSummary, aiService, label, SUMMARY_JSON_STRUCTURE)
}
