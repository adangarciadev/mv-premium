/**
 * Multi-Page Thread Summarizer
 *
 * Summarizes multiple pages of a thread using a map-reduce approach:
 * - Pages ≤ batch limit: Single prompt with all posts combined
 * - Pages > batch limit: Summarize each group → meta-summary from partial summaries
 *
 * Provider-aware execution:
 * - Gemini: Parallel batch processing (up to 3 concurrent) for speed
 * - Groq: Sequential processing with delays to respect TPM limits
 *
 * Includes exponential-backoff retry on 429 (Rate Limit) errors,
 * and community stats injection (top posters, most-voted posts).
 */

import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'
import { fetchMultiplePages, getProviderMultiPageLimit, type MultiPageProgress, type PageData } from './fetch-pages'
import { formatPostsForPrompt } from './extract-posts'
import {
	sleep,
	generateWithRetry,
	hydrateParticipantAvatars,
	parseJsonWithAIFallback,
	SUMMARY_JSON_STRUCTURE,
} from './summarizer-helpers'
import {
	getScaledLimits,
	buildSingleBatchPromptGemini,
	buildMetaSummaryPromptGemini,
	buildSingleBatchPromptGroq,
	buildMetaSummaryPromptGroq,
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

// GROQ LIMITS (single-call strategy for 2-10 pages)
const GROQ_PAGES_PER_BATCH = 10
const GROQ_MAX_CHARS_PER_BATCH = 28000

// GROQ THROTTLING (helps avoid 429 on long ranges like 30 pages)
const GROQ_LARGE_RANGE_THRESHOLD = 20
const GROQ_PAGES_PER_BATCH_LARGE_RANGE = 3
const GROQ_MAX_CHARS_PER_BATCH_LARGE_RANGE = 12000
const GROQ_DELAY_BETWEEN_CALLS_MS = 0
const GROQ_DELAY_BETWEEN_CALLS_MS_LARGE_RANGE = 0

// GROQ TOKEN BUDGET GUARDS (on_demand TPM is strict: 10k/request window)
const GROQ_TPM_LIMIT = 10000
const GROQ_CHARS_PER_TOKEN_ESTIMATE = 2.5
const GROQ_SAFETY_MARGIN_TOKENS = 1200
const GROQ_BATCH_RESERVED_RESPONSE_TOKENS = 1024
const GROQ_META_RESERVED_RESPONSE_TOKENS = 1100
const GROQ_MIN_DYNAMIC_CONTENT_CHARS = 1200
const GROQ_MAX_STATS_CHARS = 900
const GROQ_MAX_TOTAL_PROMPT_CHARS = 19000
const GROQ_PRIORITY_MIN_VOTES = 8
const GROQ_PRIORITY_MAX_ITEMS = 8
const GROQ_PRIORITY_SNIPPET_MAX_CHARS = 240
const GROQ_PRIORITY_BLOCK_MAX_CHARS = 1800
const GROQ_TRIM_HEAD_RATIO = 0.62

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
// PROVIDER LIMITS
// =============================================================================

function getGroqLimits(totalRequestedPages: number): {
	pagesPerBatch: number
	maxCharsPerBatch: number
	delayBetweenCallsMs: number
} {
	if (totalRequestedPages >= GROQ_LARGE_RANGE_THRESHOLD) {
		return {
			pagesPerBatch: GROQ_PAGES_PER_BATCH_LARGE_RANGE,
			maxCharsPerBatch: GROQ_MAX_CHARS_PER_BATCH_LARGE_RANGE,
			delayBetweenCallsMs: GROQ_DELAY_BETWEEN_CALLS_MS_LARGE_RANGE,
		}
	}

	return {
		pagesPerBatch: GROQ_PAGES_PER_BATCH,
		maxCharsPerBatch: GROQ_MAX_CHARS_PER_BATCH,
		delayBetweenCallsMs: GROQ_DELAY_BETWEEN_CALLS_MS,
	}
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

function trimStatsForProvider(statsBlock: string, provider: 'gemini' | 'groq'): string {
	if (provider !== 'groq') return statsBlock
	if (statsBlock.length <= GROQ_MAX_STATS_CHARS) return statsBlock
	return statsBlock.slice(0, GROQ_MAX_STATS_CHARS) + '\n[...estadisticas truncadas]'
}

function clipChars(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text
	if (maxChars <= 3) return text.slice(0, maxChars)
	return text.slice(0, maxChars - 3) + '...'
}

function buildHighImpactPostsBlock(pages: PageData[]): string {
	const highlights = pages
		.flatMap(page =>
			page.posts.map(post => ({
				pageNumber: page.pageNumber,
				number: post.number,
				author: post.author,
				votes: post.votes ?? 0,
				content: normalizeWhitespace(post.content),
			}))
		)
		.filter(post => post.votes >= GROQ_PRIORITY_MIN_VOTES && post.content.length > 24)
		.sort((a, b) => {
			if (b.votes !== a.votes) return b.votes - a.votes
			return a.number - b.number
		})
		.slice(0, GROQ_PRIORITY_MAX_ITEMS)

	if (highlights.length === 0) return ''

	let block = 'POSTS PRIORITARIOS (MUY VOTADOS):\n'
	for (const post of highlights) {
		const snippet = clipChars(post.content, GROQ_PRIORITY_SNIPPET_MAX_CHARS)
		const line = `- #${post.number} p.${post.pageNumber} ${post.author} [👍${post.votes}]: ${snippet}\n`
		if ((block + line).length > GROQ_PRIORITY_BLOCK_MAX_CHARS) break
		block += line
	}

	return block.trimEnd()
}

function trimContentKeepingHeadAndTail(text: string, maxChars: number): string {
	const marker = '\n[...contenido truncado por límite TPM de Groq]\n'

	if (text.length <= maxChars) return text
	if (maxChars <= marker.length + 40) return text.slice(0, maxChars)

	const budget = maxChars - marker.length
	const headChars = Math.floor(budget * GROQ_TRIM_HEAD_RATIO)
	const tailChars = Math.max(0, budget - headChars)
	const tailStart = Math.max(0, text.length - tailChars)

	return `${text.slice(0, headChars)}${marker}${text.slice(tailStart)}`
}

function fitDynamicContentToGroqBudget(
	promptPrefix: string,
	dynamicContent: string,
	reservedResponseTokens: number
): string {
	const maxPromptTokens = GROQ_TPM_LIMIT - reservedResponseTokens - GROQ_SAFETY_MARGIN_TOKENS
	const maxPromptCharsByTokens = Math.floor(maxPromptTokens * GROQ_CHARS_PER_TOKEN_ESTIMATE)
	const maxPromptChars = Math.min(maxPromptCharsByTokens, GROQ_MAX_TOTAL_PROMPT_CHARS)
	const availableChars = maxPromptChars - promptPrefix.length

	if (availableChars <= GROQ_MIN_DYNAMIC_CONTENT_CHARS) {
		return trimContentKeepingHeadAndTail(dynamicContent, GROQ_MIN_DYNAMIC_CONTENT_CHARS)
	}

	if (dynamicContent.length <= availableChars) return dynamicContent

	return trimContentKeepingHeadAndTail(dynamicContent, availableChars)
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

	// Detect provider (gemini vs groq)
	// If getProvider is not available (legacy), assume gemini
	const provider = 'getProvider' in aiService ? aiService.getProvider() : 'gemini'
	const totalRequestedPages = Math.max(1, toPage - fromPage + 1)
	const providerMaxPages = getProviderMultiPageLimit(provider)

	// Multi-page mode is intentionally 2+ pages.
	if (totalRequestedPages < 2) {
		return createErrorSummary('', fromPage, toPage, 'Para resumir una sola página, usa el botón "Resumir" del hilo.')
	}

	if (totalRequestedPages > providerMaxPages) {
		if (provider === 'groq') {
			return createErrorSummary(
				'',
				fromPage,
				toPage,
				`Con Groq (Kimi) el máximo es ${providerMaxPages} páginas por resumen debido a límites de tokens por minuto (TPM). Usa un rango más corto o cambia a Gemini para hasta 30 páginas.`
			)
		}

		return createErrorSummary(
			'',
			fromPage,
			toPage,
			`El máximo para este proveedor es ${providerMaxPages} páginas por resumen.`
		)
	}

	// SELECT LIMITS BASED ON PROVIDER
	const groqLimits = getGroqLimits(totalRequestedPages)
	const pagesPerBatch = provider === 'groq' ? groqLimits.pagesPerBatch : GEMINI_PAGES_PER_BATCH
	const maxCharsPerBatch = provider === 'groq' ? groqLimits.maxCharsPerBatch : GEMINI_MAX_CHARS_PER_BATCH
	const delayBetweenCallsMs = provider === 'groq' ? groqLimits.delayBetweenCallsMs : 0

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
	const authorStats = buildAuthorStats(fetchResult.pages)
	const { maxParticipants, maxKeyPoints } = getScaledLimits(fetchResult.pages.length)
	const targetParticipants = Math.min(maxParticipants, fetchResult.totalUniqueAuthors)

	try {
		let parsed: SummaryPayload

		const totalPages = fetchResult.pages.length
		const statsBlock = trimStatsForProvider(buildStatsBlock(fetchResult.pages), provider)

		if (totalPages <= pagesPerBatch) {
			// Direct single-batch summarization
			onProgress?.({ phase: 'summarizing', current: 1, total: 2 })
			const rawSummary = await summarizeBatch(
				aiService,
				fetchResult.threadTitle,
				fetchResult.pages,
				totalPages,
				statsBlock,
				provider,
				maxCharsPerBatch
			)
			onProgress?.({ phase: 'summarizing', current: 2, total: 2 })
			parsed = await parseSummaryPayloadWithFallback(rawSummary, aiService, 'resumen final')
		} else {
			// Map-reduce: split into batches, process per-provider strategy
			const batches = splitIntoBatches(fetchResult.pages, pagesPerBatch)
			let batchResults: BatchResult[]

			if (provider === 'gemini') {
				// GEMINI: Parallel batch processing with concurrency limit
				let completedBatches = 0
				batchResults = await runConcurrent(batches, GEMINI_MAX_CONCURRENT_BATCHES, async batch => {
					const result = await processBatch(
						aiService,
						fetchResult.threadTitle,
						batch,
						totalPages,
						statsBlock,
						provider,
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
			} else {
				// GROQ: Sequential processing with delay between calls
				batchResults = []
				for (let i = 0; i < batches.length; i++) {
					if (i > 0 && delayBetweenCallsMs > 0) {
						await sleep(delayBetweenCallsMs)
					}

					onProgress?.({
						phase: 'summarizing',
						current: i + 1,
						total: batches.length + 1,
						batch: i + 1,
						totalBatches: batches.length,
					})

					const result = await processBatch(
						aiService,
						fetchResult.threadTitle,
						batches[i],
						totalPages,
						statsBlock,
						provider,
						maxCharsPerBatch
					)
					batchResults.push(result)
				}
			}

			// Meta-summary from partials
			if (provider === 'groq' && delayBetweenCallsMs > 0) {
				await sleep(delayBetweenCallsMs)
			}

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
				statsBlock,
				provider
			)
			parsed = await parseSummaryPayloadWithFallback(rawSummary, aiService, 'meta-resumen final')
		}
		parsed = await improveSummaryQualityIfNeeded(parsed, {
			aiService,
			provider,
			targetParticipants,
			targetKeyPoints: maxKeyPoints,
			authorStats,
			label: 'resumen multi-página',
		})
		parsed = normalizeSummaryPayload(parsed, {
			targetParticipants,
			targetKeyPoints: maxKeyPoints,
			authorStats,
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
 * Used by both parallel (Gemini) and sequential (Groq) orchestrators.
 */
async function processBatch(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	batch: PageData[],
	totalPageCount: number,
	statsBlock: string,
	provider: 'gemini' | 'groq',
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
		provider,
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
	provider: 'gemini' | 'groq' = 'gemini',
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
	const highImpactBlock = provider === 'groq' ? buildHighImpactPostsBlock(pages) : ''
	const highImpactSection = highImpactBlock ? `\n${highImpactBlock}\n` : ''

	const promptBuilder = provider === 'groq' ? buildSingleBatchPromptGroq : buildSingleBatchPromptGemini
	const promptPrefix = `${promptBuilder(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle} (${pageRangeLabel})
${statsSection}
${highImpactSection}
POSTS:
`
	const safeContent =
		provider === 'groq'
			? fitDynamicContentToGroqBudget(promptPrefix, formattedContent, GROQ_BATCH_RESERVED_RESPONSE_TOKENS)
			: formattedContent
	const prompt = `${promptPrefix}${safeContent}`

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
	statsBlock: string,
	provider: 'gemini' | 'groq' = 'gemini'
): Promise<string> {
	const formattedPartials = partialSummaries
		.map((summary, i) => {
			const rangeLabel = batchPageRanges[i] || `Seccion ${i + 1}`
			return `--- ${rangeLabel} ---\n${summary}`
		})
		.join('\n\n')

	const promptBuilder = provider === 'groq' ? buildMetaSummaryPromptGroq : buildMetaSummaryPromptGemini
	const promptPrefix = `${promptBuilder(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle}
RANGO DE PAGINAS: ${fromPage} a ${toPage}

${statsBlock}

RESUMENES PARCIALES:
`
	const safePartials =
		provider === 'groq'
			? fitDynamicContentToGroqBudget(promptPrefix, formattedPartials, GROQ_META_RESERVED_RESPONSE_TOKENS)
			: formattedPartials
	const prompt = `${promptPrefix}${safePartials}`

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

type AuthorAggregate = {
	posts: number
	votes: number
	topSnippet?: string
	topPostNumber?: number
	topPostVotes?: number
}

interface NormalizeSummaryOptions {
	targetParticipants: number
	targetKeyPoints: number
	authorStats: Map<string, AuthorAggregate>
}

interface QualityRefinementOptions extends NormalizeSummaryOptions {
	aiService: { generate: (prompt: string) => Promise<string> }
	provider: 'gemini' | 'groq'
	label: string
}

interface QualityAssessment {
	ok: boolean
	score: number
	issues: string[]
}

const MAX_STATUS_CHARS = 400
const MIN_STATUS_WORDS = 12
const MAX_STATUS_WORDS = 40
const MIN_CONTRIBUTION_WORDS = 8
const MIN_KEYPOINT_WORDS = 6
const MAX_TOP_SNIPPET_CHARS = 160

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

function buildAuthorStats(pages: PageData[]): Map<string, AuthorAggregate> {
	const stats = new Map<string, AuthorAggregate>()

	for (const page of pages) {
		for (const post of page.posts) {
			const current = stats.get(post.author) ?? { posts: 0, votes: 0, topPostVotes: 0 }
			current.posts += 1
			const postVotes = post.votes && post.votes > 0 ? post.votes : 0
			current.votes += postVotes

			const cleanContent = normalizeWhitespace(post.content)
			if (cleanContent.length > 24) {
				if (!current.topSnippet) {
					current.topSnippet = clipChars(cleanContent, MAX_TOP_SNIPPET_CHARS)
					current.topPostNumber = post.number
					current.topPostVotes = postVotes
				} else if (postVotes >= (current.topPostVotes ?? 0)) {
					current.topSnippet = clipChars(cleanContent, MAX_TOP_SNIPPET_CHARS)
					current.topPostNumber = post.number
					current.topPostVotes = postVotes
				}
			}

			stats.set(post.author, current)
		}
	}

	return stats
}

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

function isWeakContribution(text: string): boolean {
	const clean = normalizeWhitespace(text)
	if (!clean) return true
	if (countWords(clean) < MIN_CONTRIBUTION_WORDS) return true
	if (/[#]\d+\s+\d+h/i.test(clean)) return true
	if (clean.endsWith('...')) return true
	if (/(?:\bcon la|\bde la|\by|\bque|\ben|\ba|\bpor)$/i.test(clean)) return true
	return false
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

function countWords(text: string): number {
	const clean = normalizeWhitespace(text)
	if (!clean) return 0
	return clean.split(' ').filter(Boolean).length
}

function isWeakStatus(text: string): boolean {
	return countWords(text) < MIN_STATUS_WORDS
}

function isWeakKeyPoint(text: string): boolean {
	return countWords(text) < MIN_KEYPOINT_WORDS
}

function sanitizeSnippet(snippet: string): string {
	return normalizeWhitespace(snippet.replace(/["“”]/g, "'"))
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

function assessSummaryQuality(
	parsed: SummaryPayload,
	options: Pick<NormalizeSummaryOptions, 'targetParticipants' | 'targetKeyPoints'>
): QualityAssessment {
	const topic = normalizeWhitespace(typeof parsed.topic === 'string' ? parsed.topic : '')
	const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(point => normalizeWhitespace(point)) : []
	const participants = Array.isArray(parsed.participants)
		? parsed.participants.map(participant => ({
				name: normalizeWhitespace(participant?.name || ''),
				contribution: normalizeWhitespace(participant?.contribution || ''),
			}))
		: []
	const status = normalizeWhitespace(typeof parsed.status === 'string' ? parsed.status : '')

	const weakContributionCount = participants.filter(
		participant => !participant.name || isWeakContribution(participant.contribution)
	).length
	const weakKeyPointCount = keyPoints.filter(point => !point || isWeakKeyPoint(point)).length
	const weakStatus = !status || isWeakStatus(status)

	const issues: string[] = []
	if (!topic || countWords(topic) < 4) issues.push('topic demasiado escueto')
	if (weakKeyPointCount > 0) issues.push(`${weakKeyPointCount} keyPoints flojos o genéricos`)
	if (weakContributionCount > 0) issues.push(`${weakContributionCount} participants con contribution floja`)
	if (weakStatus) issues.push('status demasiado genérico o corto')

	let score = 0
	score += Math.min(participants.length, options.targetParticipants)
	score += Math.min(keyPoints.length, options.targetKeyPoints)
	score += (participants.length - weakContributionCount) * 3
	score += (keyPoints.length - weakKeyPointCount) * 2
	if (!weakStatus) score += 3
	score -= weakContributionCount * 3
	score -= weakKeyPointCount * 2

	return {
		ok: issues.length === 0,
		score,
		issues,
	}
}

function buildAuthorQualityHints(authorStats: Map<string, AuthorAggregate>, maxItems = 10): string {
	const rows = Array.from(authorStats.entries())
		.sort((a, b) => {
			if (b[1].votes !== a[1].votes) return b[1].votes - a[1].votes
			return b[1].posts - a[1].posts
		})
		.slice(0, maxItems)
		.map(([author, stats]) => {
			const snippet = stats.topSnippet ? ` | cita: "${sanitizeSnippet(stats.topSnippet)}"` : ''
			return `- ${author}: ${stats.posts} posts, ${stats.votes} votos${snippet}`
		})

	return rows.join('\n')
}

function buildQualityRepairPrompt(
	parsed: SummaryPayload,
	options: Pick<QualityRefinementOptions, 'targetParticipants' | 'targetKeyPoints' | 'authorStats'>,
	issues: string[]
): string {
	const issueSummary = issues.join('; ')
	const authorHints = buildAuthorQualityHints(options.authorStats)
	const payload = JSON.stringify(parsed)

	return `Eres un editor de calidad para resúmenes de foros. Debes REESCRIBIR el siguiente JSON para hacerlo más útil, sin inventar hechos.

FORMATO ESTRICTO:
${SUMMARY_JSON_STRUCTURE}

OBJETIVO:
- Corregir estos problemas detectados: ${issueSummary}.
- Mantener el mismo tema y sentido general.
- keyPoints: hasta ${options.targetKeyPoints} puntos, concretos y no genéricos.
- participants: hasta ${options.targetParticipants} usuarios con contribution concreta.
- Cada contribution: mínimo ${MIN_CONTRIBUTION_WORDS} palabras, con postura y contexto.
- status: frase original de ${MIN_STATUS_WORDS}-${MAX_STATUS_WORDS} palabras.
- PROHIBIDO usar plantillas genéricas como "participó activamente", "presencia constante" o similares.
- No inventes nombres, cifras ni hechos.
- Devuelve SOLO JSON válido, sin markdown ni texto extra.

PISTAS DE AUTORES (solo referencia, no inventar):
${authorHints || '- sin pistas adicionales'}

JSON A REESCRIBIR:
${payload}`
}

async function improveSummaryQualityIfNeeded(
	parsed: SummaryPayload,
	options: QualityRefinementOptions
): Promise<SummaryPayload> {
	// The extra quality pass is mainly needed for Groq/Kimi responses.
	if (options.provider !== 'groq') return parsed

	const initialQuality = assessSummaryQuality(parsed, options)
	if (initialQuality.ok) return parsed

	try {
		const repairPrompt = buildQualityRepairPrompt(parsed, options, initialQuality.issues)
		const repairedRaw = await generateWithRetry(options.aiService, repairPrompt)
		const repairedParsed = await parseSummaryPayloadWithFallback(
			repairedRaw,
			options.aiService,
			`${options.label} (revisión de calidad)`
		)
		const repairedQuality = assessSummaryQuality(repairedParsed, options)

		if (repairedQuality.score > initialQuality.score) {
			return repairedParsed
		}
	} catch (error) {
		logger.warn('Quality refinement pass failed. Keeping initial parsed summary.', error)
	}

	return parsed
}

async function parseSummaryPayloadWithFallback(
	rawSummary: string,
	aiService: { generate: (prompt: string) => Promise<string> },
	label: string
): Promise<SummaryPayload> {
	return parseJsonWithAIFallback<SummaryPayload>(rawSummary, aiService, label, SUMMARY_JSON_STRUCTURE)
}
