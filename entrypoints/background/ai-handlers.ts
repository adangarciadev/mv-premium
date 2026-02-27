/**
 * AI Handlers Module
 * Handles Gemini and Groq AI API requests from content scripts.
 *
 * No system prompts are injected here - each feature (summarizer, post summary, etc.)
 * sends its own instructions as part of the user prompt for full control.
 */

import { onMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import type { GeminiAPIResponse, GeminiRequestBody, GeminiResponsePart } from '@/types'
import { PROMPT_MARKERS } from '@/features/thread-summarizer/logic/prompt-builder'

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

	try {
		return await fetch(input, { ...init, signal: controller.signal })
	} finally {
		clearTimeout(timeoutId)
	}
}

// =============================================================================
// Groq Pacing State (module-level, shared across requests)
// =============================================================================

let groqNextAllowedAt = 0

const GROQ_TARGET_TPM = 9000
const GROQ_MIN_GAP_MS = 2000
const GROQ_MAX_GAP_MS = 30000
const GROQ_MAX_TOTAL_RETRY_WINDOW_MS = 90000
const GROQ_THREAD_PROMPT_MAX_CHARS = 19000

function trimThreadPromptForGroq(content: string): string {
	if (content.length <= GROQ_THREAD_PROMPT_MAX_CHARS) return content

	const suffix = '\n[...contenido truncado por límite TPM de Groq]'
	const markers = [PROMPT_MARKERS.META_SUMMARY, 'POSTS:', 'POSTS DE ']

	for (const marker of markers) {
		const markerIndex = content.indexOf(marker)
		if (markerIndex < 0) continue

		const splitIndex = markerIndex + marker.length + 1
		const head = content.slice(0, splitIndex)
		const budgetForTail = GROQ_THREAD_PROMPT_MAX_CHARS - head.length - suffix.length

		if (budgetForTail <= 0) {
			return content.slice(0, GROQ_THREAD_PROMPT_MAX_CHARS - suffix.length) + suffix
		}

		const tail = content.slice(splitIndex, splitIndex + budgetForTail)
		return `${head}${tail}${suffix}`
	}

	return content.slice(0, GROQ_THREAD_PROMPT_MAX_CHARS - suffix.length) + suffix
}

function isHeavyForumPrompt(content: string): boolean {
	if (content.includes(PROMPT_MARKERS.THREAD_SUMMARY)) return true
	if (content.includes(PROMPT_MARKERS.META_SUMMARY)) return true
	if (content.includes(PROMPT_MARKERS.USER_ANALYSIS)) return true
	// Fallback: detect post blocks (batch prompts always include this)
	if (content.includes('POSTS:')) return true
	return false
}

async function waitForGroqSlot(): Promise<void> {
	const now = Date.now()
	if (now >= groqNextAllowedAt) return
	await sleep(groqNextAllowedAt - now)
}

function setGroqNextAllowedDelay(delayMs: number): void {
	const clamped = Math.min(Math.max(delayMs, GROQ_MIN_GAP_MS), GROQ_MAX_GAP_MS)
	groqNextAllowedAt = Date.now() + clamped
}

function computeGroqPacingMs(
	inputChars: number,
	isThreadSummary: boolean,
	usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
): number {
	if (!isThreadSummary) return GROQ_MIN_GAP_MS

	const usageTotal =
		typeof usage?.total_tokens === 'number' && usage.total_tokens > 0
			? usage.total_tokens
			: undefined

	// Conservative estimation when provider usage is missing.
	const estimatedInputTokens = Math.ceil(inputChars / 3.8)
	const fallbackTotalTokens = estimatedInputTokens + 700
	const totalTokens = usageTotal ?? fallbackTotalTokens

	// Delay needed so average throughput stays under target TPM.
	const pacingMs = Math.ceil((totalTokens / GROQ_TARGET_TPM) * 60_000) + 1000
	return Math.min(Math.max(pacingMs, GROQ_MIN_GAP_MS), GROQ_MAX_GAP_MS)
}

function parseHeaderDurationMs(value: string | null): number | null {
	if (!value) return null

	const normalized = value.trim().toLowerCase()
	if (!normalized) return null

	// Retry-After can be integer seconds (RFC) or provider-specific durations like "2.3s"
	if (/^\d+$/.test(normalized)) {
		const asSeconds = Number(normalized)
		return Number.isFinite(asSeconds) && asSeconds > 0 ? asSeconds * 1000 : null
	}

	const match = normalized.match(/([0-9]*\.?[0-9]+)\s*(ms|s|m)?/)
	if (!match) return null

	const amount = Number(match[1])
	if (!Number.isFinite(amount) || amount <= 0) return null

	const unit = match[2] || 's'
	if (unit === 'ms') return Math.ceil(amount)
	if (unit === 'm') return Math.ceil(amount * 60_000)
	return Math.ceil(amount * 1000)
}

function parseErrorMessageDelayMs(errorData: unknown): number | null {
	if (!errorData || typeof errorData !== 'object') return null

	const maybeError = (errorData as { error?: { message?: string } }).error
	const message = maybeError?.message
	if (!message) return null

	// Examples:
	// "Please try again in 5.2s"
	// "Please try again in 1m30s"
	const minuteSecondMatch = message.match(/try again in\s*(\d+)m\s*([0-9]*\.?[0-9]+)s/i)
	if (minuteSecondMatch) {
		const minutes = Number(minuteSecondMatch[1])
		const seconds = Number(minuteSecondMatch[2])
		if (Number.isFinite(minutes) && Number.isFinite(seconds) && minutes >= 0 && seconds >= 0) {
			return Math.ceil(minutes * 60_000 + seconds * 1000)
		}
	}

	const secondOnlyMatch = message.match(/try again in\s*([0-9]*\.?[0-9]+)s/i)
	if (!secondOnlyMatch) return null

	const seconds = Number(secondOnlyMatch[1])
	if (!Number.isFinite(seconds) || seconds <= 0) return null

	return Math.ceil(seconds * 1000)
}

function parseGroqRetryDelayMs(response: Response, errorData: unknown, attempt: number): number {
	const retryAfterMs = parseHeaderDurationMs(response.headers.get('retry-after'))
	const resetRequestsMs = parseHeaderDurationMs(response.headers.get('x-ratelimit-reset-requests'))
	const resetTokensMs = parseHeaderDurationMs(response.headers.get('x-ratelimit-reset-tokens'))
	const messageMs = parseErrorMessageDelayMs(errorData)

	const suggestedMs = [retryAfterMs, resetRequestsMs, resetTokensMs, messageMs].filter(
		(ms): ms is number => typeof ms === 'number' && ms > 0
	)

	// Exponential floor in case provider doesn't include retry hints.
	const fallbackMs = 5000 * (attempt + 1)
	const baseDelay = suggestedMs.length > 0 ? Math.max(...suggestedMs) : fallbackMs

	// Add a small safety buffer to avoid retriggering at the rate-window edge.
	return baseDelay + 1000
}

// =============================================================================
// Constants - Gemini
// =============================================================================

/**
 * Fallback models in order of preference.
 * Keep this chain strictly within Gemini models.
 */
const GEMINI_FALLBACK_MODELS = [
	'gemini-3-flash-preview',
	'gemini-2.5-flash',
	'gemini-2.5-flash-lite',
] as const

const GEMINI_FETCH_TIMEOUT_MS = 75_000
const GEMINI_MAX_TOTAL_RETRY_WINDOW_MS = 95_000

// =============================================================================
// Gemini Handler
// =============================================================================

/**
 * Setup Gemini AI generation handler
 * API key comes in the message payload (BYOK - Bring Your Own Key)
 */
export function setupGeminiHandler(): void {
	onMessage('generateGemini', async ({ data }) => {
		const { apiKey, model, prompt, history } = data

		// Start with requested model, or use first fallback
		const startModel = model || GEMINI_FALLBACK_MODELS[0]
		const modelsToTry = [startModel, ...GEMINI_FALLBACK_MODELS.filter(m => m !== startModel)]

		let currentModelIndex = 0

		// Construct request body (no system instruction - features provide their own)
		const body: GeminiRequestBody = {}

		// Content / History
		if (history) {
			body.contents = history.map(msg => ({
				role: msg.role === 'model' ? 'model' : 'user',
				parts: msg.parts,
			}))
		} else if (prompt) {
			body.contents = [{ role: 'user', parts: [{ text: prompt }] }]
		}

		// Retry logic with model fallback
		const maxAttemptsPerModel = 2
		let attempts = 0
		let sawTimeout = false
		const startedAt = Date.now()

		while (currentModelIndex < modelsToTry.length) {
			const elapsedMs = Date.now() - startedAt
			const remainingWindowMs = GEMINI_MAX_TOTAL_RETRY_WINDOW_MS - elapsedMs

			if (remainingWindowMs <= 0) {
				return {
					success: false,
					error: sawTimeout
						? 'La petición a Gemini tardó demasiado. Intenta de nuevo, reduce el rango o usa otro modelo.'
						: 'Se agotó el tiempo máximo de reintentos en Gemini. Intenta de nuevo.',
				}
			}

			const currentModel = modelsToTry[currentModelIndex]
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`

			try {
				const response = await fetchWithTimeout(
					url,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					},
					Math.min(GEMINI_FETCH_TIMEOUT_MS, remainingWindowMs)
				)

				if (response.ok) {
					const data: GeminiAPIResponse = await response.json()
					const candidate = data.candidates?.[0]
					const parts: GeminiResponsePart[] = candidate?.content?.parts || []

					// Extract text
					const textPart = parts.find(
						(p): p is GeminiResponsePart & { text: string } => 'text' in p && typeof p.text === 'string'
					)
					const text = textPart ? textPart.text : ''

					return {
						success: true,
						text,
						modelUsed: currentModel,
					}
				}

				const errorData = await response.json()

				// Handle 429 - Rate limit exceeded: try next model
				if (response.status === 429) {
					logger.warn(`Rate limited on ${currentModel}. Trying next model...`)

					currentModelIndex++
					attempts = 0

					if (currentModelIndex < modelsToTry.length) {
						logger.debug(`Switching to ${modelsToTry[currentModelIndex]}`)
						continue
					}

					return { success: false, error: 'Todos los modelos agotados. Espera un momento.' }
				}

				// Handle other errors
				return {
					success: false,
					error: errorData.error?.message || `Error ${response.status}`,
				}
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') {
					sawTimeout = true
					logger.warn(`Gemini request timeout on ${currentModel}. Trying next model...`)
					currentModelIndex++
					attempts = 0
					if (currentModelIndex < modelsToTry.length) continue
					return {
						success: false,
						error: 'La petición a Gemini tardó demasiado. Intenta de nuevo, reduce el rango o usa otro modelo.',
					}
				}

				attempts++
				if (attempts >= maxAttemptsPerModel) {
					currentModelIndex++
					attempts = 0

					if (currentModelIndex < modelsToTry.length) {
						logger.debug(`Error, trying ${modelsToTry[currentModelIndex]}`)
						continue
					}

					logger.error('All AI models failed:', e)
					return {
						success: false,
						error: e instanceof Error ? e.message : 'Error de conexion',
					}
				}
			}
		}

		return { success: false, error: 'Todos los modelos agotados' }
	})
}

// =============================================================================
// Groq Handler
// =============================================================================

/**
 * Setup Groq AI generation handler
 * Uses OpenAI-compatible API format. Single model (Kimi K2), no fallback chain.
 */
export function setupGroqHandler(): void {
	onMessage('generateGroq', async ({ data }) => {
		const { apiKey, model, prompt, history } = data

		const currentModel = model || 'moonshotai/kimi-k2-instruct'

		// Convert history to OpenAI format
		const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = []

		if (history) {
			for (const msg of history) {
				const textPart = msg.parts.find(p => 'text' in p)
				if (textPart && 'text' in textPart) {
					messages.push({
						role: msg.role === 'model' ? 'assistant' : 'user',
						content: textPart.text,
					})
				}
			}
		} else if (prompt) {
			messages.push({ role: 'user', content: prompt })
		}

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i]
			if (msg.role === 'user' && isHeavyForumPrompt(msg.content)) {
				messages[i] = {
					...msg,
					content: trimThreadPromptForGroq(msg.content),
				}
			}
		}

		// Retry with adaptive wait on 429 rate limits.
		const maxAttempts = 3
		const inputChars = messages.reduce((acc, msg) => acc + msg.content.length, 0)
		const isMetaSummary = messages.some(msg => msg.role === 'user' && msg.content.includes('RESUMENES PARCIALES'))
		const isClassicThreadSummary = messages.some(
			msg => msg.role === 'user' && msg.content.includes('TITULO DEL HILO')
		)
		const isHeavyForumRequest = messages.some(msg => msg.role === 'user' && isHeavyForumPrompt(msg.content))
		let maxTokens = isHeavyForumRequest ? (isMetaSummary ? 1100 : 1024) : 1800
		const temperature = isClassicThreadSummary ? 0.65 : 0.6

		// Inject system message for thread summaries to reinforce critical instructions
		if (isClassicThreadSummary) {
			messages.unshift({
				role: 'system',
				content: [
						'Eres un analista de foros experto. Devuelves SOLO JSON válido sin markdown.',
						'REGLAS CRITICAS:',
						'- NIVEL DE DETALLE: cada "contribution" debe tener 2-3 frases breves y cada punto clave 1-3 frases breves, sin párrafos largos.',
						'- Si el prompt pide un máximo de puntos clave o participantes, intenta completar ese máximo cuando haya material suficiente.',
						'- Cada "contribution" termina con punto (.). PROHIBIDO frases genéricas como "participó activamente".',
						'- No confundas apodos/rangos/títulos junto al nick con el nombre del usuario: usa solo el nick real.',
						'- Si un post solo tiene media/embed/enlace sin comentario propio, no lo uses para atribuir postura personal.',
						'- "status" DEBE ser una frase ORIGINAL de 18-40 palabras sobre el clima del debate. NUNCA una sola palabra.',
						'- Identifica correctamente QUIÉN critica a QUIÉN.',
					].join('\n'),
			})
		}
		const startedAt = Date.now()

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			if (Date.now() - startedAt > GROQ_MAX_TOTAL_RETRY_WINDOW_MS) {
				return {
					success: false,
					error:
						'Se agotó el tiempo máximo de reintentos en Groq. Prueba con menos páginas o cambia a Gemini.',
				}
			}

			try {
				await waitForGroqSlot()

				const response = await fetchWithTimeout(
					'https://api.groq.com/openai/v1/chat/completions',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: currentModel,
							messages,
							temperature,
							top_p: 0.9,
							// Keep responses compact to reduce TPM pressure in long summarization flows.
							max_tokens: maxTokens,
						}),
					},
					65_000
				)

				if (response.ok) {
					const groqData = await response.json()
					const text = groqData.choices?.[0]?.message?.content || ''
					const usage = groqData.usage as
						| { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number }
						| undefined

					const nextGapMs = computeGroqPacingMs(inputChars, isHeavyForumRequest, usage)
					setGroqNextAllowedDelay(nextGapMs)

					return {
						success: true,
						text,
						modelUsed: currentModel,
					}
				}

				const errorData = await response.json()
				const errorMessage = errorData?.error?.message || ''

				// Handle payload too large for current TPM window.
				// Retry by shrinking output budget first; this often salvages borderline requests.
				if (
					response.status === 400 &&
					typeof errorMessage === 'string' &&
					(errorMessage.includes('Request too large') || errorMessage.includes('tokens per minute (TPM)'))
				) {
					if (attempt < maxAttempts - 1 && maxTokens > 240) {
						maxTokens = Math.max(240, Math.floor(maxTokens * 0.65))
						logger.warn(
							`Groq request too large on ${currentModel} (attempt ${attempt + 1}/${maxAttempts}). Retrying with max_tokens=${maxTokens}.`
						)
						continue
					}

					return {
						success: false,
						error:
							'La petición a Groq es demasiado grande para el límite TPM actual. Reduce el rango de páginas o usa Gemini.',
					}
				}

				// Handle 429 - Rate limit exceeded
				if (response.status === 429) {
					const waitMs = Math.min(parseGroqRetryDelayMs(response, errorData, attempt), GROQ_MAX_GAP_MS)
					setGroqNextAllowedDelay(waitMs)
					logger.warn(
						`Groq rate limited on ${currentModel} (attempt ${attempt + 1}/${maxAttempts}). Waiting ${Math.ceil(waitMs / 1000)}s before retry.`
					)
					if (attempt < maxAttempts - 1) {
						if (Date.now() - startedAt + waitMs > GROQ_MAX_TOTAL_RETRY_WINDOW_MS) {
							return {
								success: false,
								error:
									'Se agotó el tiempo máximo de reintentos en Groq por límite de velocidad. Reduce el rango o usa Gemini.',
							}
						}
						await sleep(waitMs)
						continue
					}
					return {
						success: false,
						error:
							'Limite de velocidad de Groq excedido durante demasiado tiempo. Espera 1-2 minutos o reduce paginas por resumen.',
					}
				}

				// Handle other errors (don't retry)
				return {
					success: false,
					error: errorData.error?.message || `Error ${response.status}`,
				}
			} catch (e) {
				if (attempt >= maxAttempts - 1) {
					logger.error('Groq request failed:', e)
					return {
						success: false,
						error:
							e instanceof Error && e.name === 'AbortError'
								? 'La petición a Groq tardó demasiado. Intenta de nuevo o reduce el rango.'
								: e instanceof Error
									? e.message
									: 'Error de conexion',
					}
				}
			}
		}

		return { success: false, error: 'Error de conexion con Groq' }
	})
}

// =============================================================================
// Setup All Handlers
// =============================================================================

/**
 * Setup all AI handlers
 */
export function setupAiHandlers(): void {
	setupGeminiHandler()
	setupGroqHandler()
}
