/**
 * AI Handlers Module
 * Handles Gemini AI API requests
 */

import { onMessage } from '@/lib/messaging'
import { logger } from '@/lib/logger'
import type { GeminiAPIResponse, GeminiRequestBody, GeminiResponsePart } from '@/types'

// =============================================================================
// Constants
// =============================================================================

/**
 * Fallback models in order of preference (from user's Google AI console)
 */
const FALLBACK_MODELS = [
	'gemini-2.5-flash', // Primary (20 RPD limit)
	'gemini-2.5-flash-lite', // Lite version (20 RPD)
	'models/gemini-3-flash', // Need full path for newer models
	'gemini-2.0-flash', // Older but stable
	'gemini-1.5-flash', // Fallback - widely available
] as const

/**
 * System instruction for the AI assistant
 */
const SYSTEM_INSTRUCTION = `Eres un asistente de propósito general integrado en MVP (Mediavida Premium).

- Responde en español
- Sé útil, conciso y directo
- Para contenido de foro, usa formato BBCode válido:
  [b]negrita[/b], [i]cursiva[/i], [u]subrayado[/u]
  [h1]título[/h1], [h2]subtítulo[/h2]
  [url]enlace[/url], [url=https://...]texto[/url]
  [img]url[/img], [quote]cita[/quote], [spoiler]oculto[/spoiler]
  [code]código[/code], [center]texto[/center]
  [media]url youtube/twitter[/media]
- NO uses [size], [color], [font] - NO funcionan en Mediavida`

// =============================================================================
// AI Handlers
// =============================================================================

/**
 * Setup Gemini AI generation handler
 * API key comes in the message payload (BYOK - Bring Your Own Key)
 */
export function setupGeminiHandler(): void {
	onMessage('generateGemini', async ({ data }) => {
		const { apiKey, model, prompt, history } = data

		// Start with requested model, or use first fallback
		const startModel = model || FALLBACK_MODELS[0]
		const modelsToTry = [startModel, ...FALLBACK_MODELS.filter(m => m !== startModel)]

		let currentModelIndex = 0

		// Construct request body
		const body: GeminiRequestBody = {
			systemInstruction: {
				parts: [{ text: SYSTEM_INSTRUCTION }],
			},
		}

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

					// Extract function calls
					const functionCalls = parts
						.filter(
							(p): p is GeminiResponsePart & { functionCall: NonNullable<GeminiResponsePart['functionCall']> } =>
								'functionCall' in p && p.functionCall !== undefined
						)
						.map(p => ({
							name: p.functionCall.name,
							args: p.functionCall.args,
						}))

					return {
						success: true,
						text,
						functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
					}
				}

				const errorData = await response.json()

				// Handle 429 - Rate limit exceeded: try next model
				if (response.status === 429) {
					attempts++
					logger.warn(`Rate limited on ${currentModel}. Trying next model...`)

					// Try next model instead of just waiting
					currentModelIndex++
					attempts = 0 // Reset attempts for new model

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
					// Try next model on repeated failures
					currentModelIndex++
					attempts = 0

					if (currentModelIndex < modelsToTry.length) {
						logger.debug(`Error, trying ${modelsToTry[currentModelIndex]}`)
						continue
					}

					logger.error('All AI models failed:', e)
					return {
						success: false,
						error: e instanceof Error ? e.message : 'Error de conexión',
					}
				}
			}
		}

		return { success: false, error: 'Todos los modelos agotados' }
	})
}

/**
 * Setup all AI handlers
 */
export function setupAiHandlers(): void {
	setupGeminiHandler()
}
