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

const GROQ_TARGET_TPM = 14000
const GROQ_MIN_GAP_MS = 2000
const GROQ_MAX_GAP_MS = 30000
const GROQ_MAX_TOTAL_RETRY_WINDOW_MS = 90000

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
 * The 3 free-tier models come first; older models serve as silent last-resort.
 */
const GEMINI_FALLBACK_MODELS = [
	'gemini-2.5-flash',
	'gemini-2.5-flash-lite',
	'gemini-3-flash-preview',
	'gemini-2.0-flash', // Silent fallback (deprecated 31/03/2026)
] as const

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

		while (currentModelIndex < modelsToTry.length) {
			const currentModel = modelsToTry[currentModelIndex]
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`

			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})

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

		// Convert history to OpenAI format (no system prompt - features provide their own)
		const messages: { role: 'user' | 'assistant'; content: string }[] = []

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

		// Retry with adaptive wait on 429 rate limits.
		const maxAttempts = 3
		const inputChars = messages.reduce((acc, msg) => acc + msg.content.length, 0)
		const isMetaSummary = messages.some(msg => msg.role === 'user' && msg.content.includes('RESUMENES PARCIALES'))
		const isThreadSummary = messages.some(msg => msg.role === 'user' && msg.content.includes('TITULO DEL HILO'))
		const maxTokens = isThreadSummary ? (isMetaSummary ? 1200 : inputChars > 18000 ? 900 : 700) : 1800
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
							temperature: 0.6,
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

					const nextGapMs = computeGroqPacingMs(inputChars, isThreadSummary, usage)
					setGroqNextAllowedDelay(nextGapMs)

					return {
						success: true,
						text,
						modelUsed: currentModel,
					}
				}

				const errorData = await response.json()

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
