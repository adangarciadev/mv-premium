/**
 * User Analysis Logic
 *
 * Analyzes a single user's participation in a thread, producing a
 * personality-driven profile instead of a general thread summary.
 *
 * Activated when ?u=username is present in the URL (Mediavida user filter).
 * Uses the same robustness patterns as the thread summarizer:
 * - Exponential-backoff retry on 429 errors
 * - AI-powered JSON repair fallback
 */

import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'
import {
	extractUserAnalysisPosts,
	getThreadTitle,
	getCurrentPageNumber,
	formatPostsForUserAnalysisPrompt,
} from './extract-posts'
import { fetchMultiplePages, type MultiPageProgress } from './fetch-pages'
import { buildUserAnalysisPromptGemini, buildUserAnalysisPromptGroq } from './prompt-builder'
import {
	generateWithRetry,
	parseJsonWithAIFallback,
	USER_ANALYSIS_JSON_STRUCTURE,
	isRateLimitError,
} from './summarizer-helpers'

// =============================================================================
// TYPES
// =============================================================================

export interface UserAnalysis {
	username: string
	tagline: string
	profile: string
	topics: string[]
	interactions: string[]
	style: string
	highlights: string[]
	verdict: string
	avatarUrl?: string
	// Metadata
	title: string
	postsAnalyzed: number
	pagesAnalyzed?: number
	pageRange?: string
	fetchErrors?: number[]
	generationMs?: number
	modelUsed?: string
	error?: string
}

type UserAnalysisPayload = Pick<UserAnalysis, 'tagline' | 'profile' | 'topics' | 'interactions' | 'style' | 'highlights' | 'verdict'>

// =============================================================================
// SINGLE-PAGE USER ANALYSIS
// =============================================================================

/**
 * Analyzes the current page's posts from a single filtered user.
 * Uses userAnalysisMode extraction to preserve reply context.
 */
export async function analyzeUserInThread(username: string): Promise<UserAnalysis> {
	const title = getThreadTitle()
	const pageNumber = getCurrentPageNumber()
	const posts = extractUserAnalysisPosts()

	if (posts.length === 0) {
		return createErrorAnalysis(username, title, `No se detectaron posts de ${username} en esta página.`)
	}

	const avatarUrl = posts.find(p => p.avatarUrl)?.avatarUrl

	const aiService = await getAIService()
	if (!aiService) {
		return createErrorAnalysis(
			username,
			title,
			'IA no configurada. Ve a Ajustes > Inteligencia Artificial.',
			posts.length
		)
	}

	try {
		const provider = aiService.getProvider()
		const systemPrompt = provider === 'groq'
			? buildUserAnalysisPromptGroq(username, 1)
			: buildUserAnalysisPromptGemini(username, 1)

		const pageInfo = pageNumber > 1 ? `(Página ${pageNumber})` : '(Primera página)'
		const formattedPosts = formatPostsForUserAnalysisPrompt(posts)

		const fullPrompt = `${systemPrompt}

---
HILO: ${title} ${pageInfo}

POSTS DE ${username} EN ESTA PÁGINA (${posts.length} posts):
${formattedPosts}`

		const rawResponse = await generateWithRetry(aiService, fullPrompt)
		const parsedData = await parseJsonWithAIFallback<UserAnalysisPayload>(
			rawResponse,
			aiService,
			`análisis de ${username}`,
			USER_ANALYSIS_JSON_STRUCTURE
		)
		const normalized = normalizeUserAnalysisPayload(parsedData)

		return {
			...normalized,
			username,
			avatarUrl,
			title,
			postsAnalyzed: posts.length,
		}
	} catch (error) {
		logger.error('UserAnalysis error:', error)
		return createErrorAnalysis(
			username,
			title,
			buildUserFriendlyError(error),
			posts.length
		)
	}
}

// =============================================================================
// MULTI-PAGE USER ANALYSIS
// =============================================================================

/**
 * Analyzes a user's posts across multiple thread pages.
 * Reuses fetchMultiplePages() which already handles ?u=username URL format.
 * Since we're only looking at one user's posts, all pages can be combined
 * into a single AI request (much less content than a full thread).
 */
export async function analyzeUserMultiplePages(
	username: string,
	fromPage: number,
	toPage: number,
	onProgress?: (progress: MultiPageProgress) => void
): Promise<UserAnalysis> {
	const title = getThreadTitle()
	const pageRange = `${fromPage}-${toPage}`
	const pageCount = toPage - fromPage + 1

	const aiService = await getAIService()
	if (!aiService) {
		return createErrorAnalysis(
			username,
			title,
			'IA no configurada. Ve a Ajustes > Inteligencia Artificial.'
		)
	}

	try {
		// fetchMultiplePages() already handles ?u=username pagination format
		const fetchResult = await fetchMultiplePages(fromPage, toPage, onProgress, { userAnalysisMode: true })

		// Combine all posts from all pages (they're all from the same user)
		const allPosts = fetchResult.pages.flatMap(p => p.posts)
		allPosts.sort((a, b) => a.number - b.number)

		if (allPosts.length === 0) {
			return createErrorAnalysis(
				username,
				title,
				`No se encontraron posts de ${username} en las páginas ${pageRange}.`,
				0,
				fetchResult.pages.length,
				pageRange,
				fetchResult.fetchErrors
			)
		}

		const avatarUrl = allPosts.find(p => p.avatarUrl)?.avatarUrl

		// Notify AI phase start
		const provider = aiService.getProvider()
		const emitAiProgress = (message: string) => {
			onProgress?.({ phase: 'summarizing', current: 0, total: 1, message })
		}

		emitAiProgress(provider === 'groq' ? 'Enviando análisis a Groq...' : 'Enviando análisis a Gemini...')

		const systemPrompt = provider === 'groq'
			? buildUserAnalysisPromptGroq(username, pageCount)
			: buildUserAnalysisPromptGemini(username, pageCount)

		const formattedPosts = formatPostsForUserAnalysisPrompt(allPosts)
		const fullPrompt = `${systemPrompt}

---
HILO: ${fetchResult.threadTitle || title} (Páginas ${pageRange})

POSTS DE ${username} EN ESTAS PÁGINAS (${allPosts.length} posts en ${fetchResult.pages.length} páginas):
${formattedPosts}`

		const rawResponse = await generateWithRetry(aiService, fullPrompt, {
			onRetry: ({ nextAttempt, maxAttempts, delayMs }) => {
				emitAiProgress(
					`Límite de velocidad. Reintentando (${nextAttempt}/${maxAttempts}) en ${Math.ceil(delayMs / 1000)}s...`
				)
			},
		})
		const parsedData = await parseJsonWithAIFallback<UserAnalysisPayload>(
			rawResponse,
			aiService,
			`análisis multi-página de ${username}`,
			USER_ANALYSIS_JSON_STRUCTURE,
			{
				onRepairStart: () => {
					emitAiProgress('Respuesta recibida. Corrigiendo formato JSON...')
				},
				repairRetryOptions: {
					onRetry: ({ nextAttempt, maxAttempts, delayMs }) => {
						emitAiProgress(
							`Corrigiendo JSON (reintento ${nextAttempt}/${maxAttempts}) en ${Math.ceil(delayMs / 1000)}s...`
						)
					},
				},
			}
		)
		const normalized = normalizeUserAnalysisPayload(parsedData)

		onProgress?.({ phase: 'summarizing', current: 1, total: 1 })

		return {
			...normalized,
			username,
			avatarUrl,
			title: fetchResult.threadTitle || title,
			postsAnalyzed: allPosts.length,
			pagesAnalyzed: fetchResult.pages.length,
			pageRange,
			fetchErrors: fetchResult.fetchErrors.length > 0 ? fetchResult.fetchErrors : undefined,
		}
	} catch (error) {
		logger.error('UserAnalysis multi-page error:', error)
		return createErrorAnalysis(
			username,
			title,
			buildUserFriendlyError(error),
			0,
			pageCount,
			pageRange
		)
	}
}

// =============================================================================
// HELPERS
// =============================================================================

function createErrorAnalysis(
	username: string,
	title: string,
	error: string,
	postsAnalyzed = 0,
	pagesAnalyzed?: number,
	pageRange?: string,
	fetchErrors?: number[]
): UserAnalysis {
	return {
		username,
		tagline: '',
		profile: '',
		topics: [],
		interactions: [],
		style: '',
		highlights: [],
		verdict: '',
		title,
		postsAnalyzed,
		pagesAnalyzed,
		pageRange,
		fetchErrors,
		error,
	}
}

function buildUserFriendlyError(error: unknown): string {
	if (isRateLimitError(error)) {
		return 'Límite de velocidad excedido. Espera un momento e inténtalo de nuevo.'
	}
	const msg = error instanceof Error ? error.message : String(error)
	if (msg.includes('tardó demasiado') || msg.includes('tiempo máximo')) {
		return msg
	}
	if (msg.includes('400') || msg.includes('too large') || msg.includes('context length')) {
		return 'Contenido demasiado largo para procesar.'
	}
	if (msg.includes('500') || msg.includes('503')) {
		return 'Error temporal del servidor. Inténtalo de nuevo.'
	}
	return 'Error al generar el análisis.'
}

/** @internal Exported for testing. */
export function normalizeUserAnalysisPayload(parsed: UserAnalysisPayload): UserAnalysisPayload {
	return {
		tagline: normalizeText(parsed.tagline),
		profile: normalizeText(parsed.profile),
		topics: normalizeStringList(parsed.topics),
		interactions: normalizeStringList(parsed.interactions),
		style: normalizeText(parsed.style),
		highlights: normalizeStringList(parsed.highlights),
		verdict: normalizeText(parsed.verdict),
	}
}

/** @internal Exported for testing. */
export function normalizeText(value: unknown): string {
	if (typeof value !== 'string') return ''
	return value.replace(/\s+/g, ' ').trim()
}

/** @internal Exported for testing. */
export function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return []

	const normalized: string[] = []
	const seen = new Set<string>()

	for (const item of value) {
		const clean = normalizeText(item)
		if (!clean) continue
		const dedupeKey = clean.toLowerCase()
		if (seen.has(dedupeKey)) continue
		seen.add(dedupeKey)
		normalized.push(clean)
	}

	return normalized
}
