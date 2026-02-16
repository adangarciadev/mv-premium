/**
 * Single-Page Thread Summarizer
 *
 * Summarizes the current page of a thread in one AI call.
 * Uses the same robustness patterns as the multi-page summarizer:
 * - Exponential-backoff retry on 429 / Rate Limit errors
 * - AI-powered JSON repair fallback on malformed responses
 * - Robust avatar hydration (exact-first, strict partial matching)
 */

import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'
import {
	extractAllPagePosts,
	getThreadTitle,
	getUniqueAuthors,
	formatPostsForPrompt,
	getCurrentPageNumber,
} from './extract-posts'
import {
	generateWithRetry,
	hydrateParticipantAvatars,
	parseJsonWithAIFallback,
	SUMMARY_JSON_STRUCTURE,
	isRateLimitError,
} from './summarizer-helpers'

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadSummary {
	topic: string
	keyPoints: string[]
	participants: { name: string; contribution: string; avatarUrl?: string }[]
	status: string
	// Metadata
	title: string
	postsAnalyzed: number
	uniqueAuthors: number
	pageNumber: number
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

// =============================================================================
// PROMPT - JSON Structure
// =============================================================================

const SYSTEM_INSTRUCTION = `Eres un analista de foros. Tu trabajo es resumir la pagina actual de un hilo de Mediavida y devolver un objeto JSON valido.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "Una frase concisa explicando el tema principal discutido en esta pagina.",
  "keyPoints": [
    "Punto clave 1",
    "Punto clave 2",
    "Punto clave 3 (maximo 5 puntos)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Resumen muy breve de su postura o aporte" },
    { "name": "Usuario2", "contribution": "Resumen muy breve de su postura o aporte" }
  ],
  "status": "Una frase ORIGINAL sobre el estado del debate. Ejemplo: 'Debate fragmentado y tenso, con discusiones circulares sobre [Tema] sin llegar a consenso.'"
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown (\`\`\`json).
- El JSON debe ser valido.
- Resume SOLO los posts que te paso.
- Ignora posts sin contenido ("pole", "+1").
- Incluye también el contenido que venga dentro de spoilers cuando aporte contexto.
- AGRUPACIÓN: Si varios usuarios comparten la misma postura, AGRÚPALOS (ej: "Pepito, Juanito").
- OP: Mantén la etiqueta (OP) si identificas al creador del hilo.
- No confundas apodos/rangos/títulos visuales junto al nick con el nombre del usuario: usa solo el nick real (salvo OP).
- Si un post solo incluye media/embed/enlace (tweet, vídeo, etc.) sin comentario propio del autor, NO lo uses para atribuir postura personal.
- Detecta ironía/sarcasmo y no la traduzcas como apoyo literal.
- Si una postura es irónica o ambigua, descríbela como "ironiza con..." o "crítica sarcástica a...".
- No uses verbos de apoyo ("defiende", "apoya", "celebra") salvo evidencia explícita y literal.
- Si no hay certeza total de postura, usa verbos neutrales: "plantea", "argumenta", "cuestiona" o "ironiza".
- Evita muletillas de IA como "En conclusión", "Cabe destacar" o "Es importante notar". Sé directo.
- Responde en espanol.
- IMPORTANTE: Tu respuesta debe empezar con { y terminar con }. Sin texto antes ni despues.`

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export async function summarizeCurrentThread(): Promise<ThreadSummary> {
	const title = getThreadTitle()
	const pageNumber = getCurrentPageNumber()
	const allPagePosts = extractAllPagePosts()

	if (allPagePosts.length === 0) {
		return createErrorSummary(title, pageNumber, 'No se detectaron posts en esta pagina.')
	}

	// Build avatar map from scraped posts
	const avatarMap = new Map<string, string>()
	allPagePosts.forEach(post => {
		if (post.avatarUrl && !avatarMap.has(post.author)) {
			avatarMap.set(post.author, post.avatarUrl)
		}
	})

	const uniqueAuthors = getUniqueAuthors(allPagePosts)
	const aiService = await getAIService()

	if (!aiService) {
		return createErrorSummary(
			title,
			pageNumber,
			'IA no configurada. Ve a Ajustes > Inteligencia Artificial.',
			allPagePosts.length,
			uniqueAuthors
		)
	}

	try {
		const formattedPosts = formatPostsForPrompt(allPagePosts)
		const pageInfo = pageNumber > 1 ? `(Pagina ${pageNumber} del hilo)` : '(Primera pagina del hilo)'

		const finalPrompt = `${SYSTEM_INSTRUCTION}

---
TITULO DEL HILO: ${title} ${pageInfo}

POSTS DE ESTA PAGINA (${allPagePosts.length} posts):
${formattedPosts}`

		// Generate with retry on 429 errors
		const rawResponse = await generateWithRetry(aiService, finalPrompt)

		// Parse JSON with AI-powered repair fallback
		const parsedData = await parseJsonWithAIFallback<SummaryPayload>(
			rawResponse,
			aiService,
			'resumen de página',
			SUMMARY_JSON_STRUCTURE
		)

		// Hydrate participants with avatars (exact-first, then strict partial)
		const participantsWithAvatars = hydrateParticipantAvatars(parsedData.participants, avatarMap)

		return {
			...parsedData,
			participants: participantsWithAvatars,
			title,
			postsAnalyzed: allPagePosts.length,
			uniqueAuthors,
			pageNumber,
		}
	} catch (error) {
		logger.error('ThreadSummarizer error:', error)

		const errorMessage = error instanceof Error ? error.message : String(error)

		let userFriendlyError = 'Error al generar el resumen.'

		if (isRateLimitError(error)) {
			userFriendlyError =
				'Límite de velocidad excedido. Espera un momento e inténtalo de nuevo.'
		} else if (
			errorMessage.includes('400') ||
			errorMessage.includes('too large') ||
			errorMessage.includes('context length')
		) {
			userFriendlyError = 'Contenido demasiado largo para procesar.'
		} else if (errorMessage.includes('500') || errorMessage.includes('503')) {
			userFriendlyError = 'Error temporal del servidor. Inténtalo de nuevo.'
		}

		return createErrorSummary(title, pageNumber, userFriendlyError, allPagePosts.length, uniqueAuthors)
	}
}

// =============================================================================
// HELPERS
// =============================================================================

function createErrorSummary(title: string, pageNumber: number, error: string, posts = 0, authors = 0): ThreadSummary {
	return {
		topic: '',
		keyPoints: [],
		participants: [],
		status: '',
		title,
		postsAnalyzed: posts,
		uniqueAuthors: authors,
		pageNumber,
		error,
	}
}
