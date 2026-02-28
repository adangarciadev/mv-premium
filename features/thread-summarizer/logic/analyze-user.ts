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
	type ExtractedPost,
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

interface UserAnalysisQualityRefinementOptions {
	provider: 'gemini' | 'groq'
	aiService: { generate: (prompt: string) => Promise<string> }
	label: string
	username: string
	pageCount: number
	posts: ExtractedPost[]
	onStatus?: (message: string) => void
}

interface UserAnalysisQualityAssessment {
	ok: boolean
	score: number
	issues: string[]
}

const MIN_PROFILE_WORDS = 26
const MIN_STYLE_WORDS = 18
const MIN_VERDICT_WORDS = 8
const MIN_TOPIC_WORDS = 4
const MIN_INTERACTION_WORDS = 6
const OVERREACH_PATTERNS = [
	/\blame\s+bots?\b/i,
	/\bbots?\s+rusos?\b/i,
	/\bvendido\b/i,
	/\btraidor\b/i,
	/\bmercenario\b/i,
] as const

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
		const qualityAdjusted = await improveUserAnalysisQualityIfNeeded(parsedData, {
			provider,
			aiService,
			label: `análisis de ${username}`,
			username,
			pageCount: 1,
			posts,
		})
		const normalized = normalizeUserAnalysisPayload(qualityAdjusted)

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
		const qualityAdjusted = await improveUserAnalysisQualityIfNeeded(parsedData, {
			provider,
			aiService,
			label: `análisis multi-página de ${username}`,
			username,
			pageCount,
			posts: allPosts,
			onStatus: message => emitAiProgress(message),
		})
		const normalized = normalizeUserAnalysisPayload(qualityAdjusted)

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
		tagline: normalizeText(parsed.tagline, { capitalizeLeadingLetter: true }),
		profile: normalizeText(parsed.profile, { capitalizeLeadingLetter: true }),
		topics: normalizeStringList(parsed.topics, { capitalizeLeadingLetter: true }),
		interactions: normalizeStringList(parsed.interactions, {
			normalizePostReferences: true,
			capitalizeLeadingLetter: true,
		}),
		style: normalizeText(parsed.style, { capitalizeLeadingLetter: true }),
		highlights: normalizeStringList(parsed.highlights, {
			normalizePostReferences: true,
			capitalizeLeadingLetter: true,
		}),
		verdict: normalizeText(parsed.verdict, { capitalizeLeadingLetter: true }),
	}
}

/** @internal Exported for testing. */
export function normalizeText(
	value: unknown,
	options: { capitalizeLeadingLetter?: boolean } = {}
): string {
	if (typeof value !== 'string') return ''
	const normalized = value.replace(/\s+/g, ' ').trim()
	if (!normalized || !options.capitalizeLeadingLetter) return normalized
	return capitalizeLeadingLetter(normalized)
}

function normalizePostReferences(text: string): string {
	// Keep @nick mentions intact, but normalize accidental numeric refs (@123 -> #123).
	return text.replace(/(^|[^a-zA-Z0-9_])@(\d+)\b/g, '$1#$2')
}

function capitalizeLeadingLetter(text: string): string {
	const idx = text.search(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/u)
	if (idx < 0) return text
	return `${text.slice(0, idx)}${text[idx].toUpperCase()}${text.slice(idx + 1)}`
}

/** @internal Exported for testing. */
export function normalizeStringList(
	value: unknown,
	options: { normalizePostReferences?: boolean; capitalizeLeadingLetter?: boolean } = {}
): string[] {
	if (!Array.isArray(value)) return []

	const normalized: string[] = []
	const seen = new Set<string>()

	for (const item of value) {
		let clean = normalizeText(item, { capitalizeLeadingLetter: options.capitalizeLeadingLetter })
		if (options.normalizePostReferences) {
			clean = normalizePostReferences(clean)
			if (options.capitalizeLeadingLetter) {
				clean = capitalizeLeadingLetter(clean)
			}
		}
		if (!clean) continue
		const dedupeKey = clean.toLowerCase()
		if (seen.has(dedupeKey)) continue
		seen.add(dedupeKey)
		normalized.push(clean)
	}

	return normalized
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length
}

function extractPostReferences(text: string): number[] {
	return Array.from(text.matchAll(/#(\d+)\b/g))
		.map(match => Number.parseInt(match[1], 10))
		.filter(Number.isFinite)
}

function assessUserAnalysisQuality(payload: UserAnalysisPayload): UserAnalysisQualityAssessment {
	const issues: string[] = []
	const profileWords = countWords(payload.profile)
	const styleWords = countWords(payload.style)
	const verdictWords = countWords(payload.verdict)

	const weakTopics = payload.topics.filter(topic => countWords(topic) < MIN_TOPIC_WORDS).length
	const weakInteractions = payload.interactions.filter(item => countWords(item) < MIN_INTERACTION_WORDS).length
	const numericAtRefs =
		payload.interactions.filter(item => /(^|[^a-zA-Z0-9_])@\d+\b/.test(item)).length +
		payload.highlights.filter(item => /(^|[^a-zA-Z0-9_])@\d+\b/.test(item)).length
	const lowercaseStarts =
		[...payload.topics, ...payload.interactions, ...payload.highlights].filter(item => /^[a-záéíóúñü]/u.test(item))
			.length

	if (profileWords < MIN_PROFILE_WORDS) issues.push(`perfil corto (${profileWords} palabras)`)
	if (styleWords < MIN_STYLE_WORDS) issues.push(`estilo corto (${styleWords} palabras)`)
	if (verdictWords < MIN_VERDICT_WORDS) issues.push(`veredicto corto (${verdictWords} palabras)`)
	if (weakTopics > 0) issues.push(`${weakTopics} temas demasiado telegráficos`)
	if (weakInteractions > 0) issues.push(`${weakInteractions} interacciones demasiado telegráficas`)
	if (numericAtRefs > 0) issues.push(`${numericAtRefs} referencias de post usando @N en lugar de #N`)
	if (lowercaseStarts > 0) issues.push(`${lowercaseStarts} elementos empiezan en minúscula`)

	const score =
		profileWords +
		styleWords +
		verdictWords +
		payload.topics.reduce((sum, t) => sum + countWords(t), 0) +
		payload.interactions.reduce((sum, i) => sum + countWords(i), 0) +
		payload.highlights.reduce((sum, h) => sum + countWords(h), 0) -
		issues.length * 18

	return {
		ok: issues.length === 0,
		score,
		issues,
	}
}

function assessUserAnalysisQualityWithContext(
	payload: UserAnalysisPayload,
	posts: ExtractedPost[]
): UserAnalysisQualityAssessment {
	const base = assessUserAnalysisQuality(payload)
	const issues = [...base.issues]

	const validPostRefs = new Set(posts.map(post => post.number))
	const referencedPosts = [
		...payload.interactions.flatMap(item => extractPostReferences(item)),
		...payload.highlights.flatMap(item => extractPostReferences(item)),
	]
	const invalidRefs = referencedPosts.filter(ref => !validPostRefs.has(ref))

	if (invalidRefs.length > 0) {
		const uniqueInvalid = Array.from(new Set(invalidRefs)).sort((a, b) => a - b)
		issues.push(`referencias de post inexistentes: ${uniqueInvalid.map(ref => `#${ref}`).join(', ')}`)
	}

	const narrativeFields = [payload.tagline, payload.profile, payload.verdict]
	const overreachHits = OVERREACH_PATTERNS.reduce((count, pattern) => {
		return count + narrativeFields.filter(field => pattern.test(field)).length
	}, 0)
	if (overreachHits > 0) {
		issues.push(`${overreachHits} afirmaciones demasiado categóricas o difamatorias sin anclaje claro`)
	}

	const score = base.score - invalidRefs.length * 20 - overreachHits * 16
	return {
		ok: issues.length === 0,
		score,
		issues,
	}
}

function sanitizeSnippet(text: string): string {
	return text.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function buildUserAnalysisPostHints(posts: ExtractedPost[]): string {
	const refs = posts.map(p => `#${p.number}`).join(', ')
	const highlights = [...posts]
		.sort((a, b) => (b.votes || 0) - (a.votes || 0))
		.slice(0, 6)
		.map(post => `- #${post.number}${post.votes ? ` [👍${post.votes}]` : ''}: "${sanitizeSnippet(post.content)}"`)
		.join('\n')

	return [
		`Referencias de post disponibles: ${refs || 'ninguna'}`,
		highlights ? `Posts relevantes (por votos):\n${highlights}` : '',
	]
		.filter(Boolean)
		.join('\n\n')
}

function buildUserAnalysisQualityRepairPrompt(
	payload: UserAnalysisPayload,
	options: Pick<UserAnalysisQualityRefinementOptions, 'username' | 'pageCount' | 'posts'>,
	issues: string[]
): string {
	const validRefs = options.posts.map(post => `#${post.number}`).join(', ') || 'ninguna'

	return `Eres un editor de calidad para análisis de usuarios en foros. Debes REESCRIBIR el siguiente JSON para mejorar precisión y estilo sin inventar hechos.

FORMATO ESTRICTO:
${USER_ANALYSIS_JSON_STRUCTURE}

PROBLEMAS DETECTADOS:
- ${issues.join('\n- ')}

OBJETIVO:
- Mantener el mismo sentido general del análisis de "${options.username}".
- Perfil: entre ${MIN_PROFILE_WORDS}-${MIN_PROFILE_WORDS + 45} palabras, natural y específico.
- Temas: frases concretas (mínimo ${MIN_TOPIC_WORDS} palabras), evitando estilo telegráfico.
- Interacciones: concretas y con contexto. Si citas posts, usa SIEMPRE #N (nunca @N).
- Estilo: entre ${MIN_STYLE_WORDS}-${MIN_STYLE_WORDS + 40} palabras, reconocible y no genérico.
- Highlights: mantener #N y votos [👍N] cuando existan.
- Veredicto: breve pero con sustancia (mínimo ${MIN_VERDICT_WORDS} palabras).
- Ortografía/estilo: evita inicios en minúscula; cada elemento de listas debe arrancar con mayúscula.
- Factualidad: no introduzcas acusaciones no demostrables (propaganda, bots, traición, etc.) salvo cita literal explícita.
- Si infieres algo, exprésalo en tono prudente ("sugiere", "ironiza", "parece"), no como hecho cerrado.
- No inventes nuevos datos ni referencias de post.
- Devuelve SOLO JSON válido, sin markdown ni texto adicional.

CONTEXTO:
- Páginas analizadas: ${options.pageCount}
- Referencias válidas de post: ${validRefs}

PISTAS DE POSTS:
${buildUserAnalysisPostHints(options.posts)}

JSON A REESCRIBIR:
${JSON.stringify(payload)}`
}

async function improveUserAnalysisQualityIfNeeded(
	payload: UserAnalysisPayload,
	options: UserAnalysisQualityRefinementOptions
): Promise<UserAnalysisPayload> {
	// Extra pass mainly needed for Groq/Kimi outputs.
	if (options.provider !== 'groq') return payload

	const normalizedInitial = normalizeUserAnalysisPayload(payload)
	const initialQuality = assessUserAnalysisQualityWithContext(normalizedInitial, options.posts)
	if (initialQuality.ok) return normalizedInitial

	try {
		options.onStatus?.('Ajustando calidad del análisis...')
		const repairPrompt = buildUserAnalysisQualityRepairPrompt(normalizedInitial, options, initialQuality.issues)
		const repairedRaw = await generateWithRetry(options.aiService, repairPrompt)
		const repairedParsed = await parseJsonWithAIFallback<UserAnalysisPayload>(
			repairedRaw,
			options.aiService,
			`${options.label} (revisión de calidad)`,
			USER_ANALYSIS_JSON_STRUCTURE
		)
		const normalizedRepaired = normalizeUserAnalysisPayload(repairedParsed)
		const repairedQuality = assessUserAnalysisQualityWithContext(normalizedRepaired, options.posts)
		if (repairedQuality.score > initialQuality.score) {
			return normalizedRepaired
		}
	} catch (error) {
		logger.warn('User analysis quality refinement pass failed. Keeping initial analysis.', error)
	}

	return normalizedInitial
}
