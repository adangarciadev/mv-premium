import { getAIService } from '@/services/ai/gemini-service'
import { logger } from '@/lib/logger'
import {
	extractAllPagePosts,
	getThreadTitle,
	getUniqueAuthors,
	formatPostsForPrompt,
	getCurrentPageNumber,
} from './extract-posts'

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
	error?: string
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
  "status": "Una frase sobre el estado del debate (consenso, discusion acalorada, off-topic, dudas, etc.)"
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown (\`\`\`json).
- El JSON debe ser valido.
- Resume SOLO los posts que te paso.
- Ignora posts sin contenido ("pole", "+1").
- Responde en espanol.`

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

	// Create a map of author -> avatarUrl
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

		const rawResponse = await aiService.generate(finalPrompt)
		
		// Parse JSON response safely
		const parsedData = parseJSONResponse(rawResponse)

		// Hydrate participants with avatars using robust matching
		const participantsWithAvatars = parsedData.participants.map(p => {
			const cleanName = p.name.toLowerCase().trim()
            
            // 1. Exact/Case-insensitive match
			let avatarUrl = avatarMap.get(p.name) || avatarMap.get(cleanName)
			
			if (!avatarUrl) {
				// 2. Fuzzy match: Find map key that contains AI name OR AI name contains map key
                const matchedKey = Array.from(avatarMap.keys()).find(k => {
                    const kLower = k.toLowerCase()
                    return kLower.includes(cleanName) || cleanName.includes(kLower)
                })
				if (matchedKey) avatarUrl = avatarMap.get(matchedKey)
			}

            // Fix protocol-relative URLs (//mediavida...)
            if (avatarUrl && avatarUrl.startsWith('//')) {
                avatarUrl = 'https:' + avatarUrl
            }

			return {
				...p,
				avatarUrl
			}
		})

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
		const errorMsg = errorMessage.includes('429')
			? 'Limite de consultas IA excedido. Espera un momento.'
			: errorMessage.includes('400')
			? 'Contenido demasiado largo para procesar.'
			: 'Error al generar el resumen.'

		return createErrorSummary(title, pageNumber, errorMsg, allPagePosts.length, uniqueAuthors)
	}
}

// =============================================================================
// HELPERS
// =============================================================================

function parseJSONResponse(text: string): Omit<ThreadSummary, 'title' | 'postsAnalyzed' | 'uniqueAuthors' | 'pageNumber' | 'error'> {
	try {
        // Clean markdown code blocks if present
		const cleanText = text.replace(/```json\n?|\n?```/g, '').trim()
		return JSON.parse(cleanText)
	} catch (e) {
        logger.error('Failed to parse summary JSON:', text)
		// Fallback for parsing failure
		return {
			topic: 'Error al procesar el formato de la respuesta.',
			keyPoints: ['No se pudo generar un resumen estructurado.'],
			participants: [],
			status: 'Error de formato',
		}
	}
}

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

