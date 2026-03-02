import { describe, expect, it } from 'vitest'
import { formatPostsForPrompt, formatPostsForUserAnalysisPrompt, type ExtractedPost } from './extract-posts'

function createPost(overrides: Partial<ExtractedPost> = {}): ExtractedPost {
	return {
		number: 10,
		author: 'OnE',
		content: 'Contenido',
		charCount: 9,
		...overrides,
	}
}

describe('formatPostsForUserAnalysisPrompt', () => {
	it('adds reply and mention hints when present', () => {
		const post = createPost({
			content: '[→ responde al #123] Respuesta a @Pepe con cita previa',
			votes: 3,
		})

		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{responde: #123}')
		expect(result).toContain('{menciona: @Pepe}')
		expect(result).toContain('[👍3]')
	})

	it('deduplicates repeated reply markers and mentions', () => {
		const post = createPost({
			content:
				'[→ responde al #123] Repite [→ responde al #123] y menciona @Pepe @Pepe @Juan',
		})

		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{responde: #123}')
		expect(result).toContain('{menciona: @Pepe, @Juan}')
	})

	it('omits hints when there is no interaction evidence', () => {
		const result = formatPostsForUserAnalysisPrompt([createPost({ content: 'Solo opinión sin citas ni menciones' })])
		expect(result).not.toContain('{responde:')
		expect(result).not.toContain('{menciona:')
	})

	it('does not tag first post number as OP in prompt formatting', () => {
		const firstPost = createPost({ number: 1, author: 'Pepe', content: 'Primer post del rango actual' })
		expect(formatPostsForPrompt([firstPost])).not.toContain('(OP)')
		expect(formatPostsForUserAnalysisPrompt([firstPost])).not.toContain('(OP)')
	})
})
