/**
 * AI Handlers Module
 * Handles Gemini AI API requests from content scripts.
 *
 * No system prompts are injected here - each feature (summarizer, post summary, etc.)
 * sends its own instructions as part of the user prompt for full control.
 */

import { onMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import type { GeminiAPIResponse, GeminiRequestBody, GeminiResponsePart } from '@/types'

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
// Setup All Handlers
// =============================================================================

/**
 * Setup all AI handlers
 */
export function setupAiHandlers(): void {
	setupGeminiHandler()
}
