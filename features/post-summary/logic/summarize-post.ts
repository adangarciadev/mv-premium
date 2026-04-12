/**
 * Post Summarization Logic
 *
 * Uses Gemini to summarize individual post content.
 */

import { getAIService } from '@/services/ai/gemini-service'
import { parseAIJsonResponse } from '@/services/ai/shared'
import { logger } from '@/lib/logger'
import { cleanPostContent } from '@/features/thread-summarizer/logic/clean-post-content'

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
 * Keeps spoiler content visible (removes only trigger links).
 * @param postBody - The post body DOM element
 */
export function extractPostText(postBody: Element): string {
	return cleanPostContent(postBody, { keepSpoilers: true, removeCodeBlocks: true })
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
Analiza el post y devuelve SOLO un JSON válido con "summary" y "tone".

EJEMPLO DE SALIDA:
{"summary": "El usuario explica cómo configurar Docker en Windows, incluyendo los pasos para WSL2 y las opciones de virtualización recomendadas.", "tone": "Didáctico y detallado"}

ADAPTACIÓN DE LONGITUD (proporcional al post original):
- Post CORTO (<300 caracteres): 1 frase directa.
- Post MEDIO (300-800 caracteres): 2-3 frases capturando los puntos principales.
- Post LARGO (>800 caracteres): 4-6 frases que capturen TODOS los puntos clave, matices y argumentos importantes. No sacrifiques detalle por brevedad.

REGLAS CRÍTICAS:
- SOLO JSON válido. Empieza con "{" y termina con "}". Sin markdown ni texto extra.
- Idioma: Español.
- El "tone" DEBE empezar con mayúscula y ser conciso (ej: "Informativo", "Crítico y frustrado", "Irónico pero constructivo").
- Detecta ironía/sarcasmo y refléjalo en el tono si aplica. No interpretes sarcasmo como apoyo literal.
- Si el post solo tiene media/embed/enlace sin comentario propio, indica "Comparte contenido sin comentario" en el summary.
- Evita frases genéricas. Sé específico sobre el contenido real del post.
- Incluye el contenido de SPOILERS si aporta contexto.
- NO uses BBCode en tu respuesta.

POST A RESUMIR:
"${text}"`

	try {
		const rawResponse = await aiService.generate(prompt)
		const result = parseAIJsonResponse<{ summary?: string; tone?: string }>(rawResponse)

		return {
			summary: result.summary || 'No se pudo generar el resumen.',
			tone: result.tone || 'Neutro',
		}
	} catch (e) {
		logger.error('Error parsing summary JSON:', e)
		return {
			summary: 'Error al procesar la respuesta de la IA.',
			tone: 'Error',
		}
	}
}
