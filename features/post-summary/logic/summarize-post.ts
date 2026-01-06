/**
 * Post Summarization Logic
 *
 * Uses Gemini AI to summarize individual post content.
 */

import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'

// Minimum characters for a post to be "long enough" to summarize
const MIN_POST_LENGTH = 150

// Funny messages for short posts (Spanish)
const SHORT_POST_MESSAGES = [
	'¿Resumir esto? Hasta mi loro lo lee en 2 segundos 🦜',
	'Esto es más corto que la paciencia de un mod 😅',
	'Post más escueto que las instrucciones de IKEA',
	'Ni ChatGPT puede resumir menos esto',
	'TL;DR: Ya era TL;DR de por sí',
	'¿Resumen? Bro, son 3 palabras',
	'Esto ya es un haiku, imposible acortar más',
	'Mi abuela resume más largo los buenos días',
	'¿Resumir? Literalmente puedes leerlo en lo que pestañeas 👀',
	'Error 404: Contenido suficiente no encontrado',
]

/**
 * Validates if a post contains enough text content to generate a meaningful summary.
 * @param text - The raw text content of the post
 */
export function isPostLongEnough(text: string): boolean {
	const cleanText = text.trim().replace(/\s+/g, ' ')
	return cleanText.length >= MIN_POST_LENGTH
}

/**
 * Selects a random witty message to display when a post is too short to summarize.
 */
export function getShortPostMessage(): string {
	const randomIndex = Math.floor(Math.random() * SHORT_POST_MESSAGES.length)
	return SHORT_POST_MESSAGES[randomIndex]
}

/**
 * Extracts and cleans text from a post element, removing quotes, spoilers, and code blocks.
 * @param postBody - The post body DOM element
 */
export function extractPostText(postBody: Element): string {
	// Clone to avoid modifying the original
	const clone = postBody.cloneNode(true) as Element

	// Remove blockquotes (cited text) - Keep this to avoid summarizing what others said
	clone.querySelectorAll('blockquote, .quote').forEach(el => el.remove())

	// CLEANUP: Remove "Click para desplegar" or spoiler triggers if they exist as separate text nodes
	// but KEEP the spoiler content.
	// In MV, the structure is usually: .spoiler-wrap > a.spoiler (trigger) + div.spoiler (content)
	// We want to remove the trigger 'a.spoiler' but keep 'div.spoiler'
	clone.querySelectorAll('.spoiler-wrap > a.spoiler').forEach(el => el.remove())

	// Remove code blocks (usually not useful for summary)
	clone.querySelectorAll('pre, code').forEach(el => el.remove())

	// Get text content
	const text = clone.textContent || ''

	// Clean up whitespace
	return text.trim().replace(/\s+/g, ' ')
}

interface PostSummaryResult {
	summary: string
	tone: string
}

/**
 * Requests an AI-generated summary of the provided text.
 * @param text - The cleaned post content
 * @returns A structured summary object
 */
export async function summarizePost(text: string): Promise<PostSummaryResult> {
	const aiService = await getAIService()

	if (!aiService) {
		throw new Error('IA no configurada. Ve a Ajustes > Inteligencia Artificial.')
	}

	const prompt = `Eres un asistente experto en resumir contenido de foros (Mediavida) en español.

TAREA:
Analiza el siguiente post y genera un JSON con "summary" y "tone".
ADAPTACIÓN DE LONGITUD:
- Si el post es CORTO (< 300 caracteres): Condénsalo en UNA sola frase directa.
- Si el post es LARGO o COMPLEJO: Resume los puntos clave en 2-3 frases, asegurando no perder matices importantes (incluso si están en spoilers).

REGLAS:
- INCLUYE el contenido de los SPOILERS en el resumen.
- TU SALIDA DEBE SER UNICAMENTE UN JSON VÁLIDO.
- NO uses markdown para el JSON.
- NO uses BBCode.
- Mantén el idioma Español.

POST A RESUMIR:
"${text}"`

	try {
		const rawResponse = await aiService.generate(prompt)
		// Clean potential markdown blocks
		const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, '').trim()
		const result = JSON.parse(cleanJson)

		return {
			summary: result.summary || 'No se pudo generar el resumen.',
			tone: result.tone || 'Neutro',
		}
	} catch (e) {
		logger.error('Error parsing summary JSON:', e)
		// Fallback if JSON fails
		return {
			summary: 'Error al procesar la respuesta de la IA.',
			tone: 'Error',
		}
	}
}
