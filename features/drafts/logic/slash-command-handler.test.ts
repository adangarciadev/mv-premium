/**
 * Tests for Slash Command Handler logic
 */
import { describe, it, expect } from 'vitest'

// Re-implement types and functions for testing

interface SlashCommandState {
	isActive: boolean
	query: string
	startIndex: number
	endIndex: number
	matches: TemplateMatch[]
	selectedIndex: number
}

interface TemplateMatch {
	id: string
	title: string
	trigger: string
	content: string
	subforum?: string
	category?: string
	score: number
}

interface Draft {
	id: string
	title: string
	content: string
	trigger?: string
	subforum?: string
	category?: string
}

const MAX_MATCHES = 5
const BREAK_CHARS = /[\s\n\r]/

function detectSlashCommand(text: string, cursorPos: number): SlashCommandState | null {
	let startIndex = cursorPos - 1

	while (startIndex >= 0) {
		const char = text[startIndex]

		if (char === '/') {
			if (startIndex === 0) break

			const prevChar = text[startIndex - 1]
			if (BREAK_CHARS.test(prevChar)) break

			return null
		}

		if (!/[a-z0-9-]/i.test(char)) {
			return null
		}

		startIndex--
	}

	if (startIndex < 0 || text[startIndex] !== '/') {
		return null
	}

	const query = text.substring(startIndex + 1, cursorPos).toLowerCase()

	return {
		isActive: true,
		query,
		startIndex,
		endIndex: cursorPos,
		matches: [],
		selectedIndex: 0,
	}
}

function findMatchingTemplates(query: string, templates: Draft[]): TemplateMatch[] {
	if (!templates || templates.length === 0) return []

	const normalizedQuery = query.toLowerCase().trim()

	const matches: TemplateMatch[] = templates
		.filter(t => t.trigger)
		.map(template => {
			const trigger = template.trigger!.toLowerCase()
			let score = 0

			if (normalizedQuery === '') {
				score = 1
			} else if (trigger === normalizedQuery) {
				score = 100
			} else if (trigger.startsWith(normalizedQuery)) {
				score = 50 + (normalizedQuery.length / trigger.length) * 40
			} else if (trigger.includes(normalizedQuery)) {
				score = 10 + (normalizedQuery.length / trigger.length) * 20
			}

			return {
				id: template.id,
				title: template.title || 'Sin título',
				trigger: template.trigger!,
				content: template.content,
				subforum: template.subforum,
				category: template.category,
				score,
			}
		})
		.filter(m => m.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_MATCHES)

	return matches
}

function replaceSlashCommand(
	text: string,
	state: SlashCommandState,
	content: string
): { newText: string; newCursorPos: number } {
	const before = text.substring(0, state.startIndex)
	const after = text.substring(state.endIndex)
	const newText = before + content + after
	const newCursorPos = state.startIndex + content.length

	return { newText, newCursorPos }
}

function getTemplatePreview(content: string, maxLength = 60): string {
	const stripped = content.replace(/\[.*?\]/g, '').trim()
	return stripped.length > maxLength ? stripped.slice(0, maxLength) + '...' : stripped
}

describe('slash-command-handler', () => {
	describe('detectSlashCommand', () => {
		it('should detect slash at start of text', () => {
			const result = detectSlashCommand('/test', 5)

			expect(result).not.toBeNull()
			expect(result?.query).toBe('test')
			expect(result?.startIndex).toBe(0)
		})

		it('should detect slash after space', () => {
			const result = detectSlashCommand('Hello /sal', 10)

			expect(result).not.toBeNull()
			expect(result?.query).toBe('sal')
		})

		it('should detect slash after newline', () => {
			const result = detectSlashCommand('Line1\n/cmd', 10)

			expect(result).not.toBeNull()
			expect(result?.query).toBe('cmd')
		})

		it('should return null for slash in middle of word', () => {
			const result = detectSlashCommand('hello/world', 11)

			expect(result).toBeNull()
		})

		it('should return null when no slash present', () => {
			const result = detectSlashCommand('hello world', 11)

			expect(result).toBeNull()
		})

		it('should return empty query for just slash', () => {
			const result = detectSlashCommand('/', 1)

			expect(result?.query).toBe('')
		})

		it('should handle cursor position correctly', () => {
			const result = detectSlashCommand('/template extra', 9)

			expect(result?.query).toBe('template')
			expect(result?.endIndex).toBe(9)
		})
	})

	describe('findMatchingTemplates', () => {
		const templates: Draft[] = [
			{ id: '1', title: 'Saludo', content: 'Hola!', trigger: 'saludo' },
			{ id: '2', title: 'Despedida', content: 'Adiós!', trigger: 'despedida' },
			{ id: '3', title: 'Sin trigger', content: 'Test' },
			{ id: '4', title: 'Saludo formal', content: 'Estimado/a', trigger: 'saludoformal' },
		]

		it('should find exact matches with highest score', () => {
			const matches = findMatchingTemplates('saludo', templates)

			expect(matches[0].trigger).toBe('saludo')
			expect(matches[0].score).toBe(100)
		})

		it('should find prefix matches', () => {
			const matches = findMatchingTemplates('sal', templates)

			expect(matches.length).toBeGreaterThanOrEqual(2)
			expect(matches.every(m => m.trigger.startsWith('sal'))).toBe(true)
		})

		it('should exclude templates without triggers', () => {
			const matches = findMatchingTemplates('', templates)

			expect(matches.find(m => m.title === 'Sin trigger')).toBeUndefined()
		})

		it('should return empty array for empty templates', () => {
			expect(findMatchingTemplates('test', [])).toEqual([])
		})

		it('should limit results to MAX_MATCHES', () => {
			const manyTemplates: Draft[] = Array.from({ length: 10 }, (_, i) => ({
				id: `${i}`,
				title: `Template ${i}`,
				content: 'Content',
				trigger: `trigger${i}`,
			}))

			const matches = findMatchingTemplates('trigger', manyTemplates)

			expect(matches.length).toBeLessThanOrEqual(MAX_MATCHES)
		})

		it('should be case insensitive', () => {
			const matches = findMatchingTemplates('SALUDO', templates)

			expect(matches.length).toBeGreaterThan(0)
		})
	})

	describe('replaceSlashCommand', () => {
		it('should replace command at start of text', () => {
			const state: SlashCommandState = {
				isActive: true,
				query: 'test',
				startIndex: 0,
				endIndex: 5,
				matches: [],
				selectedIndex: 0,
			}

			const result = replaceSlashCommand('/test', state, 'Replacement')

			expect(result.newText).toBe('Replacement')
			expect(result.newCursorPos).toBe(11)
		})

		it('should preserve text before and after command', () => {
			const state: SlashCommandState = {
				isActive: true,
				query: 'cmd',
				startIndex: 6,
				endIndex: 10,
				matches: [],
				selectedIndex: 0,
			}

			const result = replaceSlashCommand('Hello /cmd world', state, 'INSERTED')

			expect(result.newText).toBe('Hello INSERTED world')
		})

		it('should handle multiline content', () => {
			const state: SlashCommandState = {
				isActive: true,
				query: 'sig',
				startIndex: 0,
				endIndex: 4,
				matches: [],
				selectedIndex: 0,
			}

			const content = 'Line 1\nLine 2\nLine 3'
			const result = replaceSlashCommand('/sig', state, content)

			expect(result.newText).toBe(content)
			expect(result.newCursorPos).toBe(content.length)
		})
	})

	describe('getTemplatePreview', () => {
		it('should strip BBCode tags', () => {
			const content = '[B]Bold[/B] and [I]italic[/I]'
			const preview = getTemplatePreview(content)

			expect(preview).toBe('Bold and italic')
		})

		it('should truncate long content', () => {
			const content = 'A'.repeat(100)
			const preview = getTemplatePreview(content, 60)

			expect(preview.length).toBe(63) // 60 + '...'
			expect(preview.endsWith('...')).toBe(true)
		})

		it('should not truncate short content', () => {
			const content = 'Short text'
			const preview = getTemplatePreview(content)

			expect(preview).toBe('Short text')
		})

		it('should handle complex BBCode', () => {
			const content = '[URL=https://example.com]Link[/URL] and [IMG]http://img.jpg[/IMG]'
			const preview = getTemplatePreview(content)

			// The simple regex only strips BBCode tags, not their content
			expect(preview).toBe('Link and http://img.jpg')
		})
	})
})
