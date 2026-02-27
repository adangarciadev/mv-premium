import { describe, it, expect } from 'vitest'
import { formatPostsForUserAnalysisPrompt, type ExtractedPost } from './extract-posts'

function makePost(overrides: Partial<ExtractedPost> = {}): ExtractedPost {
	return {
		number: 1,
		author: 'TestUser',
		content: 'Hello world',
		charCount: 11,
		...overrides,
	}
}

describe('formatPostsForUserAnalysisPrompt', () => {
	it('formats a simple post without hints', () => {
		const result = formatPostsForUserAnalysisPrompt([makePost()])
		expect(result).toBe('#1 TestUser: Hello world')
	})

	it('includes vote label when present', () => {
		const result = formatPostsForUserAnalysisPrompt([makePost({ votes: 5 })])
		expect(result).toContain('[👍5]')
	})

	it('separates posts with double newlines', () => {
		const posts = [
			makePost({ number: 1, content: 'First' }),
			makePost({ number: 2, content: 'Second' }),
		]
		const result = formatPostsForUserAnalysisPrompt(posts)
		expect(result).toContain('First\n\n#2')
	})

	// =========================================================================
	// REPLY REFERENCES
	// =========================================================================

	it('extracts reply references from content', () => {
		const post = makePost({ content: '[→ responde al #42] I agree with you' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{responde: #42}')
	})

	it('deduplicates reply references', () => {
		const post = makePost({
			content: '[→ responde al #10] first [→ responde al #10] second',
		})
		const result = formatPostsForUserAnalysisPrompt([post])
		// Should only have one #10
		const match = result.match(/#10/g)
		// 1 in the hint + 2 in the content = 3 total, but only 1 in the hint section
		expect(result).toContain('{responde: #10}')
	})

	it('lists multiple different reply references', () => {
		const post = makePost({
			content: '[→ responde al #5] and [→ responde al #8] ...',
		})
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{responde: #5, #8}')
	})

	// =========================================================================
	// MENTIONS - improved regex tests
	// =========================================================================

	it('extracts @mentions from content', () => {
		const post = makePost({ content: 'Hey @Pepe how are you?' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @Pepe}')
	})

	it('extracts @mentions at start of content', () => {
		const post = makePost({ content: '@Admin please fix this' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @Admin}')
	})

	it('extracts @mentions after parentheses', () => {
		const post = makePost({ content: 'como dijo (@Morkar) en su post' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @Morkar}')
	})

	it('extracts @mentions after brackets', () => {
		const post = makePost({ content: 'ver [@JuanC] arriba' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @JuanC}')
	})

	it('extracts @mentions after closing bracket', () => {
		const post = makePost({ content: 'cita]@Pepe dijo esto' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @Pepe}')
	})

	it('extracts @mentions after quotes', () => {
		const post = makePost({ content: `according to "@LocoFlauta" it's fine` })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @LocoFlauta}')
	})

	it('extracts @mentions after single quotes', () => {
		const post = makePost({ content: "like '@DarkKnight' said" })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{menciona: @DarkKnight}')
	})

	it('deduplicates @mentions', () => {
		const post = makePost({ content: '@Pepe you and @Pepe again' })
		const result = formatPostsForUserAnalysisPrompt([post])
		const mentions = result.match(/@Pepe/g)
		// 2 in the content + 1 in the hint = 3 total
		// The hint should only list @Pepe once
		expect(result).toMatch(/\{menciona: @Pepe\}/)
	})

	it('limits mentions to 6', () => {
		const post = makePost({
			content: '@A1 @B2 @C3 @D4 @E5 @F6 @G7 @H8',
		})
		const result = formatPostsForUserAnalysisPrompt([post])
		const hintMatch = result.match(/\{menciona: ([^}]+)\}/)
		expect(hintMatch).toBeTruthy()
		const mentionedUsers = hintMatch![1].split(', ')
		expect(mentionedUsers.length).toBeLessThanOrEqual(6)
	})

	// =========================================================================
	// COMBINED HINTS
	// =========================================================================

	it('combines reply references and mentions', () => {
		const post = makePost({
			content: '[→ responde al #3] @Admin I think you are right',
		})
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).toContain('{responde: #3}')
		expect(result).toContain('{menciona: @Admin}')
	})

	it('shows no hint braces when content has no refs or mentions', () => {
		const post = makePost({ content: 'Just a regular comment without anything special' })
		const result = formatPostsForUserAnalysisPrompt([post])
		expect(result).not.toContain('{responde')
		expect(result).not.toContain('{menciona')
	})
})
